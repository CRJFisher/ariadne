---
id: TASK-364.3
title: "Drop two redundant identical overrides in JavaScriptTypeScriptScopeBoundaryExtractor"
status: Done
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

- [x] Both overrides removed from `javascript_typescript_scope_boundary_extractor.ts`.
- [x] Scope-boundary behaviour for JS/TS constructors and blocks is unchanged
      (existing extractor tests green).
- [x] No shim; full core suite green.

<!-- AC:END -->

## Implementation Notes

## High-level summary

`JavaScriptTypeScriptScopeBoundaryExtractor` no longer overrides
`extract_constructor_boundaries` or `extract_block_boundaries`; it inherits both
directly from the concrete `CommonScopeBoundaryExtractor` base. The two deleted
overrides were byte-for-byte identical to the base methods, so the class carries
one fewer redundant surface and the base is the single home for constructor and
block boundary semantics.

Constructor scope semantics are preserved because the base
`extract_constructor_boundaries` delegates through `this.extract_function_boundaries`.
On a JS/TS (or TypeScript) instance that call binds to the subclass's richer
`extract_function_boundaries` override — the same dispatch the deleted override
performed — so constructors still get arrow, named-function-expression, and
body-less-signature handling. Block scopes are name-less and the base
implementation (whole node as both symbol and scope location) is identical, so
inheriting it changes nothing.

### What changed

- Deleted `extract_constructor_boundaries` and `extract_block_boundaries` from
  `packages/core/src/index_single_file/scopes/extractors/javascript_typescript_scope_boundary_extractor.ts`
  (18 lines removed, one file touched).

### How the acceptance criteria were addressed

- **Both overrides removed** — the diff deletes exactly those two methods and
  nothing else.
- **Behaviour unchanged** — the existing
  `javascript_typescript_scope_boundary_extractor.test.ts` blocks
  `extract_constructor_boundaries` and `extract_block_boundaries` drive
  `extract_boundaries(node, "constructor" | "block", …)` through the public
  interface and stay green, and the project-level integration tests that index
  real JS/TS files with constructors and blocks pass unchanged.
- **No shim; full core suite green** — no adapter or bridge was introduced; the
  full `@ariadnejs/core` suite reports 3417 tests passing, with `tsc` and eslint
  clean.

### Notes

- The `TypeScriptScopeBoundaryExtractor` subclass was re-verified: it overrides
  only `extract_boundaries` (routing class/module cases) and does not re-override
  the constructor or block methods, so the inherited base implementations reach
  it cleanly.
