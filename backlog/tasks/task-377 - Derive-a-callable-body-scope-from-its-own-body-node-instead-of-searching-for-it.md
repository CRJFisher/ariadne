---
id: TASK-377
title: "Derive a callable body scope from its own body node instead of searching for it"
status: To Do
assignee: []
created_date: "2026-07-30 14:10"
labels:
  - scope_construction
  - call-graph
  - bug
  - comparative-analysis
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

When Ariadne cannot attach a function to its body scope, **every call made inside that function silently disappears from the call graph**. The function is reported with no outgoing edges, so its callees lose an incoming edge and can be declared unreachable — a false entry point produced by an indexing failure rather than by the code. Nothing in the output distinguishes this from a function that genuinely calls nothing; the only trace is a `console.warn` on stderr during load.

## Root cause

`find_body_scope_for_definition` (`packages/core/src/index_single_file/scopes/scope_lookup.ts:25-130`) is handed only the definition's **name** and the name's location, and reconstructs the body scope by proximity search over every function/method/constructor scope in the file. Its own doc comment enumerates four ordered strategies: smallest containing anonymous scope, same-line-plus-name-match, within-5-lines-plus-name-match, within-2-lines with at least one anonymous side. When all four miss it throws (`:127-129`).

Five call sites in `packages/core/src/index_single_file/definitions/definition_builder.ts` (`:240`, `:289`, `:381`, `:431`, `:490`) catch that throw, `console.warn`, and leave `body_scope_id` undefined. `trace_call_graph.ts:31-34` then `continue`s on any callable with no `body_scope_id`, so the callable becomes a node with zero enclosed calls. That skip is correct for interface method signatures — its comment says so — but it cannot tell a signature apart from a failed lookup, so both are silently swallowed.

The search exists only because the information was discarded upstream. The `.scm` patterns already _match_ the enclosing definition node while capturing only the name identifier — `python.scm:100-104` matches `(module (function_definition name: (identifier) @definition.function))`, and the method, constructor, nested and decorated variants at `:106-133`, `:250-267` have the same shape. `CaptureNode` carries the live tree-sitter node (`capture_types.ts:94-101`), so the enclosing definition and its `body` child are reachable from the capture that is already in hand.

Graphify has no equivalent failure mode for a structural reason worth copying: its definition walk queues `(caller_nid, body_node)` tuples at the moment it mints the definition (`graphify/extractors/engine.py:2345`, `:3876`) and walks calls out of those exact nodes. Body attachment is a fact recorded at capture time, not a fact recovered later.

## Why this is exactly derivable

`create_scope_id(type, location)` (`scopes/scopes.ts:303`) is a pure function of scope type and location, and the scope pass builds each scope's location by running the language's `ScopeBoundaryExtractor` over the scope-creating node (`scopes.ts:164`, `boundary_base.ts:9-14`). If the definition builder resolves the same body node the scope pass resolved and applies the same boundary transform, it computes the identical `ScopeId` by construction — no search, no tolerance windows, no throw.

Python is the case that proves the transform must be shared rather than reimplemented: `PythonScopeBoundaryExtractor` derives the body-start column from the `:` token because Python has no brace (`extractors/python_scope_boundary_extractor.ts:14-17`).

## Work plan

1. **Expose the body node on the definition capture.** In `packages/core/src/index_single_file/definitions/definition_builder.ts`, at each of the five sites, walk from the captured name node (`CaptureNode.node`) to the enclosing definition node and take its body child. Put that walk in one helper per language family, alongside the existing scope boundary extractors, so the `function_definition` / `method_definition` / `arrow_function` / `decorated_definition` shapes are named in one place rather than five. Nothing changes in the `.scm` files — the patterns already match these nodes.
2. **Compute the ScopeId, do not search for it.** Feed the resolved body node through the file's `ScopeBoundaryExtractor.extract_boundaries` and `create_scope_id`, so the id matches the one the scope pass registered. Assert the computed id is present in `context.scopes`; a miss is now a real invariant violation, not a heuristic shortfall.
3. **Delete `find_body_scope_for_definition`** (`scopes/scope_lookup.ts:25-130`) and `scope_lookup.test.ts` in full, and remove the five try/catch/`console.warn` blocks in `definition_builder.ts`. `body_scope_id` becomes non-optional for functions and constructors; keep it optional on `MethodDefinition` only for interface signatures (`packages/types/src/symbol_definitions.ts:116`), which genuinely have no body.
4. **Make the interface-signature skip explicit** in `trace_call_graph.ts:31-34`. Once a missing `body_scope_id` can only mean an interface signature, assert that rather than inferring it — a body-less method on a class is now a bug, and should say so.
5. **Update the two comments that document the search** — `queries/javascript.scm:115` and `capture_handlers/capture_handlers.javascript.ts:225` both instruct future authors to place the property-identifier location so `find_body_scope_for_definition` can find it. That constraint disappears with the function.

## Tests

- Reproduce the four shapes `scope_lookup.test.ts` currently covers as **integration** tests over a real indexed file rather than synthetic scope maps: a multi-line signature, an arrow function assigned to a const, a nested function inside a function body, and a Python decorated method. Each asserts the callable's calls appear in the call graph, not merely that a ScopeId was returned.
- Add the regression that names the functionality: a function whose body contains a call to a second function, where the second function has no other caller. Assert the second function is **not** an entry point. This fails today whenever body attachment misses and passes vacuously if only the ScopeId is asserted.
- Keep green: `definition_builder.test.ts`, `scopes.test.ts`, `boundary_extractor.integration.test.ts`, the four language integration suites in `project/`, and `trace_call_graph.test.ts`.

## Provenance

Identified by comparing Ariadne against Graphify (`~/workspace/tools/graphify`), whose definition-time body queueing has no counterpart failure mode. Every Ariadne citation in this task was verified against source on 2026-07-30.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `find_body_scope_for_definition` and `scope_lookup.ts` no longer exist, and no `console.warn` about a missing body scope remains in `definition_builder.ts`.
- [ ] #2 Each of the five definition-builder sites resolves `body_scope_id` from the definition's own body node via the language's `ScopeBoundaryExtractor` and `create_scope_id`, with no proximity, line-window or name-matching fallback anywhere in the path.
- [ ] #3 `body_scope_id` is non-optional on `FunctionDefinition` and `ConstructorDefinition`; it remains optional on `MethodDefinition` only for interface signatures, and `trace_call_graph.ts` asserts that case explicitly instead of skipping any callable that lacks one.
- [ ] #4 Integration tests over real indexed files cover a multi-line signature, a const-assigned arrow function, a function nested in a function body, and a Python decorated method — each asserting the callable's enclosed calls reach the call graph.
- [ ] #5 A regression test pins the user-visible effect: a callee whose only caller is inside another function's body is not reported as an entry point.
- [ ] #6 The comments at `queries/javascript.scm:115` and `capture_handlers.javascript.ts:225` no longer instruct authors to shape captures around the deleted lookup.
- [ ] #7 `definition_builder.test.ts`, `scopes.test.ts`, `boundary_extractor.integration.test.ts`, `trace_call_graph.test.ts` and the four `project/*.integration.test.ts` suites stay green.

<!-- AC:END -->
