/**
 * Regression guard for issue #29.
 *
 * Strict MCP clients (GitHub Copilot, among others) validate every tool's
 * inputSchema before the server is usable. A JSON Schema `{"type": "array"}`
 * with no `items` is rejected outright, taking down the whole server rather
 * than just the offending tool.
 *
 * zod-to-json-schema deliberately omits `items` when the element type is
 * `ZodAny`, so `z.array(z.any())` produces exactly that invalid shape.
 * `z.array(z.unknown())` emits `items: {}`, which is valid and equally
 * permissive.
 */

import { describe, expect, it } from 'vitest';
import { zodToJsonSchema as _zodToJsonSchema } from 'zod-to-json-schema';
import { analysisTools } from '../analysis.js';
import { diagnosticTools } from '../diagnostics.js';
import { drawingTools } from '../drawing.js';
import { drawingAnalysisTools } from '../drawing-analysis.js';
import { enhancedDrawingTools } from '../enhanced-drawing.js';
import { exportTools } from '../export.js';
import { macroSecurityTools } from '../macro-security.js';
import { modelingTools } from '../modeling.js';
import { nativeMacroTools } from '../native-macro.js';
import { sketchTools } from '../sketch.js';
import { templateManagerTools } from '../template-manager.js';
import { vbaTools } from '../vba.js';
import { advancedVBATools } from '../vba-advanced.js';
import { assemblyVBATools } from '../vba-assembly.js';
import { drawingVBATools } from '../vba-drawing.js';
import { fileManagementVBATools } from '../vba-file-management.js';
import { partModelingVBATools } from '../vba-part.js';

const zodToJsonSchema = (schema: unknown) => _zodToJsonSchema(schema as Parameters<typeof _zodToJsonSchema>[0]);

const allTools = [
  ...analysisTools,
  ...diagnosticTools,
  ...drawingTools,
  ...drawingAnalysisTools,
  ...enhancedDrawingTools,
  ...exportTools,
  ...macroSecurityTools,
  ...modelingTools,
  ...nativeMacroTools,
  ...sketchTools,
  ...templateManagerTools,
  ...vbaTools,
  ...advancedVBATools,
  ...assemblyVBATools,
  ...drawingVBATools,
  ...fileManagementVBATools,
  ...partModelingVBATools,
];

/** Walk a JSON Schema and report every `type: "array"` node missing `items`. */
function findArraysWithoutItems(node: unknown, path = '$'): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((child, i) => findArraysWithoutItems(child, `${path}[${i}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }

  const schema = node as Record<string, unknown>;
  const declaresArray = schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'));
  const offenders = declaresArray && schema.items === undefined && schema.prefixItems === undefined ? [path] : [];

  return [
    ...offenders,
    ...Object.entries(schema).flatMap(([key, value]) => findArraysWithoutItems(value, `${path}.${key}`)),
  ];
}

describe('MCP tool input schemas', () => {
  it('registers a non-trivial number of tools', () => {
    expect(allTools.length).toBeGreaterThan(50);
  });

  it.each(
    allTools.map((tool) => [tool.name, tool] as const)
  )('%s declares `items` on every array parameter', (name, tool) => {
    const jsonSchema = zodToJsonSchema(tool.inputSchema);
    const offenders = findArraysWithoutItems(jsonSchema, name);

    expect(
      offenders,
      `Tool "${name}" has array parameter(s) with no \`items\`: ${offenders.join(', ')}. ` +
        'Use z.array(z.unknown()) rather than z.array(z.any()).'
    ).toEqual([]);
  });
});
