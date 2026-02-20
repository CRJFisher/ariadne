# Ariadne Documentation

## Architecture

- [Architecture](./ARCHITECTURE.md) — Module structure, registry architecture, language dispatch pattern
- [Processing Pipeline](./PROCESSING_PIPELINE.md) — Per-file indexing, project-level resolution, call graph detection

## Subsystem Guidance

Scoped rules files in `.claude/rules/` provide detailed subsystem documentation:

| Rule File | Scope |
|-----------|-------|
| `semantic-indexing.md` | `index_single_file/` — 4-pass pipeline, scope boundary semantics |
| `resolve-references.md` | `resolve_references/` — 2-phase resolution, registries |
| `trace-call-graph.md` | `trace_call_graph/` — Entry point detection, indirect reachability |
| `project-orchestration.md` | `project/` — Pipeline coordination, incremental updates |
| `symbol-system.md` | All packages — SymbolId, factory functions |
| `language-patterns.md` | `packages/core/src/` — Language dispatch, cross-language consistency |

## In-Tree Documentation

- `packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md` — Capture naming specification
