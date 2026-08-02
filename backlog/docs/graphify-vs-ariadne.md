# Graphify vs Ariadne: a technical report for the Ariadne owner

---

## 1. What Graphify is

Graphify is a CLI that turns any directory into a persisted knowledge graph and hands you five ways to interrogate it. You run `graphify extract <path>` and get `graphify-out/graph.json` — one NetworkX node-link file containing every file, class, function, package, config key, markdown heading and (optionally) live Postgres table in the tree, wired together by ~22 relation types. You then query it without re-analysing anything: `graphify query/path/explain/affected/god-nodes` from the shell, 10 MCP tools over stdio or HTTP for agents, and exports to Obsidian, GraphML, Cypher, SVG and three HTML viewers. Its scope is breadth — 95 file extensions, 46 extractors, plus LLM extraction of docs/papers/images — and its output is an artifact other tools consume, not a live service.

Note that `extract` deliberately stops at the graph: the human-readable `GRAPH_REPORT.md`, the LLM-generated community names and `graph.html` come from a second command, `cluster-only`/`label` (`/Users/chuck/workspace/tools/graphify/graphify/cli.py:3646-3653`, `cli.py:1546-1868`).

---

## 2. How Graphify parses code into a graph

### 2.1 The pipeline, end to end

One `extract` run is ten sequential stages inside a single CLI command (`cli.py:2558-3654`):

| #   | Stage                                                                                                                                                           | Where                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 0   | Parse ~25 flags; persist corpus-shaping options (`--exclude`, `--no-gitignore`) into the out dir so later `update`/`watch`/hook rebuilds scan the same file set | `cli.py:2558-2767`, `watch.py:79-123`                 |
| 1   | `detect(root)` — os.walk, nested .gitignore/.graphifyignore, classify by extension into code/document/paper/image/video                                         | `detect.py:1183-1302`, `detect.py:1412-1425`          |
| 1b  | Incremental gate: if `graph.json` exists, `detect_incremental` diffs against `manifest.json` (mtime fast path, MD5 + `ast_hash`/`semantic_hash` slow path)      | `detect.py:1744-1874`, `cli.py:2810-2837`             |
| 2   | Resolve LLM backend — **only** if docs/papers/images present or `--dedup-llm`; a code-only corpus needs no API key                                              | `cli.py:2939-3028`                                    |
| 3   | AST extraction, per file, content-hash cached, ProcessPoolExecutor above 20 uncached files                                                                      | `extract.py:4503-4601`                                |
| 3b  | Whole-corpus cross-file resolution (the long tail; §2.6)                                                                                                        | `extract.py:4681-5641`                                |
| 4   | LLM extraction of docs/papers/images, packed into ≤60k-token chunks by parent directory                                                                         | `cli.py:3064-3204`, `llm.py:1858-1900`                |
| 5   | Optional `--postgres DSN` schema introspection, `--cargo` crate deps                                                                                            | `pg_introspect.py:1-156`, `cargo_introspect.py:1-109` |
| 6   | Merge AST + semantic + postgres + cargo node/edge lists (semantic wins on id collision)                                                                         | `cli.py:3264-3274`                                    |
| 7   | `build()` → dedup → `build_from_json` → one `networkx.Graph`; or `build_merge` for incremental                                                                  | `build.py:539-668`, `build.py:1258-1446`              |
| 8   | Leiden clustering (graspologic, seed 42; Louvain fallback), cohesion scoring, god-nodes                                                                         | `cluster.py:22-160`, `analyze.py:109-133`             |
| 9   | Atomic write of `graph.json` + manifest + sidecars, behind a refuse-to-shrink guard                                                                             | `export.py:232-321`, `cli.py:3541-3620`               |
| 10  | Stop, and print `next: run graphify cluster-only …`                                                                                                             | `cli.py:3646-3654`                                    |

`ARCHITECTURE.md` is stale on all of this — it documents `build_graph`, `analyze(G)`, `render_report` and `export()`, none of which exist, and a single-command pipeline that no command runs. Trust the code.

### 2.2 Dispatch: one extractor per file, chosen by extension plus content sniffing

`_get_extractor(path)` (`extract.py:4248`) is the single routing point, in order:

1. `*.blade.php` → `extract_blade`
2. MCP config filenames → `extract_mcp_config`
3. Package manifests (pyproject.toml, go.mod, pom.xml) → `extract_package_manifest`
4. Case-insensitive suffix normalisation
5. **`.h` sniffing** — `_is_objc_header` looks for `@interface/@protocol/@import`; else `_is_cpp_header` looks for `class`/`namespace`/`template`/`::`; else C (`extract.py:4219`)
6. **`.m` sniffing** — routed to Objective-C only if it actually contains ObjC directives; otherwise **no extractor at all**, because mis-parsing MATLAB through the ObjC grammar is judged worse than skipping (`extract.py:4275-4281`)
7. Extensionless files by shebang (`_SHEBANG_DISPATCH`, `extract.py:4157`)
8. Fall through to `_DISPATCH` — 95 extensions → 46 extractors (`extract.py:4039-4133`)

### 2.3 The tree-sitter mechanism: **zero queries, 100% imperative walking**

This is the single most important structural fact about Graphify's parser, and the sharpest contrast with Ariadne.

There is not one `.scm` file in the repository, and no `Query`, `QueryCursor`, `.captures()` or `.matches()` call anywhere in `graphify/`. Every extraction is a recursive Python `walk(node)` comparing `node.type` against frozensets and pulling children with `child_by_field_name(...)`. `engine.py` alone contains ~85 `node.type` comparisons; the package has ~791 `child_by_field_name`/`.type ==` sites (`extractors/engine.py:2345`, `engine.py:2346`, `extractors/base.py:84`).

Grammar loading is dynamic per language: `importlib.import_module(config.ts_module)` → `Language(getattr(mod, config.ts_language_fn)())` → `Parser(language)` (`engine.py:2189-2212`). `extract()` pre-flights with `_check_tree_sitter_version()`, requiring `tree_sitter.LANGUAGE_VERSION` (i.e. ≥0.23, Language-capsule API) (`extract.py:3162`).

### 2.4 The per-language contract: `LanguageConfig`

Fifteen mainstream languages share one 4,747-line config-driven walker, `_extract_generic`, parameterised by a `LanguageConfig` dataclass (`extractors/models.py:14`):

- **Grammar**: `ts_module`, `ts_language_fn` (`language_typescript`, `language_tsx`, `language_php`…)
- **Node-type frozensets**: `class_types`, `function_types`, `import_types`, `call_types`, `static_prop_types`
- **Field names**: `name_field` + `name_fallback_child_types`, `body_field` + `body_fallback_child_types`
- **Callee reading**: `call_function_field`, `call_accessor_node_types`, `call_accessor_field`, `call_accessor_object_field`
- **Where to stop**: `function_boundary_types`
- **Four hook slots**: `import_handler`, `resolve_function_name_fn`, `extra_walk_fn`, PHP-framework knobs

Ruby is the whole language in 17 lines (`extract.py:849-865`). That cheapness is real — but the abstraction leaks heavily: there are ~14 `if config.ts_module == "tree_sitter_X"` blocks inside `walk`/`walk_calls` handling inheritance (Python/Swift/PHP/Kotlin/Ruby/C#/Java/Scala/C++), field/property type refs, and the whole callee-extraction ladder. The Python-vs-Java-vs-C# handling is interleaved in one function rather than isolated per language.

~20 further languages have bespoke hand-written walkers (go.py, rust.py, objc.py, bash.py, elixir.py, zig.py, verilog.py, …).

### 2.5 The two-pass walk inside a file

**Pass A — definitions.** `walk(node, parent_class_nid)` (`engine.py:2342`) emits the file node first, then branches in fixed order: imports → classes → language-specific member/field branches → functions → `extra_walk` hooks → `decorated_definition` unwrap → default recurse.

- Class branch: resolve name via `name_field` then fallbacks, mint `_make_id(stem, namespace, class_name)`, emit `contains` from enclosing class or file, run inheritance blocks, recurse body with `parent_class_nid=class_nid`.
- Function branch: mint `_make_id(parent_class_nid, name)` with a `method` edge, or `_make_id(stem, name)` with a `contains` edge from the file. A name that normalises to empty is skipped — it would collapse the id onto the file prefix and leak the scan path.
- **Bodies are not walked inline.** `(caller_nid, body_node)` tuples are queued into `function_bodies` (`engine.py:3876`).

**Pass B — calls.** A `label_to_nid` index is built over the file's nodes (plus a case-folded variant for case-insensitive languages), then every queued body is walked by `walk_calls` (`engine.py:3694`), which stops at `function_boundary_types` — except JS/TS inline closures, which it descends into with the enclosing caller and the closure's bindings folded into `extra_locals`. Callee extraction is a per-language if/elif ladder with a generic fallback. If the callee label is in this file's index → `calls` edge, EXTRACTED, deduped by `seen_call_pairs`. Otherwise it becomes a `raw_call`.

**Indirect dispatch** (Python and JS/TS only, `engine.py:3745-3801`): a function named _as a value_ — passed as an argument, placed in a dict/list literal, assigned, returned, or `getattr(obj, "literal")` — becomes an `indirect_call` edge with confidence INFERRED and a `context` tag. Two soundness guards: skip names bound as a param/local of the enclosing function, and resolve only to ids in `callable_def_nids`, excluding classes. A module-level scan attributes `app.get('/', handler)` route tables to the file node.

**Per-file edge cleaning** (`engine.py:4560-4572`): an edge survives only if both endpoints were minted in this file — unless the relation is `imports`/`imports_from`/`re_exports`, which are allowed to dangle for cross-file repointing.

Return contract: `{"nodes", "edges", "raw_calls"}` plus optional `error`, `swift_extensions`, and per-language receiver type tables `swift_type_table`/`ts_type_table`/`cpp_type_table`/`csharp_type_table` (`engine.py:4572-4600`).

### 2.6 Definition identity: string slugs, repaired after the fact

`make_id(*parts)` (`ids.py:32-51`): join with `_`, NFKC-normalise, replace non-word runs with `_`, collapse repeats, strip, casefold. File id = `_make_id(_file_stem(rel))` where the stem is the whole relative path minus extension (`docs/v1/api/README.md` → `docs_v1_api_readme`). Symbol = `_make_id(stem, name)`; method = `_make_id(parent_class_nid, name)`.

This is deliberately human-readable and deliberately reproducible by three independent producers — the AST extractor, the LLM subagents, and the graph builder — which is why the recipe lives in one module. The price is that it is lossy (`a/b/c.md` and `a.b/c.md` collide) and that `add_node` is idempotent on `seen_ids`, so **two same-named definitions in one file silently collapse into one node** (`engine.py:2276-2278`).

Collisions are repaired post-hoc: `_disambiguate_colliding_node_ids` re-mints colliding ids as `make_id(source_key, old_id)`, appending a 6-char SHA-1 of the raw path when even the salt collides, then rewrites every edge and `raw_call` caller_nid through the same map. `module`/`namespace` nodes are exempt so an imported module stays one shared hub (`extractors/resolution.py:655-712`).

`extract()` then runs **four successive remap passes** — id_remap, prefix_remap, barrel repoint, ext_id_remap backstop — whose comments all cite the same bug class: an absolute scan path (including the OS username) leaking into a committed graph.json.

### 2.7 Scope: there isn't one

Graphify has no lexical scope tree. Nesting is carried by a single threaded argument, `parent_class_nid`, and **the default recursion branch resets it to `None`** (`engine.py:3688-3690`), so a class nested inside a function is not attributed to it. A `namespace_stack`/`scope_stack` exists but is pushed only by the C# namespace walk and the TS `internal_module` walk; for every other language `metadata.scope_chain` is absent. Same-file call binding is a flat, last-writer-wins `label_to_nid` dict (`engine.py:3695-3708`) — a shadowing local or a same-named nested definition silently redirects the edge.

The only per-function binding information that exists is `local_bound_names[func_nid]` (params + local assignment/for/with-as/comprehension targets), built for Python and JS/TS **only**, and used **only** as a shadowing guard for indirect dispatch (`engine.py:1888`).

### 2.8 Type "inference" is a flat declared-type table

There is no type inference. Each language collects `name -> TypeName` from source shapes only: C# fields/properties/params/locals, TS/JS constructor parameter-properties plus `const x = new Foo()` and annotated params, C++ locals, Swift `let x = Type()` and `let x = Type.shared`, Java fields/params/locals, Ruby `var = Const.new` (`engine.py:1423-1513`, `engine.py:1385-1398`). The tables are per-file, flat, first-binding-wins — the code's own comments call them "depth-1". TS accepts only a bare `type_identifier`: arrays, unions, generics and qualified types are skipped, explicitly "precision over recall".

A capitalized receiver is taken to _be_ the type name. `this`/`self`/`base` maps to the caller's enclosing class. Chained receivers (`a.b.method()`) are abandoned at extraction, with the single exception of `this.field.method()` — and even that only records the inner property name and defers (`engine.py:4139-4190`).

### 2.9 Cross-file resolution: name matching gated by import evidence

After per-file extraction, `extract()` runs the corpus pass. The core is a `global_label_to_nids` index over every node label (`extract.py:5211-5226`), exact-case — case folding is applied only when the _calling_ file's language is case-insensitive, because folding made a Python `Path()` bind a shell `PATH`.

For each `raw_call`:

1. Skip language builtins (`_LANGUAGE_BUILTIN_GLOBALS`, ~150 names — String/Number/len/print/Data/UUID/View — `extractors/base.py:13-51`), Ruby mixin markers, bash (bash resolves only through files it actually `source`s), and **member calls** (`extract.py:5306-5309`).
2. Filter candidates by language family (`_lang_family`) so a TSX callback can't bind a same-named Kotlin method (`extract.py:5342-5350`).
3. Exactly one candidate → bind.
4. Ambiguous → a unique direct symbol-`imports` match wins, then a unique `imports_from` module match, then `disambiguate_ambiguous_candidates`: drop test-file candidates for non-test call sites (a same-named test mock was erasing real call graphs), then path proximity (`paths.py:223-280`).
5. Nothing unique survives → **drop the edge silently** (`extract.py:5385-5405`).
6. **JS/TS direct calls with no import evidence are dropped outright**, even when the name is globally unique, because ES modules have no implicit cross-module scope. This suppressed phantom cross-package edges in a 14-package monorepo (`extract.py:5437-5449`).

**Member calls** go instead to `run_language_resolvers` — a registry of nine `LanguageResolver(name, suffixes, resolve)` entries (swift, python, ruby, typescript, cpp, objc, csharp, java, pascal), each activated only when the corpus contains a matching suffix, each wrapped in try/except that logs a warning and continues (`resolver_registry.py:28-84`, `extract.py:2977-3029`). This is the only formal plugin seam in the system; the extractor "registry" in `extractors/__init__.py` is aspirational — its own docstring says dispatch still flows through `_DISPATCH`.

Every resolver hard-gates on `len(type_defs) == 1` and a single method match, else `continue`. Inheritance is mostly ignored during method lookup: Java, TypeScript and Swift match only directly-declared methods; C# walks the base chain but an unresolved base anywhere poisons the lookup entirely; **Pascal is the only true cross-file inheritance walk** (`extract.py:2838-2843`, `2659-2682`, `pascal_resolution.py:1-23`).

### 2.10 Import resolution — where Graphify invests most

JS/TS is genuinely production-grade (`extractors/resolution.py`):

- Relative probing with extension candidates, the TS ESM `.js`→`.ts` / `.jsx`→`.tsx` remap, directory index files (`:31-60`)
- tsconfig **or** jsconfig `compilerOptions.paths`, JSONC-tolerant, following `extends` chains including the TS-5 array form, all targets kept in declared order, matched by TypeScript's exact-then-longest-prefix specificity (`:89-168`)
- `baseUrl` as a last-resort root, gated on the candidate being a real file on disk, so `import React from 'react'` still resolves to nothing (`:189-245`)
- Workspace packages from `pnpm-workspace.yaml` / `package.json#workspaces`, honouring the `exports` subpath/condition map (source > import > module > svelte > types > require > default) with a path-containment guard against `../../../etc/passwd` (`:247-322`, `:378-503`)

Python: relative-by-level, then absolute by probing root-then-upward through the importing file's ancestors, **skipping any directory that is itself a package** so `from helpers import x` cannot resolve Python-2-style to a sibling (`:1718-1766`).

Everything else is much weaker. C/C++/ObjC quoted `#include` probes only relative to the including file. Lua walks up 6 directories. PHP implements the real name-resolution algorithm. **Go imports never resolve to a file at all** — the target is a synthetic `go_pkg_<path>` id with no node, so every Go import edge is discarded at build (`extractors/go.py:296-322`). **Rust `use a::b::C` collapses to `make_id("C")`** — a bare id that can accidentally land on an unrelated same-named local node (`extractors/rust.py:322-331`).

Symbol-level import/export graphs exist for JS/TS and Python only: `resolve_exported_origin` recursively walks named re-exports and `export *` with a cycle guard to find a symbol's true origin, emitting symbol→symbol `imports` edges (`resolution.py:1006-1100`).

### 2.11 What it does when it cannot resolve

Five distinct behaviours, and one significant gap.

**Unresolvable file, gracefully:** a missing grammar returns `{"nodes": [], "edges": [], "error": "<module> not installed"}` (never a crash); a version mismatch returns an upgrade hint; `_safe_extract` converts RecursionError or any exception into an empty result plus a `warning: skipped <path>` line (`engine.py:2199-2210`, `extract.py:163`).

**Unresolvable grammar, by fallback:** Pascal falls back from tree-sitter to `_extract_pascal_regex` on ImportError _or_ on any parse exception (`extractors/pascal.py:448-464`). Groovy Spock files are detected by regex and rebuilt entirely by line-regex, discarding the tree-sitter nodes rather than merging (an all-or-nothing choice to avoid orphaned methods). Svelte/Astro/Vue layer a regex import rescue on top of a partial tree-sitter pass. Verilog skips SystemVerilog `class_declaration` subtrees in the walk and reconstructs them by regex.

**Unresolvable type reference:** `ensure_named_node` mints a **sourceless stub** — `{id, label, file_type: code, source_file: "", origin_file: <referrer>}` (`engine.py:2325-2340`). `_rewire_unique_stub_nodes` later collapses a stub onto a unique real definition sharing its label, guarded by case-sensitivity, supertype-vs-function shape, and language family (`extract.py:1893-1992`). Whatever still dangles is dropped at build with the comment _"skip edges to external/stdlib nodes — expected, not an error"_ (`build.py:868-874`).

**Silent-nothing surfaced loudly:** three distinct stderr warnings — files an extractor accepted that yielded zero nodes (#1666, and never cached, so a rerun self-heals), files classified as code with no extractor wired at all (grouped by extension, #1689), and files whose extractor bailed on a missing optional dependency, naming the pip extra (#1745) (`extract.py:4605-4679`).

**The gap:** an unresolved _call_ leaves no trace whatsoever. Every failure path in the resolution pass is a bare `continue`. Nothing records the call site, the callee name, or why it failed. The only user-facing uncertainty surface is aggregate — the report prints `%EXTRACTED · %INFERRED · %AMBIGUOUS` with an INFERRED edge count and average score (`report.py:93-131`), and MCP exposes a `graphify://audit` resource (`serve.py:1695-1730`). A user can say "20% of my edges are guesses" but can never ask "why is this function not connected".

### 2.12 Confidence: the honest-signal mechanism

Every edge carries `confidence` ∈ {EXTRACTED, INFERRED, AMBIGUOUS} and a `confidence_score` (1.0 / 0.8). EXTRACTED means the relation was literally in the source or backed by an explicit import edge; INFERRED means it was matched by name across files, or is a value reference. A name-matched cross-file call is **promoted** from INFERRED to EXTRACTED when the caller's file demonstrably imports the target symbol or its file (`extract.py:5374-5382`, `5452-5468`). `indirect_call` stays INFERRED even with import evidence, because the name was referenced as a value, not invoked.

---

## 3. Graph model, storage and scale

**The in-memory model is a simple, undirected `networkx.Graph`.** `build_from_json` does `nx.DiGraph() if directed else nx.Graph()`, `directed` defaults to False, and no CLI build path sets it — `graphify extract` never parses a `--directed` flag (`build.py:539`, `:673`, `cli.py:1446`). Parallel edges between the same pair therefore collapse. A MultiDiGraph mode exists only as a capability probe whose own docstring says "No call sites added yet" (`multigraph_compat.py:8`, `:208`).

**Direction is a serialization trick.** Because storage is undirected and NetworkX canonicalises endpoint order, `build_from_json` stashes true endpoints as `_src`/`_tgt` edge attributes and `to_json` pops them back into `source`/`target` on write (`build.py:952-958`, `export.py:305`). A NetworkX round-trip loses direction permanently (#760), which is why the incremental merge path reads raw JSON rather than using `node_link_graph` (`build.py:1127`). Readers then choose: `query` keeps it undirected so BFS reaches callers as well as callees; `path`/`explain` and the MCP server force directed.

**Schema.** Nodes require `id, label, file_type, source_file` with `file_type ∈ {code, document, paper, image, rationale, concept}`; edges require `source, target, relation, confidence, source_file`. `relation` is a free string and never validated (`validate.py:4-10`). There is **no first-class `kind` field distinguishing function from class** — that is encoded in the label convention (`name()` = function, `.name()` = method, bare `Name` = class) and re-derived heuristically downstream by `callflow_html.node_kind` from label casing and keyword matching. A lossy round-trip.

**Hyperedges are inert decoration.** `attach_hyperedges` appends dicts into `G.graph["hyperedges"]` — no incidence matrix, no bipartite expansion, no node back-reference (`export.py:162`). Grep for "hyperedge" returns zero hits in `cluster.py`, `analyze.py`, `serve.py`, `affected.py` and `exporters/graphdb.py`: clustering, BFS query, shortest path, god-nodes, impact analysis and both graph databases are blind to them. They are produced only by the LLM pass, capped at 3 per chunk (`llm.py:475`), so a `--code-only` build has none. They are display-only.

**Storage.** `graph.json` is canonical, written atomically (temp + `os.replace`, rename-based, explicitly _not_ a power-loss durability guarantee), behind layered guards: refuse-to-overwrite-when-smaller which **fails closed** on an unparseable existing file, `backup_if_protected` snapshots, and a 512 MiB read cap (`export.py:232-321`, `security.py:32`, `paths.py:29-45`). A full build normally passes `force=True` (dedup and deletions legitimately shrink) but drops back to the guard whenever `_extraction_incomplete` is set — by a crashed AST pass, failed semantic chunks, or a directory the walk couldn't enumerate. Critically, a refused write exits **before** stamping the manifest, so the retry re-extracts.

**Caches, invalidated on deliberately different axes.** `cache/ast/v{package_version}/{sha256}.json` is namespaced by the installed package version, because entries are the output of graphify's own extractor — a release must invalidate them, and sibling version dirs are swept on first use. `cache/semantic/p{prompt_fingerprint}/{sha256}.json` is namespaced by a fingerprint of the exact LLM prompt instead, because versioning it would re-bill the LLM on every patch release (`cache.py:20-33`, `:741-769`). Anomalous results are never cached: a zero-node result for an extractable file is skipped so a rerun self-heals; a truncated `partial` LLM entry reads as a cache MISS.

**Incrementality** is replace-per-source-file. `build_merge` loads `graph.json` as raw JSON, drops every `source_file` present in the new chunks, carries the rest forward, then prunes from three independent sources — manifest deletions, manifest exclusions, and the graph's own stale `source_file` set (a file excluded without ever being manifest-listed would otherwise carry ghost nodes forever). "Replace" always beats a contradictory "delete" (`build.py:1349-1360`).

**Scale posture** is parallelism plus explicit ceilings: ProcessPoolExecutor above 20 uncached files with `GRAPHIFY_MAX_WORKERS` override and BrokenProcessPool fallback; 512 MiB graph read cap; HTML viz collapses to a community meta-graph above 5000 nodes; LLM chunks packed to 60k tokens.

**Downstream reach.** Six file exporters (Obsidian vault + Canvas, agent wiki, SVG, GraphML, Cypher, HTML), plus write-only Neo4j and FalkorDB push sinks with no read path back. `graphify global add <graph.json> <tag>` merges repos into `~/.graphify/global-graph.json` by prefixing node ids with the tag — but **creates zero edges between repos**, and its label-only dedup of sourceless external nodes can conflate two unrelated same-named externals.

---

## 4. The layer above the graph

**Clustering.** `cluster(G)` builds a deterministically-ordered copy, runs Leiden via graspologic with seed 42, falls back to NetworkX Louvain, then splits any community exceeding 25% of the graph or with cohesion below 0.05 (`cluster.py:22-77`). Output is `{community_id: [node_ids]}`.

**Community labelling.** `cluster-only`/`label` remaps new community ids onto the previous ones by node overlap so saved labels stay attached, validates each saved label against a persisted membership signature (`.graphify_labels.json.sig`), fills stale or missing ones from the highest-degree hub, and optionally calls an LLM for richer names (`cli.py:1546-1868`).

**LLM extraction** is confined to non-code: docs, papers, images. Files are greedily packed into ≤60k-token chunks grouped by parent directory (so related files land together and cross-file edges are more likely to be found), run through a thread pool (forced serial for ollama/claude-cli), with truncated chunks split in half recursively and each completed chunk checkpointed back into the cache. Zero successful chunks is a hard exit; partial success sets `_extraction_incomplete` (`llm.py:1858-2330`, `cli.py:3064-3204`). The semantic cache write-back uses an `allowed_source_files` allowlist, so a model that misattributes a node cannot clobber another file's cache entry.

**Dedup.** `deduplicate_entities` runs before graph assembly on the full path; `--dedup-llm` forces an LLM backend requirement even on a pure-code corpus.

**Detection and analysis.** `score_all` computes per-community cohesion; `god_nodes` and `surprising_connections` are best-effort (exceptions become empty lists) (`analyze.py:109-133`).

**Reports and serving.** `GRAPH_REPORT.md` carries the confidence audit line `%EXTRACTED · %INFERRED · %AMBIGUOUS` (`report.py:93-131`). `graphify-mcp` exposes 10 tools — query_graph, get_node, get_neighbors, get_community, god_nodes, graph_stats, shortest_path, list_prs, get_pr_impact, triage_prs — plus 6 resources including `graphify://audit`, with an optional `project_path` injected into every tool schema in one loop so a single server serves any number of project graphs (`serve.py:1246-1373`).

**Agent integration.** Skill bundles for ~20 assistants, PreToolUse nudge/block guards, a git post-commit hook routing to `watch._rebuild_code` (AST-only, no LLM, per-repo flock, queued change draining), and a graph.json git merge driver.

---

## 5. Graphify vs Ariadne

| Dimension                        | Graphify                                                                                                                       | Ariadne                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product shape**                | Batch artifact producer: CLI → `graph.json` on disk                                                                            | Resident in-memory resolver; no graph artifact, no serializer for one                                                                                             |
| **Purpose**                      | "What does this repo consist of and what depends on what"                                                                      | "What calls what, and which functions are entry points"                                                                                                           |
| **Languages**                    | 95 extensions → 46 extractors, plus shebang dispatch (`extract.py:4039-4157`)                                                  | 4 languages, 9 extensions; `detect_language` returns null for go/java/cpp (`detect_language.ts:10-44`)                                                            |
| **Non-code sources**             | Docs/papers/images via LLM, package manifests, MCP configs, .sln/.csproj, XAML, Terraform, live Postgres, Cargo                | None                                                                                                                                                              |
| **Tree-sitter style**            | Zero `.scm` files, zero Query API calls; ~791 imperative `node.type`/`child_by_field_name` sites                               | 3,076 lines of declarative `.scm` across 4 dialects, 42 predicates, compiled once per dialect, validated at load                                                  |
| **Per-language contract**        | One `LanguageConfig` dataclass (~15 lines/language) + 4 hooks — but ~14 `if ts_module == X` blocks leak into the shared engine | Four artefacts per language: `.scm`, HandlerRegistry, MetadataExtractors, ScopeBoundaryExtractor                                                                  |
| **Symbol identity**              | Lossy path+name slug, collisions repaired post-hoc by salting + SHA-1 (`ids.py:32-51`, `resolution.py:655-712`)                | Injective by construction: `kind:file:sl:sc:el:ec:name` (`packages/types/src/symbol.ts:63-75`)                                                                    |
| **Scope model**                  | None. Single `parent_class_nid` pointer reset on default recurse; flat last-writer-wins label table                            | Real typed `LexicalScope` tree with parent links, depth, deepest-containing lookup, 7 scope types                                                                 |
| **Body attachment**              | Structurally exact — `(caller_nid, body_node)` queued during the definition walk                                               | Positional heuristic (`find_body_scope_for_definition`, 4 ordered fallbacks) that can miss and throw                                                              |
| **Cross-file binding**           | Corpus-wide name index gated by import evidence                                                                                | Scope chain + proven import/export chain only; no global name matching                                                                                            |
| **Type handling**                | Flat, file-scoped, depth-1 declared-type table; no chains beyond `this.field.x()`                                              | `TypeRegistry` with annotation binding, factory return types, namespace-qualified constructors, late binding, multi-hop receiver chains, generic-return inference |
| **Inheritance in method lookup** | Ignored except C# (poisoned by any out-of-corpus base) and Pascal                                                              | Most-derived-first walk checking implemented interfaces at each level                                                                                             |
| **Ambiguity policy**             | `if len(candidates) != 1: continue` — never fan out                                                                            | Deliberate over-approximation: base + every transitive subtype override, every interface impl                                                                     |
| **Module specifiers**            | tsconfig/jsconfig `paths` + `extends` chains + `baseUrl` + workspace packages + `exports` condition maps                       | Relative only for TS/JS; bare specifiers returned verbatim as a phantom FilePath. Python/Rust anchoring is genuinely better                                       |
| **Edge confidence**              | EXTRACTED/1.0 vs INFERRED/0.8, evidence-promoted, persisted, surfaced in report + MCP audit                                    | Enum declared (`certain\|probable\|possible`), both producers hardcode `"certain"` — dead payload                                                                 |
| **Unresolved references**        | Bare `continue`, no trace. Aggregate percentages only                                                                          | `ResolutionFailure {stage, reason, partial_info}` — 7 stages × 14 observations — emitted per call site even on total failure                                      |
| **Graph model**                  | Simple undirected NetworkX; direction via `_src`/`_tgt`; hyperedges inert                                                      | No stored graph; `CallReference.resolutions` is natively N-ary and directed                                                                                       |
| **Incrementality**               | Replace-per-source-file in the persisted JSON; cross-file passes see only the changed batch                                    | `update_file` over {file} ∪ direct dependents, re-resolved against full live registries                                                                           |
| **What's cached**                | AST results, semantic results, **and the finished graph** — a query is a JSON parse                                            | Only the per-file SemanticIndex; warm start still re-runs all resolution                                                                                          |
| **Cache invalidation**           | AST by package version, semantic by prompt fingerprint                                                                         | `CURRENT_SCHEMA_VERSION` — format only, no indexer version                                                                                                        |
| **Cache validation**             | mtime, then MD5                                                                                                                | Git plumbing (`ls-files -s`, `diff-files`, `ls-files --others`) in parallel, ~20ms for the whole repo                                                             |
| **Parallelism**                  | ProcessPoolExecutor above 20 files, cpu_count workers                                                                          | Single-threaded Node throughout; no worker_threads/Piscina anywhere                                                                                               |
| **Scale ceilings**               | Explicit: 512 MiB read cap, 5000-node viz collapse                                                                             | None; a repo large enough to exhaust heap has no degradation path                                                                                                 |
| **Multi-project**                | `project_path` on every MCP tool; cross-repo global graph (no cross-repo edges)                                                | One server, one root; `resolve_project` throws on escape                                                                                                          |
| **Resolver failure**             | Warn and continue — always produces a graph                                                                                    | Throws on duplicate/multiple-default exports, aborting `update_file` for that file                                                                                |
| **Watch**                        | Rebuild subprocess + flock + queued change draining → fresh on-disk artifact                                                   | chokidar 300ms debounce → `project.update_file` on the live Project, nothing written                                                                              |
| **Consumers**                    | Six exporters, two graph DBs, three HTML viewers, Obsidian, ~20 agent skill bundles                                            | Two MCP tools on a running server                                                                                                                                 |

### The substantive differences, and their user-visible consequences

**These are not competitors.** Graphify answers "how does this repository hang together, including its docs, build files, config and database schema," and it answers it for essentially any repo. Ariadne answers exactly one question — what calls what, and which functions are entry points — and its vocabulary contains nothing that is not in service of that. A user who wants ADR citations, package dependency graphs or a Terraform view gets nothing from Ariadne; a user who wants to know whether a function is genuinely unreachable gets nothing trustworthy from Graphify.

**Ambiguity policy is the deepest philosophical split, and both are right for their purpose.** Graphify's `if len(candidates) != 1: continue` gives a sparse graph you can trust edge-by-edge — but a polymorphic call site shows one arbitrary target or none, so reachability under dynamic dispatch is systematically understated and real entry points look reachable. Ariadne's fan-out to base plus every transitive subtype override is _exactly_ what entry-point detection needs to avoid false entry points — but a call site that could hit one of twelve subclasses reports twelve edges, all marked equally certain, so blast-radius estimates are inflated. Graphify's design would produce wrong answers to Ariadne's question; Ariadne's would produce an unusably noisy repo map.

**Parsing style trades reviewability for expressiveness.** In Ariadne, a user reporting a missed construct is fixed by editing a text pattern that is reviewable as data and validated at load with the offending dialect named. In Graphify, the same fix is an edit to Python control flow inside a 4,747-line function. Conversely Graphify runs arbitrary multi-pass analysis a single query cannot express — whole-tree pre-scans for C# interfaces and Swift protocols before the main walk (`engine.py:2267-2274`) — and onboards a new mainstream language in ~15 lines of frozensets against an already-compiled PyPI grammar, where Ariadne needs a query file, a handler registry, a metadata extractor set, a boundary extractor, and a statically-linked native grammar.

**Degradation posture is inverted, and Ariadne's is the worse user experience.** Graphify never crashes on a file: a missing grammar returns a named error telling you which pip extra restores it, a version mismatch returns an upgrade hint, Pascal falls back to regex, and an ambiguous `.m` is deliberately left unparsed rather than mangled. Ariadne's `SUPPORTED_EXTENSIONS` still discovers `go|java|cpp|c|hpp|h` (`packages/core/src/project/file_loading.ts:7`), every one of which then throws `Unsupported file extension` and is dropped with a `console.warn` (`load_project.ts:206-216`). The user sees warning spam for files that were never supportable — and a _genuinely failing_ `.ts` file disappears identically, indistinguishable from the noise. Any downstream "unreachable function" verdict is then computed against a corpus with silent holes.

**Where the input maps conflicted, I trust the code citations over `ARCHITECTURE.md`.** The doc's module table names four functions that do not exist (`build_graph`, `analyze(G)`, `render_report`, `export()`), documents `extract(path)` as file→dict when it takes a list and returns a whole-corpus dict, documents `cluster(G)` as returning a graph when it returns `{cid: [ids]}`, and claims "no side effects outside graphify-out/" when `--global` writes to `~/.graphify/`. The area maps independently verified each of these against source; the doc is stale.

---

## 6. What Ariadne could learn

Ranked by user-visible impact per unit of cost.

### 1. Capture the callable's body node in the query that captures its name; delete `find_body_scope_for_definition`

**Why it matters:** Ariadne currently re-derives a function's body scope from only its _name_ and the name's location, using four ordered positional heuristics (smallest containing anonymous scope → same line + name match → within 5 lines + name match → within 2 lines with one anonymous side) that can miss and throw (`scope_lookup.ts:25-130`). Five builder sites catch that and `console.warn`, leaving `body_scope_id` undefined (`definition_builder.ts:248, 296, 387, 438, 496`). When that happens, **every call made inside that function disappears from the call graph** — a direct hit on the tool's stated purpose, silently. Graphify never has this problem because it queues `(caller_nid, body_node)` during the definition walk (`engine.py:2345`, `:3876`). Ariadne's queries already match the enclosing definition node, so the body child is available at capture time. This is a fidelity bug fixable by construction, not by better heuristics.

**Cost:** Medium. A body capture per definition pattern in all four `.scm` files, threaded through `CaptureNode` into the builder, then delete `scope_lookup.ts:25-130` and the five try/catch/warn sites. Net removal of code; no new abstraction.

### 2. Build a module-specifier index and consult it before returning a bare specifier opaquely

**Why it matters:** `import_resolution.typescript.ts:19-32` handles `./` and `../` only; every other specifier is returned verbatim, so the literal string `@nestjs/common` gets cached as a resolved FilePath in `ImportGraph.resolved_import_paths`. Every symbol imported through a path alias or workspace package therefore fails name resolution, and every call through it becomes an unresolved reference. Any monorepo, NestJS, Vite or SvelteKit project is affected — which is most of the TypeScript world. Graphify's `_read_tsconfig_aliases` (`resolution.py:89-168`) and workspace/`exports` handling (`:378-503`) are a directly readable reference implementation, including the JSONC tolerance and TS-5 array-`extends` cases Ariadne would otherwise rediscover one bug report at a time.

**Cost:** Medium; already scoped as TASK-375.4. Note it punctures the I/O-free resolver invariant — confine manifest reads to initialize-time index construction and keep the probe path tree-only.

### 3. Put the indexer's own version in the cache key

**Why it matters:** `CURRENT_SCHEMA_VERSION = 4` guards the cache _format_ only — its own comment says "Increment when the cache FORMAT changes" (`persistence/cache_manifest.ts:5`). But a cached `SemanticIndex` is the output of `build_index_single_file`, so an indexer or query-pattern fix — exactly what tasks 374 and 375 are doing — invalidates nothing. A user with a warm `~/.ariadne` cache keeps seeing the pre-fix result for every unchanged file, and the only remedy is deleting the directory by hand. That is a user-visible correctness bug in the shipped fix, not a performance concern. Graphify namespaces `cache/ast/v{_EXTRACTOR_VERSION}/` for precisely this reason and sweeps sibling version dirs on first use (`cache.py:20-33`, `:64-76`).

**Cost:** Small. Add an indexer-version component to the manifest entry or cache dir path (the package version is already available) and reject non-matching entries in `deserialize_manifest`.

### 4. Populate the `ResolutionConfidence` field that already exists

**Why it matters:** `ResolutionConfidence` declares `certain | probable | possible` (`packages/types/src/resolution.ts:11-14`), but both producers hardcode `confidence: "certain" as const` (`call_resolver.ts:376`, `:493`). A twelve-way polymorphic fan-out and a direct same-file call are indistinguishable in the output, so a user asking "what actually calls this" cannot separate the one real caller from eleven speculative subtype overrides, and any downstream consumer weighting edges has nothing to weight by. Graphify's EXTRACTED/INFERRED split with import-evidence promotion (`extract.py:5452-5468`) demonstrates the shape works and is worth surfacing. While you're there: `resolve_polymorphic_method` currently threads `"unknown" as SymbolId` as the interface reason — pass the real id.

**Cost:** Small. Two producer sites plus threading the interface id.

### 5. Narrow `SUPPORTED_EXTENSIONS`, and turn dropped files into typed diagnostics on the Project

**Why it matters:** Discovery matches `go|java|cpp|c|hpp|h` (`file_loading.ts:7`), every one of which throws and is dropped with a stderr warning — so the user sees warning spam for files that were never supportable, and a genuinely failing `.ts` file vanishes indistinguishably. Graphify's contract instead returns a per-file `{"error": ...}` naming what went wrong and which optional extra restores it, and separately warns about files classified as code with no extractor at all (`extract.py:4605-4679`). This matters because "unreachable function" verdicts are computed against whatever survived indexing, and today nobody knows what didn't.

**Cost:** Low. Tighten the regex; add a diagnostics array on Project populated at `load_project.ts:209`; print a count at end of load.

### 6. Add a corpus-level rollup of resolution failures

**Why it matters:** Ariadne already computes strictly richer per-site data than Graphify has anywhere (`resolution_failure.ts:14-66`) but surfaces only `+N unresolved` per entry point (`packages/mcp/src/tools/core/list_entrypoints.ts:97-99`). Graphify's audit line (`report.py:93-131`, `serve.py:1695-1730`) shows how much a single aggregate is worth: a user sees at a glance whether their graph is limited by unresolved imports, unknown receiver types, or dynamic dispatch — and therefore whether to add annotations or file a bug. It also turns the triage loop's inputs into something a human can steer.

**Cost:** Small. Pure aggregation over data already on `CallReference`; no resolver change. Group by `(stage, reason)` and by `receiver_kind`.

### 7. Deduplicate references at the producer

**Why it matters:** Measured empirically, a 9-line Python file (two methods, one class, one function) yields 78 references — 65 of them `variable_reference`, with every identifier emitted three times at the identical location by overlapping query patterns, plus whole-expression pseudo-references. That ~8x multiplicity is pure cost in memory, persisted cache size, and downstream resolution work on every file in every repo, and the duplicates carry no information. Graphify's `seen_call_pairs`/`seen_indirect_pairs` (`engine.py:3768-3772`) is the pattern.

**Cost:** Low to implement (a Set guard keyed on `(kind, name, location)` in the ReferenceBuilder); medium to land safely — first confirm no downstream stage treats multiplicity as an implicit weight.

### 8. Persist the resolved layer, not just the parse layer

**Why it matters:** `restore_file` feeds a cached index straight into `apply_index_and_resolve` (`project.ts:173`, `:197`), so every cold start re-runs name resolution, cross-file inheritance, type binding and call resolution over the whole project. The cache buys back tree-sitter parsing only — on a large repo, the smaller half of the bill. For short-lived MCP invocations (the case git-accelerated detection was built for), resolution is the dominant remaining cost and it is paid in full on every cache hit. Graphify's warm `query` is a JSON parse.

**Cost:** Significant, and it cuts against Ariadne's always-consistent invariant — a persisted resolution layer needs its own invalidation rule and a merge path. Graphify's `build_merge` replace-per-source semantics is the shape to copy; its `--force` escape hatch and shrink guard are the price. Prototype against a real repo's cold-start profile before committing.

### 9. Parallelise cold-load indexing above a file-count threshold

**Why it matters:** `packages/core` and `packages/mcp` contain no `worker_threads`, `Worker`, `Piscina` or `cluster` usage; cold load is strictly serial and bounded by one CPU. Per-file indexing is embarrassingly parallel — exactly the phase Graphify farms out at `_PARALLEL_THRESHOLD = 20` (`extract.py:4500`) — and `SemanticIndex` is already JSON-serializable, which is the hard part of a worker boundary.

**Cost:** Moderate. Only `build_index_single_file` moves; registry update and resolution stay on the main thread. The native tree-sitter addon must initialise per worker, which the `globalThis` cache in `native.ts:60` already anticipates. Structured-clone cost may eat the win on small files — hence the threshold.

### 10. Adopt the non-test / path-proximity signal as an _ordering_, not a filter

**Why it matters:** Graphify uses `disambiguate_ambiguous_candidates` (`paths.py:223-280`) to pick one candidate and drop the rest — wrong for Ariadne, which needs all runtime targets. But the same signal (prefer non-test definitions for non-test call sites, then path proximity) is a good _ranking_ for presenting a twelve-way fan-out and for choosing which target to show first in `list_entrypoints` call trees.

**Cost:** Small and purely additive — the resolution set is unchanged, only presentation order.

### 11. Record the transitive-dependent decision explicitly

**Why it matters:** `update_file` and `restore_file` recompute over {file} ∪ `imports.get_dependents(file)` — one hop (`project.ts:140`, `:268`). A re-export chain or a type flowing two hops means a call site outside that set holds a resolution the change invalidated, and in a long-lived watching server that staleness never self-corrects.

**Cost:** Low to implement (walk to a fixed point), potentially large at runtime — a widely-imported types module fans out to most of the project on every keystroke. Needs measurement plus a bound; the honest alternative is documenting the one-hop limit as a known staleness mode.

### Explicitly do _not_ adopt

**Graphify's ID scheme and its collision-repair pass.** `make_id` is lossy by design (`ids.py:37-40`) and requires the 60-line salting-plus-SHA-1 repair at `resolution.py:655-712` that also rewrites every edge and raw_call endpoint, with a hand-carved exemption for module/namespace nodes — plus four further remap passes in `extract()`. Ariadne's location-keyed SymbolId makes the entire failure class impossible. The one property Graphify's slugs have that Ariadne's lack — durability across edits — is better solved by the existing `symbol_ref` display form (`file:line#name`) than by making ids lossy.

**Content sniffing** is worth _recording as a rule_ rather than building now: Graphify sniffs `.h` for ObjC before C++ before C, and refuses to parse `.m` as ObjC unless it contains ObjC directives, preferring no output over wrong output. Ariadne branches only on `.tsx` by extension. Nothing to fix today — but when the fifth language lands with an ambiguous extension, extension-only dispatch will silently mis-parse rather than skip.

---

## 7. What Graphify does worse

**It throws away every resolution failure.** Every failure path in the cross-file pass is a bare `continue` (`extract.py:5306-5405`); at build time an edge whose endpoint has no node is skipped with the comment "expected, not an error" (`build.py:873`). A Graphify user can learn that 20% of their edges are guesses but can never ask why a specific function is disconnected — the answer was discarded at the point it was known. Ariadne's `ResolutionFailure` with 7 stages, 14 taxonomy-free observations and `partial_info` carrying the resolved receiver type, import target file and last known scope, emitted on a CallReference even when resolution produced nothing (`resolution_failure.ts:14-66`, `call_resolver.ts:311-325`), is the single largest capability gap in Graphify's favour-of-Ariadne column. It is also what makes an automated triage loop possible at all.

**It has no scope model.** Same-file call binding is a flat, last-writer-wins `label_to_nid` dict (`engine.py:3695-3708`), so a shadowing local or a same-named nested definition silently redirects the edge to the wrong target — no warning, no confidence downgrade. The `parent_class_nid` pointer is reset on the default recursion branch (`engine.py:3688-3690`), so a class nested inside a function loses its parent. Ariadne's `LexicalScope` tree with inherited-name layering, function hoisting, self-initializer carve-outs and CommonJS default-class rebinding (`name_resolution.ts:98-283`) is a genuinely different class of correctness.

**Its symbol identity silently merges distinct definitions.** `add_node` returns early on a seen id (`engine.py:2276-2278`), so overloads, conditional redefinitions, and a method sharing its class's name collapse into one node — the graph shows one thing where the source has two, with no signal. And `make_id`'s normalisation means `a/b/c.md` and `a.b/c.md` mint the same id until the post-hoc repair fires, at which point it _renames the node the user saw last run_.

**Member calls die at one hop.** Chained receivers are abandoned at extraction except `this.field.method()` (`engine.py:4139-4190`), and even that only records the inner property name. `getUserService().save()` resolves to nothing, because a call-expression receiver is never typed. Ariadne walks arbitrary property chains and infers a concrete return type for a generic method returning its own type parameter from a type-token argument (`receiver_resolution.ts:1-20`, `:350-393`).

**Python instance member calls are entirely unresolved cross-file.** `self.repo.save()` and `obj.method()` produce no edge; the Python resolver handles only `ClassName.method()` and `module.func()` for genuinely imported modules (`extract.py:2306-2338`). For a Python codebase — a first-class Ariadne language — this is most of the interesting call graph.

**Inheritance is ignored in method lookup for almost every language.** Java, TypeScript and Swift match only directly-declared methods, so a call to an inherited method resolves to nothing. C# walks bases but any out-of-corpus base poisons the lookup entirely. Only Pascal does a true cross-file inheritance walk (`extract.py:2838-2843`, `:2659-2682`). Ariadne's `get_type_member` walks the chain most-derived-first, checking implemented interfaces at each level.

**Go and Rust resolution are near-broken.** Go imports never bind to a file — the target is a synthetic `go_pkg_<path>` id with no node, so every Go import edge is discarded at build, leaving Go call resolution entirely dependent on bare-name matching (`extractors/go.py:296-322`). Rust `use a::b::C` collapses to `make_id("C")`, a bare unnamespaced id that can accidentally land on an unrelated same-named local node (`extractors/rust.py:322-331`) — an actively wrong edge, not a missing one.

**Ambiguous names produce nothing at all.** The common `log`/`execute`/`find`/`run`/`handle` case yields no edge whenever two definitions share the name and no import proves which. In a large codebase that is a substantial fraction of all calls, silently absent.

**Hyperedges are a capability that does not exist.** They are advertised in the schema, the report and `how-it-works.md`, produced only by the LLM pass at ≤3 per chunk, and read by nothing — not clustering, not query, not shortest path, not god-nodes, not `affected`, not Neo4j, not FalkorDB (`export.py:162`, `:314`). A user cannot ask "which nodes participate in this group relation" through any tool. Ariadne's `resolutions` array is natively N-ary and is the actual working model.

**Node kind is a label convention, not data.** Nothing in extraction emits `type: "function"` or `type: "class"`; `callflow_html.node_kind` reconstructs it downstream from label casing, `()` suffix, filename substrings and keyword matching (`callflow_html.py:488`) — a lossy round-trip that every consumer has to redo.

**The graph is stored undirected**, with direction smuggled through `_src`/`_tgt` attributes that a NetworkX round-trip destroys (#760, `build.py:1127`). Parallel edges between the same pair collapse. Ariadne's model never had this problem because it never serialised.

**Incremental cross-file correctness is bounded.** On an incremental run only changed files are re-extracted, so the cross-file passes see only that batch — an unchanged caller's edges into a changed callee are not recomputed, and a rename that changes a callee's id without touching the caller is not re-resolved (`extract.py:4754-4762`, `cli.py:3499-3515`). This is why `--force` and the shrink guard exist. Ariadne's per-file registry replacement is exact for the changed file and its direct importers.

**Resolver failures are swallowed.** Every language resolver and cross-file pass is wrapped in try/except that logs a warning and continues (`resolver_registry.py:78-84`), so a partial or silently degraded graph is a normal outcome. Ariadne refuses to index a file whose export surface it cannot model unambiguously (`registries/export.ts:84-178`) — the user loses that file, but is never handed a silently wrong export table.

**No cross-repo relationships.** `merge-graphs` and the global graph prefix node ids by tag and `nx.compose`, creating zero edges between repos and normalising DiGraph/MultiGraph inputs down to a plain undirected Graph (`cli.py:2110-2136`, `global_graph.py:124-145`). The label-only dedup of sourceless externals can conflate two unrelated same-named packages.

**Some extensions are counted but contribute nothing.** `.r`/`.R`, `.ejs`, `.ets`, `.dme` appear in `CODE_EXTENSIONS` with no `_DISPATCH` entry, so they inflate the "found N code files" count while producing zero nodes. The code warns rather than fixing it.
