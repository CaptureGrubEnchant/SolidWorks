/**
 * Unit tests for SolidWorks Configuration Utility
 * These tests use mocks and don't require SolidWorks to be installed
 */

import { describe, expect, it } from 'vitest';
import { createMockSolidWorksAdapter } from '../../adapters/mock-solidworks-adapter.js';
import { SolidWorksConfig } from '../solidworks-config.js';

describe('SolidWorksConfig', () => {
  describe('getVersion', () => {
    it('should extract version from modern format (2024 SP5.0)', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();

      const version = SolidWorksConfig.getVersion(app);

      expect(version).not.toBeNull();
      expect(version?.year).toBe('2024');
      expect(version?.majorVersion).toBe(2024);
    });

    it('should extract version from old format (27.5.0 = 2019)', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2019' });
      const app = mockAdapter.getApplication();

      const version = SolidWorksConfig.getVersion(app);

      expect(version).not.toBeNull();
      expect(version?.year).toBe('2019');
    });

    it('should handle version 2020', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2020' });
      const app = mockAdapter.getApplication();

      const version = SolidWorksConfig.getVersion(app);

      expect(version).not.toBeNull();
      expect(version?.year).toBe('2020');
    });

    it('should handle version 2025', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2025' });
      const app = mockAdapter.getApplication();

      const version = SolidWorksConfig.getVersion(app);

      expect(version).not.toBeNull();
      expect(version?.year).toBe('2025');
    });

    it('should return null for invalid version format', () => {
      const mockApp = {
        RevisionNumber: () => 'invalid',
      };

      const version = SolidWorksConfig.getVersion(mockApp);

      expect(version).toBeNull();
    });
  });

  describe('getDefaultTemplates', () => {
    it('should get templates from user preferences', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();

      const templates = SolidWorksConfig.getDefaultTemplates(app);

      expect(templates).not.toBeNull();
      expect(templates?.part).toContain('Part.prtdot');
      expect(templates?.assembly).toContain('Assembly.asmdot');
      expect(templates?.drawing).toContain('Drawing.drwdot');
    });

    it('should construct paths for SolidWorks 2024', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();

      const templates = SolidWorksConfig.getDefaultTemplates(app);

      expect(templates?.part).toContain('SOLIDWORKS 2024');
      expect(templates?.assembly).toContain('SOLIDWORKS 2024');
      expect(templates?.drawing).toContain('SOLIDWORKS 2024');
    });

    it('should construct paths for SolidWorks 2021', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2021' });
      const app = mockAdapter.getApplication();

      const templates = SolidWorksConfig.getDefaultTemplates(app);

      expect(templates?.part).toContain('SOLIDWORKS 2021');
    });
  });

  describe('getTemplatePath', () => {
    it('should return custom path when provided', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();
      const customPath = 'C:\\Custom\\Template.prtdot';

      const path = SolidWorksConfig.getTemplatePath(app, 'part', customPath);

      expect(path).toBe(customPath);
    });

    it('should return default part template', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();

      const path = SolidWorksConfig.getTemplatePath(app, 'part');

      expect(path).toContain('Part.prtdot');
    });

    it('should return default assembly template', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();

      const path = SolidWorksConfig.getTemplatePath(app, 'assembly');

      expect(path).toContain('Assembly.asmdot');
    });

    it('should return default drawing template', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();

      const path = SolidWorksConfig.getTemplatePath(app, 'drawing');

      expect(path).toContain('Drawing.drwdot');
    });

    it('should fall back to generic template path when version is unknown', () => {
      const mockApp = {
        RevisionNumber: () => null,
        GetUserPreferenceStringValue: () => null,
      };

      // getDefaultTemplates has a generic fallback (strategy 3),
      // so getTemplatePath never throws — it returns a best-guess path
      const path = SolidWorksConfig.getTemplatePath(mockApp, 'part');
      expect(path).toContain('Part.prtdot');
    });
  });

  describe('getInstallInfo', () => {
    it('should return version and template information', () => {
      const mockAdapter = createMockSolidWorksAdapter({ version: '2024' });
      const app = mockAdapter.getApplication();

      const info = SolidWorksConfig.getInstallInfo(app);

      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('templates');
      expect(info.version.year).toBe('2024');
    });

    it('should handle errors gracefully', () => {
      const mockApp = {
        RevisionNumber: () => {
          throw new Error('Test error');
        },
        GetUserPreferenceStringValue: () => {
          throw new Error('Test error');
        },
        Visible: true,
      };

      const info = SolidWorksConfig.getInstallInfo(mockApp);

      // getVersion and getDefaultTemplates catch errors internally,
      // so getInstallInfo gets null back (not an exception).
      // The result should still include visible and templates (from generic fallback).
      expect(info.visible).toBe(true);
      expect(info).toHaveProperty('templates');
    });
  });
});
