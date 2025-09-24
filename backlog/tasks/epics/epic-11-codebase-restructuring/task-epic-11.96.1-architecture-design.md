# Task Epic 11.96.1: Architecture Design Document

**Task ID**: task-epic-11.96.1
**Parent**: task-epic-11.96
**Status**: In Progress
**Created**: 2025-01-24
**Phase**: 0 - Architecture Planning and Design

## Executive Summary

This document defines the architectural design for consolidating duplicate type resolution implementations in the Ariadne codebase. The design follows a clean layered architecture pattern: `symbol_resolution → type_resolution → [specialized modules]`, with each module having focused responsibilities, clear interfaces, and comprehensive testing.

## 1. Current State Analysis

### 1.1 Existing Implementations

**Two parallel implementations exist:**

1. **`symbol_resolution.ts::phase3_resolve_types`** (87.5% feature complete)
   - Handles: type registry, inheritance, members, annotations, tracking, constructors
   - Missing: type flow analysis (placeholder only)

2. **`type_resolution.ts::resolve_all_types`** (37.5% feature complete)
   - Handles: type flow analysis (complete implementation)
   - Missing: members, tracking, proper inheritance, constructor discovery
   - Has critical bugs (e.g., passes empty Map for imports in inheritance)

### 1.2 Current Module Structure

```
symbol_resolution/
├── symbol_resolution.ts         # Main orchestrator with phase3_resolve_types
└── type_resolution/
    ├── type_resolution.ts       # Duplicate resolve_all_types (to be removed)
    ├── type_registry.ts         # Type registry management
    ├── resolve_members.ts       # Type member resolution
    ├── type_flow.ts            # Type flow analysis
    ├── resolve_annotations.ts  # Type annotation resolution
    ├── inheritance.ts          # Type inheritance resolution
    ├── track_types.ts          # Type tracking
    ├── resolve_types.ts        # Basic type resolution
    └── rust_*.ts               # Rust-specific modules (8 files)
```

## 2. Target Architecture Design

### 2.1 High-Level Architecture Pattern

```
┌─────────────────────────────┐
│   symbol_resolution.ts       │  Layer 1: Orchestration
│   (Main Pipeline Control)    │
└──────────────┬──────────────┘
               │ delegates
               ▼
┌─────────────────────────────┐
│   type_resolution/index.ts   │  Layer 2: Type Resolution
│   (Type Processing Hub)      │
└──────────────┬──────────────┘
               │ calls
               ▼
┌─────────────────────────────┐
│   Specialized Modules        │  Layer 3: Domain-Specific
│   (Focused Processing)       │
└─────────────────────────────┘
```

### 2.2 Detailed Module Structure

```
packages/core/src/symbol_resolution/
├── symbol_resolution.ts                  # Main orchestrator
├── symbol_resolution.test.ts            # Orchestrator tests
└── type_resolution/
    ├── index.ts                         # Main type resolution entry point
    ├── types.ts                         # Shared type definitions
    ├── type_resolution.test.ts         # Integration tests
    │
    ├── type_registry/
    │   ├── type_registry.ts             # Global type registry builder
    │   ├── type_registry.test.ts       # Registry tests
    │   └── index.ts                     # Exports: build_global_type_registry
    │
    ├── inheritance/
    │   ├── inheritance.ts               # Type hierarchy resolution
    │   ├── inheritance.test.ts         # Hierarchy tests
    │   └── index.ts                     # Exports: resolve_inheritance
    │
    ├── type_annotations/
    │   ├── type_annotations.ts         # Annotation processing
    │   ├── type_annotations.test.ts    # Annotation tests
    │   └── index.ts                     # Exports: resolve_type_annotations
    │
    ├── type_tracking/
    │   ├── type_tracking.ts            # Variable type tracking
    │   ├── type_tracking.test.ts       # Tracking tests
    │   └── index.ts                     # Exports: resolve_type_tracking
    │
    ├── type_flow/
    │   ├── type_flow.ts                # Type flow analysis
    │   ├── type_flow.test.ts           # Flow analysis tests
    │   └── index.ts                     # Exports: analyze_type_flow
    │
    ├── type_members/
    │   ├── type_members.ts             # Member resolution with inheritance
    │   ├── type_members.test.ts        # Member tests
    │   └── index.ts                     # Exports: resolve_type_members
    │
    └── rust_types/                      # Rust-specific consolidation
        ├── reference_types.ts           # Reference & lifetime handling
        ├── function_types.ts            # Function & closure types
        ├── async_types.ts               # Async/await handling
        ├── pattern_matching.ts          # Pattern match analysis
        ├── ownership_ops.ts             # Ownership operations
        ├── advanced_types.ts            # Generics, associated types
        ├── rust_types.test.ts          # Rust tests
        └── index.ts                     # Rust-specific exports
```

## 3. Module Interface Definitions

### 3.1 Layer 1: Symbol Resolution Orchestrator

```typescript
// symbol_resolution.ts - simplified interface
export function phase3_resolve_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap
): TypeResolutionMap {
  // Delegate to type_resolution module
  return resolve_all_types(indices, imports, functions);
}
```

### 3.2 Layer 2: Type Resolution Hub

```typescript
// type_resolution/index.ts - main entry point
export interface TypeResolutionInput {
  indices: ReadonlyMap<FilePath, SemanticIndex>;
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
  functions: FunctionResolutionMap;
}

export interface TypeResolutionOutput {
  type_registry: GlobalTypeRegistry;
  type_hierarchy: TypeHierarchyGraph;
  reference_types: Map<LocationKey, TypeId>;
  symbol_types: Map<SymbolId, TypeId>;
  type_members: Map<TypeId, Map<SymbolName, ResolvedMemberInfo>>;
  type_flow: TypeFlowAnalysis;
  rust_types?: RustTypeInfo;
}

export function resolve_all_types(
  input: TypeResolutionInput
): TypeResolutionOutput;
```

### 3.3 Layer 3: Specialized Module Interfaces

#### 3.3.1 Type Registry Module

```typescript
// type_registry/index.ts
export interface TypeRegistryInput {
  type_definitions: ReadonlyMap<FilePath, readonly LocalTypeDefinition[]>;
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

export function build_global_type_registry(
  input: TypeRegistryInput
): GlobalTypeRegistry;
```

#### 3.3.2 Inheritance Module

```typescript
// inheritance/index.ts
export interface InheritanceInput {
  type_definitions: ReadonlyMap<FilePath, readonly LocalTypeDefinition[]>;
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
  type_registry: GlobalTypeRegistry;
}

export function resolve_inheritance(
  input: InheritanceInput
): TypeHierarchyGraph;
```

#### 3.3.3 Type Annotations Module

```typescript
// type_annotations/index.ts
export interface AnnotationInput {
  annotations: ReadonlyArray<LocalTypeAnnotation>;
  type_registry: GlobalTypeRegistry;
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

export function resolve_type_annotations(
  input: AnnotationInput
): Map<LocationKey, TypeId>;
```

#### 3.3.4 Type Tracking Module

```typescript
// type_tracking/index.ts
export interface TrackingInput {
  type_tracking: ReadonlyMap<FilePath, readonly LocalTypeTracking[]>;
  type_registry: GlobalTypeRegistry;
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

export function resolve_type_tracking(
  input: TrackingInput
): Map<SymbolId, TypeId>;
```

#### 3.3.5 Type Flow Module

```typescript
// type_flow/index.ts
export interface FlowInput {
  type_flows: ReadonlyMap<FilePath, readonly LocalTypeFlowPattern[]>;
  functions: FunctionResolutionMap;
  type_registry: GlobalTypeRegistry;
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

export interface TypeFlowAnalysis {
  assignment_types: Map<LocationKey, TypeId>;
  flow_edges: FlowEdge[];
  inferred_types: Map<SymbolId, TypeId>;
}

export function analyze_type_flow(
  input: FlowInput
): TypeFlowAnalysis;
```

#### 3.3.6 Type Members Module

```typescript
// type_members/index.ts
export interface MembersInput {
  type_definitions: ReadonlyMap<FilePath, readonly LocalTypeDefinition[]>;
  type_hierarchy: TypeHierarchyGraph;
  type_registry: GlobalTypeRegistry;
}

export function resolve_type_members(
  input: MembersInput
): Map<TypeId, Map<SymbolName, ResolvedMemberInfo>>;
```

## 4. Data Flow Architecture

### 4.1 Sequential Processing Pipeline

```
Input: SemanticIndex, Imports, Functions
         │
         ▼
┌──────────────────┐
│ Data Extraction  │ → LocalTypeExtraction
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Registry    │ → GlobalTypeRegistry
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Inheritance      │ → TypeHierarchyGraph
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Annotations │ → Map<LocationKey, TypeId>
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Tracking    │ → Map<SymbolId, TypeId>
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Flow        │ → TypeFlowAnalysis
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Type Members     │ → Map<TypeId, MemberInfo>
└──────────────────┘
         │
         ▼
┌──────────────────┐
│ Consolidation    │ → TypeResolutionOutput
└──────────────────┘
```

### 4.2 Data Dependencies

```
Module              Dependencies
───────────────────────────────────────────
Type Registry    ← Type Definitions, Imports
Inheritance      ← Type Registry, Imports
Type Annotations ← Type Registry, Imports
Type Tracking    ← Type Registry, Imports
Type Flow        ← Type Registry, Functions, Imports
Type Members     ← Type Registry, Inheritance
```

### 4.3 Module Communication Rules

1. **No lateral dependencies**: Specialized modules don't call each other
2. **Upward data flow only**: Results flow up to the orchestrator
3. **Immutable inputs**: All inputs are read-only
4. **Pure functions**: No side effects in specialized modules
5. **Error propagation**: Errors bubble up through return values

## 5. Implementation Roadmap

### Phase 1: Type Flow Extraction (Day 1)
- Extract working type flow from `type_resolution.ts`
- Integrate into `symbol_resolution.ts::phase3_resolve_types`
- Create initial integration tests

### Phase 2: Testing Infrastructure (Day 2)
- Build comprehensive test utilities
- Create integration test suites
- Validate all 8 type resolution features

### Phase 3: Dead Code Removal (Day 3 Morning)
- Remove `resolve_all_types` from type_resolution.ts
- Remove unused stub functions
- Clean up imports and exports

### Phase 3: Module Restructuring (Day 3-4)
- Create new folder structure
- Extract code to specialized modules
- Implement clean module interfaces

### Phase 4: Integration Testing (Day 5)
- End-to-end validation
- Performance benchmarking
- Production readiness verification

## 6. Design Decisions and Rationale

### 6.1 Why Consolidate into symbol_resolution.ts First?

**Rationale**: The implementation in `symbol_resolution.ts` is 87.5% feature complete and production-ready. It only lacks type flow analysis, which exists in `type_resolution.ts`. By extracting just the type flow feature, we get a 100% complete implementation with minimal risk.

### 6.2 Why Create Specialized Modules?

**Benefits:**
- **Single Responsibility**: Each module has one clear purpose
- **Testability**: Focused modules are easier to test
- **Maintainability**: Changes are localized to specific domains
- **Reusability**: Modules can be used independently
- **Clarity**: Clear interfaces make the system easier to understand

### 6.3 Why Use Immutable, Pure Functions?

**Benefits:**
- **Predictability**: Same inputs always produce same outputs
- **Testability**: No hidden state to manage in tests
- **Parallelization**: Pure functions can run concurrently
- **Debugging**: Easier to trace data flow
- **Caching**: Results can be safely memoized

### 6.4 Why Separate Rust Types?

**Rationale**: Rust has unique type system features (lifetimes, ownership, traits) that don't apply to other languages. Consolidating Rust-specific logic prevents pollution of the general type resolution system.

## 7. Migration Strategy

### 7.1 Backward Compatibility

During migration, maintain backward compatibility:
1. Keep existing exports in place
2. Add deprecation warnings where appropriate
3. Provide migration guide for consumers
4. Run parallel validation tests

### 7.2 Incremental Migration Path

```
Step 1: Extract type flow → symbol_resolution.ts gets type flow
Step 2: Create test suite → Validate consolidated functionality
Step 3: Remove dead code → Clean up type_resolution.ts
Step 4: Restructure modules → Create new architecture
Step 5: Update imports → Switch to new module structure
Step 6: Deprecate old APIs → Mark old exports as deprecated
```

### 7.3 Rollback Plan

If issues arise:
1. Git branches preserve original state
2. Feature flags can disable new code paths
3. Incremental changes allow partial rollback
4. Comprehensive tests catch regressions early

## 8. Testing Strategy

### 8.1 Test Coverage Requirements

Each module must have:
- **Unit tests**: 100% coverage of public functions
- **Integration tests**: Module interaction scenarios
- **Edge cases**: Null checks, empty inputs, circular dependencies
- **Performance tests**: Benchmarks for large inputs

### 8.2 Test File Organization

```
module_name/
├── module_name.ts
├── module_name.test.ts      # Unit tests
├── fixtures/
│   ├── valid_inputs.ts      # Test data
│   ├── edge_cases.ts        # Edge case data
│   └── performance.ts       # Large datasets
└── benchmarks/
    └── module_name.bench.ts  # Performance tests
```

### 8.3 Validation Criteria

Before marking complete:
- [ ] All existing tests pass
- [ ] New integration tests pass
- [ ] Performance benchmarks meet targets
- [ ] Memory usage is optimized
- [ ] Documentation is complete

## 9. Risk Assessment and Mitigation

### 9.1 Identified Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking existing functionality | High | Low | Comprehensive test suite |
| Performance regression | Medium | Low | Benchmark before/after |
| Integration complexity | Medium | Medium | Incremental migration |
| Hidden dependencies | Medium | Low | Static analysis tools |
| Merge conflicts | Low | Medium | Feature branch strategy |

### 9.2 Mitigation Strategies

1. **Test-First Development**: Write tests before restructuring
2. **Incremental Changes**: Small, reviewable commits
3. **Continuous Integration**: Run tests on every change
4. **Code Reviews**: Peer review all changes
5. **Documentation**: Update docs with each change

## 10. Success Metrics

### 10.1 Quantitative Metrics

- **Code reduction**: ~200+ lines of dead code removed
- **Test coverage**: 100% for new modules
- **Performance**: No regression (< 5% variation)
- **Memory usage**: Reduced by eliminating duplication

### 10.2 Qualitative Metrics

- **Code clarity**: Clear module boundaries
- **Developer experience**: Easier to understand and modify
- **Maintainability**: Reduced coupling between modules
- **Extensibility**: Easy to add new type resolution features

## 11. Documentation Requirements

### 11.1 Code Documentation

Each module requires:
- Module-level JSDoc explaining purpose
- Function-level JSDoc with examples
- Inline comments for complex logic
- Type definitions with descriptions

### 11.2 Architecture Documentation

- Updated architecture diagrams
- Module interaction guides
- Migration documentation
- API reference updates

## 12. Appendix: Module Implementation Templates

### 12.1 Module Structure Template

```typescript
/**
 * [Module Name] - [Brief Description]
 *
 * This module handles [specific responsibility].
 * It receives [inputs] and produces [outputs].
 */

import type { /* types */ } from "../types";

/**
 * Main entry point for [module functionality]
 *
 * @param input - [Description of input]
 * @returns [Description of output]
 *
 * @example
 * ```typescript
 * const result = process_something({ ... });
 * ```
 */
export function process_something(
  input: ModuleInput
): ModuleOutput {
  // Implementation
}

// Internal helper functions (not exported)
function helper_function() {
  // ...
}
```

### 12.2 Test Structure Template

```typescript
import { describe, it, expect } from "vitest";
import { process_something } from "./module_name";
import { valid_input, edge_case } from "./fixtures";

describe("Module Name", () => {
  describe("process_something", () => {
    it("handles valid input", () => {
      const result = process_something(valid_input);
      expect(result).toMatchSnapshot();
    });

    it("handles edge cases", () => {
      const result = process_something(edge_case);
      expect(result).toBeDefined();
    });

    it("validates input", () => {
      expect(() => process_something(null)).toThrow();
    });
  });
});
```

### 12.3 Index File Template

```typescript
/**
 * [Module Name] Module
 *
 * Exports public API for [functionality]
 */

export {
  process_something,
  type ModuleInput,
  type ModuleOutput
} from "./module_name";

// Don't re-export internal helpers or types
```

## Conclusion

This architecture design provides a clean, maintainable, and extensible structure for consolidating the duplicate type resolution implementations. The phased approach minimizes risk while the modular design ensures long-term maintainability.

**Next Steps:**
1. Review and approve this design
2. Begin Phase 1 implementation (Type Flow Extraction)
3. Create comprehensive test suite
4. Proceed with module restructuring

---

**Document Status**: Complete
**Review Status**: Pending
**Implementation Status**: Not Started