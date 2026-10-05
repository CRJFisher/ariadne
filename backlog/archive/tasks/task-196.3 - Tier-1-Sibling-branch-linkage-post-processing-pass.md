---
id: TASK-196.3
title: "Tier 1: Sibling branch linkage post-processing pass"
status: To Do
assignee: []
created_date: "2026-03-26 11:26"
labels:
  - core
  - tier-1
dependencies:
  - TASK-196.2
parent_task_id: TASK-196
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Implement a post-processing pass after scope creation that populates `sibling_scope_ids` to link alternative branches of the same control flow decision.

### Sibling Groups

- **if / else_if / else**: All branches of the same if-chain are siblings
- **try / catch / finally**: All parts of the same try-statement are siblings
- **switch_case**: All cases under the same switch are siblings
- **match_arm**: All arms under the same match are siblings

### Algorithm

Add `link_sibling_scopes(scopes: Map<ScopeId, LexicalScope>): Map<ScopeId, LexicalScope>` in `scopes.ts`.

**For switch/match**: Children of a `switch`/`match` scope with `block_kind` `"switch_case"`/`"match_arm"` are siblings of each other.

**For try/catch/finally**: The `try` scope's children with `block_kind` `"catch"` or `"finally"` are siblings with the `try` scope itself.

**For if/else_if/else (TS/JS)**: An `if` scope with child `else_if` scopes forms a chain. Walk the chain: `if` → child `else_if` → child `else_if` → ... All are siblings. (TS/JS nests else-if as children, not siblings at the same level.)

**For if/elif/else (Python)**: `elif_clause` and `else_clause` are children of the `if_statement` scope. Group all children with `block_kind` in `{"else_if", "else"}` together with the parent `if` scope.

Call `link_sibling_scopes()` at the end of `process_scopes()` before returning.

### Edge Cases

- Single `if` with no else → `sibling_scope_ids: []`
- Nested if inside for → each has its own sibling group
- Python `for...else` / `while...else` → the `else_clause` child of a `for`/`while` scope should be a sibling of the loop (or handled as a separate pattern)
- Multiple `except` clauses under one `try` → all are siblings with the try and each other
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 if/else_if/else scopes reference each other in sibling_scope_ids
- [ ] #2 try/catch/finally scopes reference each other in sibling_scope_ids
- [ ] #3 All switch_case children of a switch scope reference each other
- [ ] #4 All match_arm children of a match scope reference each other
- [ ] #5 Scopes that are NOT alternative branches have empty sibling_scope_ids
- [ ] #6 Sibling linkage is bidirectional (if A lists B, B lists A)
- [ ] #7 Nested control flow has separate sibling groups at each level
- [ ] #8 Python elif/else and multiple except clauses are correctly grouped
<!-- AC:END -->
