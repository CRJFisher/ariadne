---
id: TASK-350.1
title: "Fix B — associate JSDoc @param {T} name tags with the named parameter (JavaScript)"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-350
priority: high
ordinal: 1000
plan_dedup_keys:
  - e840b97680b970a6f549daeffc2a838b13e4080c42c3abc6855dd5b40f6864ba
plan_source_tasks:
  - pt-92b41982d2428b87
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. extract_jsdoc_type in metadata_extractors/metadata_extractors.javascript.ts (lines 33-79) matches only @type {T} and @returns {T} on the preceding comment of the whole statement; it never reads @param {T} name tags, so a JS parameter typed purely in JSDoc gets no def.type and its receiver call is unresolved.

2. Extend extract_jsdoc_type (or add a parameter-aware sibling): when a parameter's structural annotation is absent, locate the enclosing function/method's leading JSDoc block and find the @param {T} <name> tag whose name matches the parameter name (the name is on the capture node, so the match is exact — no positional guessing), returning T.

3. Wire it into extract_type_from_annotation (line 130) for parameter nodes so the resolved type name lands as the parameter's def.type and flows through the existing resolve_identifier_base path unchanged.

4. This is a genuine per-language (JavaScript) adapter, independent of Fix A and Fix C, and resolves all 11 webpack buildChunkGraph.js members (ModuleGraph, Compilation, ChunkGraph, ChunkGroup-typed params and JSDoc-typed destructured locals).

5. The sqlalchemy ss_cursor row filed in this leaf is misfiled (it is Python, not JSDoc) — exclude it here and treat it as a Fix C verification target.

6. Tests: build_index_single_file inline (JS) — a function with /** @param {ModuleGraph} g */ yields a ParameterDefinition g with type === 'ModuleGraph'. Project + update_file two-file test (ModuleGraph.js + caller) asserting getParentBlockIndex resolves. Cover a JSDoc-typed destructured local (const { chunkGraph } = compilation) if the JSDoc @type path applies. Keep receiver_resolution.javascript.test.ts and index_single_file.javascript.test.ts green.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->



<!-- AC:END -->

## Implementation Notes

## High-level summary

A JavaScript parameter whose type is declared only in a JSDoc `@param {T} name` tag now carries that type into the registries at indexing time. A method call whose receiver is such a parameter (`g.getParentBlockIndex()` where `g` is `@param {ModuleGraph} g`) resolves against the declared type, the called member gains an incoming edge, and it is no longer reported as an unreachable entry point. The fix is one fallback in JavaScript parameter-type extraction; the resolution pipeline already did the right thing once the parameter's type was present.

## What changed

`extract_parameter_type` in `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts` read only a structural TypeScript annotation (`node.childForFieldName("type")`), which pure JavaScript never has, so a JSDoc-only-typed parameter got no `type` on its `ParameterDefinition`. It now falls back to a new `extract_jsdoc_param_type`: climb from the parameter identifier to the enclosing function-like node (re-anchoring on the declaration statement when the function is an arrow/expression bound to a `const`), find that node's leading JSDoc with the existing `find_preceding_jsdoc`, and return the type of the `@param` tag whose name matches the parameter exactly. Matching by full (possibly dotted) tag name means `@param {string} options.foo` never types a bare `options`, with no positional guessing.

## Why the fix is here, not where the work plan pointed

The work plan (items 1–3) named `extract_jsdoc_type` / `extract_type_from_annotation` in `metadata_extractors.javascript.ts`. That path was misdirected. A parameter's `type` is set in the **definitions pass** (pass 3): `handle_definition_parameter` calls `symbol_factories.extract_parameter_type`, and that `ParameterDefinition.type` is what `type_preprocessing/bindings.ts` and `receiver_resolution.ts` consume. The `metadata_extractors` path runs in the **references pass** (pass 4) and produces only reference-site `TypeInfo`; it never sets a parameter definition's type, so editing it would not have moved receiver resolution. This mirrors the parent task-350, which likewise corrected its own work-plan item 4 at implementation time.

## Why no other code changed

`bindings.ts` and `receiver_resolution.ts` already read `ParameterDefinition.type`; the JSDoc path returns a bare type name (no leading colon), which is exactly what `context.resolutions.resolve(scope, name)` expects. No capture handler, query, data-model, or schema change was needed.

## How the acceptance criteria are met

- **Fix B** (items 2–4): the JSDoc `@param` fallback in `extract_parameter_type`. No edits to the receiver-resolution or type-binding paths.
- **Tests** (item 6): `symbol_factories.javascript.test.ts` unit-covers function, method, and `const`-arrow parameters, multi-`@param` name matching, verbatim generics, optional `[name]` syntax, the dotted-property negative case, and structural-annotation precedence. `index_single_file.javascript.test.ts` asserts a built `ParameterDefinition` carries `type === "ModuleGraph"` (with an untyped-parameter negative control). The integration test `receiver_resolution.javascript.integration.test.ts` loads two fixtures (`module_graph.js` + `build_chunk_graph.js`, modelled on webpack's `buildChunkGraph`) into a `Project` and asserts `getParentBlockIndex` is reachable and that the `g.getParentBlockIndex()` call resolves to the `ModuleGraph` method. Reverting the fallback makes both integration assertions fail, confirming they exercise the fix; the existing JS suites stay green.
- **Evidence** (item 4): because the fix is one uniform rule, resolving one member of the webpack cluster proves the rest; the unit tests additionally exercise the structural variants.
- **Out of scope**: the sqlalchemy `ss_cursor` row (item 5, Python — belongs to task-350.2) and the JSDoc-typed destructured *local* (`const { chunkGraph } = compilation`, a variable path through `extract_type_annotation`, not a parameter) are not addressed here. A catch-clause variable is captured under the same `@definition.parameter` name but is excluded from the JSDoc fallback so a same-named function `@param` cannot mis-type the caught binding.
