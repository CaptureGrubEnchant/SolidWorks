# SolidWorks MCP Implementation Guide

## Quick Start: Solving the Multi-Parameter COM Issue

### Option 1: Edge.js Integration (Recommended)

```bash
# Install Edge.js
npm install edge-js

# Install .NET dependencies (Windows)
npm install --global windows-build-tools
```

```typescript
// Use the Edge.js adapter
import { createEdgeJsAdapter } from './src/adapters/edge-adapter';

const adapter = await createEdgeJsAdapter();
const result = await adapter.execute(new CreateExtrusionCommand({
  depth: 25,
  reverse: false,
  draft: 0
}));
```

### Option 2: C# Microservice

Create a separate C# service that handles SolidWorks COM:

```csharp
// SolidWorksService.cs
using System;
using System.Web.Http;
using SolidWorks.Interop.sldworks;

public class SolidWorksController : ApiController
{
    private ISldWorks swApp;
    
    [HttpPost]
    [Route("api/features/extrusion")]
    public IHttpActionResult CreateExtrusion([FromBody] ExtrusionParams params)
    {
        // Full COM access here
        var feature = swApp.ActiveDoc.FeatureManager.FeatureExtrusion3(
            true, false, false, 0, 0, 
            params.Depth, 0.0, false, false,
            params.Draft, 0.0, 0, 0,
            false, false, true, false, true,
            0, 0, false
        );
        
        return Ok(new { success = true, featureName = feature.Name });
    }
}
```

### Option 3: PowerShell Bridge (Quick Fix)

```typescript
// PowerShell adapter for immediate relief
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function createExtrusionViaPowerShell(params: any) {
  const script = `
    $sw = New-Object -ComObject SldWorks.Application
    $model = $sw.ActiveDoc
    $feature = $model.FeatureManager.FeatureExtrusion3(
      $true, $false, $false, 0, 0,
      ${params.depth}, 0, $false, $false,
      ${params.draft}, 0, 0, 0,
      $false, $false, $true, $false, $true,
      0, 0, $false
    )
    Write-Output $feature.Name
  `;
  
  const { stdout } = await execAsync(`powershell -Command "${script}"`);
  return { featureName: stdout.trim() };
}
```

## Stainless Integration Steps

### 1. Install Stainless CLI

```bash
npm install -g @stainless-api/cli
```

### 2. Define Your API

```typescript
// api/solidworks.ts
import { stl } from '@stainless-api/stl-api';

export const api = stl.api({
  // See stainless-api.ts for full example
});
```

### 3. Generate SDK

```bash
stainless generate --input api/solidworks.ts --output sdk/
```

### 4. Use Generated SDK

```typescript
import { SolidWorksClient } from './sdk';

const client = new SolidWorksClient({
  apiKey: process.env.API_KEY
});

const model = await client.models.create({ type: 'part' });
```

## Incremental Migration Path

### Phase 1: Fix Critical Issues (Week 1)
1. **Implement Edge.js adapter** for create_extrusion
2. **Test with real SolidWorks** installation
3. **Create fallback VBA macros** for complex operations

```bash
# Quick test
npm run test:edge-adapter
```

### Phase 2: Adapter Pattern (Week 2)
1. **Refactor existing API** to use adapter pattern
2. **Implement circuit breaker** for reliability
3. **Add connection pooling**

```typescript
// Before
const api = new SolidWorksAPI();
api.connect();

// After
const adapter = await AdapterFactory.create('edge-js');
const pool = new ConnectionPool(() => createEdgeJsAdapter());
await pool.initialize();
```

### Phase 3: Stainless API (Week 3)
1. **Define OpenAPI spec** using Stainless
2. **Generate TypeScript SDK**
3. **Migrate MCP handlers** to use new API

### Phase 4: Testing & Documentation (Week 4)
1. **Create test suite** for all adapters
2. **Performance benchmarks**
3. **Update documentation**

## Testing the Improvements

### Unit Tests
```typescript
// test/adapters/edge-adapter.test.ts
import { createEdgeJsAdapter } from '../src/adapters/edge-adapter';

describe('EdgeJsAdapter', () => {
  it('should create extrusion with multiple parameters', async () => {
    const adapter = await createEdgeJsAdapter();
    const result = await adapter.execute(new CreateExtrusionCommand({
      depth: 25,
      draft: 2,
      bothDirections: true
    }));
    
    expect(result.success).toBe(true);
    expect(result.data.featureName).toContain('Extrude');
  });
});
```

### Integration Tests
```bash
# Run against real SolidWorks
npm run test:integration -- --adapter=edge-js
```

### Performance Benchmarks
```typescript
// benchmark/extrusion.bench.ts
import { bench } from 'vitest';

bench('Edge.js adapter', async () => {
  await edgeAdapter.execute(extrusionCommand);
});

bench('Winax adapter', async () => {
  await winaxAdapter.execute(extrusionCommand);
});

bench('PowerShell adapter', async () => {
  await powershellAdapter.execute(extrusionCommand);
});
```

## Configuration

### Environment Variables
```env
# .env
ADAPTER_TYPE=edge-js
SOLIDWORKS_PATH=C:\\Program Files\\SOLIDWORKS Corp\\SOLIDWORKS
ENABLE_CIRCUIT_BREAKER=true
CONNECTION_POOL_SIZE=3
API_KEY=your-api-key
LOG_LEVEL=debug
```

### Adapter Configuration
```json
{
  "adapters": {
    "edge-js": {
      "enabled": true,
      "priority": 1,
      "timeout": 30000
    },
    "winax": {
      "enabled": true,
      "priority": 2,
      "timeout": 20000
    },
    "powershell": {
      "enabled": true,
      "priority": 3,
      "timeout": 60000
    }
  }
}
```

## Troubleshooting

### Edge.js Issues

```bash
# If Edge.js fails to build
npm install --global node-gyp
npm install --global windows-build-tools
npm rebuild edge-js
```

### COM Registration

```powershell
# Re-register SolidWorks COM
regsvr32 "C:\Program Files\SOLIDWORKS Corp\SOLIDWORKS\sldworks.tlb"
```

### Debugging

```typescript
// Enable verbose logging
process.env.DEBUG = 'solidworks:*';
process.env.LOG_LEVEL = 'debug';

// Use debug adapter
const adapter = new DebugAdapter(new EdgeJsAdapter());
adapter.on('command:start', (cmd) => console.log('Executing:', cmd));
adapter.on('command:success', (result) => console.log('Result:', result));
```

## Next Steps

1. **Join the discussion** on GitHub Issues
2. **Test the Edge.js adapter** with your SolidWorks version
3. **Contribute improvements** via Pull Requests
4. **Share your use cases** to help prioritize features

## Resources

- [Edge.js Documentation](https://github.com/tjanczuk/edge)
- [SolidWorks API Documentation](https://help.solidworks.com/2025/english/api/sldworksapiprogguide/Welcome.htm)
- [Stainless API Framework](https://github.com/stainless-api/stl-api)
- [MCP Protocol Specification](https://modelcontextprotocol.io)

---

*Ready to make this special? Let's build the most robust SolidWorks automation tool together!*