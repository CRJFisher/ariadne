# Task epic-11.112.23: Replace SymbolAvailability with is_exported Flag

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 4-6 hours (split across 4 sub-tasks)
**Dependencies:** task-epic-11.112.22

## Objective

Replace the complex `SymbolAvailability` object with a simple `is_exported: boolean` flag on definitions. Analysis shows that lexical scope resolution already works via `defining_scope_id` and parent scope relationships. The only actual usage of availability is to check if a symbol can be imported from another file.

Move export metadata (aliases, default exports, re-exports) to a separate `export` object directly on `Definition`.

## Problem Analysis

### Current System
```typescript
interface SymbolAvailability {
  scope: "file-private" | "file-export" | "package-internal" | "public";
  export?: {
    name: SymbolName;
    is_default?: boolean;
    is_reexport?: boolean;
  };
}
```

### Issues
1. **Over-engineered**: The `scope` field has 4 values but only one check: "is it exported?"
2. **Unused for same-file resolution**: Same-file symbol resolution uses scope tree walking, not availability
3. **Only used for imports**: The only non-test usage is `import_resolver.ts:is_exported()`

### New System
```typescript
interface Definition {
  readonly is_exported: boolean;  // Can be imported from other files?
  readonly export?: {
    readonly export_name?: SymbolName;   // For: export { foo as bar }
    readonly is_default?: boolean;        // For: export default foo
    readonly is_reexport?: boolean;       // For: export { x } from './y'
  };
}
```

## Language-Specific Rules

### JavaScript/TypeScript
- `is_exported = true` if definition has `export` keyword
- Extract export metadata from export_statement AST nodes

### Python
- `is_exported = true` for all module-level definitions
- `is_exported = false` for names starting with `_` (convention)

### Rust
- `is_exported = true` if definition has `pub` modifier at module scope
- Respect Rust's module visibility rules

## Sub-Tasks

This task is split into 4 sub-tasks by language:

1. **task-epic-11.112.23.1**: Update Type Definitions
2. **task-epic-11.112.23.2**: JavaScript/TypeScript Implementation
3. **task-epic-11.112.23.3**: Python Implementation
4. **task-epic-11.112.23.4**: Rust Implementation

## Files Modified

### Core Types
- `packages/types/src/symbol_definitions.ts`

### Language Builders
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`
- `packages/core/src/index_single_file/definitions/definition_builder.ts`

### Import Resolution
- `packages/core/src/resolve_references/import_resolution/import_resolver.ts`

### Tests (update across all language test files)
- All `*.test.ts` files that reference `availability`

## Migration Strategy

1. Add `is_exported` field alongside existing `availability` field
2. Update language builders to populate `is_exported`
3. Update `import_resolver.ts:is_exported()` to check new field
4. Run all tests to ensure compatibility
5. Remove `availability` field in a follow-up task

## Success Criteria

- ✅ All definition types have `is_exported` boolean field
- ✅ Language builders correctly set `is_exported` based on language rules
- ✅ Import resolver uses `is_exported` to filter importable symbols
- ✅ All tests pass
- ✅ Export metadata moved to separate `export` object

## Next Tasks

**task-epic-11.112.24** - Implement Export Alias Resolution
**task-epic-11.112.25** - Implement Default Export Resolution
