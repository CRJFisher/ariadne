---
id: TASK-190.22.21
title: Tool the classifier-registry write surface with a reconcile-registry skill
status: To Do
assignee: []
created_date: "2026-06-11 18:06"
labels:
  - self-repair
dependencies: []
parent_task_id: TASK-190.22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

**Companion:** [`…reconcile-plan.html`](<task-190.22.21 - Tool-the-classifier-registry-write-surface-with-a-reconcile-registry-skill.reconcile-plan.html>) — interactive visualisation of this plan (the three-surface gap, the preview→narrow→apply flow, the lifecycle-arrows-to-detectors mapping). Open in a browser.

## Intent

Close the one untooled human-write surface in the self-healing pipeline. The classifier registry (`.claude/skills/triage/known_issues/registry.json`) is a human-owned surface, exactly like `backlog/tasks/`. The backlog surface has a deliberate, human-invoked decision skill (`prioritize`) over a single fenced writer (`export_to_backlog.ts`). The registry surface has nothing — every transition is a raw hand-edit of a 180-rule JSON file. `reconcile-registry` is the registry's `prioritize`: the thin, interactive, human-invoked skill that detects work already done and proposes the mechanical registry writes.

This fulfils the documented design rather than changing it: the actuate doc already names the registry's writer as _"Human (hand edit **or human-invoked script**, always via `atomic_update_registry`)"_. The script was never built.

## The gap, in numbers

At time of writing the registry holds **180 rules** — 171 `wip`, 9 `permanent`, **0 `fixed`**:

- **32 `wip` rules carry a `backlog_task`** (TASK-198, TASK-108, TASK-190.11, …). Each is a candidate for a mechanical `wip → fixed` flip when a task-scoped commit lands. Zero rules are `fixed` despite a steady stream of task-scoped fix commits — the reconciliation simply isn't being done by hand.
- **19 `wip` rules are already `drift_detected`** — drift evidence is appended by hand from triage's published `classifier_regressions[]`.
- `packages/core/src/classify_entry_points/permanent_data.ts` is headed _"AUTO-GENERATED — do not edit by hand. Regenerated from the source registry"_ — but **no generator exists anywhere in the repo**. The mechanical half of `wip → permanent` is currently undone; the file is hand-edited in violation of its own header.

## Scope (locked: core only)

Three high-confidence, mechanical writes. Softer signals (observation rollups, resurfacing surfacing, missing-rule candidates) are explicitly **out of scope** for the first version (see _Deferred_).

| #   | Signal (mechanically detected)                                          | Proposed registry write                                        |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `git log` scope matches a `wip` rule's `backlog_task`                   | `wip → fixed`                                                  |
| 2   | published `triage_results[].classifier_regressions[]` names a `rule_id` | set `drift_detected: true`; append new `drift_evidence[]` rows |
| 3   | human elects to promote a rule to `permanent`                           | regenerate `permanent_data.ts`; sync test guards it thereafter |

The skill never authors rule prose and never makes the `permanent` judgment — those stay human creative/judgment work. It proposes the mechanical flips, shows the diff, and on confirmation writes through the one fenced writer.

## Design (minimal, `prioritize`-shaped)

`reconcile-registry` mirrors `prioritize`: it owns no logic of its own, drives a single script, is `disable-model-invocation: true`, and follows preview → narrow → apply.

```
.claude/skills/reconcile-registry/
└── SKILL.md            # decision surface; disable-model-invocation: true
                        # allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read

.claude/skills/triage/scripts/
├── reconcile_registry.ts          # detect + apply; the only new registry writer,
│                                  #   always through atomic_update_registry
├── reconcile_registry.test.ts
├── generate_permanent_data.ts     # the missing permanent-slice generator
└── generate_permanent_data.test.ts
```

(The scripts live under `triage/scripts/` because that is where the registry and its loaders already live; the skill points at them, as `prioritize` points at a script under `plan/scripts/`.)

### Workflow (mirrors `prioritize`)

1. **Preview.** `reconcile_registry.ts --dry-run` scans every signal and prints the proposed changeset, grouped by transition, writing nothing.
2. **Narrow.** Selectors restrict the set: `--fixed`, `--drift`, `--id <group_id>` (repeatable; overrides filters). Re-preview until the set is exactly the intended work.
3. **Apply.** Drop `--dry-run`. Every write goes through `atomic_update_registry(registry_path, mutator)` — one lock-fenced read-mutate-write per invocation.
4. **Permanent promotion** (separate, deliberate): the human marks a rule `permanent` (via `--id <group_id> --promote`), the script flips the status _and_ runs `generate_permanent_data.ts` to regenerate the bundled core slice.

### Detection mechanics

**`wip → fixed`.** For each `wip` rule with a `backlog_task`, derive the bare task scope (`TASK-198 → 198`) and scan this repo's `git log` for a Conventional-Commits subject whose scope matches — reusing the existing scope parser in `scripts/check-commit-message.ts` rather than re-implementing the `^\d+(?:\.\d+)*(?:-\d+)?$` grammar. A match proposes the flip; the human confirms. No commit hash is stored — the `backlog_task` link plus git log are the audit trail, exactly as the lifecycle doc specifies.

**Drift flagging.** Read each project's latest finalized `analysis_output/<project>/triage_results/<run-id>.json`. Collect `classifier_regressions[].rule_id` and their `flagged_entries[]`. For each `rule_id` present in the registry: if the rule is not yet `drift_detected`, or is missing `drift_evidence` rows for some flagged `entry_index`, propose `drift_detected: true` plus the new `{entry_index, evidence_excerpt}` rows. `drift_evidence[]` is **append-only** and deduped by `entry_index` so a re-run is idempotent.

**Permanent-slice generation.** `generate_permanent_data.ts` reads the source registry, filters to `status: "permanent"`, and renders `permanent_data.ts` (the `{ schema_version, rules }` envelope as a typed `.ts` module, `schema_version` copied verbatim). It is the apply-half the lifecycle doc already describes.

### The enforcement (the actual concern: "nothing enforces the registry gets written")

Beyond making the writes cheap, two structural guards make the surface _enforced_, paralleling the existing `registry_writers.test.ts` write-boundary test:

- **`permanent_data.sync.test.ts`** — asserts the committed `permanent_data.ts` byte-equals the freshly generated slice. The bundled core slice can never silently drift from the registry; a hand-edit (to either file) fails CI.
- The registry-writer AST test in `packages/skill-fs/src/registry_writers.test.ts` already flags any raw write against a registry-shaped path. `reconcile_registry.ts` reaches the registry only via `atomic_update_registry`, so it stays compliant by construction — and the test proves it.

## Work breakdown

**Code**

1. `reconcile_registry.ts` + pure detectors (`git-log → fixed-proposals`, `classifier_regressions → drift-proposals`) + `reconcile_registry.test.ts`. Detectors are pure functions unit-tested with typed literal expectations (`toEqual`, never `toMatchObject`).
2. `generate_permanent_data.ts` + `generate_permanent_data.test.ts`.
3. `permanent_data.sync.test.ts` (drift guard) under `packages/core/src/classify_entry_points/`.
4. `.claude/skills/reconcile-registry/SKILL.md`.

**Docs — every architecture surface**

5. New comprehension page `docs/self-healing-pipeline/reconcile-registry.html` (house dark-theme style) + add to the nav of all existing pages, to index's "Explore the docs", and to the architecture diagram. (The planning companion attached to this task seeds it.)
6. `registry-lifecycle.html` — the lifecycle arrows are now backed by a skill+script, not bare hand edits; document the generator and the sync test.
7. `actuate-and-backlog.html` — name the skill in the surfaces table; add a "reconcile-registry vs script" subsection mirroring "prioritize vs export adapter"; the registry surface joins the full-cycle diagram as a tooled step.
8. `.claude/rules/classifier-lifecycle.md` — name the skill + script as the human-invoked write path in the writers table and the transition diagram caption. (The human remains the sole _decider_; the script is the _mechanism_.)
9. Cross-reference pointers from `triage/SKILL.md` and `plan/SKILL.md`.

## Risks & notes

- **Which repo's git log?** The Ariadne defects are fixed in this repo, so `wip → fixed` scans this repo's log. (A rule fixed in a target repo would be a separate signal; out of scope — YAGNI.)
- **Human stays the decider.** The skill proposes; the human confirms every flip. `disable-model-invocation: true` keeps the model from self-running it, matching `prioritize` and `triage`/`plan`.
- **No schema bump.** No `KnownIssue` field changes; the registry stays `schema_version: 1`.

## Deferred (explicitly out of scope now)

- **Observation rollups** — refreshing `observed_count` / `observed_projects` / `last_seen_run` from accumulated runs. Bookkeeping only (never used for matching); add later if it earns its keep.
- **Review surfacing** — `fixed`-rule resurfacing and "exported task has no registry rule" candidates as read-only review items. Softer signals; rule-level identity is fuzzy.
- **Skill-family prefix** — namespacing `triage` / `plan` / `prioritize` / `reconcile-registry` under a common `sh:` (plugin) or `sh-` (name) prefix is a separate, deliberate refactor; not entangled with this work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 reconcile-registry skill exists with disable-model-invocation true, drives reconcile_registry.ts, and writes the registry only through atomic_update_registry
- [ ] #2 reconcile_registry.ts detects wip-to-fixed from git-log scopes and drift flags from classifier_regressions, with a --dry-run preview and --fixed/--drift/--id selectors, and pure detectors unit-tested with typed literals
- [ ] #3 generate_permanent_data.ts regenerates the permanent slice and permanent_data.sync.test.ts fails when the committed slice drifts from the registry
- [ ] #4 Architecture docs updated (registry-lifecycle.html, actuate-and-backlog.html, classifier-lifecycle.md, triage/plan SKILL cross-refs) and a new reconcile-registry.html added to the docs nav
- [ ] #5 Scope held to core only; observation rollups, review surfacing, and the skill-family prefix recorded as deferred
<!-- AC:END -->
