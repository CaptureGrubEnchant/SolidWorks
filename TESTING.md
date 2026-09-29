# Testing Guide

## Current State

Testing is an area that needs significant work. Here's an honest assessment:

- **Unit tests**: A handful exist for config and environment utilities. They run against mock adapters and do not exercise real SolidWorks COM calls.
- **Integration tests**: Test files exist but require a Windows machine with SolidWorks installed. These have not been run in any automated CI pipeline.
- **E2E tests**: No comprehensive end-to-end workflow tests exist yet.
- **Mock adapter**: Simulates SolidWorks behavior for CI, but mock fidelity to real SolidWorks is unknown for most operations.

**Bottom line**: Passing mock tests does not mean a tool works against real SolidWorks. COM interop has many quirks that mocks don't capture.

## Running Tests

### Unit Tests (No SolidWorks Required)

```bash
# Run all tests with mock adapter
USE_MOCK_SOLIDWORKS=true npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Integration Tests (Requires Windows + SolidWorks)

```bash
# Set up .env
USE_MOCK_SOLIDWORKS=false
SOLIDWORKS_VERSION=2024
LOG_LEVEL=debug

# Run integration tests
npm run test:integration
```

### Manual Testing

The most reliable way to verify tools currently:

1. Start the MCP server: `npm run dev`
2. Connect via Claude Desktop or another MCP client
3. Call tools one at a time and verify SolidWorks behavior
4. Check logs: `tail -f logs/solidworks-mcp.log`

## What Needs Testing

This is a non-exhaustive list of areas that need real SolidWorks validation:

### High Priority
- [ ] **create_part / create_assembly / create_drawing** - Document creation
- [ ] **create_sketch** on all standard planes (Front, Top, Right)
- [ ] **add_line / add_circle / add_rectangle / add_arc** - Basic sketch geometry
- [ ] **create_extrusion** - Simple boss extrude from a sketch
- [ ] **create_extrusion_advanced** - VBA macro fallback path for 13+ params
- [ ] **export_file** - STEP, STL, PDF export from a part

### Medium Priority
- [ ] **create_revolve** - Simple and complex (thin feature) revolves
- [ ] **create_sweep / create_loft** - Always uses macro path
- [ ] **create_fillet / create_chamfer** - Edge selection and feature creation
- [ ] **add_constraints / dimension_sketch** - Sketch constraints and dimensions
- [ ] **get_mass_properties** - Requires a solid body to measure
- [ ] **create_drawing_from_model** - Drawing generation from part/assembly

### Lower Priority
- [ ] **VBA generation tools** - Verify generated VBA runs in SolidWorks macro editor
- [ ] **batch_export** - Multi-config export
- [ ] **check_interference** - Assembly interference checks
- [ ] **measure_distance** - Entity-to-entity measurement
- [ ] **Pattern features** - Linear and circular patterns
- [ ] **Configuration management** - Create/switch configurations

### Known Failure Modes to Test
- Calling tools with no document open
- Calling sketch tools with no active sketch
- Calling extrusion with no closed sketch profile
- COM disconnection mid-operation
- SolidWorks version differences (2021 vs 2025 API changes)
- Large assemblies (100+ components)

## Writing Tests

### Unit Test (Mock)

```typescript
import { describe, it, expect } from 'vitest';
import { createMockSolidWorksAdapter } from '../../adapters/mock-solidworks-adapter.js';

describe('SolidWorksConfig', () => {
  it('should detect version correctly', () => {
    const mock = createMockSolidWorksAdapter({ version: '2024' });
    const app = mock.getApplication();
    const version = SolidWorksConfig.getVersion(app);
    expect(version?.year).toBe('2024');
  });
});
```

### Integration Test (Real SolidWorks)

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { SolidWorksAPI } from '../solidworks/api.js';

describe.skipIf(process.env.USE_MOCK_SOLIDWORKS === 'true')('SolidWorks Integration', () => {
  let api: SolidWorksAPI;

  beforeAll(() => {
    api = new SolidWorksAPI();
    api.connect();
  });

  it('should create part document', () => {
    const model = api.createPart();
    expect(model.type).toBe('Part');
  });
});
```

## CI/CD

### Current State

No CI pipeline runs integration tests. The GitHub Actions workflow (if configured) only runs mock-based unit tests.

### Ideal Setup (Not Yet Implemented)

A self-hosted Windows runner with SolidWorks installed would enable:
- Automated integration tests on push/PR
- Multi-version testing (2021-2025)
- Regression detection for COM interop issues

### Setting Up a Self-Hosted Runner

If you have a Windows machine with SolidWorks:

1. Install GitHub Actions runner
2. Add labels: `windows`, `solidworks`
3. Configure as a service

```powershell
./config.cmd --url https://github.com/vespo92/SolidworksMCP-TS --token YOUR_TOKEN --labels windows,solidworks
./svc.cmd install
./svc.cmd start
```

## How to Contribute Test Results

If you have SolidWorks and can test:

1. Pick a tool from the "What Needs Testing" checklist above
2. Run it against your SolidWorks version
3. Open an issue with:
   - Tool name and parameters used
   - SolidWorks version
   - Result (success/failure)
   - Error messages or unexpected behavior
   - Screenshots if relevant

Even a simple "I ran `create_part` on SW2024 and it worked" is valuable.
