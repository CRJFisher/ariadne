---
id: TASK-362.5
title: "Types package — delete the dead island, split the stage-straddlers, reconcile Resolution"
status: Done
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - types-package
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Program Area 5 (`backlog/drafts/ia-review.refactor-program.md`). Effort L,
risk low (mechanical churn, compiler-guided). Independent starting point —
can run in parallel with TASK-362.1 and TASK-362.2. Blocks TASK-362.6 (the
`SemanticIndex` move must land before the `registries/type.ts` import
cleanup).

All verified:

- **Dead island**: `codegraph.ts`, `calls.ts`, `classes.ts`,
  `false_positive_results.ts`, `immutable.ts`, `type_kind.ts` have zero
  consumers outside the types package — ~450 LOC of dead public API kept
  alive only by mutual intra-package reference and the barrel. `aliases.ts`
  (`// TODO: remove all of these`) is coupled to live code only via
  `DocString` in `symbol_definitions.ts`. `false_positive_results.ts` is a
  stale duplicate of the triage wire schema now owned by
  `skill-protocol/src/triage_results.ts` — deletion, not rename.
- **Name collision behind a leaky barrel**: `query.ts:83` `Resolution<T>` vs
  `symbol_references.ts:315` `Resolution` (and two `ResolutionConfidence`s);
  the barrel hides the collision by silently omitting `query.ts`'s exports,
  which have zero production callers.
- **Stage-straddling / stage-named files**: `call_chains.ts` mixes call-graph
  structure with resolution-failure diagnostics; `symbol_references.ts` mixes
  stage-1 reference inputs with stage-2 resolution outputs;
  `index_single_file.ts` is named after a pipeline stage while holding
  `LexicalScope`/`TypeInfo`/`TypeMemberInfo`/`ReferenceType` whose main
  consumers are in `resolve_references/`; `common.ts` is a catch-all.
- **`SemanticIndex` lives in stage-1 internals** despite being the persisted
  contract composed entirely of types-package types;
  `persistence/serialize_index.ts` and `registries/type.ts` must reach into
  `index_single_file/index_single_file.ts` for it.

### Target structure

```
types/src/
├── location.ts               # Location, FilePath, Language, LocationKey   (from common.ts)
├── member_info.ts            # LocalMemberInfo, LocalParameterInfo         (from common.ts)
├── lexical_scope.ts          # LexicalScope                                (from index_single_file.ts)
├── type_member_info.ts       # TypeInfo, TypeMemberInfo                    (from index_single_file.ts)
├── reference_type.ts         # ReferenceType                               (from index_single_file.ts)
├── semantic_index.ts         # SemanticIndex                               (moved from core stage-1)
├── call_graph.ts             # CallGraph, CallableNode, CallReference, …   (from call_chains.ts)
├── resolution_failure.ts     # ResolutionFailure*, CallSiteSyntax, ReceiverKind (from call_chains.ts)
├── resolution.ts             # Resolution, ResolutionConfidence, ResolutionReason (from symbol_references.ts)
└── …                         # symbol_references.ts keeps only the reference variants + guards
```

Deleted: the seven dead-island files and `query.ts`'s resolution layer
(`Resolution<T>`, `is_resolution`, `resolve_*` factories — zero production
callers), which dissolves the collision and the barrel's hand-maintained
omission list; the barrel returns to uniform `export *`.

### Work

1. Migrate `DocString` off `aliases.ts` (inline the alias into
   `symbol_definitions.ts`), then delete the island in one commit — the
   compiler proves nothing outside the package breaks.
2. `git mv`-shaped splits for the live files; update importers across
   core/mcp/skills (mechanical, compiler-guided).
3. Move `SemanticIndex` to `types/src/semantic_index.ts`;
   `index_single_file.ts`, `serialize_index.ts`, and `registries/type.ts`
   import it from `@ariadnejs/types`.
4. Adopt the `@language` doc-tag convention on every language-specific union
   member (`ReceiverKind.type_cast` TS, `dunder_protocol` Python,
   `path_prefix` Rust, …) and mark `type_id.ts`'s silently JS/TS-only scope.

### Small-item rows owned by this task

- **Row 30** — delete `type_id.ts`'s `@deprecated Use TypeName instead`
  marker (`TypeName` does not exist).
- **Row 31** — delete `entry_point.ts` `SyntacticFeatures.is_inside_try`
  (permanently `false`, never surfaced by core; update triage fixtures).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] The seven dead-island files and `query.ts`'s resolution layer are
      deleted; the types barrel is a uniform `export *` with no
      hand-maintained omission list.
- [x] Exactly one `Resolution` and one `ResolutionConfidence` exist in the
      package, in `resolution.ts`.
- [x] No types file is named after a pipeline stage; `common.ts` is gone;
      each new file's name is fully true of its contents.
- [x] `SemanticIndex` lives in `types/src/semantic_index.ts`;
      `serialize_index.ts` and `registries/type.ts` import it from
      `@ariadnejs/types` (no deep stage-1 path).
- [x] Every language-specific union member carries an `@language` doc tag;
      `type_id.ts` marks its JS/TS-only scope.
- [x] Rows 30 and 31 landed (triage fixtures updated); all packages compile;
      full test suite green.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The types package is the vocabulary of the whole pipeline, and its file
layout is the map a reader uses to find a type. This work makes that map
truthful: every file name states exactly what it holds, the barrel is a
uniform `export *` with no hand-maintained omission list, and the ~450 LOC
of dead public API that only referenced itself is gone.

The structure follows the pipeline's own seams. `location.ts`,
`member_info.ts`, `lexical_scope.ts`, `type_member_info.ts`, and
`reference_type.ts` hold the stage-1 vocabulary; `semantic_index.ts` holds
the persisted single-file contract (`SemanticIndex`), so core's
`index_single_file/` owns only the builder and `serialize_index.ts` and
`registries/type.ts` import the shape from `@ariadnejs/types`;
`resolution.ts` holds the one `Resolution`/`ResolutionConfidence`/
`ResolutionReason`; `resolution_failure.ts` holds the resolver's failure
diagnostics plus the call-site syntax observations classifiers compose with
them; `call_graph.ts` holds the graph structures (`CallGraph`,
`CallableNode`, `CallReference`, `ResolvedSymbols`). `symbol_references.ts`
keeps only the reference variants and their guards; `query.ts` keeps only
the tree-sitter query base types — its shadow `Resolution<T>` layer (zero
production callers) is deleted, which is what dissolved the name collision
the old barrel papered over. `CallbackContext` lives beside its only
consumer (`FunctionDefinition.callback_context` in
`symbol_definitions.ts`), so no reverse edge runs from definitions back
into the graph file. Language-specific union members carry `@language`
tags, and `type_id.ts` declares its JS/TS-only scope.

To navigate: start at the barrel — each `export *` line names a concern;
the file name is the contract. The persisted-index seam is
`types/semantic_index.ts` (shape) ↔ `core/index_single_file/` (builder).

Known edges: the published dist can carry stale compiled outputs of the
deleted files until a clean build runs before publish (`tsc --build` never
prunes); the removed public exports ride the existing linked major
changeset. `query.ts` remains a candidate for a future `ast_node.ts` /
`query_result.ts` split.

### Implementation details

- Deleted: `aliases.ts` (after inlining `DocString` into
  `symbol_definitions.ts`), `codegraph.ts`, `calls.ts`, `classes.ts`,
  `false_positive_results.ts`, `immutable.ts`, `type_kind.ts`, and
  `query.ts`'s `Resolution<T>`/`ResolutionConfidence`/
  `QueryResolutionReason`/`is_resolution`/`resolve_*` layer.
- Splits (via `git mv` so history follows the larger half): `common.ts` →
  `location.ts` + `member_info.ts`; `index_single_file.ts` →
  `lexical_scope.ts` + `type_member_info.ts` + `reference_type.ts`;
  `call_chains.ts` → `call_graph.ts` + `resolution_failure.ts`;
  `resolution.ts` extracted from `symbol_references.ts`.
- `SemanticIndex` moved verbatim from core; nine core import sites (four
  source, five test, plus six inline `import(...)` sites in
  `tests/fixtures/index_single_file_json.ts`) repointed to
  `@ariadnejs/types`. The serialized index format is byte-identical, so
  `schema_version` stays at 2 and existing caches load unchanged.
- Row 30: the stale `@deprecated Use TypeName instead` marker is gone.
  Row 31: `SyntacticFeatures.is_inside_try` deleted from the interface, its
  producer (`derive_syntactic_features.ts`), three core test fixtures, and
  four triage-skill test fixtures.
- Tests moved with their modules: `location.test.ts` (was
  `common.test.ts`), `call_graph.test.ts` + `resolution_failure.test.ts`
  (was `call_chains.test.ts`), `resolution.test.ts` (split out of
  `symbol_references.test.ts`), `query.test.ts` trimmed to the surviving
  guards. New type-only modules carry no test files, matching the package
  convention.
- Review: ten-lens fan-out; both independent behavioral reviewers returned
  zero findings. Applied fixes: `CallbackContext` relocation (dissolving
  the `call_graph` ↔ `symbol_definitions` type-only cycle), a stale test
  header, and normalizing two `@language` markers inside JSDoc bullets to
  the bare-tag form. Noted, not actioned: per-spec co-locations
  (`CallSiteSyntax` beside `ResolutionFailure`, `TypeInfo` beside
  `TypeMemberInfo`), field-level `@language` boundary (convention scopes to
  union members), pre-existing "should"-style test names, and the
  dist-pruning release-process note above.
