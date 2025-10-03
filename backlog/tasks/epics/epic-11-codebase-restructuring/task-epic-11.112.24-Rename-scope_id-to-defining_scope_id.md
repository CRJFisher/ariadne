# Task epic-11.112.24: Rename scope_id to defining_scope_id

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.23

## Objective

Rename `scope_id` to `defining_scope_id` in all definition type interfaces to clarify semantic meaning. This field represents WHERE a symbol is DEFINED, not just "a scope id".

## Files

### MODIFIED
- `packages/ariadne-types/src/semantic_index.ts`

## Implementation Steps

### 1. Update Core Definition Types (20 min)

```typescript
// In semantic_index.ts

export interface FunctionDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← Renamed from scope_id
  availability: Availability;
  parameters: ParameterDefinition[];
  return_type?: TypeReference;
}

export interface ClassDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← Renamed from scope_id
  availability: Availability;
  extends?: TypeReference;
  implements?: TypeReference[];
  generics?: TypeParameter[];
}

export interface InterfaceDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← Renamed from scope_id
  availability: Availability;
  extends?: TypeReference[];
  generics?: TypeParameter[];
}

export interface EnumDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← Renamed from scope_id
  availability: Availability;
  variants: EnumVariant[];
}

export interface VariableDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← Renamed from scope_id
  availability: Availability;
  type?: TypeReference;
  is_const: boolean;
}

export interface MethodDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;  // ← Renamed from scope_id
  class_id: SymbolId;
  availability: Availability;
  is_static: boolean;
  parameters: ParameterDefinition[];
  return_type?: TypeReference;
}

// etc. for all definition types
```

### 2. Add JSDoc Documentation (15 min)

Add clear documentation to each interface:

```typescript
export interface FunctionDefinition {
  /** Unique identifier for this function symbol */
  symbol_id: SymbolId;

  /** Function name */
  name: string;

  /** Location in source code */
  location: Location;

  /**
   * The scope where this function is DEFINED.
   * For file-level functions: root_scope_id
   * For nested functions: parent function's scope_id
   */
  defining_scope_id: ScopeId;

  /** Availability/visibility of this function */
  availability: Availability;

  // ... rest of fields
}
```

### 3. Update SemanticIndex Type (10 min)

Ensure SemanticIndex uses consistent naming:

```typescript
export interface SemanticIndex {
  file_path: string;
  root_scope_id: ScopeId;
  scopes: Map<ScopeId, Scope>;

  // All definitions now use defining_scope_id
  functions: Map<SymbolId, FunctionDefinition>;
  classes: Map<SymbolId, ClassDefinition>;
  interfaces: Map<SymbolId, InterfaceDefinition>;
  // etc.
}
```

### 4. Run Type Checker (10 min)

```bash
npx tsc --noEmit
```

Expected: Type errors in files that reference `scope_id` - these will be fixed in subsequent tasks.

### 5. Document Breaking Change (5 min)

Add to CHANGELOG or migration notes:

```markdown
## Breaking Change: scope_id → defining_scope_id

All definition interfaces now use `defining_scope_id` instead of `scope_id`.

**Rationale:** Clarifies that this field represents the scope WHERE the symbol is DEFINED, not just any scope ID.

**Migration:**
- Update all code that accesses `definition.scope_id` to use `definition.defining_scope_id`
- Semantics remain identical - only the name changed
```

## Success Criteria

- ✅ All definition types use `defining_scope_id`
- ✅ JSDoc documentation added
- ✅ Type checker identifies affected code
- ✅ Breaking change documented

## Outputs

- Updated type definitions in `semantic_index.ts`

## Next Task

**task-epic-11.112.25** - Update builder configs to use defining_scope_id
