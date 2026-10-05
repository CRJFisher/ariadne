---
id: DRAFT-6
title: Deferred — data-driven fault-location taxonomy for triage verdicts
status: Draft
assignee: []
created_date: '2026-06-01 14:08'
labels:
  - self-repair
  - deferred
  - schema
  - plan-skill
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: '190.22'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why deferred (data-driven, not speculative)

The `plan` skill groups false-positives by "which part of Ariadne is at fault". Phase 1/2 give it the *deterministic* fault signal already emitted by core (`diagnosis` enum + `resolution_failure.reason` / `receiver_kind`, carried through finalize into the published verdict) — that is real data and enough to bucket on. A *richer, hand-designed* fault-area taxonomy (a closed enum mapping each fault to a specific Ariadne subsystem/folder) is tempting but premature: the pipeline has never run end-to-end, so designing a closed enum now means inventing buckets with zero real fault distribution — and a bad taxonomy is worse than free text. Design it once we have real `fp-novel` data.

## What this captures (the design input)

A folder-anchored `AriadneFaultArea` taxonomy refining the existing 6-value `AriadneRootCauseCategory` (`packages/types/src/ariadne_root_cause.ts`), e.g. splitting `cross_file_flow` into `type_inference` + `dispatch_modeling`, and naming the real upstream areas (`scope_construction`, `name_resolution`, `entry_point_classification`), each mapped 1:1 to a `packages/core/src/**` folder (`index_single_file/`, `resolve_references/{name_resolution,import_resolution,call_resolution,type_preprocessing}/`, `classify_entry_points/`, `project/`). Likely shape: a small `AriadneFaultLocation { area, resolution_stage?, resolution_reason?, language? }` object pairing the stable enum with the deterministic stage/reason, plus an `area → folder` map encoded in code. Placement: `@ariadnejs/types` (next to its deterministic peers), NOT a new package.

## Decide from data

- Whether `area` should be a branded enum vs a soft validated string hint (folder names drift as core is refactored — a hard enum couples the contract to core's IA).
- Who assigns it: deterministic default function (`stage+reason → area`) with LLM override, vs pure LLM.
- Owned by the `plan` skill: the strategist can author the first taxonomy proposal from observed run data, then it's promoted into the shared type.

## Trigger

Promote to a real task once ≥1 real `triage` run on an external repo has produced a real distribution of `fp-novel` verdicts to ground the buckets.
<!-- SECTION:DESCRIPTION:END -->
