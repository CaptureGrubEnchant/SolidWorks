import { loadWinax } from '../adapters/winax-loader.js';
import { logger } from '../utils/logger.js';
import { runMacro2, SW_RUN_MACRO_UNLOAD_AFTER_RUN } from './run-macro2.js';
import type { SolidWorksFeature, SolidWorksModel } from './types.js';

let winax: any = null;

export class SolidWorksAPI {
  private swApp: any;
  private currentModel: any;

  constructor() {
    this.swApp = null;
    this.currentModel = null;
  }

  connect(): void {
    if (!winax) winax = loadWinax();
    try {
      // Create or get running instance of SolidWorks
      this.swApp = new winax.Object('SldWorks.Application');
      this.swApp.Visible = true;
      logger.info('Connected to SolidWorks');
    } catch (_error) {
      // Try alternative connection method
      try {
        this.swApp = winax.Object('SldWorks.Application');
        this.swApp.Visible = true;
        logger.info('Connected to SolidWorks (alternative method)');
      } catch (error2) {
        logger.error('Failed to connect to SolidWorks', error2);
        throw new Error(`Failed to connect to SolidWorks: ${error2}`);
      }
    }
  }

  disconnect(): void {
    if (this.currentModel) {
      this.currentModel = null;
    }
    if (this.swApp) {
      // Don't close SolidWorks, just disconnect
      this.swApp = null;
    }
  }

  isConnected(): boolean {
    return this.swApp !== null;
  }

  // Model operations
  openModel(filePath: string): SolidWorksModel {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    const errors = { value: 0 };
    const warnings = { value: 0 };

    // Determine file type from extension
    const ext = filePath.toLowerCase().split('.').pop();
    let docType = 1; // swDocPART
    if (ext === 'sldasm') docType = 2; // swDocASSEMBLY
    if (ext === 'slddrw') docType = 3; // swDocDRAWING

    this.currentModel = this.swApp.OpenDoc6(
      filePath,
      docType,
      1, // swOpenDocOptions_Silent
      '',
      errors,
      warnings
    );

    if (!this.currentModel) {
      throw new Error(`Failed to open model: ${filePath}`);
    }

    // Ensure the opened model is set as active
    try {
      this.swApp.ActivateDoc2(this.currentModel.GetTitle(), false, errors);
    } catch (_e) {
      // ActivateDoc2 might fail but model is still open
    }

    return {
      path: filePath,
      name: this.currentModel.GetTitle(),
      type: ['Part', 'Assembly', 'Drawing'][docType - 1] as 'Part' | 'Assembly' | 'Drawing',
      isActive: true,
    };
  }

  closeModel(save: boolean = false): void {
    if (!this.currentModel) return;

    let modelTitle = '';
    try {
      // Safely get the title
      if (this.currentModel.GetTitle) {
        modelTitle = this.currentModel.GetTitle();
      } else if (this.currentModel.GetPathName) {
        modelTitle = this.currentModel.GetPathName();
      }
    } catch (_e) {
      // If we can't get the title, continue anyway
      modelTitle = 'Unknown';
    }

    if (save) {
      try {
        this.currentModel.Save3(1, 0, 0); // swSaveAsOptions_Silent
      } catch (_e) {
        // Save might fail if document is new and has no path
        try {
          // Try Save instead
          this.currentModel.Save();
        } catch (_e2) {
          // Continue even if save fails
        }
      }
    }

    // Close using app method if title is available
    if (modelTitle && modelTitle !== 'Unknown' && this.swApp) {
      try {
        this.swApp.CloseDoc(modelTitle);
      } catch (_e) {
        // Fallback: just clear the reference
      }
    }

    this.currentModel = null;
  }

  createPart(): SolidWorksModel {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    // Create new part document - use NewPart() which works better
    this.currentModel = this.swApp.NewPart();

    if (!this.currentModel) {
      // Fallback to NewDocument if NewPart fails
      const template = this.swApp.GetUserPreferenceStringValue(8) || '';
      if (template) {
        this.currentModel = this.swApp.NewDocument(template, 0, 0, 0);
      } else {
        throw new Error('Failed to create new part - no template available');
      }
    }

    return {
      path: '',
      name: this.currentModel.GetTitle,
      type: 'Part',
      isActive: true,
    };
  }

  // Macro support methods
  createSketch(params: any): any {
    if (!this.currentModel) throw new Error('No active model');

    const { plane = 'Front' } = params;
    const planeRef = this.currentModel.FeatureManager.GetPlane(plane);

    if (planeRef) {
      this.currentModel.SketchManager.InsertSketch(true);
      const sketchName = this.currentModel.SketchManager.ActiveSketch.Name;
      return { success: true, sketchId: sketchName };
    }

    return { success: false, error: 'Failed to create sketch' };
  }

  addLine(params: any): any {
    if (!this.currentModel) throw new Error('No active model');

    const { x1 = 0, y1 = 0, z1 = 0, x2 = 100, y2 = 0, z2 = 0 } = params;

    const line = this.currentModel.SketchManager.CreateLine(
      x1 / 1000,
      y1 / 1000,
      z1 / 1000, // Convert mm to m
      x2 / 1000,
      y2 / 1000,
      z2 / 1000
    );

    if (line) {
      return { success: true, lineId: `line_${Date.now()}` };
    }

    return { success: false, error: 'Failed to create line' };
  }

  extrude(params: any): any {
    if (!this.currentModel) throw new Error('No active model');

    const { depth = 25, reverse = false, draft = 0 } = params;

    const feature = this.createExtrude(depth, draft, reverse);

    if (feature) {
      return { success: true, featureId: feature.name };
    }

    return { success: false, error: 'Failed to create extrusion' };
  }

  // Feature operations
  createExtrude(depth: number, draft: number = 0, reverse: boolean = false): SolidWorksFeature {
    if (!this.currentModel) throw new Error('No model open');

    try {
      // Get the feature manager
      const featureMgr = this.currentModel.FeatureManager;
      if (!featureMgr) {
        throw new Error('Cannot access FeatureManager');
      }

      // Make sure we're not in sketch edit mode
      try {
        const sketchMgr = this.currentModel.SketchManager;
        const activeSketch = sketchMgr.ActiveSketch;
        if (activeSketch) {
          // Exit sketch mode
          sketchMgr.InsertSketch(true);
        }
      } catch (_e) {
        // Continue if no active sketch
      }

      // Clear selections first
      try {
        this.currentModel.ClearSelection2(true);
      } catch (_e) {
        // Continue
      }

      // Select the sketch - try multiple methods with detailed logging
      let sketchSelected = false;
      let selectedSketchName = '';
      const attemptedSketches: string[] = [];

      // Method 1 (most reliable): Feature tree traversal
      // This avoids SelectByID2 COM type mismatch issues entirely
      try {
        const featureCount = this.currentModel.GetFeatureCount();
        logger.info(`Searching ${featureCount} features for sketch...`);

        for (let i = 0; i < Math.min(10, featureCount); i++) {
          const feat = this.currentModel.FeatureByPositionReverse(i);
          if (feat) {
            const typeName = feat.GetTypeName2();
            const featName = feat.Name || feat.GetName();

            if (typeName === 'ProfileFeature' || typeName?.toLowerCase().includes('sketch')) {
              feat.Select2(false, 0);
              sketchSelected = true;
              selectedSketchName = featName || `Feature at position ${i}`;
              logger.info(`Selected sketch by feature tree: ${selectedSketchName}`);
              break;
            }
          }
        }
      } catch (e) {
        logger.warn(`Feature tree search failed: ${e}`);
      }

      // Method 2 (fallback): SelectByID2 with undefined for optional params
      if (!sketchSelected) {
        const sketchNames = ['Sketch1', 'Sketch2', 'Sketch3', 'Sketch4', 'Sketch5'];
        for (const name of sketchNames) {
          try {
            const ext = this.currentModel.Extension;
            if (ext) {
              const selected = ext.SelectByID2(name, 'SKETCH', 0, 0, 0, false, 0, undefined, 0);
              if (selected) {
                sketchSelected = true;
                selectedSketchName = name;
                logger.info(`Selected sketch via SelectByID2: ${name}`);
                break;
              } else {
                attemptedSketches.push(name);
              }
            }
          } catch (e) {
            attemptedSketches.push(`${name} (error: ${e})`);
          }
        }
      }

      if (!sketchSelected) {
        const errorMessage =
          `No sketch found to extrude. Attempted sketches: ${attemptedSketches.join(', ')}. ` +
          `Please ensure a sketch exists or specify the sketch name explicitly.`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }

      logger.info(`Using sketch: ${selectedSketchName}`);

      // Convert depth to meters and draft angle to radians (SolidWorks COM
      // takes SI units; the MCP tool takes mm and degrees).
      const depthInMeters = depth / 1000;
      const draftRadians = (draft * Math.PI) / 180;

      // Direct FeatureExtrusion3 call, canonical 23-argument signature.
      //
      // This replaced a chain of four FeatureExtrusion attempts (apply /
      // __methods__ / Variant / plain) followed by a .swp macro fallback. All
      // five paths were broken on SolidWorks 2024+:
      //
      //   • The four direct attempts called `FeatureExtrusion` with no version
      //     suffix. That obsolete entry point raises a type mismatch on modern
      //     SolidWorks; `FeatureExtrusion3` is the supported API.
      //   • The macro fallback wrote plain-text VBA to a `.swp` file, but
      //     `.swp` is an OLE Compound Document that RunMacro2 cannot parse —
      //     the same defect issue #25 fixed in winax-adapter.ts.
      //   • That RunMacro2 call also passed its OUT error param as a literal
      //     `0`, which fails COM dispatch before the file is even read (see
      //     run-macro2.ts).
      //
      // Stacking broken fallbacks buried the real error four layers deep, so
      // the chain is gone: one call, and its error propagates verbatim.
      //
      // NOTE: FeatureExtrusion3 takes 23 args. `FlipSideToCut` belongs to
      // FeatureCut3 — including it raises "invalid argument count".
      const feature = featureMgr.FeatureExtrusion3(
        true, // 1  Sd: single direction
        reverse, // 2  Flip
        false, // 3  Dir: both directions
        0, // 4  T1: blind end condition
        0, // 5  T2
        depthInMeters, // 6  D1: depth
        0, // 7  D2
        draft !== 0, // 8  Dchk1: draft while extruding
        false, // 9  Dchk2
        false, // 10 Ddir1: draft outward
        false, // 11 Ddir2
        draftRadians, // 12 Dang1: draft angle
        0, // 13 Dang2
        false, // 14 OffsetReverse1
        false, // 15 OffsetReverse2
        false, // 16 TranslateSurface1
        false, // 17 TranslateSurface2
        true, // 18 Merge
        true, // 19 UseFeatScope
        true, // 20 UseAutoSelect
        0, // 21 T0: start condition
        0, // 22 StartOffset
        false // 23 FlipStartOffset
      );

      if (!feature) {
        throw new Error('Failed to create extrusion - feature is null');
      }

      // Get feature name
      let featureName = 'Boss-Extrude1';
      try {
        if (feature.Name) {
          featureName = feature.Name;
        } else if (feature.GetName) {
          featureName = feature.GetName();
        }
      } catch (_e) {
        // Use default name
      }

      // Clear selections
      try {
        this.currentModel.ClearSelection2(true);
      } catch (_e) {
        // Ignore
      }

      // Rebuild
      try {
        this.currentModel.EditRebuild3();
      } catch (_e) {
        try {
          this.currentModel.EditRebuild();
        } catch (_e2) {
          // Continue
        }
      }

      return {
        name: featureName,
        type: 'Extrusion',
        suppressed: false,
      };
    } catch (error) {
      throw new Error(`Extrusion failed: ${error}`);
    }
  }

  // Dimension operations
  getDimension(name: string): number {
    if (!this.currentModel) throw new Error('No model open');

    let dimension = null;

    // Method 1: Try Parameter method
    try {
      dimension = this.currentModel.Parameter(name);
    } catch (_e) {
      // Parameter might not work
    }

    // Method 2: Try GetParameter
    if (!dimension) {
      try {
        dimension = this.currentModel.GetParameter(name);
      } catch (_e) {
        // GetParameter might not work
      }
    }

    // Method 3: Try Extension.GetParameter
    if (!dimension) {
      try {
        const ext = this.currentModel.Extension;
        if (ext) {
          dimension = ext.GetParameter(name);
        }
      } catch (_e) {
        // Extension method might not work
      }
    }

    // Method 4: Try SelectByID and get dimension
    if (!dimension) {
      try {
        const selected = this.currentModel.Extension.SelectByID2(name, 'DIMENSION', 0, 0, 0, false, 0, undefined, 0);
        if (selected) {
          const selMgr = this.currentModel.SelectionManager;
          if (selMgr && selMgr.GetSelectedObjectCount() > 0) {
            const obj = selMgr.GetSelectedObject6(1, -1);
            if (obj) {
              dimension = obj;
            }
          }
          this.currentModel.ClearSelection2(true);
        }
      } catch (_e) {
        // Selection method failed
      }
    }

    if (!dimension) {
      throw new Error(`Dimension "${name}" not found. Try format like "D1@Sketch1" or "D1@Boss-Extrude1"`);
    }

    // Get the value - try different properties
    let value = 0;
    try {
      if (dimension.SystemValue !== undefined) {
        value = dimension.SystemValue * 1000; // Convert m to mm
      } else if (dimension.Value !== undefined) {
        value = dimension.Value * 1000;
      } else if (dimension.GetSystemValue) {
        value = dimension.GetSystemValue() * 1000;
      } else {
        throw new Error('Cannot read dimension value');
      }
    } catch (_e) {
      throw new Error(`Cannot read value of dimension "${name}"`);
    }

    return value;
  }

  setDimension(name: string, value: number): void {
    if (!this.currentModel) throw new Error('No model open');

    let dimension = null;

    // Method 1: Try Parameter method
    try {
      dimension = this.currentModel.Parameter(name);
    } catch (_e) {
      // Parameter might not work
    }

    // Method 2: Try GetParameter
    if (!dimension) {
      try {
        dimension = this.currentModel.GetParameter(name);
      } catch (_e) {
        // GetParameter might not work
      }
    }

    // Method 3: Try Extension.GetParameter
    if (!dimension) {
      try {
        const ext = this.currentModel.Extension;
        if (ext) {
          dimension = ext.GetParameter(name);
        }
      } catch (_e) {
        // Extension method might not work
      }
    }

    // Method 4: Try SelectByID and get dimension
    if (!dimension) {
      try {
        const selected = this.currentModel.Extension.SelectByID2(name, 'DIMENSION', 0, 0, 0, false, 0, undefined, 0);
        if (selected) {
          const selMgr = this.currentModel.SelectionManager;
          if (selMgr && selMgr.GetSelectedObjectCount() > 0) {
            const obj = selMgr.GetSelectedObject6(1, -1);
            if (obj) {
              dimension = obj;
            }
          }
          // Don't clear selection yet - might need it for setting
        }
      } catch (_e) {
        // Selection method failed
      }
    }

    if (!dimension) {
      throw new Error(`Dimension "${name}" not found. Try format like "D1@Sketch1" or "D1@Boss-Extrude1"`);
    }

    // Set the value - try different methods
    const newValue = value / 1000; // Convert mm to m
    let success = false;

    try {
      if (dimension.SystemValue !== undefined) {
        dimension.SystemValue = newValue;
        success = true;
      } else if (dimension.Value !== undefined) {
        dimension.Value = newValue;
        success = true;
      } else if (dimension.SetSystemValue) {
        success = dimension.SetSystemValue(newValue);
      } else if (dimension.SetValue) {
        success = dimension.SetValue(newValue);
      }
    } catch (_e) {
      // Try equation manager
      try {
        const eqMgr = this.currentModel.GetEquationMgr();
        if (eqMgr) {
          const count = eqMgr.GetCount();
          for (let i = 0; i < count; i++) {
            const eq = eqMgr.Equation[i];
            if (eq?.includes(name)) {
              eqMgr.Equation[i] = `"${name}" = ${value}`;
              success = true;
              break;
            }
          }
        }
      } catch (_e2) {
        // Equation manager failed
      }
    }

    // Clear selection if we used it
    try {
      this.currentModel.ClearSelection2(true);
    } catch (_e) {
      // Ignore clear selection errors
    }

    if (!success) {
      throw new Error(`Failed to set dimension "${name}" to ${value}mm`);
    }

    this.currentModel.EditRebuild3();
  }

  // Export operations
  exportFile(filePath: string, format: string): void {
    if (!this.currentModel) throw new Error('No model open');

    try {
      // Ensure the model is saved first
      const currentPath = this.currentModel.GetPathName();
      if (!currentPath || currentPath === '') {
        // Save the model first if it hasn't been saved
        const docType = this.currentModel.GetType();
        const ext = docType === 1 ? '.SLDPRT' : docType === 2 ? '.SLDASM' : '.SLDDRW';
        const tempPath = filePath.replace(/\.[^.]+$/, ext);
        this.currentModel.SaveAs3(tempPath, 0, 1);
      }

      const ext = format.toLowerCase();
      let success = false;
      const errors = 0;
      const warnings = 0;

      // Try different export methods based on format
      switch (ext) {
        case 'step':
        case 'stp':
          // Method 1: Try SaveAs3 with proper file extension
          try {
            success = this.currentModel.SaveAs3(filePath, 0, 2);
            if (!success) {
              // Method 2: Try Extension.SaveAs with swSaveAsCurrentVersion flag
              success = this.currentModel.Extension.SaveAs(filePath, 0, 2, undefined, errors, warnings);
            }
          } catch (_e) {
            // Method 3: Try GetExportFileData approach
            try {
              const exportData = this.swApp.GetExportFileData(1);
              if (exportData) {
                exportData.SetStep203(true);
                success = this.currentModel.Extension.SaveAs(filePath, 0, 2, exportData, errors, warnings);
              }
            } catch (e2) {
              throw new Error(`Failed to export to STEP: ${e2}`);
            }
          }
          break;

        case 'iges':
        case 'igs':
          // Method 1: Try SaveAs3 with proper flags
          try {
            success = this.currentModel.SaveAs3(filePath, 0, 2);
            if (!success) {
              // Method 2: Try Extension.SaveAs
              success = this.currentModel.Extension.SaveAs(filePath, 0, 2, undefined, errors, warnings);
            }
          } catch (e) {
            throw new Error(`Failed to export to IGES: ${e}`);
          }
          break;

        case 'stl':
          // STL specific - try different methods
          try {
            // Method 1: SaveAs3 with proper flags
            success = this.currentModel.SaveAs3(filePath, 0, 2);
            if (!success) {
              // Method 2: Try SaveAs4 if available
              try {
                success = this.currentModel.SaveAs4(filePath, 0, 2, errors, warnings);
              } catch (_e2) {
                // Method 3: Try Extension.SaveAs
                success = this.currentModel.Extension.SaveAs(filePath, 0, 2, undefined, errors, warnings);
              }
            }
          } catch (e) {
            throw new Error(`Failed to export to STL: ${e}`);
          }
          break;

        case 'pdf': {
          // PDF export requires drawing
          const docType = this.currentModel.GetType();
          if (docType !== 3) {
            // 3 = swDocDRAWING
            throw new Error('PDF export requires a drawing document');
          }
          try {
            success = this.currentModel.SaveAs3(filePath, 0, 2);
            if (!success) {
              success = this.currentModel.Extension.SaveAs(filePath, 0, 2, undefined, errors, warnings);
            }
          } catch (e) {
            throw new Error(`Failed to export to PDF: ${e}`);
          }
          break;
        }

        case 'dxf':
        case 'dwg':
          // DXF/DWG export - mainly for drawings
          try {
            success = this.currentModel.SaveAs3(filePath, 0, 2);
            if (!success) {
              success = this.currentModel.Extension.SaveAs(filePath, 0, 2, undefined, errors, warnings);
            }
          } catch (e) {
            throw new Error(`Failed to export to ${format.toUpperCase()}: ${e}`);
          }
          break;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      if (!success) {
        throw new Error(`Failed to export to ${format.toUpperCase()}: Export returned false`);
      }
    } catch (error) {
      throw new Error(`Export failed: ${error}`);
    }
  }

  // VBA operations
  runMacro(macroPath: string, moduleName: string, procedureName: string, _args: any[] = []): any {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    // The OUT error param must be a byref Long — see run-macro2.ts.
    const { success, errorCode } = runMacro2(
      this.swApp,
      macroPath,
      moduleName,
      procedureName,
      SW_RUN_MACRO_UNLOAD_AFTER_RUN
    );

    if (!success) {
      throw new Error(
        `RunMacro2 failed for ${moduleName}.${procedureName} in ${macroPath} (swRunMacroError_e ${errorCode})`
      );
    }

    return success;
  }

  // Mass properties
  getMassProperties(): any {
    this.ensureCurrentModel();
    if (!this.currentModel) throw new Error('No model open');

    // Check document type - mass properties only work for parts and assemblies
    const docType = this.currentModel.GetType();
    if (docType !== 1 && docType !== 2) {
      // 1=Part, 2=Assembly
      throw new Error('Mass properties only available for parts and assemblies');
    }

    try {
      // Get the modeler extension
      const modeler = this.currentModel.Extension;
      if (!modeler) {
        throw new Error('Cannot access model extension');
      }

      // Create mass property object
      let massProps = null;

      try {
        // Method 1: Try CreateMassProperty
        massProps = modeler.CreateMassProperty();
      } catch (_e) {
        // Method 2: Try CreateMassProperty2
        try {
          massProps = modeler.CreateMassProperty2();
        } catch (_e2) {
          // Method 3: Try getting it from the model directly
          massProps = this.currentModel.GetMassProperties();
        }
      }

      if (!massProps) {
        throw new Error('Failed to create mass property object');
      }

      // Update mass properties if method exists
      try {
        if (massProps.Update) {
          const success = massProps.Update();
          if (!success) {
            // Try recalculate
            if (massProps.Recalculate) {
              massProps.Recalculate();
            }
          }
        }
      } catch (_e) {
        // Update might not be needed
      }

      // Get the values with error handling
      const result: any = {};

      try {
        result.mass = massProps.Mass;
      } catch (_e) {
        result.mass = 0;
      }

      try {
        result.volume = massProps.Volume;
      } catch (_e) {
        result.volume = 0;
      }

      try {
        result.surfaceArea = massProps.SurfaceArea;
      } catch (_e) {
        result.surfaceArea = 0;
      }

      try {
        const com = massProps.CenterOfMass;
        if (com && Array.isArray(com) && com.length >= 3) {
          result.centerOfMass = {
            x: com[0] * 1000, // Convert to mm
            y: com[1] * 1000,
            z: com[2] * 1000,
          };
        } else {
          result.centerOfMass = { x: 0, y: 0, z: 0 };
        }
      } catch (_e) {
        result.centerOfMass = { x: 0, y: 0, z: 0 };
      }

      try {
        result.density = massProps.Density;
      } catch (_e) {
        result.density = 0;
      }

      try {
        const moi = massProps.MomentOfInertia;
        if (moi && Array.isArray(moi) && moi.length >= 9) {
          result.momentsOfInertia = {
            Ixx: moi[0],
            Ixy: moi[1],
            Ixz: moi[2],
            Iyx: moi[3],
            Iyy: moi[4],
            Iyz: moi[5],
            Izx: moi[6],
            Izy: moi[7],
            Izz: moi[8],
          };
        }
      } catch (_e) {
        // Moments of inertia might not be available
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get mass properties: ${error}`);
    }
  }

  // Helper to ensure current model is set
  private ensureCurrentModel(): void {
    if (!this.swApp) return;

    // Always try to sync with the active document
    try {
      const activeDoc = this.swApp.ActiveDoc;
      if (activeDoc) {
        // Check if the active doc has changed
        if (!this.currentModel || this.currentModel !== activeDoc) {
          this.currentModel = activeDoc;
        }
      } else if (!this.currentModel) {
        // No active doc and no current model - try to get any open doc
        try {
          const docCount = this.swApp.GetDocumentCount();
          if (docCount > 0) {
            // Get the first document
            const docs = this.swApp.GetDocuments();
            if (docs && docs.length > 0) {
              this.currentModel = docs[0];
            }
          }
        } catch (_e2) {
          // GetDocumentCount might not be available
        }
      }
    } catch (_e) {
      // ActiveDoc might throw if no documents are open
      // Keep the current model if we have one
      if (!this.currentModel) {
        // Try alternative methods to get a document
        try {
          const frame = this.swApp.Frame();
          if (frame) {
            const modelWindow = frame.ModelWindow();
            if (modelWindow) {
              this.currentModel = modelWindow.ModelDoc;
            }
          }
        } catch (_e3) {
          // Frame method might not work
        }
      }
    }
  }

  // Helper to get current model
  getCurrentModel(): any {
    this.ensureCurrentModel();
    return this.currentModel;
  }

  // Helper to get SolidWorks app
  getApp(): any {
    return this.swApp;
  }
}
