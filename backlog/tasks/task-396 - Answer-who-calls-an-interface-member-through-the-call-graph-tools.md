---
id: TASK-396
title: "Answer who calls an interface member through the call-graph tools"
status: To Do
assignee: []
labels:
  - mcp
  - call-graph
dependencies:
  - TASK-389
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

"Who calls `IDisposable.dispose`?" is a question the call graph can now answer
and no tool will. TASK-389 made a call on an interface-typed receiver record an
edge to the interface member as well as to the implementations that run, so the
edge exists in the resolution data, in the callers index, in the corpus
fingerprint and in triage evidence. A user cannot reach it: `resolve_symbol_ref`
finds a target by scanning `call_graph.nodes`, and an interface member declares
no body, so it is never a node and never matches. Both `traverse_call_graph` and
`show_call_graph_neighborhood` refuse the reference before they look.

## Why the member is not a node

A call-graph node is a callable with a body — something that can run, and that
entry-point detection can report as dead. An interface member is a declaration,
so making it a node would put a symbol into the dead-code population that can
never be alive. The edge is real; the endpoint is a declaration rather than a
body, and the tools have no way to name such an endpoint today.

## What closing it requires

A way to address a declaration as a query target without making it a call-graph
node: `resolve_symbol_ref` matching interface members from the definition
registry when no node matches, and the traversal tools rendering such a target
as a leaf — it has callers and no callees. `build_callers_index` already keys
by the member, so the upstream direction needs no new data, only a way in.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A symbol reference naming an interface member resolves through the call-graph tools, and the callers listing reports every call site that dispatches through that member.
- [ ] #2 An interface member is rendered as a leaf: it has callers and no callees, and it never enters the entry-point set or the node count.
- [ ] #3 The ordering guarantee holds — a declaration target has no location-bearing node, so whatever key orders it is stated and total.

<!-- AC:END -->
