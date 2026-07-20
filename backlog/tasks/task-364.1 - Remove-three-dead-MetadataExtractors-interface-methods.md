---
id: TASK-364.1
title: "Remove three dead MetadataExtractors interface methods across all four language impls"
status: Done
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

- [x] `grep -rn "extract_call_receiver\|extract_assignment_parts\|extract_type_arguments" packages/core/src` returns no hits outside removed history.
- [x] The `MetadataExtractors` interface and all four implementations no longer
      declare/implement the three methods; the four impls still satisfy the
      interface (typecheck clean).
- [x] No tests reference the removed methods; full core suite green.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

`extract_call_receiver`, `extract_assignment_parts`, and `extract_type_arguments`
are gone from the `MetadataExtractors` contract. The three methods were part of
the interface and every language implementation, but only tests ever called
them — no path through the reference-building pass (`references.ts`, the sole
production consumer of the extractors) invoked any of the three. Removing them
narrows the shared contract to the extractions the indexer actually performs.

## What changed

- **Interface** (`metadata_extractor_types.ts`): the three method declarations
  are removed. The remaining contract is `extract_type_from_annotation`,
  `extract_property_chain`, `extract_receiver_info`, `extract_construct_target`,
  `extract_is_optional_chain`, `is_method_call`, `extract_call_name`, and Rust's
  optional `extract_call_path_prefix`.
- **Implementations** (`metadata_extractors.{javascript,typescript,python,rust}.ts`):
  each drops its three method bodies. The TypeScript impl dropped the three
  `JAVASCRIPT_METADATA_EXTRACTORS.extract_*` delegation lines. No import or
  helper became orphaned — every retained method still uses `Location`,
  `ReceiverInfo`, `SelfReferenceKeyword`, and `node_to_location`. Rust's
  `extract_call_receiver` was self-recursive only, so nothing outside it called it.
- **Tests**: the dedicated `describe` blocks and the interleaved null/undefined
  and edge-case `it`s for the three methods are removed from the three
  `metadata_extractors.{language}.test.ts` files. The mock in `references.test.ts`
  dropped the three keys and one now-meaningless per-test override; the
  redundant "type references with generics" case (a strict subset of the plain
  type-reference test once its generic hook was gone) was deleted.
- **Docs**: the `CAPTURE-SCHEMA.md` bullet crediting `extract_call_receiver()`
  is removed. The Rust file header, which enumerates the file's capabilities,
  keeps method-call receiver and turbofish entries — reworded to credit the
  retained methods (`extract_receiver_info`, and the turbofish reduction in
  `extract_property_chain`/`extract_call_name`/`extract_call_path_prefix`) that
  still provide those capabilities.

## Verification

- AC-1: `grep -rn "extract_call_receiver\|extract_assignment_parts\|extract_type_arguments" packages/core/src`
  returns no `.ts` hits.
- AC-2: `tsc -p packages/core` clean; all four impls satisfy the narrowed interface.
- AC-3: full core suite green (3317 tests, 151 files); full multi-package
  pre-commit suite green; eslint clean.

<!-- SECTION:NOTES:END -->
