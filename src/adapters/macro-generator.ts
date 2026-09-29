/**
 * Macro Generator for SolidWorks VBA Operations
 *
 * Generates VBA macros dynamically to handle complex operations
 * that exceed winax COM parameter limitations.
 */

import type { ExtrusionParameters, LoftParameters, RevolveParameters, SweepParameters } from './types.js';

export class MacroGenerator {
  /**
   * Generate VBA macro for complex extrusion with all parameters
   */
  generateExtrusionMacro(params: ExtrusionParameters): string {
    const depth = params.depth / 1000; // Convert to meters
    const draft = params.draft || 0;
    const reverse = params.reverse ? 'True' : 'False';
    const bothDirections = params.bothDirections ? 'True' : 'False';
    const merge = params.merge !== false ? 'True' : 'False';
    const flipSideToCut = params.flipSideToCut ? 'True' : 'False';

    // End conditions mapping
    const endConditionMap: { [key: string]: number } = {
      Blind: 0,
      ThroughAll: 1,
      UpToNext: 2,
      UpToVertex: 3,
      UpToSurface: 4,
      OffsetFromSurface: 5,
      MidPlane: 6,
    };

    const endCondition = params.endCondition ? endConditionMap[params.endCondition] || 0 : 0;

    return `
Option Explicit

Sub CreateExtrusion()
    Dim swApp As Object
    Dim swModel As Object
    Dim swFeatureMgr As Object
    Dim swFeature As Object
    Dim boolStatus As Boolean
    Dim errorMsg As String

    On Error GoTo ErrorHandler

    ' Get SolidWorks application
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc

    If swModel Is Nothing Then
        Debug.Print "ERROR: No active document"
        Exit Sub
    End If

    Set swFeatureMgr = swModel.FeatureManager

    If swFeatureMgr Is Nothing Then
        errorMsg = "ERROR: Cannot access FeatureManager"
        GoTo ErrorHandler
    End If
    
    ' Ensure we're not in sketch mode
    swModel.SketchManager.InsertSketch True
    
    ' Clear selections
    swModel.ClearSelection2 True
    
    ' Select the sketch for extrusion
    Dim vSketchFeatures As Variant
    Dim i As Integer
    Dim swFeat As Object
    Dim sketchSelected As Boolean
    
    sketchSelected = False
    
    ' Try to select by name
    Dim sketchNames As Variant
    sketchNames = Array("Sketch1", "Sketch2", "Sketch3", "Sketch4", "Sketch5")
    
    For i = 0 To UBound(sketchNames)
        boolStatus = swModel.Extension.SelectByID2(sketchNames(i), "SKETCH", 0, 0, 0, False, 0, Nothing, 0)
        If boolStatus Then
            sketchSelected = True
            Exit For
        End If
    Next i
    
    ' If no sketch selected, try to find the last sketch
    If Not sketchSelected Then
        Dim featureCount As Long
        featureCount = swModel.GetFeatureCount

        For i = 0 To Min(10, featureCount - 1)
            Set swFeat = swModel.FeatureByPositionReverse(i)
            If Not swFeat Is Nothing Then
                If InStr(1, swFeat.GetTypeName2, "ProfileFeature", vbTextCompare) > 0 Or _
                   InStr(1, swFeat.GetTypeName2, "Sketch", vbTextCompare) > 0 Then
                    swFeat.Select2 False, 0
                    sketchSelected = True
                    Exit For
                End If
            End If
        Next i
    End If

    ' Validate sketch selection
    If Not sketchSelected Then
        errorMsg = "ERROR: No sketch found to extrude. Please create a sketch first."
        GoTo ErrorHandler
    End If
    
    ' Create the extrusion with all parameters
    Set swFeature = swFeatureMgr.FeatureExtrusion3( _
        ${bothDirections === 'False' ? 'True' : 'False'}, _ ' Single direction
        ${reverse}, _ ' Flip
        ${bothDirections}, _ ' Both directions
        ${endCondition}, _ ' End condition type 1
        0, _ ' End condition type 2
        ${depth}, _ ' Depth 1
        ${params.depth2 ? params.depth2 / 1000 : 0}, _ ' Depth 2
        ${params.draftWhileExtruding ? 'True' : 'False'}, _ ' Draft while extruding 1
        False, _ ' Draft while extruding 2
        ${params.draftOutward ? 'True' : 'False'}, _ ' Draft outward 1
        False, _ ' Draft outward 2
        ${(draft * Math.PI) / 180}, _ ' Draft angle 1 (radians)
        0, _ ' Draft angle 2
        ${params.offsetReverse ? 'True' : 'False'}, _ ' Offset reverse 1
        False, _ ' Offset reverse 2
        ${params.translateSurface ? 'True' : 'False'}, _ ' Translate surface 1
        False, _ ' Translate surface 2
        ${merge}, _ ' Merge
        ${flipSideToCut}, _ ' Flip side to cut
        True, _ ' Update
        0, _ ' Start condition
        0, _ ' Flip start offset
        False _ ' Use feature scope
    )
    
    ' Handle thin feature if specified
    ${
      params.thinFeature
        ? `
    If Not swFeature Is Nothing Then
        swFeature.SetThinWallType ${params.thinType === 'TwoSide' ? 1 : params.thinType === 'MidPlane' ? 2 : 0}, _
            ${(params.thinThickness || 1) / 1000}, 0, ${params.capEnds ? 'True' : 'False'}, _
            ${(params.capThickness || 1) / 1000}
    End If
    `
        : ''
    }
    
    ' Clear selections
    swModel.ClearSelection2 True

    ' Rebuild
    swModel.EditRebuild3

    ' Check if feature was created successfully
    If swFeature Is Nothing Then
        Debug.Print "ERROR: Extrusion feature was not created. Check that a valid sketch is selected."
        Exit Sub
    End If

    Debug.Print "Extrusion created successfully: " & swFeature.Name
    Exit Sub

ErrorHandler:
    If errorMsg = "" Then
        errorMsg = "Unexpected error: " & Err.Description & " (Error " & Err.Number & ")"
    End If
    Debug.Print errorMsg
End Sub

Function Min(a As Long, b As Long) As Long
    If a < b Then
        Min = a
    Else
        Min = b
    End If
End Function
`;
  }

  /**
   * Generate VBA macro for revolve feature
   */
  generateRevolveMacro(params: RevolveParameters): string {
    const angle = (params.angle * Math.PI) / 180; // Convert to radians
    const direction = params.direction === 'Reverse' ? 1 : params.direction === 'Both' ? 2 : 0;
    const merge = params.merge !== false ? 'True' : 'False';

    return `
Option Explicit

Sub CreateRevolve()
    Dim swApp As Object
    Dim swModel As Object
    Dim swFeatureMgr As Object
    Dim swFeature As Object
    Dim boolStatus As Boolean
    Dim errorMsg As String

    On Error GoTo ErrorHandler

    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc

    If swModel Is Nothing Then
        Debug.Print "ERROR: No active document"
        Exit Sub
    End If

    Set swFeatureMgr = swModel.FeatureManager

    If swFeatureMgr Is Nothing Then
        errorMsg = "ERROR: Cannot access FeatureManager"
        GoTo ErrorHandler
    End If
    
    ' Ensure we're not in sketch mode
    swModel.SketchManager.InsertSketch True
    
    ' Clear selections
    swModel.ClearSelection2 True
    
    ' Select the sketch for revolve
    boolStatus = SelectLatestSketch(swModel)

    If Not boolStatus Then
        errorMsg = "ERROR: No sketch found for revolve. Please create a sketch with a profile and centerline."
        GoTo ErrorHandler
    End If
    
    ' Select axis if specified
    ${
      params.axis
        ? `
    boolStatus = swModel.Extension.SelectByID2("${params.axis}", "AXIS", 0, 0, 0, True, 16, Nothing, 0)
    If Not boolStatus Then
        ' Try to select a default axis
        boolStatus = swModel.Extension.SelectByID2("Line1", "SKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0)
    End If
    `
        : `
    ' Auto-select centerline or first line as axis
    Dim swSketch As Object
    Set swSketch = swModel.SketchManager.ActiveSketch
    If Not swSketch Is Nothing Then
        Dim vLines As Variant
        vLines = swSketch.GetLines2(0)
        If Not IsEmpty(vLines) Then
            Dim swLine As Object
            Set swLine = vLines(0)
            swLine.Select4 True, Nothing
        End If
    End If
    `
    }
    
    ' Create revolve feature
    Set swFeature = swFeatureMgr.FeatureRevolve2( _
        ${direction === 2 ? 'True' : 'False'}, _ ' Both directions
        ${direction === 1 ? 'True' : 'False'}, _ ' Reverse
        ${angle}, _ ' Angle
        0, _ ' Angle2 (for both directions)
        ${params.thinFeature ? '1' : '0'}, _ ' Thin feature
        ${params.thinThickness ? params.thinThickness / 1000 : 0}, _ ' Thin thickness
        ${merge}, _ ' Merge
        True, _ ' Use diameter
        0, _ ' Rev type
        0 _ ' Rev type2
    )
    
    ' Clear selections
    swModel.ClearSelection2 True

    ' Rebuild
    swModel.EditRebuild3

    ' Check if feature was created successfully
    If swFeature Is Nothing Then
        Debug.Print "ERROR: Revolve feature was not created. Check sketch and axis selection."
        Exit Sub
    End If

    Debug.Print "Revolve created successfully: " & swFeature.Name
    Exit Sub

ErrorHandler:
    If errorMsg = "" Then
        errorMsg = "Unexpected error: " & Err.Description & " (Error " & Err.Number & ")"
    End If
    Debug.Print "Revolve error: " & errorMsg
    Debug.Print errorMsg
End Sub

Function SelectLatestSketch(swModel As Object) As Boolean
    Dim i As Integer
    Dim swFeat As Object
    Dim boolStatus As Boolean
    
    ' Try standard sketch names
    Dim sketchNames As Variant
    sketchNames = Array("Sketch1", "Sketch2", "Sketch3", "Sketch4", "Sketch5")
    
    For i = 0 To UBound(sketchNames)
        boolStatus = swModel.Extension.SelectByID2(sketchNames(i), "SKETCH", 0, 0, 0, False, 0, Nothing, 0)
        If boolStatus Then
            SelectLatestSketch = True
            Exit Function
        End If
    Next i
    
    ' Try to find last sketch feature
    For i = 0 To swModel.GetFeatureCount - 1
        Set swFeat = swModel.FeatureByPositionReverse(i)
        If Not swFeat Is Nothing Then
            If InStr(1, swFeat.GetTypeName2, "Sketch", vbTextCompare) > 0 Then
                swFeat.Select2 False, 0
                SelectLatestSketch = True
                Exit Function
            End If
        End If
    Next i
    
    SelectLatestSketch = False
End Function
`;
  }

  /**
   * Generate VBA macro for sweep feature
   */
  generateSweepMacro(params: SweepParameters): string {
    const merge = params.merge !== false ? 'True' : 'False';
    const twistAngle = params.twistAngle ? (params.twistAngle * Math.PI) / 180 : 0;

    return `
Option Explicit

Sub CreateSweep()
    Dim swApp As Object
    Dim swModel As Object
    Dim swFeatureMgr As Object
    Dim swFeature As Object
    Dim boolStatus As Boolean
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        Debug.Print "No active document"
        Exit Sub
    End If
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Clear selections
    swModel.ClearSelection2 True
    
    ' Select profile sketch
    boolStatus = swModel.Extension.SelectByID2("${params.profileSketch}", "SKETCH", 0, 0, 0, False, 1, Nothing, 0)
    If Not boolStatus Then
        ' Try default profile sketch
        boolStatus = swModel.Extension.SelectByID2("Sketch1", "SKETCH", 0, 0, 0, False, 1, Nothing, 0)
    End If
    
    ' Select path sketch
    boolStatus = swModel.Extension.SelectByID2("${params.pathSketch}", "SKETCH", 0, 0, 0, True, 4, Nothing, 0)
    If Not boolStatus Then
        ' Try default path sketch
        boolStatus = swModel.Extension.SelectByID2("Sketch2", "SKETCH", 0, 0, 0, True, 4, Nothing, 0)
    End If
    
    ' Create sweep feature
    Set swFeature = swFeatureMgr.InsertProtrusionSwept4( _
        False, _ ' Propagate feature to parts
        False, _ ' Align with end faces
        0, _ ' Twist control type
        ${twistAngle}, _ ' Twist angle
        False, _ ' Reverse twist
        0, _ ' Tangency type
        0, _ ' Path alignment
        ${merge}, _ ' Merge
        ${params.thinFeature ? 'True' : 'False'}, _ ' Thin feature
        ${params.thinThickness ? params.thinThickness / 1000 : 0}, _ ' Thin thickness
        0, _ ' Thin type
        True, _ ' Merge scope
        False, _ ' Use feature scope
        True _ ' Auto select
    )
    
    ' Clear selections
    swModel.ClearSelection2 True
    
    ' Rebuild
    swModel.EditRebuild3
    
End Sub
`;
  }

  /**
   * Generate VBA macro for loft feature
   */
  generateLoftMacro(params: LoftParameters): string {
    const _merge = params.merge !== false ? 'True' : 'False';
    const close = params.close ? 'True' : 'False';

    // Build profile selection code
    const profileSelections = params.profiles
      .map(
        (profile, index) =>
          `boolStatus = swModel.Extension.SelectByID2("${profile}", "SKETCH", 0, 0, 0, ${index > 0 ? 'True' : 'False'}, 1, Nothing, 0)`
      )
      .join('\n    ');

    // Build guide curve selection code if any
    const guideSelections = params.guideCurves
      ? params.guideCurves
          .map(
            (guide, _index) =>
              `boolStatus = swModel.Extension.SelectByID2("${guide}", "SKETCH", 0, 0, 0, True, 2, Nothing, 0)`
          )
          .join('\n    ')
      : '';

    return `
Option Explicit

Sub CreateLoft()
    Dim swApp As Object
    Dim swModel As Object
    Dim swFeatureMgr As Object
    Dim swFeature As Object
    Dim boolStatus As Boolean
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        Debug.Print "No active document"
        Exit Sub
    End If
    
    Set swFeatureMgr = swModel.FeatureManager
    
    ' Clear selections
    swModel.ClearSelection2 True
    
    ' Select profile sketches
    ${profileSelections}
    
    ' Select guide curves if any
    ${guideSelections}
    
    ' Create loft feature
    Set swFeature = swFeatureMgr.InsertProtrusionLoft3( _
        ${close}, _ ' Close loft
        False, _ ' Keep tangency
        False, _ ' Force non-rational
        False, _ ' Simple surfaces
        False, _ ' Close guide curves
        0, _ ' Start tangency type
        0, _ ' End tangency type
        0, _ ' Start tangent length
        0, _ ' End tangent length
        ${params.thinFeature ? 'True' : 'False'}, _ ' Thin feature
        ${params.thinThickness ? params.thinThickness / 1000 : 0}, _ ' Thin thickness 1
        0, _ ' Thin thickness 2
        0, _ ' Thin type
        True, _ ' Merge
        True, _ ' Use feature scope
        True _ ' Auto select
    )
    
    ' Clear selections
    swModel.ClearSelection2 True
    
    ' Rebuild
    swModel.EditRebuild3
    
End Sub
`;
  }

  /**
   * Generate a generic VBA macro for any SolidWorks operation
   */
  generateGenericMacro(methodName: string, parameters: any[]): string {
    // Convert parameters to VBA format
    const paramList = parameters
      .map((p) => {
        if (typeof p === 'string') return `"${p}"`;
        if (typeof p === 'boolean') return p ? 'True' : 'False';
        if (typeof p === 'number') return p.toString();
        if (p === null || p === undefined) return 'Nothing';
        return JSON.stringify(p);
      })
      .join(', ');

    return `
Option Explicit

Sub Execute${methodName}()
    Dim swApp As Object
    Dim swModel As Object
    Dim result As Variant
    Dim errorMsg As String

    On Error GoTo ErrorHandler

    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc

    If swModel Is Nothing Then
        Debug.Print "ERROR: No active document"
        Exit Sub
    End If

    ' Execute the method
    result = swModel.${methodName}(${paramList})

    ' Rebuild if needed
    swModel.EditRebuild3

    ' Check result
    If IsEmpty(result) Or result = False Or result Is Nothing Then
        Debug.Print "WARNING: Method ${methodName} returned no result or failed"
    Else
        Debug.Print "Method ${methodName} executed successfully"
    End If

    Exit Sub

ErrorHandler:
    errorMsg = "ERROR executing ${methodName}: " & Err.Description & " (Error " & Err.Number & ")"
    Debug.Print "Macro error: " & errorMsg
    Debug.Print errorMsg
End Sub
`;
  }
}
