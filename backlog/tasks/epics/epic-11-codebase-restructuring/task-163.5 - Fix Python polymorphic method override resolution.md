---
id: task-163.5
title: Fix Python polymorphic method override resolution
status: To Do
assignee: []
created_date: '2026-01-28'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-163
---

## Description

When a Python base class method calls `self.method()`, and a child class overrides that method, the call graph fails to connect the base class call site to the child class implementation. Both the base class and override methods appear as uncalled entry points.

task-epic-11.174 addresses this same pattern for TypeScript (`this.method()` dispatch) and is currently To Do. This sub-task tracks the Python-specific equivalent (`self.method()` dispatch). The resolution strategy may be shared, but Python's inheritance model (including multiple inheritance via MRO) introduces additional complexity.

## Evidence

4 false positive entries from `polymorphic-method-override-resolution` group, all in `amazon_ads/performance/performance_data.py`:

- `get_data` at line 117 (3 entries — likely base + 2 overrides)
- `_add_base_props` at line 85 (1 entry)

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [ ] `self.method()` calls in Python base classes resolve to child overrides
- [ ] Override methods no longer appear as false positive entry points
- [ ] All 4 entries no longer appear as false positive entry points

## Related

- task-epic-11.174 (To Do) - Fix polymorphic this dispatch in inheritance (TypeScript equivalent)
- task-163 - Parent task
