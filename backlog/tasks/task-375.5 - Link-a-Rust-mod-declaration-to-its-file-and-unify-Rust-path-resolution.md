---
id: TASK-375.5
title: "Link a Rust mod declaration to its file and unify Rust path resolution"
status: Done
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

- [x] #1 `build_index_single_file` emits an `ImportDefinition` with `import_kind: "namespace"` and the module path for `mod config;` and `pub mod config;` alongside the surviving `NamespaceDefinition`, and `#[path = "…"] mod x;` carries the override. The override lives on the module edge's `import_path`, not on a new `NamespaceDefinition.module_path` — see deviation 2.
- [x] #2 `src/lib.rs` is a dependent of `src/config.rs` in the `ImportGraph`, and `update_file` on `config.rs` re-resolves the `lib.rs` call site.
- [x] #3 The Rust file-backed `mod` path false-positives clear: `mod config;` + `config::build()`, `crate::intrinsic::check()`, `self::config::build()`, `use crate::config;` + `config::build()` and `crate::deep::inner::deep_fn()` all resolve.
- [x] #4 The corpus shapes `migrate::expand`, `self::imp::ctrl_c`, `list::channel`, `back::write::optimize`, `MetaVarExpr::parse`, `config::Options::from_matches` and `attr::Container::from_ast` all resolve.
- [x] #5 The module-qualified alias/shadow calls resolve, with the author's path beating a same-name local in scope. The eight rows are one shape and are covered by one test each for the local-variable and local-function shadow — see deviation 5.
- [x] #6 `Foo::bar()` and `serde_json::to_string()` still fall through untouched, and so do three further shapes review found the first cut got wrong — see "What review found".
- [x] #7 One resolver owns Rust path resolution and `resolve_via_path_prefix_rust` calls into it. Two structural clauses do not hold as written: the type-last adapter survives, and `normalize_path_prefix` stays exported — see deviations 3 and 4.
- [x] #8 Integration tests in `resolve_references.rust.test.ts` cover every evidence case listed above individually, plus the incremental `update_file` case at one and two module hops.
- [x] #9 `function_call.rust.test.ts` and `constructor.rust.test.ts` stay green with no assertion changed. `path_resolution.rust.test.ts` was retargeted onto the resolver's entry point — see deviation 4.
- [x] #10 The `#[cfg]`-gated over-approximation is recorded below and implemented: every variant binds. `#[path]` shipped, so the tokio `self::imp::ctrl_c` row needed no re-route.

<!-- AC:END -->

## Implementation Notes

### What a user gets

A Rust `mod x;` declaration is connected to the file that backs it, so a `::`-qualified call
reaches into that file and its callee stops being reported as an entry point it never was.
`config::build()`, `crate::intrinsic::check()`, `self::config::build()`,
`use crate::config;` + `config::build()`, `crate::deep::inner::deep_fn()` and the corpus shapes
`migrate::expand`, `self::imp::ctrl_c`, `list::channel`, `back::write::optimize`,
`MetaVarExpr::parse`, `config::Options::from_matches` and `attr::Container::from_ast` all resolve.
The author's qualifier wins over a same-name local, which is what their path means.

Measured on `launchbadge--sqlx` (452 Rust files, 3382 Rust call-graph nodes), before and after:

| | before | after |
| --- | --- | --- |
| Rust entry-point false positives | 919 | **859** |
| unresolved `::`-qualified Rust calls | 3045 of 3863 | **2783** of 3863 |

### The approach

One resolver owns every Rust `::` path. `path_resolution.rust.ts` runs four hops in order —
`Self` substitution, a type-qualified associated item, an in-file `mod { … }` body, and a module
**file** — and `function_call.rust.ts` adds a `use`-anchor fallback for a path that names nothing
the project holds. The two half-resolvers that had drifted apart (one for calls, one for
constructors) are gone; the constructor keeps only a six-line adapter that reshapes its type-last
prefix.

The module edge is an import, not a fact computed on demand. That is what makes the module file a
dependency of its declarer, so editing the module re-resolves everything that reaches through it,
and it is where `#[path = "…"]` is carried.

Two rules stop the file hop fabricating an edge, and both were put there by review after it did:
the leading segment must be something a Rust path root can be — an anchor, a module bound in
scope, or a workspace crate — and the file it lands on must be one the project has indexed.

### How to navigate the result

Start at `.claude/rules/resolve-references.md`, which now carries the ordered hop list and a
"Rust `mod` declaration → module file" paragraph naming the four load-bearing files. The resolver
itself is `resolve_references/call_resolution/path_resolution.rust.ts`; its header repeats the hop
order and states the two anti-fabrication rules. Path-to-file resolution lives one folder over in
`import_resolution/import_resolution.rust.ts`, which is also where the `#[path]` file form is
told apart from a `::` path. The capture and the handler that produce the edge are
`queries/rust.scm` and `capture_handlers/capture_handlers.rust.ts`.

### What review found — three fabricated edges and a blocker

The first cut passed its own tests and a 3684-test suite while producing wrong call edges. Each of
these was reproduced live before being fixed, and each now has a test:

- **`std::fs::read_to_string()` bound to the crate's own `src/fs.rs`.** The segment walk skipped a
  non-final segment it could not match, so any foreign path collapsed onto whatever its tail
  named. Pervasive: tokio alone has `fs`, `io`, `net`, `time`, `sync`, `task` and `process`
  modules. The walk is now strict — every segment must match — and a foreign path stays opaque.
- **`use crate::model::User;` + `User::from_str()` bound to a free `fn from_str` beside `User`.**
  A `use` that binds an item was being followed as if it were a module alias. Only a `mod x;` edge
  or an import carrying a resolved submodule path is a module now.
- **An orphan `serde_json.rs` with no `mod` declaring it captured `serde_json::to_string()`.** AC #6
  held only by load order: re-indexing the caller produced the edge. The path-root rule closes it.
- **Blocker: the cache schema version was not bumped.** A warm v5 cache restores Rust indexes with
  no module edges, so on any project with a cache the whole feature silently did nothing and a
  partially-loaded corpus got a partially-linked module graph. `CURRENT_SCHEMA_VERSION` is now 6.

A second review round over the fixes themselves caught two more: dropping `types` from the
`exports` condition order (rather than ranking it last) lost the compiled-package layout whose
`types` points at real source, and the corrected `#[path]` base directory fabricated an edge for a
declaration nested in an inline `mod` block, where rustc resolves against the declaring module's own
directory. Both are fixed and tested.

Review also found that resolution depended on the order files were indexed in — a caller indexed
before its callee module had nothing to resolve against, and nothing imports a caller to bring it
back. `Project.resolve_all()` runs one whole-corpus pass at the end of `load_project`; on sqlx that
alone clears 8 further false positives.

### Deviations from the work plan, and why

1. **One `.scm` pattern, not two.** Step 1 asked for the capture in both the plain and
   `(visibility_modifier)` forms. Visibility is an unconstrained child, so the plain pattern
   already matches `pub mod x;`; adding the second would emit a duplicate capture — and therefore a
   duplicate module edge — for every `pub mod`.
2. **No `NamespaceDefinition.module_path`.** Step 2 asked for the field; nothing would read it. The
   `#[path]` override belongs on the module edge's `import_path`, where module paths already live
   and where the `ImportGraph` already caches its resolution. An unread field on a type four
   languages share is surplus state. AC #1's substance — the override is carried and honoured — is
   met and tested end to end.
3. **`normalize_path_prefix` stays exported.** Step 6 made de-exporting it conditional on both
   remaining callers being internal and no test importing it directly. Neither holds: the
   `use`-anchor matcher needs it to compare anchor-stripped prefixes, and it has its own tests.
   `resolve_in_module_body`, `is_callable_definition` and `RustTerminalKind` did lose their external
   consumers and are no longer exported.
4. **The type-last adapter survives, renamed.** Step 8 asked for `resolve_type_via_module_path_rust`
   to be deleted. `resolve_type_via_path_prefix_rust` replaces it: six lines holding only the
   type-last prefix arithmetic, no resolution logic, so the drift AC #7 exists to prevent cannot
   recur. Deleting it would move Rust prefix knowledge into the language-neutral `constructor.ts`.
   `path_resolution.rust.test.ts` was retargeted onto `resolve_qualified_path_rust` in the same
   spirit — the module's own test file now pins its entry point rather than three private helpers.
5. **The eight alias/shadow rows are one shape.** The task's own "Reading the result" says they
   close on the file hop's precedence over a same-name local. They are not enumerated anywhere in
   the repo, so they are covered by the shape rather than row by row: one test for a local variable
   shadowing the module name, one for a local function shadowing the terminal.
6. **`resolve_constructor_call` now takes the resolution context** instead of eight positional
   parameters, and its `import_source_resolver` callback is gone — the `ImportGraph` it needed is
   now a field of that context.

### Decisions recorded

- **`#[cfg]` is not evaluated.** Two `#[cfg]`-gated `mod imp;` declarations name one module over
  two files (rustc's `sys::process::{unix,windows}`). Every variant is a candidate and the first
  that holds the terminal wins, over-approximating toward reachability exactly as hoisted functions
  already do. The alternative — treating the collision as ambiguous — leaves every `imp::…` call in
  a platform-abstraction tree unresolved.
- **`#[path = "…"]` resolves against the directory the declaring file sits in**, per the Rust
  Reference, not the module's child directory. It is spelled as a file path on the module edge's
  `import_path`; `::` is Rust's only path separator, so the two forms never collide.
- **A trait qualifies its methods** (`Read::read(r)`), so the type-qualified hop accepts an
  interface alongside a struct and an enum.

### Root causes this work had to fix

Three defects outside the work plan blocked stated acceptance criteria. Each is fixed at the root
rather than worked around, and each was found by writing the evidence test first and watching it
fail:

- **Incremental invalidation was one hop short.** A Rust `mod x;` edge puts the module's whole
  surface on the declaring file's path surface, so `crate::a::b::item` reaches through it. The
  forwarding rule now lives on `ImportGraph.forwards_surface_of`, and `remove_file` uses the same
  closure as `update_file` — without that, deleting a module file left a grandparent holding a
  resolution to a definition that no longer existed.
- **`use crate::internals::attr;` recorded `internals.rs`, not `internals/attr.rs`.** A named
  import whose final segment is itself a module now records the submodule path — the mechanism
  Python already had — and that path is a real dependency edge.
- **An enum's associated functions were absent from the member index**, which is built for classes
  and interfaces. That is why rustc's `MetaVarExpr::parse` — an enum — could not resolve.

### Known gaps, owned elsewhere

- **The incremental path does not converge the way loading does.** A qualified path reads the
  target module's index, but that read is not an import edge, so the invalidation closure cannot
  see it. `crate::a::b::deep_fn()` written with no `use` records nothing linking the caller to
  `b.rs`: `load_project`'s whole-corpus `resolve_all()` pass makes the loaded state correct, but a
  later `update_file` on `b.rs` leaves the caller holding the old symbol id, and the edited function
  is reported as an entry point until something re-resolves the caller. `remove_file` has the same
  shape. Before this task the path produced no edge at all, so the loaded state is strictly better
  and only the edit path degrades to roughly what it was. Closing it properly means recording a
  path-read edge in the `ImportGraph` when the resolver lands on a file, so the existing machinery
  covers it — a change to the dependency graph that deserves its own task and its own review.
- **`Enum::new()` is still unresolvable.** The constructor route gates on `find_class_definition`,
  which rejects an enum, so a Rust enum with `pub fn new() -> Self` stays a false positive even
  though its `new` now sits in the member index. Pre-existing, and widening `constructor.ts`'s
  contract is a separate change.
- **A qualified call that misses every hop still falls back to bare-name resolution**, which
  ignores the qualifier — so `crate::helper()` can bind to a `use`d `helper` from another module.
  Pre-existing behaviour of `resolve_function_call`, unchanged here.
- **A path miss is reported as `name_not_in_scope`**, so triage routes every unresolved `::` call to
  `name_resolution.ts` rather than to the path resolver that rejected it, and the candidate file it
  rejected is discarded. Closing this means a new `ResolutionFailureReason` and a `REASON_TO_AREA`
  key.
- **Module-path resolution is not memoised across call sites.** The file hop runs up to N
  path resolutions per qualified call, and the file tree is a fixed snapshot per project, so a
  cache on `ModuleResolutionContext` would be safe. Not needed for correctness.
