---
id: TASK-196.6
title: "Tier 2: Build intra-function CFG from annotated scope tree"
status: To Do
assignee: []
created_date: "2026-03-26 11:27"
labels:
  - core
  - tier-2
dependencies:
  - TASK-196.3
  - TASK-196.5
parent_task_id: TASK-196
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Implement the CFG construction algorithm that derives a control flow graph per function from the Tier 1 annotated scope tree and the flat `enclosed_calls` list.

### New Module: `packages/core/src/trace_call_graph/build_cfg.ts`

**Function signature:**

```typescript
function build_cfg(
  enclosed_calls: readonly CallReference[],
  body_scope_id: ScopeId,
  scope_lookup: (scope_id: ScopeId) => LexicalScope | undefined
): IntraFunctionCfg | undefined;
```

Returns `undefined` when the function body has no block-scope children (pure sequential flow).

### Algorithm

**Phase A — Collect scope subtree:** Walk `child_ids` recursively from `body_scope_id`. If no block-type children exist, return `undefined`.

**Phase B — Group calls by scope:** Group `enclosed_calls` by `call.scope_id`. Sort each group by source position.

**Phase C — Interleave elements:** For each scope, create a sorted sequence of direct calls and child scopes, ordered by source position. Consecutive calls in the same scope form one basic block.

**Phase D — Recursive CFG construction:** `build_scope_fragment(scope_id)` returns a `CfgFragment { entry_block_id, exit_block_ids }`:

- **Sequential calls**: Group into basic block, wire from previous fragment with `sequential` edge.
- **if/else_if/else** (from `sibling_scope_ids`): Create conditional edges from predecessor to each branch. If no `else`, add sequential edge bypassing the if. All exits converge on next element. Use `processed_scopes` set to avoid double-processing siblings.
- **for/for_in/while**: Create loop header block, `loop_entry` edge to body, `loop_back` from body exits to header, sequential exit.
- **do_while**: Body is entry (always executes once), `loop_back` from body to condition check, sequential exit.
- **try/catch/finally**: `exception` edge from try to catch. Both flow to finally (if present). Finally is sole exit.
- **switch/match**: Conditional edges to each case/arm from decision point. All exits converge.
- **with/comprehension/unsafe/async/generic**: Sequential — build inner fragment, wire with sequential edges.

**Phase E — Entry/exit computation:** Entry = first element's entry. Exits = last element's exits.

### Integration into `trace_call_graph.ts`

- Add `ScopeRegistry` parameter to `trace_call_graph()` and `build_function_nodes()`
- In `build_function_nodes()`, call `build_cfg()` for each callable and attach to `CallableNode`
- Update call site in `Project.get_call_graph()` to pass `this.scopes`
- Update existing tests to pass `ScopeRegistry`

### Performance

- Early exit for functions with no block children (common case)
- O(S + C) per function where S = scopes, C = calls (both typically < 50)
- No new parsing — uses only data already in memory
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 build_cfg() returns undefined for straight-line functions (no block scopes)
- [ ] #2 For `f() { a(); if(x) { b() } else { c() }; d() }`, CFG has 4 basic blocks with conditional edges from a() to b()/c() and sequential edges to d()
- [ ] #3 For loops produce loop_entry and loop_back edges
- [ ] #4 Do-while body is the entry (always executes first)
- [ ] #5 Try/catch produces exception edge from try block to catch block
- [ ] #6 Try/catch/finally: finally is reached from both try and catch exits
- [ ] #7 Switch/match produces conditional edges to each case/arm
- [ ] #8 Nested control flow composes correctly (if inside for, try inside if, etc.)
- [ ] #9 Empty branches produce zero-call basic blocks that preserve structural fidelity
- [ ] #10 All edge and block IDs reference valid entries in the blocks map
- [ ] #11 trace_call_graph() accepts ScopeRegistry and attaches cfg to CallableNodes
- [ ] #12 Project.get_call_graph() passes scopes through
<!-- AC:END -->
