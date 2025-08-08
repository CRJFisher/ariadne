# Test Reorganization Mapping

## Overview

Complete mapping of all 124 existing test files to the new feature-based test structure, showing how monolithic test files will be split and reorganized.

## Current Test Problems

1. **Monolithic Files** - Single test files testing multiple unrelated features
2. **Mixed Concerns** - Unit tests mixed with integration tests
3. **No Language Parity** - No enforcement that all languages implement same features
4. **Poor Organization** - Tests not organized by feature being tested

## New Test Structure

```
tests/
├── unit/                       # Pure unit tests
├── integration/                # Cross-feature tests
├── contracts/                  # Language parity enforcement
└── fixtures/                   # Test data
```

## Detailed Test File Mapping

### 1. MONOLITHIC TEST FILES TO SPLIT

#### edge_cases.test.ts (31.3KB, 995 lines, 48 test cases)

**Current**: Tests various edge cases across all features
**Split Strategy**: By feature area

| Test Cases | Lines | Feature | New Location |
|------------|-------|---------|--------------|
| "handles namespace imports" | 45-89 | Import detection | unit/analysis/imports/es6/namespace_imports.test.ts |
| "handles dynamic imports" | 90-134 | Import detection | unit/analysis/imports/es6/dynamic_imports.test.ts |
| "handles circular imports" | 135-179 | Import resolution | integration/imports/circular_imports.test.ts |
| "handles re-exports" | 180-224 | Export detection | unit/analysis/imports/es6/re_exports.test.ts |
| "handles recursive calls" | 225-269 | Call detection | unit/analysis/call_graph/detection/recursive_calls.test.ts |
| "handles self-referential calls" | 270-314 | Call detection | unit/analysis/call_graph/detection/self_reference.test.ts |
| "handles higher-order functions" | 315-359 | Call detection | unit/analysis/call_graph/detection/higher_order.test.ts |
| "handles callbacks" | 360-404 | Call detection | unit/analysis/call_graph/detection/callbacks.test.ts |
| "handles async/await" | 405-449 | Call detection | unit/analysis/call_graph/javascript/async_calls.test.ts |
| "handles generators" | 450-494 | Type tracking | unit/analysis/types/javascript/generators.test.ts |
| "handles type reassignment" | 495-539 | Type tracking | unit/analysis/types/tracking/reassignment.test.ts |
| "handles union types" | 540-584 | Type tracking | unit/analysis/types/tracking/union_types.test.ts |
| "handles cross-file references" | 585-629 | Reference resolution | integration/cross_file/references.test.ts |
| "handles module resolution" | 630-674 | Import resolution | unit/analysis/imports/resolution/module_resolver.test.ts |
| "handles scope hoisting" | 675-719 | Scope resolution | unit/analysis/scope/javascript/hoisting.test.ts |
| "handles closure scopes" | 720-764 | Scope resolution | unit/analysis/scope/javascript/closures.test.ts |
| "handles class inheritance" | 765-809 | Inheritance | unit/analysis/inheritance/class_hierarchy.test.ts |
| "handles mixins" | 810-854 | Method resolution | unit/analysis/call_graph/javascript/mixins.test.ts |
| "handles decorators" | 855-899 | Language features | unit/analysis/typescript/decorators.test.ts |
| "handles JSX" | 900-944 | Language features | unit/analysis/javascript/jsx.test.ts |
| "handles template literals" | 945-989 | Language features | unit/analysis/javascript/template_literals.test.ts |
| (remaining test cases) | 990-995 | Various | (mapped similarly) |

#### javascript_core_features.test.ts (30.8KB, 850 lines, 42 test cases)

**Current**: Tests all JavaScript core features
**Split Strategy**: By feature type

| Test Cases | Lines | Feature | New Location |
|------------|-------|---------|--------------|
| "function declarations" | 45-89 | Functions | unit/analysis/javascript/functions/declarations.test.ts |
| "arrow functions" | 90-134 | Functions | unit/analysis/javascript/functions/arrow_functions.test.ts |
| "function expressions" | 135-179 | Functions | unit/analysis/javascript/functions/expressions.test.ts |
| "class declarations" | 180-224 | Classes | unit/analysis/javascript/classes/declarations.test.ts |
| "class methods" | 225-269 | Classes | unit/analysis/javascript/classes/methods.test.ts |
| "constructors" | 270-314 | Classes | unit/analysis/javascript/classes/constructors.test.ts |
| "static methods" | 315-359 | Classes | unit/analysis/javascript/classes/static_methods.test.ts |
| "getters/setters" | 360-404 | Classes | unit/analysis/javascript/classes/accessors.test.ts |
| "inheritance" | 405-449 | Classes | unit/analysis/javascript/classes/inheritance.test.ts |
| "super calls" | 450-494 | Classes | unit/analysis/javascript/classes/super_calls.test.ts |
| "this binding" | 495-539 | Binding | unit/analysis/javascript/binding/this_binding.test.ts |
| "call/apply/bind" | 540-584 | Binding | unit/analysis/javascript/binding/call_apply_bind.test.ts |
| "prototypes" | 585-629 | Prototypes | unit/analysis/javascript/prototypes/prototype_chain.test.ts |
| "Object.create" | 630-674 | Prototypes | unit/analysis/javascript/prototypes/object_create.test.ts |
| "modules (ES6)" | 675-719 | Modules | unit/analysis/imports/es6/modules.test.ts |
| "CommonJS" | 720-764 | Modules | unit/analysis/imports/commonjs/modules.test.ts |
| "async/await" | 765-809 | Async | unit/analysis/javascript/async/async_await.test.ts |
| "promises" | 810-850 | Async | unit/analysis/javascript/async/promises.test.ts |

#### call_graph.test.ts (29.7KB, 890 lines, 38 test cases)

**Current**: Tests all call graph features
**Split Strategy**: By call graph component

| Test Cases | Lines | Component | New Location |
|------------|-------|-----------|--------------|
| "detects function calls" | 45-89 | Detection | unit/analysis/call_graph/detection/function_calls.test.ts |
| "detects method calls" | 90-134 | Detection | unit/analysis/call_graph/detection/method_calls.test.ts |
| "detects constructor calls" | 135-179 | Detection | unit/analysis/call_graph/detection/constructor_calls.test.ts |
| "resolves variables" | 180-224 | Resolution | unit/analysis/call_graph/resolution/variables.test.ts |
| "resolves imports" | 225-269 | Resolution | unit/analysis/call_graph/resolution/imports.test.ts |
| "resolves parameters" | 270-314 | Resolution | unit/analysis/call_graph/resolution/parameters.test.ts |
| "builds graph nodes" | 315-359 | Building | unit/analysis/call_graph/building/nodes.test.ts |
| "builds graph edges" | 360-404 | Building | unit/analysis/call_graph/building/edges.test.ts |
| "merges graphs" | 405-449 | Building | unit/analysis/call_graph/building/merging.test.ts |
| "handles cycles" | 450-494 | Analysis | unit/analysis/call_graph/analysis/cycles.test.ts |
| "computes metrics" | 495-539 | Analysis | unit/analysis/call_graph/analysis/metrics.test.ts |
| (remaining cases) | 540-890 | Various | (mapped similarly) |

### 2. LANGUAGE-SPECIFIC TEST MAPPING

#### TypeScript Tests

| Current File | New Location | Purpose |
|--------------|--------------|---------|
| typescript.test.ts | contracts/implementations/typescript/ | Language parity tests |
| typescript_specific.test.ts | unit/analysis/typescript/ | TypeScript-only features |
| decorators.test.ts | unit/analysis/typescript/decorators/ | Decorator tests |
| namespaces.test.ts | unit/analysis/typescript/namespaces/ | Namespace tests |
| enums.test.ts | unit/analysis/typescript/enums/ | Enum tests |
| interfaces.test.ts | unit/analysis/typescript/interfaces/ | Interface tests |

#### Python Tests

| Current File | New Location | Purpose |
|--------------|--------------|---------|
| python.test.ts | contracts/implementations/python/ | Language parity tests |
| python_specific.test.ts | unit/analysis/python/ | Python-only features |
| python_imports.test.ts | unit/analysis/imports/python/ | Python import tests |
| python_classes.test.ts | unit/analysis/python/classes/ | Python class tests |
| python_async.test.ts | unit/analysis/python/async/ | Python async tests |

#### Rust Tests

| Current File | New Location | Purpose |
|--------------|--------------|---------|
| rust.test.ts | contracts/implementations/rust/ | Language parity tests |
| rust_specific.test.ts | unit/analysis/rust/ | Rust-only features |
| rust_traits.test.ts | unit/analysis/rust/traits/ | Trait tests |
| rust_lifetimes.test.ts | unit/analysis/rust/lifetimes/ | Lifetime tests |
| rust_macros.test.ts | unit/analysis/rust/macros/ | Macro tests |

### 3. TEST CONTRACT IMPLEMENTATION

#### Call Detection Contract

```typescript
// tests/contracts/call_detection_contract.ts
export interface CallDetectionContract {
  describe("Call Detection", () => {
    it("detects simple function calls");
    it("detects method calls");
    it("detects constructor calls");
    it("detects nested calls");
    it("detects chained calls");
    it("handles call arguments");
    it("handles spread arguments");
  });
}
```

**Implementations Required**:
- tests/contracts/implementations/javascript/call_detection.test.ts
- tests/contracts/implementations/typescript/call_detection.test.ts
- tests/contracts/implementations/python/call_detection.test.ts
- tests/contracts/implementations/rust/call_detection.test.ts

#### Import Detection Contract

```typescript
// tests/contracts/import_detection_contract.ts
export interface ImportDetectionContract {
  describe("Import Detection", () => {
    it("detects named imports");
    it("detects default imports");
    it("detects namespace imports");
    it("detects aliased imports");
    it("resolves import paths");
    it("handles re-exports");
  });
}
```

**Implementations Required**:
- tests/contracts/implementations/javascript/import_detection.test.ts (ES6)
- tests/contracts/implementations/javascript/commonjs_detection.test.ts
- tests/contracts/implementations/python/import_detection.test.ts
- tests/contracts/implementations/rust/import_detection.test.ts

#### Scope Resolution Contract

```typescript
// tests/contracts/scope_resolution_contract.ts
export interface ScopeResolutionContract {
  describe("Scope Resolution", () => {
    it("builds scope tree");
    it("resolves local variables");
    it("resolves parameters");
    it("handles nested scopes");
    it("handles scope shadowing");
    it("resolves to correct scope");
  });
}
```

### 4. INTEGRATION TEST MAPPING

| Current File | Lines | New Location | Purpose |
|--------------|-------|--------------|---------|
| cross_file_all_languages.test.ts | 650 | integration/cross_file/ | Cross-file resolution |
| incremental.test.ts | 120 | integration/incremental/ | Incremental updates |
| project.test.ts | 179 | integration/project/ | Project-level tests |
| import_export_comprehensive.test.ts | 720 | integration/imports/ | Import/export integration |
| call_graph_method_resolution.test.ts | 687 | integration/call_graph/ | Method resolution integration |

### 5. UNIT TEST MAPPING

#### Scope Resolution Tests

| Current Location | New Location |
|-----------------|--------------|
| Embedded in edge_cases.test.ts | unit/analysis/scope/builder/ |
| | unit/analysis/scope/resolver/ |
| | unit/analysis/scope/queries/ |

#### Type Tracking Tests

| Current File | New Location |
|--------------|--------------|
| type_tracker.test.ts | unit/analysis/types/tracking/ |
| return_type_analyzer.test.ts | unit/analysis/types/return/ |
| Embedded in edge_cases.test.ts | unit/analysis/types/inference/ |

#### Call Graph Tests

| Current Location | New Location |
|-----------------|--------------|
| call_graph.test.ts | unit/analysis/call_graph/detection/ |
| | unit/analysis/call_graph/resolution/ |
| | unit/analysis/call_graph/building/ |
| call_analysis.test.ts | unit/analysis/call_graph/core/ |

### 6. TEST DATA/FIXTURES MAPPING

| Current Location | New Location | Purpose |
|-----------------|--------------|---------|
| tests/fixtures/projects/ | tests/fixtures/projects/ | Sample projects |
| tests/fixtures/snippets/ | tests/fixtures/snippets/ | Code snippets |
| Embedded in test files | tests/fixtures/edge_cases/ | Edge case data |
| | tests/fixtures/language_features/ | Language-specific fixtures |

### 7. MISSING TEST COVERAGE (TO ADD)

#### Currently Untested Functions

| Function | Location | New Test Location |
|----------|----------|-------------------|
| InheritanceService (all 6 functions) | src/project/inheritance_service.ts | unit/analysis/inheritance/ |
| find_definition() | src/project/project.ts | unit/project/operations/query_operations.test.ts |
| get_references() | src/project/project.ts | unit/project/operations/query_operations.test.ts |
| Scope query functions | src/scope_resolution.ts | unit/analysis/scope/queries/ |
| Resolution utilities | src/call_graph/reference_resolution.ts | unit/analysis/call_graph/resolution/utils/ |

### 8. TEST MIGRATION STRATEGY

#### Phase 1: Create Test Contracts
1. Define contracts for universal features
2. Create contract test suite
3. Validate all languages implement contracts

#### Phase 2: Split Monolithic Tests
1. Extract test cases by feature
2. Create new test files in correct locations
3. Verify tests still pass

#### Phase 3: Reorganize by Feature
1. Move unit tests to unit/ directory
2. Move integration tests to integration/
3. Update imports and paths

#### Phase 4: Add Missing Coverage
1. Write tests for untested functions
2. Add contract implementations
3. Achieve 90%+ coverage

## Summary

### Test File Statistics
- **Current**: 124 test files (many monolithic)
- **Target**: ~300 test files (focused, organized)
- **New Contract Tests**: 15 contracts × 4 languages = 60 files
- **Missing Coverage to Add**: ~25 new test files

### Organization Benefits
- Clear feature boundaries
- Enforced language parity
- Easier to find relevant tests
- Better test isolation
- Clearer test purpose

### Migration Complexity
- **High**: Splitting monolithic files
- **Medium**: Reorganizing imports
- **Low**: Moving fixtures
- **Critical**: Maintaining coverage during migration