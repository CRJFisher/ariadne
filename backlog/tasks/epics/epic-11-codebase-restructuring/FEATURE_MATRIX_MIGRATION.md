# Language-Feature-Testing Matrix Migration Plan

## Current Structure vs Target Structure

### Current Structure
```
src/
├── call_graph/
│   └── call_analysis/
├── languages/
│   ├── javascript/
│   ├── python/
│   ├── rust/
│   └── typescript/
├── project/
├── storage/
└── utils/
```

### Target Structure
```
src/
├── [feature_category]/           # e.g., import_resolution, call_graph
│   ├── [feature]/               # e.g., namespace_imports
│   │   ├── README.md            # Feature documentation
│   │   ├── [feature].test.ts    # Test interface definition
│   │   ├── [feature].javascript.test.ts
│   │   ├── [feature].python.test.ts
│   │   ├── [feature].rust.test.ts
│   │   └── [feature].typescript.test.ts
│   └── [language_specific_feature]/
│       └── [language]/
│           └── implementation.ts
├── feature_registry.ts           # Central feature support matrix
└── languages/                    # Keep existing language configs
    ├── javascript/
    ├── python/
    ├── rust/
    └── typescript/
```

## Feature Capabilities Implemented Today

### Namespace Resolution (Added 2025-08-06)
- **JavaScript/TypeScript**: ✅ Full support
  - Simple namespace imports (`import * as name`)
  - Nested namespace member access (`namespace.submodule.member`)
  - Re-exported namespaces (`export { namespace }`)
- **Python**: ⚠️ Partial (module imports work differently)
- **Rust**: ⚠️ Partial (use statements work differently)

### Method Chaining
- **JavaScript/TypeScript**: ✅ Full support
  - Chained method calls (`obj.method1().method2()`)
  - Nested member expressions (`obj.prop.method()`)
- **Python**: ✅ Supported
- **Rust**: ✅ Supported

### Cross-file Resolution
- **All languages**: ✅ Core support
  - Import resolution
  - Export detection
  - Definition tracking

## Migration Strategy

### Phase 1: Document Current Features
Create a comprehensive feature matrix documenting all current capabilities:

```typescript
// src/features/namespace_resolution/index.test.ts
export interface NamespaceResolutionTestSuite {
  testSimpleNamespaceImport(): void;
  testNestedNamespaceAccess(): void;
  testReExportedNamespace(): void;
}
```

### Phase 2: Reorganize Gradually
Start with new features following the new structure while maintaining backward compatibility:

1. **New features** → Follow new structure immediately
2. **Existing features** → Migrate as we enhance them
3. **Language files** → Keep in current location but reference from feature tests

### Phase 3: Create Discovery Script
Build tooling to scan the folder structure and generate support matrices:

```bash
npm run discover-features
# Scans src/ folders and generates FEATURE_MATRIX.md
# No registry to maintain - filesystem is the source of truth
```

## Immediate Actions

### 1. Create Feature Folders
Follow the new structure for any feature work:
```
src/import_resolution/namespace_imports/
├── README.md                        # Documents support & limitations
├── namespace_imports.test.ts        # Test interface
├── namespace_imports.javascript.test.ts   # Exists = supported
└── namespace_imports.python.test.ts       # Missing = not supported
```

### 2. Document in README.md
Each feature's README documents support levels:

```markdown
# Namespace Imports

## Language Support
- JavaScript: ✅ Full support
- TypeScript: ✅ Full support  
- Python: ❌ Not supported (different import model)
- Rust: ❌ Not supported (use statements differ)

## Implementation Details
- Enhanced scope queries to capture nested member expressions
- Added namespace re-export detection in import_export_detector
- Improved reference resolution for namespace chains
```

### 3. Use Discovery Script
Generate support matrices on demand:

```bash
npm run discover-features
# Scans folder structure and generates FEATURE_MATRIX.md
```

## Benefits of New Structure

1. **Clear feature ownership** - Each feature has its own directory
2. **Language parity tracking** - Easy to see which languages support what
3. **Test consistency** - Shared test interfaces ensure all languages are tested the same way
4. **Documentation locality** - Feature docs live with the code
5. **Progressive migration** - Can adopt gradually without breaking changes

## Next Steps

1. [x] Create example structure: `src/import_resolution/namespace_imports/`
2. [x] Document namespace resolution feature in new structure
3. [x] Create test interface for namespace resolution
4. [ ] Build discovery script to scan folder structure
5. [ ] Migrate more features as we work on them
6. [ ] Update contributing guide with new structure