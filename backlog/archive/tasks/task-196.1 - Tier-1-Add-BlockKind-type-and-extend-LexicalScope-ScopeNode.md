---
id: TASK-196.1
title: "Tier 1: Add BlockKind type and extend LexicalScope/ScopeNode"
status: To Do
assignee: []
created_date: "2026-03-26 11:25"
labels:
  - types
  - tier-1
dependencies: []
parent_task_id: TASK-196
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add the foundational types for control flow annotation. This is the type-layer change that all other sub-tasks depend on.

### Type Changes

**`packages/types/src/scopes.ts`** — Add `BlockKind` union type:

```typescript
type BlockKind =
  | "if"
  | "else_if"
  | "else"
  | "for"
  | "for_in"
  | "while"
  | "do_while"
  | "switch"
  | "switch_case"
  | "try"
  | "catch"
  | "finally"
  | "match"
  | "match_arm"
  | "with"
  | "loop"
  | "unsafe"
  | "async"
  | "comprehension"
  | "generic";
```

**`packages/types/src/scopes.ts`** — Extend `BaseScopeNode`:

```typescript
readonly block_kind: BlockKind | null;      // null for non-block scopes
readonly condition_text: string | null;      // null when no condition applies
readonly sibling_scope_ids: readonly ScopeId[];  // empty when no siblings
```

**`packages/types/src/index_single_file.ts`** — Extend `LexicalScope` with the same three fields.

### Design Notes

- `BlockKind` is a simple string union (not a discriminated union with embedded data) — condition_text and sibling_scope_ids are separate fields on the scope node.
- `ScopeId` format does NOT change. Block scopes continue using `"block"` as their type component. `block_kind` is metadata, not identity.
- All new fields have null/empty defaults. Existing consumers unaffected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 BlockKind type is exported from @ariadnejs/types
- [ ] #2 BaseScopeNode has block_kind: BlockKind | null, condition_text: string | null, sibling_scope_ids: readonly ScopeId[]
- [ ] #3 LexicalScope has the same three new fields
- [ ] #4 TypeScript compiles with no errors
- [ ] #5 All existing tests pass without modification (new fields have null/empty defaults)
<!-- AC:END -->
