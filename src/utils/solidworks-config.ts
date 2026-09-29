/**
 * SolidWorks Configuration Utilities
 * Provides version detection and path resolution for SolidWorks installations
 */

export interface SolidWorksVersion {
  year: string;
  majorVersion: number;
  revisionNumber: string;
}

export interface SolidWorksTemplates {
  part: string;
  assembly: string;
  drawing: string;
}

export class SolidWorksConfig {
  /**
   * Extract SolidWorks version information from the application
   */
  static getVersion(swApp: any): SolidWorksVersion | null {
    try {
      const revisionNumber = swApp.RevisionNumber();
      if (!revisionNumber) return null;

      // Revision number format: "YYYY SP X.Y" or "XX.Y.Z.ZZZZ"
      // Modern format: "2024 SP5.0" or older format: "27.5.0.0084" (SW 2019)
      const yearMatch = revisionNumber.match(/^(\d{4})/);
      if (yearMatch) {
        return {
          year: yearMatch[1],
          majorVersion: parseInt(yearMatch[1], 10),
          revisionNumber,
        };
      }

      // Fallback for older version number format (27.x = SW2019, 28.x = SW2020, etc.)
      const oldFormatMatch = revisionNumber.match(/^(\d+)\./);
      if (oldFormatMatch) {
        const majorVer = parseInt(oldFormatMatch[1], 10);
        const year = (1992 + majorVer).toString();
        return {
          year,
          majorVersion: parseInt(year, 10),
          revisionNumber,
        };
      }

      return null;
    } catch (_error) {
      // Errors are expected when SolidWorks is not available or mock throws
      return null;
    }
  }

  /**
   * Get default template paths for SolidWorks
   * Attempts multiple strategies to find the correct template location
   */
  static getDefaultTemplates(swApp: any): SolidWorksTemplates | null {
    try {
      // Strategy 1: Try to get user preference templates
      try {
        const partTemplate = swApp.GetUserPreferenceStringValue(0); // swDefaultTemplatePart
        const assemblyTemplate = swApp.GetUserPreferenceStringValue(1); // swDefaultTemplateAssembly
        const drawingTemplate = swApp.GetUserPreferenceStringValue(8); // swDefaultTemplateDrawing

        if (partTemplate && assemblyTemplate && drawingTemplate) {
          return {
            part: partTemplate,
            assembly: assemblyTemplate,
            drawing: drawingTemplate,
          };
        }
      } catch (_e) {
        // User preferences not available
      }

      // Strategy 2: Build paths based on SolidWorks version
      const version = SolidWorksConfig.getVersion(swApp);
      if (version?.year) {
        const basePath = `C:\\ProgramData\\SolidWorks\\SOLIDWORKS ${version.year}\\templates`;
        return {
          part: `${basePath}\\Part.prtdot`,
          assembly: `${basePath}\\Assembly.asmdot`,
          drawing: `${basePath}\\Drawing.drwdot`,
        };
      }

      // Strategy 3: Try version-independent paths
      const genericBasePath = 'C:\\ProgramData\\SolidWorks\\templates';
      return {
        part: `${genericBasePath}\\Part.prtdot`,
        assembly: `${genericBasePath}\\Assembly.asmdot`,
        drawing: `${genericBasePath}\\Drawing.drwdot`,
      };
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get a specific template path with fallback logic
   */
  static getTemplatePath(swApp: any, templateType: 'part' | 'assembly' | 'drawing', customPath?: string): string {
    // If custom path provided, use it
    if (customPath && customPath !== '') {
      return customPath;
    }

    // Try to get from default templates
    const templates = SolidWorksConfig.getDefaultTemplates(swApp);
    if (templates) {
      return templates[templateType];
    }

    // Final fallback - throw error with helpful message
    throw new Error(
      `Cannot determine SolidWorks ${templateType} template path. ` +
        `Please specify the template path explicitly in your request, or ensure ` +
        `SolidWorks default templates are configured in Tools > Options > File Locations > Document Templates.`
    );
  }

  /**
   * Validate that a template file exists (if possible)
   * Note: This is a best-effort check and may not work in all environments
   */
  static validateTemplatePath(templatePath: string): boolean {
    try {
      // In Node.js environment with file system access
      if (typeof require !== 'undefined') {
        const fs = require('node:fs');
        return fs.existsSync(templatePath);
      }
      // If we can't validate, assume it's valid
      return true;
    } catch (_error) {
      // Can't validate, assume it's valid
      return true;
    }
  }

  /**
   * Get SolidWorks installation information for debugging
   */
  static getInstallInfo(swApp: any): Record<string, any> {
    const info: Record<string, any> = {};

    try {
      const version = SolidWorksConfig.getVersion(swApp);
      if (version) {
        info.version = version;
      }
    } catch (e) {
      info.versionError = String(e);
    }

    try {
      const templates = SolidWorksConfig.getDefaultTemplates(swApp);
      if (templates) {
        info.templates = templates;
      }
    } catch (e) {
      info.templatesError = String(e);
    }

    try {
      // Try to get installation path
      info.visible = swApp.Visible;
    } catch (_e) {
      // Ignore
    }

    return info;
  }
}
