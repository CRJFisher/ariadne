---
id: task-181
title: Detect React lifecycle methods as framework callbacks
status: To Do
assignee: []
created_date: '2026-02-10 20:22'
labels:
  - bug
  - call-graph
dependencies: []
priority: low
---

## Description

React lifecycle methods (componentDidMount, componentDidUpdate, etc.) on React.Component subclasses are framework-invoked callbacks. They appear as false positive entry points because they are never called directly in user code - React internal reconciliation invokes them. A single instance was found in the Feb 2026 projections analysis: componentDidMount in App.js:11 (create_keywords_and_targets). The fix would recognize React.Component subclass lifecycle methods as framework callbacks, similar to how Python dunder methods are handled.

Confirmed in Feb 12 re-analysis (same entry). Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-12T18-12-14.458Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 React lifecycle methods on Component subclasses are classified as framework callbacks
- [ ] #2 componentDidMount and similar methods do not appear as entry points
<!-- AC:END -->
