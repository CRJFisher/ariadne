---
id: TASK-374.2
title: "Widen the TS/JS member read to any receiver shape and delete the duplicate member patterns"
status: To Do
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

- [ ] #1 `this.argsTypes`, `this.helper.rootFieldMap` and `context.dmmf.typeAndModelMap` each mint exactly one `property_access` reference with the exact `property_chain`, and the prisma, nest and angular getter false-positives that read through a `this`/chain receiver clear.
- [ ] #2 `getHelper().jsDoc` mints no `property_access` reference (short-chain guard in `references/references.ts`).
- [ ] #3 One member read yields exactly one `property_access` reference and one member call yields exactly one resolved edge — the optional-chain and TS static/instance duplicates are gone with no orphaned downstream consumer.
- [ ] #4 Integration tests (with updated `tests/fixtures/{typescript,javascript}/code/` fixtures) cover every evidence case: prisma `argsTypes` / `rootFieldMap` / `typeAndModelMap`, nest `instanceLinksHost` / `parentInjector`, angular `compiler`, and the typeorm tagged-template `sql` read asserted as a single `method_call` reference.
- [ ] #5 A data-field read and a plain (non-getter) method read still create no edge.
- [ ] #6 Index size and wall-clock are measured on angular and prisma before and after, and the JSON index snapshots are regenerated with the diff reviewed for fabricated edges.
- [ ] #7 The identifier-receiver accessor rows and the two typeorm tagged-template rows are re-triaged to receiver typing (or `coverage_config`) with the reason recorded.

<!-- AC:END -->
