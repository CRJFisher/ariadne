---
id: TASK-366
title: >-
  Follow multi-hop and unaliased nested object-property chains in keyed
  collection dispatch
status: To Do
assignee: []
created_date: '2026-07-21 11:19'
labels:
  - call-resolution
  - typescript
  - follow-up
dependencies:
  - TASK-356
references:
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
  - >-
    packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-356 made object-literal function collections key-aware and follows a SINGLE-HOP static alias (`var A = Ns.A; A.prop()`). Two adjacent shapes remain unresolved:

1. Direct nested chain without an alias: `const Ns = { A: { prop: fn } }; Ns.A.prop()`. receiver_resolution's `walk_property_chain` walks type members / the member index, not nested `keyed_members`, so the intermediate `.A` hop is not followed into the nested keyed collection.
2. Multi-hop static alias: `var U = A.B.C; U.prop()` (the deep-namespace origin case, e.g. Firebug.NetMonitor.Utils). `extract_collection_source`/`extract_collection_source_key` capture only a single identifier base + one property, so a 2+-hop member path is not followed.

Both share one mechanism: walk a property path through successive nested `keyed_members` entries to reach the innermost keyed collection, then match the final member. Keep the no-fan-out firewall (a miss returns a failure, never the keyless union).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Direct `Ns.A.prop()` (no alias) resolves to the nested property's function via keyed_members
- [ ] #2 Multi-hop alias `var U = A.B.C; U.prop()` resolves through the nested keyed collections
- [ ] #3 A miss at any hop returns a resolution failure, never the keyless union (no sibling fan-out)
- [ ] #4 Regression tests cover the direct-nested and multi-hop-alias shapes, including a negative no-fan-out case
<!-- AC:END -->
