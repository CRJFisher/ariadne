---
id: TASK-375.5
title: "Link a Rust mod declaration to its file and unify Rust path resolution"
status: To Do
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-375
priority: high
ordinal: 5000
plan_dedup_keys:
  - ddc1417a886d7eaa6a182915d6e0e29627990a22fe35a842bb626c8624b16fc2
plan_source_tasks:
  - pt-4ba570af945b193d
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

A Rust `mod x;` has no link to its file. `mod config;` is captured as a `NamespaceDefinition` (`rust.scm:440` -> `handle_definition_module`, `capture_handlers.rust.ts:474`) with a name, a defining scope, and no link whatsoever to `src/config.rs`; `get_scope_imports(root_scope)` returns `[]`. `resolve_via_path_prefix_rust` (`function_call.rust.ts:44`) therefore has nowhere to go: it offers a member-index hop when the qualifier is a `class` and `resolve_in_module_body` (`path_resolution.rust.ts:65`) when it is a `namespace`, and the latter scans only the _child scopes_ of the qualifier's defining scope — an in-file `mod x { … }` block. Reproduced: `mod config;` + `config::build()`, `crate::intrinsic::check()`, `self::config::build()`, `use crate::config;` + `config::build()` and `crate::deep::inner::deep_fn()` all record `name_not_in_scope`; only `pub mod inline { … }` + `inline::inline_fn()` resolves.

And two duplicate builders own half a path resolver each and have drifted: `path_resolution.rust.ts:12-19` documents in prose that its callers pick the qualifier segment differently — function calls take the last prefix segment, constructors the second-to-last — because `resolve_via_path_prefix_rust` has a `use`-anchor fallback and a callable guard while `resolve_type_via_module_path_rust` (`constructor.rust.ts:103`) has neither and refuses anything deeper than one module hop.

This task depends on sub-tasks 1.3 and 1.4: it adds a new caller of `resolve_module_path_rust`, whose local probe must already be correct (1.3) and whose signature changes (1.4).

## Work plan

1. Add an `@definition.import.module` capture on `(mod_item name: (identifier) !body)` in both the plain and `(visibility_modifier)` forms (`rust.scm:440`, `:453`), and capture the `#[path = "…"]` attribute on `mod_item` (today attributes are captured only as `@decorator.macro`, `:603`). The existing `@definition.module` / `@export.module` captures **stay** — the namespace definition is what binds the name in scope.
2. Give `NamespaceDefinition` (`packages/types/src/symbol_definitions.ts:287`) `readonly module_path?: string`, set only for Rust `mod` declarations, carrying the `#[path = "…"]` override when present and otherwise absent so the resolver falls back to the module name. Tag `@language rust`.
3. Add `handle_definition_import_module` beside `handle_definition_module` (`capture_handlers.rust.ts:474`), emitting an `ImportDefinition` with `import_kind: "namespace"`, `name: x` and `import_path` of `self::x` or the `#[path]` override, and threading `module_path` onto the namespace definition. Register both in `RUST_HANDLERS` (`:691`).
4. The edge belongs in the `ImportGraph`, not computed on demand from the definition: `ImportGraph.dependencies` (`import_graph.ts:33`) is what `Project.update_file` uses to choose the files to re-resolve, so with no `mod` edge `src/lib.rs` is not a dependent of `src/config.rs` and editing `config.rs` never re-resolves `lib.rs`. Registering it as an import also reuses the per-file path cache (`import_graph.ts:114`), so the filesystem walk runs once per `mod`, not once per call site. Assert the dependency edge and the incremental re-resolution **before** any resolver reads it.
5. Confirm binding is unchanged: `DefinitionRegistry.update_file` excludes `kind === "import"` from the scope index (`registries/definition.ts:109`) and `resolve_scope_recursive` layers local definitions over imports (`name_resolution.ts:200`), so `config` still resolves to its `NamespaceDefinition`.
6. Make `path_resolution.rust.ts` the single Rust path resolver. Replace the per-segment walk _through the scope map_ with one path-to-file resolution: take `ref.path_prefix` **un-normalized** (keep the leading `crate`/`self`/`super`, which `resolve_module_path_rust:20-31` branches on); join the longest leading run of segments and resolve it to a file, shortening by one segment until the resolved path is a file the project has **indexed**; whatever remains is at most one segment, the owning type. Requiring an indexed file is the collision guard — `resolve_rust_module_path` falls through to an inferred `<base>/<parts>.rs` even when nothing exists and the bare-path branch returns external specifiers opaquely, so an unverified result would fabricate edges; requiring the file makes `Foo::bar()` and `serde_json::to_string()` fall through untouched. Zero remaining segments -> resolve the terminal through `ExportRegistry.resolve_export_chain` with a root-scope fallback for non-`pub` items, the same carve-out `name_resolution.ts:167` already applies to explicit named imports; one remaining -> resolve that segment to a type in the target file and take the terminal from `get_member_index()` gated by `is_callable_definition` (`:53`). Keep `is_callable_definition` and `resolve_in_module_body` (`:65`) as internal steps, and stop exporting `normalize_path_prefix` (`:37`) once both remaining callers are internal — confirm no test imports it directly first.
7. Shrink `resolve_via_path_prefix_rust` (`function_call.rust.ts:44`) to a call into the unified resolver with `terminal_kind: "callable"`, keeping the `use`-anchor fallback (`resolve_via_import_anchor`, `:96`) and its ambiguity rule. That fallback's `imp.import_kind === "namespace"` skip at `:110` becomes a `"wildcard"` skip plus a second pass fanning a wildcard import out through `resolve_all_exports`, reusing the collision rule at `:131-134`. Ordering inside the function stays: type-qualified member hop first, then the file hop, then the `use`-anchor hop. `function_call.ts:122` needs no edit.
8. Delete `resolve_type_via_module_path_rust` (`constructor.rust.ts:103`) with its `prefix.length < 2` bail and second-to-last-segment arithmetic; its call site moves to the unified resolver with `terminal_kind: "type"`.
9. The file hop deliberately binds over a same-name local shadow — that is what the author's path means — and it never requires an intermediate module to be bound in the caller's scope, which is what defeats the per-segment walk on `crate::deep::inner::deep_fn()`.
10. `#[cfg]`-gated `mod` declares one module name over several files (rustc's `sys::process::{unix,windows}`) and Ariadne does not evaluate `cfg`: bind every variant, over-approximating toward reachability as `name_resolution.ts:248` already does for hoisted functions, and record the decision in the change's decision record. If `#[path = "…"]` proves expensive, drop it and re-route the tokio `self::imp::ctrl_c` row explicitly rather than leaving it silently open.
11. Add `build_index_single_file` tests: `mod config;` and `pub mod config;` each yield an `ImportDefinition` with `import_kind: "namespace"` and the module path alongside the surviving `NamespaceDefinition`; `#[path = "…"] mod x;` carries the override.
12. Add integration tests in `resolve_references.rust.test.ts` (`setup_project` at `:19`) covering **every** case in this task's triage evidence, each asserting the call resolves: `mod config;` + `config::build()`; `crate::intrinsic::check()`; `self::config::build()`; `use crate::config;` + `config::build()`; `crate::deep::inner::deep_fn()` through a 2018-style `a.rs` plus `a/` directory; `x::Type::assoc()`; `mod x;` with a same-named local `x` in scope, asserting the path wins; the corpus shapes `migrate::expand` (sqlx), `self::imp::ctrl_c` and `list::channel` (tokio), `back::write::optimize` and `MetaVarExpr::parse` (rustc), `config::Options::from_matches` and `attr::Container::from_ast`; and the alias/shadow rows' eight module-qualified Rust calls. Add the incremental case: index `lib.rs` + `config.rs`, `update_file` on `config.rs`, assert the `lib.rs` call re-resolves — that is what the `ImportGraph` edge buys.
13. Keep `path_resolution.rust.test.ts` (219 lines) and `function_call.rust.test.ts` (245) green — they pin the in-file `mod` block and `use`-anchor paths — and keep `constructor.rust.test.ts` (356) green, which pins the behaviour that must survive deleting `resolve_type_via_module_path_rust`.

## Reading the result

The alias/shadow rows split: the eight module-qualified Rust calls close here on the file hop's precedence over a same-name local shadow, one Angular row is a binder gap closed by sub-task 1.1, and the rest carry recorded failures in other areas and re-route to `type-model-completion`. No separate "alias carries its target" change is needed.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `build_index_single_file` emits an `ImportDefinition` with `import_kind: "namespace"` and the module path for `mod config;` and `pub mod config;` alongside the surviving `NamespaceDefinition`, and `#[path = "…"] mod x;` carries the override on `module_path`.
- [ ] #2 `src/lib.rs` is a dependent of `src/config.rs` in `ImportGraph.dependencies`, and `update_file` on `config.rs` re-resolves the `lib.rs` call site.
- [ ] #3 The Rust file-backed `mod` path false-positives clear: `mod config;` + `config::build()`, `crate::intrinsic::check()`, `self::config::build()`, `use crate::config;` + `config::build()` and `crate::deep::inner::deep_fn()` all resolve.
- [ ] #4 The corpus shapes `migrate::expand`, `self::imp::ctrl_c`, `list::channel`, `back::write::optimize`, `MetaVarExpr::parse`, `config::Options::from_matches` and `attr::Container::from_ast` all resolve.
- [ ] #5 The eight module-qualified Rust alias/shadow calls resolve, with `mod x;` beating a same-name local `x` in scope.
- [ ] #6 `Foo::bar()` and `serde_json::to_string()` still fall through untouched — no edge is fabricated for a path whose file the project has not indexed.
- [ ] #7 `resolve_type_via_module_path_rust` is deleted, `resolve_via_path_prefix_rust` is a call into the unified resolver, and `normalize_path_prefix` is no longer exported.
- [ ] #8 Integration tests in `resolve_references.rust.test.ts` cover every evidence case listed above individually, plus the incremental `update_file` case.
- [ ] #9 `path_resolution.rust.test.ts`, `function_call.rust.test.ts` and `constructor.rust.test.ts` stay green with no behavioural edits.
- [ ] #10 The `#[cfg]`-gated `mod` over-approximation is recorded in the change's decision record; if `#[path]` is dropped, the tokio `self::imp::ctrl_c` row is explicitly re-routed rather than left open.

<!-- AC:END -->
