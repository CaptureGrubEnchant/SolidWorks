/**
 * Feature Complexity Analyzer
 *
 * Intelligently analyzes SolidWorks operations to determine the best execution method:
 * - Direct COM for simple operations (≤12 parameters)
 * - VBA Macro fallback for complex operations (13+ parameters)
 *
 * This solves the fundamental limitation of Node.js COM bridges (winax, edge-js)
 * which fail when calling methods with more than 12-13 parameters.
 */

import { logger } from '../utils/logger.js';
import type { ExtrusionParameters } from './types.js';

/**
 * Feature method complexity information
 */
export interface FeatureComplexity {
  method: string;
  parameterCount: number;
  requiresMacro: boolean;
  criticalParameters: string[];
  alternativeMethod?: string;
}

/**
 * Execution strategy recommendation
 */
export interface ExecutionStrategy {
  method: string;
  strategy: 'direct-com' | 'vba-macro' | 'hybrid';
  confidence: number; // 0-1
  reason: string;
  estimatedSuccessRate: number; // 0-1
}

/**
 * SolidWorks API method parameter counts
 * Based on SolidWorks API documentation (versions 2021-2025)
 */
export class FeatureComplexityAnalyzer {
  private static readonly COM_PARAMETER_LIMIT = 12; // Empirical limit for Node.js COM bridges
  private static readonly HYBRID_THRESHOLD = 10; // Start considering macro at 10 params

  /**
   * Feature complexity database
   * Maps SolidWorks API methods to their characteristics
   */
  private static readonly FEATURE_COMPLEXITIES: Record<string, FeatureComplexity> = {
    // ========================================
    // EXTRUSION FEATURES
    // ========================================
    FeatureExtrusion: {
      method: 'FeatureExtrusion',
      parameterCount: 13,
      requiresMacro: true,
      criticalParameters: ['depth', 'draft', 'bothDirections'],
      alternativeMethod: 'FeatureExtrusion2',
    },
    FeatureExtrusion2: {
      method: 'FeatureExtrusion2',
      parameterCount: 16,
      requiresMacro: true,
      criticalParameters: ['depth', 'draft', 'bothDirections', 'thinFeature'],
      alternativeMethod: 'FeatureExtrusion3',
    },
    FeatureExtrusion3: {
      method: 'FeatureExtrusion3',
      parameterCount: 23,
      requiresMacro: true,
      criticalParameters: ['depth', 'depth2', 'draft', 'draftAngle', 'thinFeature', 'capEnds'],
    },

    // ========================================
    // REVOLVE FEATURES
    // ========================================
    FeatureRevolve: {
      method: 'FeatureRevolve',
      parameterCount: 10,
      requiresMacro: false,
      criticalParameters: ['angle', 'direction'],
    },
    FeatureRevolve2: {
      method: 'FeatureRevolve2',
      parameterCount: 12,
      requiresMacro: false, // Right at the limit
      criticalParameters: ['angle', 'direction', 'thinFeature'],
    },

    // ========================================
    // SWEEP FEATURES
    // ========================================
    InsertProtrusionSwept: {
      method: 'InsertProtrusionSwept',
      parameterCount: 10,
      requiresMacro: false,
      criticalParameters: ['profileSketch', 'pathSketch'],
    },
    InsertProtrusionSwept4: {
      method: 'InsertProtrusionSwept4',
      parameterCount: 14,
      requiresMacro: true,
      criticalParameters: ['profileSketch', 'pathSketch', 'twistAngle', 'thinFeature'],
    },

    // ========================================
    // LOFT FEATURES
    // ========================================
    InsertProtrusionLoft: {
      method: 'InsertProtrusionLoft',
      parameterCount: 12,
      requiresMacro: false,
      criticalParameters: ['profiles', 'guides'],
    },
    InsertProtrusionLoft3: {
      method: 'InsertProtrusionLoft3',
      parameterCount: 17,
      requiresMacro: true,
      criticalParameters: ['profiles', 'guides', 'centerCurve', 'thinFeature'],
    },

    // ========================================
    // PATTERN FEATURES
    // ========================================
    FeatureLinearPattern4: {
      method: 'FeatureLinearPattern4',
      parameterCount: 18,
      requiresMacro: true,
      criticalParameters: ['direction1', 'spacing1', 'count1', 'direction2', 'spacing2', 'count2'],
    },
    FeatureCircularPattern: {
      method: 'FeatureCircularPattern',
      parameterCount: 15,
      requiresMacro: true,
      criticalParameters: ['axis', 'count', 'angle'],
    },

    // ========================================
    // SIMPLE OPERATIONS (always direct COM)
    // ========================================
    CreateLine: {
      method: 'CreateLine',
      parameterCount: 6,
      requiresMacro: false,
      criticalParameters: ['x1', 'y1', 'z1', 'x2', 'y2', 'z2'],
    },
    CreateCircle: {
      method: 'CreateCircle',
      parameterCount: 4,
      requiresMacro: false,
      criticalParameters: ['x', 'y', 'z', 'radius'],
    },
    InsertSketch: {
      method: 'InsertSketch',
      parameterCount: 1,
      requiresMacro: false,
      criticalParameters: ['exit'],
    },
  };

  /**
   * Analyze parameter complexity of an operation
   */
  static analyzeParameters(params: Record<string, any>): {
    count: number;
    complexity: 'simple' | 'moderate' | 'complex';
    hasOptionals: boolean;
  } {
    const count = Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== null).length;

    return {
      count,
      complexity: count <= 8 ? 'simple' : count <= 12 ? 'moderate' : 'complex',
      hasOptionals: Object.values(params).some((v) => v === undefined || v === null),
    };
  }

  /**
   * Determine execution strategy for a feature operation
   */
  static determineStrategy(methodName: string, parameters: Record<string, any>): ExecutionStrategy {
    const complexity = FeatureComplexityAnalyzer.FEATURE_COMPLEXITIES[methodName];
    const paramAnalysis = FeatureComplexityAnalyzer.analyzeParameters(parameters);

    // Unknown method - default to direct COM with low confidence
    if (!complexity) {
      logger.warn(`Unknown method: ${methodName}, defaulting to direct COM`);
      return {
        method: methodName,
        strategy: 'direct-com',
        confidence: 0.5,
        reason: 'Unknown method - attempting direct COM',
        estimatedSuccessRate: 0.7,
      };
    }

    // Complex feature requiring macro
    if (complexity.requiresMacro || paramAnalysis.count > FeatureComplexityAnalyzer.COM_PARAMETER_LIMIT) {
      return {
        method: methodName,
        strategy: 'vba-macro',
        confidence: 0.95,
        reason: `Method has ${complexity.parameterCount} parameters (limit: ${FeatureComplexityAnalyzer.COM_PARAMETER_LIMIT})`,
        estimatedSuccessRate: 0.98,
      };
    }

    // Hybrid approach for moderate complexity
    if (paramAnalysis.count > FeatureComplexityAnalyzer.HYBRID_THRESHOLD) {
      return {
        method: methodName,
        strategy: 'hybrid',
        confidence: 0.85,
        reason: `${paramAnalysis.count} parameters - will try COM first, fallback to macro`,
        estimatedSuccessRate: 0.95,
      };
    }

    // Simple operation - direct COM
    return {
      method: methodName,
      strategy: 'direct-com',
      confidence: 0.99,
      reason: `Simple operation with ${paramAnalysis.count} parameters`,
      estimatedSuccessRate: 0.99,
    };
  }

  /**
   * Check if a method requires VBA macro fallback
   */
  static requiresMacro(methodName: string): boolean {
    const complexity = FeatureComplexityAnalyzer.FEATURE_COMPLEXITIES[methodName];
    return complexity?.requiresMacro ?? false;
  }

  /**
   * Get parameter count for a method
   */
  static getParameterCount(methodName: string): number {
    const complexity = FeatureComplexityAnalyzer.FEATURE_COMPLEXITIES[methodName];
    return complexity?.parameterCount ?? 0;
  }

  /**
   * Get critical parameters that must be set correctly
   */
  static getCriticalParameters(methodName: string): string[] {
    const complexity = FeatureComplexityAnalyzer.FEATURE_COMPLEXITIES[methodName];
    return complexity?.criticalParameters ?? [];
  }

  /**
   * Analyze extrusion parameters specifically
   */
  static analyzeExtrusion(params: ExtrusionParameters): ExecutionStrategy {
    // Count actual parameters being used
    let paramCount = 0;
    const criticalParams: string[] = [];

    if (params.depth) {
      paramCount++;
      criticalParams.push('depth');
    }
    if (params.draft !== undefined && params.draft !== 0) {
      paramCount += 2;
      criticalParams.push('draft', 'draftWhileExtruding');
    }
    if (params.bothDirections) {
      paramCount += 2;
      criticalParams.push('bothDirections', 'depth2');
    }
    if (params.thinFeature) {
      paramCount += 3;
      criticalParams.push('thinFeature', 'thinThickness', 'capEnds');
    }
    if (params.reverse) {
      paramCount++;
      criticalParams.push('reverse');
    }
    if (params.endCondition && params.endCondition !== 'Blind') {
      paramCount++;
      criticalParams.push('endCondition');
    }

    // Always count base parameters
    paramCount += 5; // sd, flip, dir, t1, t2

    const strategy =
      paramCount > FeatureComplexityAnalyzer.COM_PARAMETER_LIMIT
        ? 'vba-macro'
        : paramCount > FeatureComplexityAnalyzer.HYBRID_THRESHOLD
          ? 'hybrid'
          : 'direct-com';

    return {
      method: 'FeatureExtrusion3',
      strategy,
      confidence: strategy === 'vba-macro' ? 0.95 : 0.85,
      reason: `Extrusion with ${paramCount} effective parameters (${criticalParams.join(', ')})`,
      estimatedSuccessRate: strategy === 'vba-macro' ? 0.98 : 0.9,
    };
  }

  /**
   * Get all methods that require macro fallback
   */
  static getComplexMethods(): string[] {
    return Object.entries(FeatureComplexityAnalyzer.FEATURE_COMPLEXITIES)
      .filter(([_, complexity]) => complexity.requiresMacro)
      .map(([method, _]) => method);
  }

  /**
   * Get statistics about feature complexity
   */
  static getComplexityStats(): {
    total: number;
    requireMacro: number;
    directCOM: number;
    percentage: number;
  } {
    const total = Object.keys(FeatureComplexityAnalyzer.FEATURE_COMPLEXITIES).length;
    const requireMacro = FeatureComplexityAnalyzer.getComplexMethods().length;
    const directCOM = total - requireMacro;

    return {
      total,
      requireMacro,
      directCOM,
      percentage: (requireMacro / total) * 100,
    };
  }

  /**
   * Log complexity analysis for debugging
   */
  static logAnalysis(methodName: string, params: Record<string, any>): void {
    const strategy = FeatureComplexityAnalyzer.determineStrategy(methodName, params);
    const paramAnalysis = FeatureComplexityAnalyzer.analyzeParameters(params);

    logger.info('Feature complexity analysis', {
      method: methodName,
      strategy: strategy.strategy,
      confidence: strategy.confidence,
      parameterCount: paramAnalysis.count,
      complexity: paramAnalysis.complexity,
      reason: strategy.reason,
      estimatedSuccessRate: strategy.estimatedSuccessRate,
    });
  }
}

/**
 * Helper function to determine if direct COM should be attempted
 */
export function shouldAttemptDirectCOM(methodName: string, params: Record<string, any>): boolean {
  const strategy = FeatureComplexityAnalyzer.determineStrategy(methodName, params);
  return strategy.strategy === 'direct-com' || strategy.strategy === 'hybrid';
}

/**
 * Helper function to determine if macro fallback should be used
 */
export function shouldUseMacroFallback(methodName: string, params: Record<string, any>): boolean {
  const strategy = FeatureComplexityAnalyzer.determineStrategy(methodName, params);
  return strategy.strategy === 'vba-macro';
}

/**
 * Helper function to get recommended approach
 */
export function getRecommendedApproach(methodName: string, params: Record<string, any>): string {
  const strategy = FeatureComplexityAnalyzer.determineStrategy(methodName, params);

  switch (strategy.strategy) {
    case 'direct-com':
      return 'Use direct COM call';
    case 'vba-macro':
      return 'Use VBA macro generation';
    case 'hybrid':
      return 'Try direct COM first, fallback to VBA macro on failure';
    default:
      return 'Unknown strategy';
  }
}
