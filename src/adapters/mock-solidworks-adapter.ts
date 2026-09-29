/**
 * Mock SolidWorks Adapter for Testing
 *
 * Simulates SolidWorks COM interface behavior for testing without SolidWorks installed.
 * Useful for CI/CD, unit tests, and development without SolidWorks.
 */

import { logger } from '../utils/logger.js';

export interface MockConfig {
  version?: string;
  failOperations?: boolean;
  simulateErrors?: boolean;
  delayMs?: number;
}

export class MockSolidWorksAdapter {
  private config: MockConfig;
  private activeDoc: any;
  private documents: Map<string, any>;
  private version: string;

  constructor(config: MockConfig = {}) {
    this.config = {
      version: config.version || '2024',
      failOperations: config.failOperations || false,
      simulateErrors: config.simulateErrors || false,
      delayMs: config.delayMs || 0,
      ...config,
    };

    this.version = this.config.version || '2024';
    this.documents = new Map();
    this.activeDoc = null;

    logger.info(`MockSolidWorksAdapter initialized (version: ${this.version})`);
  }

  /**
   * Simulate getting SolidWorks application
   */
  getApplication(): any {
    return {
      Visible: true,
      RevisionNumber: () => {
        // Return version in different formats based on year
        const year = parseInt(this.version, 10);
        if (year >= 2020) {
          return `${this.version} SP5.0`;
        } else {
          // Older format: version number (27 = 2019, 28 = 2020, etc.)
          const majorVer = year - 1992;
          return `${majorVer}.5.0.0084`;
        }
      },
      GetUserPreferenceStringValue: (type: number) => {
        // Return mock template paths
        const templates: Record<number, string> = {
          0: `C:\\ProgramData\\SolidWorks\\SOLIDWORKS ${this.version}\\templates\\Part.prtdot`,
          1: `C:\\ProgramData\\SolidWorks\\SOLIDWORKS ${this.version}\\templates\\Assembly.asmdot`,
          8: `C:\\ProgramData\\SolidWorks\\SOLIDWORKS ${this.version}\\templates\\Drawing.drwdot`,
        };
        return templates[type] || '';
      },
      ActiveDoc: this.activeDoc,
      NewPart: () => this.createDocument('part'),
      NewDocument: (template: string) => this.createDocument('part', template),
      OpenDoc6: (path: string, type: number) => this.openDocument(path, type),
      CloseDoc: (name: string) => this.closeDocument(name),
      GetDocumentCount: () => this.documents.size,
      Frame: () => ({
        ModelWindow: () => ({
          ModelDoc: this.activeDoc,
        }),
      }),
    };
  }

  /**
   * Create a mock document
   */
  private createDocument(type: 'part' | 'assembly' | 'drawing', _template?: string): any {
    if (this.config.failOperations) {
      return null;
    }

    const docId = `${type}_${Date.now()}`;
    const doc = this.createMockDocument(type, docId);

    this.documents.set(docId, doc);
    this.activeDoc = doc;

    logger.info(`Created mock ${type} document: ${docId}`);
    return doc;
  }

  /**
   * Open a mock document
   */
  private openDocument(path: string, type: number): any {
    if (this.config.failOperations) {
      return null;
    }

    const docTypes = ['part', 'assembly', 'drawing'];
    const docType = docTypes[type - 1] || 'part';
    const doc = this.createMockDocument(docType as any, path);

    this.documents.set(path, doc);
    this.activeDoc = doc;

    logger.info(`Opened mock document: ${path}`);
    return doc;
  }

  /**
   * Close a mock document
   */
  private closeDocument(name: string): void {
    for (const [key, doc] of this.documents.entries()) {
      if (doc.GetTitle() === name || key === name) {
        this.documents.delete(key);
        if (this.activeDoc === doc) {
          this.activeDoc = this.documents.values().next().value || null;
        }
        logger.info(`Closed mock document: ${name}`);
        break;
      }
    }
  }

  /**
   * Create a complete mock document object
   */
  private createMockDocument(type: 'part' | 'assembly' | 'drawing', id: string): any {
    const features: any[] = [];

    // Add some default features
    features.push(this.createMockFeature('Sketch1', 'ProfileFeature'));
    features.push(this.createMockFeature('Boss-Extrude1', 'Extrusion'));

    return {
      // Basic properties
      GetTitle: () => `Mock_${type}_${id}`,
      GetPathName: () => `C:\\temp\\${type}_${id}.sld${type === 'part' ? 'prt' : type === 'assembly' ? 'asm' : 'drw'}`,
      GetType: () => (type === 'part' ? 1 : type === 'assembly' ? 2 : 3),

      // Feature management
      FeatureManager: this.createMockFeatureManager(features),
      GetFeatureCount: () => features.length,
      FeatureByPositionReverse: (index: number) => features[features.length - 1 - index] || null,
      FeatureByName: (name: string) => features.find((f) => f.Name === name) || null,

      // Sketch management
      SketchManager: this.createMockSketchManager(),

      // Selection management
      Extension: this.createMockExtension(features),
      SelectionManager: this.createMockSelectionManager(),
      ClearSelection2: (_clear: boolean) => true,

      // Save operations
      Save3: () => true,
      Save: () => true,
      SaveAs3: (_path: string) => true,
      SaveAs4: (_path: string) => true,

      // Rebuild
      EditRebuild3: () => true,
      EditRebuild: () => true,
      ForceRebuild3: () => true,

      // Parameters
      Parameter: (name: string) => this.createMockParameter(name),
      GetParameter: (name: string) => this.createMockParameter(name),

      // Mass properties
      GetMassProperties: () => this.createMockMassProperties(),

      // Drawing-specific
      CreateDrawViewFromModelView3: (_modelPath: string, viewType: string, _x: number, _y: number, _scale: number) => {
        if (this.config.failOperations) return null;
        return this.createMockDrawingView(viewType);
      },
      CreateUnfoldedViewAt3: (_x: number, _y: number, _scale: number, _unfold: boolean) => {
        if (this.config.failOperations) return null;
        return this.createMockDrawingView('Section');
      },
    };
  }

  /**
   * Create mock feature manager
   */
  private createMockFeatureManager(features: any[]): any {
    return {
      FeatureExtrusion: (..._args: any[]) => {
        if (this.config.simulateErrors) {
          throw new Error('Mock extrusion failed');
        }
        const feature = this.createMockFeature('Boss-Extrude1', 'Extrusion');
        features.push(feature);
        return feature;
      },
      FeatureExtrusion3: (..._args: any[]) => {
        if (this.config.simulateErrors) {
          throw new Error('Mock extrusion failed');
        }
        const feature = this.createMockFeature('Boss-Extrude1', 'Extrusion');
        features.push(feature);
        return feature;
      },
      FeatureRevolve2: (..._args: any[]) => {
        const feature = this.createMockFeature('Revolve1', 'Revolve');
        features.push(feature);
        return feature;
      },
      InsertProtrusionSwept4: (..._args: any[]) => {
        const feature = this.createMockFeature('Sweep1', 'Sweep');
        features.push(feature);
        return feature;
      },
      InsertProtrusionLoft3: (..._args: any[]) => {
        const feature = this.createMockFeature('Loft1', 'Loft');
        features.push(feature);
        return feature;
      },
      GetPlane: (name: string) => ({ Name: name }),
    };
  }

  /**
   * Create mock sketch manager
   */
  private createMockSketchManager(): any {
    let activeSketch: any = null;

    return {
      InsertSketch: (exit: boolean) => {
        if (!exit) {
          activeSketch = { Name: 'Sketch1' };
        } else {
          activeSketch = null;
        }
        return true;
      },
      ActiveSketch: activeSketch,
      CreateLine: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
        return { Type: 'Line', Points: [x1, y1, z1, x2, y2, z2] };
      },
      CreateCircle: (x: number, y: number, z: number, radius: number) => {
        return { Type: 'Circle', Center: [x, y, z], Radius: radius };
      },
      CreateRectangle: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
        return { Type: 'Rectangle', Points: [x1, y1, z1, x2, y2, z2] };
      },
    };
  }

  /**
   * Create mock extension
   */
  private createMockExtension(features: any[]): any {
    return {
      SelectByID2: (
        name: string,
        type: string,
        _x: number,
        _y: number,
        _z: number,
        _append: boolean,
        _mark: number,
        _callout: any,
        _selOption: number
      ) => {
        // Simulate selection
        if (type === 'SKETCH') {
          return features.some((f) => f.Name === name && f.GetTypeName2().includes('Sketch'));
        }
        return features.some((f) => f.Name === name);
      },
      CustomPropertyManager: (_config: string) => this.createMockCustomPropertyManager(),
      CreateMassProperty: () => this.createMockMassProperties(),
      CreateMassProperty2: () => this.createMockMassProperties(),
      SaveAs: (_path: string, _version: number, _options: number, _exportData: any, _errors: any, _warnings: any) =>
        true,
      GetParameter: (name: string) => this.createMockParameter(name),
    };
  }

  /**
   * Create mock selection manager
   */
  private createMockSelectionManager(): any {
    const selections: any[] = [];

    return {
      GetSelectedObjectCount: () => selections.length,
      GetSelectedObject6: (index: number, _mark: number) => selections[index - 1] || null,
      AddSelection: (obj: any) => selections.push(obj),
    };
  }

  /**
   * Create mock feature
   */
  private createMockFeature(name: string, type: string): any {
    return {
      Name: name,
      GetName: () => name,
      GetTypeName2: () => type,
      Select2: (_append: boolean, _mark: number) => true,
      SetSuppression2: (_state: number, _config: any, _children: any) => true,
      IsSuppressed: () => false,
    };
  }

  /**
   * Create mock parameter/dimension
   */
  private createMockParameter(name: string): any {
    let value = 0.025; // 25mm in meters

    return {
      Name: name,
      SystemValue: value,
      Value: value,
      GetSystemValue: () => value,
      SetSystemValue: (newValue: number) => {
        value = newValue;
        return true;
      },
      SetValue: (newValue: number) => {
        value = newValue;
        return true;
      },
    };
  }

  /**
   * Create mock mass properties
   */
  private createMockMassProperties(): any {
    return {
      Mass: 0.5,
      Volume: 0.000125,
      SurfaceArea: 0.0075,
      CenterOfMass: [0.0125, 0.0125, 0.0125],
      Density: 2700,
      MomentOfInertia: [0.001, 0, 0, 0, 0.001, 0, 0, 0, 0.001],
      Update: () => true,
      Recalculate: () => true,
    };
  }

  /**
   * Create mock custom property manager
   */
  private createMockCustomPropertyManager(): any {
    const properties = new Map<string, string>();

    return {
      Add3: (name: string, _type: number, value: string, _option: number) => {
        properties.set(name, value);
        return true;
      },
      Get6: (
        name: string,
        _useCached: boolean,
        _value: any,
        _resolvedValue: any,
        _wasResolved: any,
        _linkToProp: any
      ) => {
        return properties.has(name);
      },
      Set2: (name: string, value: string) => {
        properties.set(name, value);
        return true;
      },
      Delete2: (name: string) => {
        properties.delete(name);
        return true;
      },
    };
  }

  /**
   * Create mock drawing view
   */
  private createMockDrawingView(viewType: string): any {
    return {
      Name: `${viewType}View`,
      Type: viewType,
      ScaleDecimal: 1.0,
      SetScale: (_num: number, _den: number) => true,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): MockConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MockConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Mock configuration updated', config);
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.documents.clear();
    this.activeDoc = null;
    logger.info('Mock adapter reset');
  }
}

/**
 * Factory function to create mock adapter
 */
export function createMockSolidWorksAdapter(config?: MockConfig): MockSolidWorksAdapter {
  return new MockSolidWorksAdapter(config);
}
