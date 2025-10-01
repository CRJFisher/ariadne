---
id: task-epic-11.107.4
title: 'Rust: REWRITE semantic_index tests from SemanticEntity API'
status: To Do
assignee: []
created_date: '2025-10-01 10:28'
labels: []
dependencies: []
parent_task_id: task-epic-11.107
priority: high
---

## Description

MAJOR REWRITE - Currently 5147 lines with @ts-nocheck using deprecated API

1. Merge semantic_index.rust.metadata.test.ts INTO semantic_index.rust.test.ts
2. Delete semantic_index.rust.metadata.test.ts after merge
3. REWRITE from SemanticEntity API to SemanticIndex API
4. Update fixture paths to tests/fixtures/rust/
5. Remove @ts-nocheck
6. Focus on essential Rust features (see audit sub-task)
7. Achieve 100% pass rate (currently 91/120 failing)
