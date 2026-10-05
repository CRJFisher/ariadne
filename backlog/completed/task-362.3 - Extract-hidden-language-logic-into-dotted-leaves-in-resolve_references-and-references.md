---
id: TASK-362.3
title: "Extract hidden language logic into dotted leaves in resolve_references and references"
status: Done
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - language-axis
  - stage-2-resolution
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Program Area 3 (`backlog/drafts/ia-review.refactor-program.md`). Effort M,
risk low-medium. Depends on TASK-362.1 (the dotted leaves import the shared
`detect_language`). The `index_single_file/references/` slice lands after
TASK-362.2's stage-1 restructure; the `resolve_references/` work is
independent of it.

The import axis is the repo's gold standard (`import_resolution.ts`
dispatcher + four dotted leaves). The call-resolution axis buries the same
kind of logic in neutral bodies (all verified):

- `call_resolution/path_resolution.ts` — **wholly Rust** (module doc names
  Rust; `PATH_ANCHORS = {crate, self, super}`) yet not `.rust.ts`. 87 LOC,
  zero content change needed.
- `call_resolution/constructor.ts` — ~120 LOC of Rust (`Self`, associated
  constructors, `path_prefix` gating).
- `call_resolution/function_call.ts` — Python `.endsWith(".py")` gate (L319)
  - ~115 LOC of Rust `::` resolution.
- `registries/export.ts:138` — Python guard + an unlabelled TS/JS
  arrow-function dedup block (an `export.python.ts` sibling exists; the
  TS/JS case has no dotted slot).
- `references/references.ts` (754 LOC) — inline TS/Python tree-sitter
  node-type branches inside `extract_call_site_syntax` + 4 helpers.
- `index_single_file/scopes/scopes.ts:152` — `if (file.lang === "python")`
  containment-sort hidden in a neutral file.

### Target structure

```
resolve_references/call_resolution/
├── constructor.ts                → neutral dispatch skeleton
├── constructor.rust.ts           (NEW — extracted Rust block)
├── function_call.ts              → neutral dispatch skeleton
├── function_call.rust.ts         (NEW — Rust :: path logic)
└── path_resolution.rust.ts       (git mv from path_resolution.ts — zero content change)

resolve_references/registries/
└── export.typescript.ts          (NEW — arrow-function dedup; sibling to export.python.ts)

index_single_file/references/
├── references.ts                 → capture-kind routing + ReferenceBuilder only
├── call_site_syntax.ts           (NEW — marshaller)
└── call_site_syntax.{typescript,python}.ts   (NEW — node-type branches)
```

The `scopes.ts` Python sort moves into `PythonScopeBoundaryExtractor`
(`scopes/extractors/` is the sanctioned shared-base sub-folder exception —
the right home, not a new dotted file).

**Deliberately left inline** (decided in the program — do not extract):
`receiver_resolution.ts:405` (Rust impl-block scope),
`type_preprocessing/member.ts:118` (Rust enum-impl), and `name_resolution.ts`
(JS/Rust hoisting). Each gets a one-line `@language` comment so it is
grep-discoverable.

### Work

`git mv` for the pure rename; per-file extraction for the rest, moving each
block plus its colocated tests in the same commit. Each extraction is
independently landable. Update the fault-area map entries in
`packages/types/src/ariadne_fault_area.ts` where file-precise targets move —
a one-line edit each.

### Small-item rows owned by this task

- **Row 8** — move `file_folders.ts` `is_python_file` into
  `registries/export.python.ts` (sole caller is `registries/export.ts`).
- **Row 9** — `file_folders_test_helper.ts` → `resolution_test_helpers.ts`.
- **Row 10** — `type_preprocessing/constructor.ts` →
  `constructor_bindings.ts` (collides with `call_resolution/constructor.ts`).
- **Row 12** — drop `export` from `find_class_definition` /
  `find_associated_constructor` in `call_resolution/constructor.ts`.
- **Row 13** — delete the orphaned JSDoc at
  `type_preprocessing/member.ts:27–28`.
- **Row 14** — trim `import_resolution/index.ts` to `resolve_module_path` +
  `resolve_submodule_import_path`.
- **Row 15** — replace `import_resolution.rust.ts`'s private `file_exists`
  with the shared `has_file_in_tree`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] `path_resolution.rust.ts` exists via `git mv` with zero content change;
      no neutral-named wholly-language file remains in `call_resolution/`.
- [x] `constructor.ts` and `function_call.ts` are neutral dispatch skeletons;
      their Rust blocks live in `.rust.ts` leaves with tests colocated.
- [x] `registries/export.ts` has no inline TS/JS dedup block;
      `export.typescript.ts` exists as sibling to `export.python.ts`.
- [x] `references/references.ts` holds only capture-kind routing +
      `ReferenceBuilder`; `call_site_syntax.{ts,typescript.ts,python.ts}`
      own the node-type branches.
- [x] The `scopes.ts:152` Python sort lives in
      `PythonScopeBoundaryExtractor`; the three deliberately-inline branches
      carry `@language` comments.
- [x] Rows 8, 9, 10, 12, 13, 14, 15 landed; `ariadne_fault_area.ts` targets
      updated for every moved file; full test suite green.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

The call-resolution axis hid per-language logic inside neutral-named files, so
a reader (or a Go implementer) had to read every body to find the language
touch points the import axis exposes through file names alone. This task
brings the call-resolution and reference-extraction slices up to the
dotted-leaf standard: language-specific code lives in `{module}.{language}.ts`
files, and neutral files carry only routing.

Two dispatch shapes coexist deliberately. Where the discriminator is language
itself, a marshaller switches on the threaded `language` parameter:
`references/call_site_syntax.ts` routes to `call_site_syntax.typescript.ts` /
`call_site_syntax.python.ts` (Rust yields undefined — no recognizable
method-call shape), with `language` threaded from `index_single_file.ts`
through `process_references` and `ReferenceBuilder`. Where the discriminator
is a syntactic marker only one language produces (`Self`, a `::`
`path_prefix`), the neutral spine calls a self-guarding leaf unconditionally:
`constructor.rust.ts` and `function_call.rust.ts` return null for any other
call shape, so `constructor.ts` / `function_call.ts` carry no Rust literals. A
literal language switch there would duplicate the shared resolution spine into
every leaf.

Navigation: `call_resolution/path_resolution.rust.ts` (a pure rename) holds
the Rust module-path walking both leaves share.
`registries/export.typescript.ts` owns the arrow-function export dedup
decision beside `export.python.ts`, which gained `is_python_file`. Capture
ordering is a `ScopeBoundaryExtractor` responsibility: the common location
sort lives in `boundary_base.ts` (with the location-geometry helpers), and
`PythonScopeBoundaryExtractor.sort_captures` owns the containment sort. The
Python callable-instance gate in `function_call.ts` reads the threaded
languages map, not the file extension.

Sharp edges: `receiver_resolution.ts`, `type_preprocessing/member.ts`, and
`name_resolution.ts` keep small interwoven language branches inline by design,
marked with `@language` comments for grep. `SELF_KEYWORD_TEXTS` is duplicated
across the two call-site leaves (hoisting it would cycle leaf↔marshaller).
`has_file_in_tree` accepts absolute paths by relativizing against the tree
root, which let the Rust import resolver's private wrapper dissolve. The
fault-area map needed no edits — no file-precise target moved.

<!-- SECTION:NOTES:END -->
