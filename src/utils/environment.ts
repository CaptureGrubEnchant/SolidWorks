/**
 * Environment Configuration Management
 *
 * Centralized configuration from environment variables with validation and defaults.
 * Supports both production and development/testing scenarios.
 */

import { z } from 'zod';

/**
 * Configuration schema with validation
 */
const EnvironmentSchema = z.object({
  // SolidWorks settings
  solidworks: z.object({
    path: z.string().optional(),
    version: z.string().default('2024'),
    useMock: z.boolean().default(false),
  }),

  // Mock configuration
  mock: z.object({
    simulateErrors: z.boolean().default(false),
    failOperations: z.boolean().default(false),
    delayMs: z.number().min(0).default(0),
  }),

  // Feature flags
  features: z.object({
    macroRecording: z.boolean().default(true),
    pdm: z.boolean().default(false),
    pdmVault: z.string().optional(),
  }),

  // Database
  database: z.object({
    sqlConnection: z.string().optional(),
    pgConnection: z.string().optional(),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional(),
  }),

  // State management
  state: z.object({
    file: z.string().default('./data/state.json'),
    autoSaveInterval: z.number().default(60000),
  }),

  // Performance
  performance: z.object({
    enableConnectionPool: z.boolean().default(false),
    connectionPoolMaxSize: z.number().default(5),
    enableCircuitBreaker: z.boolean().default(false),
    circuitBreakerThreshold: z.number().default(5),
  }),

  // Templates
  templates: z.object({
    part: z.string().optional(),
    assembly: z.string().optional(),
    drawing: z.string().optional(),
  }),

  // Development
  dev: z.object({
    mode: z.boolean().default(false),
    port: z.number().optional(),
  }),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Parse environment variables into typed configuration
 */
export function loadEnvironment(): Environment {
  const raw = {
    solidworks: {
      path: process.env.SOLIDWORKS_PATH,
      version: process.env.SOLIDWORKS_VERSION || '2024',
      useMock: process.env.USE_MOCK_SOLIDWORKS === 'true',
    },
    mock: {
      simulateErrors: process.env.MOCK_SIMULATE_ERRORS === 'true',
      failOperations: process.env.MOCK_FAIL_OPERATIONS === 'true',
      delayMs: parseInt(process.env.MOCK_DELAY_MS || '0', 10),
    },
    features: {
      macroRecording: process.env.ENABLE_MACRO_RECORDING !== 'false',
      pdm: process.env.ENABLE_PDM === 'true',
      pdmVault: process.env.PDM_VAULT,
    },
    database: {
      sqlConnection: process.env.SQL_CONNECTION,
      pgConnection: process.env.PG_CONNECTION,
    },
    logging: {
      level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
      file: process.env.LOG_FILE,
    },
    state: {
      file: process.env.STATE_FILE || './data/state.json',
      autoSaveInterval: parseInt(process.env.STATE_AUTO_SAVE_INTERVAL || '60000', 10),
    },
    performance: {
      enableConnectionPool: process.env.ENABLE_CONNECTION_POOL === 'true',
      connectionPoolMaxSize: parseInt(process.env.CONNECTION_POOL_MAX_SIZE || '5', 10),
      enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER === 'true',
      circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    },
    templates: {
      part: process.env.TEMPLATE_PART,
      assembly: process.env.TEMPLATE_ASSEMBLY,
      drawing: process.env.TEMPLATE_DRAWING,
    },
    dev: {
      mode: process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development',
      port: process.env.DEV_PORT ? parseInt(process.env.DEV_PORT, 10) : undefined,
    },
  };

  return EnvironmentSchema.parse(raw);
}

/**
 * Detect if we're running in a CI environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_HOME ||
    process.env.TRAVIS ||
    process.env.CIRCLECI
  );
}

/**
 * Detect if we're running in a test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID || !!process.env.VITEST;
}

/**
 * Check if SolidWorks should be mocked
 * Auto-enables mock in CI or test environments
 */
export function shouldUseMock(env: Environment): boolean {
  if (isCI() || isTest()) {
    return true;
  }
  return env.solidworks.useMock;
}

/**
 * Get the appropriate SolidWorks version string
 */
export function getSolidWorksVersion(env: Environment): string {
  return env.solidworks.version;
}

/**
 * Validate that the environment is properly configured
 */
export function validateEnvironment(env: Environment): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for conflicts
  if (!env.solidworks.useMock && isCI()) {
    errors.push('Cannot use real SolidWorks in CI environment. Set USE_MOCK_SOLIDWORKS=true');
  }

  // Validate version format
  const version = parseInt(env.solidworks.version, 10);
  if (Number.isNaN(version) || version < 2019 || version > 2030) {
    errors.push(`Invalid SolidWorks version: ${env.solidworks.version}. Expected year between 2019-2030`);
  }

  // Validate paths if not using mock
  if (!env.solidworks.useMock && !isCI() && !isTest()) {
    // In production, we expect either auto-detection or explicit path
    // This is just a warning, not an error
  }

  // Validate PDM configuration
  if (env.features.pdm && !env.features.pdmVault) {
    errors.push('PDM enabled but PDM_VAULT not specified');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print environment configuration (for debugging)
 */
export function printEnvironment(env: Environment): void {
  console.log('=== SolidWorks MCP Server Configuration ===');
  console.log('SolidWorks:');
  console.log(`  Version: ${env.solidworks.version}`);
  console.log(`  Use Mock: ${env.solidworks.useMock}`);
  console.log(`  Path: ${env.solidworks.path || '(auto-detect)'}`);
  console.log('');
  console.log('Features:');
  console.log(`  Macro Recording: ${env.features.macroRecording}`);
  console.log(`  PDM Integration: ${env.features.pdm}`);
  console.log('');
  console.log('Environment:');
  console.log(`  CI: ${isCI()}`);
  console.log(`  Test: ${isTest()}`);
  console.log(`  Dev Mode: ${env.dev.mode}`);
  console.log(`  Log Level: ${env.logging.level}`);
  console.log('==========================================');
}

// Export singleton instance
let cachedEnv: Environment | null = null;

export function getEnvironment(): Environment {
  if (!cachedEnv) {
    cachedEnv = loadEnvironment();
  }
  return cachedEnv;
}

export function resetEnvironment(): void {
  cachedEnv = null;
}
