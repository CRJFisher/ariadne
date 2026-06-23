---
id: TASK-351.1.5
title: "[entry_point_classification] Classify benchmark-runner convention entry points (ASV time_* methods)"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-351.1
priority: high
ordinal: 5000
plan_dedup_key: b550b5694a561436ef814bcd62b68347f660aba5513c78d099ea72ed70bcd277
plan_source_task: pt-fdd5933cb50c15fe
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

14 pandas methods under `asv_bench/benchmarks/` follow the ASV `time_*` naming convention; the ASV runner discovers and invokes them by name, so no Python call expression exists. **Core fix:** add a benchmark-convention classification predicate in `classify_entry_points` keyed on the `asv_bench/benchmarks/` path plus the `time_`/`mem_`/`peakmem_` name prefix. This is a narrow path+name predicate.

## Observations

- Observed count: **14**
- Projects: `pandas`
- Source runs: `897eeef-2026-06-22T11-45-34.787Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:110` — Method name starts with `time_` inside asv_bench/benchmarks/, matching the ASV framework convention for auto-discovered benchmark methods that are invoked by the ASV runner with no explicit call site. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:122` — Grep confirms no callers exist in the codebase; the method is discovered and invoked by the ASV benchmark runner via the `time_` prefix naming convention. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:133` — Method name prefixed with `time_` inside an ASV benchmark class (`FromRange`) in the `asv_bench/` directory — invoked by ASV runtime, never called explicitly from user code. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:141` — Method named with `time_` prefix in a class under `asv_bench/benchmarks/`, the standard ASV pattern for benchmark methods invoked by the ASV runner framework. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:149` — Method is inside the ASV benchmark class `FromScalar` with `time_` prefix, making it an ASV-framework-invoked benchmark that has no explicit Python call site. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:44` — ASV benchmark runner invokes all `time_*` methods by name convention — no Python call expression exists in the codebase for this method. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:47` — Method named time\_\* inside a benchmark class in asv_bench/benchmarks/ is invoked by the ASV benchmark runner via naming convention, not by any explicit call site in the codebase. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:50` — Method follows the ASV `time_*` naming convention within a benchmark class with a `setup` method, invoked by the ASV runner via reflection with no explicit call site in the codebase. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:53` — No callers found anywhere in the codebase; ASV discovers and calls time\_\* methods via framework reflection, not explicit call expressions. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:56` — This is an ASV benchmark method — the `time_` prefix is the ASV convention for benchmark entry points invoked by the framework runner, never called explicitly from source code. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:60` — Method lives in asv*bench/benchmarks/ and has time* prefix — the ASV framework discovers and calls all such methods dynamically; grep confirms no explicit call site exists. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:70` — Method lives in asv*bench/benchmarks/ and follows the `time*`prefix convention that ASV uses to discover and invoke benchmark methods at runtime. (project`pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_ctor.py:84` — Method on class FromDictwithTimestamp in asv*bench/benchmarks/ with `time*`prefix — ASV framework invokes all such methods by naming convention with no explicit call site in source. (project`pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/timeseries.py:112` — Method follows ASV benchmark convention (`time_` prefix on a class with `params`/`param_names`/`setup`), invoked by the ASV runner via dynamic dispatch with no explicit call site in source. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/classify_entry_points` so the entry_point_classification pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
