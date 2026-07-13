---
id: TASK-364.1
title: "Remove three dead MetadataExtractors interface methods across all four language impls"
status: To Do
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - dead-code
  - refactor
parent_task_id: TASK-364
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The shared `MetadataExtractors` interface at
`packages/core/src/index_single_file/query_code_tree/metadata_extractors/types.ts`
declares three methods that **no production code ever calls** — only tests
invoke them. Verified during the sweep of `metadata_extractors.python.ts` and
`metadata_extractors.javascript.ts` (repo-wide grep for each call site returns
hits only in tests, `dist/`, the interface, and the four implementations).

| Method (in `types.ts`)     | Line |
| -------------------------- | ---- |
| `extract_call_receiver`    | 40   |
| `extract_assignment_parts` | 63   |
| `extract_type_arguments`   | 82   |

They could not be removed by a single-module hygiene pass because deleting one
implementation breaks the `MetadataExtractors` interface conformance of the
others. This is the coordinated removal.

### Work

1. Delete the three method declarations from the `MetadataExtractors` interface
   in `types.ts`.
2. Delete their implementations from all four impls:
   `metadata_extractors.javascript.ts`, `metadata_extractors.typescript.ts`,
   `metadata_extractors.python.ts`, `metadata_extractors.rust.ts`.
3. Delete the now-orphaned tests that drove those methods directly.
4. Remove any imports/types used only by the deleted methods. No shims.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `grep -rn "extract_call_receiver\|extract_assignment_parts\|extract_type_arguments" packages/core/src` returns no hits outside removed history.
- [ ] The `MetadataExtractors` interface and all four implementations no longer
      declare/implement the three methods; the four impls still satisfy the
      interface (typecheck clean).
- [ ] No tests reference the removed methods; full core suite green.

<!-- AC:END -->
