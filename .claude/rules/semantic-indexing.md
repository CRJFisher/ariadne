---
paths: packages/core/src/index_single_file/**
---

# Semantic Indexing

## Purpose

`index_single_file` builds a `SemanticIndex` for a single source file. It extracts definitions, references, scopes, and type information using tree-sitter queries.

## 4-Pass Pipeline

The entry point `build_index_single_file()` runs four sequential passes:

1. **Query Tree** (`query_code_tree/`) — Execute tree-sitter `.scm` queries against the AST, producing `CaptureNode[]`
2. **Build Scopes** (`scopes/`) — Build `LexicalScope` tree from scope-creating captures, producing `ProcessingContext`
3. **Process Definitions** (`definitions/`) — Convert definition captures into `AnyDefinition[]` using language-specific `CaptureHandler` registries
4. **Process References** (`references/`) — Convert reference captures into typed references using language-specific `MetadataExtractor` functions

## Module Layout

```
index_single_file/
├── index_single_file.ts          # Pipeline orchestrator (entry point)
├── query_code_tree/              # PASS 1: tree-sitter query execution
│   ├── queries/                  # .scm query files per language
│   │   └── CAPTURE-SCHEMA.md     # Canonical capture naming spec
│   ├── capture_handlers/         # Definition builders per language
│   ├── metadata_extractors/      # AST metadata extraction per language
│   └── symbol_factories/         # Definition + reference creators per language
├── scopes/                       # PASS 2: lexical scope tree
│   ├── scopes.ts                 # Main scope processor (language-agnostic)
│   ├── boundary_extractor.ts     # Dispatcher to language extractors
│   └── extractors/               # Language-specific boundary extraction
├── definitions/                  # PASS 3: definition builder
├── references/                   # PASS 4: reference builder
└── type_preprocessing/           # Type information extraction
```

## Key Types

- **`SemanticIndex`** — Output of the full pipeline: `{ file_path, language, root_scope_id, scopes, definitions (by kind), references }`
- **`CaptureNode`** — Normalized tree-sitter capture: `{ category, entity, name, text, location, node }`
- **`ProcessingContext`** — Context threaded through passes 2-4: `{ captures, scopes, scope_depths, root_scope_id, get_scope_id() }`
- **`LexicalScope`** — Scope tree node: `{ id, parent_id, name, type, location, child_ids }`

## Capture Naming Convention

Captures follow the pattern `@{category}.{entity}[.{qualifier}]`. Categories include: scope, definition, reference, import, export, type, assignment, return, decorator, modifier. See `@packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md` for the full specification.

## Scope Boundary Semantics

Every scope-creating construct has three positions:

1. **Symbol Location** — Where the name is declared (belongs to parent scope)
2. **Scope Start** — Where the scope begins (after `:` in Python, `{` in TS/JS)
3. **Scope End** — Where the scope body ends

Each language has a `ScopeBoundaryExtractor` that converts tree-sitter node positions to semantic scope boundaries. This centralizes language-specific logic instead of scattering it through the scope processor.

```
Tree-Sitter Query → CaptureNode (raw position)
    → ScopeBoundaryExtractor (language-specific)
    → { symbol_location, scope_location }
    → Scope Processor (language-agnostic) → scope tree
```

## Arrow Function Handling

Arrow functions and function expressions assigned to variables are captured as function definitions only, not as both function and variable definitions. This prevents duplicate symbols — the function symbol is sufficient for call graph analysis and reference resolution.
