# Incremental Updates Contract (Spec)

## Operations

- update_file(path, content) -> UpdateResult
- update_file_range(path, start, end, text) -> UpdateResult
- get_affected_files(path) -> string[]

## Integration Responsibilities

- Storage: persist updated source_code for path
- Scope Tree: rebuild affected scopes for path (and dependents)
- Type Tracking: recompute types for affected paths
- Module Graph: update edges for changed modules

## Language Handling

- Language resolution must be delegated to `scope_analysis/scope_tree/loader.ts` (no implicit detection here)

## Non-Goals (for this task)

- Full cross-file dependency tracking (placeholder via pass-through)
- Performance optimization/benchmarking
