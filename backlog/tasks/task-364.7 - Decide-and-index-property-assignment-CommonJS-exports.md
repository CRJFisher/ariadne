---
id: TASK-364.7
title: "Decide and (if in scope) index property-assignment CommonJS exports"
status: Done
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - correctness
  - javascript
  - needs-decision
parent_task_id: TASK-364
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`packages/core/src/index_single_file/query_code_tree/symbol_factories/exports.javascript.ts`
recognises whole-object CommonJS assignment (`module.exports = { ... }`) but
does **not** treat property-assignment CommonJS exports as exports:

- `exports.foo = ...`
- `module.exports.foo = ...`

The `exports.javascript.ts` sweep documented this as a deliberate current-state
gap (tests assert these forms are NOT indexed as exports). Whether it is a
product bug depends on whether Ariadne needs to trace incremental CommonJS
export patterns for call-graph / entry-point detection.

### Work

1. **Decision first.** Determine whether property-assignment CommonJS exports are
   in scope for the intention tree (call-graph / entry-point detection). If a
   real target codebase uses `exports.foo = ...` / `module.exports.foo = ...`
   for functions that should be reachable, it is in scope. Record the ruling.
2. **If in scope:** detect these forms in the JS export factory, marking the
   assigned name `is_exported: true` with the correct exported name. Add tests
   for both the property-assignment export (`is_exported: true`) and a
   non-exported local (`is_exported: false`).
3. **If out of scope:** convert the current descriptive tests into an explicit,
   commented statement of the boundary and close the task with the ruling
   recorded — do not leave it ambiguous.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] A recorded ruling on whether property-assignment CommonJS exports are in
      scope.
- [x] If in scope: `exports.foo = fn` and `module.exports.foo = fn` produce a
      definition with `is_exported: true` and the right name; `is_exported`
      tested both true and false.
- [ ] If out of scope: the boundary is documented in the factory and its tests;
      no behaviour change. (Not applicable — the ruling is in scope.)
- [x] Full core suite green.

<!-- AC:END -->

## Implementation Notes

### High-level summary

Property-assignment CommonJS exports are **in scope**: `is_exported` feeds
entry-point/unreachable classification — the top of the intention tree — and
`exports.foo = ...` / `module.exports.foo = ...` is a mainstream Node export
idiom (Lambda handlers, incremental CJS modules). Leaving these forms unmarked
manufactures false "unreachable function" findings for code that is externally
reachable.

The JS export factory's per-file cache
(`packages/core/src/index_single_file/query_code_tree/symbol_factories/exports.javascript.ts`,
`build_export_cache`) now detects both forms alongside the whole-object
`module.exports = { ... }` branch. An `is_commonjs_exports_base` predicate
recognises the exports bag in its two spellings — the bare `exports` identifier
and the `module.exports` member expression — and a sibling branch keys the
cache by the local RHS identifier, recording `export_name` only when the
property name differs from the local name (the same convention as the
object-form pair branch). One shared factory serves both JavaScript and
TypeScript (`capture_handlers.typescript.ts` imports `extract_export_info`
via `symbol_factories.javascript`), so the fix covers both languages;
tree-sitter node/field parity for these forms was verified against both
grammars during review.

Excluded by construction, each pinned by a test: anonymous RHS
(`exports.foo = function () {}` has no named local to mark), computed keys
(`exports["foo"]` parses as `subscript_expression`), deep member chains
(`module.exports.foo.bar`), unrelated objects (`other.foo`,
`other.exports.foo`), and assignments inside function bodies (the cache walks
only top-level statements).

### Verification

The factory suite grows from 23 to 32 tests: the two tests that previously
pinned the non-export behaviour are inverted, and rename, sibling-local, and
exclusion-guard cases are added. Full monorepo suite green (4,508 tests across
7 roots), typecheck and lint clean. An end-to-end drive through the real
`Project` pipeline confirms both forms yield `is_exported: true` with the
correct `export_name` and that unassigned locals stay unexported.

Review (3 opus lenses + fix-diff re-review) confirmed the branch logic and
found one actionable weakness — the anonymous-RHS test originally queried an
unrelated local and could not fail; it now uses a local named the same as the
assigned property, so mis-keying on the property name would be caught. Noted,
not actioned (pre-existing conventions shared with the object-form branch):
the export cache is name-keyed and scope-blind, double exports of one local
are last-wins, and no test parses these forms with the TypeScript grammar.
