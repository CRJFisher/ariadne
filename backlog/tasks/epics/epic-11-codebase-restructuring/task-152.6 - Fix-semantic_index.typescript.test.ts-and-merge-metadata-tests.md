---
id: task-152.6
title: Fix semantic_index.typescript.test.ts and merge metadata tests
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

Fix semantic_index.typescript.test.ts and merge metadata:

1. Merge semantic_index.typescript.metadata.test.ts INTO semantic_index.typescript.test.ts
2. Delete semantic_index.typescript.metadata.test.ts after merge
3. Update fixture paths to tests/fixtures/typescript/
4. Remove tests for comprehensive_* fixtures testing unsupported features
5. Ensure all tests verify current SemanticIndex API (not deprecated)
6. Achieve 100% pass rate (currently 19/20 failing)
