---
paths: packages/core/src/trace_call_graph/**
---

# Trace Call Graph

## Purpose

`trace_call_graph` builds the call graph and identifies entry points — functions that are never called by other functions in the analyzed codebase.

## Single-Pass Architecture

The entry point `trace_call_graph(definitions, resolutions)` runs a single pass:

1. **Build callable nodes** — For each callable definition (function, method, constructor), create a `CallableNode` with its enclosed `CallReference[]` from resolved calls
2. **Detect entry points** — Functions whose `SymbolId` never appears as a resolution target in any call reference

## Module Layout

```
trace_call_graph/
├── trace_call_graph.ts           # Main entry point
├── filter_entry_points.ts        # Framework-specific filtering
├── filter_entry_points.python.ts # Python __main__ pattern filtering
└── index.ts
```

## Key Types

- **`CallableNode`** — Node in the call graph: `{ symbol_id, name, enclosed_calls, location, definition, is_test }`
- **`CallGraph`** — Complete graph: `{ nodes: Map<SymbolId, CallableNode>, entry_points: SymbolId[], indirect_reachability? }`
- **`IndirectReachability`** — Functions reachable without direct call edges (stored in collections, passed as references)
- **`CallReference`** — A resolved call: `{ location, name, scope_id, call_type, resolutions, is_callback_invocation? }`

## Entry Point Criteria

A function is an entry point if:

- It has no incoming call edges (no other function resolves a call to it)
- It is not indirectly reachable (not stored in a collection that is read, not passed as a function reference)
- It passes language-specific filters (e.g., Python `if __name__ == "__main__"` patterns)
- Test functions are marked with `is_test: true` on the `CallableNode`

## Indirect Reachability

Two mechanisms make functions reachable without direct calls:

- **Collection read** — Function stored in a Map/Array/Object that is later read
- **Function reference** — Named function passed as a value or argument

These are tracked via `IndirectReachability` entries to avoid false-positive entry point detection.
