---
id: TASK-349.1.3
title: "[receiver_type_inference] Propagate constructor and annotated types to instance attributes across method boundaries"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-349.1
priority: high
ordinal: 3000
plan_dedup_key: d39bdbea8cc46145edad9776b0089ce9887d7c5528c6bd553181965ba48dc651
plan_source_task: pt-abdc058f8c56abae
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Members

All pandas members: `self.df = pd.DataFrame(...)` / `pd.Series(...)` / `HDFStore(...)` / `Styler` assigned in `setup()` and methods called in another method (`corrwith`, `diff`, `query`, `cov`, `first_valid_index`, `last_valid_index`, `to_hdf`, `info`, `hide`), plus the fixture-injected `Styler._repr_html_` and the Cython-`object`-typed `self.obj._set_value`, and the `Categorical()` constructor-into-local case.

## Fix

Constructor binding (`type_preprocessing/constructor.ts`) maps a _constructor-call location_ to a type, so `x = DataFrame(...); x.method()` works only when both are in the same flow. The pandas pattern stores the constructed value on `self.<attr>` in one method and reads it in another, so the receiver type is dropped at the attribute-store boundary. The fix is to propagate a known type from a constructor/annotated RHS onto the instance attribute it is assigned to, keyed by `(class, attribute_name)`, so a later `self.<attr>.method()` in a sibling method resolves the attribute to the same type. This extends the constructor/binding feeders and the identifier-base resolution in `receiver_resolution.ts` to consult per-class attribute types. The fixture-injected and untyped-`object` cases (evidence 21, 15) are out of reach of pure static flow and are deliberately left to the interim classifier rather than over-fitting the resolver.

## Observations

- Observed count: **9**
- Projects: `pandas`
- Source runs: `897eeef-2026-06-22T11-45-34.787Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/eval.py:56` — Real caller exists: `self.df.query(...)` is called three times, with `self.df` assigned from `pd.DataFrame(...)` constructor, but Ariadne cannot resolve the instance attribute's type to link the call to `DataFrame.query`. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_methods.py:452` — Real caller exists: self.df is a DataFrame instance (assigned from constructor) and first_valid_index() is called on it, but Ariadne cannot carry the constructor's return type to resolve to the NDFrame base-class definition. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_methods.py:865` — Real caller exists calling last_valid_index() on self.df (a DataFrame instance attribute), but resolution_count=0 because Ariadne cannot infer the type of self.df across the setup/time_last_valid_index method boundary. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/io/hdf.py:126` — Real caller assigns self.df from DataFrame constructor and calls to_hdf on it, but Ariadne fails to propagate the constructor's return type to the instance attribute. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/io/style.py:86` — Real caller exists: self.st.hide() is called on a Styler instance attribute but resolution_count=0 because Ariadne cannot trace the type of self.st assigned from a property access. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/stat_ops.py:165` — Real call to Series.cov on a pd.Series instance; Ariadne fails to link this because receiver type is lost after module-qualified constructor assignment. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/core/indexing.py:3171` — Real caller in \_ScalarAccessIndexer.**setitem**; self.obj is typed as Cython `object` (no annotation), preventing method dispatch resolution. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/arrays/categorical/test_api.py:387` — Direct call to Categorical.describe() on a variable assigned from a Categorical() constructor, which Ariadne fails to resolve to the definition at categorical.py:2731. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/extension/base/methods.py:594` — df is explicitly assigned from pd.DataFrame(...) at line 593, then df.diff(periods) is called at line 594, but this call is not resolved to DataFrame.diff because Ariadne cannot track the return type of the pd.DataFrame constructor. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts` so the receiver_type_inference pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
