---
"@ariadnejs/core": major
"@ariadnejs/types": major
---

Publish the export surface by pipeline stage, and report what a load dropped.

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
- **`TypeKind` is removed** from `@ariadnejs/types`, along with the
  `AnalysisError` and `AnalysisPhase` types and the `errors` module that held
  them. Error reporting flows through `Result`.

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
