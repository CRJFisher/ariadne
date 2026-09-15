---
id: TASK-376.20
title: Dispatch a super call that finds the member on the parent to that member alone
status: Done
assignee: []
created_date: '2026-09-15 14:00'
labels:
  - method_lookup
dependencies:
  - TASK-376.13
parent_task_id: TASK-376
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wave 6, beside TASK-376.8, TASK-376.14 and TASK-376.15, and ahead of TASK-376.18, which pins the per-corpus counts. Requires TASK-376.13 (the `ReceiverBinding` passed to `resolve_method_on_type`).

## Root cause

`ReceiverBinding` (`call_resolution/method_lookup.ts`) states that a `super` receiver dispatches up the inheritance chain from the parent and never down to the parent's subtypes, which include the calling class. The miss branch honours it: `fans_out` requires `receiver_binding === "value"`. The class-hit branch does not read the binding. `Child.save()` calling `super().save()` where `Parent` declares `save` resolves to `[Parent.save, ...overrides]` over `Parent`'s whole subtype closure: `Child.save` gains an edge from its own body, and every sibling's `save` gains an edge from `Child.save`, so a sibling override nothing else calls is hidden as an entry point. On the miss path the same shape accounted for 2,958 of django's 3,442 candidate edges in TASK-376.13 before its guard. The hit also records `Parent` in `subtype_dispatch_files`, so every change below `Parent` re-answers the calling file.

## Work plan

1. In `resolve_method_on_type`'s class-hit branch, a `"super"` binding returns `[method_symbol]` with `subtype_closure_of: null`; a `"value"` binding keeps `[base, ...overrides]` over the closure. The constructor short-circuit ahead of it is unchanged.
2. Unit tests in `method_lookup.test.ts` beside "never fans a `super` miss out": a `super` hit on a class with overrides returns the parent member alone and names no closure; the same lookup with `"value"` still fans out.
3. Integration tests over Python and TypeScript fixtures (`super().save()` / `super.save()` in an override with a sibling override): the caller reaches `Parent.save` only, the caller's own `save` has no self-edge, and the sibling `save` stays an entry point; a Python `super().m()` whose `m` a grandparent in the project declares resolves to the grandparent member.
4. Measure with `run_load_benchmark.ts --baseline` on angular, rustc, django and pandas against the TASK-376.13 merge (`13ad2d46`), control arm in the same session. Report resolved calls, call edges and raw entry points per corpus; every entry point gained is a self or sibling override the `super` hit reached, spot-checked on django. Re-pin the recorded corpus literals the change moves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A `super` receiver whose method the parent declares or inherits resolves to that member alone and records no subtype closure; a value receiver's class-hit fan-out is unchanged.
- [x] #2 Unit and integration tests cover the parent-declared hit, the grandparent-declared hit, the absent self-edge and the sibling override remaining an entry point, in Python and TypeScript.
- [x] #3 Resolved-call, call-edge and raw-entry-point deltas on angular, rustc, django and pandas are measured against `13ad2d46` and recorded, with gained entry points spot-checked on django.
<!-- AC:END -->

## Implementation notes

- **Deviation: a `super` call runs along the method resolution order, not "the parent's member alone".** Review found the work plan's step 1 loses real edges in Python: in `class Draft(Article, Audited)` with both under `Model`, `super().save()` inside `Article` runs `Audited.save` on a `Draft`. The old fan-out over `Model`'s closure reached it by accident; returning `Model.save` alone made `Audited.save` a false entry point. `method_lookup.ts` now has `resolve_super_method(calling_class, parent, name, definitions)`: the calling class and each of its transitive subtypes is a class the call can run on; each is linearised over its class bases by C3 (interfaces take no part); each contributes the first class after the calling class that declares the member. Under single inheritance — every TypeScript and JavaScript `super` — that is the member the parent declares or inherits, which is what AC #1 states. Hit and miss are one rule, so the 376.13 miss guard is gone with it: a Python mixin whose first base lacks the member (`Series(IndexOpsMixin, NDFrame)` calling `super().isnull()`) now resolves to the base that has it.
- **`ReceiverBinding` is deleted.** `method_call.ts` routes a bare `super` receiver to `resolve_super_method` (calling class from `find_self_type`, parent from receiver resolution); `resolve_method_on_type` serves value receivers only and its miss fans out for any class or interface.
- **The lookup names the parent's closure** (AC #1 said "records no subtype closure"). The answer depends on the calling class's subtypes and on the members of siblings under the parent, and both kinds of change widen to the parent in Phase 3.5. The Python integration test loads `draft.py` last through `update_file` and removes it, and the caller is re-answered both times.
- **A `super` whose first base is an interface fans out no more.** angular's `class EventEmitter_ extends Subject<any> implements OutputRef<any>` has `Subject` outside the project, so the breadth-first chain put `OutputRef` at index 1 and `super.subscribe()` reached every `OutputRef` implementer. It now ends `method_not_on_type` (the one call angular loses).
- **Tests.** `method_lookup.test.ts`: parent-declared hit against the value fan-out, grandparent-declared hit, the sibling a subclass with several bases puts next, a first-named parent kept ahead of an unrelated later base (C3, not breadth first), and a miss that never fans down. `project.integration.test.ts` over `tests/fixtures/{python,typescript}/code/integration/super_dispatch/`, both drivers: TypeScript asserts the exact entry-point set (`Article.save`, `Comment.save`, `Invoice.validate`, `Document.render`); Python asserts the MRO targets, the dispatch index, no call edge into either caller's override, the exact entry points, and the re-answer on `draft.py`'s removal. Pinned expectations that encoded the fan-out move: `type.integration.test.ts` (dotted base), `resolve_references.python.test.ts` (dotted base) and the fixture corpus tallies in `call_resolver.test.ts` (TypeScript +4 files +4 calls, Python +6 files +4 calls).

### Measurement

`run_load_benchmark.ts --baseline` on the recorded commits and predicates. Control: a checkout of `13ad2d46`; candidate: `3249dfaa` plus this change in its own checkout; `dist` rebuilt in each; same box, same session, run in sequence. Each control row reproduces TASK-376.13's candidate row exactly. CPU is a single run per arm on a shared box and is not read as a cost.

| Corpus | Arm | Resolved | `method_not_on_type` | Call edges | Raw entry points | CPU user s |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| angular/angular `5ad82313` | control | 159441 | 5491 | 157621 | 3172 | 103.4 |
| | candidate | 159440 | 5492 | 157033 | 3184 | 106.2 |
| | delta | −1 | +1 | **−588** | **+12** | |
| rust-lang/rust `e7b59555` | control | 112264 | 19584 | 94840 | 19980 | 90.9 |
| | candidate | 112264 | 19584 | 94840 | 19980 | 88.3 |
| | delta | 0 | 0 | 0 | 0 | |
| django/django `957d0cee` | control | 85707 | 62667 | 74135 | 2261 | 318.8 |
| | candidate | 85878 | 62496 | 67102 | 2289 | 253.4 |
| | delta | **+171** | −171 | **−7033** (−7217, +184) | **+28** (+36, −8) | |
| pandas-dev/pandas `7986b425` | control | 117902 | 38910 | 85108 | 2078 | 190.1 |
| | candidate | 117951 | 38861 | 84238 | 2085 | 180.5 |
| | delta | **+49** | −49 | **−870** (−937, +67) | **+7** (+15, −8) | |

Call references and indirect-reachability keys are unchanged on every corpus.

- **Gained entry points are self or sibling overrides a `super` call reached.** Every gained entry point's control-arm callers were same-named methods, the `super` bodies: angular 12 (4 self only, 8 self and sibling); django 36 and pandas 15, all siblings. Spot-checked on django: `DistanceLookupFromFunction.as_sql` was reached only from `YearLookup.as_sql`'s `super().as_sql()`, a sibling under `Lookup`; the two outliers, `sqlite3`/`mysql` `last_executed_query`, were reached from postgresql's `super().last_executed_query()` inside a method defined under an `if` in the class body (the caller is attributed to the module).
- **Lost entry points and gained edges are the method resolution order.** django's 8 and pandas' 8 lost entry points are bases a `super` call now reaches through a first base that lacks the member: `NDFrame.isnull` from `Series.isnull`, `ExtensionArray.__contains__` from `ArrowExtensionArray.__contains__`, `View.get` and `ProcessFormView.get`, a `ListFilter.__init__` from two admin filters.
- **Python self overrides stay hidden by a separate defect.** Of the overrides that lost their self-edge and now have no incoming call edge, django 279/279 and pandas 249/249 are indirect-reachability keys, so none became an entry point; angular 12 of 13 did. The Python query captures every identifier as a variable read (`python.scm`: `(identifier) @reference.variable`), so the `save` in `super().save()` — like any `obj.save()` — is a name read that lexical resolution binds to the enclosing class's own `save`. That is `indirect_reachability.ts`'s bare-member-name rule, not method lookup; tracked below.
- **No recorded corpus literal moves.** The only pinned counts that move are the fixture corpus tallies above; `recorded_failure_taxonomy_baseline.ts` is the epic's starting row.

### Out of scope, recorded

- **Python attribute names are name reads.** The attribute of every Python member access is captured as a `variable_reference` read and resolved lexically, marking the enclosing class's same-named method indirectly reachable (528 overrides across django and pandas above). Candidate task.
- **Inherited-member edits through a file the caller does not import.** An incremental edit that moves or removes a grandparent's member, in a file the caller reaches only transitively, leaves the caller on the old symbol: changed member types widen upwards, while the dispatch is recorded under a subtype. Reproduced on the control tree for `super` and value receivers alike. Candidate task.
- **`super(Cls, self).m()`** is not recognised as a `super` receiver (`metadata_extractors.python.ts` matches the literal `super()`), in both trees.
- **C3 fallback.** An inconsistent hierarchy, which Python refuses to create, keeps its remaining classes in base order.

