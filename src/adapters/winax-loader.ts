/**
 * Lazy loader for the `winax` optional native dependency.
 *
 * `winax` ships as an optionalDependency because it only builds on Windows and
 * can fail on newer toolchains (e.g. Windows 11 Build 26200+ with VS 2022
 * BuildTools 17.14+, see issue #23). Importing it at module load time would
 * crash the whole server with ERR_MODULE_NOT_FOUND whenever the build was
 * skipped. Loading it lazily lets non-winax code paths (mock adapter, docs,
 * macro generation) keep working and lets us surface an actionable error
 * message when real COM automation is actually requested.
 */

import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);

let cachedWinax: any = null;
let loadError: Error | null = null;

/**
 * Returns the `winax` module. Throws an actionable error if it is missing or
 * failed to build. The result is cached — the underlying require runs at most
 * once per process (success or failure).
 */
export function loadWinax(): any {
  if (cachedWinax) return cachedWinax;
  if (loadError) throw loadError;

  try {
    const mod = nodeRequire('winax');
    cachedWinax = mod && typeof mod === 'object' && 'default' in mod ? (mod as any).default : mod;
    return cachedWinax;
  } catch (err) {
    loadError = new Error(buildWinaxErrorMessage(err));
    throw loadError;
  }
}

/**
 * Non-throwing variant used for capability detection. Returns `null` if winax
 * is unavailable for any reason.
 */
export function tryLoadWinax(): any | null {
  try {
    return loadWinax();
  } catch {
    return null;
  }
}

/** True if winax can be loaded in this environment. */
export function isWinaxAvailable(): boolean {
  return tryLoadWinax() !== null;
}

function buildWinaxErrorMessage(err: unknown): string {
  const underlying = err instanceof Error ? err.message : String(err);
  return [
    'The `winax` native module is not available. SolidWorks COM automation requires it on Windows.',
    '',
    'Common causes:',
    '  • Build failure on Windows 11 (Build 26200+) with VS 2022 BuildTools 17.14+',
    '    (upstream winax/ATL CComVariant incompatibility — see issue #23).',
    '  • Installing on a non-Windows platform (winax is Windows-only).',
    '  • `npm install --ignore-scripts` skipped the native build step.',
    '',
    'Workarounds:',
    '  • For development without real SolidWorks, set USE_MOCK_SOLIDWORKS=true.',
    '  • Try pinning an older winax release: `npm i winax@3.4.2` and rebuild.',
    '  • See TROUBLESHOOTING.md in the repository root for the full recovery guide.',
    '',
    `Underlying load error: ${underlying}`,
  ].join('\n');
}
