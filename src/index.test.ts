/**
 * Test suite for SolidWorks MCP Server
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MacroRecorder } from './macro/recorder.js';
import { ResourceStatus } from './resources/base.js';
import { DesignTableResource } from './resources/design-table.js';
import { PDMResource } from './resources/pdm.js';
import { resourceRegistry } from './resources/registry.js';
import { ResourceStateStore } from './state/store.js';
import { modelingTools } from './tools/modeling.js';
import { vbaTools } from './tools/vba.js';

// Mock SolidWorks API
vi.mock('./solidworks/api.js', () => ({
  SolidWorksAPI: vi.fn().mockImplementation(() => ({
    isConnected: vi.fn().mockReturnValue(false),
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(true),
    createSketch: vi.fn().mockResolvedValue({ sketchId: 'test-sketch' }),
    addLine: vi.fn().mockResolvedValue({ lineId: 'test-line' }),
    extrude: vi.fn().mockResolvedValue({ featureId: 'test-extrude' }),
  })),
}));

describe('SolidWorks MCP Server', () => {
  describe('Tool Definitions', () => {
    it('should have modeling tools defined', () => {
      expect(modelingTools).toBeDefined();
      expect(modelingTools.length).toBeGreaterThan(0);
      expect(modelingTools[0]).toHaveProperty('name');
      expect(modelingTools[0]).toHaveProperty('description');
      expect(modelingTools[0]).toHaveProperty('inputSchema');
      expect(modelingTools[0]).toHaveProperty('handler');
    });

    it('should have VBA tools defined', () => {
      expect(vbaTools).toBeDefined();
      expect(vbaTools.length).toBeGreaterThan(0);

      const generateVbaTool = vbaTools.find((t) => t.name === 'generate_vba_script');
      expect(generateVbaTool).toBeDefined();
    });
  });

  describe('Tool Schemas', () => {
    it('should have valid Zod schemas', () => {
      modelingTools.forEach((tool) => {
        expect(() => tool.inputSchema.parse({})).toBeDefined();
      });
    });
  });

  describe('Resource Registry', () => {
    beforeAll(() => {
      resourceRegistry.clear();
    });

    it('should register design table resource', () => {
      resourceRegistry.register({
        type: 'design-table',
        name: 'Design Table',
        description: 'Test design table',
        schema: DesignTableResource.prototype.schema,
        factory: (id, name, properties) => new DesignTableResource(id, name, properties),
      });

      expect(resourceRegistry.getAllTypes()).toContain('design-table');
    });

    it('should create design table resource instance', () => {
      const resource = resourceRegistry.createResource('design-table', 'dt-1', 'TestTable', {
        tableName: 'TestTable',
        parameters: [],
        configurations: [],
      });

      expect(resource).toBeInstanceOf(DesignTableResource);
      expect(resource.id).toBe('dt-1');
      expect(resource.name).toBe('TestTable');
    });
  });

  describe('Design Table Resource', () => {
    it('should create design table with SQL configuration', () => {
      const resource = new DesignTableResource('dt-1', 'ParametricBox', {
        tableName: 'ParametricBox',
        parameters: [
          { name: 'Length', type: 'dimension', dataType: 'number', sqlColumn: 'length' },
          { name: 'Width', type: 'dimension', dataType: 'number', sqlColumn: 'width' },
        ],
        dataSource: {
          type: 'sql',
          connectionString: 'mssql://localhost:1433/test',
          query: 'SELECT * FROM configurations',
        },
      });

      expect(resource.type).toBe('design-table');
      expect(resource.getRequiredCapabilities()).toContain('sql-integration');
    });

    it('should generate VBA code', () => {
      const resource = new DesignTableResource('dt-1', 'TestTable', {
        tableName: 'TestTable',
        parameters: [{ name: 'Height', type: 'dimension', dataType: 'number' }],
        configurations: [{ name: 'Config1', values: { Height: 100 }, active: true }],
      });

      const vbaCode = resource.toVBACode();

      expect(vbaCode).toContain('Sub CreateDesignTable_TestTable()');
      expect(vbaCode).toContain('swDesignTable.AddParameter "Height", "dimension"');
      expect(vbaCode).toContain('swDesignTable.AddConfiguration "Config1"');
    });
  });

  describe('PDM Resource', () => {
    it('should create PDM configuration', () => {
      const resource = new PDMResource('pdm-1', 'Engineering Vault', {
        vaultName: 'Engineering',
        operations: {
          checkIn: { enabled: true, comment: 'Test check-in' },
          checkOut: { enabled: true, getLatestVersion: true },
        },
      });

      expect(resource.type).toBe('pdm-configuration');
      expect(resource.getRequiredCapabilities()).toContain('pdm-integration');
    });

    it('should generate VBA code for PDM operations', () => {
      const resource = new PDMResource('pdm-1', 'Test Vault', {
        vaultName: 'TestVault',
        operations: {
          checkIn: { enabled: true, comment: 'Auto check-in' },
          checkOut: { enabled: true },
        },
      });

      const vbaCode = resource.toVBACode();

      expect(vbaCode).toContain('pdmVault.LoginAuto "TestVault"');
      expect(vbaCode).toContain('pdmFile.LockFile');
      expect(vbaCode).toContain('pdmFile.UnlockFile');
    });
  });

  describe('Macro Recorder', () => {
    let recorder: MacroRecorder;

    beforeAll(() => {
      recorder = new MacroRecorder();
    });

    afterAll(() => {
      recorder.clear();
    });

    it('should start and stop recording', () => {
      const id = recorder.startRecording('TestMacro', 'Test description');
      expect(id).toBeDefined();

      recorder.recordAction('test-action', 'Test Action', { param: 'value' });

      const recording = recorder.stopRecording();
      expect(recording).toBeDefined();
      expect(recording!.name).toBe('TestMacro');
      expect(recording!.actions).toHaveLength(1);
    });

    it('should export macro to VBA', () => {
      const _id = recorder.startRecording('ExportTest');

      recorder.recordAction('create-sketch', 'Create Sketch', { plane: 'Front' });
      recorder.recordAction('add-line', 'Add Line', {
        x1: 0,
        y1: 0,
        z1: 0,
        x2: 100,
        y2: 0,
        z2: 0,
      });

      const recording = recorder.stopRecording();
      const vbaCode = recorder.exportToVBA(recording!.id);

      expect(vbaCode).toContain('Sub ExportTest()');
      expect(vbaCode).toContain('swModel.CreateSketch "Front"');
      expect(vbaCode).toContain('swModel.CreateLine2');
    });
  });

  describe('State Store', () => {
    let stateStore: ResourceStateStore;

    beforeAll(() => {
      stateStore = new ResourceStateStore(':memory:', false);
    });

    afterAll(() => {
      stateStore.stopAutoSave();
    });

    it('should store and retrieve resource state', async () => {
      const state = {
        id: 'test-1',
        type: 'design-table',
        name: 'TestResource',
        properties: { tableName: 'Test' },
        outputs: {},
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'test',
          version: 1,
          tags: {},
          annotations: {},
        },
        status: ResourceStatus.CREATED,
      };

      await stateStore.setState('test-1', state);
      const retrieved = stateStore.getState('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('TestResource');
    });

    it('should query states by type', async () => {
      const designTables = stateStore.getStatesByType('design-table');
      expect(designTables).toBeDefined();
    });
  });
});
