---
id: TASK-190.19.10
title: Update SRP and curator READMEs, diagrams, and cross-references
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - triage-entrypoints
  - triage-curator
  - srp-redesign
  - docs
dependencies:
  - TASK-190.19.6
  - TASK-190.19.7
  - TASK-190.19.8
  - TASK-190.19.9
parent_task_id: TASK-190.19
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Once the code, schema, and skill rename land, canonical docs must describe the system as it now IS — `triage-entrypoints` instead of `triage-entrypoints`, no Phase 4 aggregation, no `rough-aggregator` / `group-investigator`, no `pass1` / `pass2` directories. Diagrams updated to match. Cross-references in the fix-sequencer task realigned.

## Scope

### triage-entrypoints README

`.claude/skills/triage-entrypoints/README.md`:

- Update the "Pipeline Flow" diagram: collapse the previous Phase 4 (aggregation) into a single "Triage loop" phase that includes the coordinator and `novel_issues.json` store. The umbrella diagram in `task-190.19.md` can be lifted directly.
- Update the "Sub-Agent Summary" table: drop `rough-aggregator` and `group-investigator`; add `triage-coordinator`.
- Update the prose narrative to describe the verdict schema + coordinator path.
- Keep the `## Self-healing pipeline` section heading (chain-level umbrella term).

### Curator README

`.claude/skills/triage-curator/README.md`:

- Update the "Pipeline Flow" diagram: the curator consumes `novel_issues.json` + `classifier_regressions[]` from `triage-entrypoints`. Investigator role is promotion-only.
- Update the prose narrative accordingly.

### Cross-references

- `backlog/tasks/task-190.18 - Build-fix-sequencer-skill-*.md`: confirm the cross-reference points to the renamed skill (`triage-entrypoints`) and that the high-level-flow narrative still matches.
- `.claude/rules/classifier-lifecycle.md`: confirm the write-boundary table — curator remains sole autonomous `wip`-row writer; the `triage-coordinator` writes only the per-run `novel_issues.json`.

### Style

All updates follow the canonical / self-contained documentation style: present tense, describe the system as it IS, no references to "previously", "old", "deprecated", "Phase 4 aggregation", "triage-entrypoints".

## Out of scope

- No code changes (all code-mutating work is in 190.19.1–.9).
- No changes to the `task-190.19` umbrella diagram itself — the README borrows from it.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `triage-entrypoints` README Pipeline Flow diagram contains no `rough-aggregator`, `group-investigator`, `aggregation/slices`, `pass1`, or `pass2` nodes
- [ ] #2 `triage-entrypoints` README Sub-Agent Summary table lists `triage-investigator` and `triage-coordinator`; `rough-aggregator` and `group-investigator` are gone
- [ ] #3 Curator README Pipeline Flow diagram shows the curator consuming `novel_issues.json` + `classifier_regressions` from `triage-entrypoints`; no residual-group framing
- [ ] #4 Cross-reference in `task-190.18` and `.claude/rules/classifier-lifecycle.md` is verified consistent with the renamed skill and new architecture
- [ ] #5 No documentation uses "previously", "old", "deprecated", "Phase 4 aggregation", "triage-entrypoints", or comparable historical-framing language
- [ ] #6 `## Self-healing pipeline` section heading remains in the renamed README as the chain-level umbrella term
<!-- AC:END -->
