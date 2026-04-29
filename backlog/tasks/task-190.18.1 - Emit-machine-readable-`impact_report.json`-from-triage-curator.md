---
id: TASK-190.18.1
title: Emit machine-readable `impact_report.json` from triage-curator
status: To Do
assignee: []
created_date: "2026-04-29 10:29"
labels:
  - self-repair
  - fix-sequencer
  - triage-curator-extension
dependencies: []
parent_task_id: TASK-190.18
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The new `fix-sequencer` skill must NOT parse markdown to ingest impact data. Triage-curator's `impact_report.ts` already builds rows in memory; emitting a sibling JSON file costs ~30 lines and unblocks downstream automation.

## Scope

- File: `.claude/skills/triage-curator/src/impact_report.ts`
- Add a JSON emitter sibling to the existing markdown renderer
- Schema: `{ rows: ImpactRow[] }` where `ImpactRow` is the existing in-memory shape (`group_id`, `observed_count`, `observed_projects[]`, `languages[]`, `backlog_task`)
- Wire into `scripts/generate_impact_report.ts` to write `impact_report.json` next to `impact_report.md`
- Reuse `build_impact_rows()` — do not duplicate the rank/sort logic

## Out of scope

- Schema additions (complexity, predicted_fix_subsystem, etc.) — those are deferred to v1.5
- Markdown rendering changes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 impact_report.json written next to impact_report.md per run
- [ ] #2 Schema has `rows: ImpactRow[]` with group_id, observed_count, observed_projects[], languages[], backlog_task
- [ ] #3 Existing markdown output unchanged
- [ ] #4 Tested on a recorded run fixture (fixture under `triage-curator/__fixtures__/` or equivalent)
- [ ] #5 build_impact_rows() reused, not duplicated
<!-- AC:END -->
