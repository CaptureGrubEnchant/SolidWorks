#!/usr/bin/env node

/**
 * SolidWorks MCP Server - Enhanced Architecture
 * Provides comprehensive SolidWorks automation with macro recording,
 * design tables, SQL integration, VBA generation, and PDM configuration
 */

import { createRequire } from 'node:module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import { zodToJsonSchema as _zodToJsonSchema } from 'zod-to-json-schema';

// Wrapper to avoid TS2589 "excessively deep" error from zod-to-json-schema generics with zod 3.25+
const zodToJsonSchema = (schema: unknown) => _zodToJsonSchema(schema as Parameters<typeof _zodToJsonSchema>[0]);

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Import cache management
import { CacheManager } from './cache/manager.js';
// Import database management
import { dbManager } from './db/connection.js';
// Import macro system
import { MacroRecorder } from './macro/index.js';
import { DesignTableResource } from './resources/design-table.js';
import { PDMResource } from './resources/pdm.js';
// Import resources and registry
import { resourceRegistry } from './resources/registry.js';
// Import API
import { SolidWorksAPI } from './solidworks/api.js';
// Import state management
import { ResourceStateStore } from './state/store.js';
import { analysisTools } from './tools/analysis.js';
import { drawingTools } from './tools/drawing.js';
import { exportTools } from './tools/export.js';
// Import existing tools
import { modelingTools } from './tools/modeling.js';
import { nativeMacroTools } from './tools/native-macro.js';
import { sketchTools } from './tools/sketch.js';
import { templateManagerTools } from './tools/template-manager.js';
import { vbaTools } from './tools/vba.js';
// Import logging
import { logError, logInfo, logOperation } from './utils/logger.js';

dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  solidworksPath: z.string().optional(),
  enableMacroRecording: z.boolean().default(true),
  enablePDM: z.boolean().default(false),
  pdmVault: z.string().optional(),
  sqlConnection: z.string().optional(),
  stateFile: z.string().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

class SolidWorksMCPServer {
  private server: Server;
  private api: SolidWorksAPI;
  private stateStore: ResourceStateStore;
  private macroRecorder: MacroRecorder;
  private cacheManager: CacheManager;
  private config: z.infer<typeof ConfigSchema>;

  constructor() {
    // Parse configuration
    this.config = ConfigSchema.parse({
      solidworksPath: process.env.SOLIDWORKS_PATH,
      enableMacroRecording: process.env.ENABLE_MACRO_RECORDING !== 'false',
      enablePDM: process.env.ENABLE_PDM === 'true',
      pdmVault: process.env.PDM_VAULT,
      sqlConnection: process.env.SQL_CONNECTION,
      stateFile: process.env.STATE_FILE,
      logLevel: process.env.LOG_LEVEL || 'info',
    });

    // Initialize components
    this.api = new SolidWorksAPI();
    this.stateStore = new ResourceStateStore(this.config.stateFile);
    this.macroRecorder = new MacroRecorder();
    this.cacheManager = new CacheManager(1000, 3600000); // 1000 entries, 1 hour TTL

    // Create MCP server
    this.server = new Server(
      {
        name: 'solidworks-mcp-server',
        version: packageJson.version,
        description:
          'Enhanced SolidWorks MCP Server with macro recording, design tables, SQL integration, and PDM support',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.registerResources();
    this.setupHandlers();
    this.setupMacroHandlers();
  }

  /**
   * Register resource types
   */
  private registerResources(): void {
    // Register Design Table resource
    resourceRegistry.register({
      type: 'design-table',
      name: 'Design Table',
      description: 'Manages SolidWorks design tables with SQL integration',
      schema: DesignTableResource.prototype.schema,
      factory: (id, name, properties) => new DesignTableResource(id, name, properties),
      examples: [
        {
          tableName: 'ParametricBox',
          parameters: [
            { name: 'Length', type: 'dimension', dataType: 'number', sqlColumn: 'length' },
            { name: 'Width', type: 'dimension', dataType: 'number', sqlColumn: 'width' },
            { name: 'Height', type: 'dimension', dataType: 'number', sqlColumn: 'height' },
          ],
          dataSource: {
            type: 'sql',
            connectionString: 'mssql://server:1433/database',
            query: 'SELECT * FROM design_configurations',
          },
        },
      ],
    });

    // Register PDM resource
    if (this.config.enablePDM) {
      resourceRegistry.register({
        type: 'pdm-configuration',
        name: 'PDM Configuration',
        description: 'Manages SolidWorks PDM vault configurations and operations',
        schema: PDMResource.prototype.schema,
        factory: (id, name, properties) => new PDMResource(id, name, properties),
        examples: [
          {
            vaultName: 'Engineering',
            operations: {
              checkIn: { enabled: true, comment: 'Auto check-in' },
              checkOut: { enabled: true, getLatestVersion: true },
            },
          },
        ],
      });
    }

    logInfo('Resources registered', {
      types: resourceRegistry.getAllTypes(),
    });
  }

  /**
   * Setup request handlers
   */
  private setupHandlers(): void {
    // Combine all tools including enhanced refactored versions
    const allTools = [
      ...modelingTools,
      ...drawingTools,
      ...sketchTools,
      ...exportTools,
      ...vbaTools,
      ...analysisTools,
      ...templateManagerTools,
      ...nativeMacroTools,
      // Add macro tools
      {
        name: 'macro_start_recording',
        description: 'Start recording a new macro',
        inputSchema: z.object({
          name: z.string(),
          description: z.string().optional(),
        }),
        handler: (args: any) => {
          const id = this.macroRecorder.startRecording(args.name, args.description);
          return { macroId: id, status: 'recording' };
        },
      },
      {
        name: 'macro_stop_recording',
        description: 'Stop the current macro recording',
        inputSchema: z.object({}),
        handler: () => {
          const recording = this.macroRecorder.stopRecording();
          return recording || { error: 'No recording in progress' };
        },
      },
      {
        name: 'macro_export_vba',
        description: 'Export a recorded macro to VBA code',
        inputSchema: z.object({
          macroId: z.string(),
        }),
        handler: (args: any) => {
          const vbaCode = this.macroRecorder.exportToVBA(args.macroId);
          return { code: vbaCode };
        },
      },
      // Add design table tools
      {
        name: 'design_table_create',
        description: 'Create a new design table with optional SQL data source',
        inputSchema: z.object({
          name: z.string(),
          config: z.any(),
        }),
        handler: async (args: any) => {
          const resource = new DesignTableResource(`dt_${Date.now()}`, args.name, args.config);
          const result = await resource.execute(this.api);
          await this.stateStore.setState(resource.id, resource.toState());
          return result;
        },
      },
      {
        name: 'design_table_refresh',
        description: 'Refresh design table data from SQL source',
        inputSchema: z.object({
          resourceId: z.string(),
        }),
        handler: async (args: any) => {
          const state = this.stateStore.getState(args.resourceId);
          if (!state || state.type !== 'design-table') {
            throw new Error('Design table resource not found');
          }
          const resource = new DesignTableResource(state.id, state.name, state.properties as any);
          await resource.refresh(this.api);
          await this.stateStore.setState(resource.id, resource.toState());
          return { status: 'refreshed' };
        },
      },
      // Add PDM tools if enabled
      ...(this.config.enablePDM
        ? [
            {
              name: 'pdm_configure',
              description: 'Configure PDM vault settings and operations',
              inputSchema: z.object({
                name: z.string(),
                config: z.any(),
              }),
              handler: async (args: any) => {
                const resource = new PDMResource(`pdm_${Date.now()}`, args.name, args.config);
                const result = await resource.execute(this.api);
                await this.stateStore.setState(resource.id, resource.toState());
                return result;
              },
            },
          ]
        : []),
    ];

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return {
        tools: allTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(tool.inputSchema),
        })),
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logOperation(name, 'started', args);

      const tool = allTools.find((t) => t.name === name);
      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool "${name}" not found`);
      }

      try {
        // Validate input
        const validatedArgs = tool.inputSchema.parse(args);

        // Record action if recording
        if (this.config.enableMacroRecording && this.macroRecorder) {
          try {
            this.macroRecorder.recordAction(name, tool.description, validatedArgs);
          } catch {
            // Recording not in progress, ignore
          }
        }

        // Ensure SolidWorks connection
        if (!this.api.isConnected()) {
          await this.api.connect();
        }

        // Execute tool
        const result = await tool.handler(validatedArgs, this.api);

        logOperation(name, 'completed', { result });

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logOperation(name, 'failed', { error });

        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid parameters: ${error.errors.map((e) => e.message).join(', ')}`
          );
        }
        throw error;
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, () => {
      const resources = this.stateStore.getAllStates();

      return {
        resources: resources.map((state) => ({
          uri: `solidworks://${state.type}/${state.id}`,
          name: state.name,
          mimeType: 'application/json',
          description: `${state.type} resource: ${state.name}`,
        })),
      };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, (request) => {
      const { uri } = request.params;

      // Parse URI: solidworks://type/id
      const match = uri.match(/^solidworks:\/\/([^/]+)\/(.+)$/);
      if (!match) {
        throw new McpError(ErrorCode.InvalidRequest, 'Invalid resource URI');
      }

      const [, , id] = match;
      const state = this.stateStore.getState(id);

      if (!state) {
        throw new McpError(ErrorCode.InvalidRequest, 'Resource not found');
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(state, null, 2),
          },
        ],
      };
    });
  }

  /**
   * Setup macro action handlers
   */
  private setupMacroHandlers(): void {
    // Register handlers for different action types
    this.macroRecorder.registerActionHandler('create-sketch', async (action) => {
      return await this.api.createSketch(action.parameters);
    });

    this.macroRecorder.registerActionHandler('add-line', async (action) => {
      return await this.api.addLine(action.parameters);
    });

    this.macroRecorder.registerActionHandler('extrude', async (action) => {
      return await this.api.extrude(action.parameters);
    });

    // Add more handlers as needed
  }

  /**
   * Initialize and start the server
   */
  async start(): Promise<void> {
    try {
      // Load saved state
      await this.stateStore.load();
      logInfo('State store loaded', this.stateStore.getStatistics());

      // Start server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logInfo('SolidWorks MCP Server started', {
        version: packageJson.version,
        features: {
          macroRecording: this.config.enableMacroRecording,
          pdmIntegration: this.config.enablePDM,
          sqlIntegration: !!this.config.sqlConnection,
        },
      });

      // Handle shutdown
      process.on('SIGINT', async () => {
        logInfo('Shutting down server...');
        await this.shutdown();
        process.exit(0);
      });
    } catch (error) {
      logError('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    logInfo('Starting server shutdown...');

    // Save state
    await this.stateStore.save();

    // Stop auto-save
    this.stateStore.stopAutoSave();

    // Clear cache
    this.cacheManager.clear();

    // Close all database connections
    await dbManager.closeAll();

    // Clear macro recorder
    this.macroRecorder.clear();

    // Disconnect from SolidWorks
    if (this.api.isConnected()) {
      await this.api.disconnect();
    }

    logInfo('Server shutdown complete');
  }
}

// Main entry point
async function main() {
  try {
    const server = new SolidWorksMCPServer();
    await server.start();
  } catch (error) {
    logError('Fatal error', error);
    process.exit(1);
  }
}

// Always run main when this file is executed
main().catch((error) => {
  // Don't use console.error in MCP servers - it interferes with JSON-RPC
  logError('Failed to start SolidWorks MCP Server', error);
  process.exit(1);
});

export { SolidWorksMCPServer };
