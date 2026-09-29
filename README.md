<a id="top"></a>
<img src="docs/assets/readme-header.svg" width="100%" alt="SolidWorks MCP Server">

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=18&duration=2800&pause=900&color=E31C23&center=true&vCenter=true&repeat=true&width=820&height=42&lines=Create+a+part+and+extrude+a+20+mm+boss;Sketch+a+rectangle+on+Front+Plane;Export+this+assembly+to+STEP+and+STL;What+is+the+mass+of+the+active+part%3F" alt="Example prompts">

<sub>Repository: <b>SolidWorks MCP Server</b> (<code>SolidworksMCP-TS</code>) · Node.js MCP + COM / VBA</sub>

<br><br>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-E31C23?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0B1220)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-E31C23?style=for-the-badge&logo=anthropic&logoColor=white&labelColor=0B1220)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-20+-E31C23?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=0B1220)](https://nodejs.org/)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-E31C23?style=for-the-badge&logo=windows&logoColor=white&labelColor=0B1220)](#installation)
[![Linux](https://img.shields.io/badge/Linux-Install-1E2A44?style=for-the-badge&logo=linux&logoColor=white&labelColor=0B1220)](#3-linux)
[![macOS](https://img.shields.io/badge/macOS-Install-1E2A44?style=for-the-badge&logo=apple&logoColor=white&labelColor=0B1220)](#4-macos)
[![License: MIT](https://img.shields.io/badge/License-MIT-E31C23?style=for-the-badge&labelColor=0B1220)](LICENSE)

<br>

**Works with the agent you already use**

[![Claude Desktop](https://img.shields.io/badge/Claude_Desktop-0B1220?style=for-the-badge&logo=claude&logoColor=white)](#configure-claude-desktop)
[![MCP Clients](https://img.shields.io/badge/Any_MCP_Client-0B1220?style=for-the-badge)](#configure-claude-desktop)

</div>

<br>

> **Alpha / Experimental.** Architecture is in place and basic operations (sketch planes, simple extrusions) have been demonstrated. **Most tools have not been validated against a live SolidWorks instance.** Expect COM quirks. Test reports are welcome.

<br>

## What a session looks like

<table>
<tr>
<td width="58%" valign="top">

```text
You    New part. Sketch a 40×20 mm rectangle
       on Front Plane and extrude 12 mm.

Agent  Creating the part document…
       Front Plane selected.
       Rectangle 40 × 20 mm added.
       Extrusion FeatureExtrusion3 routed
       through VBA (20+ COM parameters).
       Feature tree: Sketch1 → Boss-Extrude1

You    Fillet the long edges 2 mm, export STEP.

Agent  Fillet applied. Export queued.
       File saved next to the part.
```

</td>
<td width="42%" valign="middle">

### Why the router exists

SolidWorks APIs such as `FeatureExtrusion3` take **20+ parameters**. Node.js COM bridges often fail past 12.

- **≤ 12 params** → direct `winax` COM
- **13+ params** → generated VBA macro
- **Failure** → automatic fallback with context

Never pass `null` into COM. Use `undefined`. Prefer feature-tree walk over `SelectByID2`.

</td>
</tr>
</table>

<br>

## Why it's built this way

<table>
<tr>
<td width="50%" valign="top">

### Direct COM when it is safe
Simple sketch and document calls go through `winax` with no extra hop. Fast path for planes, lines, circles, and short feature calls.

</td>
<td width="50%" valign="top">

### VBA when COM chokes
A complexity analyzer counts parameters. Long SolidWorks signatures become a one-shot VBA macro SolidWorks executes itself.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Feature tree over name picking
`FeatureByPositionReverse()` + `GetTypeName2()` finds sketches more reliably than `SelectByID2`.

</td>
<td width="50%" valign="top">

### Stdio stays clean
Logging is Winston only. `console.*` corrupts JSON-RPC on stdio and breaks the MCP client.

</td>
</tr>
</table>

<br>

## Installation

Replace `YOUR_DOWNLOAD_URL` on the Download button with your release asset, installer, or zip.

### 1. Windows — Download

<div align="center">

[![Download for Windows](https://img.shields.io/badge/Download-Windows-E31C23?style=for-the-badge&logo=windows&logoColor=white&labelColor=0B1220)](YOUR_DOWNLOAD_URL)

</div>

Suggested asset URL:

```text
https://github.com/vespo92/SolidworksMCP-TS/releases/latest/download/SolidworksMCP-Windows.zip
```

After download:

1. Extract the archive.
2. Confirm **Node.js 20+** is installed.
3. In the project folder:

```bat
npm install
npm run build
```

> `winax` must compile locally on each Windows machine. A global npm install will not work.

<br>

### 2. Windows — PowerShell (Administrator)

Run **Windows PowerShell** or **PowerShell 7** as Administrator.

```powershell
#Requires -RunAsAdministrator

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$Repo = "https://github.com/vespo92/SolidworksMCP-TS.git"
$Dest = "$env:USERPROFILE\SolidworksMCP-TS"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git not found. Install Git for Windows and retry."
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found. Install Node.js 20+ and retry."
    exit 1
}

if (Test-Path $Dest) {
    Write-Host "Directory exists, updating repository..." -ForegroundColor Yellow
    Set-Location $Dest
    git pull
} else {
    git clone $Repo $Dest
    Set-Location $Dest
}

npm install
npm run build
Write-Host "Done. Build output: $Dest\dist\index.js" -ForegroundColor Green
```

Register the type library if SolidWorks is not visible to COM:

```powershell
regsvr32 "C:\Program Files\SOLIDWORKS Corp\SOLIDWORKS\sldworks.tlb"
```

<br>

### 3. Linux

```bash
# Debian / Ubuntu
sudo apt update
sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

git clone https://github.com/vespo92/SolidworksMCP-TS.git
cd SolidworksMCP-TS
npm install
npm run build
```

```bash
# Fedora / RHEL
sudo dnf install -y git nodejs npm gcc-c++ make
git clone https://github.com/vespo92/SolidworksMCP-TS.git
cd SolidworksMCP-TS
npm install
npm run build
```

`winax` will not build on Linux. Install the server here if you want the codebase; live SolidWorks control needs a **Windows host**.

<br>

### 4. macOS

```bash
brew install git node

git clone https://github.com/vespo92/SolidworksMCP-TS.git
cd SolidworksMCP-TS
npm install
npm run build
```

Same limit as Linux: no local COM. Point the MCP client at a Windows machine that has SolidWorks installed.

<br>

## Requirements

| Platform | What you need |
|----------|----------------|
| **Windows 10/11** | Licensed SolidWorks **2021–2025**, Node.js 20+, MCP client |
| **Linux** | Node.js 20+, MCP client. No direct COM |
| **macOS** | Node.js 20+, MCP client. No direct COM |

<br>

## Configure Claude Desktop

Add to `claude_desktop_config.json`.

**Windows**

```json
{
  "mcpServers": {
    "solidworks": {
      "command": "node",
      "args": ["C:/path/to/SolidworksMCP-TS/dist/index.js"],
      "env": {
        "SOLIDWORKS_PATH": "C:\\Program Files\\SOLIDWORKS Corp\\SOLIDWORKS",
        "ADAPTER_TYPE": "winax-enhanced"
      }
    }
  }
}
```

**macOS** — usually `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "solidworks": {
      "command": "node",
      "args": ["/Users/YOU/SolidworksMCP-TS/dist/index.js"]
    }
  }
}
```

**Linux** — client-specific config path; argument is still `dist/index.js`.

<br>

## Available tools

| Category | Tools | Status |
|----------|-------|--------|
| **Modeling** | create_part, create_extrusion, create_revolve, create_sweep, create_loft, create_fillet, create_chamfer, … | Partially tested |
| **Sketch** | create_sketch, add_line, add_circle, add_rectangle, add_arc, add_constraints, dimension_sketch | Basic ops verified |
| **Drawing** | create_drawing_from_model, add_drawing_view, add_section_view, add_dimensions, … | Untested |
| **Export** | export_file (STEP, IGES, STL, PDF, DWG, DXF), batch_export | Untested |
| **Analysis** | get_mass_properties, check_interference, measure_distance, check_geometry | Untested |
| **VBA generation** | generate_vba_script, vba_sheet_metal, vba_configurations, vba_equations, … | Code gen works; execution untested |
| **Macro** | macro_start_recording, macro_stop_recording, macro_export_vba | Untested |

**Partially tested** — run at least once on SolidWorks. **Untested** — mocks / unit tests only.

<br>

## Architecture

```
MCP Protocol (stdio)
    |
Tool Registry (index.ts)
    |
Feature Complexity Analyzer --- routes by param count
    |                    |
Direct COM (winax)    VBA Macro Generator
    |                    |
    +--------------------+
    |
SolidWorks COM API
```

<br>

## Development

```bash
npm run build        # TypeScript compile
npm run dev          # hot-reload (tsx watch)
npm run check        # TypeScript + Biome
npm run lint         # Biome check
npm run lint:fix     # Biome auto-fix
npm run format       # Biome format
npm run typecheck    # types only
```

See [TESTING.md](TESTING.md).

```bash
USE_MOCK_SOLIDWORKS=true npm test
npm run test:watch
```

Unit tests cover config and environment utilities. Most tool modules are not covered. Integration needs a Windows box with SolidWorks and is not in CI.

<br>

## What has worked

- Connecting to a running SolidWorks instance via COM
- Sketch planes and basic sketch geometry
- Simple extrusions with a limited parameter set
- Feature-tree traversal for sketch selection
- VBA macro **code generation** (execution path still thin)

## Known limits

- No CI against live SolidWorks (needs a self-hosted Windows runner)
- `winax` is local-compile only — no prebuilt binaries
- Edge.js adapter and PowerShell COM bridge are designed, not implemented
- Connection pooling / circuit breaker exist in code, not battle-tested
- No real performance numbers yet

## Roadmap

- [ ] Integration suite on real SolidWorks
- [ ] CI with a self-hosted Windows runner
- [ ] Validate modeling, drawing, and export tools
- [ ] Edge.js adapter (.NET path)
- [ ] PowerShell bridge as an alternate COM path
- [ ] Benchmarks with real metrics

<br>

## Troubleshooting

`winax` on Windows 11 Build 26200+ / VS 2022 BuildTools 17.14+ (issue #23): [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

```powershell
regsvr32 "C:\Program Files\SOLIDWORKS Corp\SOLIDWORKS\sldworks.tlb"
```

```bash
rm -rf node_modules dist
npm install
npm run build
```

```bash
ENABLE_LOGGING=true LOG_LEVEL=debug node dist/index.js
```

<br>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Highest-value help: live SolidWorks test runs, COM version quirks, and new API wrappers.

## License

MIT — [LICENSE](LICENSE)

- [winax](https://github.com/nicedreams/node-activex) — COM bridge for Node.js
- [Anthropic MCP](https://modelcontextprotocol.io) — Model Context Protocol
- SolidWorks API documentation

<div align="center">
<br>

[back to top ↑](#top)

</div>

<img src="docs/assets/readme-footer.svg" width="100%" alt="">
