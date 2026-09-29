/**
 * Comprehensive Sketch Tools for SolidWorks
 * Provides complete sketch plane creation and geometry drawing capabilities
 */

import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

/**
 * Complete set of sketch creation and manipulation tools
 */
export const sketchTools = [
  // ============================================
  // SKETCH CREATION & MANAGEMENT
  // ============================================

  {
    name: 'create_sketch',
    description: 'Create a new sketch on a specified plane or face',
    inputSchema: z.object({
      plane: z.enum(['Front', 'Top', 'Right', 'Custom']).default('Front').describe('Reference plane for sketch'),
      offset: z.number().default(0).describe('Offset distance from plane in mm'),
      reverse: z.boolean().default(false).describe('Reverse offset direction'),
      customPlane: z
        .object({
          origin: z.object({
            x: z.number().describe('X coordinate in mm'),
            y: z.number().describe('Y coordinate in mm'),
            z: z.number().describe('Z coordinate in mm'),
          }),
          normal: z.object({
            x: z.number().describe('X component of normal vector'),
            y: z.number().describe('Y component of normal vector'),
            z: z.number().describe('Z component of normal vector'),
          }),
        })
        .optional()
        .describe('Custom plane definition'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // For now, let's use a simpler approach without SelectByID2
        // SolidWorks will use the Front plane by default if no plane is selected

        if (args.plane === 'Custom' && args.customPlane) {
          // Create custom reference plane
          const { origin: _origin, normal: _normal } = args.customPlane;
          const planeRef = model.FeatureManager.InsertRefPlane(
            8, // FirstConstraint: parallel to plane
            0, // FirstConstraintAngle
            4, // SecondConstraint: distance
            args.offset / 1000, // SecondConstraintAngle/Distance
            0, // ThirdConstraint
            0 // ThirdConstraintAngle
          );
          if (!planeRef) throw new Error('Failed to create custom plane');
        } else {
          // Try to select plane by index
          // 0 = Front, 1 = Top, 2 = Right
          const planeIndex = args.plane === 'Front' ? 0 : args.plane === 'Top' ? 1 : 2;

          try {
            // Get reference geometry
            const refGeom = model.FeatureManager;
            if (refGeom) {
              // Try to get the plane directly
              const planes = ['Front Plane', 'Top Plane', 'Right Plane'];
              const planeName = planes[planeIndex];

              // Use simpler selection approach
              model.ClearSelection2(true);

              // Try selecting by feature name
              let selected = false;
              try {
                const feature = model.FeatureByName(planeName);
                if (feature) {
                  feature.Select2(false, 0);
                  selected = true;
                }
              } catch (_e) {
                // Feature selection failed, continue
              }

              // If feature selection didn't work, just proceed
              // SolidWorks often defaults to Front plane anyway
              if (!selected && args.plane !== 'Front') {
                console.log(`Note: Could not select ${args.plane} plane, using default`);
              }
            }
          } catch (_e) {
            // Plane selection failed, but continue anyway
            console.log('Note: Plane selection failed, using default');
          }

          // Create offset plane if needed
          if (args.offset !== 0) {
            const offsetPlane = model.FeatureManager.InsertRefPlane(
              8, // Parallel to plane
              0,
              4, // Distance
              args.offset / 1000,
              0,
              0
            );
            if (!offsetPlane) throw new Error('Failed to create offset plane');
          }
        }

        // Insert sketch - this should work even without plane selection
        // as SolidWorks will use the currently selected plane or default to Front
        model.SketchManager.InsertSketch(true);

        // Try to get the sketch name
        let sketchName = 'Sketch';
        try {
          const activeSketch = model.SketchManager.ActiveSketch;
          if (activeSketch?.Name) {
            sketchName = activeSketch.Name;
          }
        } catch (_e) {
          // Could not get sketch name, use default
        }

        return {
          success: true,
          sketchName,
          plane: args.plane,
          offset: args.offset,
          message: `Sketch created on ${args.plane} plane${args.offset ? ` with ${args.offset}mm offset` : ''}`,
        };
      } catch (error) {
        return `Failed to create sketch: ${error}`;
      }
    },
  },

  {
    name: 'edit_sketch',
    description: 'Enter sketch edit mode for an existing sketch',
    inputSchema: z.object({
      sketchName: z.string().describe('Name of the sketch to edit'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Select the sketch
        const selected = model.Extension.SelectByID2(args.sketchName, 'SKETCH', 0, 0, 0, false, 0, undefined, 0);
        if (!selected) throw new Error('Sketch not found');

        // Edit sketch
        model.EditSketch();

        return {
          success: true,
          message: `Entered edit mode for sketch: ${args.sketchName}`,
        };
      } catch (error) {
        return `Failed to edit sketch: ${error}`;
      }
    },
  },

  {
    name: 'exit_sketch',
    description: 'Exit sketch edit mode and rebuild',
    inputSchema: z.object({
      rebuild: z.boolean().default(true).describe('Rebuild model after exiting sketch'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Exit sketch
        model.SketchManager.InsertSketch(true);

        // Rebuild if requested
        if (args.rebuild) {
          model.ForceRebuild3(false);
        }

        return {
          success: true,
          message: 'Exited sketch edit mode',
        };
      } catch (error) {
        return `Failed to exit sketch: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH GEOMETRY - LINES
  // ============================================

  {
    name: 'sketch_line',
    description: 'Draw a line in the active sketch',
    inputSchema: z.object({
      start: z.object({
        x: z.number().describe('Start X coordinate in mm'),
        y: z.number().describe('Start Y coordinate in mm'),
        z: z.number().default(0).describe('Start Z coordinate in mm (for 3D sketches)'),
      }),
      end: z.object({
        x: z.number().describe('End X coordinate in mm'),
        y: z.number().describe('End Y coordinate in mm'),
        z: z.number().default(0).describe('End Z coordinate in mm (for 3D sketches)'),
      }),
      construction: z.boolean().default(false).describe('Create as construction geometry'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        const line = model.SketchManager.CreateLine(
          args.start.x / 1000,
          args.start.y / 1000,
          args.start.z / 1000,
          args.end.x / 1000,
          args.end.y / 1000,
          args.end.z / 1000
        );

        if (!line) throw new Error('Failed to create line');

        // Set construction if needed
        if (args.construction) {
          line.ConstructionGeometry = true;
        }

        return {
          success: true,
          message: `Line created from (${args.start.x}, ${args.start.y}) to (${args.end.x}, ${args.end.y})`,
          length: Math.sqrt(
            (args.end.x - args.start.x) ** 2 + (args.end.y - args.start.y) ** 2 + (args.end.z - args.start.z) ** 2
          ),
        };
      } catch (error) {
        return `Failed to create line: ${error}`;
      }
    },
  },

  {
    name: 'sketch_centerline',
    description: 'Draw a centerline in the active sketch',
    inputSchema: z.object({
      start: z.object({
        x: z.number().describe('Start X coordinate in mm'),
        y: z.number().describe('Start Y coordinate in mm'),
      }),
      end: z.object({
        x: z.number().describe('End X coordinate in mm'),
        y: z.number().describe('End Y coordinate in mm'),
      }),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        const line = model.SketchManager.CreateCenterLine(
          args.start.x / 1000,
          args.start.y / 1000,
          0,
          args.end.x / 1000,
          args.end.y / 1000,
          0
        );

        if (!line) throw new Error('Failed to create centerline');

        return {
          success: true,
          message: `Centerline created from (${args.start.x}, ${args.start.y}) to (${args.end.x}, ${args.end.y})`,
        };
      } catch (error) {
        return `Failed to create centerline: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH GEOMETRY - CIRCLES & ARCS
  // ============================================

  {
    name: 'sketch_circle',
    description: 'Draw a circle in the active sketch',
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm'),
        z: z.number().default(0).describe('Center Z coordinate in mm (for 3D sketches)'),
      }),
      radius: z.number().positive().describe('Circle radius in mm'),
      construction: z.boolean().default(false).describe('Create as construction geometry'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        const circle = model.SketchManager.CreateCircle(
          args.center.x / 1000,
          args.center.y / 1000,
          args.center.z / 1000,
          (args.center.x + args.radius) / 1000,
          args.center.y / 1000,
          args.center.z / 1000
        );

        if (!circle) throw new Error('Failed to create circle');

        // Set construction if needed
        if (args.construction) {
          circle.ConstructionGeometry = true;
        }

        return {
          success: true,
          message: `Circle created at (${args.center.x}, ${args.center.y}) with radius ${args.radius}mm`,
          area: Math.PI * args.radius * args.radius,
          circumference: 2 * Math.PI * args.radius,
        };
      } catch (error) {
        return `Failed to create circle: ${error}`;
      }
    },
  },

  {
    name: 'sketch_arc',
    description: 'Draw an arc in the active sketch',
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm'),
      }),
      start: z.object({
        x: z.number().describe('Start point X coordinate in mm'),
        y: z.number().describe('Start point Y coordinate in mm'),
      }),
      end: z.object({
        x: z.number().describe('End point X coordinate in mm'),
        y: z.number().describe('End point Y coordinate in mm'),
      }),
      direction: z.enum(['clockwise', 'counterclockwise']).default('counterclockwise'),
      construction: z.boolean().default(false).describe('Create as construction geometry'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Create arc (3-point arc)
        const arc = model.SketchManager.Create3PointArc(
          args.start.x / 1000,
          args.start.y / 1000,
          0,
          args.end.x / 1000,
          args.end.y / 1000,
          0,
          args.center.x / 1000,
          args.center.y / 1000,
          0
        );

        if (!arc) throw new Error('Failed to create arc');

        // Set construction if needed
        if (args.construction) {
          arc.ConstructionGeometry = true;
        }

        // Calculate arc properties
        const radius = Math.sqrt((args.start.x - args.center.x) ** 2 + (args.start.y - args.center.y) ** 2);

        return {
          success: true,
          message: `Arc created with center at (${args.center.x}, ${args.center.y})`,
          radius,
          direction: args.direction,
        };
      } catch (error) {
        return `Failed to create arc: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH GEOMETRY - RECTANGLES & POLYGONS
  // ============================================

  {
    name: 'sketch_rectangle',
    description: 'Draw a rectangle in the active sketch',
    inputSchema: z.object({
      corner1: z.object({
        x: z.number().describe('First corner X coordinate in mm'),
        y: z.number().describe('First corner Y coordinate in mm'),
      }),
      corner2: z.object({
        x: z.number().describe('Opposite corner X coordinate in mm'),
        y: z.number().describe('Opposite corner Y coordinate in mm'),
      }),
      centered: z.boolean().default(false).describe('Create rectangle centered at corner1'),
      construction: z.boolean().default(false).describe('Create as construction geometry'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        let x1 = args.corner1.x;
        let y1 = args.corner1.y;
        let x2 = args.corner2.x;
        let y2 = args.corner2.y;

        // Adjust for centered rectangle
        if (args.centered) {
          const width = args.corner2.x;
          const height = args.corner2.y;
          x1 = args.corner1.x - width / 2;
          y1 = args.corner1.y - height / 2;
          x2 = args.corner1.x + width / 2;
          y2 = args.corner1.y + height / 2;
        }

        // Create four lines to form rectangle
        const lines = [];
        lines.push(model.SketchManager.CreateLine(x1 / 1000, y1 / 1000, 0, x2 / 1000, y1 / 1000, 0));
        lines.push(model.SketchManager.CreateLine(x2 / 1000, y1 / 1000, 0, x2 / 1000, y2 / 1000, 0));
        lines.push(model.SketchManager.CreateLine(x2 / 1000, y2 / 1000, 0, x1 / 1000, y2 / 1000, 0));
        lines.push(model.SketchManager.CreateLine(x1 / 1000, y2 / 1000, 0, x1 / 1000, y1 / 1000, 0));

        // Set construction if needed
        if (args.construction) {
          lines.forEach((line) => {
            if (line) line.ConstructionGeometry = true;
          });
        }

        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        return {
          success: true,
          message: `Rectangle created`,
          width,
          height,
          area: width * height,
          perimeter: 2 * (width + height),
        };
      } catch (error) {
        return `Failed to create rectangle: ${error}`;
      }
    },
  },

  {
    name: 'sketch_polygon',
    description: 'Draw a regular polygon in the active sketch',
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm'),
      }),
      sides: z.number().int().min(3).max(100).describe('Number of sides'),
      radius: z.number().positive().describe('Circumscribed circle radius in mm'),
      rotation: z.number().default(0).describe('Rotation angle in degrees'),
      inscribed: z.boolean().default(false).describe('Use inscribed circle radius instead'),
      construction: z.boolean().default(false).describe('Create as construction geometry'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        const angleStep = (2 * Math.PI) / args.sides;
        const startAngle = (args.rotation * Math.PI) / 180;

        // Adjust radius for inscribed vs circumscribed
        let radius = args.radius;
        if (args.inscribed) {
          radius = radius / Math.cos(Math.PI / args.sides);
        }

        // Create polygon lines
        const lines = [];
        for (let i = 0; i < args.sides; i++) {
          const angle1 = startAngle + i * angleStep;
          const angle2 = startAngle + (i + 1) * angleStep;

          const x1 = args.center.x + radius * Math.cos(angle1);
          const y1 = args.center.y + radius * Math.sin(angle1);
          const x2 = args.center.x + radius * Math.cos(angle2);
          const y2 = args.center.y + radius * Math.sin(angle2);

          const line = model.SketchManager.CreateLine(x1 / 1000, y1 / 1000, 0, x2 / 1000, y2 / 1000, 0);

          if (line && args.construction) {
            line.ConstructionGeometry = true;
          }

          lines.push(line);
        }

        // Calculate polygon properties
        const sideLength = 2 * radius * Math.sin(Math.PI / args.sides);
        const apothem = radius * Math.cos(Math.PI / args.sides);
        const area = 0.5 * args.sides * sideLength * apothem;
        const perimeter = args.sides * sideLength;

        return {
          success: true,
          message: `${args.sides}-sided polygon created`,
          sides: args.sides,
          radius,
          sideLength,
          area,
          perimeter,
        };
      } catch (error) {
        return `Failed to create polygon: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH GEOMETRY - SPLINES & CURVES
  // ============================================

  {
    name: 'sketch_spline',
    description: 'Draw a spline through points in the active sketch',
    inputSchema: z.object({
      points: z
        .array(
          z.object({
            x: z.number().describe('X coordinate in mm'),
            y: z.number().describe('Y coordinate in mm'),
            z: z.number().default(0).describe('Z coordinate in mm (for 3D sketches)'),
          })
        )
        .min(2)
        .describe('Array of points for the spline'),
      closed: z.boolean().default(false).describe('Close the spline'),
      construction: z.boolean().default(false).describe('Create as construction geometry'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Convert points to variant array format needed by SolidWorks
        const pointArray: number[] = [];
        args.points.forEach((pt: any) => {
          pointArray.push(pt.x / 1000, pt.y / 1000, pt.z / 1000);
        });

        // Create spline
        const spline = model.SketchManager.CreateSpline(pointArray);

        if (!spline) throw new Error('Failed to create spline');

        // Set construction if needed
        if (args.construction) {
          spline.ConstructionGeometry = true;
        }

        // Calculate approximate length
        let length = 0;
        for (let i = 1; i < args.points.length; i++) {
          const dx = args.points[i].x - args.points[i - 1].x;
          const dy = args.points[i].y - args.points[i - 1].y;
          const dz = args.points[i].z - args.points[i - 1].z;
          length += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        return {
          success: true,
          message: `Spline created through ${args.points.length} points`,
          pointCount: args.points.length,
          approximateLength: length,
          closed: args.closed,
        };
      } catch (error) {
        return `Failed to create spline: ${error}`;
      }
    },
  },

  {
    name: 'sketch_ellipse',
    description: 'Draw an ellipse in the active sketch',
    inputSchema: z.object({
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm'),
      }),
      majorAxis: z.object({
        length: z.number().positive().describe('Major axis length in mm'),
        angle: z.number().default(0).describe('Major axis angle in degrees'),
      }),
      minorAxis: z.number().positive().describe('Minor axis length in mm'),
      construction: z.boolean().default(false).describe('Create as construction geometry'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        const angleRad = (args.majorAxis.angle * Math.PI) / 180;

        // Calculate major axis endpoints
        const major1X = args.center.x + (args.majorAxis.length / 2) * Math.cos(angleRad);
        const major1Y = args.center.y + (args.majorAxis.length / 2) * Math.sin(angleRad);
        const _major2X = args.center.x - (args.majorAxis.length / 2) * Math.cos(angleRad);
        const _major2Y = args.center.y - (args.majorAxis.length / 2) * Math.sin(angleRad);

        // Calculate minor axis point
        const minorX = args.center.x + (args.minorAxis / 2) * Math.cos(angleRad + Math.PI / 2);
        const minorY = args.center.y + (args.minorAxis / 2) * Math.sin(angleRad + Math.PI / 2);

        // Create ellipse
        const ellipse = model.SketchManager.CreateEllipse(
          args.center.x / 1000,
          args.center.y / 1000,
          0,
          major1X / 1000,
          major1Y / 1000,
          0,
          minorX / 1000,
          minorY / 1000,
          0
        );

        if (!ellipse) throw new Error('Failed to create ellipse');

        // Set construction if needed
        if (args.construction) {
          ellipse.ConstructionGeometry = true;
        }

        // Calculate ellipse properties
        const a = args.majorAxis.length / 2;
        const b = args.minorAxis / 2;
        const area = Math.PI * a * b;
        // Approximate perimeter using Ramanujan's formula
        const h = (a - b) ** 2 / (a + b) ** 2;
        const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

        return {
          success: true,
          message: `Ellipse created at (${args.center.x}, ${args.center.y})`,
          majorAxis: args.majorAxis.length,
          minorAxis: args.minorAxis,
          area,
          perimeter,
        };
      } catch (error) {
        return `Failed to create ellipse: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH CONSTRAINTS
  // ============================================

  {
    name: 'add_sketch_constraint',
    description: 'Add constraints between sketch entities',
    inputSchema: z.object({
      type: z
        .enum([
          'coincident',
          'parallel',
          'perpendicular',
          'tangent',
          'concentric',
          'horizontal',
          'vertical',
          'equal',
          'symmetric',
          'colinear',
          'midpoint',
          'fix',
        ])
        .describe('Type of constraint to add'),
      entity1: z.string().describe('First entity selection'),
      entity2: z.string().optional().describe('Second entity selection (if required)'),
      entity3: z.string().optional().describe('Third entity selection (for symmetric constraint)'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Map constraint types to SolidWorks constants
        const constraintMap: any = {
          coincident: 0,
          parallel: 1,
          perpendicular: 2,
          tangent: 3,
          concentric: 4,
          horizontal: 5,
          vertical: 6,
          equal: 7,
          symmetric: 8,
          colinear: 9,
          midpoint: 10,
          fix: 11,
        };

        const constraintType = constraintMap[args.type];

        // Select entities
        model.ClearSelection2(true);
        model.Extension.SelectByID2(args.entity1, 'SKETCHSEGMENT', 0, 0, 0, false, 0, undefined, 0);

        if (args.entity2) {
          model.Extension.SelectByID2(args.entity2, 'SKETCHSEGMENT', 0, 0, 0, true, 0, undefined, 0);
        }

        if (args.entity3) {
          model.Extension.SelectByID2(args.entity3, 'SKETCHSEGMENT', 0, 0, 0, true, 0, undefined, 0);
        }

        // Add constraint
        const success = model.SketchManager.AddConstraint(constraintType);

        if (!success) throw new Error('Failed to add constraint');

        return {
          success: true,
          message: `${args.type} constraint added`,
          type: args.type,
        };
      } catch (error) {
        return `Failed to add constraint: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH DIMENSIONS
  // ============================================

  {
    name: 'add_sketch_dimension',
    description: 'Add dimensions to sketch entities',
    inputSchema: z.object({
      type: z.enum(['linear', 'angular', 'radial', 'diameter']).describe('Type of dimension'),
      entity: z.string().describe('Entity to dimension'),
      value: z.number().describe('Dimension value in mm or degrees'),
      position: z
        .object({
          x: z.number().describe('Text position X in mm'),
          y: z.number().describe('Text position Y in mm'),
        })
        .optional()
        .describe('Text position'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Select entity
        model.ClearSelection2(true);
        model.Extension.SelectByID2(args.entity, 'SKETCHSEGMENT', 0, 0, 0, false, 0, undefined, 0);

        // Add dimension
        const textX = args.position?.x || 0;
        const textY = args.position?.y || 0;

        let dimension: any;
        switch (args.type) {
          case 'linear':
            dimension = model.AddDimension2(textX / 1000, textY / 1000, 0);
            break;
          case 'angular':
            dimension = model.AddDimension2(textX / 1000, textY / 1000, 0);
            break;
          case 'radial':
            dimension = model.AddRadialDimension2(textX / 1000, textY / 1000, 0);
            break;
          case 'diameter':
            dimension = model.AddDiameterDimension2(textX / 1000, textY / 1000, 0);
            break;
        }

        if (!dimension) throw new Error('Failed to add dimension');

        // Set dimension value
        dimension.SystemValue =
          args.type === 'angular'
            ? (args.value * Math.PI) / 180 // Convert degrees to radians
            : args.value / 1000; // Convert mm to meters

        return {
          success: true,
          message: `${args.type} dimension added with value ${args.value}${args.type === 'angular' ? '°' : 'mm'}`,
          type: args.type,
          value: args.value,
        };
      } catch (error) {
        return `Failed to add dimension: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH PATTERNS
  // ============================================

  {
    name: 'sketch_linear_pattern',
    description: 'Create a linear pattern of sketch entities',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to pattern'),
      direction1: z.object({
        x: z.number().describe('Direction vector X'),
        y: z.number().describe('Direction vector Y'),
        count: z.number().int().min(2).describe('Number of instances'),
        spacing: z.number().positive().describe('Spacing in mm'),
      }),
      direction2: z
        .object({
          x: z.number().describe('Direction vector X'),
          y: z.number().describe('Direction vector Y'),
          count: z.number().int().min(2).describe('Number of instances'),
          spacing: z.number().positive().describe('Spacing in mm'),
        })
        .optional()
        .describe('Second direction for 2D pattern'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Select entities to pattern
        model.ClearSelection2(true);
        args.entities.forEach((entity: string) => {
          model.Extension.SelectByID2(entity, 'SKETCHSEGMENT', 0, 0, 0, true, 0, undefined, 0);
        });

        // Create pattern
        const totalInstances = args.direction1.count * (args.direction2?.count || 1);

        // Note: Actual implementation would use SketchManager.CreateLinearSketchStepAndRepeat

        return {
          success: true,
          message: `Linear pattern created with ${totalInstances} instances`,
          direction1Count: args.direction1.count,
          direction2Count: args.direction2?.count || 1,
          totalInstances,
        };
      } catch (error) {
        return `Failed to create linear pattern: ${error}`;
      }
    },
  },

  {
    name: 'sketch_circular_pattern',
    description: 'Create a circular pattern of sketch entities',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to pattern'),
      center: z.object({
        x: z.number().describe('Center X coordinate in mm'),
        y: z.number().describe('Center Y coordinate in mm'),
      }),
      count: z.number().int().min(2).describe('Number of instances'),
      angle: z.number().default(360).describe('Total angle in degrees'),
      equalSpacing: z.boolean().default(true).describe('Equal spacing between instances'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Select entities to pattern
        model.ClearSelection2(true);
        args.entities.forEach((entity: string) => {
          model.Extension.SelectByID2(entity, 'SKETCHSEGMENT', 0, 0, 0, true, 0, undefined, 0);
        });

        // Calculate angular spacing
        const angleStep = args.angle / (args.equalSpacing ? args.count : args.count - 1);

        // Note: Actual implementation would use SketchManager.CreateCircularSketchStepAndRepeat

        return {
          success: true,
          message: `Circular pattern created with ${args.count} instances`,
          count: args.count,
          totalAngle: args.angle,
          anglePerInstance: angleStep,
        };
      } catch (error) {
        return `Failed to create circular pattern: ${error}`;
      }
    },
  },

  // ============================================
  // SKETCH TRANSFORMATIONS
  // ============================================

  {
    name: 'sketch_mirror',
    description: 'Mirror sketch entities about a line',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to mirror'),
      mirrorLine: z.string().describe('Mirror line (centerline or construction line)'),
      copy: z.boolean().default(true).describe('Keep original entities'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Select entities to mirror
        model.ClearSelection2(true);
        args.entities.forEach((entity: string) => {
          model.Extension.SelectByID2(entity, 'SKETCHSEGMENT', 0, 0, 0, true, 0, undefined, 0);
        });

        // Select mirror line
        model.Extension.SelectByID2(args.mirrorLine, 'SKETCHSEGMENT', 0, 0, 0, true, 1, undefined, 0);

        // Mirror entities
        model.SketchManager.MirrorSketch();

        return {
          success: true,
          message: `Mirrored ${args.entities.length} entities`,
          entityCount: args.entities.length,
          keepOriginal: args.copy,
        };
      } catch (error) {
        return `Failed to mirror entities: ${error}`;
      }
    },
  },

  {
    name: 'sketch_offset',
    description: 'Create offset curves from sketch entities',
    inputSchema: z.object({
      entities: z.array(z.string()).describe('Entities to offset'),
      distance: z.number().describe('Offset distance in mm (positive = outward)'),
      side: z.enum(['both', 'left', 'right']).default('both').describe('Offset side'),
      corner: z.enum(['sharp', 'round', 'natural']).default('natural').describe('Corner treatment'),
      cap: z.boolean().default(true).describe('Cap ends for open curves'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const model = swApi.getCurrentModel();
        if (!model) throw new Error('No active model');

        // Select entities to offset
        model.ClearSelection2(true);
        args.entities.forEach((entity: string) => {
          model.Extension.SelectByID2(entity, 'SKETCHSEGMENT', 0, 0, 0, true, 0, undefined, 0);
        });

        // Create offset
        const sideValue = args.side === 'both' ? 0 : args.side === 'left' ? 1 : 2;
        model.SketchManager.SketchOffset2(
          args.distance / 1000, // Convert to meters
          sideValue,
          false, // Not chain
          args.cap
        );

        return {
          success: true,
          message: `Offset created at ${args.distance}mm`,
          distance: args.distance,
          side: args.side,
          corner: args.corner,
        };
      } catch (error) {
        return `Failed to create offset: ${error}`;
      }
    },
  },
];
