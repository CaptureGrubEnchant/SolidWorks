/**
 * Enhanced WinAx Adapter for SolidWorks COM Integration
 *
 * This adapter wraps the existing winax-based SolidWorksAPI with:
 * - Parameter limitation workarounds
 * - Automatic fallback to macro execution for complex operations
 * - Robust error handling and retry logic
 * - Connection health monitoring
 */

import type { SolidWorksFeature, SolidWorksModel } from '../solidworks/types.js';
import { logger } from '../utils/logger.js';
import type {
  AdapterHealth,
  AdapterResult,
  Command,
  ExtrusionParameters,
  ISolidWorksAdapter,
  LoftParameters,
  MassProperties,
  RevolveParameters,
  SweepParameters,
} from './types.js';
import { loadWinax } from './winax-loader.js';

let winax: any = null;

const END_CONDITION_MAP: Record<string, number> = {
  Blind: 0,
  ThroughAll: 1,
  UpToNext: 2,
  UpToVertex: 3,
  UpToSurface: 4,
  OffsetFromSurface: 5,
  MidPlane: 6,
};

function resolveEndCondition(value: number | string | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return END_CONDITION_MAP[value] ?? 0;
  return 0;
}

export class WinAxAdapter implements ISolidWorksAdapter {
  private swApp: any = null;
  private currentModel: any = null;
  private connected: boolean = false;
  private errorCount: number = 0;
  private successCount: number = 0;
  private lastHealthCheck: Date = new Date();
  private responseTimings: number[] = [];

  async connect(): Promise<void> {
    const startTime = Date.now();

    try {
      if (!winax) winax = loadWinax();

      // Try primary connection method
      try {
        this.swApp = new winax.Object('SldWorks.Application');
      } catch (_error) {
        // Try alternative connection method
        this.swApp = winax.Object('SldWorks.Application');
      }

      if (!this.swApp) {
        throw new Error('Failed to create SolidWorks COM object');
      }

      // Make SolidWorks visible
      this.swApp.Visible = true;

      // Verify connection by getting process ID
      try {
        const processId = this.swApp.GetProcessID();
        if (processId > 0) {
          this.connected = true;
          this.successCount++;
          logger.info(`Connected to SolidWorks (PID: ${processId})`);
        }
      } catch (_e) {
        // GetProcessID might not be available, assume connected
        this.connected = true;
        this.successCount++;
        logger.info('Connected to SolidWorks');
      }

      const duration = Date.now() - startTime;
      this.responseTimings.push(duration);
    } catch (error) {
      this.errorCount++;
      this.connected = false;
      logger.error('Failed to connect to SolidWorks', error);
      throw new Error(`Failed to connect to SolidWorks: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.currentModel) {
        this.currentModel = null;
      }

      if (this.swApp) {
        // Don't close SolidWorks, just disconnect
        this.swApp = null;
      }

      this.connected = false;
      logger.info('Disconnected from SolidWorks');
    } catch (error) {
      logger.error('Error during disconnect', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const startTime = Date.now();
    let healthy = false;
    let connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';

    try {
      if (this.swApp) {
        // Try to get active document or process ID
        try {
          const processId = this.swApp.GetProcessID();
          if (processId > 0) {
            healthy = true;
            connectionStatus = 'connected';
          }
        } catch (_e) {
          // Try alternative health check
          try {
            const _docCount = this.swApp.GetDocumentCount();
            healthy = true;
            connectionStatus = 'connected';
          } catch (_e2) {
            connectionStatus = 'error';
          }
        }
      }
    } catch (_error) {
      connectionStatus = 'error';
      this.errorCount++;
    }

    const duration = Date.now() - startTime;
    this.responseTimings.push(duration);

    // Keep only last 100 timings
    if (this.responseTimings.length > 100) {
      this.responseTimings = this.responseTimings.slice(-100);
    }

    const avgResponseTime =
      this.responseTimings.length > 0
        ? this.responseTimings.reduce((a, b) => a + b, 0) / this.responseTimings.length
        : 0;

    this.lastHealthCheck = new Date();

    return {
      healthy,
      lastCheck: this.lastHealthCheck,
      errorCount: this.errorCount,
      successCount: this.successCount,
      averageResponseTime: avgResponseTime,
      connectionStatus,
    };
  }

  async execute<T>(command: Command): Promise<AdapterResult<T>> {
    const startTime = Date.now();

    try {
      // Validate command
      const validation = command.validate();
      if (!validation.valid) {
        throw new Error(`Command validation failed: ${validation.errors?.join(', ')}`);
      }

      // Execute based on command name
      let result: any;

      switch (command.name) {
        case 'CreateExtrusion':
          result = await this.createExtrusion(command.parameters as ExtrusionParameters);
          break;

        case 'CreateRevolve':
          result = await this.createRevolve(command.parameters as RevolveParameters);
          break;

        case 'OpenModel':
          result = await this.openModel(command.parameters.filePath);
          break;

        case 'CloseModel':
          result = await this.closeModel(command.parameters.save);
          break;

        case 'CreatePart':
          result = await this.createPart();
          break;

        case 'ExportFile':
          result = await this.exportFile(command.parameters.filePath, command.parameters.format);
          break;

        default:
          // Try generic method execution
          result = await this.executeRaw(command.name, Object.values(command.parameters));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.successCount++;
      this.responseTimings.push(duration);

      return {
        success: true,
        data: result as T,
        timing: {
          start: startTime,
          end: endTime,
          duration,
        },
      };
    } catch (error) {
      this.errorCount++;

      // Try fallback if available
      if (command.fallback) {
        logger.info(`Executing fallback for ${command.name}`);
        return this.execute(command.fallback);
      }

      const endTime = Date.now();

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timing: {
          start: startTime,
          end: endTime,
          duration: endTime - startTime,
        },
      };
    }
  }

  async executeRaw(method: string, args: any[]): Promise<any> {
    if (!this.swApp) {
      throw new Error('Not connected to SolidWorks');
    }

    try {
      // Get the target object (app or current model)
      const target = this.currentModel || this.swApp;

      // Try to execute the method
      if (typeof target[method] === 'function') {
        return target[method](...args);
      } else {
        throw new Error(`Method ${method} not found`);
      }
    } catch (error) {
      logger.error(`Failed to execute raw method: ${method}`, error);
      throw error;
    }
  }

  async openModel(filePath: string): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    const errors = { value: 0 };
    const warnings = { value: 0 };

    // Determine file type from extension
    const ext = filePath.toLowerCase().split('.').pop();
    let docType = 1; // swDocPART
    if (ext === 'sldasm') docType = 2; // swDocASSEMBLY
    if (ext === 'slddrw') docType = 3; // swDocDRAWING

    this.currentModel = this.swApp.OpenDoc6(
      filePath,
      docType,
      1, // swOpenDocOptions_Silent
      '',
      errors,
      warnings
    );

    if (!this.currentModel) {
      throw new Error(`Failed to open model: ${filePath}`);
    }

    return {
      path: filePath,
      name: this.currentModel.GetTitle(),
      type: ['Part', 'Assembly', 'Drawing'][docType - 1] as 'Part' | 'Assembly' | 'Drawing',
      isActive: true,
    };
  }

  async closeModel(save: boolean = false): Promise<void> {
    if (!this.currentModel) return;

    if (save) {
      try {
        this.currentModel.Save3(1, 0, 0); // swSaveAsOptions_Silent
      } catch (_e) {
        // Try alternative save
        this.currentModel.Save();
      }
    }

    const modelTitle = this.currentModel.GetTitle();
    if (this.swApp && modelTitle) {
      this.swApp.CloseDoc(modelTitle);
    }

    this.currentModel = null;
  }

  async createPart(): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    this.currentModel = this.swApp.NewPart();

    if (!this.currentModel) {
      // Fallback to template-based creation
      const template = this.swApp.GetUserPreferenceStringValue(8) || '';
      this.currentModel = this.swApp.NewDocument(template, 0, 0, 0);
    }

    return {
      path: '',
      name: this.currentModel.GetTitle(),
      type: 'Part',
      isActive: true,
    };
  }

  async createAssembly(): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    this.currentModel = this.swApp.NewAssembly();

    return {
      path: '',
      name: this.currentModel.GetTitle(),
      type: 'Assembly',
      isActive: true,
    };
  }

  async createDrawing(): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    this.currentModel = this.swApp.NewDrawing();

    return {
      path: '',
      name: this.currentModel.GetTitle(),
      type: 'Drawing',
      isActive: true,
    };
  }

  async createExtrusion(params: ExtrusionParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    // Check if we need to use macro fallback for complex parameters
    const needsMacroFallback = this.requiresMacroFallback(params);

    if (needsMacroFallback) {
      logger.info('Using macro fallback for extrusion due to parameter complexity');
      return this.createExtrusionViaMacro(params);
    }

    try {
      // Use simplified parameters for direct COM call
      const featureMgr = this.currentModel.FeatureManager;

      // Exit sketch mode if active
      const sketchMgr = this.currentModel.SketchManager;
      if (sketchMgr.ActiveSketch) {
        sketchMgr.InsertSketch(true);
      }

      // Clear selections
      this.currentModel.ClearSelection2(true);

      // Select sketch
      this.selectSketchForExtrusion();

      // Convert depth to meters
      const depthInMeters = params.depth / 1000;

      // Try simple extrusion with limited parameters
      let feature = null;

      try {
        // Method 1: Try with minimal parameters using array
        const args = [
          true, // Single direction
          params.reverse || false, // Flip
          false, // Dir (both directions)
          0, // T1 (blind)
          0, // T2
          depthInMeters, // D1 (depth)
          0, // D2
          false, // Dchk1
          false, // Dchk2
          false, // Ddir1
          false, // Ddir2
          params.draft || 0, // Dang1
          0, // Dang2
        ];

        // Try direct call with spread operator
        feature = featureMgr.FeatureExtrusion(...args);
      } catch (_e) {
        logger.warn('Direct extrusion failed, trying alternative method');

        // Method 2: Try FeatureExtrusion2 if available
        try {
          feature = featureMgr.FeatureExtrusion2(
            true, // Sd
            params.reverse || false, // Flip
            false, // Dir
            0, // T1
            0, // T2
            depthInMeters, // D1
            0, // D2
            false, // Dchk1
            false, // Dchk2
            false, // Ddir1
            false // Ddir2
          );
        } catch (_e2) {
          // Method 3: Use macro fallback
          logger.warn('All direct methods failed, using macro fallback');
          return this.createExtrusionViaMacro(params);
        }
      }

      if (!feature) {
        throw new Error('Failed to create extrusion feature');
      }

      // Clear selections and rebuild
      this.currentModel.ClearSelection2(true);
      this.currentModel.EditRebuild3();

      return {
        name: feature.Name || 'Boss-Extrude1',
        type: 'Extrusion',
        suppressed: false,
      };
    } catch (error) {
      logger.error('Extrusion failed', error);

      // Final fallback to macro
      return this.createExtrusionViaMacro(params);
    }
  }

  private requiresMacroFallback(params: ExtrusionParameters): boolean {
    // Check if parameters exceed what direct COM can handle
    const complexParams = [
      'draftWhileExtruding',
      'offsetDistance',
      'offsetReverse',
      'translateSurface',
      'flipSideToCut',
      'startCondition',
      'endCondition',
      'thinFeature',
      'thinThickness',
    ];

    return complexParams.some((param) => params[param as keyof ExtrusionParameters] !== undefined);
  }

  private async createExtrusionViaMacro(params: ExtrusionParameters): Promise<SolidWorksFeature> {
    // Direct FeatureExtrusion3 call with full arg list — replaces the prior .swp roundtrip
    // which never worked because plain-text VBA cannot satisfy SolidWorks' OLE Compound
    // Document expectation for .swp (see issue #25).
    this.selectSketchForExtrusion();

    const depth1 = params.depth / 1000;
    const depth2 = (params.depth2 ?? 0) / 1000;
    const draftRad = ((params.draft ?? 0) * Math.PI) / 180;
    const t1 = resolveEndCondition(params.endCondition);
    const merge = params.merge !== false;
    const sd = !params.bothDirections;

    const feature = this.currentModel.FeatureManager.FeatureExtrusion3(
      sd,
      params.reverse ?? false,
      params.bothDirections ?? false,
      t1,
      0,
      depth1,
      depth2,
      params.draftWhileExtruding ?? (params.draft ?? 0) !== 0,
      false,
      params.draftOutward ?? false,
      false,
      draftRad,
      0,
      params.offsetReverse ?? false,
      false,
      params.translateSurface ?? false,
      false,
      merge, // 18 Merge
      true, // 19 UseFeatScope
      true, // 20 UseAutoSelect
      params.startCondition ?? 0, // 21 T0: start condition
      0, // 22 StartOffset
      false // 23 FlipStartOffset
    );

    if (!feature) {
      throw new Error('FeatureExtrusion3 returned null');
    }

    if (params.thinFeature) {
      const thinTypeMap: Record<string, number> = {
        OneDirection: 0,
        TwoSide: 1,
        MidPlane: 2,
      };
      const thinType = thinTypeMap[params.thinType ?? 'OneDirection'] ?? 0;
      try {
        feature.SetThinWallType(
          thinType,
          (params.thinThickness ?? 1) / 1000,
          0,
          params.capEnds ?? false,
          (params.capThickness ?? 1) / 1000
        );
      } catch (e) {
        logger.warn(`SetThinWallType failed: ${e}`);
      }
    }

    return {
      name: feature.Name || 'Boss-Extrude1',
      type: 'Extrusion',
      suppressed: false,
    };
  }

  private selectSketchForExtrusion(): boolean {
    // Method 1 (most reliable): Feature tree traversal
    // Avoids SelectByID2 COM type mismatch issues
    try {
      const featureCount = this.currentModel.GetFeatureCount();
      for (let i = 0; i < Math.min(10, featureCount); i++) {
        const feat = this.currentModel.FeatureByPositionReverse(i);
        if (feat) {
          const typeName = feat.GetTypeName2();
          if (typeName === 'ProfileFeature' || typeName?.toLowerCase().includes('sketch')) {
            feat.Select2(false, 0);
            logger.info(`Selected sketch by feature tree: ${feat.Name || feat.GetName()}`);
            return true;
          }
        }
      }
    } catch (e) {
      logger.warn(`Feature tree search failed: ${e}`);
    }

    // Method 2 (fallback): SelectByID2 with undefined for optional params
    const ext = this.currentModel.Extension;
    const sketchNames = ['Sketch1', 'Sketch2', 'Sketch3', 'Sketch4', 'Sketch5'];

    for (const name of sketchNames) {
      try {
        const selected = ext.SelectByID2(name, 'SKETCH', 0, 0, 0, false, 0, undefined, 0);
        if (selected) {
          logger.info(`Selected sketch via SelectByID2: ${name}`);
          return true;
        }
      } catch (_e) {
        // Try next name
      }
    }

    return false;
  }

  async createRevolve(params: RevolveParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    this.selectSketchForExtrusion();

    if (params.axis) {
      this.currentModel.Extension.SelectByID2(params.axis, 'AXIS', 0, 0, 0, true, 16, undefined, 0);
    }

    const angleRad = (params.angle * Math.PI) / 180;
    const direction = params.direction;
    const isReverse = direction === 'Reverse' || direction === 1;
    const isBoth = direction === 'Both' || direction === 2;
    const merge = params.merge !== false;

    const feature = this.currentModel.FeatureManager.FeatureRevolve2(
      !isBoth,
      isReverse,
      isBoth,
      false,
      params.thinFeature ?? false,
      angleRad,
      0,
      0,
      0,
      0,
      0,
      merge
    );

    if (!feature) {
      throw new Error('FeatureRevolve2 returned null');
    }

    return {
      name: feature.Name || 'Revolve1',
      type: 'Revolution',
      suppressed: false,
    };
  }

  async createSweep(params: SweepParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    const ext = this.currentModel.Extension;
    this.currentModel.ClearSelection2(true);

    const profileSelected = ext.SelectByID2(params.profileSketch, 'SKETCH', 0, 0, 0, false, 1, undefined, 0);
    if (!profileSelected) throw new Error(`Profile sketch not found: ${params.profileSketch}`);

    const pathSelected = ext.SelectByID2(params.pathSketch, 'SKETCH', 0, 0, 0, true, 4, undefined, 0);
    if (!pathSelected) throw new Error(`Path sketch not found: ${params.pathSketch}`);

    const twistRad = ((params.twistAngle ?? 0) * Math.PI) / 180;
    const merge = params.merge !== false;

    const feature = this.currentModel.FeatureManager.InsertProtrusionSwept4(
      false,
      false,
      0,
      twistRad,
      false,
      0,
      0,
      merge,
      params.thinFeature ?? false,
      (params.thinThickness ?? 0) / 1000,
      0,
      true,
      false,
      true
    );

    if (!feature) {
      throw new Error('InsertProtrusionSwept4 returned null');
    }

    return {
      name: feature.Name || 'Sweep1',
      type: 'Sweep',
      suppressed: false,
    };
  }

  async createLoft(params: LoftParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    const ext = this.currentModel.Extension;
    this.currentModel.ClearSelection2(true);

    params.profiles.forEach((profile, index) => {
      const selected = ext.SelectByID2(profile, 'SKETCH', 0, 0, 0, index > 0, 1, undefined, 0);
      if (!selected) throw new Error(`Profile sketch not found: ${profile}`);
    });

    const guides = params.guideCurves ?? params.guides ?? [];
    for (const guide of guides) {
      ext.SelectByID2(guide, 'SKETCH', 0, 0, 0, true, 2, undefined, 0);
    }

    const closed = params.closed ?? params.close ?? false;

    const feature = this.currentModel.FeatureManager.InsertProtrusionLoft3(
      closed,
      false,
      false,
      false,
      false,
      0,
      0,
      0,
      0,
      params.thinFeature ?? false,
      (params.thinThickness ?? 0) / 1000,
      0,
      0,
      params.merge !== false,
      true,
      true
    );

    if (!feature) {
      throw new Error('InsertProtrusionLoft3 returned null');
    }

    return {
      name: feature.Name || 'Loft1',
      type: 'Loft',
      suppressed: false,
    };
  }

  async createSketch(plane: string): Promise<string> {
    if (!this.currentModel) throw new Error('No active model');

    const sketchMgr = this.currentModel.SketchManager;
    const ext = this.currentModel.Extension;

    // Select the plane
    const selected = ext.SelectByID2(plane, 'PLANE', 0, 0, 0, false, 0, undefined, 0);
    if (!selected) {
      throw new Error(`Failed to select plane: ${plane}`);
    }

    // Insert sketch
    sketchMgr.InsertSketch(true);
    const sketchName = sketchMgr.ActiveSketch?.Name || `Sketch${Date.now()}`;

    return sketchName;
  }

  async addLine(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const sketchMgr = this.currentModel.SketchManager;
    const line = sketchMgr.CreateLine(x1 / 1000, y1 / 1000, 0, x2 / 1000, y2 / 1000, 0);

    if (!line) {
      throw new Error('Failed to create line');
    }
  }

  async addCircle(centerX: number, centerY: number, radius: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const sketchMgr = this.currentModel.SketchManager;
    const circle = sketchMgr.CreateCircle(centerX / 1000, centerY / 1000, 0, radius / 1000);

    if (!circle) {
      throw new Error('Failed to create circle');
    }
  }

  async addRectangle(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const _sketchMgr = this.currentModel.SketchManager;

    // Create four lines for rectangle
    await this.addLine(x1, y1, x2, y1);
    await this.addLine(x2, y1, x2, y2);
    await this.addLine(x2, y2, x1, y2);
    await this.addLine(x1, y2, x1, y1);
  }

  async exitSketch(): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const sketchMgr = this.currentModel.SketchManager;
    sketchMgr.InsertSketch(true);
  }

  async getMassProperties(): Promise<MassProperties> {
    if (!this.currentModel) throw new Error('No active model');

    const ext = this.currentModel.Extension;
    const massProps = ext.CreateMassProperty();

    if (!massProps) {
      throw new Error('Failed to create mass property object');
    }

    // Update mass properties
    massProps.Update();

    const com = massProps.CenterOfMass;

    return {
      mass: massProps.Mass,
      volume: massProps.Volume,
      surfaceArea: massProps.SurfaceArea,
      centerOfMass: {
        x: com[0] * 1000, // Convert to mm
        y: com[1] * 1000,
        z: com[2] * 1000,
      },
      density: massProps.Density,
      momentsOfInertia: {
        Ixx: massProps.MomentOfInertia[0],
        Iyy: massProps.MomentOfInertia[4],
        Izz: massProps.MomentOfInertia[8],
        Ixy: massProps.MomentOfInertia[1],
        Iyz: massProps.MomentOfInertia[5],
        Ixz: massProps.MomentOfInertia[2],
      },
    };
  }

  async exportFile(filePath: string, format: string): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const ext = format.toLowerCase();
    let success = false;

    switch (ext) {
      case 'step':
      case 'stp':
      case 'iges':
      case 'igs':
      case 'stl':
      case 'pdf':
      case 'dxf':
      case 'dwg':
        success = this.currentModel.SaveAs3(filePath, 0, 2);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    if (!success) {
      throw new Error(`Failed to export to ${format}`);
    }
  }

  async getDimension(name: string): Promise<number> {
    if (!this.currentModel) throw new Error('No active model');

    const dimension = this.currentModel.Parameter(name);
    if (!dimension) {
      throw new Error(`Dimension ${name} not found`);
    }

    return dimension.SystemValue * 1000; // Convert to mm
  }

  async setDimension(name: string, value: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const dimension = this.currentModel.Parameter(name);
    if (!dimension) {
      throw new Error(`Dimension ${name} not found`);
    }

    dimension.SystemValue = value / 1000; // Convert to meters
    this.currentModel.EditRebuild3();
  }
}

/**
 * Factory function to create WinAx adapter
 */
export async function createWinAxAdapter(): Promise<WinAxAdapter> {
  const adapter = new WinAxAdapter();
  await adapter.connect();
  return adapter;
}
