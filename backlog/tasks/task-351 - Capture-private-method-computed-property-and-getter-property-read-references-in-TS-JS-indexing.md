---
id: TASK-351
title: Capture private-method, computed-property, and getter-property-read references in TS/JS indexing and triage grep
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - indexer
  - call-resolution
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
  - packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Three member-reference capture gaps in TypeScript/JavaScript indexing make reachable
members look unreachable, because their call or read sites never emit a reference.
Surfaced by TASK-190.30.1's registry audit: six suppressor classifiers were deleted
because each described a fixable Ariadne capture gap rather than a permanent limitation.
Each gap is confirmed still-broken in current `packages/core` via a live call-graph repro.

### The three gaps

1. **Private-method call capture.** The `call_expression` member query in `typescript.scm`
   captures only `property: (property_identifier)`, so a `this.#method()` invocation on a
   private class field emits no `@reference.call`. (`private_property_identifier` is captured
   only on the definition side, never the call side.)

2. **Computed-property method definitions.** The `method_definition` query matches only
   `property_identifier` keys, so a computed-key method such as `[Symbol.iterator]() { ... }`
   is never indexed as a callable node at all — its body and any calls it makes are invisible.

3. **Getter property-read references.** A getter accessor is invoked via a bare property read
   (`obj.x`, no parentheses). The `.scm` query emits `@reference.call` only on `call_expression`,
   never on a property read, and the triage `build_grep_index` pattern in
   `extract_entry_point_diagnostics.ts` requires a trailing `(`, so a getter read produces no
   grep hit either (`diagnosis = no-textual-callers`).

### Origin (deleted classifier rows this tracks)

`private-class-field-method`, `private-field-method-resolution`, `computed-property-method-caller`,
`getter-accessor-not-tracked`, `property-getter-dispatch`, `dynamic-or-untyped-property-access`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `this.#method()` private-field call sites emit a `@reference.call` and resolve to the
      private method definition.
- [ ] Computed-key method definitions (`[Symbol.iterator]()`, `[computed]()`) are indexed as
      callable nodes, and calls from their bodies are captured.
- [ ] Getter accessors invoked via bare property read are recognized as reachable (via `.scm`
      capture and/or the triage grep pattern), so they no longer surface as unreachable entry points.
- [ ] Regression tests cover each pattern in both TypeScript and JavaScript where applicable.

<!-- AC:END -->
