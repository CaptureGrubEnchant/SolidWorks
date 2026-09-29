import { z } from 'zod';

/**
 * VBA Generation for Advanced SolidWorks Features
 * Configurations, equations, simulation setup, and advanced automation
 */

export const advancedVBATools = [
  {
    name: 'vba_configurations',
    description: 'Generate VBA for managing configurations',
    inputSchema: z.object({
      operation: z.enum(['create', 'derive', 'suppress_features', 'set_properties', 'table_driven']),
      configName: z.string(),
      parentConfig: z.string().optional(),
      features: z.array(z.string()).optional(),
      properties: z.record(z.any()).optional(),
      suppressStates: z.record(z.boolean()).optional(),
      displayStates: z.array(z.string()).optional(),
    }),
    handler: (args: any) => {
      return `
Sub ManageConfiguration_${args.operation}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swConfig As SldWorks.Configuration
    Dim swConfigMgr As SldWorks.ConfigurationManager
    Dim swFeature As SldWorks.Feature
    Dim bRet As Boolean
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "No active document"
        Exit Sub
    End If
    
    Set swConfigMgr = swModel.ConfigurationManager
    
    ${
      args.operation === 'create'
        ? `
    ' Create new configuration
    Set swConfig = swModel.AddConfiguration3( _
        "${args.configName}", _
        "Created via VBA", _
        "", _
        swConfigurationOptions2_e.swConfigOption_LinkToParent + _
        swConfigurationOptions2_e.swConfigOption_InheritProperties, _
        "${args.parentConfig || ''}")
    
    If Not swConfig Is Nothing Then
        ' Activate configuration
        swModel.ShowConfiguration2 "${args.configName}"
        
        ${
          args.features && args.features.length > 0
            ? `
        ' Suppress/Unsuppress features
        ${args.features
          .map(
            (feat: string) => `
        Set swFeature = swModel.FeatureByName("${feat}")
        If Not swFeature Is Nothing Then
            swFeature.SetSuppression2 _
                ${
                  args.suppressStates?.[feat]
                    ? 'swFeatureSuppressionAction_e.swSuppressFeature'
                    : 'swFeatureSuppressionAction_e.swUnSuppressFeature'
                }, _
                swInConfigurationOpts_e.swThisConfiguration, Nothing
        End If`
          )
          .join('\n        ')}`
            : ''
        }
        
        ${
          args.properties
            ? `
        ' Set configuration properties
        Dim swCustPropMgr As SldWorks.CustomPropertyManager
        Set swCustPropMgr = swConfig.CustomPropertyManager
        
        ${Object.entries(args.properties)
          .map(
            ([key, value]) => `
        swCustPropMgr.Add3 "${key}", swCustomInfoType_e.swCustomInfoText, _
            "${value}", swCustomPropertyAddOption_e.swCustomPropertyReplaceValue`
          )
          .join('\n        ')}`
            : ''
        }
        
        MsgBox "Configuration '${args.configName}' created"
    End If`
        : ''
    }
    
    ${
      args.operation === 'derive'
        ? `
    ' Create derived configuration
    Dim parentConfig As SldWorks.Configuration
    Set parentConfig = swModel.GetConfigurationByName("${args.parentConfig || 'Default'}")
    
    If Not parentConfig Is Nothing Then
        Set swConfig = parentConfig.GetDerivedConfiguration3( _
            "${args.configName}", _
            swConfigurationOptions2_e.swConfigOption_LinkToParent + _
            swConfigurationOptions2_e.swConfigOption_InheritProperties, _
            "Derived configuration")
        
        If Not swConfig Is Nothing Then
            swModel.ShowConfiguration2 "${args.configName}"
            MsgBox "Derived configuration created: ${args.configName}"
        End If
    End If`
        : ''
    }
    
    ${
      args.operation === 'suppress_features'
        ? `
    ' Suppress features in configuration
    swModel.ShowConfiguration2 "${args.configName}"
    
    ${
      args.features
        ? args.features
            .map(
              (feat: string) => `
    Set swFeature = swModel.FeatureByName("${feat}")
    If Not swFeature Is Nothing Then
        swFeature.SetSuppression2 _
            swFeatureSuppressionAction_e.swSuppressFeature, _
            swInConfigurationOpts_e.swThisConfiguration, Nothing
        Debug.Print "Suppressed: ${feat}"
    End If`
            )
            .join('\n    ')
        : ''
    }
    
    MsgBox "Features suppressed in configuration"`
        : ''
    }
    
    swModel.EditRebuild3
End Sub`;
    },
  },

  {
    name: 'vba_equations',
    description: 'Generate VBA for managing equations and global variables',
    inputSchema: z.object({
      operation: z.enum(['add', 'modify', 'delete', 'link', 'export']),
      equations: z
        .array(
          z.object({
            name: z.string(),
            value: z.string(),
            isGlobal: z.boolean().optional(),
            comment: z.string().optional(),
          })
        )
        .optional(),
      externalFile: z.string().optional(),
      linkExternal: z.boolean().optional(),
    }),
    handler: (args: any) => {
      return `
Sub ManageEquations_${args.operation}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swEquationMgr As SldWorks.EquationMgr
    Dim equations() As String
    Dim i As Integer
    Dim equationIndex As Integer
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "No active document"
        Exit Sub
    End If
    
    Set swEquationMgr = swModel.GetEquationMgr
    
    ${
      args.operation === 'add'
        ? `
    ' Add equations
    ${
      args.equations
        ? args.equations
            .map(
              (eq: any, _i: number) => `
    ' Add equation: ${eq.name}
    equationIndex = swEquationMgr.Add2( _
        -1, _
        "\\"${eq.name}\\" = ${eq.value}", _
        ${eq.isGlobal ? 'True' : 'False'})
    
    If equationIndex >= 0 Then
        Debug.Print "Added equation: ${eq.name} = ${eq.value}"
        ${eq.comment ? `swEquationMgr.SetEquationComment equationIndex, "${eq.comment}"` : ''}
    End If`
            )
            .join('\n    ')
        : ''
    }
    
    MsgBox "Equations added successfully"`
        : ''
    }
    
    ${
      args.operation === 'modify'
        ? `
    ' Modify existing equations
    Dim equationCount As Integer
    equationCount = swEquationMgr.GetCount
    
    For i = 0 To equationCount - 1
        Dim currentEq As String
        currentEq = swEquationMgr.Equation(i)
        
        ${
          args.equations
            ? args.equations
                .map(
                  (eq: any) => `
        If InStr(currentEq, "\\"${eq.name}\\"") > 0 Then
            swEquationMgr.Equation(i) = "\\"${eq.name}\\" = ${eq.value}"
            Debug.Print "Modified equation: ${eq.name}"
        End If`
                )
                .join('\n        ')
            : ''
        }
    Next i
    
    MsgBox "Equations modified"`
        : ''
    }
    
    ${
      args.operation === 'delete'
        ? `
    ' Delete equations
    ${
      args.equations
        ? args.equations
            .map(
              (eq: any) => `
    For i = swEquationMgr.GetCount - 1 To 0 Step -1
        If InStr(swEquationMgr.Equation(i), "\\"${eq.name}\\"") > 0 Then
            swEquationMgr.Delete i
            Debug.Print "Deleted equation: ${eq.name}"
        End If
    Next i`
            )
            .join('\n    ')
        : ''
    }
    
    MsgBox "Equations deleted"`
        : ''
    }
    
    ${
      args.operation === 'link'
        ? `
    ' Link to external equation file
    If swEquationMgr.LinkToFile Then
        ' Already linked, update path
        swEquationMgr.FilePath = "${args.externalFile}"
    Else
        ' Create link
        swEquationMgr.LinkToFile = True
        swEquationMgr.FilePath = "${args.externalFile}"
    End If
    
    swEquationMgr.UpdateValuesFromExternalEquationFile
    MsgBox "Linked to external file: ${args.externalFile}"`
        : ''
    }
    
    ${
      args.operation === 'export'
        ? `
    ' Export equations to file
    Dim fso As Object, file As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set file = fso.CreateTextFile("${args.externalFile || 'C:\\Temp\\equations.txt'}", True)
    
    file.WriteLine "' SolidWorks Equations Export"
    file.WriteLine "' Generated: " & Now
    file.WriteLine ""
    
    For i = 0 To swEquationMgr.GetCount - 1
        file.WriteLine swEquationMgr.Equation(i)
        
        Dim comment As String
        comment = swEquationMgr.GetEquationComment(i)
        If comment <> "" Then
            file.WriteLine "' " & comment
        End If
    Next i
    
    file.Close
    MsgBox "Equations exported to: ${args.externalFile || 'C:\\Temp\\equations.txt'}"`
        : ''
    }
    
    swModel.EditRebuild3
End Sub`;
    },
  },

  {
    name: 'vba_simulation_setup',
    description: 'Generate VBA for setting up simulation studies',
    inputSchema: z.object({
      studyType: z.enum(['static', 'frequency', 'buckling', 'thermal', 'nonlinear', 'dynamic']),
      studyName: z.string(),
      materials: z
        .array(
          z.object({
            componentName: z.string(),
            materialName: z.string(),
          })
        )
        .optional(),
      fixtures: z
        .array(
          z.object({
            faceName: z.string(),
            type: z.enum(['fixed', 'roller', 'hinge']),
          })
        )
        .optional(),
      loads: z
        .array(
          z.object({
            faceName: z.string(),
            type: z.enum(['force', 'pressure', 'torque']),
            value: z.number(),
            unit: z.string(),
          })
        )
        .optional(),
      meshQuality: z.enum(['draft', 'standard', 'fine']).optional(),
    }),
    handler: (args: any) => {
      return `
Sub SetupSimulationStudy_${args.studyType}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swSimulation As Object ' CosmosWorksLib.CwAddincallback
    Dim swStudyMgr As Object ' CosmosWorksLib.CWStudyManager
    Dim swStudy As Object ' CosmosWorksLib.CWStudy
    Dim swMesh As Object ' CosmosWorksLib.CWMesh
    Dim errCode As Long
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "No active document"
        Exit Sub
    End If
    
    ' Get Simulation add-in
    Set swSimulation = swApp.GetAddInObject("SldWorks.Simulation")
    
    If swSimulation Is Nothing Then
        MsgBox "Simulation add-in not loaded"
        Exit Sub
    End If
    
    ' Activate Simulation
    swSimulation.InitializeInterface swApp, swModel
    Set swStudyMgr = swSimulation.StudyManager
    
    ' Create study
    Set swStudy = swStudyMgr.CreateNewStudy3( _
        "${args.studyName}", _
        ${
          args.studyType === 'static'
            ? '0'
            : args.studyType === 'frequency'
              ? '1'
              : args.studyType === 'buckling'
                ? '2'
                : args.studyType === 'thermal'
                  ? '3'
                  : args.studyType === 'nonlinear'
                    ? '4'
                    : '5'
        }, _
        0, errCode)
    
    If swStudy Is Nothing Then
        MsgBox "Failed to create study. Error: " & errCode
        Exit Sub
    End If
    
    ${
      args.materials && args.materials.length > 0
        ? `
    ' Apply materials
    ${args.materials
      .map(
        (mat: any) => `
    swModel.Extension.SelectByID2 "${mat.componentName}", "COMPONENT", 0, 0, 0, False, 0, Nothing, 0
    Dim swMaterial As Object
    Set swMaterial = swStudy.GetMaterial("${mat.materialName}")
    If Not swMaterial Is Nothing Then
        swStudy.ApplyMaterial swMaterial
        Debug.Print "Applied material: ${mat.materialName} to ${mat.componentName}"
    End If`
      )
      .join('\n    ')}`
        : ''
    }
    
    ${
      args.fixtures && args.fixtures.length > 0
        ? `
    ' Add fixtures
    ${args.fixtures
      .map(
        (fix: any) => `
    swModel.Extension.SelectByID2 "${fix.faceName}", "FACE", 0, 0, 0, False, 0, Nothing, 0
    Dim swFixture As Object
    Set swFixture = swStudy.AddRestraint( _
        ${fix.type === 'fixed' ? '0' : fix.type === 'roller' ? '1' : '2'}, _
        swModel.SelectionManager)
    If Not swFixture Is Nothing Then
        Debug.Print "Added ${fix.type} fixture to ${fix.faceName}"
    End If`
      )
      .join('\n    ')}`
        : ''
    }
    
    ${
      args.loads && args.loads.length > 0
        ? `
    ' Add loads
    ${args.loads
      .map(
        (load: any) => `
    swModel.Extension.SelectByID2 "${load.faceName}", "FACE", 0, 0, 0, False, 0, Nothing, 0
    Dim swLoad As Object
    Set swLoad = swStudy.AddLoad( _
        ${load.type === 'force' ? '0' : load.type === 'pressure' ? '1' : '2'}, _
        swModel.SelectionManager)
    If Not swLoad Is Nothing Then
        swLoad.Value = ${load.value}
        swLoad.Unit = "${load.unit}"
        Debug.Print "Added ${load.type}: ${load.value} ${load.unit} to ${load.faceName}"
    End If`
      )
      .join('\n    ')}`
        : ''
    }
    
    ' Create mesh
    Set swMesh = swStudy.GetMesh
    If Not swMesh Is Nothing Then
        swMesh.Quality = ${args.meshQuality === 'draft' ? '0' : args.meshQuality === 'fine' ? '2' : '1'}
        
        Dim meshResult As Long
        meshResult = swStudy.CreateMesh(0, 0, 0, errCode)
        
        If meshResult = 0 Then
            Debug.Print "Mesh created successfully"
        Else
            MsgBox "Failed to create mesh. Error: " & errCode
        End If
    End If
    
    MsgBox "Simulation study '${args.studyName}' created and configured"
End Sub`;
    },
  },

  {
    name: 'vba_api_automation',
    description: 'Generate VBA for advanced API automation and event handling',
    inputSchema: z.object({
      automationType: z.enum(['event_handler', 'macro_feature', 'property_page', 'add_in']),
      eventTypes: z
        .array(
          z.enum([
            'file_save',
            'file_open',
            'rebuild',
            'selection_change',
            'dimension_change',
            'feature_add',
            'configuration_change',
          ])
        )
        .optional(),
      className: z.string().optional(),
      methods: z
        .array(
          z.object({
            name: z.string(),
            parameters: z.array(z.string()).optional(),
            returnType: z.string().optional(),
          })
        )
        .optional(),
    }),
    handler: (args: any) => {
      const eventHandlers: Record<string, string> = {
        file_save: `
Private Function swApp_FileSaveNotify(ByVal FileName As String) As Long
    Debug.Print "File saving: " & FileName
    ' Add custom save logic here
    swApp_FileSaveNotify = 0
End Function`,
        file_open: `
Private Function swApp_FileOpenNotify(ByVal FileName As String) As Long
    Debug.Print "File opened: " & FileName
    ' Add custom open logic here
    swApp_FileOpenNotify = 0
End Function`,
        rebuild: `
Private Function swApp_RebuildNotify() As Long
    Debug.Print "Model rebuilding"
    ' Add custom rebuild logic here
    swApp_RebuildNotify = 0
End Function`,
        selection_change: `
Private Function swApp_SelectionChangeNotify() As Long
    Dim swSelMgr As SldWorks.SelectionMgr
    Set swSelMgr = swModel.SelectionManager
    
    Debug.Print "Selection changed. Count: " & swSelMgr.GetSelectedObjectCount2(-1)
    ' Add custom selection logic here
    swApp_SelectionChangeNotify = 0
End Function`,
        dimension_change: `
Private Function swApp_DimensionChangeNotify(ByVal swDim As Object) As Long
    Debug.Print "Dimension changed: " & swDim.FullName
    ' Add custom dimension change logic here
    swApp_DimensionChangeNotify = 0
End Function`,
      };

      return `
${
  args.automationType === 'event_handler'
    ? `
' Class module for SolidWorks event handling
' Name this class module: ${args.className || 'SwEventHandler'}

Option Explicit

' SolidWorks application events
Public WithEvents swApp As SldWorks.SldWorks
Public WithEvents swModel As SldWorks.ModelDoc2

' Initialize event handler
Public Sub Init(app As SldWorks.SldWorks, model As SldWorks.ModelDoc2)
    Set swApp = app
    Set swModel = model
    
    ' Enable notifications
    If Not swModel Is Nothing Then
        swModel.EnableNotifications = True
    End If
End Sub

${args.eventTypes ? args.eventTypes.map((evt: string) => eventHandlers[evt] || '').join('\n\n') : ''}

' Cleanup
Public Sub Terminate()
    Set swModel = Nothing
    Set swApp = Nothing
End Sub

' Usage in main module:
' Dim eventHandler As New SwEventHandler
' eventHandler.Init swApp, swModel`
    : ''
}

${
  args.automationType === 'macro_feature'
    ? `
Sub CreateMacroFeature()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swFeatMgr As SldWorks.FeatureManager
    Dim swMacroFeature As SldWorks.Feature
    Dim swMacroFeatureDef As SldWorks.MacroFeatureData
    Dim methods(9) As String
    Dim dimTypes(1) As Long
    Dim dimValues(1) As Double
    Dim paramNames(1) As String
    Dim paramTypes(1) As Long
    Dim paramValues(1) As String
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    Set swFeatMgr = swModel.FeatureManager
    
    ' Define macro feature methods
    methods(0) = "${args.className || 'CustomFeature'}" ' Module name
    methods(1) = "swmRebuild" ' Rebuild function
    methods(2) = "swmEdit" ' Edit function
    methods(3) = "swmSecurity" ' Security function
    methods(4) = "" ' Reserved
    methods(5) = "" ' Reserved
    methods(6) = "" ' Reserved
    methods(7) = "" ' Reserved
    methods(8) = "" ' Reserved
    methods(9) = "" ' Icon file
    
    ' Set parameters
    paramNames(0) = "Parameter1"
    paramTypes(0) = swMacroFeatureParamType_e.swMacroFeatureParamTypeDouble
    paramValues(0) = "10.0"
    
    ' Create macro feature
    Set swMacroFeature = swFeatMgr.InsertMacroFeature3( _
        "${args.className || 'CustomFeature'}", _
        "", methods, _
        paramNames, paramTypes, paramValues, _
        Nothing, Nothing, Nothing, _
        Nothing, swMacroFeatureOptions_e.swMacroFeatureByDefault)
    
    If Not swMacroFeature Is Nothing Then
        MsgBox "Macro feature created: " & swMacroFeature.Name
    End If
End Sub

' Macro feature rebuild method
Function swmRebuild(swApp As Variant, swModel As Variant, swFeature As Variant) As Variant
    ' Custom rebuild logic
    swmRebuild = True
End Function

' Macro feature edit method
Function swmEdit(swApp As Variant, swModel As Variant, swFeature As Variant) As Variant
    ' Custom edit logic
    MsgBox "Editing macro feature"
    swmEdit = True
End Function`
    : ''
}

${
  args.automationType === 'property_page'
    ? `
' Property Manager Page Handler
Sub CreatePropertyPage()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swPMPage As SldWorks.PropertyManagerPage2
    Dim swPMPageHandler As PropertyManagerPageHandler
    Dim errors As Long
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then Exit Sub
    
    ' Create property page handler
    Set swPMPageHandler = New PropertyManagerPageHandler
    
    ' Create property page
    Set swPMPage = swApp.CreatePropertyManagerPage( _
        "${args.className || 'Custom Properties'}", _
        swPropertyManagerPageOptions_e.swPropertyManagerOptions_OkayButton + _
        swPropertyManagerPageOptions_e.swPropertyManagerOptions_CancelButton, _
        swPMPageHandler, errors)
    
    If Not swPMPage Is Nothing Then
        ' Add controls
        Dim group As SldWorks.PropertyManagerPageGroup
        Dim textbox As SldWorks.PropertyManagerPageTextbox
        Dim numberbox As SldWorks.PropertyManagerPageNumberbox
        
        Set group = swPMPage.AddGroupBox(1, "Parameters", _
            swPropertyManagerPageGroupBoxOptions_e.swGroupBoxOptions_Expanded)
        
        Set textbox = group.AddControl2(2, _
            swPropertyManagerPageControlType_e.swControlType_Textbox, _
            "Name:", swPropertyManagerPageControlLeftAlign_e.swControlAlign_LeftEdge, _
            swPropertyManagerPageControlOptions_e.swControlOptions_Enabled, "")
        
        Set numberbox = group.AddControl2(3, _
            swPropertyManagerPageControlType_e.swControlType_Numberbox, _
            "Value:", swPropertyManagerPageControlLeftAlign_e.swControlAlign_LeftEdge, _
            swPropertyManagerPageControlOptions_e.swControlOptions_Enabled, "")
        
        numberbox.SetRange2 swNumberboxUnitType_e.swNumberBox_Length, 0, 100, True, 10, 1, 0.1
        
        ' Show property page
        swPMPage.Show
    End If
End Sub`
    : ''
}

${
  args.automationType === 'add_in'
    ? `
' SolidWorks Add-in Template
' Implements SwAddin interface

Option Explicit

Implements SwAddin

Private swApp As SldWorks.SldWorks
Private addinID As Long

Private Function SwAddin_ConnectToSW(ThisSW As Object, Cookie As Long) As Boolean
    Set swApp = ThisSW
    addinID = Cookie
    
    ' Register callbacks
    swApp.SetAddinCallbackInfo2 0, Me, addinID
    
    ' Add menu items
    AddMenuItems
    
    ' Add toolbar
    AddToolbar
    
    SwAddin_ConnectToSW = True
End Function

Private Function SwAddin_DisconnectFromSW() As Boolean
    ' Clean up
    RemoveMenuItems
    RemoveToolbar
    
    Set swApp = Nothing
    SwAddin_DisconnectFromSW = True
End Function

Private Sub AddMenuItems()
    Dim menuID As Long
    menuID = swApp.AddMenu(swDocumentTypes_e.swDocPART, _
        "${args.className || 'Custom Add-in'}", 0)
    
    swApp.AddMenuItem4 menuID, 0, _
        "Command 1@${args.className || 'Custom Add-in'}", _
        0, "OnCommand1", "", ""
End Sub

Private Sub AddToolbar()
    Dim toolbar As Object
    Set toolbar = swApp.AddToolbar5( _
        addinID, "${args.className || 'Custom Toolbar'}", _
        swDocumentTypes_e.swDocPART + swDocumentTypes_e.swDocASSEMBLY, _
        swToolbarOptions_e.swToolbarOptions_ShowInAllDocuments)
End Sub

Public Sub OnCommand1()
    MsgBox "Custom command executed"
End Sub`
    : ''
}`;
    },
  },

  {
    name: 'vba_error_handling',
    description: 'Generate VBA with comprehensive error handling and logging',
    inputSchema: z.object({
      functionName: z.string(),
      operationType: z.string(),
      logToFile: z.boolean().optional(),
      logPath: z.string().optional(),
      emailOnError: z.boolean().optional(),
      emailAddress: z.string().optional(),
    }),
    handler: (args: any) => {
      return `
' Error handling and logging utilities
Option Explicit

Private Const LOG_FILE As String = "${args.logPath || 'C:\\Temp\\SolidWorksVBA.log'}"

Sub ${args.functionName}_WithErrorHandling()
    On Error GoTo ErrorHandler
    
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim startTime As Double
    Dim endTime As Double
    
    startTime = Timer
    
    ' Initialize
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    ' Log operation start
    LogMessage "INFO", "Starting ${args.operationType}"
    
    ' Validate prerequisites
    If swModel Is Nothing Then
        Err.Raise vbObjectError + 1000, "${args.functionName}", _
            "No active document found"
    End If
    
    ' ===============================
    ' Main operation logic goes here
    ' ===============================
    
    ' Your ${args.operationType} code here
    
    ' ===============================
    
    endTime = Timer
    LogMessage "SUCCESS", "${args.operationType} completed in " & _
        Format(endTime - startTime, "0.00") & " seconds"
    
    Exit Sub
    
ErrorHandler:
    Dim errorMsg As String
    errorMsg = "Error in ${args.functionName}: " & vbCrLf & _
               "Number: " & Err.Number & vbCrLf & _
               "Description: " & Err.Description & vbCrLf & _
               "Source: " & Err.Source
    
    ' Log error
    LogMessage "ERROR", errorMsg
    
    ${
      args.emailOnError
        ? `
    ' Send email notification
    SendErrorEmail "${args.emailAddress}", "${args.functionName} Error", errorMsg`
        : ''
    }
    
    ' Display error to user
    MsgBox errorMsg, vbCritical, "Error in ${args.operationType}"
    
    ' Clean up
    On Error Resume Next
    If Not swModel Is Nothing Then
        swModel.ClearSelection2 True
    End If
    
    ' Re-raise error if needed
    ' Err.Raise Err.Number, Err.Source, Err.Description
End Sub

Private Sub LogMessage(logLevel As String, message As String)
    ${
      args.logToFile
        ? `
    Dim fso As Object
    Dim logFile As Object
    
    On Error Resume Next
    
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    ' Create log file if it doesn't exist
    If Not fso.FileExists(LOG_FILE) Then
        Set logFile = fso.CreateTextFile(LOG_FILE, True)
        logFile.WriteLine "Timestamp,Level,Message"
    Else
        Set logFile = fso.OpenTextFile(LOG_FILE, 8) ' Append mode
    End If
    
    ' Write log entry
    logFile.WriteLine Now & "," & logLevel & "," & Replace(message, ",", ";")
    logFile.Close
    
    Set logFile = Nothing
    Set fso = Nothing`
        : ''
    }
    
    ' Also output to immediate window
    Debug.Print "[" & logLevel & "] " & Now & " - " & message
End Sub

${
  args.emailOnError
    ? `
Private Sub SendErrorEmail(recipient As String, subject As String, body As String)
    On Error Resume Next
    
    Dim outlook As Object
    Dim mail As Object
    
    Set outlook = CreateObject("Outlook.Application")
    Set mail = outlook.CreateItem(0) ' olMailItem
    
    With mail
        .To = recipient
        .Subject = subject
        .Body = body & vbCrLf & vbCrLf & _
                "Generated by: ${args.functionName}" & vbCrLf & _
                "Time: " & Now & vbCrLf & _
                "Computer: " & Environ("COMPUTERNAME") & vbCrLf & _
                "User: " & Environ("USERNAME")
        .Send
    End With
    
    Set mail = Nothing
    Set outlook = Nothing
End Sub`
    : ''
}

' Performance monitoring
Private Sub MeasurePerformance(operationName As String, codeBlock As String)
    Dim startTime As Double, endTime As Double
    Dim memBefore As Long, memAfter As Long
    
    ' Get memory usage before
    memBefore = GetMemoryUsage()
    startTime = Timer
    
    ' Execute code block
    Application.Run codeBlock
    
    endTime = Timer
    memAfter = GetMemoryUsage()
    
    LogMessage "PERFORMANCE", operationName & " - Time: " & _
        Format(endTime - startTime, "0.000") & "s, Memory: " & _
        Format((memAfter - memBefore) / 1024, "0.00") & " KB"
End Sub

Private Function GetMemoryUsage() As Long
    ' Returns approximate memory usage in bytes
    On Error Resume Next
    GetMemoryUsage = Application.MemoryUsed * 1024
End Function`;
    },
  },
];
