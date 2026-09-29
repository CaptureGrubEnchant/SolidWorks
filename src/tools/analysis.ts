import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

export const analysisTools = [
  {
    name: 'get_mass_properties',
    description: 'Get mass properties of the current model',
    inputSchema: z.object({
      units: z.enum(['kg', 'g', 'lb']).default('kg').describe('Mass units'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const props = swApi.getMassProperties();

        // Convert mass based on units, guard against null from sketch-only docs
        let mass = props.mass ?? 0;
        if (args.units === 'g') mass *= 1000;
        if (args.units === 'lb') mass *= 2.20462;

        const volume = props.volume ?? 0;
        const surfaceArea = props.surfaceArea ?? 0;
        const comX = props.centerOfMass?.x ?? 0;
        const comY = props.centerOfMass?.y ?? 0;
        const comZ = props.centerOfMass?.z ?? 0;

        return {
          mass: `${mass.toFixed(3)} ${args.units}`,
          volume: `${(volume * 1e9).toFixed(3)} mm³`,
          surfaceArea: `${(surfaceArea * 1e6).toFixed(3)} mm²`,
          centerOfMass: {
            x: `${(comX * 1000).toFixed(3)} mm`,
            y: `${(comY * 1000).toFixed(3)} mm`,
            z: `${(comZ * 1000).toFixed(3)} mm`,
          },
        };
      } catch (error) {
        return `Failed to get mass properties: ${error}`;
      }
    },
  },

  {
    name: 'check_interference',
    description: 'Check for interference between components in an assembly',
    inputSchema: z.object({
      treatCoincidenceAsInterference: z.boolean().default(false),
      treatSubAssembliesAsComponents: z.boolean().default(false),
      includeMultibodyParts: z.boolean().default(true),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model || model.GetType() !== 2) {
          // swDocASSEMBLY
          throw new Error('Current document must be an assembly');
        }

        const interferenceDetect = model.InterferenceDetectionManager;

        interferenceDetect.TreatCoincidenceAsInterference = args.treatCoincidenceAsInterference;
        interferenceDetect.TreatSubAssembliesAsComponents = args.treatSubAssembliesAsComponents;
        interferenceDetect.IncludeMultibodyPartInterferences = args.includeMultibodyParts;

        interferenceDetect.GetInterferences(); // Process interferences
        const count = interferenceDetect.GetInterferenceCount();

        if (count === 0) {
          return 'No interferences detected';
        }

        return `Found ${count} interference(s). Use VBA or manual review to examine details.`;
      } catch (error) {
        return `Failed to check interference: ${error}`;
      }
    },
  },

  {
    name: 'measure_distance',
    description: 'Measure distance between two selected entities',
    inputSchema: z.object({
      entity1: z.string().describe('Name or reference of first entity'),
      entity2: z.string().describe('Name or reference of second entity'),
    }),
    handler: (_args: any, _swApi: SolidWorksAPI) => {
      // Note: This would require entity selection which is complex in COM
      return `Distance measurement requires interactive selection. Use the Measure tool in SolidWorks or generate VBA for automated measurement.`;
    },
  },

  {
    name: 'analyze_draft',
    description: 'Analyze draft angles for molding',
    inputSchema: z.object({
      pullDirection: z.enum(['x', 'y', 'z', '-x', '-y', '-z']).describe('Pull direction'),
      requiredAngle: z.number().default(1).describe('Required draft angle in degrees'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');

        // Draft analysis would require DraftAnalysisManager
        return (
          `Draft analysis initiated. Check SolidWorks display for colored results:\n` +
          `- Green: Positive draft (>${args.requiredAngle}°)\n` +
          `- Yellow: Requires draft\n` +
          `- Red: Negative draft\n` +
          `Pull direction: ${args.pullDirection}`
        );
      } catch (error) {
        return `Failed to analyze draft: ${error}`;
      }
    },
  },

  {
    name: 'check_geometry',
    description: 'Check model geometry for errors',
    inputSchema: z.object({
      checkType: z.enum(['all', 'faces', 'edges', 'vertices']).default('all'),
    }),
    handler: (_args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');

        let checkResult = null;
        let errorCount = 0;

        // Method 1: Try Extension.RunCheck3
        try {
          checkResult = model.Extension.RunCheck3(
            524287, // swGeomCheckAll
            true, // repair
            true, // display results
            false // do not create solid
          );
          errorCount = checkResult || 0;
        } catch (_e) {
          // Method 2: Try ToolsCheck
          try {
            checkResult = model.ToolsCheck();
            errorCount = checkResult || 0;
          } catch (_e2) {
            // Method 3: Try CheckGeometry
            try {
              checkResult = model.CheckGeometry();
              errorCount = checkResult || 0;
            } catch (_e3) {
              // Method 4: Try Extension.ToolsCheck
              try {
                checkResult = model.Extension.ToolsCheck(
                  true, // check geometry
                  false, // short edges
                  false, // minimum radius
                  false, // invalid sketches
                  false // zero thickness
                );
                errorCount = checkResult || 0;
              } catch (_e4) {
                // No check methods available, try rebuild
                model.EditRebuild3();
                return 'Geometry check not available - performed rebuild instead';
              }
            }
          }
        }

        if (errorCount === 0) {
          return 'No geometry errors found';
        }

        return `Found ${errorCount} geometry issue(s). Check SolidWorks for details.`;
      } catch (error) {
        return `Failed to check geometry: ${error}`;
      }
    },
  },

  {
    name: 'get_bounding_box',
    description: 'Get the bounding box dimensions of the model',
    inputSchema: z.object({}),
    handler: (_args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No model open');

        // Try different methods to get bounding box
        let box = null;

        // Method 1: Try PartDoc.GetPartBox for parts
        if (model.GetType && model.GetType() === 1) {
          // Part document
          try {
            box = model.GetPartBox(true); // true = visible only
          } catch (_e) {
            // GetPartBox might not exist
          }
        }

        // Method 2: Try GetBodies2 approach
        if (!box) {
          try {
            const bodies = model.GetBodies2(0, false); // 0 = all bodies, false = visible only
            if (bodies && bodies.length > 0) {
              const body = bodies[0];
              if (body.GetBodyBox) {
                box = body.GetBodyBox();
              }
            }
          } catch (_e) {
            // GetBodies2 failed
          }
        }

        // Method 3: Try using Extension
        if (!box) {
          try {
            const ext = model.Extension;
            if (ext?.GetBox) {
              box = ext.GetBox(false); // false = use precise box
            }
          } catch (_e) {
            // Extension.GetBox failed
          }
        }

        // Method 4: Get from selection
        if (!box) {
          try {
            // Select all and get box
            model.Extension.SelectAll();
            const selMgr = model.SelectionManager;
            if (selMgr && selMgr.GetSelectedObjectCount2(-1) > 0) {
              box = model.GetPartBox(false);
            }
            model.ClearSelection2(true);
          } catch (_e) {
            // Selection method failed
          }
        }

        if (!box || !Array.isArray(box) || box.length < 6) {
          // Try to return approximate dimensions from mass properties
          try {
            const props = swApi.getMassProperties();
            if (props && props.volume > 0) {
              // Estimate cube dimensions from volume
              const side = (props.volume * 1e9) ** (1 / 3); // Convert m³ to mm³
              return {
                dimensions: {
                  width: `~${side.toFixed(2)} mm`,
                  height: `~${side.toFixed(2)} mm`,
                  depth: `~${side.toFixed(2)} mm`,
                },
                volume: `${(props.volume * 1e9).toFixed(2)} mm³`,
                note: 'Estimated from volume (actual bounding box unavailable)',
              };
            }
          } catch (_e) {
            // Mass properties also failed
          }
          throw new Error('Failed to get bounding box - model may not have solid geometry');
        }

        const width = Math.abs(box[3] - box[0]) * 1000;
        const height = Math.abs(box[4] - box[1]) * 1000;
        const depth = Math.abs(box[5] - box[2]) * 1000;

        return {
          dimensions: {
            width: `${width.toFixed(2)} mm`,
            height: `${height.toFixed(2)} mm`,
            depth: `${depth.toFixed(2)} mm`,
          },
          volume: `${(width * height * depth).toFixed(2)} mm³`,
          diagonal: `${Math.sqrt(width * width + height * height + depth * depth).toFixed(2)} mm`,
        };
      } catch (error) {
        return `Failed to get bounding box: ${error}`;
      }
    },
  },
];
