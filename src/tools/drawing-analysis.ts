import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

export const drawingAnalysisTools = [
  {
    name: 'get_drawing_sheet_info',
    description:
      'Get comprehensive information about the current drawing sheet including size, scale, and recommended view positions',
    inputSchema: z.object({}),
    handler: (_args: any, swApi: SolidWorksAPI) => {
      try {
        // This will call the new getDrawingSheetInfo method we're adding to the API
        return swApi.getDrawingSheetInfo();
      } catch (error) {
        return `Failed to get drawing sheet info: ${error}`;
      }
    },
  },

  {
    name: 'get_drawing_views',
    description: 'Get information about all views in the current drawing',
    inputSchema: z.object({}),
    handler: (_args: any, swApi: SolidWorksAPI) => {
      try {
        return swApi.getDrawingViews();
      } catch (error) {
        return `Failed to get drawing views: ${error}`;
      }
    },
  },

  {
    name: 'set_drawing_sheet_size',
    description: 'Set the drawing sheet size',
    inputSchema: z.object({
      paperSize: z
        .enum(['Letter', 'Letter-Landscape', 'Tabloid', 'Tabloid-Landscape', 'A4', 'A3', 'A2', 'A1', 'A0', 'Custom'])
        .describe('Paper size'),
      width: z.number().optional().describe('Width in inches (for custom size)'),
      height: z.number().optional().describe('Height in inches (for custom size)'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        return swApi.setDrawingSheetSize(args.paperSize, args.width, args.height);
      } catch (error) {
        return `Failed to set sheet size: ${error}`;
      }
    },
  },

  {
    name: 'get_template_custom_properties',
    description: 'Get custom properties from the drawing template, including view position settings',
    inputSchema: z.object({}),
    handler: (_args: any, swApi: SolidWorksAPI) => {
      try {
        return swApi.getTemplateCustomProperties();
      } catch (error) {
        return `Failed to get template properties: ${error}`;
      }
    },
  },

  {
    name: 'set_template_custom_properties',
    description: 'Set custom properties in the drawing template for view positions and other settings',
    inputSchema: z.object({
      properties: z.record(z.string()).describe('Key-value pairs of properties to set'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        return swApi.setTemplateCustomProperties(args.properties);
      } catch (error) {
        return `Failed to set template properties: ${error}`;
      }
    },
  },

  {
    name: 'setup_template_positions',
    description: 'Set up a drawing template with standard view positions',
    inputSchema: z.object({
      sheetSize: z.enum(['Letter', 'Tabloid', 'A4', 'A3']).default('Tabloid').describe('Sheet size to configure for'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        let properties: { [key: string]: string } = {};

        if (args.sheetSize === 'Tabloid') {
          // 11x17 positions
          properties = {
            VIEW_ISO_X: '0.0762', // 3 inches
            VIEW_ISO_Y: '0.2286', // 9 inches
            VIEW_ISO_SCALE: '1.5',
            VIEW_TOP_X: '0.2159', // 8.5 inches
            VIEW_TOP_Y: '0.1397', // 5.5 inches
            VIEW_TOP_SCALE: '2',
            VIEW_SIDE_X: '0.3429', // 13.5 inches
            VIEW_SIDE_Y: '0.1397', // 5.5 inches
            VIEW_SIDE_SCALE: '2',
            VIEW_SECTION_X: '0.2159', // 8.5 inches
            VIEW_SECTION_Y: '0.0508', // 2 inches
            VIEW_SECTION_SCALE: '2',
            DIM_TEXT_HEIGHT: '0.003175', // 1/8 inch
            DIM_ARROW_SIZE: '0.00238', // 3/32 inch
            DIM_OFFSET: '0.00635', // 1/4 inch
          };
        } else if (args.sheetSize === 'Letter') {
          // 8.5x11 positions
          properties = {
            VIEW_ISO_X: '0.0508', // 2 inches
            VIEW_ISO_Y: '0.1778', // 7 inches
            VIEW_ISO_SCALE: '1',
            VIEW_TOP_X: '0.1080', // 4.25 inches
            VIEW_TOP_Y: '0.1016', // 4 inches
            VIEW_TOP_SCALE: '1.5',
            VIEW_SIDE_X: '0.1651', // 6.5 inches
            VIEW_SIDE_Y: '0.1016', // 4 inches
            VIEW_SIDE_SCALE: '1.5',
            VIEW_SECTION_X: '0.1080', // 4.25 inches
            VIEW_SECTION_Y: '0.0381', // 1.5 inches
            VIEW_SECTION_SCALE: '1.5',
            DIM_TEXT_HEIGHT: '0.00238', // 3/32 inch
            DIM_ARROW_SIZE: '0.001905', // 3/40 inch
            DIM_OFFSET: '0.00476', // 3/16 inch
          };
        }

        const result = swApi.setTemplateCustomProperties(properties);

        return {
          ...result,
          message: `Template configured for ${args.sheetSize} size with standard positions`,
          hint: 'Save the template to preserve these settings',
        };
      } catch (error) {
        return `Failed to setup template: ${error}`;
      }
    },
  },

  {
    name: 'get_drawing_dimensions',
    description: 'Get all dimensions in the current drawing view',
    inputSchema: z.object({
      viewName: z.string().optional().describe('Specific view name, or all views if not specified'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model || model.GetType() !== 3) {
          throw new Error('Current document must be a drawing');
        }

        const drawingDoc = model;
        const dimensions = [];

        // Get all views or specific view
        const sheet = drawingDoc.GetCurrentSheet();
        const views = sheet.GetViews();

        if (views && views.length > 0) {
          for (const view of views) {
            if (args.viewName && view.Name !== args.viewName) continue;

            // Get dimensions from this view
            const dispDim = view.GetFirstDisplayDimension();
            let currentDim = dispDim;

            while (currentDim) {
              try {
                const dim = currentDim.GetDimension2(0);
                if (dim) {
                  dimensions.push({
                    name: dim.FullName || dim.Name,
                    value: dim.SystemValue * 1000, // Convert to mm
                    text: currentDim.GetText(0),
                    view: view.Name,
                  });
                }
              } catch (_e) {
                // Continue with next dimension
              }

              currentDim = view.GetNextDisplayDimension(currentDim);
            }
          }
        }

        return {
          dimensionCount: dimensions.length,
          dimensions: dimensions,
        };
      } catch (error) {
        return `Failed to get drawing dimensions: ${error}`;
      }
    },
  },

  {
    name: 'set_drawing_scale',
    description: 'Set the scale of the drawing sheet or a specific view',
    inputSchema: z.object({
      scaleNumerator: z.number().describe('Scale numerator (e.g., 2 for 2:1)'),
      scaleDenominator: z.number().default(1).describe('Scale denominator (e.g., 1 for 2:1)'),
      viewName: z.string().optional().describe('Specific view name, or sheet scale if not specified'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model || model.GetType() !== 3) {
          throw new Error('Current document must be a drawing');
        }

        const drawingDoc = model;

        if (args.viewName) {
          // Set specific view scale
          const sheet = drawingDoc.GetCurrentSheet();
          const views = sheet.GetViews();

          let viewFound = false;
          for (const view of views) {
            if (view.Name === args.viewName) {
              view.ScaleDecimal = args.scaleNumerator / args.scaleDenominator;
              view.UseSheetScale = 0; // Don't use sheet scale
              viewFound = true;
              break;
            }
          }

          if (!viewFound) {
            throw new Error(`View "${args.viewName}" not found`);
          }
        } else {
          // Set sheet scale
          const sheet = drawingDoc.GetCurrentSheet();
          sheet.SetScale(args.scaleNumerator, args.scaleDenominator, false, false);
        }

        drawingDoc.EditRebuild3();

        return {
          success: true,
          scale: `${args.scaleNumerator}:${args.scaleDenominator}`,
          appliedTo: args.viewName || 'Sheet',
        };
      } catch (error) {
        return `Failed to set scale: ${error}`;
      }
    },
  },
];
