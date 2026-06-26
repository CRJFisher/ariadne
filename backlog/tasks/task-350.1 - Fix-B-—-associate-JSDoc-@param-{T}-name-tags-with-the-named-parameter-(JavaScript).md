---
id: TASK-350.1
title: "Fix B — associate JSDoc @param {T} name tags with the named parameter (JavaScript)"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-350
priority: high
ordinal: 1000
plan_dedup_key: e840b97680b970a6f549daeffc2a838b13e4080c42c3abc6855dd5b40f6864ba
plan_source_task: pt-92b41982d2428b87
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
