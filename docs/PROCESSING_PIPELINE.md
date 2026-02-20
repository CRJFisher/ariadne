# Processing Pipeline

## Overview

Ariadne's processing pipeline has two modes:

- **Per-file** — `build_index_single_file()` produces a `SemanticIndex` for one file
- **Project-level** — `Project.update_file()` incrementally updates registries, resolves symbols, and computes the call graph

## Per-File: Semantic Indexing

`build_index_single_file(parsed_file, tree, language)` runs a 4-pass pipeline:

```
Source Code → tree-sitter AST
    │
    ├── PASS 1: query_code_tree()     → CaptureNode[]
    ├── PASS 2: process_scopes()      → LexicalScope tree + ProcessingContext
    ├── PASS 3: process_definitions() → AnyDefinition[] (via CaptureHandlers)
    └── PASS 4: process_references()  → SymbolReference[] (via MetadataExtractors)
    │
    └── SemanticIndex
```

**Pass 1** executes tree-sitter `.scm` queries against the AST. Language-specific query files live in `query_code_tree/queries/`. Each capture follows the `@category.entity[.qualifier]` naming convention defined in `CAPTURE-SCHEMA.md`.

**Pass 2** builds the lexical scope tree from scope-creating captures. Language-specific `ScopeBoundaryExtractor` classes handle differences in how tree-sitter reports scope boundaries.

**Pass 3** converts definition captures into typed definition objects using language-specific `CaptureHandler` registries. Each handler maps a capture pattern to a definition factory.

**Pass 4** converts reference captures into typed reference objects using language-specific `MetadataExtractor` functions that read additional AST context.

**Output:** `SemanticIndex` containing `{ file_path, language, root_scope_id, scopes, definitions (by kind), references }`.

## Project-Level: Incremental Update

`Project.update_file(file_id, content)` coordinates the full pipeline:

```
Phase 0:  Track dependents (via ImportGraph)
Phase 1:  Compute SemanticIndex (per-file 4-pass pipeline)
Phase 2:  Update registries
            ├── DefinitionRegistry  (all definitions, indexed by symbol/file/location/scope/member)
            ├── ScopeRegistry       (scope trees for cross-file lookups)
            ├── ExportRegistry      (exports per file)
            ├── ReferenceRegistry   (raw references per file)
            └── ImportGraph         (import dependency tracking)
Phase 3:  Name resolution (lexical scope walk: local → imports → parent)
Phase 3.5: Cross-file type inheritance resolution
Phase 3.6: Reference preprocessing (language-specific, e.g., Python class instantiation)
Phase 4:  Type registry update (resolves type names to SymbolIds)
Phase 5:  Call resolution (function/method/constructor dispatch using types)
```

Phases 3-5 run on the changed file **and** all its dependents (files that import from it), ensuring project-wide consistency.

## Call Graph: Entry Point Detection

`trace_call_graph(definitions, resolutions)` builds the call graph from resolved data:

1. Create a `CallableNode` for each callable definition with its enclosed `CallReference[]`
2. Identify entry points — functions with no incoming call edges and no indirect reachability

Entry points are functions never called by any other function in the codebase. Indirect reachability (functions stored in collections or passed as references) is tracked to avoid false positives.

## Data Flow

```
SemanticIndex (per-file)
    ↓
Registries (project-level, incrementally updated)
    ↓
Name Resolution → Type Resolution → Call Resolution
    ↓
CallGraph { nodes, entry_points, indirect_reachability }
```

## Language Support

TypeScript, JavaScript, Python, Rust. Each language has:

- Tree-sitter `.scm` query files
- Capture handlers and metadata extractors
- Scope boundary extractors
- Import resolvers and receiver resolvers
- Test file detectors
