---
id: TASK-190.16.12
title: Add curator backlog-task linkage and cross-run impact reporting
status: To Do
assignee: []
created_date: '2026-04-17 14:39'
updated_date: '2026-04-24 16:40'
labels:
  - triage-curator
  - skill
  - reporting
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/skills/triage-curator/
  - .claude/skills/self-repair-pipeline/known_issues/registry.json
parent_task_id: TASK-190.16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase F5 + F6.

Bridge code-functionality to work-prioritization: every registry entry has a linked backlog task, and the curator can emit impact-weighted gap reports that inform Ariadne's backlog priorities.

**F5 — Backlog linkage (`scripts/propose_backlog_tasks.ts`):**
When opus investigation creates or updates a registry entry, enforce the bidirectional link:

- Match to existing backlog task via `mcp__backlog__task_search` by canonical `group_id` tag — if found, update.
- Otherwise create a new task via `mcp__backlog__task_create` tagged with the `group_id`. Body includes: group description, example entry links, `observed_count` / `observed_projects` fields, proposed classifier spec, checklist of acceptance criteria.

**F6 — Impact reporting (`scripts/generate_impact_report.ts`):**
Query the registry and emit a ranked markdown report:

- Top N unsupported language constructs by `observed_count`
- Per-language breakdown (TS vs Python vs Rust etc.)
- Per-project breakdown
- New-since-last-report delta (groups first appearing in recent runs)

Report is intentionally human-read, not pipeline-consumed. On demand, it can be posted to the backlog via `mcp__backlog__document_create` or as a task body update.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `scripts/propose_backlog_tasks.ts` exists; creates new backlog tasks for registry entries without a linked task and updates existing ones when `observed_count` changes
- [x] #2 Tasks it creates carry the `group_id` as a label and include in the body: group description, example entry links, observed_count/observed_projects, proposed classifier spec, and a checklist of acceptance criteria
- [x] #3 `scripts/generate_impact_report.ts` produces a markdown report with the 4 sections listed (top N, per-language, per-project, delta)
- [x] #4 Golden-file test on a fixture curator state produces deterministic report output
- [ ] #5 End-to-end: after curating multiple runs, top entries in the impact report have corresponding backlog tasks that link back to the registry `group_id`
- [ ] #6 Bidirectional link enforced and tested both ways: registry entry has `backlog_task: TASK-XXX` AND the linked task has the `group_id` as a label
- [ ] #7 Impact report can be posted to the backlog via `mcp__backlog__document_create`; integration is smoke-tested
<!-- AC:END -->
