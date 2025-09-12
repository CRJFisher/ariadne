# Function Migrations for Epic 11 Module Transformations

This document lists functions that need to be migrated from `file_analyzer.ts` and `code_graph.ts` to their respective modules as part of the Epic 11 transformation to tree-sitter queries.

## From file_analyzer.ts

### Task 11.100.10 - transform-return-type-inference
- **Function**: `infer_all_return_types` (lines 85-157)
- **Target**: `src/type_analysis/return_type_inference/return_type_inference.ts`
- **Purpose**: Traverses AST to find all functions and infer their return types
- **Action**: Move and convert to query-based implementation

### Task 11.100.11 - transform-parameter-type-inference
- **Function**: `infer_all_parameter_types` (lines 159-228)
- **Target**: `src/type_analysis/parameter_type_inference/parameter_type_inference.ts`
- **Purpose**: Traverses AST to find all functions and infer parameter types
- **Action**: Move and convert to query-based implementation

### Task 11.100.1 - transform-scope-tree
- **Function**: `extract_variables_from_scopes` (lines 512-545)
- **Target**: `src/scope_analysis/scope_tree/scope_tree.ts`
- **Purpose**: Extracts variable declarations from scope tree
- **Action**: Move as helper function, integrate with query-based scope analysis

### Task 11.100.9 - transform-symbol-resolution
- **Function**: `build_symbol_registry` (lines 639-664)
- **Target**: `src/scope_analysis/symbol_resolution/symbol_resolution.ts`
- **Purpose**: Builds symbol registry from functions and classes
- **Action**: Move and convert to query-based symbol extraction

## From code_graph.ts

### Task 11.100.16 - transform-namespace-resolution
- **Function**: `resolve_namespaces_across_files` (lines 138-219)
- **Target**: `src/import_export/namespace_resolution/namespace_resolution.ts`
- **Purpose**: Resolves namespace imports and members across files
- **Action**: Move as main exported function, convert to queries

- **Function**: `collect_namespace_exports` (lines 265-300)
- **Target**: `src/import_export/namespace_resolution/namespace_resolution.ts`
- **Purpose**: Collects exports for namespace resolution
- **Action**: Move as helper function

### Task 11.100.2 - transform-import-resolution
- **Function**: `resolve_module_path` (lines 222-242)
- **Target**: `src/import_export/import_resolution/import_resolution.ts`
- **Purpose**: Resolves module paths for imports
- **Action**: Move as helper function

- **Function**: `normalizeModulePath` (lines 245-262)
- **Target**: `src/import_export/import_resolution/import_resolution.ts`
- **Purpose**: Normalizes module paths (removes extensions, resolves dots)
- **Action**: Move as helper function

### Task 11.100.18 - transform-call-chain-analysis (or new module)
- **Function**: `build_call_graph` (lines 558-700)
- **Target**: `src/call_graph/call_chain_analysis/call_chain_analysis.ts` or new module
- **Purpose**: Builds complete call graph from analyses
- **Action**: Consider creating new module or integrating with call chain analysis

### Task 11.100.7 - transform-type-tracking (or new type_registry module)
- **Function**: `build_type_index` (lines 705-765)
- **Target**: `src/type_analysis/type_tracking/type_tracking.ts` or new type_registry module
- **Purpose**: Builds type index from file analyses
- **Action**: Evaluate best location, possibly new type_registry module

### Task 11.100.9 - transform-symbol-resolution
- **Function**: `build_symbol_index` (lines 770-834)
- **Target**: `src/scope_analysis/symbol_resolution/symbol_resolution.ts`
- **Purpose**: Builds symbol index from analyses and global symbol table
- **Action**: Move and integrate with query-based symbol resolution

### Task 11.100.15 - transform-interface-implementation
- **Function**: `track_interface_implementations` (lines 842-863)
- **Target**: `src/inheritance/interface_implementation/interface_implementation.ts`
- **Purpose**: Tracks and validates interface implementations
- **Action**: Move and convert to query-based interface detection

### Task 11.100.13 - transform-method-override
- **Function**: `detect_and_validate_method_overrides` (lines 871-922)
- **Target**: `src/inheritance/method_override/method_override.ts`
- **Purpose**: Detects and validates method override relationships
- **Action**: Move and convert to query-based override detection

### Task 11.100.12 - transform-class-hierarchy
- **Function**: `build_class_hierarchy_from_analyses` (lines 930-980)
- **Target**: `src/inheritance/class_hierarchy/class_hierarchy.ts`
- **Purpose**: Builds class hierarchy from all file analyses
- **Action**: Move and convert to query-based hierarchy building

## Implementation Notes

1. **Order of Migration**: Start with leaf functions (those with no dependencies on other migrating functions)
2. **Testing**: Each migrated function should have tests comparing output with original implementation
3. **Performance**: Benchmark query-based vs manual implementations
4. **Compatibility**: Maintain backward compatibility during transition period
5. **Documentation**: Update module documentation to reflect new exported functions

## Validation Checklist

For each function migration:
- [ ] Function moved to target module
- [ ] Tests comparing old vs new implementation
- [ ] Performance benchmarks recorded
- [ ] Documentation updated
- [ ] Integration tests pass
- [ ] No regressions in dependent code