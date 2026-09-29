/**
 * Type definitions for SolidWorks adapter pattern
 * Enhanced with comprehensive operation support and robust error handling
 */

import { z } from 'zod';
import type { SolidWorksFeature, SolidWorksModel } from '../solidworks/types.js';

/**
 * Base interface for all SolidWorks adapters
 */
export interface ISolidWorksAdapter {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  healthCheck(): Promise<AdapterHealth>;

  // Command execution
  execute<T>(command: Command): Promise<AdapterResult<T>>;
  executeRaw(method: string, args: any[]): Promise<any>;

  // Model operations
  openModel(filePath: string): Promise<SolidWorksModel>;
  closeModel(save?: boolean): Promise<void>;
  createPart(): Promise<SolidWorksModel>;
  createAssembly(): Promise<SolidWorksModel>;
  createDrawing(): Promise<SolidWorksModel>;

  // Feature operations with parameter workarounds
  createExtrusion(params: ExtrusionParameters): Promise<SolidWorksFeature>;
  createRevolve(params: RevolveParameters): Promise<SolidWorksFeature>;
  createSweep(params: SweepParameters): Promise<SolidWorksFeature>;
  createLoft(params: LoftParameters): Promise<SolidWorksFeature>;

  // Sketch operations
  createSketch(plane: string): Promise<string>;
  addLine(x1: number, y1: number, x2: number, y2: number): Promise<void>;
  addCircle(centerX: number, centerY: number, radius: number): Promise<void>;
  addRectangle(x1: number, y1: number, x2: number, y2: number): Promise<void>;
  exitSketch(): Promise<void>;

  // Analysis operations
  getMassProperties(): Promise<MassProperties>;

  // Export operations
  exportFile(filePath: string, format: string): Promise<void>;

  // Dimension operations
  getDimension(name: string): Promise<number>;
  setDimension(name: string, value: number): Promise<void>;
}

/**
 * Adapter health status
 */
export interface AdapterHealth {
  healthy: boolean;
  lastCheck: Date;
  errorCount: number;
  successCount: number;
  averageResponseTime: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  metrics?: {
    directCOMCalls?: number;
    macroFallbacks?: number;
    successRate?: number;
  };
}

/**
 * Command pattern for SolidWorks operations
 */
export interface Command {
  name: string;
  parameters: Record<string, any>;
  validate(): ValidationResult;
  fallback?: Command;
  timeout?: number;
  retryable?: boolean;
  priority?: number;
}

/**
 * Validation result for commands
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Result wrapper for adapter operations
 */
export interface AdapterResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timing?: {
    start: Date | number;
    end: Date | number;
    duration: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Base command class with common functionality
 */
export abstract class BaseCommand implements Command {
  abstract name: string;
  abstract parameters: Record<string, any>;
  fallback?: Command;
  timeout: number = 30000; // 30 seconds default
  retryable: boolean = true;

  validate(): ValidationResult {
    // Override in subclasses for specific validation
    return { valid: true };
  }

  /**
   * Transform parameters before execution
   */
  protected transformParameters(): Record<string, any> {
    return this.parameters;
  }
}

/**
 * Extrusion command with validation and fallback
 */
export class CreateExtrusionCommand extends BaseCommand {
  name = 'CreateExtrusion';
  parameters: {
    depth: number;
    reverse?: boolean;
    bothDirections?: boolean;
    draft?: number;
    merge?: boolean;
    [key: string]: any;
  };

  constructor(parameters: {
    depth: number;
    reverse?: boolean;
    bothDirections?: boolean;
    draft?: number;
    merge?: boolean;
    [key: string]: any;
  }) {
    super();
    this.parameters = parameters;
  }

  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.parameters.depth || this.parameters.depth <= 0) {
      errors.push('Depth must be greater than 0');
    }
    if (this.parameters.depth > 1000) {
      errors.push('Depth must be less than 1000mm');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * VBA-based fallback for extrusion
 */
export class CreateExtrusionVBACommand extends BaseCommand {
  name = 'ExecuteVBAMacro';
  parameters: Record<string, any>;

  constructor(extrusionParams: Record<string, any>) {
    super();
    this.parameters = {
      macroName: 'CreateExtrusion',
      arguments: extrusionParams,
    };
  }
}

/**
 * Adapter factory for creating appropriate adapter based on configuration
 */
export class AdapterFactory {
  private static adapters: Map<string, () => Promise<ISolidWorksAdapter>> = new Map();

  static register(type: string, factory: () => Promise<ISolidWorksAdapter>) {
    AdapterFactory.adapters.set(type, factory);
  }

  static async create(type: string = 'winax'): Promise<ISolidWorksAdapter> {
    const factory = AdapterFactory.adapters.get(type);
    if (!factory) {
      throw new Error(`Unknown adapter type: ${type}`);
    }
    return factory();
  }
}

/**
 * Circuit breaker for handling adapter failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    // 1 minute
    _halfOpenRequests: number = 1
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = undefined;
  }
}

/**
 * Connection pool for managing multiple SolidWorks connections
 */
export class ConnectionPool {
  private connections: ISolidWorksAdapter[] = [];
  private available: ISolidWorksAdapter[] = [];
  private inUse = new Set<ISolidWorksAdapter>();

  constructor(
    private factory: () => Promise<ISolidWorksAdapter>,
    private minSize: number = 1,
    private maxSize: number = 5
  ) {}

  async initialize() {
    for (let i = 0; i < this.minSize; i++) {
      const adapter = await this.factory();
      this.connections.push(adapter);
      this.available.push(adapter);
    }
  }

  async acquire(): Promise<ISolidWorksAdapter> {
    // Return available connection
    if (this.available.length > 0) {
      const adapter = this.available.pop()!;
      this.inUse.add(adapter);
      return adapter;
    }

    // Create new connection if under max size
    if (this.connections.length < this.maxSize) {
      const adapter = await this.factory();
      this.connections.push(adapter);
      this.inUse.add(adapter);
      return adapter;
    }

    // Wait for connection to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkInterval);
          const adapter = this.available.pop()!;
          this.inUse.add(adapter);
          resolve(adapter);
        }
      }, 100);
    });
  }

  release(adapter: ISolidWorksAdapter) {
    if (this.inUse.has(adapter)) {
      this.inUse.delete(adapter);
      this.available.push(adapter);
    }
  }

  async destroy() {
    for (const adapter of this.connections) {
      await adapter.disconnect();
    }
    this.connections = [];
    this.available = [];
    this.inUse.clear();
  }
}

/**
 * Batch processor for executing multiple commands efficiently
 */
export class BatchProcessor {
  private queue: Command[] = [];
  private processing = false;

  constructor(
    private adapter: ISolidWorksAdapter,
    private batchSize: number = 10,
    private delay: number = 100
  ) {}

  async add(command: Command) {
    this.queue.push(command);
    if (!this.processing) {
      this.process();
    }
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      const results = await Promise.allSettled(batch.map((cmd) => this.adapter.execute(cmd)));

      // Process results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Command ${batch[index].name} failed:`, result.reason);
        }
      });

      // Delay between batches
      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delay));
      }
    }

    this.processing = false;
  }
}

/**
 * Event types for adapter events
 */
export interface AdapterEvents {
  connected: undefined;
  disconnected: undefined;
  'command:start': { command: Command };
  'command:success': { command: Command; result: any };
  'command:failure': { command: Command; error: Error };
  'health:check': { healthy: boolean };
}

/**
 * Schema definitions for common SolidWorks types
 */
export const ModelSchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.enum(['Part', 'Assembly', 'Drawing']),
  isActive: z.boolean(),
  configurations: z.array(z.string()).optional(),
});

export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  suppressed: z.boolean(),
  parameters: z.record(z.any()),
});

export const SketchSchema = z.object({
  id: z.string(),
  name: z.string(),
  plane: z.string(),
  entities: z.array(
    z.object({
      type: z.string(),
      id: z.string(),
      coordinates: z.array(z.number()),
    })
  ),
});

export type Model = z.infer<typeof ModelSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Sketch = z.infer<typeof SketchSchema>;

/**
 * Parameter types for feature operations
 */
export interface ExtrusionParameters {
  depth: number;
  reverse?: boolean;
  bothDirections?: boolean;
  depth2?: number; // Added for second direction depth
  draft?: number;
  draftOutward?: boolean;
  draftWhileExtruding?: boolean;
  offsetDistance?: number;
  offsetReverse?: boolean;
  translateSurface?: boolean;
  merge?: boolean;
  flipSideToCut?: boolean;
  startCondition?: number;
  endCondition?: number | string; // Can be number or string like "Blind"
  thinFeature?: boolean;
  thinThickness?: number;
  thinType?: string; // Added for thin feature type
  capEnds?: boolean; // Added for capping ends
  capThickness?: number; // Added for cap thickness
}

export interface RevolveParameters {
  angle: number;
  axis?: string;
  direction?: number | string; // Can be number or string like "Reverse", "Both"
  merge?: boolean;
  thinFeature?: boolean;
  thinThickness?: number;
}

export interface SweepParameters {
  profileSketch: string;
  pathSketch: string;
  twistAngle?: number;
  merge?: boolean;
  thinFeature?: boolean;
  thinThickness?: number;
}

export interface LoftParameters {
  profiles: string[];
  guides?: string[]; // Alias for guideCurves
  guideCurves?: string[];
  centerCurve?: string;
  closed?: boolean; // Alias for close
  close?: boolean;
  startTangency?: string;
  endTangency?: string;
  merge?: boolean;
  thinFeature?: boolean;
  thinThickness?: number;
}

export interface MassProperties {
  mass: number;
  volume: number;
  surfaceArea: number;
  centerOfMass: { x: number; y: number; z: number };
  density?: number;
  momentsOfInertia?: {
    Ixx: number;
    Iyy: number;
    Izz: number;
    Ixy: number;
    Iyz: number;
    Ixz: number;
  };
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  type: 'winax' | 'macro-fallback' | 'hybrid' | 'winax-enhanced';
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableConnectionPool?: boolean;
  poolSize?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  macroPath?: string;
}
