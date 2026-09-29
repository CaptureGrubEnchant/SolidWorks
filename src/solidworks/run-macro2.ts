/**
 * Shared wrapper for `ISldWorks::RunMacro2`.
 *
 * RunMacro2's 5th parameter is `OUT Error As Long`. On SolidWorks 2024+ it is
 * **required**, and it must be passed byref — every other shape fails at COM
 * dispatch, before SolidWorks even looks at the macro:
 *
 *   • passing a literal `0`  → "type mismatch" (COM wants `Long*`, got a value)
 *   • omitting the argument  → "non-optional parameter"
 *
 * winax exposes byref through its Variant type-string: a leading `p` sets
 * VT_BYREF, so `'pint32'` yields `VT_BYREF | VT_I4` — a `Long*`.
 *
 * NOTE: it must be `'int32'`, **not** `'long'`. winax maps its `'long'` alias
 * to VT_I8 (8 bytes), while VBA's `Long` is 4 bytes (VT_I4). `'plong'` would
 * pass a `LONGLONG*` and fail the same way.
 */

import { loadWinax } from '../adapters/winax-loader.js';

/** swRunMacroOption_e */
export const SW_RUN_MACRO_DEFAULT = 0;
export const SW_RUN_MACRO_UNLOAD_AFTER_RUN = 1;

export interface RunMacro2Result {
  /** RunMacro2's return value — true when SolidWorks ran the procedure. */
  success: boolean;
  /** swRunMacroError_e from the OUT param; 0 means no error. */
  errorCode: number;
}

/** Reads a winax Variant back out to a plain number, tolerating shape changes. */
function readVariantNumber(variant: any): number {
  try {
    const raw = variant?.__value ?? variant?.valueOf?.();
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
}

/**
 * Calls RunMacro2 with a correctly-typed byref OUT error parameter.
 *
 * @param swApp  Connected `SldWorks.Application` COM object.
 * @param option swRunMacroOption_e — defaults to unload-after-run.
 */
export function runMacro2(
  swApp: any,
  macroPath: string,
  moduleName: string,
  procedureName: string,
  option: number = SW_RUN_MACRO_UNLOAD_AFTER_RUN
): RunMacro2Result {
  const winax = loadWinax();
  const errorOut = new winax.Variant(0, 'pint32');

  const success = swApp.RunMacro2(macroPath, moduleName, procedureName, option, errorOut);

  return { success: Boolean(success), errorCode: readVariantNumber(errorOut) };
}
