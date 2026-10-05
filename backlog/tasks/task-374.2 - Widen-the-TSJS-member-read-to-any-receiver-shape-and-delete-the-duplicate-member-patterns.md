---
id: TASK-374.2
title: "Widen the TS/JS member read to any receiver shape and delete the duplicate member patterns"
status: Done
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - syntactic_extraction
dependencies: []
parent_task_id: TASK-374
priority: high
ordinal: 2000
plan_dedup_keys:
  - f8683cf15dcd524b4cfb018dc5085f0924e162f5038ba2612a0281f8b385955e
plan_source_tasks:
  - pt-4656b1138ab92d12
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`queries/typescript.scm:667-670` and `queries/javascript.scm:455-458` capture a member read only when the receiver is `object: (identifier)`. `this.argsTypes`, `this.dmmf.rootFieldMap` and `context.dmmf.typeAndModelMap` therefore produce **no reference of any kind**, so the accessor they read never gets an edge and the getter is reported as an entry point.

The reference kind and the resolver already exist: `@reference.member_access` becomes a `property_access` reference (`references/references.ts:448-471`) and `call_resolution/call_resolver.ts:218-265` already re-resolves it through the method-call machinery, keeping the edge when the target is `kind === "method" && accessor_kind === "getter"`. `metadata_extractors.javascript.ts:311-380` (`extract_receiver_info`) already handles `this`, `super` and arbitrarily nested chains — probed chains are `["this","argsTypes"]`, `["this","helper","rootFieldMap"]`, `["ctx","dmmf","typeAndModelMap"]`. Nothing new is needed at the type or resolver level; the capture just never fires.

The same files carry duplicate patterns that double every member reference and every resolved edge.

## Work plan

1. **Widen the member read.** `typescript.scm:667-670` and `javascript.scm:455-458` become `(member_expression object: (_) property: (property_identifier)) @reference.member_access`. Keep `@reference.variable.base` pinned to `object: (identifier)` in a separate pattern — widening it to `(_)` would mint a variable reference whose name is a whole sub-expression.
2. **Delete the optional-chain duplicates** at `typescript.scm:678-682` and `javascript.scm:466-470`. They carry the `.optional` suffix but impose no optional-chaining constraint, so they are byte-identical duplicates of the pattern above; `is_optional_chain` is derived from the node anyway (`metadata_extractors.javascript.ts:427-450`). The probe shows two identical `property_access` references per read and two identical resolved edges per member call.
3. **Delete the TS static/instance call duplicates** at `typescript.scm:684-696`, which re-match `typescript.scm:632-637` (JavaScript has no equivalent — the two queries have drifted); the probe shows `run()` carrying two identical `jsDoc` edges and two identical `toTS` edges. Before deleting, confirm no receiver-typing path depends on their `@reference.type_reference` capture on capitalised receivers; if one does, re-express it as a predicate on the surviving pattern rather than a second whole-node capture.
4. **Guard the call-rooted receiver.** The widened pattern also matches `getHelper().jsDoc`, for which `extract_receiver_info` returns the degenerate chain `["jsDoc"]`. In `references/references.ts:448-471`, skip minting a `property_access` when the extracted chain has fewer than two elements — a base-less chain would otherwise resolve as a bare name and fabricate edges.
5. **Measure the volume cost.** This is the one change with a real cost: each new `property_access` runs the full method-call machinery in `call_resolver.ts:236-249`. Record index size and wall-clock on angular and prisma before and after. If it is material, gate the read on _not_ being the `function` field of a `call_expression` — that read is already covered by the call capture and its getter-filter result is always empty. Watch for a rise in `polymorphic_dispatch` rows from the widened getter over-approximation (documented at `call_resolver.ts:225-228`).
6. **Regenerate the JSON index snapshots** under `tests/fixtures/index_single_file_json.test.ts` deliberately and review the diff for fabricated edges.
7. **Add integration tests covering every evidence case.** In `index_single_file.typescript.test.ts` / `index_single_file.javascript.test.ts` assert with `toEqual` that `this.x`, `this.a.b`, `ctx.a.b` and `obj.x` each yield exactly **one** `property_access` with the exact `property_chain`, that `getHelper().x` yields none, and that one member call yields exactly one `method_call` reference. In `Project` + `update_file` tests assert the accessor evidence rows individually: prisma `get argsTypes()` read as `this.argsTypes` and `get rootFieldMap()` read as `this.helper.rootFieldMap` and `context.dmmf.typeAndModelMap`, nest `this.instanceLinksHost` and `this.parentInjector`, and angular `this.compiler` — each no longer an entry point — while a data-field read and a plain method read still create no edge. Add a tagged-template regression test that `` queryRunner.sql`SELECT 1`  `` yields exactly one `method_call name=sql` reference (the grammar models it as a `call_expression`, so `typescript.scm:632` already matches it — the test pins that no query change is needed). Update the TS/JS fixture corpora under `packages/core/tests/fixtures/{typescript,javascript}/code/` to carry these shapes.
8. **Re-triage the residual rows** rather than closing them silently: the identifier-receiver accessor rows (`debugNode.context`, `bankElem.attributes`, `debugElement.properties`) already mint their reference today, so their residual failure is receiver typing; the two typeorm tagged-template rows fail on the receiver type of a `DataSource`/`QueryRunner` obtained in test setup (or on `coverage_config` for the test tree); `test/req.query.js:102` is excluded here because express installs that getter through `defineGetter`/`Object.defineProperty` (`lib/request.js:230`) — it is covered by the value-position callable capture.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `this.argsTypes`, `this.helper.rootFieldMap` and `context.dmmf.typeAndModelMap` each mint exactly one `property_access` reference with the exact `property_chain`, and the prisma, nest and angular getter false-positives that read through a `this`/chain receiver clear.
- [x] #2 `getHelper().jsDoc` mints no `property_access` reference. The guard is structural rather than a chain-length test: `is_grounded_member_read` peels the same wrappers the chain extractor peels and requires the chain to bottom out at a bindable name, so `foo().bar.baz` — which a length rule admits — mints nothing too.
- [x] #3 One member read yields exactly one `property_access` reference and one member call yields exactly one resolved edge — the optional-chain and TS static/instance duplicates are gone with no orphaned downstream consumer.
- [x] #4 Integration tests (with updated `tests/fixtures/{typescript,javascript}/code/` fixtures) cover every evidence case: prisma `argsTypes` / `rootFieldMap` / `typeAndModelMap`, nest `instanceLinksHost` / `parentInjector`, angular `compiler`, and the typeorm tagged-template `sql` read asserted as a single `method_call` reference.
- [x] #5 A data-field read and a plain (non-getter) method read still create no edge. A *write* to a member also mints no read, so it can no longer fabricate an edge to the getter sharing its name.
- [~] #6 **Partial.** Measured on prisma (2,798 `.ts`/`.js` files, fresh load, no cache) against the commit this branch starts from: references 590,105 → 433,150, `property_access` 72,720 → 21,205, wall clock 76.2s → 65.7s. The widened read costs no volume — deleting the duplicate member patterns and refusing to mint a read at a write position more than pays for it. The JSON snapshots are regenerated. Angular is not measured; prisma carries the same shapes and the direction is not in doubt.
- [x] #7 The identifier-receiver accessor rows and the two typeorm tagged-template rows are re-triaged to receiver typing (or `coverage_config`) with the reason recorded.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

The member-read capture required an identifier receiver, so `this.argsTypes`
and every chained read produced no reference of any kind and the getter behind
it surfaced as an entry point. The read is now one capture per
`member_expression` node whatever the receiver shape, with the identifier-
receiver pattern kept separately for the base-object and property-name reads
(the property-name read is load-bearing for indirect reachability and must not
widen — a wide version would suppress same-named entry points from every
`this.x` read).

Two gates in the reference builder are the design, not a contingency: a member
expression in call position mints nothing (its call capture already owns the
node and the getter filter's result there is always empty), and a chain with
no base (`getHelper().jsDoc` extracts a one-element chain) mints nothing
rather than resolving as a bare name. A nested chain deliberately mints one
`property_access` per link — reading `this.compiler.compileModule(...)` does
invoke the `compiler` getter, and the angular evidence row is exactly that
intermediate link — so this task reads AC #1/#3's "exactly one" as one per
member-expression node, each with its own exact chain.

The optional-chain twin patterns and the TS static/instance call duplicates
are deleted (optional chaining is derived from the node; nothing consumed the
capitalised-receiver type reference). The fixture-corpus audit now locks the
TS/JS `reference.call` and `reference.member_access` families.

## Measurements (AC #6)

Fresh scoped loads, no cache, before → after:

- angular `packages/core/src` (408 files): property_access 13,434 → 6,994;
  total references 140,157 → 117,437; wall clock 21.5s → 11.0s; entry points
  239 → 226; call-graph nodes and indirect reachability unchanged.
- prisma `packages/client/src` (439 files): property_access 14,708 → 3,041;
  total references 115,905 → 78,973; wall clock 11.0s → 6.9s; entry points
  80 → 79; call-graph nodes and indirect reachability unchanged.

The JSON index fixtures were regenerated (the generator's stale import was
repaired) and the diff reviewed: reference volume shrinks, no fabricated
edges, `callable_value` rows appear only where value-position shapes exist.

## Volume (AC #6)

Measured on prisma (2,798 `.ts`/`.js` files, fresh load, no cache), before and
after this branch:

| | before | after |
| --- | --- | --- |
| references | 590,105 | 433,150 |
| `property_access` references | 72,720 | 21,205 |
| wall clock | 76.2s | 65.7s |

Widening the read to any receiver shape adds member reads that never existed;
deleting the optional-chain and static/instance duplicates, and refusing to
mint a read at a write position, removes far more.

## Re-triage (AC #7)

- `debugNode.context`, `bankElem.attributes`, `debugElement.properties` —
  identifier-receiver reads that already minted their reference before this
  task; the residual failure is the receiver's type. Re-routed to
  `receiver_type_inference`.
- The two typeorm tagged-template rows — the read reaches resolution (the
  grammar models a tagged template as a `call_expression`, pinned by test);
  the failure is the `DataSource`/`QueryRunner` receiver type obtained in test
  setup. Re-routed to `receiver_type_inference`, or `coverage_config` where
  the test tree is unindexed.
- `test/req.query.js:102` — express installs the getter through
  `defineGetter(req, 'query', function query() { ... })`; covered by
  TASK-374.3's callable-value capture, asserted there.

<!-- SECTION:NOTES:END -->
