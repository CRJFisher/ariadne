# Task 11.166: Remove Dead Exported Code

## Status: Completed

## Parent: epic-11-codebase-restructuring

## Overview

Several exported functions have zero call sites in the codebase. These are dead code and should be removed to eliminate false positive entry points and reduce maintenance burden.

## False Positive Groups Addressed

This task addresses the following false positive group from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **exported-unused-dead-code-detected-as-entry-points** (21 entries)

## Dead Code Inventory

### rust_builder_helpers.ts (9 functions)

| Function                      | Line | Action |
| ----------------------------- | ---- | ------ |
| `extract_lifetime_parameters` | 243  | DELETE |
| `extract_trait_bounds`        | 258  | DELETE |
| `is_async_function`           | 324  | DELETE |
| `is_const_function`           | 333  | DELETE |
| `is_unsafe_function`          | 342  | DELETE |
| `has_generic_parameters`      | 400  | DELETE |
| `is_mutable_parameter`        | 405  | DELETE |
| `extract_use_path`            | 569  | DELETE |
| `extract_use_alias`           | 623  | DELETE |
| `is_wildcard_import`          | 670  | DELETE |

### typescript_builder.ts (2 functions)

| Function             | Line | Action |
| -------------------- | ---- | ------ |
| `is_optional_member` | 281  | DELETE |
| `is_abstract_class`  | 295  | DELETE |

### query_loader.ts (1 function)

| Function    | Line | Action |
| ----------- | ---- | ------ |
| `has_query` | 211  | DELETE |

### validate_captures.ts (1 function)

| Function             | Line | Action |
| -------------------- | ---- | ------ |
| `format_all_results` | 393  | DELETE |

### semantic_index.ts (1 function)

| Function                           | Line | Action |
| ---------------------------------- | ---- | ------ |
| `get_child_scope_with_symbol_name` | 254  | DELETE |

### test_utils.ts (1 function)

| Function                  | Line | Action |
| ------------------------- | ---- | ------ |
| `create_simple_mock_node` | 45   | DELETE |

### import_graph.ts (3 functions)

| Function                      | Line | Action |
| ----------------------------- | ---- | ------ |
| `get_dependencies`            | 156  | DELETE |
| `get_transitive_dependencies` | 180  | DELETE |
| `has_dependency`              | 260  | DELETE |

### export_registry.ts (4 functions)

| Function                 | Line | Action |
| ------------------------ | ---- | ------ |
| `exports_symbol`         | 208  | DELETE |
| `get_file_count`         | 227  | DELETE |
| `get_total_export_count` | 236  | DELETE |
| `find_exporters`         | 251  | DELETE |

### type_registry.ts (1 function)

| Function | Line | Action |
| -------- | ---- | ------ |
| `size`   | 506  | DELETE |

### definition_registry.ts (1 function)

| Function                       | Line | Action |
| ------------------------------ | ---- | ------ |
| `get_all_function_collections` | 539  | DELETE |

## Implementation Plan

### 11.166.1: Verify Dead Code Status

Before deletion, verify each function truly has no callers:

1. Grep for function name across entire codebase
2. Check for dynamic string-based invocations
3. Confirm no external package consumers

### 11.166.2: Delete Dead Functions

Remove functions in order of file:

1. `rust_builder_helpers.ts` - 9 functions
2. `typescript_builder.ts` - 2 functions
3. Other files - 10 functions

### 11.166.3: Clean Up Imports

Remove any imports of deleted functions:

1. Check all import statements
2. Remove unused imports
3. Run linter to catch remaining issues

### 11.166.4: Update Tests

Remove any tests for deleted functions (if any exist).

## Verification Steps

For each function, before deletion:

```bash
# Check for direct usage
grep -r "function_name(" packages/

# Check for string-based references
grep -r "\"function_name\"" packages/
grep -r "'function_name'" packages/

# Check for exports
grep -r "export.*function_name" packages/
```

## Files to Modify

1. `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts`
2. `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`
3. `packages/core/src/index_single_file/query_code_tree/query_loader.ts`
4. `packages/core/src/index_single_file/query_code_tree/validate_captures.ts`
5. `packages/core/src/index_single_file/semantic_index.ts`
6. `packages/core/src/index_single_file/test_utils.ts`
7. `packages/core/src/project/import_graph.ts`
8. `packages/core/src/resolve_references/registries/export_registry.ts`
9. `packages/core/src/resolve_references/registries/type_registry.ts`
10. `packages/core/src/resolve_references/registries/definition_registry.ts`

## Success Criteria

1. All 21 dead functions removed
2. No compilation errors
3. All tests pass
4. No runtime errors

## Dependencies

- None - standalone cleanup task

## Priority

Medium - 21 entries, straightforward deletions. Can be done independently of call graph improvements.

## Notes

Some functions might be intentionally exported for future use or external consumption. Verify with codebase maintainer before deletion if uncertain.
