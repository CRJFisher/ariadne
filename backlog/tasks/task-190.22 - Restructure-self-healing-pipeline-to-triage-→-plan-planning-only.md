---
id: TASK-190.22
title: 'Restructure self-healing pipeline to triage → plan (planning-only)'
status: To Do
assignee: []
created_date: '2026-06-01 10:44'
updated_date: '2026-06-01 14:52'
labels:
  - self-repair
  - architecture
  - restructure
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The self-healing pipeline (skills under `.claude/skills/`) is a WIP that has never run end-to-end. Before committing to a full automated fix-delivery build-out (TASK-190.18, since archived as superseded), we are simplifying the architecture around the part that delivers value first and keeping code-mutation a manual, human-driven step.

**The pipeline becomes two stages — detect, then plan. Fix delivery is manual, human-driven, and out of scope.**

1. **`triage`** (today's `triage-entrypoints`) — detect entry points → per-entry investigator verdicts (`tp` = real dead code / `fp-*` = an Ariadne resolver bug) → publish `triage_results`. Each false-positive carries the deterministic core fault diagnostics (`diagnosis` + `resolution_failure`). *Golden path.*
2. **`plan`** (today's `triage-curator`, renamed and re-scoped to **planning-only**) — read all `triage_results` across repos → group issues by `AriadneFaultArea` (which part of Ariadne is at fault) → opus strategists propose architectural upgrades + the work path toward them → emit **hierarchical, size-tiered fix plans** as backlog tasks → **reconcile against existing planning docs** (augment / supersede / combine for coherence). Classifier-script work (tier-2) is planned here too, at lower priority. *Golden path. Produces plans; never mutates code or the registry.*
3. **Fix delivery** — **out of scope**. The human executes the plans by hand: path A = localised Ariadne-core fixes; path B = classifier-script fixes.

## Target shape

- The `plan` skill **sheds all code-mutating machinery** the curator has today (classifier `.ts` rendering, registry writes via `atomic_update_registry`, promotion, `sync-permanent-rules`, applied bug-task linkage). That work is done manually by the human. `plan` keeps only: read results → group by fault area → opus strategy → write/reconcile hierarchical plan docs.
- Grouping keys on the deterministic fault signal + the `AriadneFaultArea` derivation; LLM refines/merges. No union-find/Jaccard/Pareto/DAG (the dropped automated-sequencing machinery).
- A single private `@ariadnejs/skill-protocol` package becomes the typed source of truth for the `triage`→`plan` seam (one `SCHEMA_VERSION`, run-id + path helpers), killing today's duplicated constants and `../../../` registry-path traversal.
- The in-run coordinator (`src/absorb/*`) is **deleted** in Phase 1 — it was unwired dead code; offline grouping in `plan` subsumes it.
- No backwards-compat shims; intention-tree naming only (no `enhanced_*` / `*_v2`).

## Supersedes

This restructure supersedes the automated fix-delivery design (TASK-190.18 and its subtrees) and its plan file `~/.claude/plans/i-d-like-to-make-nested-creek.md` (archived). Code-mutation and loop-closure (recording landed fixes back into the registry) are now manual, human-driven steps.

## Subtasks

Numbered in canonical execution order — the task number is the dependency order.

- **190.22.1** — Phase 1: harden the `triage` golden path; delete the in-run coordinator; carry deterministic fault diagnostics.
- **190.22.2** — Phase 2: extract `@ariadnejs/skill-protocol` shared data contract. _(depends on .1)_
- **190.22.3** — Author `AriadneFaultArea` taxonomy + deterministic derivation (replaces `AriadneRootCauseCategory`). _(depends on .1)_
- **190.22.4** — Define the plan task-DB contract (`PlanTask` + `PlanTaskRepository` + `~/.ariadne/plan/` paths) in `@ariadnejs/skill-protocol`. _(depends on .2 + .3)_
- **190.22.5** — Phase 3: rename `triage-entrypoints`→`triage`, `triage-curator`→`plan`; strip code-mutating machinery. _(depends on .2)_
- **190.22.6** — Firewall: retarget/remove the pipeline's backlog-writing machinery. _(depends on .4)_
- **190.22.7** — Backlog firewall rule-doc + AST enforcement test.
- **190.22.8** — Implement the JSON plan-task store behind `PlanTaskRepository`. _(depends on .4)_
- **190.22.9** — Phase 4: build the `plan` engine — group → strategize → hierarchical plans → reconcile. _(depends on .5 + .3)_
- **190.22.10** — Wire the `plan` engine to write `PlanTask` rows + reconcile within the task-DB. _(depends on .8 + .3)_
- **190.22.11** — User-invoked export/promotion adapter (task-DB → `backlog/`; the sole backlog writer). _(depends on .8 + .7)_
- **190.22.12** — Tidy `backlog/tasks/`: migrate the 234 auto-filed classifier tickets into the task-DB (archive-not-delete). _(depends on .8)_

Execution order is numeric: .1 → .2 → … → .12.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `triage` runs detect→triage→publish end-to-end on a real cloned repo and publishes a non-empty `novel_issues[]` built from verdict files, with no `novel_issues.json` written under the run dir
- [ ] #2 A single private `@ariadnejs/skill-protocol` package is the source of truth for the `triage`→`plan` seam (one `TRIAGE_RESULTS_SCHEMA_VERSION`, run-id + path helpers); the duplicated schema constants and both `../../../` registry-path traversal sites are removed
- [ ] #3 `triage-curator` is renamed and re-scoped to `plan`: it produces grouped, hierarchical backlog plans and reconciles ≥1 existing planning doc, and makes ZERO writes to `registry.json` or `packages/core`
- [ ] #4 `triage-entrypoints` is renamed to `triage`; `grep -rIl --exclude-dir=node_modules 'triage-entrypoints|triage-curator' .` returns only intentional residuals (on-disk state-dir default, migration docs)
- [ ] #5 All code-mutating machinery (classifier rendering, registry writes, promotion, `sync-permanent-rules`, applied bug-task linkage) is removed from `plan`; fix-delivery is a manual, human-driven step
- [ ] #6 The superseded automated fix-delivery subtree (TASK-190.18.*) is archived
- [ ] #7 No backwards-compatibility shims; intention-tree naming only
- [ ] #8 `pnpm -r build && pnpm -r test && pnpm typecheck && pnpm lint` are green after each phase
<!-- AC:END -->
