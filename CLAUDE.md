# SolidWorks MCP Server

## Build & Test

```bash
npm run build        # TypeScript compile (tsc)
npm run dev          # Hot-reload dev server (tsx watch)
npm test             # Run unit tests (vitest)
npm run test:watch   # Watch mode tests
npm run lint         # Biome lint check
npm run lint:fix     # Biome auto-fix
npm run format       # Biome format
npm run check        # TypeScript + Biome in one command
npm run typecheck    # Type check without emit
```

**Important**: This project requires Windows + SolidWorks to run. The `winax` native module only compiles on Windows and is an optional dependency. On non-Windows, use `npm install --ignore-scripts`. Tests use `USE_MOCK_SOLIDWORKS=true` by default for cross-platform CI.

## Architecture

- **MCP Server** (`src/index.ts`) - Entry point, registers tools via stdio transport
- **Adapters** (`src/adapters/`) - COM bridge layer with intelligent routing:
  - `winax-adapter.ts` - Direct COM via winax
  - `winax-adapter-enhanced.ts` - Enhanced adapter with complexity analysis
  - `feature-complexity-analyzer.ts` - Routes operations between direct COM and VBA macro fallback
  - `macro-generator.ts` - Generates VBA code for complex operations
- **Tools** (`src/tools/`) - MCP tool implementations (modeling, sketch, drawing, export, analysis, VBA)
- **Core API** (`src/solidworks/api.ts`) - Low-level SolidWorks COM interface

## Key Patterns

### COM Interop
- **Never pass `null` to COM optional parameters** - use `undefined` instead. COM interprets `null` as VT_NULL which causes type mismatch errors. This is the root cause of SelectByID2 failures.
- **Prefer feature tree traversal** over `SelectByID2` for sketch selection. Use `FeatureByPositionReverse()` + `GetTypeName2()` to find sketches reliably.
- Operations with >12 parameters automatically fall back to VBA macro execution.

### Code Style
- ESM modules (`"type": "module"` in package.json)
- Zod schemas for all tool input validation
- Winston logging (never use `console.*` - it breaks JSON-RPC stdio transport)
- `@ts-ignore` on winax imports is intentional (no type definitions exist)

## Testing
- Mock adapter (`src/adapters/mock-solidworks-adapter.ts`) simulates SolidWorks for CI
- Set `USE_MOCK_SOLIDWORKS=false` for integration tests on Windows with SolidWorks running
