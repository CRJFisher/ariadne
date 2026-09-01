---
paths: packages/core/src/project/**
---

# Project Orchestration

## Purpose

The `Project` class coordinates the full analysis pipeline: parse → index → update registries → resolve → trace call graph. It manages incremental updates when files change.

## Pipeline Flow

```
Source File
    → index_single_file()           # Per-file: 4-pass semantic indexing
    → Update Registries              # Project-level: definition, type, scope, export, reference
    → ResolutionRegistry             # Phase 1: name resolution, Phase 2: call resolution
    → trace_call_graph()             # Entry point detection
```

## Module Layout

```
project/
├── project.ts                        # Project class (main orchestrator)
├── load_project.ts                   # Project construction from a path (discovery + cache orchestration)
├── project_cache_strategy.ts         # Cache read/write policy; sole owner of content-hash computation and blob writes
├── file_loading.ts                   # Source file discovery and ignore rules
├── parse_file.ts                     # Parse-phase language dispatch (grammar selection → ParsedFile)
├── parallel_index.ts                 # Pass A across worker threads: ordered SemanticIndex delivery
├── detect_test_file.ts               # Test file detection (marshaller)
├── detect_test_file.{language}.ts    # Language-specific test detection
├── test_dir_patterns.ts              # TEST_DIR_PATTERNS + directory-name test markers
├── extract_parameters.ts             # Parameter extraction from definitions
├── fix_import_locations.ts           # Import location correction
└── index.ts
```

Enforcement: naming is hook-enforced by `file_naming_validator.ts` — see
`@.claude/rules/file-naming.md`.

## Key Registries

The `Project` class holds these registries, all updated via `update_file()`:

| Registry             | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `DefinitionRegistry` | All definitions with indexes by symbol, file, location, scope, member, type subtypes |
| `TypeRegistry`       | Resolved type relationships: symbol→type, type→members, inheritance, interfaces      |
| `ScopeRegistry`      | Persisted scope trees for cross-file lookups                                         |
| `ExportRegistry`     | Export tracking per file for import resolution                                       |
| `ReferenceRegistry`  | Raw references per file (source of truth for call resolution)                        |
| `ImportGraph`        | Import dependency graph for incremental re-resolution                                |
| `ResolutionRegistry` | Symbol and call resolution state                                                     |

## Two Drivers, One Set of Phases

`Project` exposes the phases through two drivers. Both compose the same private
steps — `populate_registries` (Phase 2), `fix_import_locations_for_file`
(Phase 2.5), `resolve_files` (Phases 3-5) and `evict_file` — so no phase has a
second implementation.

### Incremental — the file watcher

`update_file(file_id, content)`, `restore_file` and `remove_file` repair an
already-consistent project after one file changes:

1. **Track dependents** — read the files that reach the changed file from `ImportGraph`, before the import graph is rewritten
2. **Compute SemanticIndex** — run `index_single_file` on the changed file
3. **Populate registries** — push its definitions, scopes, exports, references and imports
4. **Fix its import locations** — repoint its `ImportDefinition`s at the definitions they name
5. **Resolve the affected files** — the file plus every file whose resolutions its surface reaches

### Bulk — a corpus load

`ingest_file(file_id, content)` (or `ingest_restored_file` from cache) once per
file, then `resolve_corpus()` once. Pass A parses, indexes and populates
registries and resolves nothing; `evict_ingested_file` rolls back a file whose
ingest threw, without resolving. Pass B runs Phase 2.5 for every file and then
Phases 3-5 for the whole corpus.

Between the first ingest and `resolve_corpus()` the project is deliberately
inconsistent — definitions and scopes are present, resolutions are absent — and
nothing may read the call graph in that window.

Deferring resolution is what keeps a load flat. Resolving on arrival re-resolves
every already-loaded importer each time a file lands, and asks each question
against the fraction of the corpus that has arrived: measured over vscode's
`src/`, `resolve_names` ran 1,183 times for a 1,200-file load against once, and
an import naming a file that had not arrived yet pointed at the import statement
for good.

## Integration Testing

Integration tests in `project/` verify end-to-end behavior:

- Multi-file projects with cross-file imports
- Incremental updates and re-resolution
- Language-specific scenarios
