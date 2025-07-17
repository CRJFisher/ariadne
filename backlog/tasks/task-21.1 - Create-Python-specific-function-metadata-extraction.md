---
id: task-21.1
title: Create Python-specific function metadata extraction
status: To Do
assignee: []
created_date: '2025-07-17'
labels: []
dependencies: []
parent_task_id: task-21
---

## Description

Implement Python-specific logic to extract metadata like async status, decorators, and test function detection.

## Acceptance Criteria

- [ ] Correctly identifies async def functions
- [ ] Detects test_ prefixed functions
- [ ] Detects unittest and pytest test methods
- [ ] Extracts decorator names
- [ ] Handles class methods vs static methods
