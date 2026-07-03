---
id: TASK-190.22.10
title: Wire the plan engine to write PlanTask rows and reconcile within the task-DB
status: Done
assignee: []
created_date: '2026-06-01 15:19'
updated_date: '2026-06-10 08:51'
labels:
  - self-repair
  - plan-skill
  - engine
dependencies:
  - TASK-190.22.8
  - TASK-190.22.3
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The plan engine's output target is the task-DB, not `backlog/`. This is the change to TASK-190.22.9's core: emit `PlanTask` rows via `JsonPlanTaskRepository` (190.22.8) and reconcile within the DB — replacing the old "emit via mcp\_\_backlog / reconcile against backlog/tasks" behavior.

## Scope

- The group→strategize→hierarchical-plan output writes `PlanTask` rows (one per node in the size-tiered tree: architectural → fault-area → localized) via `repository.put_many`, with a `PlanSweepEvent` log per sweep.
- **Reconcile within the task-DB:** for each new proposal compute its `dedup_key` (fault_area + sorted evidence file:line set) and `find_by_dedup_key`; if it collides with a live (`proposed`/`accepted`) task, AUGMENT it (merge evidence, bump rollups) rather than create a duplicate; supersede/combine via the strategist's judgement, recording the decision as a `PlanSweepEvent`. Reconciliation correctness depends only on the DB.
- **Read-only backlog dedup (optional):** the engine MAY `mcp__backlog__task_search` / parse `backlog/tasks/` frontmatter read-only to detect work the user already promoted (mark the DB task `exported`, suppress re-proposal) — never writing backlog.
- **Narrow the `plan-strategist` backlog grant:** `.claude/agents/plan-strategist.md` carries a leftover whole-server `mcpServers: - backlog` grant (admitting every mutator to a 200-turn autonomous agent) from the pre-restructure curator. As part of rewriting the strategist to planning-only, replace it with the specific read-only tools it needs (`mcp__backlog__task_search`, `mcp__backlog__task_view`). This is the agent-grant vector the 190.22.7 firewall rule-doc flags but its `.ts`-only AST test cannot reach.
- Grouping keys on `AriadneFaultArea` via `derive_fault_area` (190.22.3).

## Verification

A sweep over ≥2 finalized runs writes `PlanTask` rows + a sweep log under `~/.ariadne/plan/`, makes ZERO writes to `backlog/`, `registry.json`, or `packages/core`, and a second sweep over the same runs augments existing tasks (no duplicates) rather than re-creating them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The engine writes the hierarchical plan as `PlanTask` rows (architectural→fault-area→localized) via `PlanTaskRepository.put_many` + a per-sweep `PlanSweepEvent` log; ZERO writes to `backlog/`/`registry.json`/`packages/core`
- [x] #2 Reconciliation is computed within the task-DB via `dedup_key`/`find_by_dedup_key`: a re-sweep over the same runs augments existing tasks (merges evidence, bumps rollups) instead of duplicating
- [x] #3 supersede/combine decisions are recorded as `PlanSweepEvent`s; the DB is the authoritative reconciliation surface
- [x] #4 Any backlog access is read-only (dedup signal only) and passes the 190.22.7 firewall test
- [x] #5 Grouping keys on `AriadneFaultArea` via `derive_fault_area` (190.22.3); smoke test over ≥2 runs green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

The plan engine's reconcile pass (Pass C) is the authoritative reconciliation surface for the firewalled task-DB. Building on the create/augment loop from TASK-190.22.9, it now closes the full lifecycle: it retires stale orphans into `superseded`/`combined`/`resolved` records, and reads the user's `backlog/` (read-only) to recognise already-promoted work and stop re-proposing it. The whole pass is deterministic and DB-authoritative — grouping keys on `AriadneFaultArea`, reconciling on the immutable `dedup_key`, and never writing `backlog/`, `registry.json`, or `packages/core`.

## What the reconcile pass does

Per sweep, the reconciler runs three ordered steps against the live DB and appends one `PlanSweepEvent` per decision to `sweeps/<sweep_id>.jsonl`:

1. **create / augment** — a candidate whose `dedup_key` already names a live task augments it (evidence merged, rollups bumped) and **adopts the latest tree's structural pointers** (remapped `parent_id`, unioned `child_ids`); otherwise it is created. Pointer adoption is what keeps a re-keyed ancestor orphaning *childless*, so the next step never dangles a live pointer.
2. **retire orphans** — a live task no candidate claimed, whose grounding projects were ALL scanned this sweep, is stale. If a fresh create in the same `(fault_area, tier)` shares an evidence `file:line`, the orphan was re-keyed into it → **supersede** (one) / **combine** (several → one, as supersede-fan-in); if nothing overlaps, its false-positives stopped recurring → **resolve**. Supersede/combine is a pure pointer flip — the live replacement keeps its own honest evidence and `dedup_key`; the retired record keeps its vanished locations.
3. **export dedup** — the reconciler reads `backlog/tasks/*.md` frontmatter (read-only, `src/store/backlog_dedup.ts`) keyed on `plan_dedup_key`, and marks a matching DB task `exported`, suppressing re-proposal idempotently.

## Key design decisions

- **`resolved`, not `abandoned`.** Because a sweep processes only new (uncurated) runs, evidence vanishing means a newer run of the project no longer flags that `file:line` — the bug appears *fixed*. This is named `resolved` (a new `PlanTaskStatus` + `resolve` `PlanSweepEvent`) and is kept strictly distinct from a strategist/human *feasibility* judgement that work is intractable, which is `abandoned` — spun off to TASK-190.22.13.
- **Scope `resolved` by a scan manifest.** Pass A (`group_runs.ts`) stages `staging/<sweep>/manifest.json` recording the projects + run_ids it actually verified (parsed runs, including zero-FP ones, excluding parse-failed). Pass C resolves an orphan only when its `projects[]` ⊆ that set, so a partial-scope sweep (`--project`, `--last`) or an unreadable run never falsely resolves a task.
- **Structured backlog link.** The dedup signal is a `plan_dedup_key` frontmatter field carrying the source `PlanTask.dedup_key` verbatim — an exact, stable link the export adapter (TASK-190.22.11) stamps, not a fuzzy text scan. Suppression matches on `(dedup_key, tier)` and remaps a suppressed candidate to the real exported task's id, so promoting a non-leaf node never dangles a child pointer.
- **Firewall-clean read.** The backlog reader uses `readdir`/`readFile` only — no write primitive, no `mcp__backlog__*` tool — so it passes the 190.22.7 AST firewall with no allowlist entry, and the `plan-strategist` grant stays dropped (`mcp_servers: []`).

## Acceptance criteria

AC #1, #2, #5 (PlanTask rows + sweep log, `dedup_key` augment-not-duplicate, `AriadneFaultArea` grouping + firewall smoke test) were delivered by TASK-190.22.9 and are preserved. This task completes **AC #3** (supersede/combine recorded as `PlanSweepEvent`s, plus the `resolved` GC the original note called for) and **AC #4** (read-only backlog dedup, firewall-test-green). The `file:line` reconciliation primitive is centralised as `location_token` so every reconciliation site agrees byte-for-byte.

## Note on AC #4 (firewall reference)

AC #4 references "the 190.22.7 firewall test". That test (`backlog_writers.test.ts`) was retired in commit c5c2ccd7. The substance of AC #4 — read-only backlog access — is preserved; it is now convention documented in `.claude/skills/plan/SKILL.md` and `.claude/skills/prioritize/SKILL.md` rather than enforced by an AST test.
<!-- SECTION:NOTES:END -->
