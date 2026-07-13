---
id: TASK-364.3
title: "Drop two redundant identical overrides in JavaScriptTypeScriptScopeBoundaryExtractor"
status: To Do
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - dead-code
  - refactor
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`packages/core/src/index_single_file/scopes/extractors/javascript_typescript_scope_boundary_extractor.ts`
overrides two methods that are **byte-for-byte identical** to the base
`CommonScopeBoundaryExtractor` implementations (flagged during the
`boundary_base.ts` sweep):

- `extract_constructor_boundaries` (line 174)
- `extract_block_boundaries` (line 181)

Because they add nothing, the overrides are redundant — deleting them lets the
base methods be inherited directly.

### Work

1. Confirm each override is still identical to the base method (the base is now
   concrete after the `boundary_base.ts` sweep).
2. Delete both overrides so the class inherits the base implementations.
3. Check the `TypeScriptScopeBoundaryExtractor` subclass does not itself
   re-override these identically (the TS extractor sweep found it does not, but
   re-verify after this change).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] Both overrides removed from `javascript_typescript_scope_boundary_extractor.ts`.
- [ ] Scope-boundary behaviour for JS/TS constructors and blocks is unchanged
      (existing extractor tests green).
- [ ] No shim; full core suite green.

<!-- AC:END -->
