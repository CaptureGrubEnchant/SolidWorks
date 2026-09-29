import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

describe('Version', () => {
  it('should have a valid semver version in package.json', () => {
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should have required package.json fields', () => {
    expect(packageJson.name).toBe('solidworks-mcp-server');
    expect(packageJson.type).toBe('module');
    expect(packageJson.main).toBe('dist/index.js');
  });
});
