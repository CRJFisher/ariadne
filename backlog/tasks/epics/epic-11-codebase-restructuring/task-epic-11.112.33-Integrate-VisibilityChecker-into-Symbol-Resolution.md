# Task epic-11.112.33: Integrate VisibilityChecker into Symbol Resolution

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 2 files modified
**Dependencies:** task-epic-11.112.32

## Objective

Integrate the VisibilityChecker into the symbol resolution process. Symbol resolution should now filter definitions by visibility, ensuring only visible symbols are returned when resolving references.

## Files

### MODIFIED
- `packages/core/src/resolve_references/symbol_resolver_index.ts`
- `packages/core/src/resolve_references/resolve_references.ts`

## Implementation Steps

### 1. Add VisibilityChecker to Symbol Resolver (20 min)

```typescript
// In symbol_resolver_index.ts

import { VisibilityChecker } from './visibility_checker';

export class SymbolResolverIndex {
  private visibility_checker: VisibilityChecker;

  constructor(private index: SemanticIndex) {
    this.visibility_checker = new VisibilityChecker(index);
  }

  // ... existing methods
}
```

### 2. Add Visibility Filter to find_symbol (40 min)

Update `find_symbol` or similar methods to filter by visibility:

```typescript
// Before:
private find_symbol(
  symbol_name: string,
  scope_id: ScopeId
): SymbolId | undefined {
  // Find all definitions with this name
  const candidates = this.get_definitions_by_name(symbol_name);

  // Return first match (WRONG - doesn't check visibility)
  return candidates[0]?.symbol_id;
}

// After:
private find_symbol(
  symbol_name: string,
  scope_id: ScopeId
): SymbolId | undefined {
  // Find all definitions with this name
  const candidates = this.get_definitions_by_name(symbol_name);

  // Filter by visibility
  const visible_candidates = candidates.filter(def =>
    this.visibility_checker.is_visible(def, scope_id)
  );

  // Return first visible match
  return visible_candidates[0]?.symbol_id;
}
```

### 3. Update resolve_variable_reference (30 min)

```typescript
resolve_variable_reference(
  reference_name: string,
  reference_scope_id: ScopeId
): SymbolId | undefined {
  // Get all variable definitions with this name
  const candidates = Array.from(this.index.variables.values())
    .filter(v => v.name === reference_name);

  // Filter by visibility from reference scope
  const visible = candidates.filter(def =>
    this.visibility_checker.is_visible(def, reference_scope_id)
  );

  // If multiple visible, choose closest (by scope depth)
  if (visible.length > 1) {
    return this.choose_closest_definition(visible, reference_scope_id);
  }

  return visible[0]?.symbol_id;
}
```

### 4. Add choose_closest_definition Helper (20 min)

When multiple definitions are visible, choose the one in the closest scope:

```typescript
import { get_scope_depth } from './scope_tree_utils';

/**
 * Choose the closest definition when multiple are visible.
 * Prefers definitions in closer scopes (higher depth).
 */
private choose_closest_definition<T extends { defining_scope_id: ScopeId }>(
  definitions: T[],
  reference_scope_id: ScopeId
): T {
  // Sort by scope depth (descending - higher depth = closer)
  const sorted = [...definitions].sort((a, b) => {
    const depth_a = get_scope_depth(a.defining_scope_id, this.index);
    const depth_b = get_scope_depth(b.defining_scope_id, this.index);
    return depth_b - depth_a;
  });

  return sorted[0];
}
```

### 5. Update resolve_class_reference (20 min)

Apply same pattern to class resolution:

```typescript
resolve_class_reference(
  reference_name: string,
  reference_scope_id: ScopeId
): SymbolId | undefined {
  const candidates = Array.from(this.index.classes.values())
    .filter(c => c.name === reference_name);

  const visible = candidates.filter(def =>
    this.visibility_checker.is_visible(def, reference_scope_id)
  );

  if (visible.length > 1) {
    return this.choose_closest_definition(visible, reference_scope_id);
  }

  return visible[0]?.symbol_id;
}
```

### 6. Update All Other Resolution Methods (30 min)

Apply visibility filtering to:
- `resolve_function_reference()`
- `resolve_interface_reference()`
- `resolve_enum_reference()`
- `resolve_method_reference()`
- Any other resolution methods

### 7. Add Visibility Logging (10 min)

Add optional debug logging:

```typescript
private find_symbol(
  symbol_name: string,
  scope_id: ScopeId
): SymbolId | undefined {
  const candidates = this.get_definitions_by_name(symbol_name);

  if (process.env.DEBUG_VISIBILITY === '1') {
    console.log(`\n=== Resolving ${symbol_name} from scope ${scope_id} ===`);
    console.log(`Candidates: ${candidates.length}`);

    candidates.forEach(def => {
      const visible = this.visibility_checker.is_visible(def, scope_id);
      console.log(`  ${def.symbol_id}: ${visible ? 'VISIBLE' : 'NOT VISIBLE'}`);
    });
  }

  const visible = candidates.filter(def =>
    this.visibility_checker.is_visible(def, scope_id)
  );

  return visible[0]?.symbol_id;
}
```

### 8. Run Tests (10 min)

```bash
npm test -- symbol_resolver.test.ts
npm test -- symbol_resolution.integration.test.ts
```

Expected: Tests should pass. Some tests may fail if they expected incorrect behavior (symbols visible when they shouldn't be).

### 9. Run Full Test Suite (10 min)

```bash
npm test
```

## Success Criteria

- ✅ VisibilityChecker integrated into symbol resolution
- ✅ All resolution methods filter by visibility
- ✅ Closest definition chosen when multiple visible
- ✅ Tests pass (or reveal correct failures)
- ✅ Debug logging available

## Outputs

- Updated symbol resolution with visibility filtering

## Next Task

**task-epic-11.112.34** - Fix symbol resolution tests for visibility
