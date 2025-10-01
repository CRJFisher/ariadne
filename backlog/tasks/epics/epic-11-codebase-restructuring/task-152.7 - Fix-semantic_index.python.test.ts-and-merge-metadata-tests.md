---
id: task-152.7
title: Fix semantic_index.python.test.ts and merge metadata tests
status: To Do
assignee: []
created_date: '2025-10-01 09:49'
updated_date: '2025-10-01 09:54'
labels: []
dependencies: []
parent_task_id: task-152
priority: high
---

## Description

Fix semantic_index.python.test.ts and merge metadata:

1. Merge semantic_index.python.metadata.test.ts INTO semantic_index.python.test.ts
2. Delete semantic_index.python.metadata.test.ts after merge
3. Update fixture paths to tests/fixtures/python/
4. Fix failing assertions for return type hints, Union/Optional, imports (6/26 failing)
5. Remove tests for unsupported Python features
6. Achieve 100% pass rate
