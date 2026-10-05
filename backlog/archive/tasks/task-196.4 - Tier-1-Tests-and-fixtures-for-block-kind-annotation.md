---
id: TASK-196.4
title: "Tier 1: Tests and fixtures for block kind annotation"
status: To Do
assignee: []
created_date: "2026-03-26 11:26"
labels:
  - testing
  - tier-1
dependencies:
  - TASK-196.3
parent_task_id: TASK-196
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Comprehensive tests for all Tier 1 functionality: block kind mapping, condition text extraction, sibling detection, and integration tests with real parsed code across all four languages.

### Unit Tests (`block_kind.test.ts` — new file in `scopes/`)

**Block kind mapping** (~39 tests):

- TypeScript: if_statement→"if", for_statement→"for", for_in_statement→"for_in", while_statement→"while", do_statement→"do_while", switch_statement→"switch", switch_case→"switch_case", try_statement→"try", catch_clause→"catch", finally_clause→"finally", else_if detection via parent
- Python: if_statement→"if", elif_clause→"else_if", else_clause→"else", for_statement→"for", while_statement→"while", with_statement→"with", try_statement→"try", except_clause→"catch", finally_clause→"finally", match_statement→"match", case_clause→"match_arm", 4 comprehension types→"comprehension"
- Rust: if_expression→"if", for_expression→"for", while_expression→"while", loop_expression→"loop", match_expression→"match", match_arm→"match_arm", unsafe_block→"unsafe", async_block→"async"

**Condition text extraction** (~30 tests):

- Per block kind × language: condition field, left/right, init/cond/incr, value/subject, parameter
- Truncation at 128 chars (boundary test at exactly 128, at 200, at 50)
- Null for else, finally, try, loop, unsafe, async

**Sibling detection** (~10 tests):

- if+else, if+else_if+else, try+catch+finally, switch cases, match arms
- No false siblings (for+while adjacent are NOT siblings)
- Single-branch if has empty siblings

### Integration Tests (`block_kind.integration.test.ts` — new file)

Parse real code with tree-sitter, run `build_index_single_file()`, verify scope annotations:

- TS if/else-if/else chain with calls
- TS for/while/do-while loops
- TS try/catch/finally
- TS switch/case with default
- TS nested control flow (if inside for inside try)
- TS complex condition truncation
- Python if/elif/else
- Python for/while loops + comprehensions
- Python try/except/finally + match/case + with
- Rust if/else, match, for/while/loop, unsafe/async
- Cross-language: non-block scopes have null block_kind

### Fixture Files (in `tests/fixtures/{lang}/code/control_flow/`)

Create fixture source files for each language covering all control flow constructs:

- TypeScript: `if_else.ts`, `loops.ts`, `try_catch.ts`, `switch.ts`, `complex.ts`
- Python: `if_elif_else.py`, `loops.py`, `try_except.py`, `match_case.py`, `with_statement.py`, `complex.py`
- Rust: `if_match.rs`, `loops.rs`, `unsafe_async.rs`, `complex.rs`
- JavaScript: mirrors TypeScript without type annotations

### Existing Test Updates

- Update `LexicalScope` literals in ~60-80 tests to include `block_kind: null, condition_text: null, sibling_scope_ids: []`
- Regenerate JSON fixtures via `npm run generate-fixtures -- --all`
- Update serialization round-trip test in `index_single_file_json.test.ts`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Unit tests cover all BlockKind mappings for all 4 languages
- [ ] #2 Unit tests cover condition_text extraction for each block kind that has a condition
- [ ] #3 Unit tests verify truncation boundary behavior (128 chars)
- [ ] #4 Integration tests parse real code and verify block_kind, condition_text, sibling_scope_ids for TS, Python, Rust
- [ ] #5 Fixture files created for each language covering all control flow constructs
- [ ] #6 Existing test LexicalScope literals updated with new fields
- [ ] #7 JSON fixtures regenerated
- [ ] #8 All tests green (new + existing)
<!-- AC:END -->
