---
id: task-78
title: Fix get_all_functions to properly handle methods vs functions
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The get_all_functions API may need to be updated to properly distinguish between methods and functions. Currently methods appear to be returned with symbol_kind='function' in some cases, which may be contributing to test failures.

## Acceptance Criteria

- [ ] Methods are returned with correct symbol_kind
- [ ] get_all_functions API works consistently
- [ ] Function vs method distinction is clear
