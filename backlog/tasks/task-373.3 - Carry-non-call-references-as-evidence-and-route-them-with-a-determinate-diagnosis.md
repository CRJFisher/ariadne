---
id: TASK-373.3
title: "Carry non-call references as evidence and route them with a determinate diagnosis"
status: In Progress
assignee: []
created_date: "2026-07-29 09:36"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-373
priority: high
ordinal: 3000
plan_dedup_keys:
  - 2ed8966f3baca7fa35b1f33ae88deec6e2855c15b15e5323e4b2c3eb3ebc0cad
plan_source_tasks:
  - pt-48e76b6e05171665
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The evidence record has one channel and it is text, so a caller that carries no call-paren syntax is structurally invisible: getter reads, bare-name callback registrations, dict and list registration values, iteration protocol. Two live builtin classifiers are unfirable for exactly this reason — `check_callback-passed-to-invoker.ts` and `check_dispatch-table-value-registration.ts` both scan `diagnostics.grep_call_sites` for surface forms that by construction carry no `name(` (`maybe_call(self.on_node_status, …)`, `handlers = {'*': dumper.on_event}`). Reproduced: a Python file containing exactly `registry.register(s.deserialize)` and `{'*': dumper.on_event}` yields `grep_call_sites.length === 0` for both members, so neither check can ever see its own registry examples on the live pipeline.

The data already exists. `Project.references` (`resolve_references/registries/reference.ts`) retains every raw `SymbolReference` per file, including the `property_access` and `variable_reference` reads those forms produce. Indexing it is strictly better than a second regex: structured (kind, access type, receiver form), language-agnostic, collision-safe (keyed on the reference's own resolved name, not on text) and requiring no new parsing pass.

## Work plan

1. **Build the reference index** in `packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts`: `build_reference_index(project.references, indexed_files)` — one pass over `project.references.get_file_references(file)` for every indexed file, keyed by the reference's name, mirroring `build_call_refs_by_name` (`:255-273`). Take the final dotted segment of `ref.name` (the indexer records composite names such as `this.value` and whole-expression text) and admit a key only when that segment matches `/^[A-Za-z_$][\w$]*$/`, which drops the expression-text noise. Skip references at the entry's own definition location (the rule `grep_for_calls` applies at `:441`) and references at a position that already produced a `CallReference` — those are `ariadne_call_refs`. Cap per name at `MAX_GREP_HITS`. The identifier filter and the cap are load-bearing for memory: a single `return this.value;` produces several `variable_reference` records including whole-expression text.
2. **Attach the field.** `gather_diagnostics` (`:367-416`) populates `reference_sites` and initialises `grep_call_sites_outside_index: []`. The single-pass invariant documented at `:9-24` is preserved and extended: one pass over an in-memory registry, no re-parse, no I/O.
3. **Finish `compute_diagnosis`** (`:512-545`) over the completed evidence: indexed grep hits exist → the three existing registry branches, unchanged; no indexed hits but out-of-index hits → `callers-outside-indexed-corpus` (sub-task 1.2); no grep hits at all but `reference_sites` non-empty → `references-without-call-syntax`; otherwise `no-textual-callers`, whose literal meaning is now restored — nothing anywhere in the discovered corpus mentions this callable.
4. **Map the route.** In `packages/types/src/ariadne_fault_area.ts`, `references-without-call-syntax` → `{ area: "entry_point_classification", needs_judgement: false }`: a determinate statement that the only mentions are non-call references, which is exactly the classifier-author surface. `no-textual-callers` keeps `needs_judgement: true`, but its population collapses to members with no mention anywhere in the discovered corpus.
5. **Sweep the consumers the exhaustive `Record` shapes turn into compile errors**: `packages/skill-protocol/src/triage_results.ts:71,98` and `.claude/skills/triage/src/finalize/output.ts:88-117` drop `callers_only_in_unindexed_tests` from the published diagnostics slice; `.claude/skills/plan/src/group/group_fault_areas.ts:54` and `.claude/skills/plan/src/store/plan_task.ts:113` drop the mirrored field and the `derive_fault_area` call site loses one argument; `.claude/skills/triage/scripts/detect_entrypoints.ts:483-496` calls the renamed pass, stops passing `combined_patterns` and stops gating it on `!options.include_tests`; `.claude/skills/triage/reference/diagnosis_routes.md:18-25` documents the two new diagnoses and their investigation hints.
6. **Re-validate `builtins/check_dynamic-require-constructor.ts:17`**, which asserts `diagnosis === "no-textual-callers"` — some of its members now carry `references-without-call-syntax`.
7. **Re-point the two unfirable classifiers.** `check_callback-passed-to-invoker.ts` and `check_dispatch-table-value-registration.ts` read `diagnostics.reference_sites` instead of `diagnostics.grep_call_sites`. This is a behaviour fix for rules that cannot fire today and must go through the registry lifecycle (`reconcile_registry.ts --stage`) because their samples must be re-validated — the human-owned half of this step follows the code change, and the `Object.defineProperty`-accessor and iteration-protocol residue opens as a classifier-author route.
8. **Add integration tests covering every evidence case this axis owns**, driven through the real pipeline rather than hand-built diagnostics: (a) `registry.register(s.deserialize)` and `{'*': dumper.on_event}` populate `reference_sites` with `reference_kind: "property_access"` and produce `diagnosis: "references-without-call-syntax"`; (b) `check_callback_passed_to_invoker` and `check_dispatch_table_value_registration` fire against `EnrichedEntryPoint`s produced by the real pipeline — `check_callback-passed-to-invoker.test.ts:52-58` builds `grep_call_sites` by hand today, which is why the unfirability went unnoticed, so rewrite it; (c) the express `Object.defineProperty`/`defineGetter` accessor shape behind `ip`, `ips`, `secure`, `subdomains`, `stale`, `hostname`, `host` and `protocol` (8 rows) yields `references-without-call-syntax` rather than `no-textual-callers`; (d) the module-object and instance-member reference shapes behind express `user.load`/`user.view`/`user.update`, celery `s.deserialize` and `consumer._limit_post_eta`, and django `adapt_unknown_value` yield `references-without-call-syntax` and route without judgement; (e) a negative control — `return this.value` does not flood `reference_sites` with whole-expression records, and a resolved call site never appears in `reference_sites` because it is already an `ariadne_call_ref`.
9. **Do not claim the rows this evidence merely exposes.** Accessor reads through `this`/`self` (Angular `selectedValueAccessor` x2, nest `localInstance`, express `this.router`/`this.host`/`this.protocol`, webpack `orderedExports`) need the JS/TS property-access pattern widened from `object: (identifier)` to `object: (_)` (`typescript.scm:666-670`, `javascript.scm:455-459`) and the Python `accessor_kind` populated in `capture_handlers.python.ts` — both owned by the `syntactic_extraction` epic. Protocol and computed dispatch (webpack `[Symbol.iterator]`, sqlalchemy's attrgetter over `"visit_" + __visit_name__`, sqlx `(*driver.connect)(…)`) are permanent limitations. Angular `providerTokens` and `queryAllNodes` are double-counted across two leaves and remain unexplained — both resolve in an isolated repro with a typed receiver, so a targeted repro against the checked-out `angular--angular` tree is required before either is claimed here.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `reference_sites` is populated from a single pass over `Project.references` for every indexed file, keyed on the final dotted segment of `ref.name`, filtered to `/^[A-Za-z_$][\w$]*$/`, capped at `MAX_GREP_HITS` per name, excluding the entry's own definition location and any position that already produced a `CallReference`.
- [x] #2 `compute_diagnosis` returns `references-without-call-syntax` when there are no grep hits on either axis but `reference_sites` is non-empty, and `no-textual-callers` only when nothing in the discovered corpus mentions the callable.
- [ ] #3 `derive_fault_area` maps `references-without-call-syntax` to `{ area: "entry_point_classification", needs_judgement: false }`. **Deliberately not met** — the area is mapped, but `needs_judgement` stays `true` until reference sites carry symbol identity; see Implementation Notes.
- [ ] #4 Integration tests against the real pipeline cover every evidence case: `registry.register(s.deserialize)` and `{'*': dumper.on_event}` (celery), the express `defineProperty` accessors `ip`, `ips`, `secure`, `subdomains`, `stale`, `hostname`, `host`, `protocol`, and the module-object/instance-member references express `user.load`/`user.view`/`user.update`, celery `consumer._limit_post_eta` and django `adapt_unknown_value`.
- [x] #5 `check_callback_passed_to_invoker` and `check_dispatch_table_value_registration` read `reference_sites` and fire against `EnrichedEntryPoint`s produced by the real pipeline; `check_callback-passed-to-invoker.test.ts:52-58` no longer hand-builds `grep_call_sites`.
- [x] #6 Negative control: `return this.value;` does not flood `reference_sites` with whole-expression records, and a resolved call site appears only in `ariadne_call_refs`.
- [x] #7 `callers_only_in_unindexed_tests` is gone from `skill-protocol`, `triage/finalize/output.ts`, `plan/group_fault_areas.ts` and `plan/plan_task.ts`; `detect_entrypoints.ts` calls the renamed pass without `combined_patterns` and without the `include_tests` gate; `diagnosis_routes.md` documents both new diagnoses.
- [ ] #8 `check_dynamic-require-constructor` is re-validated against its samples under the new diagnosis population, and the two re-pointed classifiers are re-staged through `reconcile_registry.ts --stage`.

<!-- AC:END -->

## Implementation Notes

### What a user gets

A caller that carries no call parens is no longer invisible. A getter read, a callback handed to an invoker, a dict or list registration value — each now arrives as a `reference_site`, and a member whose only mentions are of that kind reports `references-without-call-syntax`, routing to `entry_point_classification` with the evidence attached and rendered in the investigator's prompt.

The route carries `needs_judgement: true`. The *area* is determinate — non-call mentions are the classifier-author surface — but the index keys on a name's final segment rather than a resolved symbol, so whether a given site reaches *this* member is not yet decidable. Claiming otherwise was the epic's worst regression, caught in final review: on django, 242 of 532 such entries (45%) had evidence that was only a bare same-named local — a method `errors` "reached" by `errors = []`, a property `urls` by an import line — every one of them routed `needs_judgement: false`. That is strictly worse than the honest vagueness it replaced.

Three filters cut it back, each exact rather than heuristic:

- **A method or constructor is unreachable through a bare name.** Those sites now require a `property_access` — the part of identity the index *can* check.
- **A write is not a caller**, nor is the read the indexer records beside the write at the same position. `querystring = QueryDict(...)` no longer reaches a function named `querystring`.
- **Declaration lines are filtered before the per-name cap**, not after. A widely-overridden method has more declarations than the cap allows, so filtering afterwards spent the whole budget on `def render` lines and discarded the one genuine registration site indexed behind them.

The two classifiers that could never fire now can. `check_callback-passed-to-invoker` and `check_dispatch-table-value-registration` both scanned `grep_call_sites` for surface forms (`maybe_call(self.on_node_status, …)`, `handlers = {'*': dumper.on_event}`) that by construction carry no `name(`, so neither could match its own registry samples. Both read `reference_sites` now, and a test drives them through the real pipeline rather than hand-building the evidence — which is why the unfirability went unnoticed.

### The evidence is structured, not a second regex

The index is one pass over `Project.references`, which the indexer already filled. Keyed on the reference's own resolved name, so it is collision-safe; language-agnostic, so it needs no per-language surface patterns; and free, since it needs no new parse.

Three filters make it usable rather than a flood:

- **Identifier keys only.** The indexer records composite names — `this.value`, whole-expression text — so a key is admitted only when its final dotted segment is a bare identifier.
- **One site per (file, line).** The registry records the same mention several times over: `s.deserialize` arrives as a `property_access` and a `variable_reference`, each repeated. Without deduplication a single line reported as five callers. The property access wins, because it carries the receiver.
- **A mention that IS a call is skipped**, keyed on the call's own name. That keeps the callback in `registry.register(s.deserialize)` — `register` is the call, so `deserialize` survives — while dropping the `p.shrink` in `p.shrink(1)`, which already arrives as an `ariadne_call_ref`.

Declaration lines are excluded by the same rule the grep channel uses, extended to class headers: `class Reporter {` declares `Reporter`, it does not mention it. A constructor's references are keyed by class name, matching the name the grep channel searches for.

### Handed to the human: two registry lifecycle steps

Neither is mine to make — the registry is human-owned, and `reconcile_registry.ts` is the only sanctioned path.

1. **The two re-pointed classifiers must be re-staged.** Their behaviour changed, so their samples need re-validating:

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts --stage <draft> --dry-run
   ```

2. **`check_dynamic-require-constructor` no longer matches its own shape.** It is auto-generated from the registry and asserts `diagnosis === "no-textual-callers"`. Reproduced minimally: a JS class whose constructor has no textual callers, exported as `module.exports = Reporter`, now carries `references-without-call-syntax` — because that export IS a non-call reference, honestly recorded. The rule needs its diagnosis predicate widened to accept both, or re-authoring against `reference_sites`. Rendering that change means editing `registry.json`, which only the human may do.

### Rows this sub-task does not claim

Accessor reads through `this`/`self` (Angular `selectedValueAccessor`, nest `localInstance`, express `this.router`) need the JS/TS property-access pattern widened from `object: (identifier)` to `object: (_)` and the Python `accessor_kind` populated — both owned by the `syntactic_extraction` epic. Protocol and computed dispatch (webpack `[Symbol.iterator]`, sqlalchemy's attrgetter over `"visit_" + __visit_name__`, sqlx `(*driver.connect)(…)`) are permanent limitations. Angular `providerTokens` and `queryAllNodes` remain unexplained and need a targeted repro against the checked-out tree before anyone claims them.
