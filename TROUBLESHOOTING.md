# Troubleshooting

Common problems when installing or running the SolidWorks MCP Server.

---

## `winax` build fails on Windows 11 (VS 2022 BuildTools 17.14+)

### Symptom

`npm install` appears to succeed but `node dist/index.js` exits immediately with:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'winax' imported from …\dist\solidworks\api.js
```

Forcing a build (`npm install winax --save --foreground-scripts`) reveals C++
compile errors inside `winax/src/utils.h` and `winax/src/disp.h`, most involving
`CComVariant`:

```
error C3203: 'CComVariant': unspecialized class template can't be used as a
             template argument for template parameter '_Ty'
error C2665: 'DispInvoke': no overloaded function could convert all the argument types
error C2512: 'CComVariant': no appropriate default constructor available
```

### Cause

This is an **upstream `winax` incompatibility** with recent Windows SDK / ATL
headers shipped with Visual Studio 2022 Build Tools 17.14+ (typically seen on
Windows 11 Build 26200+). The ATL headers changed `CComVariant`'s declaration
in ways the current `winax` native sources don't account for. See
[issue #23](https://github.com/vespo92/SolidworksMCP-TS/issues/23).

Because `winax` is declared as an `optionalDependency`, npm hides the compile
failure — the package is silently skipped, and the server then crashes at
first-import.

### Fixes, in order of preference

#### 1. Develop against the mock adapter (no SolidWorks required)

For everything that isn't COM automation itself — tool development, schema
work, MCP wiring — set:

```powershell
$env:USE_MOCK_SOLIDWORKS = "true"
npm run build
node dist/index.js
```

The mock adapter (`src/adapters/mock-solidworks-adapter.ts`) satisfies the
same interface and is what the test suite uses.

#### 2. Pin an older `winax` release

Versions before the ATL-header incompatibility may still compile. Try:

```powershell
npm install winax@3.4.2 --save-optional --foreground-scripts
npm run build
```

If 3.4.2 also fails, step down further (3.3.x) and report which version works
on your toolchain.

> These versions have not been validated against the current MCP server, so
> please run `npm test` afterwards and flag any regressions on issue #23.

#### 3. Install an older VS 2022 Build Tools

If you can control your toolchain, installing VS 2022 Build Tools **17.10 or
earlier** (with the "Desktop development with C++" workload and the "C++ ATL
for latest v143 build tools (x86 & x64)" component) avoids the incompatible
ATL headers. Set `GYP_MSVS_VERSION=2022` and reinstall.

#### 4. Wait for upstream fix

Track [winax on GitHub](https://github.com/durs/node-activex) and node-gyp
issue [#3251](https://github.com/nodejs/node-gyp/issues/3251). Once `winax`
ships an ATL-compatible release, update your lockfile.

---

## Graceful degradation

As of the PR that added this doc, the server no longer hard-crashes when
`winax` is missing. Any code path that actually needs COM automation will
throw a descriptive error like:

```
The `winax` native module is not available. SolidWorks COM automation requires it on Windows.

Common causes:
  • Build failure on Windows 11 (Build 26200+) with VS 2022 BuildTools 17.14+
    (upstream winax/ATL CComVariant incompatibility — see issue #23).
  • Installing on a non-Windows platform (winax is Windows-only).
  • `npm install --ignore-scripts` skipped the native build step.

Workarounds:
  • For development without real SolidWorks, set USE_MOCK_SOLIDWORKS=true.
  • Try pinning an older winax release: `npm i winax@3.4.2` and rebuild.
  • See TROUBLESHOOTING.md in the repository root for the full recovery guide.

Underlying load error: …
```

The rest of the server (tool registration, mock adapter, macro generation,
VBA tools, resources) continues to work.

---

## Non-Windows development

`winax` is Windows-only. On macOS and Linux, install with
`npm install --ignore-scripts` (or rely on `optionalDependencies` silently
skipping it). Then always run with `USE_MOCK_SOLIDWORKS=true`.

---

## Reporting a new failure

Please open an issue with:

- Windows build number (`winver`)
- Node version (`node -v`)
- VS Build Tools version (Visual Studio Installer → Modify)
- `npm install winax --foreground-scripts` log
- `npm ls winax` output

This helps us correlate failure signatures to specific toolchain versions.
