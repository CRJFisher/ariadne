---
id: TASK-362.6
title: "Align stage boundaries and barrels with the pipeline order"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - stage-boundaries
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Program Area 6 (`backlog/drafts/ia-review.refactor-program.md`). Effort M,
risk medium — touches the resolution hot path. Depends on TASK-362.5 (the
`SemanticIndex` move feeds the `registries/type.ts` import cleanup) and lands
after TASK-362.2/.3 so the barrel repair is written once against final file
names.

Four verified boundary violations plus a barrel layer that misrepresents
ownership:

1. **Layering inversion**: `resolve_references/registries/type.ts:20`
   value-imports `resolve_namespace_export` from
   `../call_resolution/method_lookup` — a data store depending on the
   call-resolution logic layer, a soft cycle saved only by TS value-load
   timing. The function is an export-chain utility with 3 callers, misplaced
   in `method_lookup.ts`.
2. **Cross-stage value import**: `call_resolution/call_resolver.ts:44`
   imports `find_enclosing_function_scope` from stage-1
   `index_single_file/scopes/utils` — a pure scope-tree walk with no
   indexing concern.
3. **Stage-order inversion**: `project/import_graph.ts` value-imports
   `resolve_module_path`/`resolve_submodule_import_path` from
   `resolve_references/import_resolution` — a stage-2 resolution-time
   artifact living in `project/`.
4. **Misnamed store**: `resolve_references/resolve_references.ts` holds
   `class ResolutionRegistry` — a store wearing the folder's logic name;
   stale dist fossils (`resolution_registry.d.ts/.js`) confirm a reverted
   rename.
5. **Barrels**: `project/index.ts` re-exports five registries _from
   `resolve_references/`_ while omitting `load_project`, `is_test_file`, and
   every `file_loading` symbol; `resolve_references/index.ts` is a
   zero-export doc-only file; `persistence/index.ts` is bypassed by every
   internal consumer.

### Work

The ruling: `project/` (the orchestrator) may depend on stages; a stage may
not depend on a later one.

1. New `resolve_references/export_chain_lookup.ts` owns
   `resolve_namespace_export` (+ `resolve_named_import`);
   `registries/type.ts`, `constructor.ts`, and `method_lookup.ts` consume it
   — one move fixes the inversion AND `method_lookup.ts`'s name-accuracy.
2. `find_enclosing_function_scope` moves to `registries/scope.ts` (it walks
   the scope store).
3. `git mv project/import_graph.ts →
resolve_references/import_resolution/`.
4. `git mv resolve_references.ts → resolution_registry.ts`; delete the stale
   dist fossils (row 35) and verify a clean rebuild.
5. Barrels: `project/index.ts` exports only project's own surface (`Project`,
   `load_project`, `is_test_file`, `ClassifyOptions`, `file_loading`
   symbols); `resolve_references/index.ts` becomes the real stage-2 barrel
   (five registries + `ResolutionRegistry`); `core/index.ts` re-points to
   sub-barrels everywhere (including the seven verified deep-path bypasses);
   consumers route through `persistence/index.ts`.

Land the two utility moves first (compiler-guided), then the `ImportGraph`
move, then the rename, then the barrel repair in a single closing commit.

### Small-item rows owned by this task

- **Row 1** — `git mv project/extract_nested_definitions.ts →
extract_parameters.ts` (exports only `extract_all_parameters`).
- **Row 5** — rename `core/src/introspection/` → `project_queries/` (stance
  word, not a concern).
- **Row 6** — delete `introspection/list_name_collisions.ts` (4-line
  pass-through, zero production consumers).
- **Row 7** — decide `explain_call_site`: wire into the MCP `core` tool group
  (its designed consumer) or delete per YAGNI — currently zero consumers.
- **Row 11** — delete `registries/definition.ts`
  `scope_to_definitions_index` (~30 LOC built and maintained, no getter, no
  reader).
- **Row 25** — single owner for `content_hash` + index/manifest writes
  (today both `project.ts::save()` and `load_project.ts`); extract
  `project_cache_strategy.ts` from `load_project.ts` (`can_use_cache`,
  `try_restore_from_cache`, manifest lifecycle).
- **Row 35** — delete the stale `dist/resolve_references/
resolution_registry.*` build fossils.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] No file under `resolve_references/registries/` value-imports from
      `call_resolution/`; `export_chain_lookup.ts` owns the export-chain
      utilities.
- [ ] `call_resolver.ts` imports nothing from `index_single_file/`;
      `find_enclosing_function_scope` lives in `registries/scope.ts`.
- [ ] `ImportGraph` lives in `resolve_references/import_resolution/`; nothing
      in `project/` value-imports resolution logic.
- [ ] `resolution_registry.ts` holds `ResolutionRegistry` via `git mv`; the
      dist fossils are gone and a clean rebuild produces current artifacts.
- [ ] Every barrel exports only its own folder's surface; `core/index.ts`
      contains no deep-path bypasses; `persistence/index.ts` is the
      persistence entry point.
- [ ] Rows 1, 5, 6, 11, 25 landed; row 7 decided and executed
      (wire-or-delete, with the decision recorded in this task's notes);
      full test suite green.

<!-- AC:END -->
