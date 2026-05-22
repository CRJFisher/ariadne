---
id: TASK-190.19.6
title: Curator absorb path — consume v4 `triage_results` and route novel-issues + regressions
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - triage-curator
  - srp-redesign
dependencies:
  - TASK-190.19.5
parent_task_id: TASK-190.19
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The curator now reads pre-consolidated `novel_issues[]` + `classifier_regressions[]` directly from the v4 `triage_results/<run-id>.json` (190.19.5). This task wires the absorb path and the registry/puller routing — without touching the curator-investigator agent (covered in 190.19.7) or `find-promotion-candidates` / curator-QA (covered in 190.19.8).

## Scope

`.claude/skills/triage-curator/scripts/curate_all.ts` and the modules it orchestrates:

- Read the v4 `triage_results/<run-id>.json`; drop all reads of the legacy `groups` / `residual-fp` / `residual-ungrouped` fields (they no longer exist).
- For each `novel_issue` in the run:
  - If the issue's `id` is already in `registry.json` as a `wip` or `permanent` row → bump `observed_count`, append to `observed_projects`, update `last_seen_run`.
  - Otherwise → route into the existing investigation puller as a "promote-novel" task. The investigator dispatched here is the narrowed one from 190.19.7; this task only sets up the routing.
- For each `classifier_regression` flag → apply the wip-row drift update wired in 190.19.4 (this task just reads the flag list and dispatches; no new drift logic).

### Tests

- `curator_novel_issues_absorb.test.ts` — given a v4 triage_results fixture with three novel issues (one already wip in registry, two new) plus two regression flags, assert the registry update + puller routing with `toEqual` on typed literals.

## Out of scope

- Curator-investigator agent prompt rewrite (190.19.7).
- `find-promotion-candidates` + curator-QA verification (190.19.8).
- Skill rename (190.19.9).
- Docs / diagrams (190.19.10).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Curator reads v4 `triage_results/<run-id>.json`; consumes `novel_issues` + `classifier_regressions` sections; no reads of legacy `groups` / `residual-fp` fields remain in code
- [ ] #2 Already-registered novel issues bump `observed_count` / `observed_projects` / `last_seen_run`; new ones route into the existing puller as "promote-novel" tasks
- [ ] #3 Regression flag dispatch routes into the same drift-handling path established in 190.19.4 (no duplicate drift logic)
- [ ] #4 Tests cover the absorb path with `toEqual` against typed literal registry + puller states
<!-- AC:END -->
