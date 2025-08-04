---
id: task-100.12.3
title: Extract navigation and query logic from Project class
status: To Do
assignee: []
created_date: '2025-08-04 22:40'
labels: []
dependencies: []
parent_task_id: task-100.12
---

## Description

Move all navigation methods (go_to_definition, get_definitions, get_hover_info, etc.) into a separate NavigationService module.

## Acceptance Criteria

- [ ] NavigationService class created
- [ ] All navigation methods moved
- [ ] Query methods moved
- [ ] Symbol resolution logic moved
- [ ] Project class delegates to NavigationService
