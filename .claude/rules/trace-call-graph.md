---
paths: packages/core/src/trace_call_graph/**
---

# Trace Call Graph

## Purpose

`trace_call_graph` builds the call graph and detects raw entry points — callables with no incoming call edge. The set is deliberately raw: framework-invoked false positives (Python dunders, Flask routes, pytest fixtures) are classified downstream by `classify_entry_points/` (`enrich_call_graph` → `auto_classify` against the builtins and the permanent known-issues registry), so callers choose whether to apply that classification.

## Single-Pass Architecture

The entry point `trace_call_graph(definitions, resolutions, languages, options?)` runs a single pass. The `languages` map is the Project's per-file language state, decided once at parse ingress and threaded in exactly as the resolution phases receive it:

1. **Build callable nodes** — For each callable definition (function, method, constructor) with a body scope, create a `CallableNode` with its enclosed `CallReference[]` from resolved calls. Each node's language comes from the `languages` map; a missing entry throws. The node's `is_test` flag is set when the callable lives in a test file (`is_test_file` from `project/detect_test_file`) or a runner convention invokes it (`is_runner_invoked_callable` from `runner_suppression.ts`).
2. **Detect entry points** — Callables whose `SymbolId` never appears as a resolution target in any call reference. Anonymous callables are skipped (their invocation is indirect by construction), and `is_test` nodes are skipped unless `options.include_tests` is set.

## Module Layout

```
trace_call_graph/
├── trace_call_graph.ts     # Build CallableNodes + detect raw entry points
├── runner_suppression.ts   # Runner-convention is_test marking (Rust #[test]/#[cfg(test)], ASV benchmarks)
├── build_signature.ts      # Render a callable definition as a human-readable signature string
├── count_tree_size.ts      # Transitive fan-out metric over a CallGraph (resolved/unresolved counts)
└── index.ts                # Stage-3 barrel
```

## Key Types

- **`CallableNode`** — Node in the call graph: `{ symbol_id, name, enclosed_calls, location, definition, is_test }`
- **`CallGraph`** — Complete graph: `{ nodes: Map<SymbolId, CallableNode>, entry_points: SymbolId[], indirect_reachability? }`
- **`IndirectReachability`** — Functions reachable without direct call edges (stored in collections, passed as references)
- **`CallReference`** — A resolved call: `{ location, name, scope_id, call_type, resolutions, is_callback_invocation? }`

## Entry Point Criteria

A callable is a raw entry point if:

- It has no incoming call edges (no other function resolves a call to it)
- It is named (anonymous IIFEs, callbacks, and closures never surface)
- It is not `is_test` (test-file callables and runner-invoked callables — Rust `#[test]`/`#[cfg(test)]`, ASV benchmark methods — are suppressed unless `include_tests` is set)

Framework and language-protocol suppression (e.g. Python dunder protocols) is not this stage's job; it lives in `packages/core/src/classify_entry_points/`.

## Indirect Reachability

Two mechanisms make functions reachable without direct calls:

- **Collection read** — Function stored in a Map/Array/Object that is later read
- **Function reference** — Named function passed as a value or argument

The `ResolutionRegistry` tracks these as `IndirectReachability` entries, and the graph carries them so downstream classification avoids false-positive entry points.

## Hook Enforcement

`.claude/hooks/file_naming_validator.ts` (PreToolUse) enforces this folder's module naming,
and `file_naming_validator_stop.ts` re-checks at Stop. Downstream classification of these raw
entry points is `@.claude/rules/classify-entry-points.md`.
