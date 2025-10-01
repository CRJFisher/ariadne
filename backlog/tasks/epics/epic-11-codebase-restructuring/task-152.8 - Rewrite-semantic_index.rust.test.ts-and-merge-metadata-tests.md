---
id: task-152.8
title: Rewrite semantic_index.rust.test.ts and merge metadata tests
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

MAJOR REWRITE: semantic_index.rust.test.ts

Current state: 5147 lines with @ts-nocheck, uses deprecated SemanticEntity API

1. Merge semantic_index.rust.metadata.test.ts INTO semantic_index.rust.test.ts
2. Delete semantic_index.rust.metadata.test.ts after merge
3. REWRITE from SemanticEntity API to SemanticIndex API
4. Update fixture paths to tests/fixtures/rust/
5. Remove tests for unsupported Rust features (TYPE_PARAMETER, TYPE_CONSTRAINT, etc.)
6. Focus on essential: structs, enums, traits (as interfaces), functions, methods
7. Remove @ts-nocheck
8. Achieve 100% pass rate (currently 91/120 failing)
