# Task Epic 11.154.8.1: Fix Re-export Resolution

**Parent Task**: 11.154.8 - Final Integration
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 1-2 hours
**Test Impact**: Fixes 6 tests

---

## Objective

Fix ResolutionRegistry to properly resolve imports through re-export chains using complete `@import.reexport` captures.

**PRINCIPLE**: Use existing complete captures, fix resolution logic (not query captures).

---

## Failing Tests (6 total)

File: `src/resolve_references/resolution_registry.test.ts`

1. "should resolve imports from re-exports in scope symbol table"
2. "should detect calls to re-exported functions"
3. "should not mark re-exported functions as entry points when they are called"
4. "should handle chained re-exports (A exports to B, B exports to C)"
5. "should resolve imports from re-exports in nested function scopes"
6. "should handle re-exports with nested directory structure and relative imports"

---

## Root Cause

Re-export handler creates import definitions, but ResolutionRegistry may not:
- Follow the export → import chain
- Resolve symbols through intermediate re-exports
- Handle chained re-exports (A → B → C)

---

## Solution Approach

### Current State

Queries have `@import.reexport` on complete `export_statement` nodes ✅
Builder has handler that extracts export specifiers ✅

### What's Missing

ResolutionRegistry needs to:
1. Recognize import definitions that came from re-exports
2. Look up the original symbol in the source module
3. Follow chains (if B re-exports from A, and C imports from B, resolve to A)

---

## Implementation

**File**: `packages/core/src/resolve_references/resolution_registry.ts`

Check import resolution logic:
```typescript
// When resolving an import:
const import_def = find_import_definition(name);

if (import_def.is_reexport) {
  // Follow to source module
  const source_module = import_def.module_path;
  const source_symbol = lookup_in_module(source_module, import_def.original_name);

  // If source is also a re-export, follow chain
  while (source_symbol.is_reexport) {
    source_symbol = follow_reexport(source_symbol);
  }

  return source_symbol;
}
```

---

## Acceptance Criteria

- [ ] All 6 re-export resolution tests pass
- [ ] Chained re-exports resolve correctly (A → B → C)
- [ ] Nested directory structure works
- [ ] Re-exported functions not marked as entry points when called
- [ ] NO new captures added to .scm files
- [ ] Resolution logic only (builder already extracts re-exports)

---

## Files to Modify

- `packages/core/src/resolve_references/resolution_registry.ts` - Add re-export chain following
- Possibly: `packages/core/src/resolve_references/import_resolver.ts` - If import resolution needs update

**DO NOT modify**: Query files (already have complete captures)

---

## Time: 1-2 hours
