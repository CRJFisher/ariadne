# Architecture Conflicts and Resolutions

## Executive Summary

This document captures conflicts between the ideal architecture (Information Architecture Plan) and the current reality (Functionality Tree + Code Style Audit), with resolution strategies for each conflict.

## Major Conflict Categories

### 1. Programming Paradigm Conflict

**Ideal**: Pure functional programming with immutable data
**Reality**: 23 stateful classes with extensive mutations
**Impact**: Core architectural violation affecting entire codebase

**Resolution Strategy:**
- Use adapter pattern for gradual migration
- Create immutable cores with stateful wrappers
- Migrate consumers incrementally
- Priority: Project, ScopeGraph, FileManager classes

### 2. File Size Conflict

**Ideal**: All files < 20KB (well under 32KB limit)
**Reality**: 5 files approaching limit, 1 at 31.3KB
**Impact**: Parser failures imminent

**Resolution Strategy:**
- Immediate splits before any other refactoring
- Create index files to maintain API compatibility
- Split by logical boundaries, not arbitrary size

### 3. Organization Conflict

**Ideal**: Feature-based organization (call_graph/function_calls/)
**Reality**: Mixed concerns (call_graph contains everything)
**Impact**: Poor discoverability, unclear boundaries

**Resolution Strategy:**
- Create new structure parallel to old
- Use facade pattern during migration
- Move feature bundles atomically

### 4. Testing Structure Conflict

**Ideal**: Test contracts with language-specific implementations
**Reality**: Monolithic test files (edge_cases.test.ts: 31.3KB)
**Impact**: Unmaintainable tests, no language parity enforcement

**Resolution Strategy:**
- Split tests by feature first, then by language
- Create test contracts as TypeScript interfaces
- Enforce implementation through tooling

### 5. Naming Convention Conflict

**Ideal**: Consistent snake_case throughout
**Reality**: Widespread camelCase (hundreds of instances)
**Impact**: API breaking changes

**Resolution Strategy:**
- Automated conversion with aliases
- Deprecation period with both names
- Codemod for consumer updates

## Detailed Conflict Analysis

### Project Management Layer

**Conflicts:**
1. Project class is stateful (critical)
2. Services tightly coupled to Project
3. File management mixed with business logic

**Current Structure:**
```
src/project/
├── project.ts (stateful, 612 lines)
├── file_manager.ts (stateful)
├── inheritance_service.ts (untested)
└── call_graph_service.ts (cached state)
```

**Target Structure:**
```
src/core/project/
├── state/
│   ├── project_state.ts (immutable)
│   └── state_transitions.ts
├── operations/
│   ├── file_operations.ts
│   └── analysis_operations.ts
├── services/
│   ├── inheritance/
│   └── call_graph/
└── index.ts (public API)
```

**Migration Challenges:**
- All 89 source files import Project
- Breaking change for all consumers
- State management paradigm shift

### Call Graph Analysis

**Conflicts:**
1. reference_resolution.ts at 28.9KB (size)
2. Mixed abstraction levels
3. Language-specific code in core

**Current Structure:**
```
src/call_graph/
├── call_analysis/ (mixed concerns)
├── import_export_detector.ts (27.4KB)
├── reference_resolution.ts (28.9KB)
└── (10 other files)
```

**Target Structure:**
```
src/analysis/call_graph/
├── detection/
│   ├── function_calls/
│   ├── method_calls/
│   └── constructor_calls/
├── resolution/
│   ├── reference/
│   ├── method/
│   └── type/
├── graph_building/
└── contracts/
```

**Migration Challenges:**
- Circular dependencies to resolve
- Performance-critical code
- Complex interdependencies

### Scope Resolution

**Conflicts:**
1. Monolithic file (22.3KB)
2. 457-line function (build_scope_graph)
3. Stateful ScopeGraph class

**Current Structure:**
```
src/scope_resolution.ts (everything in one file)
```

**Target Structure:**
```
src/analysis/scope/
├── builder/
│   ├── scope_builder.ts
│   ├── scope_tree.ts
│   └── node_visitors.ts
├── resolver/
│   ├── scope_resolver.ts
│   ├── reference_finder.ts
│   └── chain_walker.ts
├── models/
│   ├── scope.ts
│   └── scope_graph.ts
└── index.ts
```

**Migration Challenges:**
- Core functionality - everything depends on it
- Complex algorithm to split
- Performance sensitive

### Type System

**Conflicts:**
1. Incomplete implementation
2. No test contracts
3. Mixed with call graph code

**Current Structure:**
```
src/call_graph/
├── type_tracker.ts (20.4KB)
└── return_type_analyzer.ts
```

**Target Structure:**
```
src/analysis/types/
├── tracking/
│   ├── variable_types/
│   ├── return_types/
│   └── parameter_types/
├── inference/
│   ├── basic_inference/
│   └── advanced_inference/
├── contracts/
└── index.ts
```

### Import/Export System

**Conflicts:**
1. File too large (27.4KB)
2. Language mixing in core
3. No clear separation

**Current Structure:**
```
src/call_graph/import_export_detector.ts
src/project/import_resolver.ts
src/module_resolver.ts
```

**Target Structure:**
```
src/resolution/imports/
├── detection/
│   ├── es6_imports/
│   ├── commonjs_imports/
│   └── language_specific/
├── resolution/
│   ├── module_resolution/
│   └── path_resolution/
├── contracts/
└── index.ts
```

## Trade-off Decisions

### Performance vs Purity

**Conflict**: Immutable operations vs performance
**Decision**: Accept 10-15% performance hit for maintainability
**Rationale**: Can optimize critical paths later

### Migration Speed vs Safety

**Conflict**: Big bang refactor vs incremental
**Decision**: Incremental with parallel structures
**Rationale**: Cannot break production code

### Completeness vs Pragmatism

**Conflict**: Perfect architecture vs shipping
**Decision**: 80% compliance initially, iterate
**Rationale**: Perfect is enemy of good

### Backwards Compatibility vs Clean Slate

**Conflict**: Support old API vs clean break
**Decision**: Deprecation period with adapters
**Rationale**: Give consumers time to migrate

## Resolution Priority

### Critical Path (Must Resolve First)
1. File size violations - blocks everything
2. Stateful Project class - core dependency
3. Scope resolution split - fundamental service

### High Priority (Resolve Soon)
1. Call graph organization
2. Test structure
3. Type system completion

### Medium Priority (Plan For)
1. Naming conventions
2. Import/export reorganization
3. Utility consolidation

### Low Priority (Nice to Have)
1. Documentation structure
2. Example organization
3. Benchmark suite

## Risk Mitigation Strategies

### For Stateful to Functional Migration
- Create immutable core first
- Wrap in compatible API
- Migrate one consumer at a time
- Maintain both versions temporarily

### For File Splitting
- Split logical boundaries, not size
- Create barrel exports
- Update imports programmatically
- Test thoroughly after each split

### For Feature Reorganization
- Move entire features atomically
- Maintain old paths as aliases
- Update gradually
- Document new locations

## Success Criteria

### Must Achieve
- No files > 30KB
- Core classes functional
- Tests passing
- No circular dependencies

### Should Achieve
- Feature-based organization
- Test contracts in place
- < 10% performance regression
- Documentation updated

### Nice to Have
- 100% snake_case
- All files < 20KB
- Complete type inference
- Property-based tests

## Conclusion

The primary conflicts stem from the fundamental mismatch between the current object-oriented, stateful architecture and the desired functional, immutable paradigm. The resolution requires careful orchestration of incremental changes with temporary compatibility layers to avoid breaking the entire system.