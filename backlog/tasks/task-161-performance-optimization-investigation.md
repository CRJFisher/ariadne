---
id: task-161
title: Performance optimization investigation for top bottlenecks
status: To Do
assignee: []
created_date: '2026-01-07'
labels: [performance, investigation]
dependencies: []
---

## Overview

Investigation and optimization of the top three performance bottlenecks identified through profiling with the new `ARIADNE_PROFILE=1` instrumentation.

## Profiling Results Summary

From analyzing 82 files in `packages/core/src`:

| Phase | Time | % of Total | Notes |
|-------|------|------------|-------|
| **query_compile** | 8,268ms | 67.6% | Tree-sitter query compilation |
| **process_definitions** | 998ms | 8.2% | Definition extraction |
| **process_references** | 522ms | 4.3% | Reference extraction |
| Total Native (tree-sitter) | 9,019ms | 73.8% | |
| Total JavaScript | 3,207ms | 26.2% | |
| **Grand Total** | 12,227ms | 100% | |

**Key Finding:** Tree-sitter query compilation is being performed for **every file**, even though the query string is identical for all files of the same language. This is the dominant bottleneck.

## How to Reproduce

```bash
# Run profiling
cd top-level-nodes-analysis
npm run profile:detailed

# Or directly:
ARIADNE_PROFILE=1 npx tsx detect_entrypoints_using_ariadne.ts --stdout
```

## Critical Files

### Query Compilation
- [query_code_tree.ts](packages/core/src/index_single_file/query_code_tree/query_code_tree.ts) - Line 26 creates `new Query()` for every file
- [query_loader.ts](packages/core/src/index_single_file/query_code_tree/query_loader.ts) - Query string loading (already cached)

### Definition Processing
- [definitions.ts](packages/core/src/index_single_file/definitions/definitions.ts) - `DefinitionBuilder` class
- Handler files in `capture_handlers/` - Language-specific definition handlers

### Reference Processing
- [references.ts](packages/core/src/index_single_file/references/references.ts) - `process_references()` function
- Metadata extractors in `metadata_extractors/` - Language-specific reference extraction

## Expected Outcomes

| Optimization | Estimated Impact | Complexity |
|--------------|------------------|------------|
| Query caching | ~67% reduction (8s → near 0) | Low |
| Definition processing | 5-10% reduction | Medium |
| Reference processing | 2-5% reduction | Medium |

**Total potential improvement:** ~70-75% reduction in processing time (12s → ~3-4s)

## Sub-Tasks

- **task-161.1**: Cache compiled tree-sitter queries per language
- **task-161.2**: Optimize `process_definitions()` performance
- **task-161.3**: Optimize `process_references()` performance

## Acceptance Criteria

- [ ] Query compilation time reduced from 67% to < 5% of total
- [ ] Overall processing time reduced by at least 50%
- [ ] No regression in semantic index accuracy
- [ ] All existing tests pass
- [ ] Benchmark tests added to track future regressions
