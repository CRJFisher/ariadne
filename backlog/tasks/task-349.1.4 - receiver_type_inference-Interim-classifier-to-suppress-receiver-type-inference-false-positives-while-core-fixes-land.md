---
id: TASK-349.1.4
title: "[receiver_type_inference] Interim classifier to suppress receiver-type-inference false-positives while core fixes land"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-349.1
priority: medium
ordinal: 4000
plan_dedup_key: 4230a27b8a6b339a953c6aaf5e90be13cafed7b7e1294d32099d3879a27e5946
plan_source_task: pt-af4f58c1a6b4d5cc
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Mitigation

Proposes an interim triage classifier that recognizes the confirmed receiver-type-inference shape — an entry-point flagged unreachable whose only textual callers are `this.<field>.method()`, constructor-flowed `self.<attr>.method()`, or JSDoc-typed-receiver calls that Ariadne left unresolved — and suppresses the false-positive until the resolver fixes above ship. This routes triage around the 35 confirmed members (39 observed, 9 projects) without waiting on the high-effort cross-method flow pass.

The classifier is the interim mitigation only; it is `is_classifier_work: true` and proposes no resolver change. Authoring the classifier predicate and the registry entry are human/loop-closure responsibilities — this node only names the work. The durable deliverables are the three core-fix leaves above.

## Observations

- Observed count: **3**
- Projects: `nest`, `pandas`, `sqlalchemy`
- Source runs: `5843d51-2026-06-18T17-43-39.783Z`, `897eeef-2026-06-22T11-45-34.787Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/core/pipes/pipes-context-creator.ts:94` — Real caller `getGlobalMetadata` calls `this.config.getGlobalPipes()` where `this.config` is typed as `ApplicationConfig`, the class that owns `getGlobalPipes`. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/arrays/categorical/test_api.py:387` — Direct call to Categorical.describe() on a variable assigned from a Categorical() constructor, which Ariadne fails to resolve to the definition at categorical.py:2731. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/dialects/oracle/oracledb.py:883` — Real caller exists at line 883 in create_server_side_cursor, calling ss_cursor on \_dbapi_connection whose type Ariadne cannot resolve through the instance attribute chain. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts` so the receiver_type_inference pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.
- [ ] #3 (Lower priority) Author the interim classifier so triage routes around the false positive until the core fix lands.

<!-- AC:END -->
