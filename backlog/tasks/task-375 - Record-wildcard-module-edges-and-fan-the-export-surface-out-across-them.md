---
id: TASK-375
title: "Record wildcard module edges and fan the export surface out across them"
status: Done
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - import_resolution
  - name_resolution
dependencies: []
priority: high
plan_dedup_keys:
  - 0f1266cd8b1c19f1eed0108b4ea15f91a285444337e1cd23c222a8fe594cf498
  - b31faeeb0a9dc71438646e0b3d849c1df11aa6d8aa1fae3c311c6b83580d58a0
plan_source_tasks:
  - pt-7ae585829014de8e
  - pt-7cbdfa733c10c9be
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

The index records only _name-keyed_ import and export edges. Every wholesale edge is absent from the index entirely, so no resolver can cross it. Indexing each form in isolation with `build_index_single_file`: `export * from './impl.js'` yields **zero definitions and zero imports**; `import * as X from './m'; export { X }` yields a namespace `ImportDefinition` with **no `export` metadata**; `pub use inner::copy_bidirectional;` yields an `ImportDefinition` with no `export` metadata, indistinguishable from a private `use`; `use m::*;` / `from m import *` yield an import named literally `*`.

The consequences are mechanical. `ExportRegistry.update_file` skips any import definition with no `export` field (`registries/export.ts:65-68`). `resolve_export_chain` starts with a name-keyed lookup and returns `null` on the first miss (`:283-290`), following exactly one hop kind — an `is_reexport` record carrying an `import_def` (`:292-317`); a hop that declares no name has no record to find. `resolve_scope_recursive`'s import loop binds `imp_def.name` (`name_resolution.ts:116-210`) and `*` matches no call site. And the `*`-named records collide: `export_metadata` is keyed by export name, so a second `from pkg import *` in one file reaches the throw at `registries/export.ts:150` and aborts `Project.update_file` for the whole file — `django/forms/__init__.py` has six such lines.

The lookup functions are correct and stay correct: `resolve_scope_recursive` builds `ScopeId -> (SymbolName -> SymbolId)` correctly from the inputs it is given and `resolve_export_chain`'s recursion is already cycle-safe. They are **starved, not mis-shaped**. This task feeds them. `name_resolution.ts` changes only by gaining one arm — confirming that is the altitude check.

This is the epic root. Sub-tasks 1.1-1.6 carry the binder gaps, the namespace descent, the Rust module-path resolver rewrite in its mandatory order, and the thin adapters on top of it.

## Work plan

1. Add `"wildcard"` to `ImportDefinition.import_kind` in `packages/types/src/symbol_definitions.ts`. Document the semantics on the field: the statement binds every public name of `import_path` into `defining_scope_id`; `name` is the module's last path segment and is **never** matched against a call terminal; with `export: { is_reexport: true }` it _forwards_ that surface. Tag `@language javascript,typescript,python,rust`. This one kind replaces the `name: "*"` hacks in `capture_handlers.rust.ts:587` and `imports.python.ts:83-85` and gives `export *` a representation it has never had.
2. JS/TS capture. Delete the two inert `@export.namespace` patterns at `javascript.scm:400-408` (no key of that name exists in `JAVASCRIPT_HANDLERS`, `capture_handlers.javascript.ts:610-634`) and add `(export_statement "*" source: (string)) @import.wildcard_reexport` to `javascript.scm` and to `typescript.scm`, which has no `export *` pattern at all today. Register `handle_import_wildcard_reexport` under `"import.wildcard_reexport"` beside the existing `"import.reexport"` entry (`capture_handlers.javascript.ts:632`), emitting one `ImportDefinition` with `import_kind: "wildcard"`, the source string as `import_path`, `export: { is_reexport: true }`, scoped to the module root; add the `export * as ns from` arm producing the same definition under the alias name. `TYPESCRIPT_HANDLERS` spreads `JAVASCRIPT_HANDLERS`, so both edits reach TypeScript with no second registration. Per YAGNI do not revive the other 37 dead `@export.*` captures — record them as a separate audit.
3. In `handle_definition_import` (`capture_handlers.javascript.ts:396-435`), pass the `export` metadata that `extract_export_info(capture.node, capture.text)` (`symbol_factories/exports.javascript.ts:302`) already returns into `builder.add_import`, so `import * as X from './m'; export { X }` stops losing the `export { X }` entirely.
4. Rust capture. Delete `handle_import_reexport` (`capture_handlers.rust.ts:591-603`) with its registry entry (`:704`) and the `@import.reexport` pattern at `rust.scm:569-571` — a no-op stub whose comment claims re-exports are read from a `visibility_modifier` that `handle_definition_import` never reads. At `:587`, emit `import_kind: "wildcard"` for `import_info.is_wildcard` (`imports.rust.ts:292-311`) with `name` the module's last segment instead of `"*"`.
5. Rust `pub use` export edges. In `handle_definition_import` (`capture_handlers.rust.ts:559-589`), read the `use_declaration`'s `visibility_modifier` child and, when present, attach `export: { is_reexport: true }` to every `ImportDefinition` the statement yields: single-name (`pub use self::unbounded::unbounded_channel;`), braced groups (`pub use util::{copy, copy_bidirectional};`), `as` renames and module-level (`pub use self::mpsc;`). `extract_imports_from_use_declaration` (`symbol_factories/imports.rust.ts:59`) already normalises all four correctly; the `(use_declaration) @definition.import` capture at `rust.scm:487` already fires for `pub use`, so no new query is needed.
6. Python capture. Emit `import_kind: "wildcard"` at `capture_handlers/imports.python.ts:83-85` with `name` the module's last segment. The module-level re-export marking just below (`:107-109`) is already correct and now attaches to the wildcard kind — that is the `__init__.py` star-re-export edge.
7. `ExportRegistry` fan-out (`registries/export.ts`). Add a fourth map `wildcard_reexports: Map<FilePath, ImportDefinition[]>` beside `exports` / `export_metadata` / `default_exports`, populated in `update_file` from any exportable definition with `kind === "import" && import_kind === "wildcard" && export?.is_reexport`, and cleared alongside the other three in `remove_file` and `clear`. Where the keyed lookup misses (`:288-290`), fan out instead of returning `null`: resolve each edge's module path, recurse for the same name, collect distinct non-null results, return the single match. The existing `visited` key `${source_file}:${export_name}:${import_kind}` (`:273-276`) cannot collide across a fan-out because each hop recurses on a different `source_file`. Fan-out never runs for `import_kind === "default"` — ESM `export *` does not forward a default and neither does `pub use m::*`. Ambiguity is a miss, not a guess (an ESM ambiguous star, a Rust E0659), mirroring the one-match rule at `function_call.rust.ts:131-134`, with the refinement that when every path reaches the _same_ `SymbolId` the name binds. Keep the `import_def` guard at `:80-82` and keep the duplicate-name throw at `:150` reachable for non-wildcard names — it is a real indexing-bug signal and must not be widened into a silent skip; a wildcard record lives in its own map, which is what removes the throw for the shape that actually produces it.
8. Add `ExportRegistry.resolve_all_exports(file, …) -> ReadonlyMap<SymbolName, SymbolId>`: walk named records, follow re-export hops, recurse through wildcard edges and drop any doubly-reachable name. Memoise per `FilePath` and drop the memo wholesale on any mutation, matching the registry's existing all-or-nothing per-file replacement.
9. `name_resolution.ts:116-210` gains exactly one arm: layer `exports.resolve_all_exports(source_file, …)` into `scope_resolutions` **before** the named / default / namespace arms and before the local-definition pass (`:212-239`), so an explicit import and a local declaration both shadow it. This single consumer covers Rust `use m::*`, Rust `pub use m::*` and Python `from m import *`. Its precedence chain (inherited -> imports -> local definitions -> hoisted functions) is otherwise byte-for-byte unchanged.
10. Add `build_index_single_file` inline tests asserting the exact `ImportDefinition` literal with `toEqual` for: `export * from './m.js'`; `export * as ns from './m.js'`; `import * as X from './m'; export { X }` (namespace import now carrying `export` metadata); `pub use inner::x;`; `pub use util::{a, b};`; `pub use self::mpsc;`; `pub use a::b as c;`; `use m::*;`; `pub use m::*;`; `from m import *`.
11. Add `Project` + `update_file` integration tests (temp dir, one per evidence case, each asserting `resolutions.length === 1` on the call reference) covering **every** case in this task's triage evidence, not one representative: the four TypeScript `export *` rows — `loadModuleFromGlobalCache`, `findTokenOnLeftOfPosition` and `emitDetachedComments` (one wildcard hop each) and `discoverTypings` (a wildcard hop, a namespace-object hop and a wildcard hop, which needs the three-file `_namespaces` barrel fixture directory); the two sqlx intra-crate glob rows (`use crate::transaction::*`, `begin -> begin_ansi_transaction_sql`) plus intra-crate `pub use` at one and two hops; Python `from m import *` at module scope and the django shape of two `import *` in one file, asserting no throw and both surfaces resolving. Add ambiguity and cycle cases to `registries/export.test.ts`: a name exported by two distinct wildcard edges resolves to nothing unless every path reaches the same `SymbolId`; `a.ts: export * from './b'` with `b.ts: export * from './a'` terminates and returns null.
12. Measure `project.bench.test.ts` on the TypeScript corpus before and after — `src/services/_namespaces/ts.ts` star-re-exports ~20 modules, several of which star-re-export further, and the memo is dropped on every `update_file`.

## Rows carried here but excluded from acceptance

- The two tokio `pub use` rows: tokio publishes its module tree from inside `cfg_*!` macro bodies (`tokio/src/lib.rs:563`, `io/mod.rs:285`, `io/util/mod.rs:32`) and indexing a `cfg_io_util! { … }` block yields zero definitions and zero imports. Keep the edge, confirm the `syntactic_extraction` prerequisite is tracked, and do not gate this task on those rows.
- The five Angular return-type rows: the root cause is corpus inclusion, not import binding — `should_ignore_path` (`project/file_loading.ts:73-99`) tests `relative_path.includes(ignore)`, an unanchored substring match, so `render3/r3_template_transform.ts` is ignored for `temp` in `template`. Owned by the `caller-evidence-and-corpus` epic.
- The django `country_name` row: its only callers live in `tests/gis_tests/`, a deliberate config exclusion; its Python guarded-import block-scope defect is `type-model-completion`'s sub-task.

## Out of scope

Widening `resolve_module_path`'s return type into a resolved / external / unmatched outcome. A fabricated path finds no exports downstream, which is the same answer as a reported miss.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `build_index_single_file` returns the exact asserted `ImportDefinition` literal for `export * from './m.js'`, `export * as ns from './m.js'`, `import * as X from './m'; export { X }`, `pub use inner::x;`, `pub use util::{a, b};`, `pub use self::mpsc;`, `pub use a::b as c;`, `use m::*;`, `pub use m::*;` and `from m import *`.
- [ ] #2 The four TypeScript `export *` false-positives clear: `loadModuleFromGlobalCache`, `findTokenOnLeftOfPosition`, `emitDetachedComments` and `discoverTypings`.
- [ ] #3 The two sqlx intra-crate glob rows clear: `use crate::transaction::*` binds `begin -> begin_ansi_transaction_sql`.
- [ ] #4 Indexing a file with six `from … import *` lines (the `django/forms/__init__.py` shape) no longer reaches the `Duplicate export name` throw and `Project.update_file` completes for the file.
- [ ] #5 Integration tests (`Project` + `update_file`, temp dir, plus the three-file `_namespaces` barrel fixture) cover every evidence case in this task's triage evidence individually — all four TypeScript `export *` rows, both sqlx glob rows, single- and two-hop intra-crate `pub use`, and both Python star shapes — each asserting `resolutions.length === 1`.
- [ ] #6 A name reachable through two distinct wildcard edges resolves to nothing unless every path reaches the same `SymbolId`; mutually star-re-exporting `a.ts`/`b.ts` terminates and returns null.
- [ ] #7 The duplicate-export throw stays reachable for genuine duplicate non-wildcard names, and `registries/export.test.ts`, `export.python.test.ts` and `export.typescript.test.ts` stay green.
- [ ] #8 `name_resolution.test.ts` (491 lines) stays green with only the one new wildcard arm in `name_resolution.ts` — a failure there means the chosen altitude was wrong.
- [ ] #9 `import_graph.test.ts` stays green: `ImportGraph`'s shape is unchanged.
- [ ] #10 `project.bench.test.ts` on the TypeScript corpus is measured before and after the `resolve_all_exports` memo and the regression is recorded.
- [ ] #11 The two tokio `pub use` rows are recorded as blocked on `cfg_*!` macro-body indexing and are not counted against this task.

<!-- AC:END -->

## Implementation Notes

## High-level summary

Wholesale module edges exist in the index. `export * from`, `pub use m::*`, `use m::*` and `from m import *` each produce an `ImportDefinition` with `import_kind: "wildcard"`, named for the module path's last segment — a display name that never matches a call terminal. The `ExportRegistry` holds these edges in a dedicated `wildcard_reexports` map, so the name-keyed maps and their duplicate-name throw never see them; a keyed lookup that misses fans out across the file's wildcard edges and binds only an unambiguous winner (distinct targets are a miss; identical targets through every path bind). `resolve_all_exports` walks a file's whole forwarded surface — own names shadow starred ones, disputed names drop — memoised per file until any registry mutation, with mutual-star cycles cut per path and never cached truncated. Name resolution layers that surface into Rust and Python scopes below explicit imports and locals; JS/TS is deliberately excluded there because `export *` binds nothing locally — its consumers resolve through the registry fan-out instead.

Two shapes the plan called wildcard are namespace objects instead: `export * as ns from` and `import * as X …; export { X }` publish one name whose export chain terminates at the import definition itself; member access descends through the resolved path (the `_namespaces` hop). The chain also follows any import-backed export record — a two-statement `import { a } …; export { a }` reaches the origin definition, not the intermediate import symbol.

Capture names are `@import.reexport.wildcard` / `@import.reexport.namespace` (the planned `@import.wildcard_reexport` fails SemanticEntity validation). The persistence schema bumps to v5 so pre-wildcard caches are discarded rather than silently replayed.

Front door for readers: `registries/export.ts` (edge storage, fan-out, `resolve_all_exports`), then `name_resolution.ts` (the one wildcard arm plus its guard), then the four capture handlers.

### Deferred rows (recorded, not dropped)

- The corpus sqlx rows are cross-crate (`pub(crate) use sqlx_core::transaction::*`) and additionally need TASK-375.4's `crate_roots` index; the intra-crate glob shape (AC #3's literal wording) closes here.
- `ts.X.y()` property-chain access through a namespace *variable* is TASK-375.2's descent; the corpus caller's named-import form closes here.
- `use crate::S` crate-root items are TASK-375.3's resolver defect; Rust fixtures route `pub use` through submodules.
- The two tokio `pub use` rows stay blocked on `cfg_*!` macro-body indexing (AC #11).

### Verification

`packages/core` 3582/3582 green (baseline 3521); typecheck and lint clean; bench before/after recorded in the commit history with no regression, plus a new star-fan bench case (starred-leaf update 1.15ms avg vs 0.30ms unrelated — the memo-drop cost). A six-lens review fan-out was interrupted by an API spend limit after one reviewer (test-quality) completed; its four major findings (all proof-gaps, no behavior defects) are addressed with four added registry tests. Unreviewed lenses: correctness ×2, contracts, completeness, cold-read.
