import { z } from 'zod';

/**
 * VBA Generation for Assembly Operations
 * Comprehensive SolidWorks assembly automation
 */

export const assemblyVBATools = [
  {
    name: 'vba_assembly_mates',
    description: 'Generate VBA for creating assembly mates',
    inputSchema: z.object({
      mateType: z.enum([
        'coincident',
        'parallel',
        'perpendicular',
        'tangent',
        'concentric',
        'distance',
        'angle',
        'symmetric',
        'width',
        'path',
        'linear_coupler',
        'cam',
        'gear',
        'rack_pinion',
        'screw',
        'universal_joint',
      ]),
      component1: z.string().describe('First component name'),
      face1: z.string().describe('Face/edge/vertex on first component'),
      component2: z.string().describe('Second component name'),
      face2: z.string().describe('Face/edge/vertex on second component'),
      distance: z.number().optional().describe('Distance in mm for distance mate'),
      angle: z.number().optional().describe('Angle in degrees for angle mate'),
      flip: z.boolean().optional(),
      alignmentType: z.enum(['aligned', 'anti_aligned', 'closest']).optional(),
    }),
    handler: (args: any) => {
      const mateConstants: Record<string, string> = {
        coincident: 'swMateCOINCIDENT',
        parallel: 'swMatePARALLEL',
        perpendicular: 'swMatePERPENDICULAR',
        tangent: 'swMateTANGENT',
        concentric: 'swMateCONCENTRIC',
        distance: 'swMateDISTANCE',
        angle: 'swMateANGLE',
        symmetric: 'swMateSYMMETRIC',
        cam: 'swMateCAMFOLLOWER',
        gear: 'swMateGEAR',
        rack_pinion: 'swMateRACKPINION',
        screw: 'swMateSCREW',
      };

      return `
Sub CreateAssemblyMate_${args.mateType}()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swMate As SldWorks.Mate2
    Dim swSelMgr As SldWorks.SelectionMgr
    Dim mateError As Long
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then
        MsgBox "Please open an assembly document"
        Exit Sub
    End If
    
    Set swSelMgr = swAssy.SelectionManager
    
    ' Clear selections
    swAssy.ClearSelection2 True
    
    ' Select first entity
    swAssy.Extension.SelectByID2 "${args.face1}@${args.component1}", "FACE", 0, 0, 0, False, 1, Nothing, 0
    
    ' Select second entity
    swAssy.Extension.SelectByID2 "${args.face2}@${args.component2}", "FACE", 0, 0, 0, True, 1, Nothing, 0
    
    ' Create mate
    ${
      args.mateType === 'distance'
        ? `
    Set swMate = swAssy.AddMate5( _
        ${mateConstants[args.mateType]}, _
        ${args.alignmentType === 'anti_aligned' ? 'swMateAlignANTI_ALIGNED' : 'swMateAlignALIGNED'}, _
        ${args.flip ? 'True' : 'False'}, _
        ${args.distance / 1000}, 0, 0, 0, 0, 0, 0, 0, _
        False, False, 0, mateError)`
        : ''
    }
    
    ${
      args.mateType === 'angle'
        ? `
    Set swMate = swAssy.AddMate5( _
        ${mateConstants[args.mateType]}, _
        ${args.alignmentType === 'anti_aligned' ? 'swMateAlignANTI_ALIGNED' : 'swMateAlignALIGNED'}, _
        ${args.flip ? 'True' : 'False'}, _
        0, ${(args.angle * Math.PI) / 180}, 0, 0, 0, 0, 0, 0, _
        False, False, 0, mateError)`
        : ''
    }
    
    ${
      !['distance', 'angle'].includes(args.mateType)
        ? `
    Set swMate = swAssy.AddMate5( _
        ${mateConstants[args.mateType]}, _
        ${args.alignmentType === 'anti_aligned' ? 'swMateAlignANTI_ALIGNED' : 'swMateAlignALIGNED'}, _
        ${args.flip ? 'True' : 'False'}, _
        0, 0, 0, 0, 0, 0, 0, 0, _
        False, False, 0, mateError)`
        : ''
    }
    
    If Not swMate Is Nothing Then
        MsgBox "${args.mateType} mate created successfully"
        swAssy.EditRebuild3
    Else
        MsgBox "Failed to create mate. Error code: " & mateError
    End If
    
    swAssy.ClearSelection2 True
End Sub`;
    },
  },

  {
    name: 'vba_assembly_components',
    description: 'Generate VBA for inserting and managing components',
    inputSchema: z.object({
      operation: z.enum(['insert', 'replace', 'pattern', 'mirror', 'explode', 'dissolve']),
      componentPath: z.string().optional().describe('Path to component file'),
      componentName: z.string().optional().describe('Component name in assembly'),
      configurationName: z.string().optional(),
      position: z
        .object({
          x: z.number(),
          y: z.number(),
          z: z.number(),
        })
        .optional(),
      quantity: z.number().optional(),
      patternType: z.enum(['linear', 'circular']).optional(),
      spacing: z.number().optional().describe('Spacing in mm'),
    }),
    handler: (args: any) => {
      const operations: Record<string, string> = {
        insert: `
Sub InsertComponent()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swComp As SldWorks.Component2
    Dim swMathUtil As SldWorks.MathUtility
    Dim swTransform As SldWorks.MathTransform
    Dim transformData(15) As Double
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then
        MsgBox "Please open an assembly document"
        Exit Sub
    End If
    
    Set swMathUtil = swApp.GetMathUtility
    
    ' Set transform matrix for position
    transformData(0) = 1: transformData(1) = 0: transformData(2) = 0
    transformData(3) = 0: transformData(4) = 1: transformData(5) = 0
    transformData(6) = 0: transformData(7) = 0: transformData(8) = 1
    transformData(9) = ${args.position?.x || 0} / 1000
    transformData(10) = ${args.position?.y || 0} / 1000
    transformData(11) = ${args.position?.z || 0} / 1000
    transformData(12) = 1
    
    Set swTransform = swMathUtil.CreateTransform(transformData)
    
    ' Insert component
    Set swComp = swAssy.AddComponent5( _
        "${args.componentPath}", _
        swAddComponentConfigOptions_e.swAddComponentConfigOptions_CurrentSelectedConfig, _
        "${args.configurationName || ''}", _
        False, "", _
        ${args.position?.x || 0} / 1000, _
        ${args.position?.y || 0} / 1000, _
        ${args.position?.z || 0} / 1000)
    
    If Not swComp Is Nothing Then
        MsgBox "Component inserted: " & swComp.Name2
        swAssy.EditRebuild3
    Else
        MsgBox "Failed to insert component"
    End If
End Sub`,
        replace: `
Sub ReplaceComponent()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swComp As SldWorks.Component2
    Dim bRet As Boolean
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then Exit Sub
    
    ' Select component to replace
    swAssy.Extension.SelectByID2 "${args.componentName}", "COMPONENT", 0, 0, 0, False, 0, Nothing, 0
    Set swComp = swAssy.SelectionManager.GetSelectedObject6(1, -1)
    
    If Not swComp Is Nothing Then
        ' Replace component
        bRet = swComp.Replace2("${args.componentPath}", "${args.configurationName || ''}", False, True)
        
        If bRet Then
            MsgBox "Component replaced successfully"
            swAssy.EditRebuild3
        Else
            MsgBox "Failed to replace component"
        End If
    End If
End Sub`,
        pattern: `
Sub CreateComponentPattern()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swFeat As SldWorks.Feature
    Dim swLocalPattern As SldWorks.LocalLinearPatternFeatureData
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then Exit Sub
    
    ' Select component(s) to pattern
    swAssy.Extension.SelectByID2 "${args.componentName}", "COMPONENT", 0, 0, 0, False, 1, Nothing, 0
    
    ${
      args.patternType === 'linear'
        ? `
    ' Select direction references
    swAssy.Extension.SelectByID2 "Right Plane", "PLANE", 0, 0, 0, True, 2, Nothing, 0
    
    ' Create linear pattern
    Set swFeat = swAssy.FeatureManager.FeatureLinearPattern4( _
        ${args.quantity || 3}, ${(args.spacing || 50) / 1000}, _
        1, 0, False, False, "NULL", "NULL", _
        False, False, False, False, False, False, _
        False, False, False, False, 0, 0)`
        : ''
    }
    
    ${
      args.patternType === 'circular'
        ? `
    ' Select axis
    swAssy.Extension.SelectByID2 "Axis1", "AXIS", 0, 0, 0, True, 2, Nothing, 0
    
    ' Create circular pattern
    Set swFeat = swAssy.FeatureManager.FeatureCircularPattern5( _
        ${args.quantity || 6}, ${(2 * Math.PI) / (args.quantity || 6)}, _
        False, "NULL", False, True, False, False)`
        : ''
    }
    
    If Not swFeat Is Nothing Then
        MsgBox "Component pattern created: " & swFeat.Name
        swAssy.EditRebuild3
    End If
End Sub`,
        explode: `
Sub CreateExplodedView()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swConfig As SldWorks.Configuration
    Dim swExplodeView As SldWorks.ExplodedView
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then Exit Sub
    
    Set swConfig = swAssy.GetActiveConfiguration
    
    ' Create new exploded view
    Set swExplodeView = swConfig.CreateExplodedView2("ExplodedView_${Date.now()}")
    
    If Not swExplodeView Is Nothing Then
        ' Select components to explode
        swAssy.Extension.SelectByID2 "${args.componentName}", "COMPONENT", 0, 0, 0, False, 0, Nothing, 0
        
        ' Add explode step
        swExplodeView.AddExplodeStep _
            ${(args.position?.x || 100) / 1000}, _
            ${(args.position?.y || 0) / 1000}, _
            ${(args.position?.z || 0) / 1000}
        
        MsgBox "Exploded view created"
        swAssy.ShowExploded2 True
    End If
End Sub`,
      };

      return operations[args.operation] || 'Operation not supported';
    },
  },

  {
    name: 'vba_assembly_analysis',
    description: 'Generate VBA for assembly analysis',
    inputSchema: z.object({
      analysisType: z.enum([
        'interference',
        'clearance',
        'collision',
        'mass_properties',
        'hole_alignment',
        'assembly_statistics',
        'bom_export',
      ]),
      components: z.array(z.string()).optional().describe('Components to analyze'),
      outputPath: z.string().optional().describe('Path for results export'),
      includeSubassemblies: z.boolean().optional().default(true),
      treatCoincidentAsInterference: z.boolean().optional().default(false),
    }),
    handler: (args: any) => {
      const analyses: Record<string, string> = {
        interference: `
Sub CheckInterference()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swIntMgr As SldWorks.InterferenceDetectionMgr
    Dim vInts As Variant
    Dim i As Integer
    Dim swInt As SldWorks.Interference
    Dim vol As Double
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then
        MsgBox "Please open an assembly"
        Exit Sub
    End If
    
    Set swIntMgr = swAssy.InterferenceDetectionManager
    
    ' Configure interference detection
    swIntMgr.TreatCoincidenceAsInterference = ${args.treatCoincidentAsInterference ? 'True' : 'False'}
    swIntMgr.TreatSubAssembliesAsComponents = ${args.includeSubassemblies ? 'False' : 'True'}
    swIntMgr.IncludeMultibodyPartInterferences = True
    swIntMgr.MakeInterferingPartsTransparent = True
    
    ${
      args.components && args.components.length > 0
        ? `
    ' Select specific components
    ${args.components
      .map(
        (comp: string) => `
    swAssy.Extension.SelectByID2 "${comp}", "COMPONENT", 0, 0, 0, True, 0, Nothing, 0`
      )
      .join('')}`
        : ''
    }
    
    ' Run interference detection
    vInts = swIntMgr.GetInterferences
    swIntMgr.Done
    
    If Not IsEmpty(vInts) Then
        MsgBox "Found " & UBound(vInts) + 1 & " interference(s)"
        
        ' Process each interference
        For i = 0 To UBound(vInts)
            Set swInt = vInts(i)
            vol = swInt.Volume * 1000000000 ' Convert to mm³
            
            Debug.Print "Interference " & i + 1 & ":"
            Debug.Print "  Component 1: " & swInt.Component1.Name2
            Debug.Print "  Component 2: " & swInt.Component2.Name2
            Debug.Print "  Volume: " & Format(vol, "0.00") & " mm³"
        Next i
        
        ${
          args.outputPath
            ? `
        ' Export results
        Dim fso As Object, file As Object
        Set fso = CreateObject("Scripting.FileSystemObject")
        Set file = fso.CreateTextFile("${args.outputPath}", True)
        
        file.WriteLine "Interference Detection Report"
        file.WriteLine "============================="
        file.WriteLine "Total Interferences: " & UBound(vInts) + 1
        file.WriteLine ""
        
        For i = 0 To UBound(vInts)
            Set swInt = vInts(i)
            file.WriteLine "Interference " & i + 1 & ":"
            file.WriteLine "  Component 1: " & swInt.Component1.Name2
            file.WriteLine "  Component 2: " & swInt.Component2.Name2
            file.WriteLine "  Volume: " & Format(swInt.Volume * 1000000000, "0.00") & " mm³"
            file.WriteLine ""
        Next i
        
        file.Close
        MsgBox "Report exported to: " & "${args.outputPath}"`
            : ''
        }
    Else
        MsgBox "No interferences found"
    End If
End Sub`,
        mass_properties: `
Sub CalculateMassProperties()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swMass As SldWorks.MassProperty
    Dim vCOG As Variant
    Dim vMOI As Variant
    Dim mass As Double
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then Exit Sub
    
    Set swMass = swAssy.Extension.CreateMassProperty
    
    ${
      args.components && args.components.length > 0
        ? `
    ' Select specific components
    swAssy.ClearSelection2 True
    ${args.components
      .map(
        (comp: string) => `
    swAssy.Extension.SelectByID2 "${comp}", "COMPONENT", 0, 0, 0, True, 0, Nothing, 0`
      )
      .join('')}
    
    ' Calculate for selected components
    swMass.UseSelectedOnly = True`
        : ''
    }
    
    mass = swMass.Mass * 1000 ' Convert to grams
    vCOG = swMass.CenterOfMass
    vMOI = swMass.GetMomentOfInertia(0) ' At COG
    
    ' Display results
    MsgBox "Mass Properties:" & vbCrLf & _
           "Mass: " & Format(mass, "0.00") & " g" & vbCrLf & _
           "Volume: " & Format(swMass.Volume * 1000000000, "0.00") & " mm³" & vbCrLf & _
           "Density: " & Format(swMass.Density, "0.00") & " kg/m³" & vbCrLf & _
           "Surface Area: " & Format(swMass.SurfaceArea * 1000000, "0.00") & " mm²" & vbCrLf & vbCrLf & _
           "Center of Gravity:" & vbCrLf & _
           "X: " & Format(vCOG(0) * 1000, "0.00") & " mm" & vbCrLf & _
           "Y: " & Format(vCOG(1) * 1000, "0.00") & " mm" & vbCrLf & _
           "Z: " & Format(vCOG(2) * 1000, "0.00") & " mm"
    
    ${
      args.outputPath
        ? `
    ' Export to file
    Dim fso As Object, file As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set file = fso.CreateTextFile("${args.outputPath}", True)
    
    file.WriteLine "Mass Properties Report"
    file.WriteLine "====================="
    file.WriteLine "Mass: " & Format(mass, "0.00") & " g"
    file.WriteLine "Volume: " & Format(swMass.Volume * 1000000000, "0.00") & " mm³"
    file.WriteLine "Density: " & Format(swMass.Density, "0.00") & " kg/m³"
    file.WriteLine "Surface Area: " & Format(swMass.SurfaceArea * 1000000, "0.00") & " mm²"
    file.WriteLine ""
    file.WriteLine "Center of Gravity:"
    file.WriteLine "  X: " & Format(vCOG(0) * 1000, "0.00") & " mm"
    file.WriteLine "  Y: " & Format(vCOG(1) * 1000, "0.00") & " mm"
    file.WriteLine "  Z: " & Format(vCOG(2) * 1000, "0.00") & " mm"
    file.WriteLine ""
    file.WriteLine "Moments of Inertia (at COG):"
    file.WriteLine "  Ixx: " & Format(vMOI(0), "0.0000") & " kg·m²"
    file.WriteLine "  Iyy: " & Format(vMOI(1), "0.0000") & " kg·m²"
    file.WriteLine "  Izz: " & Format(vMOI(2), "0.0000") & " kg·m²"
    
    file.Close
    MsgBox "Report saved to: " & "${args.outputPath}"`
        : ''
    }
End Sub`,
        bom_export: `
Sub ExportBOM()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swBOMAnnotation As SldWorks.BomTableAnnotation
    Dim swBOMFeature As SldWorks.BomFeature
    Dim swTable As SldWorks.TableAnnotation
    Dim i As Integer, j As Integer
    Dim rowCount As Long, colCount As Long
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then Exit Sub
    
    ' Create BOM
    Set swBOMFeature = swAssy.FeatureManager.InsertBomTable3( _
        "", "${args.outputPath || 'C:\\Temp\\BOM.xlsx'}", _
        swBomType_e.swBomType_PartsOnly, _
        "", _
        swBOMConfigurationAnchorType_e.swBOMConfigurationAnchor_ActiveConfiguration, _
        swBomStandard_e.swBomStandard_BomTable, _
        False)
    
    If Not swBOMFeature Is Nothing Then
        Set swBOMAnnotation = swBOMFeature.GetTableAnnotations(0)
        Set swTable = swBOMAnnotation
        
        rowCount = swTable.RowCount
        colCount = swTable.ColumnCount
        
        ' Export to Excel
        Dim xlApp As Object
        Dim xlBook As Object
        Dim xlSheet As Object
        
        Set xlApp = CreateObject("Excel.Application")
        Set xlBook = xlApp.Workbooks.Add
        Set xlSheet = xlBook.Sheets(1)
        
        xlApp.Visible = True
        
        ' Write headers
        For j = 0 To colCount - 1
            xlSheet.Cells(1, j + 1).Value = swTable.GetColumnTitle(j)
        Next j
        
        ' Write data
        For i = 1 To rowCount - 1
            For j = 0 To colCount - 1
                xlSheet.Cells(i + 1, j + 1).Value = swTable.Text(i, j)
            Next j
        Next i
        
        ' Format
        xlSheet.Range("A1").CurrentRegion.Columns.AutoFit
        xlSheet.Range("A1").CurrentRegion.Borders.LineStyle = 1
        
        ${
          args.outputPath
            ? `
        xlBook.SaveAs "${args.outputPath}"
        MsgBox "BOM exported to: ${args.outputPath}"`
            : ''
        }
    End If
End Sub`,
      };

      return analyses[args.analysisType] || 'Analysis type not supported';
    },
  },

  {
    name: 'vba_assembly_configurations',
    description: 'Generate VBA for managing assembly configurations',
    inputSchema: z.object({
      operation: z.enum(['create', 'modify', 'suppress', 'delete', 'copy']),
      configName: z.string(),
      parentConfig: z.string().optional(),
      componentsToSuppress: z.array(z.string()).optional(),
      properties: z.record(z.string()).optional(),
      displayStates: z.array(z.string()).optional(),
    }),
    handler: (args: any) => {
      return `
Sub ManageConfiguration_${args.operation}()
    Dim swApp As SldWorks.SldWorks
    Dim swAssy As SldWorks.AssemblyDoc
    Dim swConfig As SldWorks.Configuration
    Dim swConfigMgr As SldWorks.ConfigurationManager
    Dim bRet As Boolean
    
    Set swApp = Application.SldWorks
    Set swAssy = swApp.ActiveDoc
    
    If swAssy Is Nothing Then
        MsgBox "Please open an assembly"
        Exit Sub
    End If
    
    Set swConfigMgr = swAssy.ConfigurationManager
    
    ${
      args.operation === 'create'
        ? `
    ' Create new configuration
    Set swConfig = swAssy.AddConfiguration3( _
        "${args.configName}", _
        "Configuration created by VBA", _
        "", _
        swConfigurationOptions2_e.swConfigOption_LinkToParent + _
        swConfigurationOptions2_e.swConfigOption_InheritProperties, _
        "${args.parentConfig || ''}")
    
    If Not swConfig Is Nothing Then
        ' Activate new configuration
        swAssy.ShowConfiguration2 "${args.configName}"
        
        ${
          args.componentsToSuppress && args.componentsToSuppress.length > 0
            ? `
        ' Suppress components
        ${args.componentsToSuppress
          .map(
            (comp: string) => `
        swAssy.Extension.SelectByID2 "${comp}", "COMPONENT", 0, 0, 0, True, 0, Nothing, 0`
          )
          .join('')}
        swAssy.EditSuppress2`
            : ''
        }
        
        ${
          args.properties
            ? `
        ' Set custom properties
        ${Object.entries(args.properties || {})
          .map(
            ([key, value]) => `
        swConfig.CustomPropertyManager.Add3 "${key}", swCustomInfoType_e.swCustomInfoText, "${value}", _
            swCustomPropertyAddOption_e.swCustomPropertyReplaceValue`
          )
          .join('')}`
            : ''
        }
        
        MsgBox "Configuration '${args.configName}' created"
    End If`
        : ''
    }
    
    ${
      args.operation === 'modify'
        ? `
    ' Get configuration
    Set swConfig = swAssy.GetConfigurationByName("${args.configName}")
    
    If Not swConfig Is Nothing Then
        ' Activate configuration
        swAssy.ShowConfiguration2 "${args.configName}"
        
        ${
          args.componentsToSuppress && args.componentsToSuppress.length > 0
            ? `
        ' Modify suppression state
        ${args.componentsToSuppress
          .map(
            (comp: string) => `
        swAssy.Extension.SelectByID2 "${comp}", "COMPONENT", 0, 0, 0, True, 0, Nothing, 0`
          )
          .join('')}
        swAssy.EditSuppress2`
            : ''
        }
        
        MsgBox "Configuration '${args.configName}' modified"
    Else
        MsgBox "Configuration not found"
    End If`
        : ''
    }
    
    ${
      args.operation === 'delete'
        ? `
    ' Delete configuration
    bRet = swAssy.DeleteConfiguration2("${args.configName}")
    
    If bRet Then
        MsgBox "Configuration '${args.configName}' deleted"
    Else
        MsgBox "Failed to delete configuration"
    End If`
        : ''
    }
    
    swAssy.EditRebuild3
End Sub`;
    },
  },
];
