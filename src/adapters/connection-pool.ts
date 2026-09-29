/**
 * Connection Pool Adapter for SolidWorks MCP Server
 *
 * Manages multiple SolidWorks adapter connections for:
 * - Improved performance through parallel operations
 * - Load balancing across connections
 * - Connection reuse and lifecycle management
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

interface PooledConnection {
  adapter: ISolidWorksAdapter;
  inUse: boolean;
  lastUsed: Date;
  useCount: number;
  id: string;
}

export class ConnectionPoolAdapter implements ISolidWorksAdapter {
  private connections: PooledConnection[] = [];
  private waitingQueue: Array<(adapter: ISolidWorksAdapter) => void> = [];
  private initialized: boolean = false;

  constructor(
    private adapterFactory: () => Promise<ISolidWorksAdapter>,
    private poolSize: number = 3,
    private maxWaitTime: number = 30000 // 30 seconds
  ) {
    if (poolSize < 1) {
      throw new Error('Pool size must be at least 1');
    }
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info(`Initializing connection pool with ${this.poolSize} connections`);

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.poolSize; i++) {
      initPromises.push(this.createConnection(i));
    }

    await Promise.all(initPromises);
    this.initialized = true;

    logger.info('Connection pool initialized successfully');
  }

  /**
   * Create a new connection
   */
  private async createConnection(index: number): Promise<void> {
    try {
      const adapter = await this.adapterFactory();
      const connection: PooledConnection = {
        adapter,
        inUse: false,
        lastUsed: new Date(),
        useCount: 0,
        id: `conn_${index}_${Date.now()}`,
      };
      this.connections.push(connection);
      logger.info(`Created connection ${connection.id}`);
    } catch (error) {
      logger.error(`Failed to create connection ${index}:`, error);
      throw error;
    }
  }

  /**
   * Acquire a connection from the pool
   */
  private async acquireConnection(): Promise<PooledConnection> {
    // Ensure pool is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Try to find an available connection
    for (const conn of this.connections) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.useCount++;
        conn.lastUsed = new Date();
        logger.debug(`Acquired connection ${conn.id} (use count: ${conn.useCount})`);
        return conn;
      }
    }

    // No available connections, wait for one
    logger.debug('No available connections, waiting...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.indexOf(resolve as any);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquisition timeout'));
      }, this.maxWaitTime);

      this.waitingQueue.push((adapter) => {
        clearTimeout(timeout);
        const conn = this.connections.find((c) => c.adapter === adapter);
        if (conn) {
          resolve(conn);
        } else {
          reject(new Error('Connection not found in pool'));
        }
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  private releaseConnection(connection: PooledConnection): void {
    connection.inUse = false;
    connection.lastUsed = new Date();
    logger.debug(`Released connection ${connection.id}`);

    // Check if anyone is waiting for a connection
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        connection.inUse = true;
        connection.useCount++;
        waiter(connection.adapter);
      }
    }
  }

  /**
   * Execute operation with a pooled connection
   */
  private async executeWithPool<T>(operation: (adapter: ISolidWorksAdapter) => Promise<T>): Promise<T> {
    const connection = await this.acquireConnection();

    try {
      const result = await operation(connection.adapter);
      return result;
    } finally {
      this.releaseConnection(connection);
    }
  }

  /**
   * Get pool statistics
   */
  getStatistics(): {
    totalConnections: number;
    availableConnections: number;
    inUseConnections: number;
    waitingRequests: number;
    connectionStats: Array<{
      id: string;
      inUse: boolean;
      useCount: number;
      lastUsed: Date;
    }>;
  } {
    const available = this.connections.filter((c) => !c.inUse).length;
    const inUse = this.connections.filter((c) => c.inUse).length;

    return {
      totalConnections: this.connections.length,
      availableConnections: available,
      inUseConnections: inUse,
      waitingRequests: this.waitingQueue.length,
      connectionStats: this.connections.map((c) => ({
        id: c.id,
        inUse: c.inUse,
        useCount: c.useCount,
        lastUsed: c.lastUsed,
      })),
    };
  }

  /**
   * Destroy the connection pool
   */
  async destroy(): Promise<void> {
    logger.info('Destroying connection pool');

    // Clear waiting queue
    for (const waiter of this.waitingQueue) {
      waiter(null as any);
    }
    this.waitingQueue = [];

    // Disconnect all connections
    const disconnectPromises = this.connections.map((conn) =>
      conn.adapter.disconnect().catch((err) => logger.error(`Failed to disconnect ${conn.id}:`, err))
    );

    await Promise.all(disconnectPromises);

    this.connections = [];
    this.initialized = false;

    logger.info('Connection pool destroyed');
  }

  // Implement ISolidWorksAdapter interface

  async connect(): Promise<void> {
    // Initialize the pool
    await this.initialize();
  }

  async disconnect(): Promise<void> {
    // Destroy the pool
    await this.destroy();
  }

  isConnected(): boolean {
    return this.initialized && this.connections.length > 0;
  }

  async healthCheck(): Promise<AdapterHealth> {
    if (!this.initialized) {
      return {
        healthy: false,
        lastCheck: new Date(),
        errorCount: 0,
        successCount: 0,
        averageResponseTime: 0,
        connectionStatus: 'disconnected',
      };
    }

    // Check health of all connections
    const healthChecks = await Promise.allSettled(this.connections.map((conn) => conn.adapter.healthCheck()));

    const healthyCount = healthChecks.filter((r) => r.status === 'fulfilled' && r.value.healthy).length;

    const totalErrors = healthChecks.reduce((sum, r) => {
      if (r.status === 'fulfilled') {
        return sum + r.value.errorCount;
      }
      return sum + 1;
    }, 0);

    const totalSuccesses = healthChecks.reduce((sum, r) => {
      if (r.status === 'fulfilled') {
        return sum + r.value.successCount;
      }
      return sum;
    }, 0);

    const avgResponseTime =
      healthChecks.reduce((sum, r) => {
        if (r.status === 'fulfilled') {
          return sum + r.value.averageResponseTime;
        }
        return sum;
      }, 0) / Math.max(1, healthChecks.length);

    return {
      healthy: healthyCount > 0,
      lastCheck: new Date(),
      errorCount: totalErrors,
      successCount: totalSuccesses,
      averageResponseTime: avgResponseTime,
      connectionStatus:
        healthyCount === this.connections.length ? 'connected' : healthyCount > 0 ? 'connected' : 'error',
    };
  }

  async execute<T>(command: Command): Promise<AdapterResult<T>> {
    return this.executeWithPool((adapter) => adapter.execute<T>(command));
  }

  async executeRaw(method: string, args: any[]): Promise<any> {
    return this.executeWithPool((adapter) => adapter.executeRaw(method, args));
  }

  async openModel(filePath: string): Promise<SolidWorksModel> {
    return this.executeWithPool((adapter) => adapter.openModel(filePath));
  }

  async closeModel(save?: boolean): Promise<void> {
    return this.executeWithPool((adapter) => adapter.closeModel(save));
  }

  async createPart(): Promise<SolidWorksModel> {
    return this.executeWithPool((adapter) => adapter.createPart());
  }

  async createAssembly(): Promise<SolidWorksModel> {
    return this.executeWithPool((adapter) => adapter.createAssembly());
  }

  async createDrawing(): Promise<SolidWorksModel> {
    return this.executeWithPool((adapter) => adapter.createDrawing());
  }

  async createExtrusion(params: ExtrusionParameters): Promise<SolidWorksFeature> {
    return this.executeWithPool((adapter) => adapter.createExtrusion(params));
  }

  async createRevolve(params: RevolveParameters): Promise<SolidWorksFeature> {
    return this.executeWithPool((adapter) => adapter.createRevolve(params));
  }

  async createSweep(params: SweepParameters): Promise<SolidWorksFeature> {
    return this.executeWithPool((adapter) => adapter.createSweep(params));
  }

  async createLoft(params: LoftParameters): Promise<SolidWorksFeature> {
    return this.executeWithPool((adapter) => adapter.createLoft(params));
  }

  async createSketch(plane: string): Promise<string> {
    return this.executeWithPool((adapter) => adapter.createSketch(plane));
  }

  async addLine(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    return this.executeWithPool((adapter) => adapter.addLine(x1, y1, x2, y2));
  }

  async addCircle(centerX: number, centerY: number, radius: number): Promise<void> {
    return this.executeWithPool((adapter) => adapter.addCircle(centerX, centerY, radius));
  }

  async addRectangle(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    return this.executeWithPool((adapter) => adapter.addRectangle(x1, y1, x2, y2));
  }

  async exitSketch(): Promise<void> {
    return this.executeWithPool((adapter) => adapter.exitSketch());
  }

  async getMassProperties(): Promise<MassProperties> {
    return this.executeWithPool((adapter) => adapter.getMassProperties());
  }

  async exportFile(filePath: string, format: string): Promise<void> {
    return this.executeWithPool((adapter) => adapter.exportFile(filePath, format));
  }

  async getDimension(name: string): Promise<number> {
    return this.executeWithPool((adapter) => adapter.getDimension(name));
  }

  async setDimension(name: string, value: number): Promise<void> {
    return this.executeWithPool((adapter) => adapter.setDimension(name, value));
  }
}
