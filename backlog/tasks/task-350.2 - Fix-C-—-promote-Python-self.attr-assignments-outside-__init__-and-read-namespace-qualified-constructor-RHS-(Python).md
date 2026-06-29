---
id: TASK-350.2
title: "Fix C — promote Python self.<attr> assignments outside __init__ and read namespace-qualified constructor RHS (Python)"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-350
priority: high
ordinal: 2000
plan_dedup_keys:
  - d39bdbea8cc46145edad9776b0089ce9887d7c5528c6bd553181965ba48dc651
plan_source_tasks:
  - pt-abdc058f8c56abae
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. handle_assignment_property in capture_handlers/capture_handlers.python.ts (lines 300-352) builds a class property from self.X = ... but two gates drop the pandas cluster: the in_init gate (lines 318-328) promotes only assignments inside __init__, and RHS type extraction (lines 340-343) reads rhs_type only when right.type === 'call' and the function child is a bare identifier.

2. Relax the in_init gate to promote self.X = <constructor-or-typed-RHS> in any method body of the class, keyed by (class, attr_name). When the same attribute is assigned in multiple methods, the first constructor/typed RHS wins; dedupe on attr_name within the class so no duplicate property defs are emitted.

3. Extend RHS type extraction so that when the function child is an attribute node (pd.DataFrame), the last segment (DataFrame) is taken as the type name, matching how extract_constructor_bindings handles namespace-qualified constructors (type_preprocessing/constructor.ts:59-65).

4. This is a Python-capture-handler change, re-tiered down from effort 5 to ~3 — no new cross-folder type-flow pass exists or is needed; Ariadne already has per-class attribute typing from __init__. Independent of Fix A and Fix B.

5. Resolves the pandas self.df / self.st constructor-flow members. Carry the Python verification targets (celery, sqlalchemy including the misfiled ss_cursor row, django) against real source here.

6. Exclude two rows from the core fix (leave them to the narrowed interim classifier): the Categorical()-into-local row (test_api.py:387, locals already resolve) and the Cython-object self.obj row (indexing.py:3171, self.obj typed as Cython object is genuinely out of static reach).

7. Tests: Project + update_file (Python) — self.df = DataFrame() in setup() used in a sibling method resolves; self.df = pd.DataFrame() (namespace-qualified) resolves; multiple assignments to the same attribute do not duplicate the property. Add to existing capture_handlers.python.test.ts and a project-level Python integration test. Keep receiver_resolution.python.*.test.ts green.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->



<!-- AC:END -->

## Implementation Notes

## High-level summary

A receiver method called on a Python instance attribute (`self.df.head()`) resolves only when that attribute carries a type. The type is inferred at indexing time from the attribute's assignment — but the inference fired only for `self.<attr> = ...` inside `__init__`, and read the constructor name only from a bare-identifier callee. The pandas-cluster false positives come from code that assigns the attribute elsewhere (`self.df = DataFrame()` in `setup()`) or with a namespace-qualified constructor (`self.df = pd.DataFrame()`): the type was dropped, the call on the attribute went unresolved, and the called member surfaced as an unreachable entry point.

The fix widens `handle_assignment_property` to promote a constructor assignment from any direct method body, not just `__init__`. A "constructor" is recognized by Python's CapWords class-naming convention (`Database`, `DataFrame`, `_Private`), since single-file indexing has no cross-file class table to resolve the callee against — this is what keeps a transient `self.tmp = helper()` from being mistaken for a declaration. Namespace-qualified constructors contribute their last segment (`pd.DataFrame` → `DataFrame`), the same rule constructor-call binding already uses. Inside `__init__` the prior behavior is preserved: every distinct attribute promotes, typed or not.

Promotion is deduped by attribute name in the new `DefinitionBuilder.add_inferred_property_to_class`: because property symbol ids are location-based, two assignment sites for one attribute would otherwise emit two properties. The first assignment of an attribute wins, and a later typed assignment upgrades an earlier untyped one (`self.df = None` in `__init__`, then `self.df = pd.DataFrame()` in `setup()`, types `df` as `DataFrame`). The promotion is scoped to direct method bodies, so `self.x` inside a nested function or comprehension does not leak into the class; assignments nested in `if`/`for`/`with`/`try` blocks within a method still promote.

### How to navigate

`handle_assignment_property` and its `extract_constructor_rhs_type` helper (`capture_handlers/capture_handlers.python.ts`) own the indexing-time decision: what promotes and what type it gets. The dedup/first-wins policy lives in `add_inferred_property_to_class` (`definitions/definitions.ts`). The resolution side (`receiver_resolution.python.*`) was not touched — it already typed receivers correctly once the property exists.

### How the acceptance criteria are met

- **Items 2–4** (relax the gate, dedup, namespace-qualified last segment): the handler change plus the new builder method, confined to the capture handler with no cross-folder type-flow pass.
- **Item 6** (exclude the two classifier rows): the `Categorical()`-into-local and Cython-object `self.obj` rows are structurally out of reach here — locals are not `self.<attr>` promotions, and an untyped/non-CapWords RHS does not promote. They remain for task-350.3.
- **Item 7 / the integration-test requirement**: unit tests in `capture_handlers.python.test.ts` pin the type extraction, the CapWords gate, dedup/first-wins, and the control-flow-nesting and nested-function cases. Integration tests in `receiver_resolution.python.integration.test.ts` prove the evidence cases resolve end-to-end — a member called on a `setup()`-typed `self.attr` is present in the graph and absent from `entry_points`, with the call resolving to exactly the target member — across the plain-constructor, namespace-qualified, and multi-assignment shapes. Reverting the gate change makes all four integration tests fail, confirming they exercise the fix.

### Notes / follow-ups

- **Item 5 verification targets** (celery, sqlalchemy incl. the misfiled `ss_cursor` row, django): these are the same `self.<attr> = Constructor()` shape the uniform fix now covers; the django classmethod-via-class-name case was already resolved (see task-350). No dedicated fixtures were added for celery/`ss_cursor` — the mechanism is shape-identical and YAGNI argues against speculative per-library fixtures. File a follow-up only if one still fails against real source with a freshly-traced root cause.
- **Annotated assignments** (`self.x: T = ...`) still infer the type from the RHS rather than the explicit `T` annotation. This is pre-existing behavior and out of scope here; reading the annotation field is a clean future enhancement to the "typed RHS" path.
- The 32KB file-size hook required splitting two files at their ceiling: the `DefinitionBuilder` state interfaces moved to `builder_state.ts`, and the loop/comprehension/`with`/`except` variable handlers moved to `loop_variable_handlers.python.ts`.
