/**
 * Enhanced WinAx Adapter with Intelligent Feature Creation
 *
 * This adapter intelligently decides between direct COM calls and macro fallback
 * based on parameter complexity analysis for ALL SolidWorks features.
 */

import type { SolidWorksFeature, SolidWorksModel } from '../solidworks/types.js';
import { logger } from '../utils/logger.js';
import { FeatureComplexityAnalyzer } from './feature-complexity-analyzer.js';
import type {
  AdapterHealth,
  AdapterResult,
  Command,
  ExtrusionParameters,
  ISolidWorksAdapter,
  LoftParameters,
  MassProperties,
  RevolveParameters,
  SweepParameters,
} from './types.js';
import { loadWinax } from './winax-loader.js';

const END_CONDITION_MAP: Record<string, number> = {
  Blind: 0,
  ThroughAll: 1,
  UpToNext: 2,
  UpToVertex: 3,
  UpToSurface: 4,
  OffsetFromSurface: 5,
  MidPlane: 6,
};

function resolveEndCondition(value: number | string | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return END_CONDITION_MAP[value] ?? 0;
  return 0;
}

let winax: any = null;

export class EnhancedWinAxAdapter implements ISolidWorksAdapter {
  private swApp: any;
  private currentModel: any;
  private metrics = {
    directCOMCalls: 0,
    macroFallbacks: 0,
    failures: 0,
    averageResponseTime: 0,
  };

  constructor() {
    this.swApp = null;
    this.currentModel = null;
  }

  // Connection Management
  async connect(): Promise<void> {
    try {
      if (!winax) winax = loadWinax();
      this.swApp = new winax.Object('SldWorks.Application');
      this.swApp.Visible = true;
      logger.info('Connected to SolidWorks via Enhanced WinAx adapter');
    } catch (error) {
      logger.error('Failed to connect to SolidWorks', error);
      throw new Error(`Failed to connect to SolidWorks: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.currentModel) {
      this.currentModel = null;
    }
    if (this.swApp) {
      this.swApp = null;
    }
    logger.info('Disconnected from SolidWorks');
  }

  isConnected(): boolean {
    return this.swApp !== null;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const healthy = this.isConnected();
    return {
      healthy,
      lastCheck: new Date(),
      errorCount: this.metrics.failures,
      successCount: this.metrics.directCOMCalls + this.metrics.macroFallbacks,
      averageResponseTime: this.metrics.averageResponseTime,
      connectionStatus: healthy ? 'connected' : 'disconnected',
      metrics: {
        directCOMCalls: this.metrics.directCOMCalls,
        macroFallbacks: this.metrics.macroFallbacks,
        successRate: this.getSuccessRate(),
      },
    };
  }

  private getSuccessRate(): number {
    const total = this.metrics.directCOMCalls + this.metrics.macroFallbacks + this.metrics.failures;
    if (total === 0) return 100;
    return ((this.metrics.directCOMCalls + this.metrics.macroFallbacks) / total) * 100;
  }

  // Feature Creation with Intelligent Fallback

  async createExtrusion(params: ExtrusionParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    const analysis = FeatureComplexityAnalyzer.analyzeExtrusion(params);
    logger.info(`Extrusion analysis: ${JSON.stringify(analysis)}`);

    if (analysis.strategy === 'direct-com') {
      try {
        return await this.createExtrusionDirect(params);
      } catch (error) {
        logger.warn('FeatureExtrusion2 failed, trying FeatureExtrusion3 with full args', error);
        return await this.createExtrusionFull(params);
      }
    }

    logger.info(`Using FeatureExtrusion3 (full args): ${analysis.reason}`);
    return await this.createExtrusionFull(params);
  }

  private async createExtrusionDirect(params: ExtrusionParameters): Promise<SolidWorksFeature> {
    const startTime = Date.now();

    try {
      // Select sketch
      this.selectSketchForFeature();

      // Simple extrusion with limited parameters (max 12)
      const feature = this.currentModel.FeatureManager.FeatureExtrusion2(
        true, // Sd
        params.reverse || false, // Flip
        params.bothDirections || false, // Dir
        0, // T1 (blind)
        0, // T2
        params.depth / 1000, // D1 (convert mm to m)
        0.0, // D2
        false, // Dchk1
        false, // Dchk2
        params.draft || 0, // Dang1
        0, // Dang2
        false // OffsetReverse1
      );

      if (!feature) {
        throw new Error('FeatureExtrusion2 returned null');
      }

      this.metrics.directCOMCalls++;
      this.updateResponseTime(Date.now() - startTime);

      return {
        name: feature.Name || 'Boss-Extrude1',
        type: 'Extrusion',
        suppressed: false,
      };
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }

  private async createExtrusionFull(params: ExtrusionParameters): Promise<SolidWorksFeature> {
    const startTime = Date.now();

    try {
      this.selectSketchForFeature();

      const depth1 = params.depth / 1000;
      const depth2 = (params.depth2 ?? 0) / 1000;
      const draftRad = ((params.draft ?? 0) * Math.PI) / 180;
      const t1 = resolveEndCondition(params.endCondition);
      const merge = params.merge !== false;
      const sd = !params.bothDirections;

      const feature = this.currentModel.FeatureManager.FeatureExtrusion3(
        sd,
        params.reverse ?? false,
        params.bothDirections ?? false,
        t1,
        0,
        depth1,
        depth2,
        params.draftWhileExtruding ?? (params.draft ?? 0) !== 0,
        false,
        params.draftOutward ?? false,
        false,
        draftRad,
        0,
        params.offsetReverse ?? false,
        false,
        params.translateSurface ?? false,
        false,
        merge, // 18 Merge
        true, // 19 UseFeatScope
        true, // 20 UseAutoSelect
        params.startCondition ?? 0, // 21 T0: start condition
        0, // 22 StartOffset
        false // 23 FlipStartOffset
      );

      if (!feature) {
        throw new Error('FeatureExtrusion3 returned null');
      }

      if (params.thinFeature) {
        const thinTypeMap: Record<string, number> = {
          OneDirection: 0,
          TwoSide: 1,
          MidPlane: 2,
        };
        const thinType = thinTypeMap[params.thinType ?? 'OneDirection'] ?? 0;
        try {
          feature.SetThinWallType(
            thinType,
            (params.thinThickness ?? 1) / 1000,
            0,
            params.capEnds ?? false,
            (params.capThickness ?? 1) / 1000
          );
        } catch (e) {
          logger.warn(`SetThinWallType failed: ${e}`);
        }
      }

      this.metrics.directCOMCalls++;
      this.updateResponseTime(Date.now() - startTime);

      return {
        name: feature.Name || 'Boss-Extrude1',
        type: 'Extrusion',
        suppressed: false,
      };
    } catch (error) {
      this.metrics.failures++;
      throw new Error(`FeatureExtrusion3 failed: ${error}`);
    }
  }

  async createRevolve(params: RevolveParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    const analysis = FeatureComplexityAnalyzer.determineStrategy('FeatureRevolve2', params as any);
    logger.info(`Revolve analysis: ${JSON.stringify(analysis)}`);

    return await this.createRevolveDirect(params);
  }

  private async createRevolveDirect(params: RevolveParameters): Promise<SolidWorksFeature> {
    const startTime = Date.now();

    try {
      this.selectSketchForFeature();

      // FeatureRevolve2 has exactly 12 parameters - right at the limit
      const feature = this.currentModel.FeatureManager.FeatureRevolve2(
        true, // SingleDir
        params.direction === 'Reverse', // IsSolid
        params.direction === 'Both', // IsThin
        false, // Cap
        false, // MakeThinFeature
        (params.angle * Math.PI) / 180, // Angle1
        0, // Angle2
        0, // OffsetDistance1
        0, // OffsetDistance2
        0, // OffsetReverse1
        0, // OffsetReverse2
        params.merge !== false // Merge
      );

      if (!feature) {
        throw new Error('FeatureRevolve2 returned null');
      }

      this.metrics.directCOMCalls++;
      this.updateResponseTime(Date.now() - startTime);

      return {
        name: feature.Name || 'Revolve1',
        type: 'Revolution',
        suppressed: false,
      };
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }

  async createSweep(params: SweepParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    return await this.createSweepDirect(params);
  }

  private async createSweepDirect(params: SweepParameters): Promise<SolidWorksFeature> {
    const startTime = Date.now();

    try {
      const ext = this.currentModel.Extension;
      this.currentModel.ClearSelection2(true);

      const profileSelected = ext.SelectByID2(params.profileSketch, 'SKETCH', 0, 0, 0, false, 1, undefined, 0);
      if (!profileSelected) throw new Error(`Profile sketch not found: ${params.profileSketch}`);

      const pathSelected = ext.SelectByID2(params.pathSketch, 'SKETCH', 0, 0, 0, true, 4, undefined, 0);
      if (!pathSelected) throw new Error(`Path sketch not found: ${params.pathSketch}`);

      const twistRad = ((params.twistAngle ?? 0) * Math.PI) / 180;
      const merge = params.merge !== false;

      const feature = this.currentModel.FeatureManager.InsertProtrusionSwept4(
        false,
        false,
        0,
        twistRad,
        false,
        0,
        0,
        merge,
        params.thinFeature ?? false,
        (params.thinThickness ?? 0) / 1000,
        0,
        true,
        false,
        true
      );

      if (!feature) throw new Error('InsertProtrusionSwept4 returned null');

      this.metrics.directCOMCalls++;
      this.updateResponseTime(Date.now() - startTime);

      return {
        name: feature.Name || 'Sweep1',
        type: 'Sweep',
        suppressed: false,
      };
    } catch (error) {
      this.metrics.failures++;
      throw new Error(`InsertProtrusionSwept4 failed: ${error}`);
    }
  }

  async createLoft(params: LoftParameters): Promise<SolidWorksFeature> {
    if (!this.currentModel) throw new Error('No active model');

    const analysis = FeatureComplexityAnalyzer.determineStrategy('InsertProtrusionLoft3', params as any);
    logger.info(`Loft analysis: ${JSON.stringify(analysis)}`);

    if (analysis.strategy === 'direct-com') {
      try {
        return await this.createLoftDirect(params);
      } catch (error) {
        logger.warn('Simple loft failed, trying InsertProtrusionLoft3 with full args', error);
        return await this.createLoftFull(params);
      }
    }

    return await this.createLoftFull(params);
  }

  private async createLoftDirect(params: LoftParameters): Promise<SolidWorksFeature> {
    const startTime = Date.now();

    try {
      // Select profiles
      for (const profile of params.profiles) {
        this.currentModel.Extension.SelectByID2(profile, 'SKETCH', 0, 0, 0, true, 0, undefined, 0);
      }

      // Simple loft without guides (12 parameters max)
      const feature = this.currentModel.FeatureManager.InsertProtrusionBlend2(
        false, // Closed
        true, // KeepTangency
        false, // ForceNonRational
        true, // ThinFeature
        true, // UseFeatScope
        true, // AutoSelect
        params.profiles.length, // NumberOfSections
        0, // StartConditions
        0, // EndConditions
        0, // StartTangentType
        0, // EndTangentType
        params.merge !== false // Merge
      );

      if (!feature) {
        throw new Error('InsertProtrusionBlend2 returned null');
      }

      this.metrics.directCOMCalls++;
      this.updateResponseTime(Date.now() - startTime);

      return {
        name: feature.Name || 'Loft1',
        type: 'Loft',
        suppressed: false,
      };
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }

  private async createLoftFull(params: LoftParameters): Promise<SolidWorksFeature> {
    const startTime = Date.now();

    try {
      const ext = this.currentModel.Extension;
      this.currentModel.ClearSelection2(true);

      params.profiles.forEach((profile, index) => {
        const selected = ext.SelectByID2(profile, 'SKETCH', 0, 0, 0, index > 0, 1, undefined, 0);
        if (!selected) throw new Error(`Profile sketch not found: ${profile}`);
      });

      const guides = params.guideCurves ?? params.guides ?? [];
      for (const guide of guides) {
        ext.SelectByID2(guide, 'SKETCH', 0, 0, 0, true, 2, undefined, 0);
      }

      const closed = params.closed ?? params.close ?? false;

      const feature = this.currentModel.FeatureManager.InsertProtrusionLoft3(
        closed,
        false,
        false,
        false,
        false,
        0,
        0,
        0,
        0,
        params.thinFeature ?? false,
        (params.thinThickness ?? 0) / 1000,
        0,
        0,
        params.merge !== false,
        true,
        true
      );

      if (!feature) throw new Error('InsertProtrusionLoft3 returned null');

      this.metrics.directCOMCalls++;
      this.updateResponseTime(Date.now() - startTime);

      return {
        name: feature.Name || 'Loft1',
        type: 'Loft',
        suppressed: false,
      };
    } catch (error) {
      this.metrics.failures++;
      throw new Error(`InsertProtrusionLoft3 failed: ${error}`);
    }
  }

  // Helper Methods

  private selectSketchForFeature(): boolean {
    // Method 1 (most reliable): Feature tree traversal
    // Avoids SelectByID2 COM type mismatch issues
    try {
      const featureCount = this.currentModel.GetFeatureCount();
      for (let i = 0; i < Math.min(10, featureCount); i++) {
        const feat = this.currentModel.FeatureByPositionReverse(i);
        if (feat) {
          const typeName = feat.GetTypeName2();
          if (typeName === 'ProfileFeature' || typeName?.toLowerCase().includes('sketch')) {
            feat.Select2(false, 0);
            logger.info(`Selected sketch by feature tree: ${feat.Name || feat.GetName()}`);
            return true;
          }
        }
      }
    } catch (e) {
      logger.warn(`Feature tree search failed: ${e}`);
    }

    // Method 2 (fallback): SelectByID2 with undefined for optional params
    const ext = this.currentModel.Extension;
    const sketchNames = ['Sketch1', 'Sketch2', 'Sketch3', 'Sketch4', 'Sketch5'];

    for (const name of sketchNames) {
      try {
        const selected = ext.SelectByID2(name, 'SKETCH', 0, 0, 0, false, 0, undefined, 0);
        if (selected) {
          logger.info(`Selected sketch via SelectByID2: ${name}`);
          return true;
        }
      } catch (_e) {
        // Try next
      }
    }

    return false;
  }

  private updateResponseTime(duration: number): void {
    const total = this.metrics.directCOMCalls + this.metrics.macroFallbacks;
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime * (total - 1) + duration) / total;
  }

  // Standard adapter methods (implement remaining interface)

  async execute<T>(command: Command): Promise<AdapterResult<T>> {
    const startTime = Date.now();

    try {
      let result: any;

      // Route commands to appropriate methods
      switch (command.name) {
        case 'CreateExtrusion':
          result = await this.createExtrusion(command.parameters as ExtrusionParameters);
          break;
        case 'CreateRevolve':
          result = await this.createRevolve(command.parameters as RevolveParameters);
          break;
        case 'CreateSweep':
          result = await this.createSweep(command.parameters as SweepParameters);
          break;
        case 'CreateLoft':
          result = await this.createLoft(command.parameters as LoftParameters);
          break;
        default:
          result = await this.executeRaw(command.name, [command.parameters]);
      }

      return {
        success: true,
        data: result as T,
        timing: {
          start: new Date(startTime),
          end: new Date(),
          duration: Date.now() - startTime,
        },
        metadata: {
          adapter: 'EnhancedWinAx',
          metrics: this.metrics,
        },
      };
    } catch (error) {
      this.metrics.failures++;
      return {
        success: false,
        error: error?.toString() || 'Command execution failed',
        timing: {
          start: new Date(startTime),
          end: new Date(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  async executeRaw(method: string, args: any[]): Promise<any> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    try {
      const target = this.currentModel || this.swApp;
      return target[method](...args);
    } catch (error) {
      logger.error(`Raw execution failed: ${method}`, error);
      throw error;
    }
  }

  // Model operations
  async openModel(filePath: string): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    const errors = { value: 0 };
    const warnings = { value: 0 };

    const ext = filePath.toLowerCase().split('.').pop();
    let docType = 1; // swDocPART
    if (ext === 'sldasm') docType = 2; // swDocASSEMBLY
    if (ext === 'slddrw') docType = 3; // swDocDRAWING

    this.currentModel = this.swApp.OpenDoc6(filePath, docType, 1, '', errors, warnings);

    if (!this.currentModel) {
      throw new Error(`Failed to open model: ${filePath}`);
    }

    return {
      path: filePath,
      name: this.currentModel.GetTitle(),
      type: ['Part', 'Assembly', 'Drawing'][docType - 1] as 'Part' | 'Assembly' | 'Drawing',
      isActive: true,
    };
  }

  async closeModel(save?: boolean): Promise<void> {
    if (!this.currentModel) return;

    if (save) {
      this.currentModel.Save3(1, 0, 0);
    }

    const title = this.currentModel.GetTitle();
    this.swApp.CloseDoc(title);
    this.currentModel = null;
  }

  async createPart(): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    this.currentModel = this.swApp.NewPart();

    return {
      path: '',
      name: this.currentModel.GetTitle(),
      type: 'Part',
      isActive: true,
    };
  }

  async createAssembly(): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    this.currentModel = this.swApp.NewAssembly();

    return {
      path: '',
      name: this.currentModel.GetTitle(),
      type: 'Assembly',
      isActive: true,
    };
  }

  async createDrawing(): Promise<SolidWorksModel> {
    if (!this.swApp) throw new Error('Not connected to SolidWorks');

    this.currentModel = this.swApp.NewDrawing();

    return {
      path: '',
      name: this.currentModel.GetTitle(),
      type: 'Drawing',
      isActive: true,
    };
  }

  // Sketch operations
  async createSketch(plane: string): Promise<string> {
    if (!this.currentModel) throw new Error('No active model');

    const ext = this.currentModel.Extension;
    ext.SelectByID2(`${plane} Plane`, 'PLANE', 0, 0, 0, false, 0, undefined, 0);
    this.currentModel.SketchManager.InsertSketch(true);

    return this.currentModel.SketchManager.ActiveSketch.Name;
  }

  async addLine(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    this.currentModel.SketchManager.CreateLine(x1 / 1000, y1 / 1000, 0, x2 / 1000, y2 / 1000, 0);
  }

  async addCircle(centerX: number, centerY: number, radius: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    this.currentModel.SketchManager.CreateCircle(
      centerX / 1000,
      centerY / 1000,
      0,
      (centerX + radius) / 1000,
      centerY / 1000,
      0
    );
  }

  async addRectangle(x1: number, y1: number, x2: number, y2: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const sketchMgr = this.currentModel.SketchManager;
    sketchMgr.CreateLine(x1 / 1000, y1 / 1000, 0, x2 / 1000, y1 / 1000, 0);
    sketchMgr.CreateLine(x2 / 1000, y1 / 1000, 0, x2 / 1000, y2 / 1000, 0);
    sketchMgr.CreateLine(x2 / 1000, y2 / 1000, 0, x1 / 1000, y2 / 1000, 0);
    sketchMgr.CreateLine(x1 / 1000, y2 / 1000, 0, x1 / 1000, y1 / 1000, 0);
  }

  async exitSketch(): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    this.currentModel.SketchManager.InsertSketch(false);
  }

  // Analysis operations
  async getMassProperties(): Promise<MassProperties> {
    if (!this.currentModel) throw new Error('No active model');

    const massProp = this.currentModel.Extension.CreateMassProperty();

    return {
      mass: massProp.Mass,
      volume: massProp.Volume,
      surfaceArea: massProp.SurfaceArea,
      centerOfMass: {
        x: massProp.CenterOfMass[0],
        y: massProp.CenterOfMass[1],
        z: massProp.CenterOfMass[2],
      },
      momentsOfInertia: {
        Ixx: massProp.MomentOfInertia[0],
        Iyy: massProp.MomentOfInertia[4],
        Izz: massProp.MomentOfInertia[8],
        Ixy: massProp.MomentOfInertia[1],
        Iyz: massProp.MomentOfInertia[5],
        Ixz: massProp.MomentOfInertia[2],
      },
    };
  }

  // Export operations
  async exportFile(filePath: string, format: string): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const formatMap: Record<string, number> = {
      step: 203,
      iges: 204,
      stl: 216,
      pdf: 217,
      dwg: 218,
      dxf: 219,
    };

    const exportType = formatMap[format.toLowerCase()] || 203;

    const success = this.currentModel.Extension.SaveAs3(filePath, 0, exportType, undefined, undefined, 0, 0);

    if (!success) {
      throw new Error(`Failed to export to ${format}`);
    }
  }

  // Dimension operations
  async getDimension(name: string): Promise<number> {
    if (!this.currentModel) throw new Error('No active model');

    const dim = this.currentModel.Parameter(name);
    if (!dim) {
      throw new Error(`Dimension ${name} not found`);
    }

    return dim.SystemValue * 1000; // Convert m to mm
  }

  async setDimension(name: string, value: number): Promise<void> {
    if (!this.currentModel) throw new Error('No active model');

    const dim = this.currentModel.Parameter(name);
    if (!dim) {
      throw new Error(`Dimension ${name} not found`);
    }

    dim.SystemValue = value / 1000; // Convert mm to m
    this.currentModel.EditRebuild3();
  }
}

/**
 * Factory function to create enhanced adapter
 */
export async function createEnhancedWinAxAdapter(): Promise<EnhancedWinAxAdapter> {
  const adapter = new EnhancedWinAxAdapter();
  await adapter.connect();
  return adapter;
}
