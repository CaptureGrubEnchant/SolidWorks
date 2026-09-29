export interface SolidWorksModel {
  path: string;
  name: string;
  type: 'Part' | 'Assembly' | 'Drawing';
  isActive: boolean;
}

export interface SolidWorksFeature {
  name: string;
  type: string;
  suppressed: boolean;
}

export interface SolidWorksDrawing {
  name: string;
  sheets: number;
  scale: number;
}

export interface SolidWorksDimension {
  name: string;
  value: number;
  units: string;
}

export interface SolidWorksConfiguration {
  name: string;
  isActive: boolean;
  parent?: string;
}

export interface MassProperties {
  mass: number;
  volume: number;
  surfaceArea: number;
  centerOfMass: {
    x: number;
    y: number;
    z: number;
  };
}

export interface ExportOptions {
  format: 'STEP' | 'IGES' | 'STL' | 'PDF' | 'DXF' | 'DWG';
  version?: string;
  binary?: boolean;
  units?: 'mm' | 'in' | 'm';
}

export interface VBAScript {
  name: string;
  description: string;
  code: string;
  parameters?: VBAParameter[];
}

export interface VBAParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  default?: any;
}
