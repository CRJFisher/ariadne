---
id: task-163
title: Fix top false positive groups from external analysis
status: To Do
assignee: []
created_date: '2026-01-28'
labels:
  - bug
  - call-graph
  - epic-11
dependencies: []
---

## Description

External entrypoint analysis of AmazonAdv/projections (1,197 Python files, 3,039 detected entry points) revealed 9 false positive groups totaling 60 entries. This parent task tracks resolution of the top 5 groups by frequency.

Prior tasks (epic-11.171, epic-11.172, epic-11.174) addressed similar issues for TypeScript. All 5 groups here stem from Python-specific resolution gaps — Python's constructor invocation (`ClassName()` vs `new ClassName()`), `self.method()` dispatch, module-qualified calls (`module.function()`), and lambda callback patterns.

## Evidence

Analysis output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

| Group | Entries | Sub-task |
|-------|---------|----------|
| constructor-resolution-bug | 26 | 163.1 |
| callback-invocation-not-tracked | 12 | 163.2 |
| instance-method-resolution | 6 | 163.3 |
| module-qualified-call-resolution | 5 | 163.4 |
| polymorphic-method-override-resolution | 4 | 163.5 |

## Acceptance Criteria

- [ ] Each sub-task is investigated and either resolved or documented as a known limitation
- [ ] Re-run external analysis on AmazonAdv/projections shows reduction in false positive counts

## Related

- task-epic-11.171 (Done) - Fix constructor resolution lookup (prior work on group 1)
- task-epic-11.172 (Done) - Track callback invocations for internal functions (prior work on group 2)
- task-epic-11.174 (To Do) - Fix polymorphic this dispatch in inheritance (covers part of group 5)
