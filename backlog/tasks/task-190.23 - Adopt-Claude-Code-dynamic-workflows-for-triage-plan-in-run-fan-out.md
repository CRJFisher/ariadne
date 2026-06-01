---
id: TASK-190.23
title: Adopt Claude Code dynamic workflows for triage/plan in-run fan-out
status: To Do
assignee: []
created_date: "2026-06-01 21:44"
labels:
  - self-repair
  - architecture
  - orchestration
dependencies:
  - TASK-190.22
references:
  - "https://code.claude.com/docs/en/workflows"
  - "https://code.claude.com/docs/en/workflows#save-the-workflow-for-reuse"
documentation:
  - >-
    /Users/chuck/workspace/ariadne/.worktrees/self-healing-pipeline/self-healing-pipeline-architecture-review.md
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Both stages of the self-healing pipeline hand-roll the exact pattern that Claude Code's **dynamic workflows** feature now provides as a first-class primitive: a script that fans out subagents, holds the loop/branching/intermediate results in script variables, and can grow its own work-queue at runtime. Adopting workflows lets us **delete** machinery rather than maintain a bespoke orchestrator.

Today, after the 190.22 restructure, the orchestration is:

- **`triage` (investigation loop)** — the main skill agent runs `get_next_triage_entry.ts --count 5`, fans out `triage-investigator` agents `run_in_background`, manually tracks an `--active` in-flight set, and re-polls on each completion. Investigator verdicts are written to per-entry result files (`results/<entry_index>.json`) and absorbed back via a `merge_results()` step. The orchestration loop itself lives as a prose pseudo-algorithm in `SKILL.md`, not as code.
- **`plan` (investigation wave)** — `next_investigate_tasks.ts --limit 5` acts as a pull-and-dispatch puller; the main agent fires a wave of `triage-curator-investigator` agents, waits for the whole wave (a barrier), then pulls the next batch.

A workflow is the native form of both. The verdict-file shuffling, the `--active` bookkeeping, the wave barrier, and the prose orchestration all collapse into a readable, **resumable** script using `agent(prompt, {schema})` (structured, validated in-memory verdicts — no result files / no merge), `pipeline()` (no barrier between stages — investigators start as soon as a slot frees), and loop-until-dry / loop-until-count patterns for dynamic queue growth.

## Feature facts (research preview)

- Requires Claude Code **v2.1.154+**; available on paid plans / API / Bedrock / Vertex / Foundry. **In research preview** — treat the API as subject to churn.
- A workflow run's script can be **saved as a `/<name>` command** into `.claude/workflows/` (shared in repo) — this is the reuse path. Two saved workflows, `/triage` and `/plan`, map cleanly onto the two-stage triage→plan split.
- Concurrency: up to **16 concurrent agents** (fewer on small machines); **1,000 agents total per run** (runaway backstop). The current default of 5 concurrent investigators fits comfortably.
- Headless `claude -p` and the Agent SDK support workflows with no interactive prompts — viable for autonomous/scheduled runs.

## Hard constraints that shape the design (do not fight these)

1. **The workflow script body has NO filesystem or shell access — only agents do.** Our deterministic TS scripts (`detect_entrypoints`, `prepare_triage`, `finalize_triage`, `curate_all`, `finalize_run`, etc.) are invoked via `node --import tsx` and read/write state files. The workflow script **cannot** run them directly. Either (a) keep thin "run-this-script, return-its-JSON" agents at phase boundaries, or (b) inline pure logic (e.g. `pick_next_entries`) into the script body while an agent does the actual I/O. Pick per call site; do not try to make the script touch disk.
2. **Intermediate results vanish at run end — only script variables hold them.** The durable cross-run, cross-skill state plane (`registry.json`, `triage_results/<run-id>.json`, and the classifier lifecycle that is the loop-closure surface across triage/plan/fix-sequencer per `.claude/rules/classifier-lifecycle.md`) **must still live on disk** and be written by agents through the `atomic_update_registry` contract. Workflows replace the in-run orchestration, **not** the persistent state plane. Do not move loop-closure state into memory.
3. **Resume is same-session only.** "If you exit Claude Code while a workflow is running, the next session starts fresh." A workflow is one run's orchestration, not a durable daemon.

## Scope

- Convert the `triage` investigation loop and the `plan` investigation wave from prose-in-SKILL.md orchestration to dynamic-workflow scripts, saved as `/triage` and `/plan` in `.claude/workflows/`.
- Use `agent({schema})` to return validated `TriageVerdict` / investigator-proposal objects in memory, eliminating the per-entry result-file write+merge round-trip where it serves only in-run orchestration.
- Keep the deterministic TS scripts and the durable registry/results state plane intact (see constraint 2); delegate their I/O to agents.
- Update each skill's `SKILL.md` to point at the saved workflow as the orchestration entry point (canonical, self-contained — describe the system as it now is).

## Out of scope

- Any change to the durable data contract (`@ariadnejs/skill-protocol`), the registry write-boundary contract, or the classifier lifecycle.
- The deferred actuator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The `triage` investigation loop runs as a saved dynamic workflow (`.claude/workflows/`), fanning out `triage-investigator` agents and collecting `schema`-validated `TriageVerdict` objects in-script; the `--active` in-flight bookkeeping and the per-entry result-file write+merge step that existed solely for in-run orchestration are removed
- [ ] #2 The `plan` investigation wave runs as a saved dynamic workflow that processes novel-issue dispatches via `pipeline()` (no wave barrier), collecting investigator proposals in-script
- [ ] #3 The durable state plane is unchanged: `registry.json` is still written only through `atomic_update_registry`, `triage_results/<run-id>.json` is still published to disk, and `packages/skill-fs/src/registry_writers.test.ts` stays green
- [ ] #4 Each affected `SKILL.md` documents the saved workflow as the orchestration entry point in canonical, self-contained style — no prose pseudo-algorithm orchestration loop remains
- [ ] #5 No surplus/parallel orchestration path: the bespoke `get_next_triage_entry.ts` polling loop and `next_investigate_tasks.ts` wave puller are either deleted or reduced to pure logic the workflow calls — they do not coexist with the workflow as a duplicate orchestrator
- [ ] #6 `pnpm -r build && pnpm -r test && pnpm typecheck && pnpm lint` are green
<!-- AC:END -->
