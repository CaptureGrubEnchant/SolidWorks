/**
 * Circuit Breaker Adapter for SolidWorks MCP Server
 *
 * Wraps any SolidWorks adapter with circuit breaker pattern to:
 * - Prevent cascading failures
 * - Provide automatic recovery
 * - Reduce load on failing systems
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

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreakerAdapter implements ISolidWorksAdapter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private halfOpenRequests: number = 0;

  constructor(
    private wrappedAdapter: ISolidWorksAdapter,
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private halfOpenLimit: number = 3
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  private async executeWithBreaker<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenRequests = 0;
        logger.info(`Circuit breaker entering HALF_OPEN state for ${operationName}`);
      } else {
        const waitTime = this.nextAttemptTime ? Math.max(0, this.nextAttemptTime.getTime() - Date.now()) : this.timeout;
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Retry in ${Math.round(waitTime / 1000)}s`);
      }
    }

    // Check half-open limit
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.halfOpenLimit) {
        throw new Error(`Circuit breaker HALF_OPEN limit reached for ${operationName}. Waiting for recovery.`);
      }
      this.halfOpenRequests++;
    }

    try {
      // Execute the operation
      const result = await operation();

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure();

      // Log the error
      logger.error(`Circuit breaker caught error in ${operationName}:`, error);

      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failures = 0;
    this.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.halfOpenLimit) {
        // Enough successful requests, close the circuit
        this.state = CircuitState.CLOSED;
        logger.info('Circuit breaker closed after successful recovery');
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.timeout);
      logger.warn(
        `Circuit breaker opened after ${this.failures} failures. Will retry at ${this.nextAttemptTime.toISOString()}`
      );
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state, reopen immediately
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.timeout);
      logger.warn('Circuit breaker reopened due to failure in HALF_OPEN state');
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) return true;
    return Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Get circuit breaker statistics
   */
  getStatistics(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.halfOpenRequests = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    logger.info('Circuit breaker manually reset');
  }

  // Implement ISolidWorksAdapter interface

  async connect(): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.connect(), 'connect');
  }

  async disconnect(): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.disconnect(), 'disconnect');
  }

  isConnected(): boolean {
    // This doesn't need circuit breaker as it's a simple check
    return this.wrappedAdapter.isConnected();
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const health = await this.executeWithBreaker(() => this.wrappedAdapter.healthCheck(), 'healthCheck');

      // Add circuit breaker state to health
      return {
        ...health,
        connectionStatus: this.state === CircuitState.OPEN ? 'error' : health.connectionStatus,
      };
    } catch (_error) {
      // Return unhealthy status if circuit is open
      return {
        healthy: false,
        lastCheck: new Date(),
        errorCount: this.failures,
        successCount: this.successes,
        averageResponseTime: 0,
        connectionStatus: 'error',
      };
    }
  }

  async execute<T>(command: Command): Promise<AdapterResult<T>> {
    return this.executeWithBreaker(() => this.wrappedAdapter.execute<T>(command), `execute:${command.name}`);
  }

  async executeRaw(method: string, args: any[]): Promise<any> {
    return this.executeWithBreaker(() => this.wrappedAdapter.executeRaw(method, args), `executeRaw:${method}`);
  }

  async openModel(filePath: string): Promise<SolidWorksModel> {
    return this.executeWithBreaker(() => this.wrappedAdapter.openModel(filePath), 'openModel');
  }

  async closeModel(save?: boolean): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.closeModel(save), 'closeModel');
  }

  async createPart(): Promise<SolidWorksModel> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createPart(), 'createPart');
  }

  async createAssembly(): Promise<SolidWorksModel> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createAssembly(), 'createAssembly');
  }

  async createDrawing(): Promise<SolidWorksModel> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createDrawing(), 'createDrawing');
  }

  async createExtrusion(params: ExtrusionParameters): Promise<SolidWorksFeature> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createExtrusion(params), 'createExtrusion');
  }

  async createRevolve(params: RevolveParameters): Promise<SolidWorksFeature> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createRevolve(params), 'createRevolve');
  }

  async createSweep(params: SweepParameters): Promise<SolidWorksFeature> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createSweep(params), 'createSweep');
  }

  async createLoft(params: LoftParameters): Promise<SolidWorksFeature> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createLoft(params), 'createLoft');
  }

  async createSketch(plane: string): Promise<string> {
    return this.executeWithBreaker(() => this.wrappedAdapter.createSketch(plane), 'createSketch');
  }

  async addLine(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.addLine(x1, y1, x2, y2), 'addLine');
  }

  async addCircle(centerX: number, centerY: number, radius: number): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.addCircle(centerX, centerY, radius), 'addCircle');
  }

  async addRectangle(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.addRectangle(x1, y1, x2, y2), 'addRectangle');
  }

  async exitSketch(): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.exitSketch(), 'exitSketch');
  }

  async getMassProperties(): Promise<MassProperties> {
    return this.executeWithBreaker(() => this.wrappedAdapter.getMassProperties(), 'getMassProperties');
  }

  async exportFile(filePath: string, format: string): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.exportFile(filePath, format), 'exportFile');
  }

  async getDimension(name: string): Promise<number> {
    return this.executeWithBreaker(() => this.wrappedAdapter.getDimension(name), 'getDimension');
  }

  async setDimension(name: string, value: number): Promise<void> {
    return this.executeWithBreaker(() => this.wrappedAdapter.setDimension(name, value), 'setDimension');
  }
}
