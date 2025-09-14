# Task 11.100.0.5.28: Move Scope Queries to Module Structure

## Status
Status: Completed
Priority: High
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary

Move the existing scope query files from `scope_queries/` directory into the proper module structure as defined in Architecture.md. This establishes the first instance of the new query-based architecture pattern.

## Current Structure (Incorrect)

```
src/
├── scope_queries/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
```

## Target Structure (Per Architecture.md)

```
src/
└── scope_analysis/
    └── scope_tree/
        ├── index.ts              # Public API
        ├── scope_tree.ts         # Query execution logic (stub for now)
        └── queries/              # Query files live IN the module
            ├── javascript.scm
            ├── typescript.scm
            ├── python.scm
            └── rust.scm
```

## Implementation Steps

1. **Create queries directory in scope_tree module**
   ```bash
   mkdir -p packages/core/src/scope_analysis/scope_tree/queries
   ```

2. **Move existing scope queries**
   ```bash
   mv packages/core/src/scope_queries/*.scm \
      packages/core/src/scope_analysis/scope_tree/queries/
   ```

3. **Delete old scope_queries directory**
   ```bash
   rm -rf packages/core/src/scope_queries
   ```

4. **Update any imports/references**
   - Update paths in test files
   - Update any documentation references
   - Fix any build scripts that reference the old location

## Pattern for Other Modules

This establishes the pattern for all query-based modules:

```
module_name/
├── index.ts              # Public API exports
├── module_name.ts        # Query execution logic
└── queries/              # Language-specific queries
    ├── javascript.scm
    ├── typescript.scm
    ├── python.scm
    └── rust.scm
```

## Future Query Locations

When implementing query-based extraction for other modules:

- `call_graph/function_calls/queries/`
- `call_graph/method_calls/queries/`
- `call_graph/constructor_calls/queries/`
- `import_export/import_resolution/queries/`
- `import_export/export_detection/queries/`
- `inheritance/class_detection/queries/`
- `type_analysis/type_tracking/queries/`

## Success Criteria

- Scope queries are in `scope_analysis/scope_tree/queries/`
- Old `scope_queries/` directory is removed
- All references updated to new location
- Pattern established for future query migrations

## Dependencies

- Task 27: Must stub modules first

## Follow-up Tasks

- Task 29: Remove language-specific implementations
- Task 30: Update file_analyzer for stubs
- Future: Implement query execution in scope_tree.ts