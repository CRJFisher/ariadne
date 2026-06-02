---
id: DRAFT-6
title: >-
  Deferred — task-DB SQLite + vector/hybrid-search upgrade (behind
  PlanTaskRepository)
status: Draft
assignee: []
created_date: '2026-06-01 15:20'
labels:
  - self-repair
  - deferred
  - task-db
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: 190.22.9
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why deferred (YAGNI until measured)

The JSON one-file-per-task store (190.22.8) satisfies the `plan` engine's queries (by fault-area/status/hierarchy/dedup_key) at the real corpus size (dozens–hundreds of tasks) in milliseconds. SQLite and vector/hybrid search are genuine follow-ons, NOT now — and they are drop-in because everything goes through the `PlanTaskRepository` interface (190.22.4). This draft records the thresholds so the upgrade is a deliberate, measured decision.

## SQLite — earns its place when

The corpus reaches low-thousands of `PlanTask` rows AND queries need relational joins (plans ↔ evidence ↔ runs), ordered pagination, or many interactive multi-field filters per session that a full directory scan no longer answers cheaply. Implementation = a `SqlitePlanTaskRepository implements PlanTaskRepository` swapped in behind the interface; callers unchanged.

## Vector / hybrid search — earns its place when

Dedup/reconciliation needs SEMANTIC similarity over free-text (`title`/`body`/`why`) because the deterministic `dedup_key` (fault_area + evidence file:line set) + lexical match demonstrably miss real duplicates at scale. Note the architecture was deliberately built to avoid this: exact-overlap dedup is deterministic, and cross-fault merging is the LLM strategist's job — so vector search is purely a candidate-retrieval accelerator. Adds one method to the interface (`find_similar(text, k)`); no change to create/update/hierarchy semantics.

## Trigger

Promote only when JSON-scan latency or lexical-dedup recall is a MEASURED problem on real run data — not before.
<!-- SECTION:DESCRIPTION:END -->
