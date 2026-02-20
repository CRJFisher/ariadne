---
id: task-184
title: 'Fix Category B false positives: factory function return type inference'
status: To Do
assignee: []
created_date: '2026-02-12 16:44'
labels: []
dependencies: []
---

## Description

3 false positives where factory functions return objects without type annotations (e.g., qbc = _get_pyqb_client(); qbc.authenticate()). Requires return type inference from function bodies to resolve the receiver type.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Factory function return types are inferred from constructor calls in function body,qbc.authenticate/importfromcsv/purge_records resolve correctly
<!-- AC:END -->
