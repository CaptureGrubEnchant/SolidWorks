/**
 * Edge.js Adapter for SolidWorks COM Integration
 *
 * This adapter uses Edge.js to bridge Node.js with C# code,
 * providing full access to SolidWorks COM API without the
 * parameter limitations of direct COM bridges.
 */

import { logger } from '../utils/logger.js';
// @ts-ignore - Edge.js requires .NET runtime
// import edge from 'edge-js';
import type { AdapterHealth, AdapterResult, Command, ISolidWorksAdapter } from './types.js';

export class EdgeJsAdapter implements ISolidWorksAdapter {
  private executeCS: any;
  private connected: boolean = false;

  isConnected(): boolean {
    return this.connected;
  }

  constructor() {
    this.initializeCSharpBridge();
  }

  private initializeCSharpBridge() {
    // Define C# code that will be compiled and executed
    const _csharpCode = `
      using System;
      using System.Threading.Tasks;
      using System.Dynamic;
      using System.Collections.Generic;
      using System.Runtime.InteropServices;
      
      public class SolidWorksExecutor
      {
        private dynamic swApp;
        private dynamic currentModel;
        
        public async Task<object> Invoke(dynamic input)
        {
          try
          {
            string command = (string)input.command;
            var parameters = (IDictionary<string, object>)input.parameters;
            
            switch (command)
            {
              case "Connect":
                return await ConnectToSolidWorks();
              
              case "Disconnect":
                return await DisconnectFromSolidWorks();
              
              case "CreateExtrusion":
                return await CreateExtrusion(parameters);
              
              case "ExecuteMethod":
                return await ExecuteMethod(parameters);
              
              default:
                throw new Exception($"Unknown command: {command}");
            }
          }
          catch (Exception ex)
          {
            return new
            {
              success = false,
              error = ex.Message,
              stackTrace = ex.StackTrace
            };
          }
        }
        
        private async Task<object> ConnectToSolidWorks()
        {
          return await Task.Run(() =>
          {
            Type swType = Type.GetTypeFromProgID("SldWorks.Application");
            swApp = Activator.CreateInstance(swType);
            swApp.Visible = true;
            
            return new
            {
              success = true,
              message = "Connected to SolidWorks"
            };
          });
        }
        
        private async Task<object> DisconnectFromSolidWorks()
        {
          return await Task.Run(() =>
          {
            if (currentModel != null)
            {
              Marshal.ReleaseComObject(currentModel);
              currentModel = null;
            }
            
            if (swApp != null)
            {
              Marshal.ReleaseComObject(swApp);
              swApp = null;
            }
            
            GC.Collect();
            GC.WaitForPendingFinalizers();
            
            return new
            {
              success = true,
              message = "Disconnected from SolidWorks"
            };
          });
        }
        
        private async Task<object> CreateExtrusion(IDictionary<string, object> parameters)
        {
          return await Task.Run(() =>
          {
            if (swApp == null || currentModel == null)
            {
              throw new Exception("Not connected to SolidWorks or no active model");
            }
            
            // Extract parameters with defaults
            double depth = Convert.ToDouble(parameters.ContainsKey("depth") ? parameters["depth"] : 0.025);
            bool reverseDir = Convert.ToBoolean(parameters.ContainsKey("reverse") ? parameters["reverse"] : false);
            bool bothDirections = Convert.ToBoolean(parameters.ContainsKey("bothDirections") ? parameters["bothDirections"] : false);
            double draftAngle = Convert.ToDouble(parameters.ContainsKey("draft") ? parameters["draft"] : 0);
            int draftOutward = Convert.ToInt32(parameters.ContainsKey("draftOutward") ? parameters["draftOutward"] : 0);
            int draftWhileExtruding = Convert.ToInt32(parameters.ContainsKey("draftWhileExtruding") ? parameters["draftWhileExtruding"] : 0);
            double offsetDistance = Convert.ToDouble(parameters.ContainsKey("offsetDistance") ? parameters["offsetDistance"] : 0);
            bool offsetReverse = Convert.ToBoolean(parameters.ContainsKey("offsetReverse") ? parameters["offsetReverse"] : false);
            bool translateSurface = Convert.ToBoolean(parameters.ContainsKey("translateSurface") ? parameters["translateSurface"] : false);
            bool merge = Convert.ToBoolean(parameters.ContainsKey("merge") ? parameters["merge"] : true);
            bool flipSideToCut = Convert.ToBoolean(parameters.ContainsKey("flipSideToCut") ? parameters["flipSideToCut"] : false);
            
            // Call SolidWorks FeatureExtrusion3 with all parameters
            dynamic feature = currentModel.FeatureManager.FeatureExtrusion3(
              true,                    // Sd (true for single direction)
              reverseDir,              // Flip
              bothDirections,          // Dir (both directions)
              0,                       // T1 (end condition: blind)
              0,                       // T2 (end condition for second direction)
              depth,                   // D1 (depth)
              0.0,                     // D2 (depth for second direction)
              false,                   // Dchk1 (draft while extruding, dir 1)
              false,                   // Dchk2 (draft while extruding, dir 2)
              draftAngle,              // Dang1 (draft angle, dir 1)
              0.0,                     // Dang2 (draft angle, dir 2)
              draftOutward,            // OffsetReverse1 (draft outward)
              0,                       // OffsetReverse2
              false,                   // TranslateSurface1
              false,                   // TranslateSurface2
              merge,                   // Merge
              flipSideToCut,          // FlipSideToCut (for cut extrude)
              true,                    // Update
              0,                       // StartCondition
              0,                       // FlipStartOffset
              false                    // SelectionManager
            );
            
            if (feature != null)
            {
              return new
              {
                success = true,
                featureName = feature.Name,
                featureType = feature.GetTypeName2()
              };
            }
            else
            {
              throw new Exception("Failed to create extrusion feature");
            }
          });
        }
        
        private async Task<object> ExecuteMethod(IDictionary<string, object> parameters)
        {
          return await Task.Run(() =>
          {
            string objectPath = (string)parameters["objectPath"];
            string methodName = (string)parameters["methodName"];
            object[] args = parameters.ContainsKey("arguments") ? 
              (object[])parameters["arguments"] : new object[0];
            
            // Navigate to the target object
            dynamic targetObject = swApp;
            if (!string.IsNullOrEmpty(objectPath) && objectPath != "Application")
            {
              if (objectPath == "ActiveDoc" || objectPath == "CurrentModel")
              {
                targetObject = currentModel;
              }
              else
              {
                string[] path = objectPath.Split('.');
                foreach (string prop in path)
                {
                  targetObject = targetObject.GetType().InvokeMember(
                    prop,
                    System.Reflection.BindingFlags.GetProperty,
                    null,
                    targetObject,
                    null
                  );
                }
              }
            }
            
            // Execute the method
            object result = targetObject.GetType().InvokeMember(
              methodName,
              System.Reflection.BindingFlags.InvokeMethod,
              null,
              targetObject,
              args
            );
            
            return new
            {
              success = true,
              result = result
            };
          });
        }
      }
    `;

    // Compile the C# code (commented out - requires Edge.js)
    // this.executeCS = edge.func(csharpCode);

    // Mock implementation for now
    this.executeCS = async (_input: any) => {
      return { success: false, error: 'Edge.js not available - install .NET runtime' };
    };
  }

  async connect(): Promise<void> {
    try {
      const result = await this.executeCS({
        command: 'Connect',
        parameters: {},
      });

      if (result.success) {
        this.connected = true;
        logger.info('Connected to SolidWorks via Edge.js adapter');
      } else {
        throw new Error(result.error || 'Failed to connect');
      }
    } catch (error) {
      logger.error('Edge.js adapter connection failed', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const result = await this.executeCS({
        command: 'Disconnect',
        parameters: {},
      });

      if (result.success) {
        this.connected = false;
        logger.info('Disconnected from SolidWorks');
      }
    } catch (error) {
      logger.error('Edge.js adapter disconnection failed', error);
      throw error;
    }
  }

  async execute<T>(command: Command): Promise<AdapterResult<T>> {
    if (!this.connected && command.name !== 'Connect') {
      throw new Error('Not connected to SolidWorks');
    }

    try {
      // Validate command before execution
      if (!command.validate()) {
        throw new Error(`Command validation failed: ${command.name}`);
      }

      // Map command to C# execution
      let result: any;
      if (command.name === 'CreateExtrusion') {
        result = await this.executeCS({
          command: 'CreateExtrusion',
          parameters: command.parameters,
        });
      } else {
        // Generic method execution
        result = await this.executeCS({
          command: 'ExecuteMethod',
          parameters: {
            objectPath: command.parameters.objectPath || 'Application',
            methodName: command.name,
            arguments: command.parameters.arguments || [],
          },
        });
      }

      if (result.success) {
        return {
          success: true,
          data: result as T,
          timing: {
            start: new Date(),
            end: new Date(),
            duration: 0,
          },
        };
      } else {
        throw new Error(result.error || 'Command execution failed');
      }
    } catch (error) {
      logger.error(`Edge.js adapter command failed: ${command.name}`, error);

      // Try fallback if available
      if (command.fallback) {
        logger.info(`Attempting fallback for ${command.name}`);
        return this.execute(command.fallback);
      }

      throw error;
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const result = await this.executeCS({
        command: 'ExecuteMethod',
        parameters: {
          objectPath: 'Application',
          methodName: 'GetProcessID',
          arguments: [],
        },
      });

      return {
        healthy: result.success && result.result > 0,
        lastCheck: new Date(),
        errorCount: 0,
        successCount: 1,
        averageResponseTime: 0,
        connectionStatus: 'connected',
      };
    } catch (_error) {
      return {
        healthy: false,
        lastCheck: new Date(),
        errorCount: 1,
        successCount: 0,
        averageResponseTime: 0,
        connectionStatus: 'disconnected',
      };
    }
  }

  // Stub implementations for missing interface methods
  async executeRaw(_method: string, _args: any[]): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async openModel(_filePath: string): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async closeModel(_save?: boolean): Promise<void> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createPart(): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createAssembly(): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createDrawing(): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createExtrusion(_params: any): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createRevolve(_params: any): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createSweep(_params: any): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createLoft(_params: any): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async createSketch(_plane: string): Promise<string> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async addLine(_x1: number, _y1: number, _x2: number, _y2: number): Promise<void> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async addCircle(_centerX: number, _centerY: number, _radius: number): Promise<void> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async addRectangle(_x1: number, _y1: number, _x2: number, _y2: number): Promise<void> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async exitSketch(): Promise<void> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async getMassProperties(): Promise<any> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async exportFile(_filePath: string, _format: string): Promise<void> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async getDimension(_name: string): Promise<number> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }

  async setDimension(_name: string, _value: number): Promise<void> {
    throw new Error('Edge.js adapter not available - .NET runtime required');
  }
}

/**
 * Factory function to create Edge.js adapter with proper initialization
 */
export async function createEdgeJsAdapter(): Promise<EdgeJsAdapter> {
  const adapter = new EdgeJsAdapter();
  await adapter.connect();
  return adapter;
}
