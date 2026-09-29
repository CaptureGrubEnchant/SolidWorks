'{{#if description}}
' Description: {{description}}
'{{/if}}
' Generated: {{timestamp}}
' Part Name: {{partName}}

Option Explicit

Sub CreatePart_{{partName}}()
    Dim swApp As Object
    Dim swModel As Object
    Dim swFeatureMgr As Object
    Dim swSketchMgr As Object
    Dim boolstatus As Boolean
    
    ' Get SolidWorks application
    Set swApp = CreateObject("SldWorks.Application")
    swApp.Visible = True
    
    ' Create new part
    Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(swUserPreferenceStringValue_e.swDefaultTemplatePart), 0, 0, 0)
    If swModel Is Nothing Then
        MsgBox "Failed to create new part"
        Exit Sub
    End If
    
    Set swFeatureMgr = swModel.FeatureManager
    Set swSketchMgr = swModel.SketchManager
    
    {{#if features}}
    ' Create features
    {{#each features}}
    
    ' Feature {{@index}}: {{this.type}}
    {{#eq this.type "sketch"}}
    ' Create sketch on {{this.plane}} plane
    boolstatus = swModel.Extension.SelectByID2("{{this.plane}} Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0)
    swSketchMgr.InsertSketch True
    
    {{#if this.geometry}}
    {{#each this.geometry}}
    {{#eq this.type "rectangle"}}
    ' Draw rectangle
    swSketchMgr.CreateCornerRectangle {{this.x1}}/1000, {{this.y1}}/1000, 0, {{this.x2}}/1000, {{this.y2}}/1000, 0
    {{/eq}}
    {{#eq this.type "circle"}}
    ' Draw circle
    swSketchMgr.CreateCircleByRadius {{this.centerX}}/1000, {{this.centerY}}/1000, 0, {{this.radius}}/1000
    {{/eq}}
    {{#eq this.type "line"}}
    ' Draw line
    swSketchMgr.CreateLine {{this.x1}}/1000, {{this.y1}}/1000, 0, {{this.x2}}/1000, {{this.y2}}/1000, 0
    {{/eq}}
    {{/each}}
    {{/if}}
    
    swSketchMgr.InsertSketch True
    {{/eq}}
    
    {{#eq this.type "extrude"}}
    ' Create extrusion
    Dim myFeature As Object
    Set myFeature = swFeatureMgr.FeatureExtrusion3(True, False, False, 0, 0, {{this.depth}}/1000, 0.01, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
    {{/eq}}
    
    {{#eq this.type "fillet"}}
    ' Create fillet
    boolstatus = swModel.Extension.SelectByID2("", "EDGE", {{this.x}}/1000, {{this.y}}/1000, {{this.z}}/1000, True, 1, Nothing, 0)
    Dim filletFeature As Object
    Set filletFeature = swFeatureMgr.FeatureFillet(195834, {{this.radius}}/1000, 0, 0, Nothing, Nothing, Nothing)
    {{/eq}}
    
    {{#eq this.type "chamfer"}}
    ' Create chamfer
    boolstatus = swModel.Extension.SelectByID2("", "EDGE", {{this.x}}/1000, {{this.y}}/1000, {{this.z}}/1000, True, 1, Nothing, 0)
    Dim chamferFeature As Object
    Set chamferFeature = swFeatureMgr.InsertFeatureChamfer(4, 1, {{this.distance}}/1000, 0, 0, 0, 0, 0)
    {{/eq}}
    
    {{#eq this.type "hole"}}
    ' Create hole
    boolstatus = swModel.Extension.SelectByID2("", "FACE", {{this.x}}/1000, {{this.y}}/1000, {{this.z}}/1000, False, 0, Nothing, 0)
    Dim holeFeature As Object
    Set holeFeature = swFeatureMgr.HoleWizard5(0, 8, 139, "Ansi Metric", 0, {{this.diameter}}/1000, -1, -1, 0, {{this.depth}}/1000, 0, 1, 2.05948851735331, 0, 0, 0, -1, -1, -1, "", False, True, True, True, True, False)
    {{/eq}}
    
    {{/each}}
    {{/if}}
    
    ' Zoom to fit
    swModel.ViewZoomtofit2
    
    {{#if savePath}}
    ' Save the part
    Dim lErrors As Long
    Dim lWarnings As Long
    boolstatus = swModel.SaveAs3("{{savePath}}", 0, 2, lErrors, lWarnings)
    {{/if}}
    
    MsgBox "Part '{{partName}}' created successfully!"
    
End Sub