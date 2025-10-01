---
id: task-152
title: Fix and consolidate semantic_index test suite
status: To Do
assignee: []
created_date: '2025-10-01 09:49'
updated_date: '2025-10-01 09:54'
labels: []
dependencies: []
priority: high
---

## Description

Fix semantic_index language test files:

1. Update fixture paths from src/index_single_file/parse_and_query_code/fixtures/ to tests/fixtures/
2. Merge semantic_index.<language>.metadata.test.ts INTO semantic_index.<language>.test.ts
3. Remove tests for unsupported language features that would cause code rot
4. Ensure 100% pass rate

Files to fix:
- semantic_index.javascript.test.ts
- semantic_index.typescript.test.ts + semantic_index.typescript.metadata.test.ts
- semantic_index.python.test.ts + semantic_index.python.metadata.test.ts
- semantic_index.rust.test.ts + semantic_index.rust.metadata.test.ts (needs major rewrite from deprecated SemanticEntity API)
