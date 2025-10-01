---
id: task-epic-11.107.3
title: 'Python: Fix and merge semantic_index tests'
status: To Do
assignee: []
created_date: '2025-10-01 10:27'
labels: []
dependencies: []
parent_task_id: task-epic-11.107
priority: high
---

## Description

1. Merge semantic_index.python.metadata.test.ts INTO semantic_index.python.test.ts
2. Delete semantic_index.python.metadata.test.ts after merge
3. Update fixture paths to tests/fixtures/python/
4. Fix failing assertions (return type hints, Union/Optional, imports)
5. Remove tests for unsupported Python features
6. Achieve 100% pass rate (currently 6/26 failing)
