---
id: TASK-375.4
title: "Build a module specifier index and resolve bare specifiers through it"
status: To Do
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - import_resolution
dependencies: []
parent_task_id: TASK-375
priority: high
ordinal: 4000
plan_dedup_keys:
  - 67b364543ef865eb8d2ea5f96724dee91d4bd1837f2793fe3f5ffaac0792059f
plan_source_tasks:
  - pt-6a99fff097f05ad7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

Two module-path resolvers return the specifier verbatim as if it were a file. `import_resolution.typescript.ts:32` returns `import_path as FilePath` for every non-relative specifier, so `@nestjs/common` is cached in `ImportGraph.resolved_import_paths` (`import_graph.ts:45`, written at `:114`) as the resolved file. `import_resolution.rust.ts:33-42` probes any non-anchor leading segment as a _local_ module, so `sqlx_core::raw_sql::raw_sql` from `sqlx-postgres/src/connection/` probes `sqlx-postgres/src/connection/sqlx_core.rs`, misses, and stays a string.

Nothing in the index can answer _which directory a package or crate name denotes_: the `FileSystemFolder` tree is I/O-free by design (`resolve_references/file_folders.ts`) and holds file names only.

## Ordering — this is half two of two

This task and sub-task 1.3 rewrite the same ten-line `else` arm of `resolve_module_path_rust`. **1.3 lands first**: the `crate_roots` lookup is added _after_ the local-module probe, so the probe must already be correct or the crate branch silently absorbs local misses. This task is also the only cross-folder signature change in the epic, and it gates sub-task 1.5, which adds a new caller of `resolve_module_path_rust`.

## Work plan

1. Add `packages/core/src/resolve_references/import_resolution/module_specifier_index.ts` exporting `ModuleSpecifierIndex` with `package_roots: ReadonlyMap<string, FilePath>` (TS/JS: tsconfig `paths` key or workspace package name -> file or directory) and `crate_roots: ReadonlyMap<string, FilePath>` (Rust: crate name normalised to `_` -> the crate's `src/` root).
2. Build it once during `Project.initialize` (`project/project.ts:113`, already async and already the place that walks the tree for `get_file_tree`) from real reads of `tsconfig.json` / `jsconfig.json`, `package.json` and `Cargo.toml`. The parse must tolerate JSONC — nest's `paths` block ends with a trailing comma, so a strict `JSON.parse` throws. Where a manifest is unreadable, fall back to the directory name: sqlx's `sqlx-core/`, rustc's `rustc_codegen_ssa/` and tokio's `tokio/` all agree with their declared package names modulo `-`/`_`. Decide explicitly whether the directory-name fallback suffices before adding a TOML parser; `tsconfig` `extends` chains and `Cargo.toml` `[workspace] members` globs stay unhandled.
3. Thread the index. Because it is needed only by `resolve_module_path`, whose two callers (`import_graph.ts:114`, `registries/export.ts:300`) already receive `root_folder`, replace that parameter with `ModuleResolutionContext { root_folder, specifiers }` across the 33 non-test signatures carrying it — `import_resolution/import_resolution.ts`, `import_graph.ts:61-119`, `project/project.ts:113` and `:244`, and `resolve_module_path_rust` itself.
4. Add the `crate_roots` branch to the Rust `else` arm **after** the local-module probe from 1.3: normalise the leading segment (`-` -> `_`), look it up, and on a hit walk the remaining segments with `resolve_rust_module_path`. `find_rust_crate_root` (`:137`) already finds a crate's `src/`; this is the reverse, name-keyed direction. Unmatched leading segments stay opaque — those are genuinely external crates, and fabricated edges are worse than misses.
5. Extract the TypeScript candidate list at `import_resolution.typescript.ts:67-95` into `probe_candidates(absolute_base, root_folder)` with no behaviour change, and reuse it from a new `resolve_bare_typescript` consulted before the opaque return at `:32`, consulting `package_roots` longest-prefix first (exact key, then `k/*`). nest's `tsconfig.json:19-38` maps `@nestjs/common` to `./packages/common` — a directory, so the probe's `index.ts` candidate lands it.
6. Add integration tests covering **every** evidence case this task closes, not one representative: sqlx `sqlx_core::raw_sql::raw_sql` from `sqlx-postgres/src/connection/` resolving `raw_sql`; sqlx `rollback_ansi_transaction_sql` through the same cross-crate path; the nest `mixin` row reached through the bare specifier `@nestjs/common` whose alias target directory's `index.ts` is itself a star-re-export chain (so it exercises the parent task's fan-out too); a synthetic cross-crate `use other_crate::m::item` with a `-`/`_` directory-name mismatch; and a synthetic cross-crate `use other_crate::m::*`. Add a bare-specifier-through-`paths`-alias case to the TypeScript suite.
7. Keep `import_resolution.{typescript,rust,python,javascript}.test.ts` green — `probe_candidates` is a pure extraction — and keep `import_graph.test.ts` green, since `ImportGraph`'s shape and dependency bookkeeping are unchanged.

## Not closed here

The third cross-crate row, `compute_debuginfo_type_name`, needs one hop more: a non-`pub` `use` of a module acting as a module alias that a `super::alias::item` path traverses. That hop lands in sub-task 1.6.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `ModuleSpecifierIndex` is built once in `Project.initialize` from `tsconfig.json`/`jsconfig.json`, `package.json` and `Cargo.toml`, tolerating JSONC with trailing commas, and falls back to the directory name where a manifest is unreadable.
- [ ] #2 `root_folder: FileSystemFolder` is replaced by `ModuleResolutionContext { root_folder, specifiers }` across all 33 non-test signatures, including `resolve_module_path_rust`.
- [ ] #3 The sqlx cross-crate false-positives clear: `sqlx_core::raw_sql::raw_sql` resolves `raw_sql`, and `rollback_ansi_transaction_sql` resolves.
- [ ] #4 The nest `mixin` false-positive clears: the bare specifier `@nestjs/common` resolves through the tsconfig `paths` alias onto the directory whose `index.ts` star-re-exports.
- [ ] #5 A cross-crate `use other_crate::m::item` with a `-`/`_` name mismatch and a cross-crate `use other_crate::m::*` both resolve.
- [ ] #6 An unmatched leading segment (a genuinely external crate) still returns opaquely and fabricates no edge.
- [ ] #7 Integration tests cover every evidence case listed above individually, including the nest bare-specifier chain end to end.
- [ ] #8 `import_resolution.{typescript,rust,python,javascript}.test.ts` stay green across the `probe_candidates` extraction, and `import_graph.test.ts` stays green.
- [ ] #9 Sub-task 1.3 is merged before this task, and the `crate_roots` lookup sits after the local-module probe in the `else` arm.
- [ ] #10 The `compute_debuginfo_type_name` row is recorded as closing in sub-task 1.6, not here.

<!-- AC:END -->
