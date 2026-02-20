# Architecture

## Overview

Ariadne is a tree-sitter query-based code analysis tool. It extracts structural information from source code, resolves symbol references, and detects entry points via call graph analysis. It supports TypeScript, JavaScript, Python, and Rust.

## Module Structure

```
packages/
├── core/src/
│   ├── index_single_file/    # Per-file semantic indexing (4-pass pipeline)
│   ├── resolve_references/   # Symbol resolution + project registries
│   ├── trace_call_graph/     # Call graph construction + entry point detection
│   └── project/              # Pipeline orchestration + incremental updates
├── types/src/                # Shared type definitions (SymbolId, definitions, references)
└── mcp/                      # MCP server for IDE integration
```

### index_single_file/

Builds a `SemanticIndex` for a single source file. The 4-pass pipeline (query → scopes → definitions → references) uses tree-sitter queries and language-specific handlers to extract all semantic information from one file.

Key subdirectories:

- `query_code_tree/` — Tree-sitter query execution, capture handlers, metadata extractors, symbol factories
- `scopes/` — Lexical scope tree building with language-specific boundary extractors
- `definitions/` — Definition builder (functions, classes, methods, variables, etc.)
- `references/` — Reference builder (calls, type references, variable references)
- `type_preprocessing/` — Type information extraction

### resolve_references/

Resolves symbol names to `SymbolId`s and function/method/constructor calls to their target definitions. Two-phase architecture:

1. **Name resolution** — Lexical scope walk (local → imports → parent)
2. **Call resolution** — Type-aware dispatch (function calls, method dispatch, constructors)

Also contains the project-level registries:

- `registries/` — `DefinitionRegistry`, `TypeRegistry`, `ScopeRegistry`, `ExportRegistry`, `ReferenceRegistry`
- `call_resolution/` — Function, method, constructor, and collection dispatch resolvers
- `import_resolution/` — Language-specific import path resolvers

### trace_call_graph/

Builds the call graph and identifies entry points (functions never called). Handles indirect reachability (functions in collections, function references) and language-specific filtering.

### project/

The `Project` class orchestrates the full pipeline. It manages incremental updates: when a file changes, it recomputes the file's `SemanticIndex`, updates all registries, and re-resolves the file plus its dependents.

## Language Dispatch Pattern

Language-specific code uses the `{module}.{language}.ts` naming convention. A main dispatcher routes to language-specific implementations based on file extension. This pattern appears in capture handlers, metadata extractors, import resolvers, receiver resolvers, scope boundary extractors, and test file detectors.

## Symbol System

All identifiers use the branded `SymbolId` type, constructed via factory functions (`function_symbol()`, `class_symbol()`, `method_symbol()`, etc.) in `packages/types/src/symbol.ts`. SymbolIds encode kind, file path, location, and name for globally unique identification.

## Registry Architecture

Project-level registries aggregate per-file data and support incremental updates:

| Registry | Purpose |
|----------|---------|
| `DefinitionRegistry` | All definitions, indexed by symbol, file, location, scope, member, type subtypes |
| `TypeRegistry` | Resolved type relationships, inheritance, interface implementations |
| `ScopeRegistry` | Scope trees for cross-file scope lookups |
| `ExportRegistry` | Export tracking per file |
| `ReferenceRegistry` | Raw references per file (source of truth for call resolution) |
| `ImportGraph` | Import dependency tracking for incremental re-resolution |
| `ResolutionRegistry` | Symbol and call resolution state (immutable `ResolutionState`) |

Each registry exposes `update_file()` and `remove_file()` for incremental operations.
