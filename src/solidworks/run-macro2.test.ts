/**
 * Regression tests for the RunMacro2 OUT-parameter wrapper.
 *
 * RunMacro2's 5th parameter is `OUT Error As Long` and is required on
 * SolidWorks 2024+. Passing it by value raises a type mismatch; omitting it
 * raises "non-optional parameter". Only a byref VT_I4 works.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const variantCtor = vi.fn();

/** Stands in for winax's Variant: records (value, type) and is readable back. */
class FakeVariant {
  __value: unknown;
  type: unknown;

  constructor(value: unknown, type: unknown) {
    variantCtor(value, type);
    this.__value = value;
    this.type = type;
  }

  valueOf() {
    return this.__value;
  }
}

vi.mock('../adapters/winax-loader.js', () => ({
  loadWinax: () => ({ Variant: FakeVariant }),
}));

const { SW_RUN_MACRO_DEFAULT, SW_RUN_MACRO_UNLOAD_AFTER_RUN, runMacro2 } = await import('./run-macro2.js');

describe('runMacro2', () => {
  beforeEach(() => {
    variantCtor.mockClear();
  });

  it('passes the error param as a byref 32-bit int, not by value', () => {
    const swApp = { RunMacro2: vi.fn(() => true) };

    runMacro2(swApp, 'C:\\macros\\m.swp', 'Module1', 'main');

    // 'pint32' → VT_BYREF | VT_I4, which is VBA's `Long*`.
    //
    // NOT 'plong': winax maps its 'long' alias to VT_I8 (8 bytes), while VBA's
    // Long is 4 bytes, so 'plong' would pass a LONGLONG* and fail the same way
    // the original literal `0` did.
    expect(variantCtor).toHaveBeenCalledWith(0, 'pint32');

    const args = swApp.RunMacro2.mock.calls[0];
    expect(args).toHaveLength(5);
    expect(args[4]).toBeInstanceOf(FakeVariant);
    expect(typeof args[4]).not.toBe('number');
  });

  it('forwards path, module, procedure and run option in order', () => {
    const swApp = { RunMacro2: vi.fn(() => true) };

    runMacro2(swApp, 'C:\\macros\\m.swp', 'Module1', 'main', SW_RUN_MACRO_DEFAULT);

    const args = swApp.RunMacro2.mock.calls[0];
    expect(args.slice(0, 4)).toEqual(['C:\\macros\\m.swp', 'Module1', 'main', 0]);
  });

  it('defaults to unload-after-run', () => {
    const swApp = { RunMacro2: vi.fn(() => true) };

    runMacro2(swApp, 'm.swp', 'Module1', 'main');

    expect(swApp.RunMacro2.mock.calls[0][3]).toBe(SW_RUN_MACRO_UNLOAD_AFTER_RUN);
    expect(SW_RUN_MACRO_UNLOAD_AFTER_RUN).toBe(1);
  });

  it('reads the error code back out of the byref variant', () => {
    const swApp = {
      RunMacro2: vi.fn((_p, _m, _proc, _opt, errorOut: FakeVariant) => {
        errorOut.__value = 4; // SolidWorks writes through the pointer
        return false;
      }),
    };

    expect(runMacro2(swApp, 'm.swp', 'Module1', 'main')).toEqual({
      success: false,
      errorCode: 4,
    });
  });

  it('reports success without an error code on a clean run', () => {
    const swApp = { RunMacro2: vi.fn(() => true) };

    expect(runMacro2(swApp, 'm.swp', 'Module1', 'main')).toEqual({
      success: true,
      errorCode: 0,
    });
  });
});
