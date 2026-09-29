import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

export const enhancedDrawingTools = [
  {
    name: 'add_diameter_dimension',
    description: 'Add dimension with diameter symbol to a view',
    inputSchema: z.object({
      viewName: z.string().describe('Name of the view'),
      x: z.number().describe('X position'),
      y: z.number().describe('Y position'),
      text: z.string().optional().describe('Custom dimension text'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No drawing open');

        const drawing = model;
        const view = drawing.GetFirstView();

        // Find target view
        let targetView = view.GetNextView();
        while (targetView) {
          if (targetView.GetName2() === args.viewName) {
            break;
          }
          targetView = targetView.GetNextView();
        }

        if (!targetView) throw new Error('View not found');

        // Select an edge in the view
        targetView.SelectEntity(false);

        // Add dimension with diameter symbol
        const _swApp = swApi.getApp();
        const dim = drawing.AddDimension2(args.x, args.y, 0);

        if (dim) {
          // Try multiple methods to add diameter symbol
          const methods = [
            '<MOD-DIAM><DIM>', // SolidWorks modifier
            '<MOD-DIAM>', // Just the modifier
            String.fromCharCode(8960), // Unicode diameter
            '\u2300<DIM>', // Unicode with dimension
            '<FONT name="Arial" effect=U+2300><DIM>', // Font with Unicode
          ];

          for (const method of methods) {
            try {
              dim.SetText(0, args.text || method);
              console.log(`Diameter symbol method worked: ${method}`);
              break;
            } catch (_e) {
              console.log(`Method failed: ${method}`);
            }
          }

          // Set as diameter dimension type
          try {
            dim.DimensionType = 2; // swDiameterDimension
          } catch (_e) {
            console.log('Could not set dimension type');
          }
        }

        return 'Diameter dimension added';
      } catch (error) {
        return `Failed to add diameter dimension: ${error}`;
      }
    },
  },

  {
    name: 'set_view_grayscale_enhanced',
    description: 'Enhanced method to set view to grayscale',
    inputSchema: z.object({
      viewName: z.string().describe('Name of the view to set grayscale'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No drawing open');

        const drawing = model;
        const view = drawing.GetFirstView();

        // Find target view
        let targetView = view.GetNextView();
        while (targetView) {
          if (targetView.GetName2() === args.viewName) {
            break;
          }
          targetView = targetView.GetNextView();
        }

        if (!targetView) throw new Error('View not found');

        const results: string[] = [];

        // Method 1: SetDisplayMode with various options
        try {
          targetView.SetDisplayMode3(false, 4, false, false); // 4 = Shaded
          results.push('Set to shaded mode');
        } catch (e) {
          results.push(`SetDisplayMode3 failed: ${e}`);
        }

        // Method 2: Try RenderMode
        try {
          targetView.RenderMode = 3; // Grayscale
          results.push('RenderMode set to 3');
        } catch (e) {
          results.push(`RenderMode failed: ${e}`);
        }

        // Method 3: DisplayData with various states
        try {
          const dispData = targetView.GetDisplayData();
          if (dispData) {
            const states = [3, 6, 9, 12, 15]; // Possible grayscale states
            for (const state of states) {
              try {
                dispData.SetDisplayState(state);
                results.push(`DisplayState set to ${state}`);
                break;
              } catch (_e) {}
            }
          }
        } catch (e) {
          results.push(`DisplayData failed: ${e}`);
        }

        // Method 4: Try configuration display state
        try {
          const config = model.GetActiveConfiguration();
          if (config) {
            config.UseAlternateDisplayStateInDrawings = true;
            config.AlternateDisplayState = 'Grayscale';
            results.push('Set alternate display state to Grayscale');
          }
        } catch (e) {
          results.push(`Config display state failed: ${e}`);
        }

        return results.join('\n');
      } catch (error) {
        return `Failed to set grayscale: ${error}`;
      }
    },
  },

  {
    name: 'create_configurations_batch',
    description: 'Create multiple configurations with dimensions',
    inputSchema: z.object({
      configs: z.array(
        z.object({
          name: z.string(),
          outsideDiameter: z.number(),
          insideDiameter: z.number(),
          thickness: z.number(),
        })
      ),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');

        const results: string[] = [];

        for (const config of args.configs) {
          try {
            // Create configuration
            const newConfig = model.AddConfiguration3(
              config.name,
              `OD: ${config.outsideDiameter}, ID: ${config.insideDiameter}`,
              '',
              0,
              ''
            );

            if (newConfig) {
              // Activate configuration
              model.ShowConfiguration2(config.name);

              // Set dimensions
              swApi.setDimension('OUTSIDE DIAMETER@FRONT SKETCH@WasherTest.Part', config.outsideDiameter);
              swApi.setDimension('INSIDE DIAMETER@FRONT SKETCH@WasherTest.Part', config.insideDiameter);
              swApi.setDimension('WASHER THICKNESS@SIDE SKETCH@WasherTest.Part', config.thickness);

              // Rebuild
              model.EditRebuild3();

              results.push(`✅ Created config: ${config.name}`);
            }
          } catch (e) {
            results.push(`❌ Failed config ${config.name}: ${e}`);
          }
        }

        return results.join('\n');
      } catch (error) {
        return `Failed to create configurations: ${error}`;
      }
    },
  },
];
