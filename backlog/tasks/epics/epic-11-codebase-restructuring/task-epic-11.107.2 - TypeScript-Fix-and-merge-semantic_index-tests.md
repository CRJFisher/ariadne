---
id: task-epic-11.107.2
title: 'TypeScript: Fix and merge semantic_index tests'
status: To Do
assignee: []
created_date: '2025-10-01 10:27'
labels: []
dependencies: []
parent_task_id: task-epic-11.107
priority: high
---

## Description

1. Merge semantic_index.typescript.metadata.test.ts INTO semantic_index.typescript.test.ts
2. Delete semantic_index.typescript.metadata.test.ts after merge
3. Update fixture paths to tests/fixtures/typescript/
4. Remove tests for comprehensive_* fixtures testing unsupported features
5. Ensure tests verify SemanticIndex API (not deprecated)
6. Achieve 100% pass rate (currently 19/20 failing)
