---
id: TASK-196.5
title: "Tier 2: Define CFG types (BasicBlock, CfgEdge, IntraFunctionCfg)"
status: To Do
assignee: []
created_date: "2026-03-26 11:26"
labels:
  - types
  - tier-2
dependencies:
  - TASK-196.1
parent_task_id: TASK-196
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add the type definitions for the intra-function control flow graph.

### Types in `packages/types/src/call_chains.ts`

```typescript
type CfgEdgeKind =
  | "sequential" // normal fall-through
  | "conditional" // branch based on condition (if/switch/match)
  | "loop_entry" // enter a loop body
  | "loop_back" // loop iteration back-edge
  | "exception" // enter catch/finally from try
  | "fallthrough"; // switch case fallthrough

interface CfgEdge {
  readonly source_block_id: string;
  readonly target_block_id: string;
  readonly kind: CfgEdgeKind;
  readonly label: string | null; // condition_text for conditional edges
}

interface BasicBlock {
  readonly id: string;
  readonly scope_id: ScopeId;
  readonly calls: readonly CallReference[];
  readonly location: Location | null; // null for empty blocks
}

interface IntraFunctionCfg {
  readonly entry_block_id: string;
  readonly exit_block_ids: readonly string[];
  readonly blocks: ReadonlyMap<string, BasicBlock>;
  readonly edges: readonly CfgEdge[];
}
```

Add optional `cfg` field to `CallableNode`:

```typescript
interface CallableNode {
  // ... existing fields ...
  readonly cfg?: IntraFunctionCfg;
}
```

### Design Notes

- `IntraFunctionCfg` does NOT store `function_id` — it's attached to `CallableNode` which already carries `symbol_id`. No redundancy.
- Empty blocks have `location: null` — honest about having no observable calls.
- Block IDs are opaque strings (`"b_0"`, `"b_1"`, etc.), not branded types. They are scoped to a single function's CFG.
- `cfg` is optional — `undefined` for straight-line functions with no block scopes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 BasicBlock, CfgEdge, CfgEdgeKind, IntraFunctionCfg types are exported from @ariadnejs/types
- [ ] #2 CallableNode has optional cfg?: IntraFunctionCfg field
- [ ] #3 TypeScript compiles with no errors
- [ ] #4 All existing tests pass without modification
<!-- AC:END -->
