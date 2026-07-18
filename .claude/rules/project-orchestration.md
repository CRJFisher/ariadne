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
├── project_cache_strategy.ts         # Cache read/write policy; sole owner of content-hash + index/manifest writes
├── file_loading.ts                   # Source file discovery and ignore rules
├── parse_file.ts                     # Parse-phase language dispatch (grammar selection → ParsedFile)
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

## Incremental Update Strategy

When `update_file(file_id, content)` is called:

1. **Track dependents** — Find files that import from the changed file (via `ImportGraph`)
2. **Compute SemanticIndex** — Run `index_single_file` on the changed file
3. **Update all registries** — Push new definitions, types, scopes, exports, references
4. **Re-resolve affected files** — Re-run name resolution and call resolution for the changed file + all dependents

## Integration Testing

Integration tests in `project/` verify end-to-end behavior:

- Multi-file projects with cross-file imports
- Incremental updates and re-resolution
- Language-specific scenarios
