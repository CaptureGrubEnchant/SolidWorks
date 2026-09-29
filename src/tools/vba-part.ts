import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

/**
 * VBA Generation for Part Modeling Operations
 * Comprehensive SolidWorks part modeling automation
 */

export const partModelingVBATools = [
  {
    name: 'vba_create_reference_geometry',
    description: 'Generate VBA for creating reference geometry (planes, axes, points)',
    inputSchema: z.object({
      geometryType: z.enum(['plane', 'axis', 'point', 'coordinate_system']),
      referenceType: z.enum(['offset', 'angle', 'parallel', 'perpendicular', 'midplane', '3points']),
      references: z.array(z.string()).describe('Names of reference entities'),
      offset: z.number().optional().describe('Offset distance in mm'),
      angle: z.number().optional().describe('Angle in degrees'),
      flipDirection: z.boolean().optional(),
    }),
    handler: (args: any, _swApi: SolidWorksAPI) => {
      const templates: Record<string, string> = {
        plane: `
Sub CreateReferencePlane()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swRefPlane As SldWorks.RefPlane
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "No active document found"
        Exit Sub
    End If
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select reference entities
    ${args.references
      .map(
        (ref: string, i: number) => `
    swModel.ClearSelection2 True
    swModel.Extension.SelectByID2 "${ref}", "PLANE", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 0, Nothing, 0`
      )
      .join('')}
    
    ' Create reference plane
    ${
      args.referenceType === 'offset'
        ? `
    Set swRefPlane = swFeatureMgr.InsertRefPlane( _
        swRefPlaneReferenceConstraint_Distance, ${args.offset || 10} / 1000, _
        0, 0, 0, 0)`
        : ''
    }
    ${
      args.referenceType === 'angle'
        ? `
    Set swRefPlane = swFeatureMgr.InsertRefPlane( _
        swRefPlaneReferenceConstraint_Angle, ${args.angle || 45} * 3.14159 / 180, _
        0, 0, 0, 0)`
        : ''
    }
    ${
      args.referenceType === 'parallel'
        ? `
    Set swRefPlane = swFeatureMgr.InsertRefPlane( _
        swRefPlaneReferenceConstraint_Parallel, 0, _
        0, 0, 0, 0)`
        : ''
    }
    
    If Not swRefPlane Is Nothing Then
        MsgBox "Reference plane created successfully"
    Else
        MsgBox "Failed to create reference plane"
    End If
    
    swModel.ClearSelection2 True
End Sub`,
        axis: `
Sub CreateReferenceAxis()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select reference entities for axis
    ${args.references
      .map(
        (ref: string, i: number) => `
    swModel.Extension.SelectByID2 "${ref}", "PLANE", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 0, Nothing, 0`
      )
      .join('')}
    
    ' Create axis
    Set swFeature = swFeatureMgr.InsertAxis2(True)
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "Reference Axis"
        MsgBox "Reference axis created: " & swFeature.Name
    End If
End Sub`,
        point: `
Sub CreateReferencePoint()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swRefPoint As SldWorks.RefPoint
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select reference for point
    ${args.references
      .map(
        (ref: string) => `
    swModel.Extension.SelectByID2 "${ref}", "", 0, 0, 0, False, 0, Nothing, 0`
      )
      .join('')}
    
    ' Create reference point
    Set swRefPoint = swFeatureMgr.InsertReferencePoint(4, 0, ${args.offset || 0} / 1000, 1)
    
    If Not swRefPoint Is Nothing Then
        MsgBox "Reference point created"
    End If
End Sub`,
      };

      return templates[args.geometryType] || 'Geometry type not supported';
    },
  },

  {
    name: 'vba_advanced_features',
    description: 'Generate VBA for advanced features (sweep, loft, boundary)',
    inputSchema: z.object({
      featureType: z.enum(['sweep', 'loft', 'boundary', 'wrap', 'flex', 'deform']),
      profiles: z.array(z.string()).describe('Sketch names for profiles'),
      guideCurves: z.array(z.string()).optional().describe('Guide curve names'),
      path: z.string().optional().describe('Path for sweep'),
      twistAngle: z.number().optional(),
      thinFeature: z.boolean().optional(),
      thickness: z.number().optional().describe('Thickness in mm for thin features'),
    }),
    handler: (args: any) => {
      const templates: Record<string, string> = {
        sweep: `
Sub CreateSweepFeature()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    Dim swSweep As SldWorks.SweepFeatureData
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select profile
    swModel.Extension.SelectByID2 "${args.profiles[0] || 'Sketch1'}", "SKETCH", 0, 0, 0, False, 1, Nothing, 0
    
    ' Select path
    swModel.Extension.SelectByID2 "${args.path || 'Sketch2'}", "SKETCH", 0, 0, 0, True, 4, Nothing, 0
    
    ${
      args.guideCurves && args.guideCurves.length > 0
        ? `
    ' Select guide curves
    ${args.guideCurves
      .map(
        (guide: string, _i: number) => `
    swModel.Extension.SelectByID2 "${guide}", "SKETCH", 0, 0, 0, True, 2, Nothing, 0`
      )
      .join('')}`
        : ''
    }
    
    ' Create sweep
    Set swSweep = swFeatureMgr.CreateDefinition(swFeatureNameID_e.swFmSweep)
    
    swSweep.TwistAngle = ${args.twistAngle || 0} * 3.14159 / 180
    swSweep.MaintainTangency = True
    swSweep.AdvancedSmoothing = True
    ${
      args.thinFeature
        ? `
    swSweep.ThinFeature = True
    swSweep.ThinWallThickness = ${args.thickness || 1} / 1000`
        : ''
    }
    
    Set swFeature = swFeatureMgr.CreateFeature(swSweep)
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "Sweep_${Date.now()}"
        MsgBox "Sweep feature created: " & swFeature.Name
    End If
End Sub`,
        loft: `
Sub CreateLoftFeature()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    Dim swLoft As SldWorks.LoftFeatureData
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select profiles
    ${args.profiles
      .map(
        (profile: string, i: number) => `
    swModel.Extension.SelectByID2 "${profile}", "SKETCH", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 1, Nothing, 0`
      )
      .join('')}
    
    ${
      args.guideCurves && args.guideCurves.length > 0
        ? `
    ' Select guide curves
    ${args.guideCurves
      .map(
        (guide: string) => `
    swModel.Extension.SelectByID2 "${guide}", "SKETCH", 0, 0, 0, True, 2, Nothing, 0`
      )
      .join('')}`
        : ''
    }
    
    ' Create loft
    Set swLoft = swFeatureMgr.CreateDefinition(swFeatureNameID_e.swFmLoft)
    
    swLoft.Merge = True
    swLoft.Close = False
    swLoft.PreserveTangency = True
    ${
      args.thinFeature
        ? `
    swLoft.ThinFeature = True
    swLoft.Thickness = ${args.thickness || 1} / 1000`
        : ''
    }
    
    Set swFeature = swFeatureMgr.CreateFeature(swLoft)
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "Loft_${Date.now()}"
        MsgBox "Loft feature created: " & swFeature.Name
    End If
End Sub`,
        boundary: `
Sub CreateBoundaryFeature()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select boundary curves in Direction 1
    ${args.profiles
      .slice(0, Math.ceil(args.profiles.length / 2))
      .map(
        (profile: string, i: number) => `
    swModel.Extension.SelectByID2 "${profile}", "SKETCH", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 1, Nothing, 0`
      )
      .join('')}
    
    ' Select boundary curves in Direction 2
    ${args.profiles
      .slice(Math.ceil(args.profiles.length / 2))
      .map(
        (profile: string) => `
    swModel.Extension.SelectByID2 "${profile}", "SKETCH", 0, 0, 0, True, 2, Nothing, 0`
      )
      .join('')}
    
    ' Create boundary surface/boss
    Set swFeature = swFeatureMgr.InsertBoundaryBoss2( _
        ${args.profiles.length}, 0, 0, 1, 1, _
        ${args.thinFeature ? 'True' : 'False'}, ${args.thinFeature ? (args.thickness || 1) / 1000 : 0})
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "Boundary_${Date.now()}"
        MsgBox "Boundary feature created: " & swFeature.Name
    End If
End Sub`,
      };

      return templates[args.featureType] || 'Feature type not supported';
    },
  },

  {
    name: 'vba_pattern_features',
    description: 'Generate VBA for pattern features',
    inputSchema: z.object({
      patternType: z.enum(['linear', 'circular', 'curve', 'fill', 'variable']),
      featureNames: z.array(z.string()).describe('Features to pattern'),
      direction1: z.object({
        spacing: z.number().describe('Spacing in mm'),
        instances: z.number(),
        reverseDirection: z.boolean().optional(),
      }),
      direction2: z
        .object({
          spacing: z.number().describe('Spacing in mm'),
          instances: z.number(),
          reverseDirection: z.boolean().optional(),
        })
        .optional(),
      axis: z.string().optional().describe('Axis for circular pattern'),
      angle: z.number().optional().describe('Total angle for circular pattern'),
      seedPoint: z.array(z.number()).optional().describe('[x, y, z] for fill pattern'),
    }),
    handler: (args: any) => {
      const templates: Record<string, string> = {
        linear: `
Sub CreateLinearPattern()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select features to pattern
    ${args.featureNames
      .map(
        (name: string, i: number) => `
    swModel.Extension.SelectByID2 "${name}", "BODYFEATURE", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 0, Nothing, 0`
      )
      .join('')}
    
    ' Select direction references
    swModel.Extension.SelectByID2 "Right Plane", "PLANE", 0, 0, 0, True, 1, Nothing, 0
    ${args.direction2 ? `swModel.Extension.SelectByID2 "Top Plane", "PLANE", 0, 0, 0, True, 2, Nothing, 0` : ''}
    
    ' Create linear pattern
    Set swFeature = swFeatureMgr.FeatureLinearPattern4( _
        ${args.direction1.instances}, ${args.direction1.spacing / 1000}, _
        ${args.direction2 ? args.direction2.instances : 1}, ${args.direction2 ? args.direction2.spacing / 1000 : 0}, _
        False, ${args.direction1.reverseDirection ? 'True' : 'False'}, _
        "NULL", "NULL", False, False, False, False, False, False, _
        True, True, False, False, 0, 0)
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "LinearPattern_${Date.now()}"
        MsgBox "Linear pattern created: " & swFeature.Name
    End If
End Sub`,
        circular: `
Sub CreateCircularPattern()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select features to pattern
    ${args.featureNames
      .map(
        (name: string, i: number) => `
    swModel.Extension.SelectByID2 "${name}", "BODYFEATURE", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 0, Nothing, 0`
      )
      .join('')}
    
    ' Select axis
    swModel.Extension.SelectByID2 "${args.axis || 'Axis1'}", "AXIS", 0, 0, 0, True, 1, Nothing, 0
    
    ' Create circular pattern
    Set swFeature = swFeatureMgr.FeatureCircularPattern5( _
        ${args.direction1.instances}, ${((args.angle || 360) * Math.PI) / 180}, _
        False, "NULL", False, True, False, False)
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "CircularPattern_${Date.now()}"
        MsgBox "Circular pattern created: " & swFeature.Name
    End If
End Sub`,
        curve: `
Sub CreateCurveDrivenPattern()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Select features to pattern
    ${args.featureNames
      .map(
        (name: string, i: number) => `
    swModel.Extension.SelectByID2 "${name}", "BODYFEATURE", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 0, Nothing, 0`
      )
      .join('')}
    
    ' Select curve
    swModel.Extension.SelectByID2 "Sketch_Curve", "SKETCH", 0, 0, 0, True, 1, Nothing, 0
    
    ' Create curve driven pattern
    Set swFeature = swFeatureMgr.InsertCurveDrivenPattern( _
        False, ${args.direction1.instances}, ${args.direction1.spacing / 1000}, _
        True, False, False, 0, True, True, _
        False, 0, 0, False, False)
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "CurvePattern_${Date.now()}"
        MsgBox "Curve driven pattern created: " & swFeature.Name
    End If
End Sub`,
      };

      return templates[args.patternType] || 'Pattern type not supported';
    },
  },

  {
    name: 'vba_sheet_metal',
    description: 'Generate VBA for sheet metal operations',
    inputSchema: z.object({
      operation: z.enum(['base_flange', 'edge_flange', 'miter_flange', 'hem', 'jog', 'fold', 'unfold']),
      thickness: z.number().describe('Material thickness in mm'),
      bendRadius: z.number().optional().describe('Bend radius in mm'),
      bendAngle: z.number().optional().describe('Bend angle in degrees'),
      kFactor: z.number().optional().default(0.5),
      reliefType: z.enum(['rectangular', 'obround', 'tear']).optional(),
      reliefRatio: z.number().optional().default(0.5),
    }),
    handler: (args: any) => {
      return `
Sub CreateSheetMetalFeature_${args.operation}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    Dim swSheetMetal As SldWorks.SheetMetalFeatureData
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "No active document"
        Exit Sub
    End If
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Initialize sheet metal parameters
    swModel.SetSheetMetalDefaultParameters _
        ${args.thickness / 1000}, ${(args.bendRadius || args.thickness) / 1000}, _
        ${args.kFactor}, ${args.reliefRatio}, _
        ${args.reliefType === 'rectangular' ? '0' : args.reliefType === 'obround' ? '1' : '2'}
    
    ${
      args.operation === 'base_flange'
        ? `
    ' Create base flange
    swModel.Extension.SelectByID2 "Sketch1", "SKETCH", 0, 0, 0, False, 0, Nothing, 0
    Set swFeature = swFeatureMgr.InsertSheetMetalBaseFlange2( _
        ${args.thickness / 1000}, False, ${(args.bendRadius || args.thickness) / 1000}, _
        0, ${args.kFactor}, True, False, True, _
        0, 0, 0, False, 0, 0, 0, 0)`
        : ''
    }
    
    ${
      args.operation === 'edge_flange'
        ? `
    ' Create edge flange
    swModel.Extension.SelectByID2 "Edge1", "EDGE", 0, 0, 0, False, 0, Nothing, 0
    Set swFeature = swFeatureMgr.InsertSheetMetalEdgeFlange2( _
        0, False, ${((args.bendAngle || 90) * Math.PI) / 180}, _
        50 / 1000, 0, 0, ${(args.bendRadius || args.thickness) / 1000}, _
        0, 0, False, False, False, False, True, _
        0, 0, 0, 0, 0)`
        : ''
    }
    
    ${
      args.operation === 'hem'
        ? `
    ' Create hem
    swModel.Extension.SelectByID2 "Edge1", "EDGE", 0, 0, 0, False, 0, Nothing, 0
    Set swFeature = swFeatureMgr.InsertSheetMetalHem2( _
        1, 1, False, ${(args.thickness * 2) / 1000}, _
        ${(args.bendRadius || args.thickness) / 1000}, 0, 0, _
        0, 0, False, False, 0)`
        : ''
    }
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "SheetMetal_${args.operation}_${Date.now()}"
        MsgBox "Sheet metal feature created: " & swFeature.Name
    Else
        MsgBox "Failed to create sheet metal feature"
    End If
End Sub`;
    },
  },

  {
    name: 'vba_surface_modeling',
    description: 'Generate VBA for surface modeling operations',
    inputSchema: z.object({
      surfaceType: z.enum(['extrude', 'revolve', 'sweep', 'loft', 'boundary', 'offset', 'thicken', 'knit']),
      sketches: z.array(z.string()).describe('Sketch names'),
      distance: z.number().optional().describe('Distance in mm'),
      angle: z.number().optional().describe('Angle in degrees'),
      offsetDistance: z.number().optional().describe('Offset distance in mm'),
      thickenDepth: z.number().optional().describe('Thicken depth in mm'),
    }),
    handler: (args: any) => {
      return `
Sub CreateSurfaceFeature_${args.surfaceType}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatureMgr As SldWorks.FeatureManager
    Dim swFeature As SldWorks.Feature
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ${
      args.surfaceType === 'extrude'
        ? `
    ' Surface extrude
    swModel.Extension.SelectByID2 "${args.sketches[0]}", "SKETCH", 0, 0, 0, False, 0, Nothing, 0
    Set swFeature = swFeatureMgr.FeatureExtruRefSurface2( _
        True, False, False, 0, 0, ${(args.distance || 10) / 1000}, 0, _
        False, False, False, False, 0, 0, False, False, False, False, False)`
        : ''
    }
    
    ${
      args.surfaceType === 'revolve'
        ? `
    ' Surface revolve
    swModel.Extension.SelectByID2 "${args.sketches[0]}", "SKETCH", 0, 0, 0, False, 0, Nothing, 0
    swModel.Extension.SelectByID2 "Axis1", "AXIS", 0, 0, 0, True, 1, Nothing, 0
    Set swFeature = swFeatureMgr.FeatureRevolve2( _
        True, True, False, False, False, False, 0, 0, _
        ${((args.angle || 360) * Math.PI) / 180}, 0, False, False, 0, 0, 0, 0, 0, True, True, True)`
        : ''
    }
    
    ${
      args.surfaceType === 'offset'
        ? `
    ' Offset surface
    swModel.Extension.SelectByID2 "Surface1", "SURFACE", 0, 0, 0, False, 0, Nothing, 0
    Set swFeature = swFeatureMgr.InsertOffsetSurface( _
        ${(args.offsetDistance || 5) / 1000}, False)`
        : ''
    }
    
    ${
      args.surfaceType === 'thicken'
        ? `
    ' Thicken surface
    swModel.Extension.SelectByID2 "Surface1", "SURFACE", 0, 0, 0, False, 0, Nothing, 0
    Set swFeature = swFeatureMgr.FeatureThicken( _
        ${(args.thickenDepth || 2) / 1000}, 0, 0, False, True, True, True)`
        : ''
    }
    
    ${
      args.surfaceType === 'knit'
        ? `
    ' Knit surfaces
    ${args.sketches
      .map(
        (sketch: string, i: number) => `
    swModel.Extension.SelectByID2 "${sketch}", "SURFACE", 0, 0, 0, ${i === 0 ? 'False' : 'True'}, 0, Nothing, 0`
      )
      .join('')}
    Set swFeature = swFeatureMgr.InsertKnitSurface2(0.0001, True, False, True)`
        : ''
    }
    
    If Not swFeature Is Nothing Then
        swFeature.Name = "Surface_${args.surfaceType}_${Date.now()}"
        MsgBox "Surface created: " & swFeature.Name
    End If
End Sub`;
    },
  },
];
