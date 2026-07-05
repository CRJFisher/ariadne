---
id: TASK-362.5
title: "Types package — delete the dead island, split the stage-straddlers, reconcile Resolution"
status: To Do
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

- [ ] The seven dead-island files and `query.ts`'s resolution layer are
      deleted; the types barrel is a uniform `export *` with no
      hand-maintained omission list.
- [ ] Exactly one `Resolution` and one `ResolutionConfidence` exist in the
      package, in `resolution.ts`.
- [ ] No types file is named after a pipeline stage; `common.ts` is gone;
      each new file's name is fully true of its contents.
- [ ] `SemanticIndex` lives in `types/src/semantic_index.ts`;
      `serialize_index.ts` and `registries/type.ts` import it from
      `@ariadnejs/types` (no deep stage-1 path).
- [ ] Every language-specific union member carries an `@language` doc tag;
      `type_id.ts` marks its JS/TS-only scope.
- [ ] Rows 30 and 31 landed (triage fixtures updated); all packages compile;
      full test suite green.

<!-- AC:END -->
