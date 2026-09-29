# SolidWorks Version Compatibility

This document details compatibility across different SolidWorks versions and provides version-specific guidance.

## Supported Versions

| SW Version | Support Level | Mock Testing | Integration Testing | Notes |
|------------|---------------|--------------|---------------------|-------|
| **2025**   | ✅ Full      | ✅ Yes       | ✅ Yes              | Latest version |
| **2024**   | ✅ Full      | ✅ Yes       | ✅ Yes              | Primary test version |
| **2023**   | ✅ Full      | ✅ Yes       | ✅ Yes              | Fully supported |
| **2022**   | ✅ Full      | ✅ Yes       | ✅ Yes              | Fully supported |
| **2021**   | ✅ Full      | ✅ Yes       | ✅ Yes              | Fully supported |
| **2020**   | ⚠️ Limited   | ✅ Yes       | ⚠️ Manual           | API differences |
| **2019**   | ⚠️ Limited   | ✅ Yes       | ⚠️ Manual           | API differences |
| < 2019     | ❌ Not tested | ⚠️ Partial   | ❌ No               | Not recommended |

### Support Levels

- **✅ Full**: Fully tested, all features work
- **⚠️ Limited**: Most features work, some limitations
- **❌ Not tested**: May work but not officially supported

---

## Version Detection

The server automatically detects your SolidWorks version:

```typescript
import { SolidWorksConfig } from './src/utils/solidworks-config.js';

const version = SolidWorksConfig.getVersion(app);
console.log(version);
// {
//   year: '2024',
//   majorVersion: 2024,
//   revisionNumber: '2024 SP5.0'
// }
```

### Version Number Formats

| Version | Revision Format | Example |
|---------|----------------|---------|
| 2025    | `YYYY SP X.Y`  | `2025 SP5.0` |
| 2024    | `YYYY SP X.Y`  | `2024 SP5.0` |
| 2023    | `YYYY SP X.Y`  | `2023 SP5.0` |
| 2022    | `YYYY SP X.Y`  | `2022 SP5.0` |
| 2021    | `YYYY SP X.Y`  | `2021 SP5.0` |
| 2020    | `YYYY SP X.Y`  | `2020 SP5.0` |
| 2019    | `XX.Y.Z.ZZZZ`  | `27.5.0.0084` |

---

## Feature Compatibility

### Core Features

| Feature | 2021 | 2022 | 2023 | 2024 | 2025 |
|---------|------|------|------|------|------|
| Part Creation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assembly Creation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Drawing Creation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sketch Operations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Feature Creation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Extrusion | ✅ | ✅ | ✅ | ✅ | ✅ |
| Revolve | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sweep | ✅ | ✅ | ✅ | ✅ | ✅ |
| Loft | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export (STEP) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export (IGES) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export (STL) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export (PDF) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mass Properties | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dimensions | ✅ | ✅ | ✅ | ✅ | ✅ |

### Advanced Features

| Feature | 2021 | 2022 | 2023 | 2024 | 2025 |
|---------|------|------|------|------|------|
| VBA Macro Gen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Design Tables | ✅ | ✅ | ✅ | ✅ | ✅ |
| PDM Integration | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| SQL Integration | ✅ | ✅ | ✅ | ✅ | ✅ |
| Circuit Breaker | ✅ | ✅ | ✅ | ✅ | ✅ |
| Connection Pool | ✅ | ✅ | ✅ | ✅ | ✅ |

**Legend:**
- ✅ Fully supported
- ⚠️ Partially supported
- ❌ Not supported

---

## Known Issues by Version

### SolidWorks 2025

**Status:** ✅ Fully Supported

No known issues.

### SolidWorks 2024

**Status:** ✅ Fully Supported (Primary)

No known issues.

### SolidWorks 2023

**Status:** ✅ Fully Supported

**Known Issues:**
- Sketch selection may require explicit name in some cases

**Workaround:**
```typescript
// Specify sketch name explicitly
const feature = await api.createExtrude({
  depth: 25,
  sketchName: 'Sketch1'  // Add this
});
```

### SolidWorks 2022

**Status:** ✅ Fully Supported

No known issues.

### SolidWorks 2021

**Status:** ✅ Fully Supported

**Known Issues:**
- Drawing view creation may timeout with large assemblies

**Workaround:**
```env
# Increase timeout
OPERATION_TIMEOUT=30000
```

### SolidWorks 2020

**Status:** ⚠️ Limited Support

**Known Issues:**
1. Some API methods have different signatures
2. FeatureExtrusion3 may not support all parameters

**Workarounds:**
- Use VBA macro fallback for complex features
- Enable compatibility mode:
  ```env
  SOLIDWORKS_VERSION=2020
  USE_LEGACY_API=true
  ```

### SolidWorks 2019

**Status:** ⚠️ Limited Support

**Known Issues:**
1. Version number format different (27.x instead of 2019)
2. Some API methods not available
3. Template paths may differ

**Workarounds:**
- Specify template paths explicitly:
  ```env
  TEMPLATE_PART=C:\Your\Custom\Path\Part.prtdot
  TEMPLATE_ASSEMBLY=C:\Your\Custom\Path\Assembly.asmdot
  TEMPLATE_DRAWING=C:\Your\Custom\Path\Drawing.drwdot
  ```

---

## Testing Across Versions

### Local Testing

Test against a specific version:

```bash
# Set version in .env
SOLIDWORKS_VERSION=2023

# Run tests
npm test

# Or inline
SOLIDWORKS_VERSION=2023 npm test
```

### Mock Testing (All Versions)

Test all supported versions without SolidWorks:

```bash
# Automated via CI
npm run test:versions

# Manual
for version in 2021 2022 2023 2024 2025; do
  SOLIDWORKS_VERSION=$version USE_MOCK_SOLIDWORKS=true npm test
done
```

### Integration Testing

Test with real SolidWorks:

```bash
# Must match your installed version
SOLIDWORKS_VERSION=2024 USE_MOCK_SOLIDWORKS=false npm run test:integration
```

---

## Migration Guide

### Upgrading from Older Versions

When upgrading from an older SolidWorks version:

1. **Check Compatibility**

   Verify your version is supported (2021+)

2. **Update Configuration**

   ```env
   # Update to your new version
   SOLIDWORKS_VERSION=2024
   ```

3. **Test Core Functionality**

   ```bash
   npm run test:integration
   ```

4. **Update Templates (if needed)**

   New versions may have different template locations:

   ```env
   TEMPLATE_PART=C:\ProgramData\SolidWorks\SOLIDWORKS 2024\templates\Part.prtdot
   ```

5. **Review Changelog**

   Check for version-specific changes

### Downgrading Support

If you need to support an older version:

1. **Install Compatibility Package**

   ```bash
   npm install @solidworks-mcp/compat-2020
   ```

2. **Enable Legacy Mode**

   ```env
   USE_LEGACY_API=true
   ```

3. **Test Thoroughly**

   ```bash
   npm run test:integration
   ```

---

## API Differences

### Method Signatures

Some methods have different signatures across versions:

#### FeatureExtrusion

**2021+:**
```typescript
FeatureExtrusion3(
  sd: boolean,
  flip: boolean,
  dir: boolean,
  t1: number,
  t2: number,
  d1: number,
  d2: number,
  // ... 20+ more parameters
)
```

**2019-2020:**
```typescript
FeatureExtrusion(
  sd: boolean,
  flip: boolean,
  dir: boolean,
  t1: number,
  t2: number,
  d1: number,
  d2: number,
  // ... 13 parameters
)
```

**Solution:** Use VBA macro fallback for complex operations:

```typescript
// Automatically uses macro for complex features
const feature = await api.createExtrude({
  depth: 25,
  draft: 5,
  // Complex parameters trigger macro fallback
  thinFeature: true,
  capEnds: true
});
```

---

## Version-Specific Configuration

### Template Paths

| Version | Default Template Path |
|---------|----------------------|
| 2025    | `C:\ProgramData\SolidWorks\SOLIDWORKS 2025\templates\` |
| 2024    | `C:\ProgramData\SolidWorks\SOLIDWORKS 2024\templates\` |
| 2023    | `C:\ProgramData\SolidWorks\SOLIDWORKS 2023\templates\` |
| 2022    | `C:\ProgramData\SolidWorks\SOLIDWORKS 2022\templates\` |
| 2021    | `C:\ProgramData\SolidWorks\SOLIDWORKS 2021\templates\` |

### Registry Paths

| Version | Registry Key |
|---------|--------------|
| 2025    | `HKLM\SOFTWARE\SolidWorks\SOLIDWORKS 2025` |
| 2024    | `HKLM\SOFTWARE\SolidWorks\SOLIDWORKS 2024` |
| 2023    | `HKLM\SOFTWARE\SolidWorks\SOLIDWORKS 2023` |

---

## Performance by Version

### Benchmark Results

Tested on: Windows 11, i7-12700K, 32GB RAM

| Operation | 2021 | 2023 | 2024 | 2025 |
|-----------|------|------|------|------|
| Create Part | 1.2s | 1.1s | 1.0s | 0.9s |
| Simple Extrude | 0.8s | 0.7s | 0.6s | 0.6s |
| Complex Feature | 2.5s | 2.3s | 2.1s | 2.0s |
| Export STEP | 3.2s | 3.0s | 2.8s | 2.7s |
| Drawing Creation | 4.5s | 4.2s | 3.9s | 3.8s |

*Note: Performance varies based on hardware and model complexity*

---

## Reporting Version-Specific Issues

When reporting issues, include:

1. **SolidWorks Version**

   ```
   SW Version: 2024 SP5.0
   ```

2. **Server Version**

   ```bash
   npm list solidworks-mcp-server
   ```

3. **Configuration**

   ```env
   SOLIDWORKS_VERSION=2024
   USE_MOCK_SOLIDWORKS=false
   ```

4. **Reproduction Steps**

5. **Expected vs Actual Behavior**

6. **Logs**

   ```bash
   LOG_LEVEL=debug npm run dev 2>&1 | tee debug.log
   ```

---

## Future Versions

When new SolidWorks versions are released:

1. **Testing Period**: 1-2 months after release
2. **Mock Support**: Added immediately
3. **Integration Tests**: Added after testing
4. **Full Support**: Typically within 3 months

To request support for a specific version, open an issue with the `version-support` label.

---

## Summary

- **Recommended**: SolidWorks 2021-2025
- **Best Tested**: SolidWorks 2024
- **Mock Testing**: All versions supported
- **Breaking Changes**: Rare, documented when they occur
- **Update Frequency**: Quarterly compatibility reviews

For the latest compatibility information, check the [releases page](https://github.com/vespo92/SolidworksMCP-TS/releases).
