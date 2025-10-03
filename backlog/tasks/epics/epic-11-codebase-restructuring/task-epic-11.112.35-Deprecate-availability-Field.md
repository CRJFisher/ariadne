# Task epic-11.112.35: Deprecate availability Field

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.34

## Objective

Mark the `availability` field as deprecated in all definition types. Add deprecation notices and migration guidance. This prepares for eventual removal of the old system.

## Files

### MODIFIED
- `packages/ariadne-types/src/semantic_index.ts`

## Implementation Steps

### 1. Add Deprecation to FunctionDefinition (10 min)

```typescript
export interface FunctionDefinition {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  defining_scope_id: ScopeId;

  /**
   * @deprecated Use `visibility` instead. This field will be removed in v2.0.
   *
   * Migration:
   * - "local" → scope_children (for parameters) or scope_local (for variables)
   * - "file" → file
   * - "file-export" → exported
   */
  availability: Availability;

  /** Scope-aware visibility (replaces availability) */
  visibility: VisibilityKind;

  parameters: ParameterDefinition[];
  return_type?: TypeReference;
}
```

### 2. Add Deprecation to All Definition Types (30 min)

Apply same pattern to:
- `ClassDefinition`
- `InterfaceDefinition`
- `EnumDefinition`
- `VariableDefinition`
- `MethodDefinition`
- `ParameterDefinition`
- `PropertyDefinition`
- `TypeAliasDefinition`
- Any other definition types

### 3. Deprecate Availability Type (10 min)

```typescript
/**
 * @deprecated Use `VisibilityKind` instead. This type will be removed in v2.0.
 *
 * The old availability system was definition-centric and didn't account for
 * reference location. The new visibility system is reference-centric and
 * provides more accurate symbol resolution.
 */
export type Availability = "local" | "file" | "file-export";
```

### 4. Add Migration Guide Comment (10 min)

Add at top of file:

```typescript
/**
 * # MIGRATION GUIDE: Availability → Visibility
 *
 * ## Overview
 * The `availability` field is deprecated in favor of `visibility`.
 *
 * ## Key Differences
 *
 * ### Old System (availability)
 * - Definition-centric: "Where is this defined?"
 * - Values: "local", "file", "file-export"
 * - Problem: Doesn't consider reference location
 *
 * ### New System (visibility)
 * - Reference-centric: "Is this visible from the reference?"
 * - Values: scope_local, scope_children, file, exported
 * - Solution: Checks visibility based on scope tree
 *
 * ## Migration Map
 *
 * | Old Availability | Context | New Visibility |
 * |------------------|---------|----------------|
 * | "local" | Parameter | scope_children |
 * | "local" | Local variable | scope_local |
 * | "local" | Nested function | scope_local |
 * | "file" | File-scoped symbol | file |
 * | "file-export" | Exported symbol | exported |
 *
 * ## Migration Steps
 *
 * 1. Update code to read `visibility` instead of `availability`
 * 2. Use `VisibilityChecker.is_visible()` for visibility checks
 * 3. Update tests to reflect correct visibility behavior
 * 4. Remove references to `availability` field
 *
 * ## Timeline
 *
 * - v1.x: Both fields present, availability deprecated
 * - v2.0: availability field removed (breaking change)
 */
```

### 5. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: Deprecation warnings where `availability` is accessed.

### 6. Document Breaking Change (5 min)

Add to CHANGELOG:

```markdown
## [v1.x] - YYYY-MM-DD

### Deprecated

- `availability` field in all definition types
  - Use `visibility` instead for scope-aware symbol resolution
  - See migration guide in `semantic_index.ts`
  - Field will be removed in v2.0

### Added

- `visibility` field in all definition types
- `VisibilityChecker` service for reference-centric visibility checks
- Scope tree utilities for traversal and analysis
```

## Success Criteria

- ✅ All `availability` fields marked as deprecated
- ✅ Deprecation includes migration guidance
- ✅ Migration guide documented
- ✅ Breaking change noted in CHANGELOG
- ✅ Type checker emits deprecation warnings

## Outputs

- Deprecated `availability` with migration docs

## Next Task

**task-epic-11.112.36** - Update code to use visibility
