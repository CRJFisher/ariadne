---
id: task-175.7
title: Fix Python malformed scope tree error for constructors with blocks
status: Completed
assignee: []
created_date: '2026-01-28'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-epic-11.175
---

## Description

Python constructors (`__init__`) containing block scopes (if/try/with statements) cause "Malformed scope tree" errors when analyzing external codebases.

When Python `__init__` contains block scopes:

1. Tree-sitter captures can have identical/overlapping locations
2. Sorting uses `capture.location` but parent-finding uses `scope_location`
3. When captures have identical locations, sort order is undefined (JavaScript sort instability)
4. Constructor may be processed before class, creating incorrect parent relationships
5. Class and constructor end up as siblings at same depth instead of parent-child

The fix is to add a deterministic sorting tiebreaker based on scope type priority - parent scopes (class) should always be processed before child scopes (constructor, block).

## Evidence

From MCP server logs analyzing AmazonAdv/projections:

```
Malformed scope tree: multiple scopes at depth 3 contain location {"file_path":"projections/demand_forecasting/model/timesfm_adapter.py","start_line":27,"start_column":12,"end_line":27,"end_column":18}. Found scopes: constructor:projections/demand_forecasting/model/timesfm_adapter.py:13:17:41:34 and block:projections/demand_forecasting/model/timesfm_adapter.py:27:9:28:55
```

Similar errors for:

- `preprocess_data/create_pytorch_dataset.py`
- `timesfm/pytorch_patched_decoder.py`

## Implementation

**File: packages/core/src/index_single_file/scopes/scopes.ts**

Add scope type priority constant:

```typescript
const SCOPE_TYPE_PRIORITY: Record<string, number> = {
  module: 0,
  namespace: 0,
  class: 1,
  interface: 1,
  enum: 1,
  function: 2,
  method: 3,
  constructor: 3,
  closure: 4,
  block: 5,
};
```

In the Python sorting branch, after `compare_locations` returns 0, add tiebreaker:

```typescript
// Tiebreaker: sort by scope type priority (class before method/constructor before block)
const priority_a = SCOPE_TYPE_PRIORITY[a.entity] ?? 10;
const priority_b = SCOPE_TYPE_PRIORITY[b.entity] ?? 10;
return priority_a - priority_b;
```

Apply same tiebreaker to general sorting path.

## Acceptance Criteria

- [x] No "Malformed scope tree" error thrown for constructors with nested blocks
- [x] Block scopes correctly nested as children of constructor scopes
- [x] Unit tests cover: constructor with if_statement, try/except, with_statement, nested class with constructor containing blocks
- [x] Re-run external analysis on AmazonAdv/projections shows no malformed scope tree errors

## Files to Modify

- packages/core/src/index_single_file/scopes/scopes.ts
- packages/core/src/index_single_file/scopes/scopes.test.ts

## Related

- task-epic-11.175 - Parent task (Fix top false positive groups from external analysis)
