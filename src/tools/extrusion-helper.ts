// Alternative approach: Create a helper module that uses simpler API calls
import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

export const extrusionHelper = {
  name: 'simple_extrude',
  description: 'Simplified extrusion helper',
  inputSchema: z.object({
    depth: z.number().describe('Extrusion depth in mm'),
  }),
  handler: (args: any, swApi: SolidWorksAPI) => {
    try {
      const model = swApi.getCurrentModel();
      if (!model) throw new Error('No active model');

      // Get the selection manager
      const _selMgr = model.SelectionManager;
      const ext = model.Extension;
      const _featureMgr = model.FeatureManager;

      // Clear selections
      model.ClearSelection2(true);

      // Select the sketch using a simpler approach
      let sketchFound = false;
      const sketchNames = ['Sketch1', 'Sketch2', 'Sketch3'];

      for (const name of sketchNames) {
        try {
          if (ext.SelectByID2(name, 'SKETCH', 0, 0, 0, false, 4, undefined, 0)) {
            sketchFound = true;
            break;
          }
        } catch (_e) {}
      }

      if (!sketchFound) {
        throw new Error('Could not find sketch to extrude');
      }

      // Use the Insert menu command instead of FeatureManager
      // This is a simpler approach that might work better
      try {
        // Insert Boss/Base Extrude
        model.InsertSketch2(false); // Exit sketch if in sketch mode

        // Use command ID for Boss-Extrude
        const commandID = 20168; // Boss/Base Extrude command ID
        model.RunCommand(commandID, '');

        // Set the depth using the property manager page
        const pmPage = model.IPropertyManagerPage;
        if (pmPage) {
          // Set depth value
          pmPage.SetValue('Depth', args.depth / 1000);
          pmPage.Close(true); // OK button
        }

        return 'Extrusion created via command';
      } catch (e) {
        return `Command approach failed: ${e}`;
      }
    } catch (error) {
      return `Helper failed: ${error}`;
    }
  },
};
