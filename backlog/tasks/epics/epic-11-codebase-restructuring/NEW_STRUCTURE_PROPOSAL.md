# Ariadne New Structure Proposal

## Executive Summary

- **Current state**: 89 files in 12 directories with mixed concerns
- **Target state**: 235 files in 45+ directories with clear boundaries
- **Migration scope**: All 487 exported functions/classes + 26 missing functions
- **Estimated effort**: 10 weeks (400 hours)
- **New modules added**: Performance monitoring, error handling, dev tools, CLI, configuration

## Target Architecture

### Complete Directory Structure

```
src/
├── core/                           # Foundation layer (no dependencies)
│   ├── types/                     # Core type definitions
│   │   ├── ast.ts
│   │   ├── graph.ts
│   │   ├── language.ts
│   │   └── index.ts
│   ├── constants/                  # System constants
│   │   ├── limits.ts (MAX_FILE_SIZE = 30KB)
│   │   └── patterns.ts
│   ├── errors/                     # Error types and handling (EXPANDED)
│   │   ├── parsing_error.ts
│   │   ├── resolution_error.ts
│   │   ├── validation_error.ts
│   │   ├── error_handler.ts       # Centralized error handling (NEW)
│   │   ├── error_reporter.ts      # Error reporting (NEW)
│   │   ├── error_recovery.ts      # Recovery strategies (NEW)
│   │   ├── error_aggregator.ts    # Error aggregation (NEW)
│   │   ├── error_formatter.ts     # Error formatting (NEW)
│   │   └── error_codes.ts         # Standard error codes (NEW)
│   └── config/                     # Configuration management (NEW)
│       ├── config_loader.ts
│       ├── config_validator.ts
│       └── config_merger.ts
│
├── storage/                        # Storage layer (depends on core)
│   ├── contracts/                  # Storage interfaces
│   │   ├── storage_interface.ts
│   │   └── storage_sync_interface.ts
│   ├── implementations/            # Storage providers
│   │   ├── in_memory/
│   │   │   ├── in_memory_storage.ts (<500 lines)
│   │   │   └── in_memory_storage.test.ts
│   │   └── disk/ (example)
│   │       └── disk_storage.ts
│   └── index.ts
│
├── languages/                      # Language definitions (depends on core)
│   ├── contracts/
│   │   ├── language_config.ts
│   │   └── feature_support.ts
│   ├── javascript/
│   │   ├── config.ts
│   │   ├── queries/
│   │   │   ├── scopes.scm
│   │   │   └── locals.scm
│   │   └── patterns.ts
│   ├── typescript/
│   │   ├── config.ts
│   │   ├── queries/
│   │   └── patterns.ts
│   ├── python/
│   │   ├── config.ts
│   │   ├── queries/
│   │   └── patterns.ts
│   ├── rust/
│   │   ├── config.ts
│   │   ├── queries/
│   │   └── patterns.ts
│   └── index.ts
│
├── parsing/                        # AST parsing layer
│   ├── parser/
│   │   ├── tree_sitter_parser.ts
│   │   └── parser_cache.ts
│   ├── ast_utils/
│   │   ├── node_visitor.ts
│   │   ├── node_finder.ts
│   │   └── text_extractor.ts
│   └── index.ts
│
├── analysis/                       # Analysis layer (main features)
│   ├── scope/                     # Scope resolution (from scope_resolution.ts)
│   │   ├── builder/
│   │   │   ├── scope_builder.ts (<500 lines)
│   │   │   ├── scope_tree_builder.ts (<500 lines)
│   │   │   ├── node_visitor.ts
│   │   │   └── scope_factory.ts
│   │   ├── resolver/
│   │   │   ├── scope_resolver.ts (<500 lines)
│   │   │   ├── reference_finder.ts
│   │   │   ├── chain_walker.ts
│   │   │   └── binding_resolver.ts
│   │   ├── models/
│   │   │   ├── scope.ts
│   │   │   ├── scope_graph.ts (immutable)
│   │   │   └── scope_node.ts
│   │   ├── contracts/
│   │   │   └── scope_test_contract.ts
│   │   └── index.ts
│   │
│   ├── imports/                   # Import/Export analysis
│   │   ├── detection/
│   │   │   ├── es6/
│   │   │   │   ├── import_detector.ts
│   │   │   │   ├── export_detector.ts
│   │   │   │   └── es6_patterns.ts
│   │   │   ├── commonjs/
│   │   │   │   ├── require_detector.ts
│   │   │   │   ├── module_exports_detector.ts
│   │   │   │   └── commonjs_patterns.ts
│   │   │   └── language_specific/
│   │   │       ├── python_imports.ts
│   │   │       └── rust_imports.ts
│   │   ├── resolution/
│   │   │   ├── module_resolver.ts
│   │   │   ├── path_resolver.ts
│   │   │   └── import_cache.ts
│   │   ├── contracts/
│   │   │   └── import_test_contract.ts
│   │   └── index.ts
│   │
│   ├── call_graph/                # Call graph analysis
│   │   ├── detection/
│   │   │   ├── function_calls/
│   │   │   │   ├── function_call_detector.ts
│   │   │   │   ├── function_call_detector.javascript.ts
│   │   │   │   ├── function_call_detector.python.ts
│   │   │   │   ├── function_call_detector.rust.ts
│   │   │   │   └── function_call_detector.test.ts
│   │   │   ├── method_calls/
│   │   │   │   ├── method_call_detector.ts
│   │   │   │   └── (language implementations)
│   │   │   └── constructor_calls/
│   │   │       ├── constructor_detector.ts
│   │   │       └── (language implementations)
│   │   ├── resolution/
│   │   │   ├── reference/
│   │   │   │   ├── variable_resolver.ts (<500 lines)
│   │   │   │   ├── import_resolver.ts (<500 lines)
│   │   │   │   ├── property_resolver.ts (<500 lines)
│   │   │   │   └── parameter_resolver.ts
│   │   │   ├── method/
│   │   │   │   ├── method_resolver.ts
│   │   │   │   ├── inheritance_resolver.ts
│   │   │   │   └── override_resolver.ts
│   │   │   └── type/
│   │   │       ├── type_resolver.ts
│   │   │       └── generic_resolver.ts
│   │   ├── building/
│   │   │   ├── graph_builder.ts (<500 lines)
│   │   │   ├── edge_creator.ts
│   │   │   ├── node_creator.ts
│   │   │   └── graph_merger.ts
│   │   ├── models/
│   │   │   ├── call_graph.ts
│   │   │   ├── call_edge.ts
│   │   │   └── call_node.ts
│   │   ├── contracts/
│   │   │   ├── call_detection_contract.ts
│   │   │   └── resolution_contract.ts
│   │   └── index.ts
│   │
│   ├── types/                     # Type system
│   │   ├── tracking/
│   │   │   ├── variable_types/
│   │   │   │   ├── variable_tracker.ts
│   │   │   │   ├── reassignment_handler.ts
│   │   │   │   └── scope_types.ts
│   │   │   ├── return_types/
│   │   │   │   ├── return_tracker.ts
│   │   │   │   └── return_inference.ts
│   │   │   └── parameter_types/
│   │   │       ├── parameter_tracker.ts
│   │   │       └── parameter_inference.ts
│   │   ├── inference/
│   │   │   ├── basic/
│   │   │   │   ├── literal_inference.ts
│   │   │   │   └── simple_inference.ts
│   │   │   └── advanced/
│   │   │       ├── generic_inference.ts
│   │   │       ├── union_types.ts
│   │   │       └── intersection_types.ts
│   │   ├── models/
│   │   │   ├── type_info.ts
│   │   │   └── type_registry.ts
│   │   ├── contracts/
│   │   │   └── type_tracking_contract.ts
│   │   └── index.ts
│   │
│   └── inheritance/               # Inheritance analysis
│       ├── class_hierarchy.ts
│       ├── method_override.ts
│       ├── contracts/
│       └── index.ts
│
├── project/                       # Project management (refactored)
│   ├── state/
│   │   ├── project_state.ts (immutable)
│   │   ├── file_state.ts
│   │   └── state_transitions.ts
│   ├── operations/
│   │   ├── file_operations.ts (pure functions)
│   │   ├── analysis_operations.ts
│   │   └── query_operations.ts
│   ├── services/
│   │   ├── file_service.ts
│   │   ├── language_service.ts
│   │   └── cache_service.ts
│   ├── api/
│   │   ├── project.ts (compatibility wrapper)
│   │   └── project_builder.ts
│   └── index.ts
│
├── utils/                         # Utilities (pure functions only)
│   ├── ast/
│   │   ├── query_executor.ts
│   │   ├── node_matcher.ts
│   │   └── range_utils.ts
│   ├── source/
│   │   ├── source_extractor.ts
│   │   └── line_mapper.ts
│   ├── path/
│   │   ├── path_normalizer.ts
│   │   └── module_locator.ts
│   ├── performance/               # Performance monitoring (NEW)
│   │   ├── profiler.ts
│   │   ├── benchmark.ts
│   │   ├── memory_tracker.ts
│   │   ├── performance_metrics.ts
│   │   ├── timing_utils.ts
│   │   ├── resource_monitor.ts
│   │   ├── performance_cache.ts
│   │   └── performance_reporter.ts
│   ├── logging/                   # Logging infrastructure (NEW)
│   │   ├── logger.ts
│   │   ├── log_formatter.ts
│   │   └── log_writer.ts
│   └── index.ts
│
├── dev_tools/                     # Developer tools (NEW)
│   ├── debugger.ts
│   ├── inspector.ts
│   ├── repl.ts
│   ├── trace_logger.ts
│   └── diagnostic_reporter.ts
│
├── cli/                           # CLI interface (NEW)
│   ├── command_parser.ts
│   ├── command_executor.ts
│   └── output_formatter.ts
│
└── index.ts                       # Public API (< 1KB, exports only)
```

### Test Structure

```
tests/
├── unit/                          # Unit tests (mirrors src structure)
│   ├── core/
│   ├── storage/
│   ├── analysis/
│   └── utils/
│
├── integration/                   # Integration tests
│   ├── features/                 # Feature-level tests
│   │   ├── call_graph/
│   │   ├── imports/
│   │   └── types/
│   └── languages/                # Language-specific integration
│       ├── javascript/
│       ├── typescript/
│       ├── python/
│       └── rust/
│
├── contracts/                     # Test contract implementations
│   ├── call_detection/
│   │   ├── call_detection.javascript.test.ts
│   │   ├── call_detection.python.test.ts
│   │   └── call_detection.rust.test.ts
│   └── (other contracts)
│
├── fixtures/                      # Test data
│   ├── projects/
│   ├── snippets/
│   └── edge_cases/
│
├── benchmarks/                    # Performance tests
│   ├── parsing/
│   ├── analysis/
│   └── memory/
│
└── utils/                         # Test utilities
    ├── test_factory.ts
    ├── assertion_helpers.ts
    └── mock_builders.ts
```

## Migration Mappings

### File Relocations

| Current Location | New Location | Size | Refactoring Required |
|------------------|--------------|------|----------------------|
| src/scope_resolution.ts | src/analysis/scope/ (8 files) | 22.3KB → 8×3KB | Split 457-line function |
| src/call_graph/reference_resolution.ts | src/analysis/call_graph/resolution/reference/ (4 files) | 28.9KB → 4×7KB | Extract strategies |
| src/call_graph/import_export_detector.ts | src/analysis/imports/detection/ (6 files) | 27.4KB → 6×5KB | Split by import type |
| src/project/project.ts | src/project/ (6 files) | 612 lines → 6×100 | Convert to functional |
| src/call_graph/graph_builder.ts | src/analysis/call_graph/building/ (4 files) | 21.8KB → 4×5KB | Split phases |
| src/call_graph/type_tracker.ts | src/analysis/types/tracking/ (4 files) | 20.4KB → 4×5KB | Separate concerns |
| src/index.ts | src/index.ts + feature indexes | 41KB → <1KB | Export only |
| tests/edge_cases.test.ts | tests/fixtures/edge_cases/ (8 files) | 31.3KB → 8×4KB | Split by category |

### Function Redistributions

#### Scope Resolution Functions

| Function | Current Location | New Location | Changes |
|----------|-----------------|--------------|---------|
| build_scope_graph() | scope_resolution.ts:45 | scope/builder/scope_builder.ts | Split into 6 functions |
| resolve_reference() | scope_resolution.ts:502 | scope/resolver/reference_finder.ts | Pure function |
| find_in_scope() | scope_resolution.ts:623 | scope/resolver/scope_resolver.ts | Remove mutations |
| get_enclosing_scope() | scope_resolution.ts:745 | scope/resolver/chain_walker.ts | Simplify |

#### Call Graph Functions

| Function | Current Location | New Location | Changes |
|----------|-----------------|--------------|---------|
| analyze_calls() | call_analysis/core.ts:45 | call_graph/detection/function_calls/ | Language-specific split |
| resolve_reference() | reference_resolution.ts:67 | call_graph/resolution/reference/ | Strategy pattern |
| build_graph() | graph_builder.ts:256 | call_graph/building/graph_builder.ts | Two-phase approach |
| detect_imports() | import_export_detector.ts:89 | imports/detection/es6/ | Type-specific modules |

#### Project Functions

| Function | Current Location | New Location | Changes |
|----------|-----------------|--------------|---------|
| add_file() | project.ts:168 | project/operations/file_operations.ts | Pure function |
| get_call_graph() | project.ts:290 | project/operations/analysis_operations.ts | Immutable |
| update_file() | project.ts:195 | project/operations/file_operations.ts | Return new state |

## Implementation Phases

### Phase 0: Prerequisites (Week 1)
1. Create new directory structure
2. Set up build configuration
3. Create compatibility layer
4. Set up test infrastructure

### Phase 1: Foundation (Week 2)
**No dependencies - can parallelize**

1. Core types and constants
2. Storage system
3. Language configurations
4. Utilities

**Files to migrate:**
- src/storage/* → src/storage/ (no change needed)
- src/languages/* → src/languages/ (reorganize)
- Create src/core/types/
- Create src/utils/

### Phase 2: Parsing Layer (Week 3)
**Depends on Phase 1**

1. Tree-sitter wrapper
2. AST utilities
3. Query execution

**Files to migrate:**
- Extract from various files
- Create src/parsing/

### Phase 3: Scope Analysis (Week 4)
**Depends on Phase 2**

1. Split scope_resolution.ts
2. Create immutable scope graph
3. Implement scope builder
4. Implement resolver

**Critical refactoring:**
- 457-line function → 6 functions
- Stateful class → immutable functions

### Phase 4: Import/Export (Week 5)
**Depends on Phase 3**

1. Split import_export_detector.ts
2. Separate ES6 from CommonJS
3. Language-specific modules

**Files to migrate:**
- src/call_graph/import_export_detector.ts
- src/module_resolver.ts
- src/project/import_resolver.ts

### Phase 5: Type System (Week 6)
**Depends on Phase 3**

1. Extract from call_graph
2. Create tracking system
3. Implement inference

**Files to migrate:**
- src/call_graph/type_tracker.ts
- src/call_graph/return_type_analyzer.ts

### Phase 6: Call Graph Core (Week 7-8)
**Depends on Phases 4 & 5**

1. Detection modules
2. Resolution strategies
3. Graph building

**Files to migrate:**
- src/call_graph/call_analysis/*
- src/call_graph/graph_builder.ts
- src/call_graph/project_graph_data.ts

### Phase 7: Project Refactoring (Week 9)
**Depends on Phase 6**

1. Create immutable state
2. Pure operations
3. Compatibility wrapper

**Critical refactoring:**
- Stateful Project class → Functional core

### Phase 8: Cleanup (Week 10)
1. Remove old files
2. Update imports
3. Fix tests
4. Update documentation

## Migration Complexity Assessment

### Low Complexity (1-2 hours each)
Total: 45 tasks × 1.5 hours = 67.5 hours

- Type definitions moves
- Constant extractions
- Utility reorganization
- Simple file splits

### Medium Complexity (4-8 hours each)
Total: 25 tasks × 6 hours = 150 hours

- Import/export splitting
- Test reorganization
- Module extraction
- Function purification

### High Complexity (1-3 days each)
Total: 12 tasks × 16 hours = 192 hours

- Scope resolution refactor
- Project class conversion
- Reference resolution split
- Graph builder refactor

### Critical Path Items
Must complete in order:
1. Scope resolution (everything depends on it)
2. Import resolution (needed for references)
3. Type tracking (needed for call graph)
4. Call graph (needed for project)
5. Project refactor (public API)

## Risk Analysis

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Performance regression | High | Medium | Benchmark critical paths |
| Circular dependencies | Medium | High | Dependency analysis first |
| Test breakage | High | Low | Parallel test suites |
| API breaking changes | High | High | Compatibility layer |

### Process Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Scope creep | High | High | Strict phase boundaries |
| Merge conflicts | Medium | Medium | Feature branches |
| Knowledge gaps | Low | Medium | Document as we go |

## Success Metrics

### Quantitative Metrics
- ✅ All files < 30KB (hard limit)
- ✅ 90% files < 10KB (target)
- ✅ Zero stateful classes
- ✅ All functions < 50 lines
- ✅ Cyclomatic complexity < 10
- ✅ 100% test pass rate
- ✅ < 10% performance regression

### Qualitative Metrics
- ✅ Clear module boundaries
- ✅ Consistent patterns
- ✅ Discoverable structure
- ✅ Maintainable tests
- ✅ Complete documentation

## Rollback Strategy

### Phase-Level Rollback
Each phase creates parallel structure:
1. Old code remains untouched
2. New code in new locations
3. Facade pattern for compatibility
4. Can revert by switching imports

### File-Level Rollback
Git tags at each migration:
```bash
git tag pre-phase-1
git tag post-phase-1-file-1
# etc.
```

## Future Phases (Post-Migration)

### Phase 9: Control Flow Analysis (2 weeks - DEFERRED)
**To be implemented after core restructuring**

```
src/analysis/control_flow/
├── graph/
│   ├── cfg_builder.ts
│   ├── basic_block.ts
│   └── control_edge.ts
├── analysis/
│   ├── branch_analyzer.ts
│   ├── loop_detector.ts
│   └── dead_code_finder.ts
└── conditions/
    ├── condition_tracker.ts
    └── path_analyzer.ts
```

### Phase 10: Data Flow Analysis (2 weeks - DEFERRED)
**To be implemented after control flow**

```
src/analysis/data_flow/
├── graph/
│   ├── dfg_builder.ts
│   ├── data_node.ts
│   └── data_edge.ts
├── tracking/
│   ├── value_propagator.ts
│   ├── taint_analyzer.ts
│   └── dependency_tracker.ts
└── optimization/
    ├── unused_detector.ts
    └── ssa_converter.ts
```

## Next Steps

1. Review and approve this proposal (including deferred phases)
2. Create detailed migration scripts
3. Set up parallel structure
4. Begin Phase 0 setup
5. Start Phase 1 migration
6. Create separate tasks for Phase 9-10 in backlog

## Appendix: Naming Conventions

### File Naming
- All files: snake_case.ts
- Test files: [feature].test.ts
- Contract files: [feature]_contract.ts
- Language-specific: [feature].[language].ts

### Directory Naming
- All directories: snake_case
- Feature directories: singular (e.g., call_graph, not call_graphs)
- Grouping directories: plural (e.g., types, utils)

### Function Naming
- All functions: snake_case
- Pure functions: verb_noun (e.g., parse_file)
- Predicates: is_[condition] (e.g., is_valid_node)
- Getters: get_[property] (e.g., get_scope)

### Type Naming
- Interfaces/Types: PascalCase
- Enums: PascalCase
- Constants: UPPER_SNAKE_CASE