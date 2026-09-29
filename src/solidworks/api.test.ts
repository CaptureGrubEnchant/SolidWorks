/**
 * Regression tests for createExtrude (PRs #27 / #28).
 *
 * `create_extrusion` failed on every SolidWorks 2024+ install with
 * "DispInvoke: RunMacro2 type mismatch". These lock in the fix: the direct
 * FeatureExtrusion3 call with its canonical 23-argument signature, and no
 * fallback to the legacy FeatureExtrusion entry point or to RunMacro2.
 */

import { describe, expect, it, vi } from 'vitest';
import { SolidWorksAPI } from './api.js';

/** Minimal COM doubles: a sketch in the feature tree and a resulting feature. */
function makeMockModel(featureMgr: Record<string, unknown>) {
  const sketchFeature = {
    Name: 'Sketch1',
    GetName: () => 'Sketch1',
    GetTypeName2: () => 'ProfileFeature',
    Select2: vi.fn().mockReturnValue(true),
  };

  return {
    FeatureManager: featureMgr,
    SketchManager: { ActiveSketch: null },
    ClearSelection2: vi.fn(),
    GetFeatureCount: () => 1,
    FeatureByPositionReverse: () => sketchFeature,
    EditRebuild3: vi.fn(),
  };
}

function makeApi(featureMgr: Record<string, unknown>, runMacro2 = vi.fn()) {
  const api = new SolidWorksAPI();
  (api as any).swApp = { RunMacro2: runMacro2 };
  (api as any).currentModel = makeMockModel(featureMgr);
  return api;
}

describe('SolidWorksAPI.createExtrude', () => {
  const extrusionFeature = {
    Name: 'Boss-Extrude1',
    GetName: () => 'Boss-Extrude1',
    GetTypeName2: () => 'BossExtrude',
  };

  it('calls FeatureExtrusion3 with the canonical 23-argument signature', () => {
    const featureMgr = {
      FeatureExtrusion: vi.fn(),
      FeatureExtrusion3: vi.fn(() => extrusionFeature),
    };
    const api = makeApi(featureMgr);

    const result = api.createExtrude(50);

    expect(result.name).toBe('Boss-Extrude1');
    expect(featureMgr.FeatureExtrusion3).toHaveBeenCalledWith(
      true, // 1  Sd
      false, // 2  Flip
      false, // 3  Dir
      0, // 4  T1
      0, // 5  T2
      0.05, // 6  D1 — 50mm in meters
      0, // 7  D2
      false, // 8  Dchk1 — no draft requested
      false, // 9  Dchk2
      false, // 10 Ddir1
      false, // 11 Ddir2
      0, // 12 Dang1
      0, // 13 Dang2
      false, // 14 OffsetReverse1
      false, // 15 OffsetReverse2
      false, // 16 TranslateSurface1
      false, // 17 TranslateSurface2
      true, // 18 Merge
      true, // 19 UseFeatScope
      true, // 20 UseAutoSelect
      0, // 21 T0
      0, // 22 StartOffset
      false // 23 FlipStartOffset
    );

    // FlipSideToCut belongs to FeatureCut3; a 24th arg raises
    // "invalid argument count" on SW 2024+.
    expect(featureMgr.FeatureExtrusion3.mock.calls[0]).toHaveLength(23);
  });

  it('never falls back to legacy FeatureExtrusion or RunMacro2', () => {
    const runMacro2 = vi.fn(() => {
      throw new Error('RunMacro2 must not be reached');
    });
    const featureMgr = {
      FeatureExtrusion: vi.fn(() => {
        throw new Error('legacy FeatureExtrusion must not be reached');
      }),
      FeatureExtrusion3: vi.fn(() => extrusionFeature),
    };
    const api = makeApi(featureMgr, runMacro2);

    api.createExtrude(50);

    expect(featureMgr.FeatureExtrusion).not.toHaveBeenCalled();
    expect(runMacro2).not.toHaveBeenCalled();
  });

  it('applies the draft angle, converting degrees to radians', () => {
    const featureMgr = { FeatureExtrusion3: vi.fn(() => extrusionFeature) };
    const api = makeApi(featureMgr);

    api.createExtrude(50, 5);

    const args = featureMgr.FeatureExtrusion3.mock.calls[0];
    expect(args[7]).toBe(true); // Dchk1: draft while extruding
    expect(args[11]).toBeCloseTo((5 * Math.PI) / 180, 12); // Dang1 in radians
  });

  it('reverses direction via the Flip argument', () => {
    const featureMgr = { FeatureExtrusion3: vi.fn(() => extrusionFeature) };
    const api = makeApi(featureMgr);

    api.createExtrude(50, 0, true);

    expect(featureMgr.FeatureExtrusion3.mock.calls[0][1]).toBe(true);
  });

  it('surfaces the COM error verbatim instead of burying it in a fallback', () => {
    const featureMgr = {
      FeatureExtrusion3: vi.fn(() => {
        throw new Error('DispInvoke: type mismatch');
      }),
    };
    const api = makeApi(featureMgr);

    expect(() => api.createExtrude(50)).toThrow(/DispInvoke: type mismatch/);
  });
});
