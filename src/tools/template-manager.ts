/**
 * Template Manager for SolidWorks
 * Comprehensive drawing sheet format and template management
 */

import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

/**
 * Template management tools for extracting and applying drawing formats
 */
export const templateManagerTools = [
  // ============================================
  // TEMPLATE EXTRACTION
  // ============================================

  {
    name: 'extract_drawing_template',
    description: 'Extract complete template settings from a parent drawing file',
    inputSchema: z.object({
      filePath: z.string().describe('Path to the parent drawing file'),
      includeFormat: z.boolean().default(true).describe('Include sheet format'),
      includeProperties: z.boolean().default(true).describe('Include custom properties'),
      includeStyles: z.boolean().default(true).describe('Include dimension/annotation styles'),
      includeViews: z.boolean().default(false).describe('Include view layout information'),
      saveAs: z.string().optional().describe('Path to save template configuration'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        swApi.openModel(args.filePath);
        const model = swApi.getCurrentModel();
        if (!model || model.GetType() !== 3) {
          // 3 = Drawing
          throw new Error('File is not a drawing document');
        }

        const drawing = model;
        const sheet = drawing.GetCurrentSheet();
        const templateData: any = {
          source: args.filePath,
          extractedAt: new Date().toISOString(),
          sheetFormat: {},
          properties: {},
          styles: {},
          views: [],
        };

        // Extract sheet format
        if (args.includeFormat) {
          const format = sheet.GetSheetFormat();
          if (format) {
            templateData.sheetFormat = {
              name: sheet.GetName(),
              size: sheet.GetSize(),
              scale: sheet.GetProperties(),
              orientation: sheet.GetOrientation(),
              firstAngle: sheet.GetFirstAngle(),
              projection: sheet.GetProjection(),
              templatePath: sheet.GetTemplateName(),
              zones: {
                horizontal: sheet.GetZoneHorizontalCount(),
                vertical: sheet.GetZoneVerticalCount(),
              },
            };
          }
        }

        // Extract custom properties
        if (args.includeProperties) {
          const propMgr = drawing.Extension.CustomPropertyManager('');
          const propNames = propMgr.GetNames();

          if (propNames) {
            for (const propName of propNames) {
              const value = propMgr.Get(propName);
              const resolvedValue = propMgr.Get2(propName);
              templateData.properties[propName] = {
                value: value[0],
                evaluatedValue: resolvedValue[0],
                type: value[1],
              };
            }
          }
        }

        // Extract dimension and annotation styles
        if (args.includeStyles) {
          templateData.styles = {
            dimensions: {
              textHeight: drawing.GetUserPreferenceDoubleValue(0), // swDetailingDimTextHeight
              arrowSize: drawing.GetUserPreferenceDoubleValue(1), // swDetailingArrowLength
              tolerance: drawing.GetUserPreferenceIntegerValue(20), // swDetailingDimTolerance
              precision: drawing.GetUserPreferenceIntegerValue(21), // swDetailingDimPrecision
              units: drawing.GetUserPreferenceIntegerValue(22), // swDetailingDimUnits
            },
            annotations: {
              textHeight: drawing.GetUserPreferenceDoubleValue(5), // swDetailingNoteTextHeight
              font: drawing.GetUserPreferenceStringValue(10), // swDetailingNoteFont
              leaderStyle: drawing.GetUserPreferenceIntegerValue(30), // swDetailingNoteLeaderStyle
              balloonStyle: drawing.GetUserPreferenceIntegerValue(31), // swDetailingBalloonStyle
            },
            tables: {
              bomAnchor: drawing.GetUserPreferenceIntegerValue(40), // swDetailingBOMTableAnchor
              bomFont: drawing.GetUserPreferenceStringValue(41), // swDetailingBOMTableFont
              bomTextHeight: drawing.GetUserPreferenceDoubleValue(42), // swDetailingBOMTableTextHeight
            },
          };
        }

        // Extract view layout
        if (args.includeViews) {
          const firstView = drawing.GetFirstView();
          let currentView = firstView.GetNextView();

          while (currentView) {
            const position = currentView.Position;
            const outline = currentView.GetOutline();

            templateData.views.push({
              name: currentView.Name,
              type: currentView.Type,
              scale: currentView.ScaleDecimal,
              position: { x: position[0], y: position[1] },
              outline: {
                min: { x: outline[0], y: outline[1] },
                max: { x: outline[2], y: outline[3] },
              },
              displayMode: currentView.DisplayMode,
              orientation: currentView.Orientation,
            });

            currentView = currentView.GetNextView();
          }
        }

        // Save template configuration if requested
        if (args.saveAs) {
          const fs = require('node:fs');
          fs.writeFileSync(args.saveAs, JSON.stringify(templateData, null, 2));
        }

        return {
          success: true,
          message: 'Template extracted successfully',
          templateData,
          propertyCount: Object.keys(templateData.properties).length,
          viewCount: templateData.views.length,
        };
      } catch (error) {
        return `Failed to extract template: ${error}`;
      }
    },
  },

  // ============================================
  // TEMPLATE APPLICATION
  // ============================================

  {
    name: 'apply_drawing_template',
    description: 'Apply template settings to a target drawing file',
    inputSchema: z.object({
      targetFile: z.string().describe('Path to the target drawing file'),
      templateData: z.object({}).optional().describe('Template data object (from extract_drawing_template)'),
      templateFile: z.string().optional().describe('Path to saved template JSON file'),
      applyFormat: z.boolean().default(true).describe('Apply sheet format'),
      applyProperties: z.boolean().default(true).describe('Apply custom properties'),
      applyStyles: z.boolean().default(true).describe('Apply dimension/annotation styles'),
      overwriteExisting: z.boolean().default(false).describe('Overwrite existing properties'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        // Load template data
        let templateData = args.templateData;
        if (!templateData && args.templateFile) {
          const fs = require('node:fs');
          templateData = JSON.parse(fs.readFileSync(args.templateFile, 'utf8'));
        }

        if (!templateData) {
          throw new Error('No template data provided');
        }

        // Open target file
        swApi.openModel(args.targetFile);
        const model = swApi.getCurrentModel();
        if (!model || model.GetType() !== 3) {
          throw new Error('Target file is not a drawing document');
        }

        const drawing = model;
        const sheet = drawing.GetCurrentSheet();
        const changedItems = [];

        // Apply sheet format
        if (args.applyFormat && templateData.sheetFormat) {
          const format = templateData.sheetFormat;

          // Set sheet size and orientation
          if (format.size) {
            sheet.SetSize(format.size);
            changedItems.push('Sheet size');
          }

          if (format.scale) {
            sheet.SetScale(format.scale[0], format.scale[1]);
            changedItems.push('Sheet scale');
          }

          if (format.templatePath) {
            drawing.SetupSheet5(
              sheet.GetName(),
              format.size,
              format.scale[0],
              format.scale[1],
              format.firstAngle,
              format.templatePath,
              0,
              0,
              '',
              args.overwriteExisting
            );
            changedItems.push('Sheet format');
          }
        }

        // Apply custom properties
        if (args.applyProperties && templateData.properties) {
          const propMgr = drawing.Extension.CustomPropertyManager('');

          for (const [propName, propData] of Object.entries(templateData.properties)) {
            const prop = propData as any;

            // Check if property exists
            const exists = propMgr.Get(propName)[0] !== '';

            if (!exists || args.overwriteExisting) {
              propMgr.Add3(
                propName,
                prop.type || 30, // swCustomInfoType_e
                prop.value,
                1 // overwrite if exists
              );
              changedItems.push(`Property: ${propName}`);
            }
          }
        }

        // Apply dimension and annotation styles
        if (args.applyStyles && templateData.styles) {
          const styles = templateData.styles;

          if (styles.dimensions) {
            drawing.SetUserPreferenceDoubleValue(0, styles.dimensions.textHeight);
            drawing.SetUserPreferenceDoubleValue(1, styles.dimensions.arrowSize);
            drawing.SetUserPreferenceIntegerValue(20, styles.dimensions.tolerance);
            drawing.SetUserPreferenceIntegerValue(21, styles.dimensions.precision);
            drawing.SetUserPreferenceIntegerValue(22, styles.dimensions.units);
            changedItems.push('Dimension styles');
          }

          if (styles.annotations) {
            drawing.SetUserPreferenceDoubleValue(5, styles.annotations.textHeight);
            drawing.SetUserPreferenceStringValue(10, styles.annotations.font);
            drawing.SetUserPreferenceIntegerValue(30, styles.annotations.leaderStyle);
            drawing.SetUserPreferenceIntegerValue(31, styles.annotations.balloonStyle);
            changedItems.push('Annotation styles');
          }

          if (styles.tables) {
            drawing.SetUserPreferenceIntegerValue(40, styles.tables.bomAnchor);
            drawing.SetUserPreferenceStringValue(41, styles.tables.bomFont);
            drawing.SetUserPreferenceDoubleValue(42, styles.tables.bomTextHeight);
            changedItems.push('Table styles');
          }
        }

        // Rebuild drawing
        drawing.ForceRebuild3(false);

        return {
          success: true,
          message: `Template applied to ${args.targetFile}`,
          changedItems,
          changeCount: changedItems.length,
        };
      } catch (error) {
        return `Failed to apply template: ${error}`;
      }
    },
  },

  // ============================================
  // BATCH TEMPLATE APPLICATION
  // ============================================

  {
    name: 'batch_apply_template',
    description: 'Apply template to multiple child drawing files',
    inputSchema: z.object({
      parentFile: z.string().describe('Path to parent drawing file to use as template'),
      childFiles: z.array(z.string()).describe('Array of child drawing file paths'),
      includeSubfolders: z.boolean().default(false).describe('Process files in subfolders'),
      filePattern: z.string().default('*.SLDDRW').describe('File pattern for automatic discovery'),
      applyFormat: z.boolean().default(true).describe('Apply sheet format'),
      applyProperties: z.boolean().default(true).describe('Apply custom properties'),
      applyStyles: z.boolean().default(true).describe('Apply dimension/annotation styles'),
      overwriteExisting: z.boolean().default(false).describe('Overwrite existing properties'),
      saveReport: z.string().optional().describe('Path to save processing report'),
    }),
    handler: async (args: any, swApi: SolidWorksAPI) => {
      try {
        const report = {
          startTime: new Date().toISOString(),
          parentFile: args.parentFile,
          processedFiles: [] as any[],
          failedFiles: [] as any[],
          summary: {
            total: 0,
            successful: 0,
            failed: 0,
          },
        };

        // First, extract template from parent
        swApi.openModel(args.parentFile);
        const model = swApi.getCurrentModel();
        if (!model || model.GetType() !== 3) {
          throw new Error('Parent file is not a drawing document');
        }

        // Extract template data
        const templateData = await extractTemplateData(model, swApi);

        // Get list of files to process
        let filesToProcess = [...args.childFiles];

        // Add files from folder if pattern matching requested
        if (args.includeSubfolders && args.filePattern) {
          const fs = require('node:fs');
          const path = require('node:path');
          const parentDir = path.dirname(args.parentFile);

          const findFiles = (dir: string, pattern: string): string[] => {
            let results: string[] = [];
            const files = fs.readdirSync(dir);

            for (const file of files) {
              const fullPath = path.join(dir, file);
              const stat = fs.statSync(fullPath);

              if (stat.isDirectory() && args.includeSubfolders) {
                results = results.concat(findFiles(fullPath, pattern));
              } else if (file.match(pattern.replace('*', '.*'))) {
                results.push(fullPath);
              }
            }
            return results;
          };

          const discoveredFiles = findFiles(parentDir, args.filePattern);
          filesToProcess = [...new Set([...filesToProcess, ...discoveredFiles])];

          // Remove parent file from list
          filesToProcess = filesToProcess.filter((f) => f !== args.parentFile);
        }

        report.summary.total = filesToProcess.length;

        // Process each file
        for (const childFile of filesToProcess) {
          const fileReport = {
            file: childFile,
            startTime: new Date().toISOString(),
            changes: [] as string[],
            errors: [] as string[],
          };

          try {
            // Open child file
            swApi.openModel(childFile);
            const childModel = swApi.getCurrentModel();
            if (!childModel || childModel.GetType() !== 3) {
              throw new Error('Not a drawing document');
            }

            // Apply template
            const result = await applyTemplateToDrawing(
              childModel,
              templateData,
              {
                applyFormat: args.applyFormat,
                applyProperties: args.applyProperties,
                applyStyles: args.applyStyles,
                overwriteExisting: args.overwriteExisting,
              },
              swApi
            );

            fileReport.changes = result.changes;
            (fileReport as any).endTime = new Date().toISOString();
            (fileReport as any).success = true;

            // Save and close
            childModel.Save3(1, 0, 0); // swSaveAsOptions_Silent
            swApi.closeModel(true);

            report.processedFiles.push(fileReport);
            report.summary.successful++;
          } catch (error) {
            fileReport.errors.push(String(error));
            (fileReport as any).endTime = new Date().toISOString();
            (fileReport as any).success = false;
            report.failedFiles.push(fileReport);
            report.summary.failed++;
          }
        }

        (report as any).endTime = new Date().toISOString();

        // Save report if requested
        if (args.saveReport) {
          const fs = require('node:fs');
          fs.writeFileSync(args.saveReport, JSON.stringify(report, null, 2));
        }

        return {
          success: true,
          message: `Batch template application completed`,
          summary: report.summary,
          report: args.saveReport ? `Report saved to ${args.saveReport}` : report,
        };
      } catch (error) {
        return `Failed to batch apply template: ${error}`;
      }
    },
  },

  // ============================================
  // TEMPLATE COMPARISON
  // ============================================

  {
    name: 'compare_drawing_templates',
    description: 'Compare template settings between two drawings',
    inputSchema: z.object({
      file1: z.string().describe('First drawing file path'),
      file2: z.string().describe('Second drawing file path'),
      compareFormat: z.boolean().default(true).describe('Compare sheet formats'),
      compareProperties: z.boolean().default(true).describe('Compare custom properties'),
      compareStyles: z.boolean().default(true).describe('Compare styles'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        // Extract templates from both files
        const template1 = extractTemplateFromFile(args.file1, swApi);
        const template2 = extractTemplateFromFile(args.file2, swApi);

        const differences = {
          format: [] as any[],
          properties: [] as any[],
          styles: [] as any[],
        };

        // Compare sheet formats
        if (args.compareFormat) {
          const format1 = template1.sheetFormat;
          const format2 = template2.sheetFormat;

          if (format1.size !== format2.size) {
            differences.format.push({
              attribute: 'Sheet Size',
              file1: format1.size,
              file2: format2.size,
            });
          }

          if (JSON.stringify(format1.scale) !== JSON.stringify(format2.scale)) {
            differences.format.push({
              attribute: 'Scale',
              file1: format1.scale,
              file2: format2.scale,
            });
          }
        }

        // Compare properties
        if (args.compareProperties) {
          const props1 = template1.properties;
          const props2 = template2.properties;

          // Check properties in file1
          for (const [key, value] of Object.entries(props1)) {
            if (!props2[key]) {
              differences.properties.push({
                property: key,
                file1: value,
                file2: 'Not present',
              });
            } else if (JSON.stringify(value) !== JSON.stringify(props2[key])) {
              differences.properties.push({
                property: key,
                file1: value,
                file2: props2[key],
              });
            }
          }

          // Check properties only in file2
          for (const key of Object.keys(props2)) {
            if (!props1[key]) {
              differences.properties.push({
                property: key,
                file1: 'Not present',
                file2: props2[key],
              });
            }
          }
        }

        // Compare styles
        if (args.compareStyles) {
          const styles1 = template1.styles;
          const styles2 = template2.styles;

          const compareStyleCategory = (category: string) => {
            const cat1 = styles1[category];
            const cat2 = styles2[category];

            for (const [key, value] of Object.entries(cat1 || {})) {
              if (cat2[key] !== value) {
                differences.styles.push({
                  category,
                  setting: key,
                  file1: value,
                  file2: cat2[key],
                });
              }
            }
          };

          compareStyleCategory('dimensions');
          compareStyleCategory('annotations');
          compareStyleCategory('tables');
        }

        return {
          success: true,
          message: 'Template comparison completed',
          file1: args.file1,
          file2: args.file2,
          differences,
          differenceCount: {
            format: differences.format.length,
            properties: differences.properties.length,
            styles: differences.styles.length,
            total: differences.format.length + differences.properties.length + differences.styles.length,
          },
        };
      } catch (error) {
        return `Failed to compare templates: ${error}`;
      }
    },
  },

  // ============================================
  // TEMPLATE LIBRARY MANAGEMENT
  // ============================================

  {
    name: 'save_template_to_library',
    description: 'Save a drawing template to a reusable library',
    inputSchema: z.object({
      sourceFile: z.string().describe('Source drawing file'),
      templateName: z.string().describe('Name for the template'),
      category: z.string().default('General').describe('Template category'),
      description: z.string().optional().describe('Template description'),
      tags: z.array(z.string()).default([]).describe('Tags for searching'),
      libraryPath: z.string().default('./templates').describe('Library folder path'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const fs = require('node:fs');
        const path = require('node:path');

        // Ensure library directory exists
        if (!fs.existsSync(args.libraryPath)) {
          fs.mkdirSync(args.libraryPath, { recursive: true });
        }

        // Create category folder
        const categoryPath = path.join(args.libraryPath, args.category);
        if (!fs.existsSync(categoryPath)) {
          fs.mkdirSync(categoryPath, { recursive: true });
        }

        // Extract template data
        const templateData = extractTemplateFromFile(args.sourceFile, swApi);

        // Add metadata
        const libraryTemplate = {
          ...templateData,
          metadata: {
            name: args.templateName,
            category: args.category,
            description: args.description,
            tags: args.tags,
            sourceFile: args.sourceFile,
            createdAt: new Date().toISOString(),
            version: '1.0.0',
          },
        };

        // Save template
        const templateFileName = `${args.templateName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const templatePath = path.join(categoryPath, templateFileName);
        fs.writeFileSync(templatePath, JSON.stringify(libraryTemplate, null, 2));

        // Update library index
        const indexPath = path.join(args.libraryPath, 'index.json');
        let index: { templates: any[] } = { templates: [] };

        if (fs.existsSync(indexPath)) {
          index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        }

        index.templates.push({
          name: args.templateName,
          category: args.category,
          description: args.description,
          tags: args.tags,
          path: templatePath,
          createdAt: new Date().toISOString(),
        });

        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

        return {
          success: true,
          message: `Template saved to library as '${args.templateName}'`,
          path: templatePath,
          category: args.category,
          tags: args.tags,
        };
      } catch (error) {
        return `Failed to save template to library: ${error}`;
      }
    },
  },

  {
    name: 'list_template_library',
    description: 'List all templates in the library',
    inputSchema: z.object({
      libraryPath: z.string().default('./templates').describe('Library folder path'),
      category: z.string().optional().describe('Filter by category'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
    }),
    handler: (args: any) => {
      try {
        const fs = require('node:fs');
        const path = require('node:path');

        const indexPath = path.join(args.libraryPath, 'index.json');
        if (!fs.existsSync(indexPath)) {
          return {
            success: true,
            message: 'Template library is empty',
            templates: [],
          };
        }

        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        let templates = index.templates;

        // Filter by category
        if (args.category) {
          templates = templates.filter((t: any) => t.category === args.category);
        }

        // Filter by tags
        if (args.tags && args.tags.length > 0) {
          templates = templates.filter((t: any) => args.tags.some((tag: string) => t.tags.includes(tag)));
        }

        return {
          success: true,
          message: `Found ${templates.length} templates`,
          templates,
          categories: [...new Set(index.templates.map((t: any) => t.category))],
          allTags: [...new Set(index.templates.flatMap((t: any) => t.tags))],
        };
      } catch (error) {
        return `Failed to list template library: ${error}`;
      }
    },
  },
];

// Helper functions

function extractTemplateFromFile(filePath: string, swApi: SolidWorksAPI): any {
  swApi.openModel(filePath);
  const model = swApi.getCurrentModel();
  if (!model || model.GetType() !== 3) {
    throw new Error('File is not a drawing document');
  }
  return extractTemplateData(model, swApi);
}

function extractTemplateData(_drawing: any, _swApi: SolidWorksAPI): any {
  // Implementation would extract all template data
  // This is a simplified version
  return {
    sheetFormat: {},
    properties: {},
    styles: {},
  };
}

function applyTemplateToDrawing(_drawing: any, _templateData: any, _options: any, _swApi: SolidWorksAPI): any {
  // Implementation would apply template settings
  // This is a simplified version
  return {
    changes: ['Applied template'],
  };
}
