---
id: TASK-350.1.4
title: "[method_lookup] Interim classifier mitigation for method_lookup false-positives"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-350.1
priority: medium
ordinal: 4000
plan_dedup_key: fa84899e44cccb424c78a8631c284e7450a83dbbc76558cf5ded618d6a1bdb51
plan_source_task: pt-65d46e6a03614db3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Interim mitigation

While the three core member-lookup fixes land, propose a classifier rule that suppresses the `method_not_on_type` / namespace-export false-positives in triage so they stop surfacing as unreachable entry points. The rule keys on the stable member-symbol identity of the confirmed false-positives (namespace-qualified exports, directly instantiated `__init__`, operator-aliased methods on resolved receivers).

This is the lower-priority interim deliverable — the durable fix is the three core resolver-path additions above. The classifier spec itself is authored by the human registry owner, not here.

## Observations

- Observed count: **6**
- Projects: `TypeScript`, `django`, `pandas`, `sqlalchemy`, `sqlx`
- Source runs: `3da582a-2026-06-22T15-54-41.005Z`, `7964e22-2026-06-18T18-10-41.763Z`, `897eeef-2026-06-22T11-45-34.787Z`, `aa0efc9-2026-06-18T18-25-42.253Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/db_functions/text/test_concat.py:23` — Direct constructor call `Concat('alias', 'goes_by')` after `from django.db.models.functions import Concat` confirms real callers exist that Ariadne did not resolve to this **init**. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/tests/gis_tests/layermap/tests.py:79` — Direct instantiation `LayerMapping(City, city_shp, city_mapping)` calls `__init__` but Ariadne did not resolve this call site to the constructor definition at layermapping.py:97. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/type_info.rs:344` — Direct `self.eq_impl(other, false)` call in the same file's impl block confirms a real caller exists that Ariadne failed to resolve. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/tsc/tsc.ts:24` — Direct invocation of executeCommandLine via `ts.*` namespace import which Ariadne fails to resolve to the definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/io/test_parquet.py:380` — Test file calls .to_parquet() on a DataFrame instance, confirming real callers exist but resolution fails to link them to the implementation at frame.py:2827. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/dialects/postgresql/provision.py:158` — Real caller assigns stmt from insert() factory then calls on_conflict_do_update on it, but resolution_count=0 because the factory return type is unknown to the resolver. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/method_lookup.ts` so the method_lookup pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.
- [ ] #3 (Lower priority) Author the interim classifier so triage routes around the false positive until the core fix lands.

<!-- AC:END -->
