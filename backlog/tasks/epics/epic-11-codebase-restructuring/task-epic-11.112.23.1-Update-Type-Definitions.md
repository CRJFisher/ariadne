# Task epic-11.112.23.1: Update Type Definitions for is_exported

**Parent:** task-epic-11.112.23
**Status:** Not Started
**Estimated Time:** 1 hour

## Objective

Update the core type definitions in `@ariadnejs/types` to replace `SymbolAvailability` with a simple `is_exported` boolean flag and move export metadata to a separate `export` object.

## Implementation Steps

### 1. Update Definition Interface (15 min)

In `packages/types/src/symbol_definitions.ts`:

```typescript
// BEFORE
export interface Definition {
  readonly kind: SymbolKind;
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly defining_scope_id: ScopeId;
  readonly location: Location;
  readonly availability: SymbolAvailability;
}

// AFTER
export interface Definition {
  readonly kind: SymbolKind;
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly defining_scope_id: ScopeId;
  readonly location: Location;
  readonly availability: SymbolAvailability; // Keep temporarily for migration
  readonly is_exported: boolean;             // NEW: Can be imported from other files?
  readonly export?: ExportMetadata;          // NEW: Export-specific metadata
}
```

### 2. Add ExportMetadata Type (15 min)

```typescript
/**
 * Export metadata for symbols that can be imported
 *
 * Examples:
 * - export { foo }           → { is_reexport: false }
 * - export { foo as bar }    → { export_name: "bar", is_reexport: false }
 * - export default foo       → { is_default: true, is_reexport: false }
 * - export { x } from './y'  → { is_reexport: true }
 */
export interface ExportMetadata {
  /** Export name if different from definition name (for aliases) */
  readonly export_name?: SymbolName;

  /** True for default exports */
  readonly is_default?: boolean;

  /** True for re-exports (export { x } from './other') */
  readonly is_reexport?: boolean;
}
```

### 3. Add Helper Type Guard (10 min)

```typescript
/**
 * Type guard to check if a definition is exported
 */
export function is_exported_definition(def: Definition): boolean {
  return def.is_exported;
}

/**
 * Type guard to check if export has an alias
 */
export function has_export_alias(def: Definition): boolean {
  return def.export?.export_name !== undefined;
}

/**
 * Get the effective export name (alias or original name)
 */
export function get_export_name(def: Definition): SymbolName {
  return def.export?.export_name || def.name;
}
```

### 4. Update All Definition Types (20 min)

Ensure all specific definition types inherit the new fields:
- `FunctionDefinition`
- `ClassDefinition`
- `VariableDefinition`
- `InterfaceDefinition`
- `EnumDefinition`
- `TypeAliasDefinition`
- `ImportDefinition`

No changes needed - they all extend `Definition` base interface.

## Files Modified

- `packages/types/src/symbol_definitions.ts`

## Testing

Run type checks:
```bash
cd packages/types && npm run build
```

## Success Criteria

- ✅ `Definition` interface has `is_exported: boolean` field
- ✅ `ExportMetadata` interface defined with all necessary fields
- ✅ Helper functions created for common export checks
- ✅ Type compilation succeeds
- ✅ `availability` field kept temporarily for backward compatibility

## Next Task

**task-epic-11.112.23.2** - JavaScript/TypeScript Implementation
