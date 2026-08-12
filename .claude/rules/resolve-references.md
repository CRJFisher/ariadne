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
- **Rust `::` paths** → The qualifier the author wrote binds the terminal, ahead of any same-name local. `path_resolution.rust.ts` owns the qualifier hops, in order: `Self` substitutes the enclosing impl type; a qualifier naming a type takes the terminal from its member index; a qualifier naming an in-file `mod` block takes it from that body; otherwise the path resolves to a module **file** and the terminal is looked up inside it. When the path names nothing the project holds, `function_call.rust.ts` falls back to a `use` statement in lexical scope that anchors the terminal — named imports first, then a wildcard edge fanned out across the module's whole surface.

  Two rules stop the file hop fabricating an edge: the leading segment must be something a Rust path root can be (a `crate`/`self`/`super` anchor, a module bound in scope, or a workspace crate), and the file it lands on must be one the project has indexed. A `use` that binds an item rather than a module is never followed as a module.

- **Rust `mod` declaration → module file** → A bodyless `mod x;` is captured twice: as the `NamespaceDefinition` that binds the name, and as a namespace `ImportDefinition` carrying the edge to the file. `ImportGraph` resolves that edge's path once and caches it, which is what makes the module file a dependency of its declarer — so editing the module re-resolves the declarer, and anything reaching `crate::declarer::x::item` through it. `#[path = "…"]` puts a file path on the edge instead of a `::` path.
- **Collection dispatch** → Variable holding function collection → member function lookup
- **Type-token generic return** → A chained method whose return type is a bare generic bound by a type-token parameter (`get<T>(token: Type<T>): T`) resolves against the class the token argument names. The token is carried on the reference's `property_chain_arguments` (captured in `index_single_file`, aligned to `property_chain`) and inferred in `receiver_resolution.ts`.

**Output:** `Map<FilePath, CallReference[]>` — resolved call references with target `SymbolId`s.

## Module Layout

```
resolve_references/
├── index.ts                      # Stage-2 barrel (registries, ResolutionRegistry, ImportGraph)
├── resolution_registry.ts        # ResolutionRegistry (thin orchestration wrapper)
├── resolution_state.ts           # Immutable state + pure resolution functions
├── name_resolution.ts            # Phase 1: scope-based name resolution
├── export_chain_lookup.ts        # Named/namespace export lookup through re-export chains
├── preprocess_references.ts      # Reference preprocessing (marshaller)
├── preprocess_references.python.ts  # Python class-instantiation calls → constructor calls
├── indirect_reachability.ts      # Functions reachable via collection/reference
├── file_folders.ts               # Virtual folder tree: I/O-free file-existence checks
├── registries/                   # Project-level data stores
│   ├── definition.ts             # DefinitionRegistry (all definitions, multiple indexes)
│   ├── type.ts                   # TypeRegistry (type metadata, inheritance)
│   ├── scope.ts                  # ScopeRegistry (scope tree persistence + enclosing-function walk)
│   ├── export.ts                 # ExportRegistry (export tracking)
│   ├── export.{python,typescript}.ts  # Language-specific export dedup rules
│   └── reference.ts              # ReferenceRegistry (raw reference storage)
├── call_resolution/              # Phase 2: type-aware call resolution
│   ├── call_resolver.ts          # Main orchestrator
│   ├── function_call.ts          # Function call resolution
│   ├── function_call.rust.ts     # Rust ::-qualified call entry + `use`-anchor fallback
│   ├── method_call.ts            # Method call resolution
│   ├── method_lookup.ts          # Polymorphic method lookup
│   ├── constructor.ts            # Constructor resolution
│   ├── constructor.rust.ts       # Rust associated-constructor resolution
│   ├── path_resolution.rust.ts   # The single Rust `::`-path resolver (Self, type members, module files)
│   ├── callable_instance.python.ts  # Python __call__ callable-instance resolution
│   ├── collection_dispatch.ts    # Collection-stored function dispatch
│   └── receiver_resolution.ts    # Receiver type inference (unified base + property-chain walk)
├── type_preprocessing/           # Type metadata extraction from definitions and references
│   ├── index.ts                  # type_preprocessing barrel
│   ├── bindings.ts               # Variable/parameter type bindings
│   ├── constructor_bindings.ts   # Constructor call type bindings
│   └── member.ts                 # Type member extraction (methods, properties, enum members)
└── import_resolution/            # Cross-file import path resolution
    ├── index.ts                  # import_resolution barrel
    ├── import_graph.ts           # ImportGraph (import dependency tracking)
    ├── module_specifier_index.ts # Package/crate name → its directory or entry file: tsconfig `paths` + `extends` chains, package `exports` maps, Cargo crate roots
    ├── import_resolution.ts      # Marshaller (language switch)
    └── import_resolution.{javascript,python,rust,typescript}.ts  # Language-specific resolvers
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

## Hook Enforcement

Naming is hook-enforced by `file_naming_validator.ts` — see `@.claude/rules/file-naming.md`.
`import_resolution/` is the reference marshaller shape: `@.claude/rules/language-patterns.md`.
