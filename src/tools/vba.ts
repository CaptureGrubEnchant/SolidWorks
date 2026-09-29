import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';
import { advancedVBATools } from './vba-advanced.js';
import { assemblyVBATools } from './vba-assembly.js';
import { drawingVBATools } from './vba-drawing.js';
import { fileManagementVBATools } from './vba-file-management.js';
// Import all VBA generation modules
import { partModelingVBATools } from './vba-part.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Register Handlebars helpers - CRITICAL FIX
Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);

Handlebars.registerHelper('lt', (a: any, b: any) => a < b);

Handlebars.registerHelper('gt', (a: any, b: any) => a > b);

Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);

Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);

Handlebars.registerHelper('and', (...args: any[]) => {
  return args.slice(0, -1).every(Boolean);
});

Handlebars.registerHelper('or', (...args: any[]) => {
  return args.slice(0, -1).some(Boolean);
});

Handlebars.registerHelper('not', (a: any) => !a);

// VBA template compiler with template name mapping
const compileTemplate = (templateName: string): any => {
  // Map common names to actual file names
  const templateMap: Record<string, string> = {
    batch_export: 'batch_process', // Fix template name mismatch
    create_drawing: 'create_drawing',
    modify_dimensions: 'modify_dimensions',
  };

  const actualTemplateName = templateMap[templateName] || templateName;
  const templatePath = join(__dirname, '../../examples/vba-templates', `${actualTemplateName}.vba`);

  try {
    const templateContent = readFileSync(templatePath, 'utf-8');
    return Handlebars.compile(templateContent);
  } catch (_error) {
    // If template doesn't exist, try without mapping
    const directPath = join(__dirname, '../../examples/vba-templates', `${templateName}.vba`);
    const templateContent = readFileSync(directPath, 'utf-8');
    return Handlebars.compile(templateContent);
  }
};

// Original VBA tools
const originalVBATools = [
  {
    name: 'generate_vba_script',
    description: 'Generate a VBA script from a template with parameters',
    inputSchema: z.object({
      template: z.string().describe('Template name (e.g., "batch_export", "create_drawing", "modify_dimensions")'),
      parameters: z.record(z.any()).describe('Parameters to pass to the template'),
      outputPath: z.string().optional().describe('Optional path to save the generated script'),
    }),
    handler: async (args: any, _swApi: SolidWorksAPI) => {
      try {
        const template = compileTemplate(args.template);
        const vbaCode = template(args.parameters);

        if (args.outputPath) {
          const fs = await import('node:fs/promises');
          await fs.writeFile(args.outputPath, vbaCode, 'utf-8');
          return `VBA script generated and saved to: ${args.outputPath}`;
        }

        return vbaCode;
      } catch (error) {
        return `Failed to generate VBA script: ${error}`;
      }
    },
  },

  {
    name: 'create_feature_vba',
    description: 'Generate VBA code to create a specific feature',
    inputSchema: z.object({
      featureType: z.enum(['extrude', 'revolve', 'sweep', 'loft', 'hole', 'fillet', 'chamfer']),
      parameters: z.object({
        depth: z.number().optional(),
        angle: z.number().optional(),
        radius: z.number().optional(),
        count: z.number().optional(),
      }),
    }),
    handler: (args: any, _swApi: SolidWorksAPI) => {
      const vbaTemplates: Record<string, string> = {
        extrude: `
Sub CreateExtrusion()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If Not swModel Is Nothing Then
        Set swFeature = swModel.FeatureManager.FeatureExtrusion3( _
            True, False, False, 0, 0, ${args.parameters.depth || 10} / 1000, 0.01, _
            False, False, False, 0, 0, False, False, False, False, _
            False, True, True, 0, 0, False)
        
        If Not swFeature Is Nothing Then
            MsgBox "Extrusion created: " & swFeature.Name
        End If
    End If
End Sub`,
        hole: `
Sub CreateHole()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If Not swModel Is Nothing Then
        Set swFeature = swModel.FeatureManager.HoleWizard5( _
            0, 1, 1, "C:\\ProgramData\\SolidWorks\\SOLIDWORKS 2024\\lang\\english\\swstandards\\ansi inch\\dowel pins.mdb", _
            "Dowel Pin", "DIN", "All", ${args.parameters.radius || 5} / 1000, _
            1, ${args.parameters.depth || 10} / 1000, 0, 1, 0, 0, 0, 0, 0, _
            "", False, True, True, True, True, False)
        
        If Not swFeature Is Nothing Then
            MsgBox "Hole created: " & swFeature.Name
        End If
    End If
End Sub`,
      };

      return vbaTemplates[args.featureType] || 'Feature type not yet implemented';
    },
  },

  {
    name: 'create_batch_vba',
    description: 'Generate VBA for batch processing multiple files',
    inputSchema: z.object({
      operation: z.enum(['export', 'update_property', 'rebuild', 'print']),
      filePattern: z.string().describe('File pattern to match (e.g., "*.sldprt")'),
      outputFormat: z.string().optional().describe('Output format for export operations'),
      propertyName: z.string().optional().describe('Property name for update operations'),
      propertyValue: z.string().optional().describe('Property value for update operations'),
    }),
    handler: (args: any, _swApi: SolidWorksAPI) => {
      try {
        const template = compileTemplate('batch_process');
        return template({
          operation: args.operation,
          filePattern: args.filePattern,
          outputFormat: args.outputFormat,
          propertyName: args.propertyName,
          propertyValue: args.propertyValue,
        });
      } catch (error) {
        return `Failed to generate batch VBA: ${error}`;
      }
    },
  },

  {
    name: 'run_vba_macro',
    description: 'Execute a VBA macro in SolidWorks',
    inputSchema: z.object({
      macroPath: z.string().describe('Full path to the macro file (.swp or .swb)'),
      moduleName: z.string().default('Module1').describe('Module name containing the procedure'),
      procedureName: z.string().describe('Procedure name to execute'),
      arguments: z.array(z.unknown()).optional().describe('Arguments to pass to the macro'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const result = swApi.runMacro(args.macroPath, args.moduleName, args.procedureName, args.arguments || []);
        return `Macro executed successfully. Result: ${result}`;
      } catch (error) {
        return `Failed to execute macro: ${error}`;
      }
    },
  },

  {
    name: 'create_drawing_vba',
    description: 'Generate VBA to create drawings from 3D models',
    inputSchema: z.object({
      modelPath: z.string().describe('Path to the 3D model'),
      template: z.string().describe('Drawing template path'),
      views: z.array(z.enum(['front', 'top', 'right', 'iso', 'section', 'detail'])),
      sheet_size: z.enum(['A4', 'A3', 'A2', 'A1', 'A0', 'Letter', 'Tabloid']),
    }),
    handler: (args: any, _swApi: SolidWorksAPI) => {
      try {
        const template = compileTemplate('create_drawing');
        return template({
          modelPath: args.modelPath,
          drawingTemplate: args.template,
          views: args.views,
          sheetSize: args.sheet_size,
        });
      } catch (error) {
        return `Failed to generate drawing VBA: ${error}`;
      }
    },
  },
];

// Combine all VBA tools into a comprehensive set
export const vbaTools = [
  ...originalVBATools,
  ...partModelingVBATools,
  ...assemblyVBATools,
  ...drawingVBATools,
  ...fileManagementVBATools,
  ...advancedVBATools,
];
