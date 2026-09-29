/**
 * Stainless API Framework Integration for SolidWorks MCP
 *
 * This demonstrates how to use Stainless to create a type-safe,
 * well-documented API with automatic SDK generation.
 */

import { z } from 'zod';

// @ts-ignore - Stainless API not yet installed
// import { stl } from '@stainless-api/stl-api';

// Mock stl for now
const stl: any = {
  api: (config: any) => config,
  endpoint: (config: any) => config,
  paginated: (schema: any) => schema,
  websocket: (config: any) => config,
  retry: (config: any) => config,
  rateLimit: (config: any) => config,
};

import { FeatureSchema, ModelSchema, SketchSchema } from '../adapters/types.js';

/**
 * Request/Response schemas with Zod
 */
const CreateModelRequest = z.object({
  type: z.enum(['part', 'assembly', 'drawing']),
  template: z.string().optional(),
  name: z.string().optional(),
});

const CreateExtrusionRequest = z.object({
  sketchId: z.string(),
  depth: z.number().positive(),
  reverse: z.boolean().default(false),
  bothDirections: z.boolean().default(false),
  draft: z.number().default(0),
  merge: z.boolean().default(true),
});

const BatchOperationRequest = z.object({
  operations: z.array(
    z.object({
      type: z.string(),
      parameters: z.record(z.any()),
    })
  ),
  transactional: z.boolean().default(false),
});

const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

/**
 * Stainless API Definition
 *
 * This creates a fully type-safe API with:
 * - Automatic OpenAPI spec generation
 * - Client SDK generation
 * - Built-in pagination
 * - Consistent error handling
 */
export const solidworksAPI = stl.api({
  metadata: {
    title: 'SolidWorks MCP API',
    version: '3.0.0',
    description: 'Type-safe API for SolidWorks automation',
    contact: {
      name: 'SolidWorks MCP Team',
      email: 'support@solidworksmcp.dev',
    },
  },

  // Connection endpoints
  connection: {
    connect: stl.endpoint({
      method: 'POST',
      path: '/connection/connect',
      description: 'Connect to SolidWorks application',
      request: z.object({
        visible: z.boolean().default(true),
        timeout: z.number().default(30000),
      }),
      response: z.object({
        connected: z.boolean(),
        version: z.string(),
        processId: z.number(),
      }),
      errors: [ErrorResponse],
    }),

    disconnect: stl.endpoint({
      method: 'POST',
      path: '/connection/disconnect',
      description: 'Disconnect from SolidWorks',
      response: z.object({
        disconnected: z.boolean(),
      }),
    }),

    status: stl.endpoint({
      method: 'GET',
      path: '/connection/status',
      description: 'Get connection status',
      response: z.object({
        connected: z.boolean(),
        adapter: z.string(),
        uptime: z.number(),
        health: z.enum(['healthy', 'degraded', 'unhealthy']),
      }),
    }),
  },

  // Model operations
  models: {
    create: stl.endpoint({
      method: 'POST',
      path: '/models',
      description: 'Create a new SolidWorks model',
      request: CreateModelRequest,
      response: ModelSchema,
      errors: [ErrorResponse],
      examples: [
        {
          name: 'Create part',
          request: { type: 'part' },
          response: {
            path: '',
            name: 'Part1',
            type: 'Part',
            isActive: true,
          },
        },
      ],
    }),

    open: stl.endpoint({
      method: 'POST',
      path: '/models/open',
      description: 'Open an existing model',
      request: z.object({
        path: z.string(),
        readOnly: z.boolean().default(false),
      }),
      response: ModelSchema,
    }),

    list: stl.endpoint({
      method: 'GET',
      path: '/models',
      description: 'List all open models',
      response: stl.paginated(ModelSchema),
      query: z.object({
        type: z.enum(['part', 'assembly', 'drawing']).optional(),
        limit: z.number().default(20),
        cursor: z.string().optional(),
      }),
    }),

    get: stl.endpoint({
      method: 'GET',
      path: '/models/{modelId}',
      description: 'Get model details',
      params: z.object({
        modelId: z.string(),
      }),
      response: ModelSchema.extend({
        features: z.array(FeatureSchema),
        configurations: z.array(z.string()),
        customProperties: z.record(z.string()),
      }),
    }),

    close: stl.endpoint({
      method: 'DELETE',
      path: '/models/{modelId}',
      description: 'Close a model',
      params: z.object({
        modelId: z.string(),
      }),
      query: z.object({
        save: z.boolean().default(false),
      }),
      response: z.object({
        closed: z.boolean(),
      }),
    }),
  },

  // Feature operations
  features: {
    extrude: stl.endpoint({
      method: 'POST',
      path: '/features/extrude',
      description: 'Create an extrusion feature',
      request: CreateExtrusionRequest,
      response: FeatureSchema,
      errors: [ErrorResponse],
      middleware: [
        // Add retry logic for this endpoint
        stl.retry({
          maxAttempts: 3,
          backoff: 'exponential',
        }),
      ],
    }),

    revolve: stl.endpoint({
      method: 'POST',
      path: '/features/revolve',
      description: 'Create a revolve feature',
      request: z.object({
        sketchId: z.string(),
        angle: z.number().default(360),
        axis: z.string(),
      }),
      response: FeatureSchema,
    }),

    sweep: stl.endpoint({
      method: 'POST',
      path: '/features/sweep',
      description: 'Create a sweep feature',
      request: z.object({
        profileSketchId: z.string(),
        pathSketchId: z.string(),
        twistAngle: z.number().default(0),
      }),
      response: FeatureSchema,
    }),

    list: stl.endpoint({
      method: 'GET',
      path: '/models/{modelId}/features',
      description: 'List all features in a model',
      params: z.object({
        modelId: z.string(),
      }),
      response: stl.paginated(FeatureSchema),
      query: z.object({
        type: z.string().optional(),
        suppressed: z.boolean().optional(),
        limit: z.number().default(50),
      }),
    }),
  },

  // Sketch operations
  sketches: {
    create: stl.endpoint({
      method: 'POST',
      path: '/sketches',
      description: 'Create a new sketch',
      request: z.object({
        plane: z.enum(['Front', 'Top', 'Right', 'Custom']),
        customPlaneId: z.string().optional(),
      }),
      response: SketchSchema,
    }),

    addLine: stl.endpoint({
      method: 'POST',
      path: '/sketches/{sketchId}/lines',
      description: 'Add a line to sketch',
      params: z.object({
        sketchId: z.string(),
      }),
      request: z.object({
        start: z.tuple([z.number(), z.number(), z.number()]),
        end: z.tuple([z.number(), z.number(), z.number()]),
      }),
      response: z.object({
        entityId: z.string(),
        type: z.literal('line'),
      }),
    }),

    addCircle: stl.endpoint({
      method: 'POST',
      path: '/sketches/{sketchId}/circles',
      description: 'Add a circle to sketch',
      params: z.object({
        sketchId: z.string(),
      }),
      request: z.object({
        center: z.tuple([z.number(), z.number(), z.number()]),
        radius: z.number().positive(),
      }),
      response: z.object({
        entityId: z.string(),
        type: z.literal('circle'),
      }),
    }),
  },

  // Batch operations
  batch: {
    execute: stl.endpoint({
      method: 'POST',
      path: '/batch',
      description: 'Execute multiple operations in batch',
      request: BatchOperationRequest,
      response: z.object({
        results: z.array(
          z.object({
            index: z.number(),
            success: z.boolean(),
            data: z.any().optional(),
            error: z.string().optional(),
          })
        ),
        summary: z.object({
          total: z.number(),
          succeeded: z.number(),
          failed: z.number(),
          duration: z.number(),
        }),
      }),
      middleware: [
        // Add rate limiting for batch operations
        stl.rateLimit({
          requests: 10,
          window: '1m',
        }),
      ],
    }),
  },

  // WebSocket support for real-time updates
  events: {
    subscribe: stl.websocket({
      path: '/events',
      description: 'Subscribe to real-time SolidWorks events',
      events: {
        'model.opened': ModelSchema,
        'model.closed': z.object({ modelId: z.string() }),
        'feature.created': FeatureSchema,
        'feature.modified': FeatureSchema,
        error: ErrorResponse,
      },
    }),
  },
});

/**
 * Type-safe client usage example
 */
export async function exampleUsage() {
  // This would be auto-generated by Stainless
  const client = solidworksAPI.createClient({
    baseURL: 'http://localhost:3000',
    apiKey: process.env.SOLIDWORKS_API_KEY,
  });

  // Type-safe API calls with autocomplete
  const _connection = await client.connection.connect({
    visible: true,
    timeout: 30000,
  });

  const model = await client.models.create({
    type: 'part',
    name: 'MyPart',
  });

  const sketch = await client.sketches.create({
    plane: 'Front',
  });

  await client.sketches.addLine({
    sketchId: sketch.id,
    start: [0, 0, 0],
    end: [100, 0, 0],
  });

  const _feature = await client.features.extrude({
    sketchId: sketch.id,
    depth: 25,
    reverse: false,
  });

  // Paginated results with auto-pagination
  for await (const feature of client.features.list({ modelId: model.path })) {
    console.log(feature.name);
  }

  // Batch operations
  const _batch = await client.batch.execute({
    operations: [
      { type: 'createSketch', parameters: { plane: 'Top' } },
      { type: 'addCircle', parameters: { radius: 50 } },
      { type: 'extrude', parameters: { depth: 10 } },
    ],
    transactional: true,
  });

  // WebSocket events
  const events = await client.events.subscribe();
  events.on('feature.created', (feature: any) => {
    console.log('New feature created:', feature.name);
  });
}

/**
 * Export OpenAPI spec for documentation
 */
export const openAPISpec = solidworksAPI.getOpenAPISpec();

/**
 * Middleware for MCP integration
 */
export function createMCPHandler() {
  return solidworksAPI.createHandler({
    // Custom authentication
    authenticate: async (req: any) => {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== process.env.API_KEY) {
        throw new Error('Unauthorized');
      }
      return { userId: 'mcp-client' };
    },

    // Custom error handling
    onError: (error: any, _req: any, _res: any) => {
      console.error('API Error:', error);
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      };
    },

    // Telemetry
    onRequest: (req: any) => {
      console.log(`${req.method} ${req.path}`);
    },

    onResponse: (req: any, res: any, duration: any) => {
      console.log(`${req.method} ${req.path} - ${res.status} (${duration}ms)`);
    },
  });
}
