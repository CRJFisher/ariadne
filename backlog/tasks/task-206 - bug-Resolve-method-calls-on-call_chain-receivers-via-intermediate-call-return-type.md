---
id: TASK-206
title: >-
  [bug] Resolve method calls on call_chain receivers via intermediate call
  return type
status: To Do
assignee: []
created_date: '2026-04-28 09:37'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-receiver_resolution
  - method-chain-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `receiver_resolution`
**Target registry entry:** `method-chain-dispatch`
**Observed count:** 107

When a call expression is `<call>(...).<method>(...)`, Ariadne loses the receiver type at the call_chain hop even when the inner call has an explicit return-type annotation. Distinct from TASK-205 (typed-field hop), TASK-184 (Python factories without annotations), TASK-187 (inline constructor).

Concrete TypeORM evidence: `BaseEntity.ts:551` (`getRepository().X()`), `DataSource.ts:452-455`, plus several similar typeorm and prisma cases.

## Acceptance criteria
- [ ] Ariadne resolves `<call>().method()` chains using the return-type annotation of the inner call
- [ ] Regression test reproducing the typeorm corpus pattern lands and passes
- [ ] Self-repair pipeline re-run on typeorm/prisma no longer surfaces this group at scale

Source: triage-curator sweep (top-impact, observed_count=107).
<!-- SECTION:DESCRIPTION:END -->
