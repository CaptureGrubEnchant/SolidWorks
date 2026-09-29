/**
 * SolidWorks Constants and Enumerations
 * Replaces all magic numbers with meaningful constants
 */

// ============================================
// DOCUMENT TYPES
// ============================================

export enum SwDocumentType {
  None = 0,
  Part = 1,
  Assembly = 2,
  Drawing = 3,
}

export const DocumentExtensions = {
  Part: ['.sldprt', '.prt'],
  Assembly: ['.sldasm', '.asm'],
  Drawing: ['.slddrw', '.drw'],
  Template: ['.prtdot', '.asmdot', '.drwdot'],
} as const;

// ============================================
// SAVE OPTIONS
// ============================================

export enum SwSaveAsOptions {
  Silent = 1,
  Copy = 2,
  UpdateInactiveViews = 4,
  AvoidRebuildOnSave = 8,
  OverrideSaveEmodel = 16,
  SaveEmodelData = 32,
  UseCurrentWorkingDirectory = 64,
}

export enum SwSaveAsVersion {
  CurrentVersion = 0,
  Sw98plus = 5000,
  Sw99 = 5500,
  Sw2000 = 6000,
  Sw2001 = 7000,
  Sw2001Plus = 7500,
  Sw2003 = 8000,
}

// ============================================
// FILE OPEN OPTIONS
// ============================================

export enum SwOpenDocOptions {
  Silent = 1,
  ReadOnly = 2,
  ViewOnly = 4,
  LoadModel = 8,
  DontLoadHiddenComponents = 16,
  LoadExternalReferences = 32,
  AutoMissingConfig = 64,
  LoadLightweight = 128,
  RapidDraft = 256,
}

// ============================================
// FEATURE TYPES
// ============================================

export enum SwFeatureType {
  ProfileFeature = 0,
  ExtrudeFeature = 1,
  RevolveFeature = 2,
  SweepFeature = 3,
  LoftFeature = 4,
  BoundaryFeature = 5,
  FilletFeature = 6,
  ChamferFeature = 7,
  ShellFeature = 8,
  DraftFeature = 9,
  PatternFeature = 10,
  MirrorFeature = 11,
  HoleFeature = 12,
}

// ============================================
// END CONDITIONS FOR FEATURES
// ============================================

export enum SwEndCondition {
  Blind = 0,
  ThroughAll = 1,
  ThroughNext = 2,
  UpToVertex = 3,
  UpToSurface = 4,
  OffsetFromSurface = 5,
  UpToBody = 6,
  MidPlane = 7,
  ThroughAllBoth = 8,
  UpToSelection = 9,
}

// ============================================
// SELECTION TYPES
// ============================================

export enum SwSelectType {
  Faces = 2,
  Edges = 3,
  Vertices = 4,
  Sketches = 5,
  SketchSegments = 6,
  SketchPoints = 7,
  Datums = 8,
  Axes = 9,
  Planes = 10,
  Components = 11,
  Bodies = 12,
  Features = 13,
  Dimensions = 14,
}

// ============================================
// REBUILD OPTIONS
// ============================================

export enum SwRebuildOptions {
  Current = 0,
  All = 1,
  TopLevel = 2,
  OnlyFeatures = 3,
}

// ============================================
// MASS PROPERTY ACCURACY
// ============================================

export enum SwMassPropertyAccuracy {
  Low = 0,
  Medium = 1,
  High = 2,
  VeryHigh = 3,
  Exact = 4,
}

// ============================================
// SHEET METAL FEATURES
// ============================================

export enum SwSheetMetalReliefType {
  Rectangular = 0,
  Obround = 1,
  Tear = 2,
}

export enum SwBendAllowance {
  BendTable = 0,
  KFactor = 1,
  BendAllowance = 2,
  BendDeduction = 3,
}

// ============================================
// DRAWING VIEW TYPES
// ============================================

export enum SwDrawingViewType {
  Standard = 0,
  Projected = 1,
  Auxiliary = 2,
  Section = 3,
  Detail = 4,
  Broken = 5,
  BreakOutSection = 6,
  Isometric = 7,
  Named = 8,
}

export enum SwDrawingViewOrientation {
  Front = 0,
  Back = 1,
  Left = 2,
  Right = 3,
  Top = 4,
  Bottom = 5,
  Isometric = 6,
  Dimetric = 7,
  Trimetric = 8,
  Current = 9,
}

// ============================================
// DIMENSION TYPES
// ============================================

export enum SwDimensionType {
  Linear = 0,
  Angular = 1,
  Radial = 2,
  Diameter = 3,
  Ordinate = 4,
  Chamfer = 5,
  ArcLength = 6,
  Coordinate = 7,
}

export enum SwDimensionToleranceType {
  None = 0,
  Bilateral = 1,
  Limit = 2,
  Symmetric = 3,
  Basic = 4,
  Min = 5,
  Max = 6,
}

// ============================================
// EXPORT FORMATS
// ============================================

export enum SwExportFormat {
  Step = 'step',
  Iges = 'iges',
  Stl = 'stl',
  Pdf = 'pdf',
  Dxf = 'dxf',
  Dwg = 'dwg',
  Parasolid = 'x_t',
  Sat = 'sat',
  Vrml = 'wrl',
  Obj = 'obj',
  Ply = 'ply',
  ThreeMf = '3mf',
}

export const ExportExtensions: Record<SwExportFormat, string[]> = {
  [SwExportFormat.Step]: ['.step', '.stp'],
  [SwExportFormat.Iges]: ['.iges', '.igs'],
  [SwExportFormat.Stl]: ['.stl'],
  [SwExportFormat.Pdf]: ['.pdf'],
  [SwExportFormat.Dxf]: ['.dxf'],
  [SwExportFormat.Dwg]: ['.dwg'],
  [SwExportFormat.Parasolid]: ['.x_t', '.x_b'],
  [SwExportFormat.Sat]: ['.sat'],
  [SwExportFormat.Vrml]: ['.wrl'],
  [SwExportFormat.Obj]: ['.obj'],
  [SwExportFormat.Ply]: ['.ply'],
  [SwExportFormat.ThreeMf]: ['.3mf'],
};

// ============================================
// UNITS
// ============================================

export enum SwLengthUnit {
  Millimeters = 0,
  Centimeters = 1,
  Meters = 2,
  Inches = 3,
  Feet = 4,
  FeetInches = 5,
  Angstroms = 6,
  Nanometers = 7,
  Microns = 8,
}

export enum SwAngleUnit {
  Degrees = 0,
  Radians = 1,
  Gradians = 2,
  DegreesMinutes = 3,
  DegreesMinutesSeconds = 4,
}

export enum SwMassUnit {
  Grams = 0,
  Kilograms = 1,
  Pounds = 2,
  Ounces = 3,
  Tons = 4,
}

// ============================================
// CONVERSION FACTORS
// ============================================

export const ConversionFactors = {
  // Length conversions to meters
  MillimetersToMeters: 0.001,
  CentimetersToMeters: 0.01,
  InchesToMeters: 0.0254,
  FeetToMeters: 0.3048,

  // Length conversions from meters
  MetersToMillimeters: 1000,
  MetersToCentimeters: 100,
  MetersToInches: 39.3701,
  MetersToFeet: 3.28084,

  // Angle conversions
  DegreesToRadians: Math.PI / 180,
  RadiansToDegrees: 180 / Math.PI,

  // Mass conversions to kilograms
  GramsToKilograms: 0.001,
  PoundsToKilograms: 0.453592,
  OuncesToKilograms: 0.0283495,

  // Mass conversions from kilograms
  KilogramsToGrams: 1000,
  KilogramsToPounds: 2.20462,
  KilogramsToOunces: 35.274,
} as const;

// ============================================
// ERROR CODES
// ============================================

export enum SwErrorCode {
  Success = 0,
  GenericError = 1,
  FileNotFound = 2,
  InvalidFileType = 3,
  ReadOnly = 4,
  InvalidOperation = 5,
  NoActiveDocument = 6,
  InvalidDimension = 7,
  InvalidFeature = 8,
  RebuildError = 9,
  SaveError = 10,
  ExportError = 11,
  MacroError = 12,
  SelectionError = 13,
  GeometryError = 14,
  AssemblyError = 15,
  DrawingError = 16,
}

// ============================================
// PAPER SIZES
// ============================================

export enum SwPaperSize {
  Letter = 0,
  LetterLandscape = 1,
  Tabloid = 2,
  TabloidLandscape = 3,
  C = 4,
  CLandscape = 5,
  D = 6,
  DLandscape = 7,
  E = 8,
  ELandscape = 9,
  A4 = 10,
  A4Landscape = 11,
  A3 = 12,
  A3Landscape = 13,
  A2 = 14,
  A2Landscape = 15,
  A1 = 16,
  A1Landscape = 17,
  A0 = 18,
  A0Landscape = 19,
  UserDefined = 20,
}

export const PaperDimensions: Record<SwPaperSize, { width: number; height: number }> = {
  [SwPaperSize.Letter]: { width: 0.2159, height: 0.2794 },
  [SwPaperSize.LetterLandscape]: { width: 0.2794, height: 0.2159 },
  [SwPaperSize.Tabloid]: { width: 0.2794, height: 0.4318 },
  [SwPaperSize.TabloidLandscape]: { width: 0.4318, height: 0.2794 },
  [SwPaperSize.C]: { width: 0.4318, height: 0.5588 },
  [SwPaperSize.CLandscape]: { width: 0.5588, height: 0.4318 },
  [SwPaperSize.D]: { width: 0.5588, height: 0.8636 },
  [SwPaperSize.DLandscape]: { width: 0.8636, height: 0.5588 },
  [SwPaperSize.E]: { width: 0.8636, height: 1.0922 },
  [SwPaperSize.ELandscape]: { width: 1.0922, height: 0.8636 },
  [SwPaperSize.A4]: { width: 0.21, height: 0.297 },
  [SwPaperSize.A4Landscape]: { width: 0.297, height: 0.21 },
  [SwPaperSize.A3]: { width: 0.297, height: 0.42 },
  [SwPaperSize.A3Landscape]: { width: 0.42, height: 0.297 },
  [SwPaperSize.A2]: { width: 0.42, height: 0.594 },
  [SwPaperSize.A2Landscape]: { width: 0.594, height: 0.42 },
  [SwPaperSize.A1]: { width: 0.594, height: 0.841 },
  [SwPaperSize.A1Landscape]: { width: 0.841, height: 0.594 },
  [SwPaperSize.A0]: { width: 0.841, height: 1.189 },
  [SwPaperSize.A0Landscape]: { width: 1.189, height: 0.841 },
  [SwPaperSize.UserDefined]: { width: 0, height: 0 },
};

// ============================================
// MACRO SECURITY LEVELS
// ============================================

export enum SwMacroSecurityLevel {
  Low = 0,
  Medium = 1,
  High = 2,
}

// ============================================
// CONFIGURATION OPTIONS
// ============================================

export const DefaultConfiguration = {
  Connection: {
    RetryAttempts: 3,
    RetryDelay: 1000, // milliseconds
    Timeout: 30000, // milliseconds
  },
  Cache: {
    MaxEntries: 1000,
    TTL: 3600000, // 1 hour in milliseconds
  },
  Logging: {
    Level: 'info',
    MaxFileSize: 10485760, // 10MB
    MaxFiles: 5,
  },
  Performance: {
    MaxConcurrentOperations: 5,
    OperationTimeout: 60000, // milliseconds
  },
  Templates: {
    DefaultPartTemplate: 'C:\\ProgramData\\SolidWorks\\SOLIDWORKS 2023\\templates\\Part.prtdot',
    DefaultAssemblyTemplate: 'C:\\ProgramData\\SolidWorks\\SOLIDWORKS 2023\\templates\\Assembly.asmdot',
    DefaultDrawingTemplate: 'C:\\ProgramData\\SolidWorks\\SOLIDWORKS 2023\\templates\\Drawing.drwdot',
  },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export class SwConstants {
  /**
   * Get document type from file extension
   */
  static getDocumentTypeFromExtension(filepath: string): SwDocumentType {
    const ext = filepath.toLowerCase().split('.').pop() || '';

    if (DocumentExtensions.Part.some((e) => ext.includes(e.substring(1)))) {
      return SwDocumentType.Part;
    }
    if (DocumentExtensions.Assembly.some((e) => ext.includes(e.substring(1)))) {
      return SwDocumentType.Assembly;
    }
    if (DocumentExtensions.Drawing.some((e) => ext.includes(e.substring(1)))) {
      return SwDocumentType.Drawing;
    }

    return SwDocumentType.None;
  }

  /**
   * Convert units
   */
  static convertLength(value: number, from: SwLengthUnit, to: SwLengthUnit): number {
    // Convert to meters first
    let meters = value;
    switch (from) {
      case SwLengthUnit.Millimeters:
        meters = value * ConversionFactors.MillimetersToMeters;
        break;
      case SwLengthUnit.Centimeters:
        meters = value * ConversionFactors.CentimetersToMeters;
        break;
      case SwLengthUnit.Inches:
        meters = value * ConversionFactors.InchesToMeters;
        break;
      case SwLengthUnit.Feet:
        meters = value * ConversionFactors.FeetToMeters;
        break;
    }

    // Convert from meters to target unit
    switch (to) {
      case SwLengthUnit.Millimeters:
        return meters * ConversionFactors.MetersToMillimeters;
      case SwLengthUnit.Centimeters:
        return meters * ConversionFactors.MetersToCentimeters;
      case SwLengthUnit.Inches:
        return meters * ConversionFactors.MetersToInches;
      case SwLengthUnit.Feet:
        return meters * ConversionFactors.MetersToFeet;
      default:
        return meters;
    }
  }

  /**
   * Convert angle units
   */
  static convertAngle(value: number, from: SwAngleUnit, to: SwAngleUnit): number {
    // Convert to radians first
    let radians = value;
    if (from === SwAngleUnit.Degrees) {
      radians = value * ConversionFactors.DegreesToRadians;
    }

    // Convert from radians to target unit
    if (to === SwAngleUnit.Degrees) {
      return radians * ConversionFactors.RadiansToDegrees;
    }

    return radians;
  }
}
