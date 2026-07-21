---
id: TASK-196.7
title: "Tier 2: Tests for intra-function CFG construction"
status: To Do
assignee: []
created_date: "2026-03-26 11:27"
labels:
  - testing
  - tier-2
dependencies:
  - TASK-196.6
parent_task_id: TASK-196
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Comprehensive tests for CFG construction across all control flow patterns.

### Unit Tests (`build_cfg.test.ts` — new file)

Tests construct `LexicalScope` objects with Tier 1 annotations and `CallReference` arrays programmatically.

**No CFG (undefined)** — 3 tests:

- Linear function (multiple calls, no block scopes) → undefined
- Single call, no blocks → undefined
- Zero calls, no blocks → undefined

**If/else** — 3 tests:

- `a(); if(x) { b() } else { c() }; d()` → 4 blocks, conditional+sequential edges
- If without else → 3 blocks, bypass edge
- If/else_if/else chain → multi-way conditional

**Loops** — 4 tests:

- For loop → loop_entry + loop_back edges
- While loop → same pattern
- Do-while → body-first, then condition loop_back
- Infinite loop (Rust `loop`) → no implicit exit edge

**Exception handling** — 3 tests:

- Try/catch → exception edge
- Try/catch/finally → exception + finally convergence
- Try/finally (no catch) → sequential to finally

**Switch/match** — 2 tests:

- Switch with 3 cases → 3 conditional edges
- Match with arms → same shape

**Nesting** — 4 tests:

- If inside for loop
- Try inside for loop
- For inside if branch
- Triple nesting (if > for > try)

**Empty branches** — 2 tests:

- If branch with no calls → empty basic block preserved
- All branches empty → design-dependent (undefined or minimal CFG)

**Multiple calls same scope** — 2 tests:

- Multiple calls grouped into single block
- Calls split around intervening block scope

**Adjacent control flow** — 1 test:

- If followed by for followed by try → sequential composition

**Structural invariants** — 4 tests:

- Entry block exists in blocks map
- All exit blocks exist in blocks map
- All edge IDs reference valid blocks
- Every non-entry block is reachable (target of at least one edge)

### Integration Tests (`build_cfg.integration.test.ts` — new file)

Full pipeline: parse → index → resolve → call graph with CFG:

- TypeScript if/else → verify CFG structure
- TypeScript for loop → verify loop edges
- Python if/elif/else → verify sibling-based branching
- TypeScript try/catch/finally → verify exception edges
- Straight-line function → cfg: undefined
- Nested control flow → composed edges
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 ~32 unit tests covering all control flow patterns
- [ ] #2 ~6 integration tests with real parsed code
- [ ] #3 Structural invariant tests verify CFG well-formedness
- [ ] #4 All existing trace_call_graph tests pass with updated ScopeRegistry parameter
- [ ] #5 All tests green
<!-- AC:END -->
