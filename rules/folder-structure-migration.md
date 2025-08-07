# Folder Structure Migration Guidelines

## Overview

This document defines the target folder structure for the Ariadne codebase and provides guidelines for migrating existing code to this structure. The goal is to organize code by feature rather than by technical layer, making it easier to understand feature support across languages.

## Target Folder Structure

```
src/
├── [feature_category]/          # Major feature areas
│   ├── [feature]/               # Specific features
│   │   ├── README.md            # Feature documentation & support levels
│   │   ├── [feature].ts         # Core implementation (if shared)
│   │   ├── [feature].test.ts    # Test interface/base cases
│   │   ├── [feature].javascript.test.ts  # Exists = supported
│   │   ├── [feature].typescript.test.ts  # Exists = supported
│   │   ├── [feature].python.test.ts      # Missing = not supported
│   │   └── [feature].rust.test.ts        # Missing = not supported
│   └── [language_specific]/     # Language-specific features
│       └── [language]/
│           ├── [feature].ts
│           └── [feature].test.ts
├── languages/                    # Language configurations (keep existing)
│   ├── javascript/
│   │   ├── index.ts             # Parser and config
│   │   └── scopes.scm           # Tree-sitter queries
│   ├── python/
│   ├── rust/
│   └── typescript/
└── utils/                        # Shared utilities
```

## Feature Categories

Features should be organized into these primary categories:

### 1. `import_resolution/`

- `basic_imports/` - Simple import statements
- `namespace_imports/` - Import \* as patterns
- `dynamic_imports/` - Runtime imports
- `re_exports/` - Export forwarding

### 2. `call_graph/`

- `function_calls/` - Basic function invocation
- `method_calls/` - Object method calls
- `method_chaining/` - Chained method calls
- `recursive_calls/` - Self-referential calls
- `cross_file_calls/` - Inter-file resolution

### 3. `type_system/`

- `type_inference/` - Inferring types from usage
- `return_types/` - Function return type analysis
- `variable_tracking/` - Type flow through variables
- `generics/` - Generic/template types

### 4. `scope_resolution/`

- `lexical_scopes/` - Block and function scopes
- `hoisting/` - JavaScript var/function hoisting
- `closures/` - Variable capture
- `modules/` - Module-level scoping

### 5. `export_detection/`

- `es6_exports/` - export statements
- `commonjs_exports/` - module.exports
- `python_exports/` - **all** and conventions
- `rust_exports/` - pub visibility

### 6. `inheritance/`

- `class_inheritance/` - extends/subclassing
- `interface_implementation/` - implements
- `mixins/` - Mixin patterns
- `traits/` - Rust traits

## Migration Strategy

### Phase 1: New Features (Immediate)

All new features MUST follow the new structure:

1. Create feature category directory if needed
2. Create feature subdirectory
3. Add README.md documenting the feature and language support
4. Create test interface in `[feature].test.ts`
5. Implement language-specific tests (existence = support)

### Phase 2: Enhanced Features (As Needed)

When modifying existing features:

1. Move the feature to the new structure
2. Create test interfaces
3. Migrate existing tests to language-specific files
4. Update imports throughout codebase
5. Document support levels in README.md

### Phase 3: Full Migration (Long Term)

Systematically migrate all existing code:

1. Start with most frequently modified features
2. Group related functionality together
3. Maintain backward compatibility during transition
4. Remove old structure once migration complete

## File Naming Conventions

### Test Files

- `[feature].test.ts` - Test interface and shared utilities
- `[feature].[language].test.ts` - Language-specific implementation
- Test files must export an interface that defines all test cases

### Implementation Files

- `[feature].ts` - Shared implementation
- `[feature].[language].ts` - Language-specific implementation
- `index.ts` - Feature exports and public API

### Documentation

- `README.md` - Feature overview, patterns, examples
- Include implementation date and author
- Document language support levels
- Provide code examples for each supported language

## Test Structure Requirements

### Test Interface Definition

Every feature must define a test interface:

```typescript
// [feature].test.ts
export interface [Feature]TestSuite {
  // Required test cases
  testBasicUsage(): void;
  testXCase(): void;
  testYCase(): void;
  //...
  testErrorHandling(): void;
  // Feature-specific cases...
}
```

### Language Implementation

Each language must implement the interface:

```typescript
// [feature].javascript.test.ts
import { [Feature]TestSuite } from './[feature].test';

class JavaScript[Feature]Tests implements [Feature]TestSuite {
  testBasicUsage(): void {
    // JavaScript-specific test implementation
  }
  // ... implement all interface methods
}
```

## Feature Documentation

Each feature folder must contain a README.md that documents:

```markdown
# Feature Name

## Overview

Brief description of what this feature does

## Language Support

- JavaScript: ✅ Full support
- TypeScript: ✅ Full support
- Python: ⚠️ Partial (limitation notes)
- Rust: ❌ Not supported

## Implementation Notes

Any important details or limitations
```

The presence of test files indicates support:

- `feature.javascript.test.ts` exists = JavaScript supported
- Missing test file = Not supported for that language
- No separate registry needed - the folder structure IS the registry

## Benefits of This Structure

1. **Feature Clarity**: Easy to see what features exist and their support level
2. **Language Parity**: Clear visibility of feature gaps across languages
3. **Test Consistency**: Shared test interfaces ensure uniform testing
4. **Documentation Locality**: Docs live with code for better maintenance
5. **Progressive Enhancement**: Can add language support incrementally
6. **Developer Experience**: Easier to find and understand features

## Examples

### Example 1: Namespace Imports (Already Implemented)

```
src/
└── import_resolution/
    └── namespace_imports/
        ├── README.md
        ├── namespace_imports.test.ts
        ├── namespace_imports.javascript.test.ts
        └── namespace_imports.typescript.test.ts
```

### Example 2: Method Chaining (To Be Migrated)

```
src/
└── call_graph/
    └── method_chaining/
        ├── README.md
        ├── method_chaining.ts
        ├── method_chaining.test.ts
        ├── method_chaining.javascript.test.ts
        ├── method_chaining.python.test.ts
        ├── method_chaining.rust.test.ts
        └── method_chaining.typescript.test.ts
```

## Compliance Validation

The `scripts/discover_features.ts` script validates:

- Which features exist (by scanning folders)
- Which languages are supported (by checking for test files)
- Which features have documentation (README.md exists)
- Coverage percentages per language

No registry to maintain - the folder structure is self-documenting!

## Timeline

- **Immediate**: Apply to all new features
- **Q1 2025**: Migrate high-traffic features
- **Q2 2025**: Complete migration of core features
- **Q3 2025**: Full migration complete

## References

- `docs/FEATURE_MATRIX_MIGRATION.md` - Migration plan and current state
- `scripts/discover_features.ts` - Scan folder structure to generate support matrix
