---
id: TASK-364.8
title: "Diagnose the Duplicate export name create_py_class_id warning"
status: Done
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - investigation
  - self-indexing
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

During the `exports.javascript.ts` sweep, Ariadne's own indexer (run over its own
source) emitted a `Duplicate export name create_py_class_id` warning against
`packages/core/src/index_single_file/query_code_tree/symbol_factories/index.ts`.

The barrel aliases a re-export at `index.ts:83`
(`create_class_id as create_py_class_id`). The warning suggests the name
`create_py_class_id` is produced by the indexer more than once for that barrel —
either a genuine duplicate re-export (two sources aliased to the same public
name) or a false positive in Ariadne's own export-collision detection.

This is a self-indexing signal (Ariadne analysing Ariadne), so it doubles as a
correctness check on the export-collision logic.

### Work

1. Reproduce the warning by indexing `symbol_factories/index.ts` (or the whole
   `packages/core` source) with Ariadne.
2. Determine the root cause: is there a real duplicate public export named
   `create_py_class_id` (fix the barrel — pick one source, no aliased
   collision), or is the collision detector wrongly counting an aliased
   re-export as a duplicate (fix the detector)?
3. Fix the root cause and confirm the warning no longer fires.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] Root cause identified and recorded (real duplicate vs. detector false
      positive).
- [x] Indexing `packages/core` no longer emits
      `Duplicate export name create_py_class_id`.
- [x] If the detector was at fault, a regression test covers the aliased-
      re-export case; full core suite green.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

The warning is a **detector false positive**, not a real duplicate export. The
`symbol_factories/index.ts` barrel legitimately re-exports `create_class_id`
under two per-language aliases from two modules
(`create_class_id as create_js_class_id` from the JavaScript factory and
`create_class_id as create_py_class_id` from the Python factory). The indexer
forged a duplicate from those two distinct exports.

### Root cause

Every named re-export (`export { … } from "…"`) is indexed by the single
`handle_import_reexport` capture handler, which derived each specifier's export
metadata by calling `extract_export_info(export_stmt, <source_name>)`. That
call falls through to a file-global export cache (`build_export_cache` in
`symbol_factories/exports.javascript.ts`) whose `named_exports` map is keyed by
the **source** name. When one source symbol is re-exported under several
aliases, the map entries collapse — last write wins — so every re-export of
`create_class_id` was stamped with the last alias, `create_py_class_id`.
`ExportRegistry.update_file` then saw two exports named `create_py_class_id`
and threw `Duplicate export name "create_py_class_id"`.

The cache is correct for its real purpose — mapping a locally-defined symbol to
its export alias, where a source name is unique per file — but a re-export can
legitimately repeat a source name, so re-exports must not be resolved through
it.

### Fix

`handle_import_reexport` already extracts each specifier's `name` and `alias`
nodes, so it now builds the export metadata directly from them —
`{ is_reexport: true, export_name: alias ?? undefined }` — instead of consulting
the shared cache. Each re-export carries its own alias as `export_name`, and the
collapse is impossible. `is_reexport` is unconditionally `true` because the
`.scm` query only routes `export { … } from "…"` statements to this handler.
This is the only live JS/TS re-export path (the granular sibling handlers are
unreachable dead code), so the single-handler fix covers the whole surface, and
TypeScript inherits it because `TYPESCRIPT_HANDLERS` spreads
`JAVASCRIPT_HANDLERS`.

### How the acceptance criteria are met

- **Root cause recorded** — detector false positive, above.
- **Warning no longer fires** — indexing the real `symbol_factories/index.ts`
  barrel through `Project.update_file` no longer throws; each alias registers
  under its own export name.
- **Regression tests** — two levels: an indexing-layer test in
  `capture_handlers.javascript.test.ts` ("gives each re-export of one source
  symbol its own alias as export name") asserts the per-specifier export
  metadata, and a `Project.update_file` test in
  `project.javascript.integration.test.ts` exercises the guarantee at
  `ExportRegistry.update_file` — the layer that threw — asserting no throw and
  distinct export names/import paths. Full core suite green (2636 tests).

### Follow-ups surfaced by review

- The seven granular re-export handlers
  (`handle_import_reexport_named_alias`, `…default_original`, etc.) are
  unreachable — no `.scm` query emits their capture names — and each still
  carries the same latent cache-collapse defect. They are dead code and a
  candidate for removal under the module-hygiene theme (parent TASK-364).
- Worktree build/hook friction encountered during this task is captured in
  TASK-365.

<!-- SECTION:NOTES:END -->

