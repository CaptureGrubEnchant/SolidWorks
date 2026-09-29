import { z } from 'zod';

/**
 * VBA Generation for Drawing Automation
 * Comprehensive SolidWorks drawing creation and management
 */

export const drawingVBATools = [
  {
    name: 'vba_create_drawing_views',
    description: 'Generate VBA for creating drawing views',
    inputSchema: z.object({
      viewType: z.enum([
        'standard',
        'projected',
        'auxiliary',
        'section',
        'detail',
        'broken',
        'break_out_section',
        'isometric',
        'named',
      ]),
      modelPath: z.string().describe('Path to model file'),
      viewOrientation: z
        .enum(['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric', 'dimetric', 'trimetric', 'current'])
        .optional(),
      position: z.object({
        x: z.number().describe('X position in mm'),
        y: z.number().describe('Y position in mm'),
      }),
      scale: z.number().optional().describe('View scale (e.g., 0.5 for 1:2)'),
      sectionLine: z
        .object({
          startX: z.number(),
          startY: z.number(),
          endX: z.number(),
          endY: z.number(),
        })
        .optional(),
      detailCircle: z
        .object({
          centerX: z.number(),
          centerY: z.number(),
          radius: z.number(),
        })
        .optional(),
    }),
    handler: (args: any) => {
      const _viewOrientations: Record<string, string> = {
        front: 'swDrawingViewOrientations_e.swDrawingFrontView',
        back: 'swDrawingViewOrientations_e.swDrawingBackView',
        left: 'swDrawingViewOrientations_e.swDrawingLeftView',
        right: 'swDrawingViewOrientations_e.swDrawingRightView',
        top: 'swDrawingViewOrientations_e.swDrawingTopView',
        bottom: 'swDrawingViewOrientations_e.swDrawingBottomView',
        isometric: 'swDrawingViewOrientations_e.swDrawingIsometricView',
      };

      const viewTypes: Record<string, string> = {
        standard: `
    ' Create standard view
    Set swView = swDraw.CreateDrawViewFromModelView3( _
        "${args.modelPath}", _
        "*${args.viewOrientation || 'Front'}", _
        ${args.position.x / 1000}, ${args.position.y / 1000}, 0)
    
    If Not swView Is Nothing Then
        swView.ScaleDecimal = ${args.scale || 1}
        MsgBox "Standard view created"
    End If`,
        projected: `
    ' Create projected view from parent
    Set swParentView = swDraw.GetFirstView ' Get sheet
    Set swParentView = swParentView.GetNextView ' Get first view
    
    If Not swParentView Is Nothing Then
        Set swView = swDraw.CreateUnfoldedViewAt3( _
            ${args.position.x / 1000}, ${args.position.y / 1000}, 0, False)
        
        If Not swView Is Nothing Then
            MsgBox "Projected view created"
        End If
    End If`,
        section: `
    ' Create section view
    Set swParentView = swDraw.GetFirstView.GetNextView
    
    If Not swParentView Is Nothing Then
        ' Create section line
        Set swSketchMgr = swDraw.SketchManager
        swSketchMgr.InsertSketch False
        swSketchMgr.CreateLine _
            ${(args.sectionLine?.startX || 0) / 1000}, _
            ${(args.sectionLine?.startY || 0) / 1000}, 0, _
            ${(args.sectionLine?.endX || 100) / 1000}, _
            ${(args.sectionLine?.endY || 0) / 1000}, 0
        swSketchMgr.InsertSketch True
        
        ' Create section view
        Set swView = swDraw.CreateSectionViewAt5( _
            ${args.position.x / 1000}, ${args.position.y / 1000}, 0, _
            "Section A-A", _
            swCreateSectionViewOptions_e.swCreateSectionView_DisplaySurfaceCut, _
            "", 0)
        
        If Not swView Is Nothing Then
            MsgBox "Section view created"
        End If
    End If`,
        detail: `
    ' Create detail view
    Set swParentView = swDraw.GetFirstView.GetNextView
    
    If Not swParentView Is Nothing Then
        ' Create detail circle
        Set swSketchMgr = swDraw.SketchManager
        swSketchMgr.InsertSketch False
        swSketchMgr.CreateCircle _
            ${(args.detailCircle?.centerX || 0) / 1000}, _
            ${(args.detailCircle?.centerY || 0) / 1000}, 0, _
            ${(args.detailCircle?.radius || 10) / 1000}
        swSketchMgr.InsertSketch True
        
        ' Create detail view
        Set swView = swDraw.CreateDetailViewAt4( _
            ${args.position.x / 1000}, ${args.position.y / 1000}, 0, _
            swDetViewStyle_e.swDetViewSTANDARD, _
            ${args.scale || 2}, _
            True, "Detail A", _
            swDetCircleShowType_e.swDetCircleCIRCLE, _
            True, False, False)
        
        If Not swView Is Nothing Then
            MsgBox "Detail view created"
        End If
    End If`,
      };

      return `
Sub CreateDrawingView_${args.viewType}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swDraw As SldWorks.DrawingDoc
    Dim swView As SldWorks.View
    Dim swParentView As SldWorks.View
    Dim swSketchMgr As SldWorks.SketchManager
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Then
        MsgBox "No active document"
        Exit Sub
    End If
    
    If swModel.GetType <> swDocumentTypes_e.swDocDRAWING Then
        MsgBox "Please open a drawing document"
        Exit Sub
    End If
    
    Set swDraw = swModel
    
    ${viewTypes[args.viewType] || viewTypes.standard}
    
    swModel.ViewZoomtofit2
    swModel.EditRebuild3
End Sub`;
    },
  },

  {
    name: 'vba_drawing_dimensions',
    description: 'Generate VBA for adding dimensions to drawings',
    inputSchema: z.object({
      dimensionType: z.enum([
        'linear',
        'angular',
        'radial',
        'diameter',
        'ordinate',
        'chamfer',
        'arc_length',
        'coordinate',
      ]),
      viewName: z.string().optional().describe('Name of the view'),
      entities: z
        .array(
          z.object({
            type: z.enum(['edge', 'vertex', 'face']),
            name: z.string(),
          })
        )
        .optional(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      tolerance: z
        .object({
          type: z.enum(['bilateral', 'limit', 'symmetric', 'basic', 'min', 'max']).optional(),
          upper: z.number().optional(),
          lower: z.number().optional(),
        })
        .optional(),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
    }),
    handler: (args: any) => {
      return `
Sub AddDimension_${args.dimensionType}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swDraw As SldWorks.DrawingDoc
    Dim swView As SldWorks.View
    Dim swDispDim As SldWorks.DisplayDimension
    Dim swDim As SldWorks.Dimension
    Dim swTol As SldWorks.DimensionTolerance
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Or swModel.GetType <> swDocumentTypes_e.swDocDRAWING Then
        MsgBox "Please open a drawing document"
        Exit Sub
    End If
    
    Set swDraw = swModel
    
    ' Get the view
    Set swView = swDraw.GetFirstView ' Sheet
    Set swView = swView.GetNextView ' First view
    ${
      args.viewName
        ? `
    ' Find specific view
    Do While Not swView Is Nothing
        If swView.Name = "${args.viewName}" Then Exit Do
        Set swView = swView.GetNextView
    Loop`
        : ''
    }
    
    If swView Is Nothing Then
        MsgBox "View not found"
        Exit Sub
    End If
    
    ' Activate view
    swDraw.ActivateView swView.Name
    
    ${
      args.entities && args.entities.length > 0
        ? `
    ' Select entities
    ${args.entities
      .map(
        (entity: any, i: number) => `
    swModel.Extension.SelectByID2 "${entity.name}", "${entity.type.toUpperCase()}", _
        0, 0, 0, ${i > 0 ? 'True' : 'False'}, 0, Nothing, 0`
      )
      .join('')}`
        : ''
    }
    
    ' Add dimension based on type
    ${
      args.dimensionType === 'linear'
        ? `
    Set swDispDim = swModel.AddDimension2( _
        ${args.position.x / 1000}, ${args.position.y / 1000}, 0)`
        : ''
    }
    
    ${
      args.dimensionType === 'angular'
        ? `
    Set swDispDim = swModel.AddAngularDimension2( _
        ${args.position.x / 1000}, ${args.position.y / 1000}, 0)`
        : ''
    }
    
    ${
      args.dimensionType === 'radial'
        ? `
    Set swDispDim = swModel.AddRadialDimension2( _
        ${args.position.x / 1000}, ${args.position.y / 1000}, 0)`
        : ''
    }
    
    ${
      args.dimensionType === 'diameter'
        ? `
    Set swDispDim = swModel.AddDiameterDimension2( _
        ${args.position.x / 1000}, ${args.position.y / 1000}, 0)`
        : ''
    }
    
    ${
      args.dimensionType === 'ordinate'
        ? `
    Set swDispDim = swModel.AddOrdinateDimension2( _
        0, ${args.position.x / 1000}, ${args.position.y / 1000}, 0)`
        : ''
    }
    
    If Not swDispDim Is Nothing Then
        Set swDim = swDispDim.GetDimension2(0)
        
        ${args.prefix ? `swDim.SetText swTextPrefix, "${args.prefix}"` : ''}
        ${args.suffix ? `swDim.SetText swTextSuffix, "${args.suffix}"` : ''}
        
        ${
          args.tolerance
            ? `
        ' Set tolerance
        Set swTol = swDim.Tolerance
        swTol.Type = ${
          args.tolerance.type === 'bilateral'
            ? 'swTolBILATERAL'
            : args.tolerance.type === 'limit'
              ? 'swTolLIMIT'
              : args.tolerance.type === 'symmetric'
                ? 'swTolSYMMETRIC'
                : args.tolerance.type === 'basic'
                  ? 'swTolBASIC'
                  : 'swTolNONE'
        }
        ${args.tolerance.upper ? `swTol.SetValues 0, ${args.tolerance.upper / 1000}, ${args.tolerance.lower ? args.tolerance.lower / 1000 : 0}` : ''}`
            : ''
        }
        
        MsgBox "${args.dimensionType} dimension added"
    Else
        MsgBox "Failed to add dimension"
    End If
    
    swModel.ClearSelection2 True
End Sub`;
    },
  },

  {
    name: 'vba_drawing_annotations',
    description: 'Generate VBA for adding annotations to drawings',
    inputSchema: z.object({
      annotationType: z.enum([
        'note',
        'balloon',
        'datum',
        'geometric_tolerance',
        'surface_finish',
        'weld_symbol',
        'center_mark',
        'centerline',
      ]),
      text: z.string().optional().describe('Annotation text'),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      leaderPoints: z
        .array(
          z.object({
            x: z.number(),
            y: z.number(),
          })
        )
        .optional(),
      style: z
        .object({
          fontSize: z.number().optional(),
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          underline: z.boolean().optional(),
        })
        .optional(),
      balloonStyle: z.enum(['circular', 'triangle', 'hexagon', 'box', 'diamond']).optional(),
      itemNumber: z.number().optional(),
    }),
    handler: (args: any) => {
      const annotations: Record<string, string> = {
        note: `
    ' Create note
    Set swNote = swModel.InsertNote("${args.text || 'Note Text'}")
    
    If Not swNote Is Nothing Then
        Set swAnn = swNote.GetAnnotation
        swAnn.SetPosition ${args.position.x / 1000}, ${args.position.y / 1000}, 0
        
        ${
          args.style
            ? `
        ' Set text format
        Dim swTextFormat As SldWorks.TextFormat
        Set swTextFormat = swAnn.GetTextFormat(0)
        ${args.style.fontSize ? `swTextFormat.CharHeight = ${args.style.fontSize / 1000}` : ''}
        ${args.style.bold ? `swTextFormat.Bold = True` : ''}
        ${args.style.italic ? `swTextFormat.Italic = True` : ''}
        ${args.style.underline ? `swTextFormat.Underline = True` : ''}
        swNote.SetTextFormat 0, False, swTextFormat`
            : ''
        }
        
        ${
          args.leaderPoints && args.leaderPoints.length > 0
            ? `
        ' Add leader
        swNote.SetBalloon swBalloonStyle_e.swBS_None, swBalloonFit_e.swBF_Tightest
        Dim leaderInfo As SldWorks.Leader
        Set leaderInfo = swNote.GetLeader
        leaderInfo.SetLeader2 True, swLeaderSide_e.swLS_SMART, True, False, False, False`
            : ''
        }
        
        MsgBox "Note added"
    End If`,
        balloon: `
    ' Create balloon
    Set swNote = swModel.InsertNote("${args.itemNumber || '1'}")
    
    If Not swNote Is Nothing Then
        Set swAnn = swNote.GetAnnotation
        swAnn.SetPosition ${args.position.x / 1000}, ${args.position.y / 1000}, 0
        
        ' Set balloon style
        swNote.SetBalloon _
            ${
              args.balloonStyle === 'circular'
                ? 'swBS_Circular'
                : args.balloonStyle === 'triangle'
                  ? 'swBS_Triangle'
                  : args.balloonStyle === 'hexagon'
                    ? 'swBS_Hexagon'
                    : args.balloonStyle === 'box'
                      ? 'swBS_Box'
                      : 'swBS_Circular'
            }, _
            swBF_Tightest
        
        ${
          args.leaderPoints && args.leaderPoints.length > 0
            ? `
        ' Attach leader to component
        swModel.Extension.SelectByID2 "", "EDGE", _
            ${args.leaderPoints[0].x / 1000}, _
            ${args.leaderPoints[0].y / 1000}, 0, _
            False, 0, Nothing, 0
        
        Dim leaderInfo As SldWorks.Leader
        Set leaderInfo = swNote.GetLeader
        leaderInfo.SetLeader2 True, swLS_SMART, True, False, False, False`
            : ''
        }
        
        MsgBox "Balloon added"
    End If`,
        geometric_tolerance: `
    ' Create geometric tolerance
    Set swGtol = swModel.InsertGtol
    
    If Not swGtol Is Nothing Then
        swGtol.SetFrameValues 1, "${args.text || '⟂0.01 A'}", "", "", "", ""
        Set swAnn = swGtol.GetAnnotation
        swAnn.SetPosition ${args.position.x / 1000}, ${args.position.y / 1000}, 0
        
        MsgBox "Geometric tolerance added"
    End If`,
        surface_finish: `
    ' Create surface finish symbol
    Set swSFSymbol = swModel.InsertSurfaceFinishSymbol3( _
        swSurfaceFinishStandard_e.swSurfaceFinishStandard_ISO, _
        swSFLaySymType_e.swSFLaySym_None, _
        swSurfaceFinishSymbol_e.swSFMachiningRequired, _
        "${args.text || '1.6'}", "", "", "", "", "")
    
    If Not swSFSymbol Is Nothing Then
        Set swAnn = swSFSymbol.GetAnnotation
        swAnn.SetPosition ${args.position.x / 1000}, ${args.position.y / 1000}, 0
        
        MsgBox "Surface finish symbol added"
    End If`,
        weld_symbol: `
    ' Create weld symbol
    Set swWeldSymbol = swModel.InsertWeldSymbol3
    
    If Not swWeldSymbol Is Nothing Then
        ' Configure weld symbol
        swWeldSymbol.SetWeldSymbol True, "Fillet", "${args.text || '5'}", "", "", ""
        Set swAnn = swWeldSymbol.GetAnnotation
        swAnn.SetPosition ${args.position.x / 1000}, ${args.position.y / 1000}, 0
        
        MsgBox "Weld symbol added"
    End If`,
        center_mark: `
    ' Create center mark
    swModel.Extension.SelectByID2 "", "EDGE", _
        ${args.position.x / 1000}, ${args.position.y / 1000}, 0, _
        False, 0, Nothing, 0
    
    Set swCenterMark = swModel.AddCenterMark( _
        swCenterMarkConnectionLine_e.swCenterMark_ConnectionLines, _
        swCenterMarkGapDistance_e.swCenterMark_GapDistance)
    
    If Not swCenterMark Is Nothing Then
        MsgBox "Center mark added"
    End If`,
      };

      return `
Sub AddAnnotation_${args.annotationType}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swDraw As SldWorks.DrawingDoc
    Dim swNote As SldWorks.Note
    Dim swAnn As SldWorks.Annotation
    Dim swGtol As SldWorks.Gtol
    Dim swSFSymbol As SldWorks.SurfaceFinishSymbol
    Dim swWeldSymbol As SldWorks.WeldSymbol
    Dim swCenterMark As SldWorks.CenterMark
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Or swModel.GetType <> swDocumentTypes_e.swDocDRAWING Then
        MsgBox "Please open a drawing document"
        Exit Sub
    End If
    
    Set swDraw = swModel
    
    ${annotations[args.annotationType] || annotations.note}
    
    swModel.EditRebuild3
End Sub`;
    },
  },

  {
    name: 'vba_drawing_tables',
    description: 'Generate VBA for creating tables in drawings',
    inputSchema: z.object({
      tableType: z.enum(['general', 'hole', 'revision', 'bom', 'weldment_cutlist']),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      rows: z.number().optional(),
      columns: z.number().optional(),
      headers: z.array(z.string()).optional(),
      data: z.array(z.array(z.string())).optional(),
      template: z.string().optional().describe('Path to table template'),
      anchorType: z.enum(['top_left', 'top_right', 'bottom_left', 'bottom_right']).optional(),
    }),
    handler: (args: any) => {
      return `
Sub CreateTable_${args.tableType}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swDraw As SldWorks.DrawingDoc
    Dim swTable As SldWorks.TableAnnotation
    Dim swBOMTable As SldWorks.BomTableAnnotation
    Dim i As Integer, j As Integer
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Or swModel.GetType <> swDocumentTypes_e.swDocDRAWING Then
        MsgBox "Please open a drawing document"
        Exit Sub
    End If
    
    Set swDraw = swModel
    
    ${
      args.tableType === 'general'
        ? `
    ' Create general table
    Set swTable = swDraw.InsertTableAnnotation2( _
        False, ${args.position.x / 1000}, ${args.position.y / 1000}, _
        ${
          args.anchorType === 'top_right'
            ? 'swBOMConfigurationAnchor_TopRight'
            : args.anchorType === 'bottom_left'
              ? 'swBOMConfigurationAnchor_BottomLeft'
              : args.anchorType === 'bottom_right'
                ? 'swBOMConfigurationAnchor_BottomRight'
                : 'swBOMConfigurationAnchor_TopLeft'
        }, _
        "${args.template || ''}", _
        ${args.rows || 5}, ${args.columns || 3})
    
    If Not swTable Is Nothing Then
        ' Set headers
        ${
          args.headers
            ? args.headers
                .map(
                  (header: string, i: number) => `
        swTable.Text(0, ${i}) = "${header}"`
                )
                .join('\n        ')
            : ''
        }
        
        ' Set data
        ${
          args.data
            ? args.data
                .map((row: string[], i: number) =>
                  row
                    .map(
                      (cell: string, j: number) => `
        swTable.Text(${i + 1}, ${j}) = "${cell}"`
                    )
                    .join('')
                )
                .join('')
            : ''
        }
        
        MsgBox "General table created"
    End If`
        : ''
    }
    
    ${
      args.tableType === 'hole'
        ? `
    ' Create hole table
    Set swTable = swDraw.InsertHoleTable2( _
        "${args.template || ''}", _
        ${args.position.x / 1000}, ${args.position.y / 1000}, _
        ${
          args.anchorType === 'top_right'
            ? 'swBOMConfigurationAnchor_TopRight'
            : args.anchorType === 'bottom_left'
              ? 'swBOMConfigurationAnchor_BottomLeft'
              : args.anchorType === 'bottom_right'
                ? 'swBOMConfigurationAnchor_BottomRight'
                : 'swBOMConfigurationAnchor_TopLeft'
        }, _
        "A", True)
    
    If Not swTable Is Nothing Then
        MsgBox "Hole table created"
    End If`
        : ''
    }
    
    ${
      args.tableType === 'revision'
        ? `
    ' Create revision table
    Set swTable = swDraw.InsertRevisionTable2( _
        True, ${args.position.x / 1000}, ${args.position.y / 1000}, _
        ${
          args.anchorType === 'top_right'
            ? 'swBOMConfigurationAnchor_TopRight'
            : args.anchorType === 'bottom_left'
              ? 'swBOMConfigurationAnchor_BottomLeft'
              : args.anchorType === 'bottom_right'
                ? 'swBOMConfigurationAnchor_BottomRight'
                : 'swBOMConfigurationAnchor_TopLeft'
        }, _
        "${args.template || ''}")
    
    If Not swTable Is Nothing Then
        ' Add revision
        swTable.AddRevision "A"
        swTable.Text(1, 0) = "A"
        swTable.Text(1, 1) = Format(Date, "mm/dd/yyyy")
        swTable.Text(1, 2) = "Initial Release"
        swTable.Text(1, 3) = Application.UserName
        
        MsgBox "Revision table created"
    End If`
        : ''
    }
    
    ${
      args.tableType === 'bom'
        ? `
    ' Create BOM table
    Dim swBOMFeature As SldWorks.BomFeature
    Set swBOMFeature = swDraw.FeatureManager.InsertBomTable3( _
        "${args.template || ''}", _
        ${args.position.x / 1000}, ${args.position.y / 1000}, _
        swBomType_e.swBomType_PartsOnly, _
        "", _
        swBOMConfigurationAnchorType_e.swBOMConfigurationAnchor_TopLeft, _
        swBomStandard_e.swBomStandard_BomTable, _
        False)
    
    If Not swBOMFeature Is Nothing Then
        Set swBOMTable = swBOMFeature.GetTableAnnotations(0)
        Set swTable = swBOMTable
        
        ' Configure BOM
        swTable.Title = "BILL OF MATERIALS"
        
        MsgBox "BOM table created"
    End If`
        : ''
    }
    
    ' Format table
    If Not swTable Is Nothing Then
        ' Auto-fit columns
        For j = 0 To swTable.ColumnCount - 1
            swTable.SetColumnWidth j, -1, swTableRowColSizeType_e.swAutoSizeFitText
        Next j
        
        ' Set row height
        For i = 0 To swTable.RowCount - 1
            swTable.SetRowHeight i, 10 / 1000, swTableRowColSizeType_e.swManualSizing
        Next i
    End If
    
    swModel.EditRebuild3
End Sub`;
    },
  },

  {
    name: 'vba_drawing_sheet_format',
    description: 'Generate VBA for managing drawing sheets and formats',
    inputSchema: z.object({
      operation: z.enum(['create_sheet', 'modify_format', 'title_block', 'border']),
      sheetName: z.string().optional(),
      sheetSize: z.enum(['A4', 'A3', 'A2', 'A1', 'A0', 'Letter', 'Legal', 'Tabloid', 'Custom']).optional(),
      customSize: z
        .object({
          width: z.number(),
          height: z.number(),
        })
        .optional(),
      scale: z.string().optional().describe('Sheet scale (e.g., "1:2")'),
      templatePath: z.string().optional(),
      titleBlockData: z.record(z.string()).optional(),
    }),
    handler: (args: any) => {
      const sheetSizes: Record<string, [number, number]> = {
        A4: [210, 297],
        A3: [297, 420],
        A2: [420, 594],
        A1: [594, 841],
        A0: [841, 1189],
        Letter: [215.9, 279.4],
        Legal: [215.9, 355.6],
        Tabloid: [279.4, 431.8],
      };

      return `
Sub ManageDrawingSheet_${args.operation}()
    Dim swApp As SldWorks.SldWorks
    Dim swModel As SldWorks.ModelDoc2
    Dim swDraw As SldWorks.DrawingDoc
    Dim swSheet As SldWorks.Sheet
    Dim vSheetProps As Variant
    Dim bRet As Boolean
    
    Set swApp = Application.SldWorks
    Set swModel = swApp.ActiveDoc
    
    If swModel Is Nothing Or swModel.GetType <> swDocumentTypes_e.swDocDRAWING Then
        MsgBox "Please open a drawing document"
        Exit Sub
    End If
    
    Set swDraw = swModel
    
    ${
      args.operation === 'create_sheet'
        ? `
    ' Create new sheet
    bRet = swDraw.NewSheet4( _
        "${args.sheetName || 'NewSheet'}", _
        ${
          args.sheetSize && args.sheetSize !== 'Custom'
            ? `swDwgPaperSizes_e.swDwgPaper${args.sheetSize}size`
            : 'swDwgPaperSizes_e.swDwgPapersUserDefined'
        }, _
        ${args.templatePath ? `"${args.templatePath}"` : 'swDwgTemplates_e.swDwgTemplateNone'}, _
        ${args.scale ? args.scale.split(':')[0] : '1'}, _
        ${args.scale ? args.scale.split(':')[1] : '1'}, _
        True, "", _
        ${args.customSize ? args.customSize.width / 1000 : sheetSizes[args.sheetSize || 'A4'][0] / 1000}, _
        ${args.customSize ? args.customSize.height / 1000 : sheetSizes[args.sheetSize || 'A4'][1] / 1000}, _
        "Default", True)
    
    If bRet Then
        MsgBox "New sheet created: ${args.sheetName || 'New Sheet'}"
    Else
        MsgBox "Failed to create sheet"
    End If`
        : ''
    }
    
    ${
      args.operation === 'modify_format'
        ? `
    ' Modify sheet format
    Set swSheet = swDraw.GetCurrentSheet
    
    If Not swSheet Is Nothing Then
        ' Set sheet properties
        vSheetProps = swSheet.GetProperties2
        
        ' Update scale
        ${
          args.scale
            ? `
        Dim scaleNum As Double, scaleDenom As Double
        scaleNum = ${args.scale.split(':')[0]}
        scaleDenom = ${args.scale.split(':')[1]}
        swSheet.SetScale scaleNum, scaleDenom, True, True`
            : ''
        }
        
        ' Update size
        ${
          args.sheetSize
            ? `
        swSheet.SetSize _
            ${sheetSizes[args.sheetSize][0] / 1000}, _
            ${sheetSizes[args.sheetSize][1] / 1000}`
            : ''
        }
        
        MsgBox "Sheet format updated"
    End If`
        : ''
    }
    
    ${
      args.operation === 'title_block'
        ? `
    ' Update title block
    Set swSheet = swDraw.GetCurrentSheet
    
    If Not swSheet Is Nothing Then
        ' Get title block
        Dim swView As SldWorks.View
        Set swView = swDraw.GetFirstView ' This is the sheet itself
        
        ' Find and update title block notes
        ${
          args.titleBlockData
            ? Object.entries(args.titleBlockData)
                .map(
                  ([key, value]) => `
        swModel.Extension.SelectByID2 "$PRPSHEET:\\"${key}\\"", "NOTE", 0, 0, 0, False, 0, Nothing, 0
        Dim swNote As SldWorks.Note
        Set swNote = swModel.SelectionManager.GetSelectedObject6(1, -1)
        If Not swNote Is Nothing Then
            swNote.SetText "${value}"
        End If`
                )
                .join('\n        ')
            : ''
        }
        
        ' Update custom properties
        Dim swCustProp As SldWorks.CustomPropertyManager
        Set swCustProp = swModel.Extension.CustomPropertyManager("")
        
        ${
          args.titleBlockData
            ? Object.entries(args.titleBlockData)
                .map(
                  ([key, value]) => `
        swCustProp.Add3 "${key}", swCustomInfoType_e.swCustomInfoText, "${value}", _
            swCustomPropertyAddOption_e.swCustomPropertyReplaceValue`
                )
                .join('\n        ')
            : ''
        }
        
        MsgBox "Title block updated"
    End If`
        : ''
    }
    
    swModel.EditRebuild3
End Sub`;
    },
  },
];
