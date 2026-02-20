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
├── import_graph.ts                   # Import dependency tracking
├── detect_test_file.ts               # Test file detection (dispatcher)
├── detect_test_file.{language}.ts    # Language-specific test detection
├── extract_nested_definitions.ts     # Method/property extraction from classes
├── fix_import_locations.ts           # Import location correction
└── index.ts
```

## Key Registries

The `Project` class holds these registries, all updated via `update_file()`:

| Registry | Purpose |
|----------|---------|
| `DefinitionRegistry` | All definitions with indexes by symbol, file, location, scope, member, type subtypes |
| `TypeRegistry` | Resolved type relationships: symbol→type, type→members, inheritance, interfaces |
| `ScopeRegistry` | Persisted scope trees for cross-file lookups |
| `ExportRegistry` | Export tracking per file for import resolution |
| `ReferenceRegistry` | Raw references per file (source of truth for call resolution) |
| `ImportGraph` | Import dependency graph for incremental re-resolution |
| `ResolutionRegistry` | Symbol and call resolution state |

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
