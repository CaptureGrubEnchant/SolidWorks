/**
 * Unit tests for Environment Configuration
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getSolidWorksVersion,
  isCI,
  isTest,
  loadEnvironment,
  resetEnvironment,
  shouldUseMock,
  validateEnvironment,
} from '../environment.js';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a clean copy and remove test-runner vars that affect behavior
    process.env = { ...originalEnv };
    delete process.env.USE_MOCK_SOLIDWORKS;
    delete process.env.SOLIDWORKS_VERSION;
    delete process.env.MOCK_SIMULATE_ERRORS;
    delete process.env.MOCK_FAIL_OPERATIONS;
    delete process.env.MOCK_DELAY_MS;
    delete process.env.ENABLE_MACRO_RECORDING;
    delete process.env.ENABLE_PDM;
    delete process.env.PDM_VAULT;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FILE;
    delete process.env.ENABLE_CONNECTION_POOL;
    delete process.env.CONNECTION_POOL_MAX_SIZE;
    delete process.env.ENABLE_CIRCUIT_BREAKER;
    delete process.env.CIRCUIT_BREAKER_THRESHOLD;
    resetEnvironment();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    resetEnvironment();
  });

  describe('loadEnvironment', () => {
    it('should load default configuration', () => {
      const env = loadEnvironment();

      expect(env.solidworks.version).toBe('2024');
      expect(env.solidworks.useMock).toBe(false);
      expect(env.logging.level).toBe('info');
      expect(env.features.macroRecording).toBe(true);
    });

    it('should parse SOLIDWORKS_VERSION', () => {
      process.env.SOLIDWORKS_VERSION = '2023';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.solidworks.version).toBe('2023');
    });

    it('should parse USE_MOCK_SOLIDWORKS', () => {
      process.env.USE_MOCK_SOLIDWORKS = 'true';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.solidworks.useMock).toBe(true);
    });

    it('should parse mock configuration', () => {
      process.env.MOCK_SIMULATE_ERRORS = 'true';
      process.env.MOCK_FAIL_OPERATIONS = 'true';
      process.env.MOCK_DELAY_MS = '100';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.mock.simulateErrors).toBe(true);
      expect(env.mock.failOperations).toBe(true);
      expect(env.mock.delayMs).toBe(100);
    });

    it('should parse feature flags', () => {
      process.env.ENABLE_MACRO_RECORDING = 'false';
      process.env.ENABLE_PDM = 'true';
      process.env.PDM_VAULT = 'TestVault';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.features.macroRecording).toBe(false);
      expect(env.features.pdm).toBe(true);
      expect(env.features.pdmVault).toBe('TestVault');
    });

    it('should parse logging configuration', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FILE = './test.log';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.logging.level).toBe('debug');
      expect(env.logging.file).toBe('./test.log');
    });

    it('should parse performance settings', () => {
      process.env.ENABLE_CONNECTION_POOL = 'true';
      process.env.CONNECTION_POOL_MAX_SIZE = '10';
      process.env.ENABLE_CIRCUIT_BREAKER = 'true';
      process.env.CIRCUIT_BREAKER_THRESHOLD = '3';
      resetEnvironment();

      const env = loadEnvironment();

      expect(env.performance.enableConnectionPool).toBe(true);
      expect(env.performance.connectionPoolMaxSize).toBe(10);
      expect(env.performance.enableCircuitBreaker).toBe(true);
      expect(env.performance.circuitBreakerThreshold).toBe(3);
    });
  });

  describe('isCI', () => {
    it('should detect GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';

      expect(isCI()).toBe(true);
    });

    it('should detect generic CI flag', () => {
      process.env.CI = 'true';

      expect(isCI()).toBe(true);
    });

    it('should return false when not in CI', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;

      expect(isCI()).toBe(false);
    });
  });

  describe('isTest', () => {
    it('should detect test environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'test';

      expect(isTest()).toBe(true);
    });

    it('should detect Vitest', () => {
      process.env.VITEST = 'true';

      expect(isTest()).toBe(true);
    });

    it('should return false when not in test', () => {
      delete process.env.NODE_ENV;
      delete process.env.VITEST;
      delete process.env.JEST_WORKER_ID;

      expect(isTest()).toBe(false);
    });
  });

  describe('shouldUseMock', () => {
    it('should use mock in CI environment', () => {
      process.env.CI = 'true';
      resetEnvironment();

      const env = loadEnvironment();

      expect(shouldUseMock(env)).toBe(true);
    });

    it('should use mock in test environment', () => {
      process.env.NODE_ENV = 'test';
      resetEnvironment();

      const env = loadEnvironment();

      expect(shouldUseMock(env)).toBe(true);
    });

    it('should respect USE_MOCK_SOLIDWORKS flag', () => {
      process.env.USE_MOCK_SOLIDWORKS = 'true';
      resetEnvironment();

      const env = loadEnvironment();

      expect(shouldUseMock(env)).toBe(true);
    });

    it('should use mock when running inside a test runner', () => {
      // When running inside vitest, isTest() returns true,
      // so shouldUseMock always returns true regardless of config.
      // This is correct behavior — tests should never hit real COM.
      delete process.env.CI;
      delete process.env.USE_MOCK_SOLIDWORKS;
      resetEnvironment();

      const env = loadEnvironment();

      // VITEST env var is set by the runner, so isTest() is true
      expect(shouldUseMock(env)).toBe(true);
    });
  });

  describe('validateEnvironment', () => {
    it('should validate correct configuration', () => {
      // In CI, useMock must be true to pass validation
      if (isCI()) {
        process.env.USE_MOCK_SOLIDWORKS = 'true';
      }
      resetEnvironment();
      const env = loadEnvironment();

      const result = validateEnvironment(env);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject using real SolidWorks in CI', () => {
      process.env.CI = 'true';
      process.env.USE_MOCK_SOLIDWORKS = 'false';
      resetEnvironment();

      const env = loadEnvironment();
      const result = validateEnvironment(env);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Cannot use real SolidWorks in CI');
    });

    it('should reject invalid version', () => {
      process.env.SOLIDWORKS_VERSION = '2015';
      resetEnvironment();

      const env = loadEnvironment();
      const result = validateEnvironment(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid SolidWorks version'))).toBe(true);
    });

    it('should reject PDM without vault', () => {
      process.env.ENABLE_PDM = 'true';
      delete process.env.PDM_VAULT;
      resetEnvironment();

      const env = loadEnvironment();
      const result = validateEnvironment(env);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('PDM_VAULT not specified'))).toBe(true);
    });
  });

  describe('getSolidWorksVersion', () => {
    it('should return configured version', () => {
      process.env.SOLIDWORKS_VERSION = '2023';
      resetEnvironment();

      const env = loadEnvironment();
      const version = getSolidWorksVersion(env);

      expect(version).toBe('2023');
    });
  });
});
