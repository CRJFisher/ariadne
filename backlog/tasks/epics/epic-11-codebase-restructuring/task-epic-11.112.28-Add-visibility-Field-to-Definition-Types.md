# Task epic-11.112.28: Add visibility Field to Definition Types

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.27

## Objective

Add the `visibility` field to all definition types alongside the existing `availability` field. Both fields will coexist temporarily to allow gradual migration.

## Files

### MODIFIED
- `packages/ariadne-types/src/semantic_index.ts`

## Implementation Steps

### 1. Update FunctionDefinition (10 min)

```typescript
export interface FunctionDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;

  // Old system (will be removed later)
  availability: Availability;

  // New system
  visibility: VisibilityKind;

  parameters: ParameterDefinition[];
  return_type?: TypeReference;
}
```

### 2. Update ClassDefinition (5 min)

```typescript
export interface ClassDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;

  availability: Availability;  // Old
  visibility: VisibilityKind;  // New

  extends?: TypeReference;
  implements?: TypeReference[];
  generics?: TypeParameter[];
}
```

### 3. Update InterfaceDefinition (5 min)

```typescript
export interface InterfaceDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;

  availability: Availability;  // Old
  visibility: VisibilityKind;  // New

  extends?: TypeReference[];
  generics?: TypeParameter[];
}
```

### 4. Update EnumDefinition (5 min)

```typescript
export interface EnumDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;

  availability: Availability;  // Old
  visibility: VisibilityKind;  // New

  variants: EnumVariant[];
}
```

### 5. Update VariableDefinition (5 min)

```typescript
export interface VariableDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;

  availability: Availability;  // Old
  visibility: VisibilityKind;  // New

  type?: TypeReference;
  is_const: boolean;
}
```

### 6. Update MethodDefinition (5 min)

```typescript
export interface MethodDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;
  class_id: SymbolId;

  availability: Availability;  // Old
  visibility: VisibilityKind;  // New

  is_static: boolean;
  parameters: ParameterDefinition[];
  return_type?: TypeReference;
}
```

### 7. Update All Other Definition Types (15 min)

Apply same pattern to:
- `ParameterDefinition`
- `PropertyDefinition`
- `TypeAliasDefinition`
- Any other definition types

### 8. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: Type errors in builder configs and other code that creates definitions (missing `visibility` field).

### 9. Document Migration Strategy (5 min)

Add comment explaining temporary dual fields:

```typescript
/**
 * MIGRATION NOTE:
 *
 * Both `availability` and `visibility` fields are present during migration.
 *
 * - `availability`: Old system (definition-centric)
 * - `visibility`: New system (reference-centric)
 *
 * Migration plan:
 * 1. Add `visibility` field to all definitions (this task)
 * 2. Update builder configs to populate `visibility` (task-epic-11.112.29)
 * 3. Implement visibility checker (task-epic-11.112.30-32)
 * 4. Update symbol resolution to use visibility (task-epic-11.112.33-34)
 * 5. Remove `availability` field (task-epic-11.112.35-37)
 */
```

## Success Criteria

- ✅ All definition types have `visibility` field
- ✅ Old `availability` field still present
- ✅ Type checker identifies code that needs updates
- ✅ Migration strategy documented

## Outputs

- Updated definition types with `visibility` field

## Next Task

**task-epic-11.112.29** - Populate visibility in builder configs
