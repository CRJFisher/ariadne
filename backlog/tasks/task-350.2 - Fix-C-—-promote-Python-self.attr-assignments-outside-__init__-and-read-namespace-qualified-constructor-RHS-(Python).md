---
id: TASK-350.2
title: "Fix C — promote Python self.<attr> assignments outside __init__ and read namespace-qualified constructor RHS (Python)"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-350
priority: high
ordinal: 2000
plan_dedup_key: d39bdbea8cc46145edad9776b0089ce9887d7c5528c6bd553181965ba48dc651
plan_source_task: pt-abdc058f8c56abae
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
