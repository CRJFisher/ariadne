---
id: TASK-385
title: "Measure what the module-surface epic moved by re-running triage"
status: To Do
assignee: []
created_date: "2026-08-12 12:40"
labels:
  - entry_point_classification
dependencies:
  - TASK-375
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

TASK-375 and its seven sub-tasks exist to stop a name that a module publishes wholesale from
looking uncalled. Every acceptance criterion in that family is discharged against a fixture
reproducing one corpus shape. None is discharged against the corpora the evidence came from, so
the number the epic exists to move — how many false entry points it removes across
microsoft/TypeScript, sqlx, django, webpack and mocha — is unknown.

TASK-375.1 acceptance criterion #9 asks for exactly this and was not performed: a triage re-run
over the four affected JS/TS/Python projects, recording the per-row bucket movement of the 39
qualified-callee rows.

## Why this matters beyond bookkeeping

Fixture reproductions prove a shape resolves. They cannot show that the shape is the one the
corpus actually contains, and two rows in this family have already turned out to be a different
shape than the plan recorded — the sqlx rows are cross-crate rather than intra-crate, and the
loop-head row moves bucket rather than clearing. A re-run is the only thing that distinguishes
"the epic closed its criteria" from "the epic moved the number".

Rows that land in `type_inference` / `receiver_type_unknown` belong to `type-model-completion`
and should be re-routed there rather than left open against this family. The `for (const p of ps)
{ p.close() }` row is already known to be one of them.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Triage is re-run on the projects the TASK-375 family names, against the merged branch.
- [ ] #2 Per-row bucket movement is recorded for the 39 qualified-callee rows TASK-375.1 lists.
- [ ] #3 The count of false entry points removed across the family is stated as a measured number.
- [ ] #4 Rows landing in `type_inference` / `receiver_type_unknown` are re-routed to `type-model-completion` with the reason recorded.
- [ ] #5 Rows that did not move are re-triaged into a fault area rather than left attributed to this family.

<!-- AC:END -->
