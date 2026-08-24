---
id: TASK-381.11
title: "Make the reported call graph a function of the codebase rather than of the order files were ingested"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - call-resolution
  - receiver_type_inference
  - bug
dependencies:
  - TASK-381.8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The same file set in a different ingest order produces a different call graph, and this is true of the unpatched build as much as of everything this epic adds. Measured on one 927-file set in three orders: the unpatched build gives 3,701 entry points forward and 3,699 reversed, with 68,188 against 68,197 resolved edges; the stack gives 3,702 and 3,699, and under reversed order the two builds are byte-identical to each other. Node sets are identical in every arm and every order (21,170), so the divergence is in resolution and not in what got indexed — which also rules out the diagnostics walk order that TASK-381.2 fixes. It is not an unfinished fixpoint either: extra whole-corpus resolution passes recover nothing, with identical edge hashes at one, two and three passes. Determinism for a fixed order is meanwhile excellent, two independent full-corpus processes having produced byte-identical hashes.

The failure surface is named. The edges that move carry `{stage: type_inference, reason: receiver_type_unknown}` from `resolve_identifier_base` (`packages/core/src/resolve_references/call_resolution/receiver_resolution.ts:230-285`), because `TypeRegistry.symbol_types` has no entry for a receiver const — `export const extUriBiasedIgnorePathCase = new ExtUri(...)` — that name resolution binds correctly in every order. On an identical 180-file set, `src/vs/base/common/resources.ts` at ingest position 24 leaves the binding null and at position 155 it is bound. Five elimination experiments rule out name resolution, the subtype registry, `is_subtype_registered`'s name matching, the export-gate rollback, and project incompleteness — a manual `types.update_file` against the finished project still fails to derive the binding. What remains is an input to `resolve_type_metadata` (`packages/core/src/resolve_references/registries/type.ts:87`) or `extract_constructor_bindings` (`packages/core/src/resolve_references/type_preprocessing/constructor_bindings.ts:28`) inside `TypeRegistry`'s own accumulated state that depends on arrival position. That last step is a hypothesis and not a measurement: nobody has single-stepped `resources.ts` at the two positions, and that is where the work starts.

A second, adjacent effect is real and should be closed in the same change. `get_callable_definitions` materialises `by_symbol` into an array and call resolution reads it in insertion order (`packages/core/src/resolve_references/call_resolution/call_resolver.ts:456`); a prototype whose final `DefinitionRegistry` was byte-identical to the baseline nevertheless produced a different call graph, because it re-inserted only a file's import definitions where the baseline re-inserted the whole definition set, changing insertion order for 1,699 of 20,468 symbols and flipping three call edges. Order or key the candidate set so resolution is order-independent by construction, and state the tie-break rule in the resolver rather than leaving it to the sequence a loader happened to walk. But that is not the mechanism behind the three-order deltas above, and fixing it alone will not close them.

What this buys is not runtime. It is that a user can diff two Ariadne runs and trust the difference, and it is the precondition for ever keying a whole-corpus cache on content. Because the fix will move the reported entry-point set, its acceptance test is a three-order diff PLUS hand adjudication of every moved entry point — order-stability is a necessary condition and not a proof of correctness, since three orders can agree on the same wrong answer.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 The same 927-file set produces an identical six-number fingerprint under forward, reversed and shuffled ingest, with the shuffle seed recorded in the harness so the run is reproducible — against 3,701 / 3,699 entry points on the unpatched build and 3,702 / 3,699 on the stack today.
- [ ] #2 #2 Resolved-edge counts are identical across the three orders, against 68,188 forward and 68,197 reversed on the unpatched build today.
- [ ] #3 #3 The receiver in `export const extUriBiasedIgnorePathCase = new ExtUri(...)` has a `TypeRegistry.symbol_types` entry regardless of ingest position, pinned by a test that loads the same 180-file set with `src/vs/base/common/resources.ts` at position 24 and at position 155 — null at 24 today.
- [ ] #4 #4 Call resolution's candidate set is ordered by a stated rule documented where the rule lives, and `get_callable_definitions` no longer decides the answer by insertion order; a test writes the same definitions in two different orders and asserts a byte-identical call graph.
- [ ] #5 #5 Any movement in the reported entry-point set is characterised edge by edge against the three-order runs AND each moved entry point is adjudicated by hand against the vscode source — for each, whether a real call reaches it — with the verdict recorded. Order-stability is a necessary condition, not the acceptance test; the set that is kept is the one the adjudication shows correct.
- [ ] #6 #6 `receiver_type_unknown` counts over the full corpus are recorded before and after, so the size of the remaining type-inference gap is a number rather than an impression.

<!-- AC:END -->
