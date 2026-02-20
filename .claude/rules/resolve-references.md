---
paths: packages/core/src/resolve_references/**
---

# Resolve References

## Purpose

`resolve_references` resolves symbol names to `SymbolId`s and resolves function/method/constructor calls to their target definitions. It operates on the project-level registries built from per-file `SemanticIndex` data.

## 2-Phase Architecture

### Phase 1: Name Resolution (`name_resolution.ts`)

Resolves symbol names within scopes using lexical scope walk:

1. Check local scope definitions
2. Check imports
3. Walk up to parent scope (repeat)

**Output:** `Map<ScopeId, Map<SymbolName, SymbolId>>` — what each name resolves to in each scope.

### Phase 2: Call Resolution (`call_resolution/`)

Resolves call references to their target definitions using name resolution results + type information:

- **Function calls** → Direct name lookup in scope via Phase 1 results
- **Method calls** → Receiver type → class definition → member lookup (with polymorphic dispatch)
- **Constructor calls** → Type name → class definition → constructor lookup
- **Collection dispatch** → Variable holding function collection → member function lookup

**Output:** `Map<FilePath, CallReference[]>` — resolved call references with target `SymbolId`s.

## Module Layout

```
resolve_references/
├── resolve_references.ts         # ResolutionRegistry (thin orchestration wrapper)
├── resolution_state.ts           # Immutable state + pure resolution functions
├── name_resolution.ts            # Phase 1: scope-based name resolution
├── preprocess_references.ts      # Reference preprocessing
├── indirect_reachability.ts      # Functions reachable via collection/reference
├── registries/                   # Project-level data stores
│   ├── definition.ts             # DefinitionRegistry (all definitions, multiple indexes)
│   ├── type.ts                   # TypeRegistry (type metadata, inheritance)
│   ├── scope.ts                  # ScopeRegistry (scope tree persistence)
│   ├── export.ts                 # ExportRegistry (export tracking)
│   ├── reference.ts              # ReferenceRegistry (raw reference storage)
│   └── index.ts
├── call_resolution/              # Phase 2: type-aware call resolution
│   ├── call_resolver.ts          # Main orchestrator
│   ├── function_call.ts          # Function call resolution
│   ├── method.ts                 # Method call resolution
│   ├── method_lookup.ts          # Polymorphic method lookup
│   ├── constructor.ts            # Constructor resolution
│   ├── collection_dispatch.ts    # Collection-stored function dispatch
│   └── receiver_resolution.*.ts  # Language-specific receiver type inference
└── import_resolution/            # Cross-file import path resolution
    ├── import_resolution.ts      # Dispatcher
    └── import_resolution.*.ts    # Language-specific import resolvers
```

## Key Types

- **`ResolutionRegistry`** — Thin wrapper coordinating Phase 1 and Phase 2; holds `ResolutionState`
- **`ResolutionState`** — Immutable state: `{ resolutions_by_scope, resolved_calls_by_file, calls_by_caller_scope, indirect_reachability }`
- **`DefinitionRegistry`** — Central definition store with indexes by symbol, file, location, scope, member, and type subtypes
- **`TypeRegistry`** — Resolved type relationships: symbol types, type members, parent classes, implemented interfaces
- **`ScopeRegistry`** — Persists scope trees from `SemanticIndex` for cross-file scope lookups
- **`ExportRegistry`** — Tracks exports per file for import resolution
- **`ReferenceRegistry`** — Stores raw references per file (source of truth for call resolution)

## Resolution State Immutability

Resolution state is stored in an immutable `ResolutionState` object. All resolution operations are pure functions that take state as input and return new state. The `ResolutionRegistry` wraps this pattern.

## Incremental Updates

When a file changes, the `Project` class:

1. Re-indexes the file (`index_single_file`)
2. Updates all registries (`definitions`, `types`, `scopes`, `exports`, `references`)
3. Re-resolves the changed file + its dependents (files that import from it)
