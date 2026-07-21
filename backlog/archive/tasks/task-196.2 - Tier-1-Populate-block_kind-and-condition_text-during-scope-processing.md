---
id: TASK-196.2
title: "Tier 1: Populate block_kind and condition_text during scope processing"
status: To Do
assignee: []
created_date: "2026-03-26 11:25"
labels:
  - core
  - tier-1
dependencies:
  - TASK-196.1
parent_task_id: TASK-196
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Extract block kind and condition text from tree-sitter nodes during scope processing. This is the core Tier 1 implementation.

### Files to Modify

**`packages/core/src/index_single_file/scopes/boundary_base.ts`**:

- Extend `ScopeBoundaries` with `block_kind: BlockKind | null` and `condition_text: string | null`
- Add `truncate_condition_text()` helper (128 char max, truncated with `"\u2026"`)
- Update `extract_block_boundaries()` base to return `block_kind: "generic"`, `condition_text: null`
- Update all non-block extraction methods to return `block_kind: null, condition_text: null`

**Language-specific extractors** — Override `extract_block_boundaries()` in each:

`javascript_typescript_scope_boundary_extractor.ts`:

- `map_ts_js_node_to_block_kind(node)` — maps `node.type` to BlockKind. Detects `else_if` by checking if `node.parent?.type === "if_statement"` and this node is the `alternative`.
- `extract_ts_js_condition_text(node)` — reads `childForFieldName("condition")` for if/while/do, initializer/condition/increment for for, left/right for for_in, value for switch/switch_case, parameter for catch.

`python_scope_boundary_extractor.ts`:

- Maps `elif_clause` → `"else_if"`, `else_clause` → `"else"`, `except_clause` → `"catch"`, comprehensions → `"comprehension"`, `with_statement` → `"with"`, `match_statement` → `"match"`, `case_clause` → `"match_arm"`
- Extracts condition from `condition` field (if/elif/while), `left`+`right` (for), `subject` (match), pattern/exception info

`rust_scope_boundary_extractor.ts`:

- Maps `if_expression` → `"if"`, `for_expression` → `"for"`, `while_expression` → `"while"`, `loop_expression` → `"loop"`, `match_expression` → `"match"`, `match_arm` → `"match_arm"`, `unsafe_block` → `"unsafe"`, `async_block` → `"async"`
- Extracts condition/pattern/value from respective fields

**`packages/core/src/index_single_file/scopes/scopes.ts`**:

- In `process_scopes()`, thread `boundaries.block_kind` and `boundaries.condition_text` into `LexicalScope` creation
- Update root module scope creation to include `block_kind: null, condition_text: null, sibling_scope_ids: []`

### Critical Edge Cases

- **TS/JS else_if detection**: An `if_statement` is `else_if` when its parent is also an `if_statement` and it is the `alternative` child.
- **TS/JS else**: A bare `else` is a `statement_block` in the `alternative` field — NOT separately captured by queries. Calls in the else body get the parent `if_statement` scope. This is a known limitation unless queries are extended.
- **Python else_clause context**: Same `else_clause` node type means if-else, for-else, or while-else depending on parent. Check parent node type.
- **Rust impl block**: `declaration_list` captured as `@scope.block` when parent is `impl_item` — set `block_kind: "generic"` (not control flow).
- **Condition truncation**: Max 128 chars, truncated with Unicode ellipsis `"\u2026"`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Every block scope created by process_scopes() has a non-null block_kind (one of the BlockKind values)
- [ ] #2 Condition text is extracted for: if/elif/while (condition field), for (left+right or init/cond/incr), switch/match (value/subject), catch (parameter/exception), switch_case/match_arm (value/pattern)
- [ ] #3 Condition text is null for: else, finally, try, loop, unsafe, async, generic
- [ ] #4 Condition text is truncated at 128 chars with ellipsis
- [ ] #5 Non-block scopes (function, class, module) have block_kind: null
- [ ] #6 All four languages produce correct block_kind values for their respective control flow constructs
- [ ] #7 Existing tests pass (may need new fields added to LexicalScope literals in test assertions)
<!-- AC:END -->
