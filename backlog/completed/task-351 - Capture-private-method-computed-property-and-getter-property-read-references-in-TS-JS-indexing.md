---
id: TASK-351
title: Capture private-method, computed-property, and getter-property-read references in TS/JS indexing and triage grep
status: Done
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

- [x] `this.#method()` private-field call sites emit a `@reference.call` and resolve to the
      private method definition.
- [x] Computed-key method definitions (`[Symbol.iterator]()`, `[computed]()`) are indexed as
      callable nodes, and calls from their bodies are captured.
- [x] Getter accessors invoked via bare property read are recognized as reachable (via `.scm`
      capture and/or the triage grep pattern), so they no longer surface as unreachable entry points.
- [x] Regression tests cover each pattern in both TypeScript and JavaScript where applicable.

<!-- AC:END -->

## Implementation Notes

### High-level summary

TypeScript/JavaScript indexing now captures three member-reference sites that
previously emitted nothing, so the members they reach are seen as reachable rather
than surfacing as false unreachable entry points:

- A private-method call `this.#method()` emits a call reference and resolves to the
  private method definition.
- A computed-key method (`[Symbol.iterator]() {}`, `[computed]() {}`) is indexed as a
  callable node with its own body scope, so the calls its body makes are captured.
- A getter accessor invoked by a bare property read (`obj.value`) is recognized as a
  call to the getter, so the getter is reachable in the call graph.

### What changed

**Private-method calls — query only.** The member-call query in `typescript.scm` and
`javascript.scm` matched only `property: (property_identifier)`, so a private call whose
property is a `private_property_identifier` emitted no reference. A parallel capture for
`private_property_identifier` is added to both grammars. The existing metadata extractors
already derive the `#method` name and the `this` self-reference generically, and private
methods are already indexed, so the call resolves to the private method definition with
no handler change.

**Computed-key methods — query only.** The `method_definition` rules matched only
`property_identifier` / `private_property_identifier` names, so a `computed_property_name`
key was never captured and the method — with its body and any calls it makes — was
invisible. A `(method_definition name: (computed_property_name) @definition.method) @scope.method`
rule is added to both grammars. The method is indexed under its full key text (e.g.
`[Symbol.iterator]`), and `@scope.method` gives it a body scope so its body's calls are
captured. Both the member-expression key form (`[Symbol.iterator]`) and the
identifier/variable key form (`[run]`) are covered.

**Getter property-read reachability — real reachability.** Getters are marked at index
time with a new `MethodDefinition.accessor_kind` (`"getter" | "setter"`), read from the
`get`/`set` token via a shared `extract_accessor_kind` helper and threaded through both
capture handlers and `add_method_to_class`. In call resolution, a `property_access`
reference — previously skipped entirely — is resolved through the existing method-call
machinery via a synthetic `MethodCallReference`, and an edge is emitted only when the
resolved member's definition is a getter. This makes a genuinely read getter reachable
while a plain field read or an uncalled method stays unreachable, so the graph is not
over-connected. Because the fix operates at the call-graph layer (`trace_call_graph`), a
read getter never reaches the entry-point/triage stage at all, so no triage-grep change is
needed.

**Getter/setter member-index collision (found in review).** A getter and a same-named
setter share one member name, and the name-keyed member index used last-write-wins, so a
setter declared after its getter shadowed it and a bare read resolved to the setter —
failing the getter filter and leaving the getter unreachable for the canonical accessor
pair. `set_member_symbol` now gives a getter precedence over a same-named setter (a setter
never overwrites an existing member entry) and is applied at all three name→symbol
member-index build sites (type member extraction, the `DefinitionRegistry` flat member
map, and `TypeRegistry.get_type_members`). Getter reachability is order-independent and
holds for the get/set pair. `accessor_kind` is JS/TS-only, so Python and Rust keep
last-write-wins.

### How the acceptance criteria are met

- AC1 — index tests assert the `self_reference_call` on `this.#open()`; integration tests
  assert `#open` is in the referenced-symbol set (resolved to the specific private method),
  TS and JS.
- AC2 — index tests assert both computed-key forms are indexed with a body scope and that
  body calls are attributed to that scope; integration tests assert the body call is
  referenced, TS and JS.
- AC3 — integration tests assert the getter is in the referenced set and absent from
  `entry_points`, while an uncalled method remains an entry point; getter+setter and
  non-getter-read guard cases are included, TS and JS.
- AC4 — every case exists in the `.typescript` and `.javascript` test files; the two
  grammar changes are mirrored.

### Notes / follow-ups

- Setter reachability (a getter's paired setter invoked by `obj.value = x`, an assignment)
  is out of scope; assignment references are not call-resolved. `accessor_kind: "setter"`
  is nonetheless produced and is consumed by the getter-precedence rule.
- A computed key whose text contains a colon (e.g. `["a:b"]()`) would embed a colon in the
  method SymbolId's name segment. No current SymbolId parser reads the trailing name back,
  and such keys are exotic, so this is left as a pre-existing latent concern.
