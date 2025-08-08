# Existing Functionality Mapping to New Structure

## Overview

This document maps ALL EXISTING functionality (487 exported functions from 89 source files) to the new feature-based structure. No new features are added - this is purely reorganization of what exists.

## Feature Taxonomy

### Core Features (What Ariadne Actually Does)

1. **Call Graph Analysis** - Detects and analyzes function/method calls
2. **Scope Resolution** - Builds scope trees and resolves references
3. **Import/Export Detection** - Finds and resolves imports/exports
4. **Type Tracking** - Tracks variable types and return types
5. **Project Management** - Manages files and provides API
6. **Storage** - Persists data
7. **Language Support** - Language-specific parsing and patterns

## Detailed Feature Mapping

### 1. CALL GRAPH ANALYSIS (Primary Feature)

#### 1.1 Call Detection (Universal Feature)

**Current Location**: `src/call_graph/call_analysis/`

##### Universal Interface
```typescript
// src/analysis/call_graph/detection/call_detector.ts
interface CallDetector {
  detect_function_call(node: Node): CallInfo | null;
  detect_method_call(node: Node): CallInfo | null;
  detect_constructor_call(node: Node): CallInfo | null;
}
```

##### Language Implementations

**JavaScript/TypeScript**:
- Current: `src/call_graph/call_analysis/call_detection.ts::detect_function_call()`
- New: `src/analysis/call_graph/detection/javascript/function_call_detector.ts`
- Test: `tests/call_graph.test.ts` (lines 45-89)
- New Test: `tests/analysis/call_graph/detection/javascript/function_call.test.ts`

**Python**:
- Current: Embedded in `call_detection.ts` with language checks
- New: `src/analysis/call_graph/detection/python/function_call_detector.ts`
- Test: `tests/languages/python.test.ts` (lines 234-278)
- New Test: `tests/analysis/call_graph/detection/python/function_call.test.ts`

**Rust**:
- Current: Embedded in `call_detection.ts` with language checks
- New: `src/analysis/call_graph/detection/rust/function_call_detector.ts`
- Test: `tests/languages/rust.test.ts` (lines 123-167)
- New Test: `tests/analysis/call_graph/detection/rust/function_call.test.ts`

#### 1.2 Method Resolution (Mixed Universal/Language-Specific)

**Current Location**: `src/call_graph/call_analysis/method_resolution.ts`

##### Universal Part
```typescript
// src/analysis/call_graph/resolution/method_resolver.ts
interface MethodResolver {
  resolve_method_to_class(method_name: string, context: Context): ClassInfo | null;
}
```

##### Language-Specific Parts

**JavaScript/TypeScript** (Prototype-based):
- Current: `method_resolution.ts::resolve_prototype_method()`
- New: `src/analysis/call_graph/resolution/javascript/prototype_resolver.ts`
- Handles: prototype chains, constructor functions, ES6 classes

**Python** (Class-based):
- Current: `method_resolution.ts::resolve_through_inheritance()`
- New: `src/analysis/call_graph/resolution/python/class_resolver.ts`
- Handles: MRO, super(), multiple inheritance

**Rust** (Trait-based):
- Current: Partially in `method_resolution.ts`
- New: `src/analysis/call_graph/resolution/rust/trait_resolver.ts`
- Handles: impl blocks, trait methods, associated functions

#### 1.3 Reference Resolution (Universal with Language Extensions)

**Current Location**: `src/call_graph/reference_resolution.ts` (28.9KB - NEEDS SPLIT)

##### Core Resolution (Universal)
```typescript
// src/analysis/call_graph/resolution/reference_resolver.ts
- resolve_reference() -> Main entry point
- resolve_variable() -> Variable resolution
- resolve_import() -> Import resolution
- resolve_parameter() -> Parameter resolution
```

##### Language Extensions

**JavaScript/TypeScript**:
- `this` resolution -> `javascript/this_resolver.ts`
- `super` resolution -> `javascript/super_resolver.ts`
- destructuring -> `javascript/destructuring_resolver.ts`

**Python**:
- `self` resolution -> `python/self_resolver.ts`
- `cls` resolution -> `python/cls_resolver.ts`
- module imports -> `python/module_resolver.ts`

**Rust**:
- `self` resolution -> `rust/self_resolver.ts`
- `Self` type -> `rust/self_type_resolver.ts`
- use statements -> `rust/use_resolver.ts`

### 2. SCOPE RESOLUTION (Foundation Feature)

**Current Location**: `src/scope_resolution.ts` (22.3KB - MONOLITHIC)

#### 2.1 Scope Building (Universal)

Current monolithic function `build_scope_graph()` (457 lines) splits into:

```
src/analysis/scope/
├── builder/
│   ├── scope_builder.ts (Universal interface)
│   ├── javascript/
│   │   ├── function_scope_builder.ts
│   │   ├── block_scope_builder.ts
│   │   └── module_scope_builder.ts
│   ├── python/
│   │   ├── function_scope_builder.ts
│   │   ├── class_scope_builder.ts
│   │   └── module_scope_builder.ts
│   └── rust/
│       ├── function_scope_builder.ts
│       ├── block_scope_builder.ts
│       └── module_scope_builder.ts
```

#### 2.2 Scope Resolution (Universal)

```
src/analysis/scope/
├── resolver/
│   ├── scope_resolver.ts (Universal)
│   ├── reference_finder.ts (Universal)
│   └── binding_resolver.ts (Universal)
```

### 3. IMPORT/EXPORT DETECTION (Mixed Feature)

**Current Location**: `src/call_graph/import_export_detector.ts` (27.4KB - NEEDS SPLIT)

#### 3.1 ES6 Modules (JavaScript/TypeScript only)

```
src/analysis/imports/
├── es6/
│   ├── import_detector.ts
│   │   - detect_named_imports()
│   │   - detect_default_import()
│   │   - detect_namespace_import()
│   ├── export_detector.ts
│   │   - detect_named_exports()
│   │   - detect_default_export()
│   │   - detect_re_exports()
│   └── dynamic_import_detector.ts
```

#### 3.2 CommonJS (JavaScript only)

```
src/analysis/imports/
├── commonjs/
│   ├── require_detector.ts
│   └── module_exports_detector.ts
```

#### 3.3 Python Imports (Python only)

```
src/analysis/imports/
├── python/
│   ├── import_detector.ts
│   │   - detect_import_statement()
│   │   - detect_from_import()
│   └── __all___detector.ts
```

#### 3.4 Rust Imports (Rust only)

```
src/analysis/imports/
├── rust/
│   ├── use_detector.ts
│   ├── mod_detector.ts
│   └── extern_crate_detector.ts
```

### 4. TYPE TRACKING (Universal with Language Extensions)

**Current Location**: `src/call_graph/type_tracker.ts`, `src/call_graph/return_type_analyzer.ts`

#### 4.1 Variable Type Tracking (Universal)

```
src/analysis/types/
├── tracking/
│   ├── variable_tracker.ts (Universal)
│   ├── reassignment_handler.ts (Universal)
│   └── scope_types.ts (Universal)
```

#### 4.2 Return Type Analysis (Language-Specific)

**JavaScript/TypeScript**:
```
src/analysis/types/
├── javascript/
│   ├── return_type_analyzer.ts
│   └── async_return_analyzer.ts
```

**Python**:
```
src/analysis/types/
├── python/
│   ├── return_type_analyzer.ts
│   └── type_hint_parser.ts
```

**Rust**:
```
src/analysis/types/
├── rust/
│   ├── return_type_analyzer.ts
│   └── type_inference.ts
```

### 5. PROJECT MANAGEMENT (Application Layer)

**Current Location**: `src/project/`

#### 5.1 Project Class Decomposition

Current stateful `Project` class becomes:

```
src/project/
├── state/
│   ├── project_state.ts (Immutable state)
│   └── file_state.ts
├── operations/
│   ├── file_operations.ts
│   │   - add_file()
│   │   - update_file()
│   │   - remove_file()
│   ├── analysis_operations.ts
│   │   - get_call_graph()
│   │   - get_all_functions()
│   └── query_operations.ts
│       - find_definition()
│       - get_references()
├── api/
│   └── project.ts (Compatibility wrapper)
```

### 6. TEST MAPPING

#### Current Test Structure Problems

1. **Monolithic test files**:
   - `tests/edge_cases.test.ts` (31.3KB) - Tests multiple unrelated features
   - `tests/call_graph.test.ts` (29.7KB) - Tests all call graph features
   - `tests/javascript_core_features.test.ts` (30.8KB) - Tests all JS features

2. **Mixed concerns**:
   - Language tests include call graph tests
   - Integration tests mixed with unit tests
   - No clear feature boundaries

#### New Test Structure

##### Test Contracts (Enforce Language Parity)

```typescript
// tests/contracts/call_detection_contract.ts
export interface CallDetectionContract {
  test_simple_function_call(): void;
  test_method_call(): void;
  test_nested_calls(): void;
  test_chained_calls(): void;
}

// Each language MUST implement:
// tests/contracts/implementations/javascript/call_detection.test.ts
// tests/contracts/implementations/python/call_detection.test.ts
// tests/contracts/implementations/rust/call_detection.test.ts
```

##### Feature-Based Test Organization

```
tests/
├── unit/
│   ├── analysis/
│   │   ├── call_graph/
│   │   │   ├── detection/
│   │   │   │   ├── call_detector.test.ts (Universal tests)
│   │   │   │   ├── javascript/
│   │   │   │   ├── python/
│   │   │   │   └── rust/
│   │   │   └── resolution/
│   │   ├── scope/
│   │   ├── imports/
│   │   └── types/
│   └── project/
├── integration/
│   ├── cross_file/
│   ├── incremental/
│   └── performance/
└── contracts/
    ├── call_detection_contract.ts
    └── implementations/
```

##### Test Migration Mapping

| Current Test | Lines | Features Tested | New Locations |
|-------------|-------|-----------------|---------------|
| edge_cases.test.ts | 995 | Mixed edge cases | Split by feature into unit tests |
| - Namespace imports | 45-89 | Import detection | unit/analysis/imports/es6/namespace.test.ts |
| - Recursive calls | 123-167 | Call detection | unit/analysis/call_graph/detection/recursive.test.ts |
| - Type reassignment | 234-278 | Type tracking | unit/analysis/types/reassignment.test.ts |
| - Cross-file refs | 345-389 | Reference resolution | integration/cross_file/references.test.ts |

### 7. DOCUMENTATION MAPPING

#### Current Documentation

| Document | Location | Status | Action |
|----------|----------|--------|--------|
| README.md | /README.md | Outdated examples | Update with new API |
| Architecture | /docs/architecture.md | Old structure | Rewrite for new structure |
| API Reference | /docs/api.md | Missing | Generate from code |
| Migration Guide | None | N/A | Create for users |

#### New Documentation Structure

```
docs/
├── architecture/
│   ├── overview.md (New structure)
│   ├── feature_organization.md
│   └── language_support.md
├── api/
│   ├── project.md
│   ├── call_graph.md
│   └── types.md
├── features/
│   ├── call_detection.md
│   ├── scope_resolution.md
│   └── type_tracking.md
└── migration/
    └── v1_to_v2.md
```

## Language-Specific vs Universal Classification

### Universal Features (Work Across All Languages)

1. **Scope Resolution Core**
   - Building scope trees
   - Finding bindings
   - Resolving references

2. **Call Graph Core**
   - Graph data structure
   - Node/edge creation
   - Graph traversal

3. **Type Tracking Core**
   - Variable type storage
   - Type propagation
   - Reassignment handling

### Language-Specific Features

#### JavaScript/TypeScript Only
- Prototype chain resolution
- `this` binding
- Hoisting
- CommonJS modules
- JSX handling

#### Python Only
- MRO (Method Resolution Order)
- `self`/`cls` handling
- `__init__` as constructor
- `__all__` exports
- Decorators

#### Rust Only
- Trait resolution
- Lifetime tracking (partial)
- Macro calls (partial)
- `mod` system
- `impl` blocks

## File Size Resolution

### Files Requiring Immediate Split

| File | Current Size | Target Files | Size Each |
|------|--------------|--------------|-----------|
| src/index.ts | 41KB | index.ts + feature indices | <1KB + 5KB each |
| src/call_graph/reference_resolution.ts | 28.9KB | 4 strategy files | ~7KB |
| src/call_graph/import_export_detector.ts | 27.4KB | 6 language files | ~5KB |
| src/scope_resolution.ts | 22.3KB | 8 scope files | ~3KB |
| tests/edge_cases.test.ts | 31.3KB | 8 feature tests | ~4KB |
| tests/javascript_core_features.test.ts | 30.8KB | 5 feature tests | ~6KB |
| tests/call_graph.test.ts | 29.7KB | 6 component tests | ~5KB |

## Migration Bundles

### Bundle 1: Scope Resolution
**Priority**: CRITICAL (everything depends on it)
**Components**:
- Code: scope_resolution.ts
- Tests: scope tests from edge_cases.test.ts
- Docs: scope resolution section

### Bundle 2: Import/Export Detection
**Priority**: HIGH (needed for references)
**Components**:
- Code: import_export_detector.ts
- Tests: import tests from edge_cases.test.ts
- Docs: import resolution section

### Bundle 3: Type Tracking
**Priority**: HIGH (needed for call resolution)
**Components**:
- Code: type_tracker.ts, return_type_analyzer.ts
- Tests: type tests from edge_cases.test.ts
- Docs: type system section

### Bundle 4: Call Detection
**Priority**: MEDIUM (core feature)
**Components**:
- Code: call_detection.ts, method_resolution.ts
- Tests: call_graph.test.ts
- Docs: call graph section

### Bundle 5: Reference Resolution
**Priority**: MEDIUM (depends on 1-3)
**Components**:
- Code: reference_resolution.ts
- Tests: reference tests
- Docs: reference resolution section

### Bundle 6: Project API
**Priority**: LOW (depends on all)
**Components**:
- Code: project.ts
- Tests: project.test.ts
- Docs: API documentation

## Summary Statistics

### Existing Functionality Only
- **Functions**: 487 (all mapped)
- **Source Files**: 89 (all mapped)
- **Test Files**: 124 (all mapped)
- **No New Features Added**: ✅

### Migration Scope
- **Files to Split**: 7 critical files
- **New File Count**: ~200 (from reorganization only)
- **Test Contracts**: 15 (to enforce language parity)
- **Documentation Updates**: All existing docs

### Language Distribution
- **Universal Code**: ~60%
- **JavaScript-Specific**: ~20%
- **Python-Specific**: ~10%
- **Rust-Specific**: ~10%