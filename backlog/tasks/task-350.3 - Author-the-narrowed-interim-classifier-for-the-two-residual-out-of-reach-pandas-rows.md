---
id: TASK-350.3
title: "Author the narrowed interim classifier for the two residual out-of-reach pandas rows"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-350
priority: medium
ordinal: 3000
plan_dedup_keys:
  - 4230a27b8a6b339a953c6aaf5e90be13cafed7b7e1294d32099d3879a27e5946
plan_source_tasks:
  - pt-af4f58c1a6b4d5cc
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. Retire most of the interim-classifier scope: with Fixes A–C landed and the existing builtin classify_entry_points/builtins/check_receiver-type-unknown.ts (covering the JS identifier-receiver shape), the 30+ members the core fixes resolve no longer need a classifier.

2. Author the interim classifier only for the two genuinely-out-of-static-reach pandas rows: the fixture-injected Styler _repr_html_ row, and the Cython-object self.obj \_set_value row (indexing.py:3171).

3. Do not classify any member resolved by Fixes A–C. Sequence this last (after the three feeder fixes and the Python verification re-run), per the plan's ordering.

4. This is the only residual false-positive surface; scope the classifier narrowly to those two receivers so it does not mask the now-resolved clusters.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->

## Implementation Notes

## High-level summary

The interim classifier is a single hand-authored builtin, `check_untyped_attribute_receiver`, registered as a `wip` rule (`untyped-attribute-receiver`) in the known-issues registry and wired into the `BUILTIN_CHECKS` barrel. It suppresses the residual receiver-type false positive where a Python method is reachable only as `self.<attr>.<method>()` on an instance attribute that never gains a type — the pandas `self.obj._set_value` row at `indexing.py:3171`, where `self.obj` is a Cython `object` constructor parameter. With Fixes A–C landed there is no broad classifier to retire (work-plan item 1 is a no-op): the rule self-narrows because Fix C now types `self.<attr> = Constructor()` assignments, so typeable receivers resolve and never reach the classifier.

## What the classifier matches

The discriminator keys on the shape the resolver actually produces for an untyped self-attribute receiver. Because `self.<attr>` carries no followable type, the resolver collapses the receiver to the caller's own enclosing class, fails to find the method there, and records `resolution_failure.reason = "member_type_unknown"` with `resolved_receiver_type` pointing at that caller class. The builtin therefore matches a Python `method` entry point that has a call ref with `receiver_kind === "self_keyword"`, `resolution_count === 0`, `reason === "member_type_unknown"`, and a `resolved_receiver_type` whose SymbolId file segment equals the ref's `caller_file`. That file-equality is the load-bearing clause: it isolates the receiver-collapsed-to-self case from a typed attribute whose sub-member is unknown (where the resolved type lives in another file).

## Scope decision — only one of the two named rows is in scope

The task names two residual rows, but they are different diagnostic shapes, and only one is safely classifiable:

- **Shape S — `self.obj._set_value` (in scope).** Self-attribute receiver; produces the `self_keyword` + `member_type_unknown` + collapse signal above. Narrow and safe.
- **Shape I — fixture-injected `styler._repr_html_()` (deferred).** The receiver is a bare untyped pytest-fixture parameter, so the call ref is `receiver_kind: identifier` + `reason: receiver_type_unknown` with no `resolved_receiver_type` to collapse to. That signal is indistinguishable from the dominant untyped-local-call bucket (~8,500 `receiver_type_unknown` occurrences in the pandas corpus); a shape-based classifier for it would mask thousands of genuine entry points. Its true root cause is a separate fault area (an unindexed test-file caller, or `_repr_html_` being a framework-invoked IPython display-protocol method — a name-based concern like `py-dunder-protocol`). It is tracked as **TASK-350.4** and the registry rule's description points there.

## How the work plan is satisfied

- **Item 1 (retire most scope):** a no-op — the self-narrowing design means no broad classifier ever existed to delete; Fix C does the narrowing.
- **Item 2 (author for the named rows):** Shape S shipped; Shape I deferred to TASK-350.4 with a documented, evidence-backed justification.
- **Items 3–4 (do not classify Fix A–C members; stay narrow):** proven by the integration test's resolved side — a Fix-C-typed `self.df.count()` gains an incoming edge and never surfaces as an entry point, so it never reaches the classifier.

## Tests

`check_untyped-attribute-receiver.test.ts` is a unit near-miss matrix over synthetic `EnrichedEntryPoint`s: it pins the positive case and one negative per clause (identifier receiver, resolved-in-another-file, non-Python, non-method, resolved call, wrong reason, missing `resolved_receiver_type`, no refs), plus multi-ref `.some()` behaviour. Fixtures carry the stages the real pipeline emits (`type_inference` for `member_type_unknown`, `method_lookup` for `method_not_on_type`).

`classify_entry_points.python.integration.test.ts` runs the real index → resolve → trace → enrich → classify pipeline over inline fixtures and proves both sides of the boundary: the Fix-C-typed receiver drops `count` out of entry-point detection entirely, while the untyped `self.obj._set_value` stays flagged and is auto-classified through the real registry-rule → barrel path.

## Notes

The registry write went through `atomic_update_registry` (the rule stays `wip`; promotion to `permanent` is a separate human decision). The builtin carries an honest provenance header rather than the stale `AUTO-GENERATED` banner the sibling builtins still carry — the registry-to-builtin generator no longer exists, so all builtins are hand-authored; sweeping the stale sibling banners is a separate chore.
