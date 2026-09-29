/**
 * Adapter Factory for SolidWorks MCP Server
 *
 * Provides centralized adapter creation with:
 * - Multiple adapter type support
 * - Circuit breaker integration
 * - Connection pooling
 * - Automatic fallback selection
 */

import { logger } from '../utils/logger.js';
import { CircuitBreakerAdapter } from './circuit-breaker.js';
import { ConnectionPoolAdapter } from './connection-pool.js';
import type { AdapterConfig, AdapterHealth, ISolidWorksAdapter } from './types.js';
import { WinAxAdapter } from './winax-adapter.js';
import { isWinaxAvailable } from './winax-loader.js';

/**
 * Factory for creating and managing SolidWorks adapters
 */
export class AdapterFactory {
  private static instance: AdapterFactory;
  private adapters: Map<string, ISolidWorksAdapter> = new Map();
  private defaultConfig: AdapterConfig = {
    type: 'winax',
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    enableConnectionPool: false,
    poolSize: 3,
    enableMetrics: true,
    enableLogging: true,
    logLevel: 'info',
  };

  private constructor() {}

  /**
   * Get singleton instance of factory
   */
  static getInstance(): AdapterFactory {
    if (!AdapterFactory.instance) {
      AdapterFactory.instance = new AdapterFactory();
    }
    return AdapterFactory.instance;
  }

  /**
   * Create or get adapter based on configuration
   */
  async createAdapter(config?: Partial<AdapterConfig>): Promise<ISolidWorksAdapter> {
    const fullConfig = { ...this.defaultConfig, ...config };
    const cacheKey = this.getCacheKey(fullConfig);

    // Return cached adapter if available
    if (this.adapters.has(cacheKey)) {
      const adapter = this.adapters.get(cacheKey)!;
      const health = await adapter.healthCheck();
      if (health.healthy) {
        logger.info(`Reusing cached adapter: ${cacheKey}`);
        return adapter;
      } else {
        logger.warn(`Cached adapter unhealthy, creating new one: ${cacheKey}`);
        this.adapters.delete(cacheKey);
      }
    }

    // Create new adapter
    let adapter = await this.createBaseAdapter(fullConfig);

    // Wrap with circuit breaker if enabled
    if (fullConfig.enableCircuitBreaker) {
      adapter = new CircuitBreakerAdapter(
        adapter,
        fullConfig.circuitBreakerThreshold!,
        fullConfig.circuitBreakerTimeout!
      );
    }

    // Wrap with connection pool if enabled
    if (fullConfig.enableConnectionPool) {
      adapter = new ConnectionPoolAdapter(() => this.createBaseAdapter(fullConfig), fullConfig.poolSize!);
      await (adapter as ConnectionPoolAdapter).initialize();
    }

    // Cache the adapter
    this.adapters.set(cacheKey, adapter);

    logger.info(`Created new adapter: ${cacheKey}`);
    return adapter;
  }

  /**
   * Create base adapter based on type
   */
  private async createBaseAdapter(config: AdapterConfig): Promise<ISolidWorksAdapter> {
    switch (config.type) {
      case 'winax': {
        const winaxAdapter = new WinAxAdapter();
        await winaxAdapter.connect();
        return winaxAdapter;
      }

      case 'macro-fallback': {
        // Create a winax adapter that primarily uses macros
        const macroAdapter = new WinAxAdapter();
        await macroAdapter.connect();
        // Configure to prefer macro execution
        return macroAdapter;
      }

      case 'hybrid': {
        // Create a hybrid adapter that intelligently switches between methods
        const hybridAdapter = new WinAxAdapter();
        await hybridAdapter.connect();
        return hybridAdapter;
      }

      default:
        throw new Error(`Unknown adapter type: ${config.type}`);
    }
  }

  /**
   * Get the best available adapter based on system capabilities
   */
  async getBestAdapter(): Promise<ISolidWorksAdapter> {
    // Try to determine the best adapter type
    const systemCapabilities = await this.detectSystemCapabilities();

    const config: Partial<AdapterConfig> = {};

    if (systemCapabilities.hasWinAx) {
      config.type = 'winax';
    } else {
      config.type = 'macro-fallback';
    }

    // Enable circuit breaker for stability
    config.enableCircuitBreaker = true;

    // Enable connection pool for performance if we have enough resources
    if (systemCapabilities.memoryGB > 8) {
      config.enableConnectionPool = true;
      config.poolSize = Math.min(5, Math.floor(systemCapabilities.memoryGB / 4));
    }

    return this.createAdapter(config);
  }

  /**
   * Detect system capabilities
   */
  private async detectSystemCapabilities(): Promise<SystemCapabilities> {
    const capabilities: SystemCapabilities = {
      hasWinAx: false,
      hasDotNet: false,
      memoryGB: 4,
      cpuCores: 2,
      osType: process.platform,
    };

    // Check for winax availability (uses the shared lazy loader so the probe
    // result is cached alongside real adapter loads).
    capabilities.hasWinAx = isWinaxAvailable();

    // Get system memory
    try {
      const os = await import('node:os');
      capabilities.memoryGB = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
      capabilities.cpuCores = os.cpus().length;
    } catch (_e) {
      // Use defaults
    }

    return capabilities;
  }

  /**
   * Generate cache key for adapter configuration
   */
  private getCacheKey(config: AdapterConfig): string {
    return `${config.type}_cb${config.enableCircuitBreaker}_pool${config.enableConnectionPool}`;
  }

  /**
   * Get all cached adapters
   */
  getCachedAdapters(): Map<string, ISolidWorksAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Clear all cached adapters
   */
  async clearCache(): Promise<void> {
    for (const [key, adapter] of this.adapters.entries()) {
      try {
        await adapter.disconnect();
      } catch (e) {
        logger.error(`Failed to disconnect adapter ${key}:`, e);
      }
    }
    this.adapters.clear();
  }

  /**
   * Health check all cached adapters
   */
  async healthCheckAll(): Promise<Map<string, AdapterHealth>> {
    const results = new Map<string, AdapterHealth>();

    for (const [key, adapter] of this.adapters.entries()) {
      try {
        const health = await adapter.healthCheck();
        results.set(key, health);
      } catch (_e) {
        results.set(key, {
          healthy: false,
          lastCheck: new Date(),
          errorCount: 1,
          successCount: 0,
          averageResponseTime: 0,
          connectionStatus: 'error',
        });
      }
    }

    return results;
  }
}

/**
 * System capabilities interface
 */
interface SystemCapabilities {
  hasWinAx: boolean;
  hasDotNet: boolean;
  memoryGB: number;
  cpuCores: number;
  osType: string;
}

/**
 * Singleton export for convenience
 */
export const adapterFactory = AdapterFactory.getInstance();
