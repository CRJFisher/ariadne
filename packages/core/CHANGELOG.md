# @ariadnejs/core

## 1.0.0

### Major Changes

- 817beb4: Move known-false-positive classification into core.

  `Project.get_call_graph().entry_points` now returns true positives only by
  default — entry points that match a bundled known-issue rule (Flask routes,
  pytest fixtures, Python dunders, dynamic dispatch, JSX components, etc.) are
  filtered out.

  For triage workflows that need to see the suppressed bucket, use the new
  `Project.get_classified_entry_points()` API which returns
  `{ true_entry_points, known_false_positives }`. Each
  `ClassifiedEntryPoint.classification` carries a discriminated-union verdict
  (`true_entry_point | framework_invoked | dunder_protocol | test_only |
indirect_only`) plus the matching rule's `group_id`.

  The MCP `list_entrypoints` tool gains a server-level `--show-suppressed` flag
  (env: `ARIADNE_SHOW_SUPPRESSED`) that appends a clearly-delimited "Suppressed
  (known false positives)" section to default output. Configure it once via
  `.mcp.json` for triage workflows; everyday agents see the clean default.

  `@ariadnejs/types` bumps in lockstep with `@ariadnejs/core` (linked release).
  The new types are: `ClassifiedEntryPoint`, `ClassifiedEntryPoints`,
  `EntryPointClassification`, `ClassifierHint`, `KnownIssue`,
  `KnownIssuesRegistry`, `KnownIssuesRegistryFile`, `PredicateExpr`,
  `ClassifierSpec`, `KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION`. The skill type
  `EnrichedFunctionEntry` is renamed `EnrichedEntryPoint`.

  ## Persisted-state preservation policy

  If you run the self-healing pipeline locally, **do not** delete
  `~/.ariadne/triage-entrypoints/analysis_output/`. That directory is the
  permanent source of truth for the per-project TP cache; wiping it kills
  cross-run TP reuse and forces every previously-confirmed entry point back
  through the LLM investigator.

  Upgrade steps:

  - Stale "active" runs: clear the `LATEST` pointer with
    `.claude/skills/triage/scripts/abandon_run.ts` or by deleting
    the `LATEST` file.
  - Pre-run-namespaced state (a flat `<project>_triage.json`): delete it by hand;
    the run-namespaced layout is rebuilt on the next run.

  Per-file index caches written by an earlier release are discarded on first read
  after upgrade, and each file is re-indexed once.

- 817beb4: Publish the export surface by pipeline stage, and report what a load dropped.

  `@ariadnejs/core`'s entry point is organised by the stage each export belongs
  to — project orchestration, per-file indexing, project-level registries,
  call-graph tracing, entry-point classification — rather than by the file each
  symbol happens to live in. Imports from the package root are unaffected where
  the symbol survives; the list below is what changed for a consumer.

  ## Breaking

  - **`load_project` returns `LoadedProject`, not `Project`.** The project is on
    `.project`. The other fields answer what the load could not take in:
    `discovered_files` (everything discovery selected), `dropped_files` (what
    failed to index) and `drop_reasons` (the message each drop threw, keyed by
    path). A coverage gate needs all three, because a callee whose caller file was
    silently dropped reads as an entry point.
  - **`LoadProjectOptions.file_filter` is removed.** Filtering after discovery hid
    files from the index while leaving them in the corpus, which is the
    false-entry-point failure the pipeline exists to remove. Narrow the corpus
    with `files`, `folders` and `exclude` instead.
  - **`profiler` is no longer exported.** The profiling module stays internal.
  - **`@ariadnejs/types` drops its pre-1.0 call-graph model and its helper
    functions.** The list is in the types changeset below.

  ## Added

  - `LoadProjectOptions.max_files` refuses a corpus larger than the cap rather
    than truncating it silently, and names the remedies. `worker_width` overrides
    the indexing width a machine's cores and load average compute; a measurement
    harness is the only caller that should set it.
  - `query_tree`, `LANGUAGE_TO_TREESITTER_LANG` and `SUPPORTED_LANGUAGES` from the
    indexing stage; `build_signature`, `SignatureLocation` and `count_tree_size`
    from the tracing stage; `detect_language`; the logging entry points
    (`initialize_logger`, `log_info`, `log_warn`, `log_error`, `log_debug`); and
    the entry-point classification surface (`enrich_call_graph`, `auto_classify`,
    `BUILTIN_CHECKS`, `extract_entry_point_diagnostics`,
    `complete_caller_evidence`, `load_permanent_registry` and their types).
  - `ClassifyOptions` is exported alongside `Project`.

  The registry exports (`DefinitionRegistry`, `TypeRegistry`, `ScopeRegistry`,
  `ExportRegistry`, `ImportGraph`, `ResolutionRegistry`) and the persistence
  exports keep their names and move to the stage that owns them.

  `should_ignore_path` matches whole path segments, so a source file under a
  directory whose name merely contains an ignored word — `src/compiler/`,
  `packages/compiler/src/render3/`, `tools/` — is indexed. `node_modules/`,
  `dist/`, `build/` and `temp/` are still ignored.

- 817beb4: Record the five type facts once and resolve members over a single lookup ladder.

  A receiver-directed call needs five facts: what a name's annotation denotes,
  what type a scope's `self` binds to, what a binding holds, what a type's full
  member set is, and which types are its subtypes. Each is now recorded once in
  the store that owns it, and member lookup reads those stores in one order
  instead of re-deriving each fact at the point of use from raw source text.

  The effect lands on the pipeline's product — the list of functions nothing
  calls. Measured over ten corpora, a control arm and a candidate arm interleaved
  in one session on one box:

  | Corpus               | Raw entry points        | Resolved calls                               |
  | -------------------- | ----------------------- | -------------------------------------------- |
  | angular/angular      | 4,276 → 3,096 (−28%)    | 148,316 → 160,166                            |
  | microsoft/TypeScript | 1,201 → 758 (−37%)      | 91,141 → 93,358                              |
  | rust-lang/rust       | see "Two figures" below | 78,734 → 113,204 (+44%)                      |
  | django/django        | 2,494 → 2,289           | `constructor_target_not_a_class` 15,021 → 63 |
  | pandas-dev/pandas    | 2,298 → 2,085           | that reason → 0                              |
  | celery/celery        | 800 → 730               | that reason → 0                              |

  ## What resolves that did not

  - **Annotations are parsed before they are resolved.** An annotation used to
    resolve only when its source text was byte-identical to a declared name.
    Rust `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>` and `impl Emit`,
    TypeScript `F | null`, Python `Optional[C]`, `Union[C, None]` and `"C"`, and
    JSDoc `{ChunkGraph=}`, `{ChunkGraph|null}` and `{import("./a").X}` now all
    denote the type they name, through `parse_type_annotation` and its four
    per-language parsers.
  - **A scope knows its own `self` type.** `LexicalScope.self_type_name` records
    it, so a getter/setter pair, a constructor-only class, a constructor body and
    a cross-file Rust `impl` block all answer `self`. On rust-lang/rust,
    `no_enclosing_class_scope` falls 27,173 → 2,567.
  - **A binding answers what it holds.** Class aliases, factory return values and
    element reads now type their receiver, which is what clears
    `constructor_target_not_a_class` on the Python corpora.
  - **A type's member set is complete.** Members are unioned across every file
    that contributes them, so a Rust type reached from a submodule `impl` block
    carries the methods that block declares, and enums carry theirs.
  - **The subtype graph is single-sourced.** Qualified TypeScript heritage, dotted
    Python bases, Rust trait edges, structural conformance for interfaces no class
    declares, and every base past the first all produce edges. A member miss fans
    out over the subtype closure, and a `super` call dispatches up the method
    resolution order to the member that runs rather than fanning down.

  Every call-kind reference now ends as either a resolved call or a recorded
  `ResolutionFailure` carrying the reason it failed, and the
  `resolved + failed == call references` invariant is asserted in the resolver.

  ## Two figures that are not comparable term by term

  - **Call reference counts fall on the Python corpora.** A heuristic constructor
    capture recorded every argument-bearing Python call a second time; deleting it
    drops 93,143 call references on pandas and 53,468 on django. Nothing was lost
    — the second record was never a distinct call.
  - **Raw entry points rise on the Rust corpora.** Methods declared in cross-file
    `impl` blocks are definitions the graph holds for the first time, so tokio
    gains 994 nodes, sqlx 848 and rustc 9,951. A method nothing calls is an entry
    point. Restricted to the nodes both trees hold, the genuinely new entry points
    are two on tokio, one on sqlx and fifty-six on rustc.

  ## Known residue

  Four shapes are out of scope and will not resolve: an `exports.update()` call on
  a `WebAssembly.Instance` exports object, DI containers keyed by computed runtime
  tokens, a `.on_error(...)` call off an unannotated Python factory, and Rust
  `Drop`, whose destructor call is compiler-injected with no call expression in
  source. They are recorded as permanent limitations rather than targets.

  ## Breaking

  - **`TypeRegistry.get_type_members` is removed, along with `TypeMemberInfo`.** Read
    a type's members from `DefinitionRegistry.get_member_closure(type_id)`, which
    holds the complete set the lookup ladder consults. `TypeRegistry` gains
    `get_callable_return_type`, `get_callable_return_class`,
    `get_container_element` and `get_symbol_type_arguments` for the facts it keeps.
  - **`ResolutionFailure` carries every unresolved call.** A call-kind reference
    that does not resolve is no longer simply absent from the resolved set; its
    reason is recorded, and `resolved + failed == call references`.

  ## Added

  `@ariadnejs/types` bumps in lockstep (linked release). Added: `ResolutionFailure`
  and its per-reason union, `AriadneFaultArea` with the reason-to-area mapping, and
  `LexicalScope.self_type_name`. Inside the registries, `parent_types` is
  multi-valued and the single `symbol_types` map is split into value types and
  callable return types; neither is part of the public surface.

  Cached per-file indexes written by the previous indexer are discarded, and each
  file is re-indexed once.

### Minor Changes

- 817beb4: Say that a callee is outside the indexed corpus instead of blaming the type or the scope.

  A call to `os.getcwd()`, `np.arange(3)`, `fs.readFileSync(p)` or a method inherited
  from an unindexed base such as `unittest.TestCase` can never resolve, because
  the callee is defined where no indexed file holds it. It used to be reported as
  `name_not_in_scope` or `method_not_on_type`, which read as a resolver defect.
  Now:

  - A call through an import whose module names no indexed file fails
    `import_unresolved`, carrying the module as the import wrote it in
    `import_specifier`. `import_target_file` is set only when the project indexed
    that file.
  - A name the language binds itself (`len`, `console`, `Some`) fails the new
    `callee_is_a_language_global`. `is_language_global(language, name)` is exported
    from `@ariadnejs/types`.
  - Both route to the new `outside_indexed_corpus` fault area, which owns no module
    and maps to the empty folder in `ARIADNE_FAULT_AREA_FOLDER`. `import_unresolved`
    no longer maps to `import_resolution`.

  `name_not_in_scope` and `method_not_on_type` now count only what the resolver
  could have bound.

  Resolution itself is unchanged: resolved calls, the call-edge fingerprint and the
  raw-entry-point fingerprint are identical on the ten evidence corpora.

  A caller that switches exhaustively over `ResolutionFailureReason` or
  `AriadneFaultArea` needs an arm for each new member, and one that read
  `import_target_file` as "the file the import names" must read `import_specifier`
  for an import that leads outside the corpus. Angular's Jasmine globals (`expect`,
  `it`) stay `name_not_in_scope`: no import binds them and no test-framework global
  set is consulted.

- 817beb4: Python classes and methods stop disappearing from the call graph when their
  syntax takes a shape the queries did not enumerate.

  A class whose base is dotted, subscripted or both (`class PGDDLCompiler(compiler.DDLCompiler)`)
  is now indexed with every method it declares, where before the class and all
  its methods were erased. A method behind any decorator — `@cython.cfunc`,
  `@functools.lru_cache()`, `@lru_cache(maxsize=1)`, `@util.memoized_property` —
  is indexed the same as an undecorated one, and a `@classmethod` gets the body
  scope it needs to be a graph node at all, so the calls it makes are edges.

  Reading a Python property (`row.data` where `data` is a `@property`) creates an
  edge to the getter, so property getters stop being reported as unreachable.
  Method definitions carry `accessor_kind` (`getter`, `setter`, `deleter`), and
  the whole property-descriptor family — `cached_property`, `memoized_property`,
  `cache_readonly`, `classproperty` — counts as a getter.

  A write to a member no longer mints a read of it, so an assignment can no
  longer fabricate an edge to the getter that shares its name; a member read
  through an ungrounded chain (`getHelper().handler`) mints nothing rather than
  resolving its trailing name against an unrelated function.

  A Python file whose module-level name is bound more than once — an `@overload`
  group, a second wildcard re-export — no longer aborts. Over sqlalchemy's `lib/`
  this takes files that fail to index whole from 21 to 0, recovers 4,057
  call-graph nodes, and drops the entry-point false-positive rate from 32.4% to
  25.2%.

  Two changes need attention on upgrade:

  - An existing on-disk index is discarded, because the indexer that wrote it
    extracts less than this one, and the project re-indexes cold on first run.
  - `SymbolReference` gains `CallableValueReference` and `accessor_kind` gains
    `"deleter"`. Consumers switching exhaustively over either need a new arm.

- 817beb4: Declare the supported Node.js range

  - `@ariadnejs/core`, `@ariadnejs/types` and `@ariadnejs/mcp` require Node.js 22.13.0 or later; package managers warn when installed on an older Node.

- 817beb4: Attribute a call through an interface-typed binding to the implementation that runs.

  A method called on a binding destructured from a typed source
  (`const { storage } = options; storage.sweep()`) now resolves to the property's
  declared type, so the implementation the call reaches gains an incoming edge
  instead of surfacing as dead code. The indexer records the source identifier and
  property key on the binding (`destructured_from` / `destructured_key`), and
  receiver resolution types the binding with one property hop off the source's
  type.

  A call on an interface-typed receiver now also records an edge to the interface
  member the call names, alongside every implementation, so the call graph holds
  the dispatch as the source wrote it rather than only as it runs. The interface
  member has no body scope, so it is never a call-graph node and the change is
  additive: attributions are added, never moved, and entry-point detection still
  reaches every implementation.

  `VariableDefinition` gains the two provenance fields. Cached indexes written by
  the previous indexer are discarded, and each file is re-indexed once.

- 817beb4: Follow module edges the index used to drop, so more callees gain a caller.

  A callee reached through any of these used to look uncalled and was reported as
  an entry point; it now has its incoming edge.

  - **Wildcard and namespace re-exports.** `export * from './impl'`,
    `import * as X from './m'; export { X }`, Python `from pkg import *` (including
    several in one file) and Rust `pub use m::*` are recorded as module edges,
    and the export surface fans out across them. A file with two wildcard imports
    no longer fails to index.
  - **TypeScript workspaces.** A per-package `tsconfig` that declares no `paths`
    inherits them through `extends`, from any number of directories up. A workspace
    package resolves through its `package.json` `exports` map (the `"."` form, the
    condition-only form and published subpaths). Bare specifiers resolve through
    `paths` and package names.
  - **Rust.** A `mod x;` links to the file backing it, honouring `#[path = "..."]`.
    Every `::` path resolves through one resolver: `crate::`, `self::`,
    `Self::`, type-qualified associated items and a crate named by another
    workspace member.
  - **Order independence.** A caller indexed before its callee's file is re-resolved
    when that file arrives, without a whole-corpus pass.

  `Project.initialize` now reads `tsconfig.json`/`jsconfig.json`, `package.json`
  and `Cargo.toml` once to learn which directory a package or crate name denotes;
  an unreadable manifest is skipped, and a specifier matching nothing on disk
  stays unresolved rather than inventing an edge.

  Cached per-file indexes written by the previous indexer are discarded, and each
  file is re-indexed once.

- 817beb4: Resolve Rust qualified calls, underscore-prefixed imports and self-initialised bindings.

  Callees that were reported as unreachable entry points because their call sites
  did not bind now have their incoming edge:

  - **Rust qualified calls.** `worker::create()`, `Parker::make()`,
    `crate::runtime::Driver::new()` and `Self::assoc()` resolve through their
    qualifier. A call reference carries the terminal `name` and the qualifier in
    the new `path_prefix` on `FunctionCallReference` and `ConstructorCallReference`;
    before, `name` held the whole scoped-path text. A consumer that read `name` as
    the path reads `path_prefix` plus `name`.
  - **Associated `new()`** links to its struct as the constructor, so
    `Type::new()` reaches it.
  - **Explicit named imports bind regardless of `is_exported`.** `from .x import _y`
    and a non-`pub` Rust item bind to the definition they name. `is_exported` still
    governs the implicit surface of wildcard, namespace and re-export imports.
  - **Self-initialisers and nested functions.** `let x = x(...)` calls the imported
    `x`, not the binding it is initialising, in JavaScript, TypeScript and Rust,
    and a function declared in a nested block is visible to its sibling scopes.

  Cached per-file indexes written by the previous indexer are discarded, and each
  file is re-indexed once.

### Patch Changes

- 817beb4: Validate cached per-file indexes against the git blob alone.

  A cached index was reused whenever the HEAD tree hash was unchanged and the file
  was not dirty. A staged or committed edit satisfies both conditions while the
  file's content differs from what was indexed, so `load_project` served an index
  built from earlier content. Validity now rests on comparing the file's current
  blob hash to the blob the entry was built from, and an index built from dirty or
  untracked content no longer claims a blob at all.

  Caches written before this release are discarded, and the next load re-indexes
  once.

- 817beb4: Make file discovery admit exactly the files a grammar parses.

  Discovery admitted `.go`, `.java`, `.cpp`, `.c`, `.hpp` and `.h`, which no grammar
  parses, so each landed in `dropped_files` and made the coverage warning cry wolf
  on any repository containing C or Java. It missed `.mjs`, `.cjs` and `.mdx`, so a
  callable whose only caller was an ES-module script had no incoming edge.
  `SUPPORTED_EXTENSIONS` is now the set `detect_language` maps to a grammar:
  `ts`, `tsx`, `js`, `jsx`, `mjs`, `cjs`, `mdx`, `py` and `rs`. The MCP file
  watcher follows the same set.

  A directory named `fixtures` is no longer ignored, so the call edges its files
  hold count; a `/fixtures` directory still marks its callables as test code.

  A file whose rollback throws no longer aborts the whole load.

- 817beb4: Discard a cached per-file index whenever the indexer that produced it changes.

  A cached index was keyed on the package version and a hand-maintained schema
  number, so a build that changed what indexing extracts — or the shape a cached
  index is written in — without a version bump kept serving indexes the previous
  build produced. The call graph silently lost edges: a method called only
  through an interface-typed variable could be reported as an unreachable entry
  point.

  The cache key is now a fingerprint of the indexer build itself: the modules
  that parse, index and serialize a file, the `.scm` queries, and the versions of
  the tree-sitter packages they load. Any change to them re-indexes on the next
  load; changes to resolution, the call graph or classification keep the cache
  warm. Existing caches are discarded once.

- 817beb4: Stop reporting methods read as values, and runner-invoked tests and benchmarks, as entry points.

  - A bound or static method read as a value is indirectly reachable: passed as an
    argument, `this.write.bind(this)`, `addEventListener(handler)`, or stored in a
    field. Constructors are excluded; a constructor invocation is a call.
  - Rust `#[test]` functions, and anything in a `#[cfg(test)]` module or `impl`,
    are test callables. `#[cfg(not(test))]` is not. ASV benchmark methods
    (`time_*`, `mem_*`, `peakmem_*` under `asv_bench/benchmarks/`) are test
    callables too. With `include_tests` off, none of them appears among the entry
    points.

- 817beb4: Keep a declared receiver type that indexing used to lose, so the members called on it stop being reported as entry points.

  - **TypeScript optional constructor parameter-properties.**
    `constructor(private readonly store?: Store)` now declares the `store` field with
    its type, as the required form always did.
  - **JavaScript JSDoc.** A parameter typed only by a `@param {T} name` tag takes
    that type, so `name.method()` resolves.
  - **Python attributes assigned outside `__init__`.** `self.df = pd.DataFrame()` in
    any method of the class declares `df` with type `DataFrame`. An untyped
    assignment outside `__init__` stays a mutation, not a declaration, and a
    `self.x` in a nested function does not leak into the class.

  Cached per-file indexes written by the previous indexer are discarded, and each
  file is re-indexed once.

- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
- Updated dependencies [817beb4]
  - @ariadnejs/types@1.0.0

## 0.8.0

### Minor Changes

- 33ff291: Call resolution, Python support, and type system improvements

  **@ariadnejs/core**

  - Add constructor enrichment and function_call module extraction
  - Fix Python instance-method resolution false positives
  - Resolve Python submodule import method calls
  - Resolve aliased re-exports for TypeScript/JavaScript and Python
  - Detect functions passed as values for indirect reachability (fewer false positive entry points)
  - Add multi-candidate resolution foundation
  - Add callback detection and tracking
  - Add factory call tracking for polymorphic resolution
  - Add collection reachability and argument resolution
  - Migrate codebase to snake_case naming convention

  **@ariadnejs/types**

  - Rename ClassDefinition.constructor to constructors (array)
  - Add access_modifier to method and constructor definitions
  - Add is_test field to CallableNode
  - Add ExportableDefinition type guard
  - Merge TypeContext into TypeRegistry
  - Add ResolutionCache
  - Add reference factory functions with discriminated unions

### Patch Changes

- Updated dependencies [33ff291]
  - @ariadnejs/types@0.8.0

## 0.7.0

### Minor Changes

- 8a43be7: feat: Namespace imports support and comprehensive fixes

  **@ariadnejs/core**

  - ✅ Added namespace import support for JavaScript/TypeScript
  - ✅ 502 tests passing (96% pass rate)
  - ✅ Started migration to new feature-based folder structure
  - ✅ Fixed cross-file call tracking for all languages
  - ✅ Improved import/export resolution

  **@ariadnejs/mcp**

  - ✅ Fixed compatibility with core v0.6.0 API
  - ✅ All 13 tests now passing
  - ✅ Improved symbol context extraction
  - ✅ Added robust fallback mechanisms for inheritance detection

## 0.6.0

### Minor Changes

- feat: Major improvements in namespace imports, test coverage, and architecture planning

  **New Features:**

  - ✅ **Namespace imports implemented** - Added partial support for JavaScript/TypeScript namespace imports (`import * as name from 'module'`)
  - ✅ **New folder structure migration** - Started migration to feature→language→testing pattern with namespace imports as pilot
  - ✅ **Feature validation framework** - Added scripts for discovering and validating feature coverage across languages

  **Improvements:**

  - ✅ **500 tests passing** (96% pass rate, up from 387 tests / 95%)
  - ✅ Cross-file call tracking fixed for all supported languages
  - ✅ CommonJS and ES6 export support significantly improved
  - ✅ Virtual file system support enhanced for testing
  - ✅ Import resolution more robust with better error handling

  **Architecture & Documentation:**

  - ✅ Created comprehensive Information Architecture Plan for repository restructuring
  - ✅ Added ARCHITECTURE.md and FEATURE_DEVELOPMENT.md guides
  - ✅ Updated testing patterns to support test contracts and language adapters
  - ✅ Prepared foundation for systematic language expansion (7 new languages planned)

  **Bug Fixes:**

  - Fixed reference resolution to properly handle namespace member access
  - Updated tree-sitter queries for JavaScript/TypeScript to support namespace patterns
  - Resolved issues with import/export detection edge cases

  **Note:** While this release includes API changes, we're using a minor version bump as the API is still evolving and not yet stable. Early adopters should expect continued refinements.

## 0.5.18

### Patch Changes

- 7e494f4: Improve documentation and fix server regression

  - Moved detailed API documentation from main README to core package README
  - Simplified main README to be a high-level project overview with links to packages
  - Enhanced core README with comprehensive API documentation, method descriptions, and usage examples
  - Updated MCP README to only document the implemented get_symbol_context tool
  - Fixed server.ts to use VERSION import instead of hardcoded 0.5.12
  - Fixed regression where CLI binary had old position-based tools instead of new context-oriented tools

## 0.5.17

### Patch Changes

- 9f35dbd: Complete get_symbol_context MCP tool with full inheritance support

  - **@ariadnejs/core**: Fixed interface inheritance extraction for TypeScript interfaces that extend other interfaces
  - **@ariadnejs/core**: Extended inheritance APIs to support interface hierarchies in get_inheritance_chain() and find_subclasses()
  - **@ariadnejs/mcp**: Updated get_symbol_context to use enclosing_range for full function body extraction
  - **@ariadnejs/mcp**: Added class/interface inheritance relationships to symbol context using new core APIs
  - **@ariadnejs/mcp**: Added support for Rust struct and trait analysis
  - **@ariadnejs/mcp**: Added comprehensive tests for function body extraction and inheritance relationships

  Completes task-54.1 with all acceptance criteria met. Performance remains under 200ms.

## 0.5.16

### Patch Changes

- d244119: Remove deprecated find_all_references alias - use find_references instead

## 0.5.15

### Patch Changes

- 6f659e4: Remove custom prebuild system in favor of tree-sitter's built-in prebuilds

  - Removed custom GitHub Actions prebuild workflow
  - Removed postinstall script and tar dependency
  - Now relies entirely on tree-sitter's native prebuild support

  This is an internal change with no user-facing impact. Installation behavior remains the same.

- Updated dependencies [6f659e4]
  - @ariadnejs/types@0.5.15

## 0.5.14

### Patch Changes

- feb54fe: Fix prebuild workflow with C++17 and direct package installation
- Updated dependencies [feb54fe]
  - @ariadnejs/types@0.5.14

## 0.5.13

### Patch Changes

- 425941b: Prevent tree-sitter packages from being hoisted to fix prebuild workflow
- Updated dependencies [425941b]
  - @ariadnejs/types@0.5.13

## 0.5.12

### Patch Changes

- 84d0f91: Fix prebuild workflow to use correct working directory for monorepo structure
- Updated dependencies [84d0f91]
  - @ariadnejs/types@0.5.12

## 0.5.11

### Patch Changes

- 5ad3e6c: Testing prebuild workflow after monorepo fixes
- Updated dependencies [5ad3e6c]
  - @ariadnejs/types@0.5.11

## 0.5.10

### Patch Changes

- 6df19fb: Changed npm package scope from `@ariadne/*` to `@ariadnejs/*`

  Due to the `@ariadne` organization already being taken on npm, we've changed our package scope to `@ariadnejs`. Update your imports:

  **Before:**

  ```json
  {
    "dependencies": {
      "@ariadne/core": "^0.5.9",
      "@ariadne/types": "^0.5.9"
    }
  }
  ```

  **After:**

  ```json
  {
    "dependencies": {
      "@ariadnejs/core": "^1.0.0",
      "@ariadnejs/types": "^1.0.0"
    }
  }
  ```

  ```typescript
  // Before
  import { Definition } from "@ariadne/types";
  import { RefScope } from "@ariadne/core";

  // After
  import { Definition } from "@ariadnejs/types";
  import { RefScope } from "@ariadnejs/core";
  ```

- Updated dependencies [6df19fb]
  - @ariadnejs/types@0.5.10

## 0.5.9

### Patch Changes

- 4eaa992: Reorganized the project into a monorepo structure with separate packages for core functionality and types.

  - Created `@ariadnejs/core` package containing all implementation code
  - Created `@ariadnejs/types` package with zero-dependency TypeScript types
  - Set up npm workspaces for managing the monorepo
  - Configured changesets for coordinated versioning and releasing
  - Integrated GitHub Actions for automated releases with prebuilt binaries
  - Removed legacy release scripts in favor of changesets workflow
