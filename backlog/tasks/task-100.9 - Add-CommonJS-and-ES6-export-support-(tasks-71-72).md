---
id: task-100.9
title: Add CommonJS and ES6 export support (tasks 71-72)
status: To Do
assignee: []
created_date: '2025-08-04 12:05'
labels: []
dependencies:
  - task-71
  - task-72
parent_task_id: task-100
---

## Description

Export detection is currently limited, affecting validation accuracy. Need to support:

- CommonJS property assignments (module.exports.name = value)
- ES6 exports in .js files
- New TypeScript extensions (.mts, .cts)

This affects the 'exported nodes' metric and overall accuracy.

## Acceptance Criteria

- [ ] CommonJS property exports detected
- [ ] ES6 exports work in .js files
- [ ] New TS extensions supported (.mts/.cts)
- [ ] Export detection accuracy improved
