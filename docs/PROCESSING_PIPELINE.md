# Code Analysis Processing Pipeline

## Overview

The processing pipeline follows a **three-phase architecture**:

1. **Per-File Analysis** (parallel) - Extract local information from each file independently
2. **Global Assembly** (sequential) - Build cross-file registries and hierarchies
3. **Enrichment** (sequential) - Enhance per-file data with global knowledge

This architecture enables parallelization while maintaining cross-file consistency through a carefully orchestrated enrichment phase that bridges local and global analysis.

## Phase 1: Per-File Analysis (Parallel)

Each file is analyzed independently to extract local information. This phase can be fully parallelized across CPU cores.

### Layer 0: Foundation

**Dependencies:** None

**Processing:**

- Parse source code into AST using tree-sitter
- Prepare file metadata (language, path, source)

**Outputs:** `ParsedFile { ast: SyntaxNode, source: string, language: Language }`

### Layer 1: Scope Analysis

**Dependencies:** AST

**Processing:**

- Build hierarchical scope structure
- Find symbol definitions within scopes
- Track symbol usages and references
- Analyze variable declarations and closures

**Modules:**

- `/scope_analysis/scope_tree` - Hierarchical scope structure
- `/scope_analysis/definition_finder` - Symbol definitions
- `/scope_analysis/usage_finder` - Symbol usages

**Outputs:** `ScopeTree`, symbol definitions, variable declarations, closure captures

### Layer 2: Local Structure Detection

**Dependencies:** Scope Analysis

**Processing:**

- Extract import declarations (including namespace and type-only imports)
- Detect export statements (including type-only exports)
- Find class definitions and inheritance relationships
- Identify interfaces, traits, enums, and type aliases
- Extract decorators and annotations

**Modules:**

- `/import_export/import_resolution` - Import extraction
- `/import_export/export_detection` - Export detection
- `/inheritance/class_detection` - Class structure extraction

**Outputs:** imports, exports, class/interface/enum definitions, type aliases, decorators

### Layer 3: Local Type Analysis

**Dependencies:** Local Structure Detection, Scope Analysis

**Processing:**

- Track variable types within file scope
- Infer parameter types from usage
- Infer return types from function bodies
- Parse explicit type annotations
- Track type guards and narrowing

**Modules:**

- `/type_analysis/type_tracking` - Variable type tracking
- `/type_analysis/parameter_type_inference` - Parameter inference
- `/type_analysis/return_type_inference` - Return type inference

**Outputs:** variable type maps, inferred types, type annotations, type guards

### Layer 4: Local Call Analysis

**Dependencies:** Local Type Analysis, Scope Analysis

**Processing:**

- Find function calls and their arguments
- Find method calls with receiver types (when available locally)
- Find constructor calls
- Extract types from constructor calls (bidirectional flow)
- Track async/await patterns
- Identify callbacks and event handlers

**Modules:**

- `/call_graph/function_calls` - Function call detection
- `/call_graph/method_calls` - Method call detection
- `/call_graph/constructor_calls` - Constructor call detection with type extraction

**Outputs:** function calls, method calls, constructor calls with discovered types

---

## Phase 2: Global Assembly (Sequential)

Combines per-file analyses to build global understanding. This phase runs sequentially after all files are analyzed.

### Layer 5: Module Graph Construction

**Dependencies:** All per-file imports/exports

**Processing:**

- Build module dependency graph
- Resolve module paths (relative, absolute, aliases)
- Detect circular dependencies
- Trace re-export chains

**Modules:**

- `/import_export/module_graph` - Dependency graph builder

**Outputs:** `ModuleGraph`, resolved import paths, circular dependencies

### Layer 6: Type Registry & Class Hierarchy

**Dependencies:** Module Graph, All per-file type definitions

**Processing:**

- Build central type registry from all type definitions
- Construct class inheritance hierarchy
- Track interface implementations
- Identify method overrides
- Compute method resolution order
- Build virtual method tables

**Modules:**

- `/type_analysis/type_registry` - Central type storage
- `/inheritance/class_hierarchy` - Inheritance tree builder
- `/inheritance/interface_implementation` - Interface tracking
- `/inheritance/method_override` - Override detection

**Outputs:** `TypeRegistry`, `ClassHierarchy`, method resolution order, virtual method tables

### Layer 7: Cross-File Type Resolution

**Dependencies:** Type Registry, Module Graph, Class Hierarchy

**Processing:**

- Resolve types across file boundaries
- Propagate types through data flow
- Resolve namespace members
- Handle generic type instantiation
- Resolve union/intersection types
- Expand type aliases

**Modules:**

- `/type_analysis/type_resolution` - Cross-file type resolver
- `/type_analysis/type_propagation` - Type flow analysis
- `/import_export/namespace_resolution` - Namespace member resolver

**Outputs:** resolved types, generic instantiations, type compatibility matrix

### Layer 8: Global Symbol Resolution

**Dependencies:** Type Resolution, Module Graph

**Processing:**

- Build global symbol table
- Resolve symbol references across files
- Handle import/export aliases
- Track symbol visibility and accessibility

**Modules:**

- `/scope_analysis/symbol_resolution` - Symbol reference resolver

**Outputs:** resolved symbol references, global symbol table

---

## Phase 3: Enrichment (Sequential)

Uses global knowledge to enhance and validate per-file analysis results. This critical phase bridges the gap between local and global analysis.

### Enrichment Pattern

The enrichment phase operates on the principle of **progressive enhancement**:

1. Per-file analysis extracts raw, unvalidated data
2. Global assembly builds comprehensive registries
3. Enrichment validates and enhances per-file data with global context

### Method Call Enrichment

**Processing:**

- Validate method calls against class hierarchy
- Resolve inherited methods to their defining class
- Identify method overrides and their chains
- Mark virtual method calls with possible targets
- Distinguish interface methods from class methods

**Function:** `enrich_method_calls_with_hierarchy(calls, hierarchy)`

**Enhancements:**

- `defining_class_resolved` - Actual class that defines the method
- `is_override` - Whether this overrides a parent method
- `override_chain` - Full inheritance chain for overrides
- `is_virtual_call` - Whether this could dispatch to subclasses
- `possible_targets` - All possible dispatch targets

### Constructor Call Enrichment

**Processing:**

- Validate constructor calls against type registry
- Resolve imported class constructors
- Check constructor parameter compatibility
- Handle type aliases in constructor calls
- Mark invalid constructor calls

**Function:** `enrich_constructor_calls_with_types(calls, registry, imports)`

**Enhancements:**

- `is_valid` - Whether the type exists in registry
- `resolved_type` - Fully qualified type name
- `expected_params` - Expected constructor signature
- `is_imported` - Whether this is an imported class
- `type_kind` - class/interface/struct/trait

### Type Flow Enhancement

**Processing:**

- Merge constructor-discovered types into type maps
- Propagate types through call chains
- Update type confidence based on global validation
- Resolve ambiguous types using global context

**Function:** `merge_constructor_types(existing_types, constructor_types)`

**Enhancements:**

- Types discovered from constructor calls
- Cross-file type validation
- Improved type confidence scores

### Call Graph Completion

**Dependencies:** All enriched data

**Processing:**

- Trace complete call chains with validated methods
- Resolve polymorphic calls using hierarchy
- Track async execution flows
- Detect recursive call patterns
- Identify unreachable code

**Modules:**

- `/call_graph/call_chain_analysis` - Call chain tracer

**Outputs:** complete call graph, validated call chains, execution flows

---

## Processing Order

### Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Per-File Phase                        │
│                     (Parallel)                           │
├─────────────────────────────────────────────────────────┤
│  For each file in parallel:                              │
│    1. Parse AST                                          │
│    2. Build scope tree                                   │
│    3. Find definitions and usages                        │
│    4. Extract imports/exports                            │
│    5. Detect classes/interfaces/types                    │
│    6. Track local types                                  │
│    7. Find calls (with type extraction)                  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Global Assembly Phase                   │
│                     (Sequential)                         │
├─────────────────────────────────────────────────────────┤
│  1. Build module graph from imports/exports              │
│  2. Build type registry from all type definitions        │
│  3. Build class hierarchy from all classes               │
│  4. Resolve types across files                           │
│  5. Resolve symbols globally                             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Enrichment Phase                       │
│                     (Sequential)                         │
├─────────────────────────────────────────────────────────┤
│  1. Enrich method calls with hierarchy                   │
│  2. Enrich constructor calls with types                  │
│  3. Merge type discoveries                               │
│  4. Complete call graph with validations                 │
│  5. Trace execution flows                                │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

- **Forward Flow**: Per-file → Global Assembly → Enrichment
- **Bidirectional Flow**: Constructor calls ↔ Type tracking (within per-file)
- **Enrichment Flow**: Global registries → Per-file enhancements

---

## Architectural Deficiencies

### Critical Gaps

**Generic Type Support**

- No resolution of generic type parameters with concrete types
- Cannot track type parameter constraints
- Missing variance analysis for generics

**Virtual Method Resolution**

- Incomplete polymorphic call analysis
- Cannot fully trace virtual dispatch
- Missing interface method resolution in some languages

**Async Flow Analysis**

- Limited async/await tracking
- No Promise chain analysis
- Missing event-driven execution flow

**Module Resolution**

- No configurable resolution strategies
- Limited support for complex module systems
- Cannot handle all bundler configurations

### Missing Capabilities

**Type System**

- No structural type checking for TypeScript
- Limited union/intersection type support
- Missing type alias expansion
- No recursive type handling

**Meta-Programming**

- No macro expansion (Rust)
- Limited decorator processing (Python/TypeScript)
- No metaclass analysis (Python)
- Cannot analyze generated code

**Advanced Analysis**

- No dead code detection
- Limited data flow analysis
- No taint analysis
- Missing security vulnerability detection

### Performance Limitations

**Scalability**

- Global assembly phase is sequential
- Enrichment phase cannot be parallelized
- Memory usage grows with codebase size
- No incremental analysis support

**Caching**

- Limited caching between runs
- No persistent cache storage
- Cannot share cache across processes

---

## Language-Specific Considerations

### JavaScript/TypeScript

- Prototype chain affects method resolution
- Dynamic typing requires runtime-like analysis
- Multiple module systems (CommonJS, ES6, UMD)
- Structural typing needs special handling
- Decorators have different semantics than Python

### Python

- Duck typing affects all type analysis
- Multiple inheritance with MRO
- Metaclasses can generate runtime behavior
- First-class decorators modify function behavior
- Protocol/ABC system for interface-like contracts

### Rust

- Trait bounds constrain type resolution
- No class inheritance, only trait composition
- Ownership system affects call semantics
- Macros can generate substantial code
- Lifetime analysis impacts type compatibility

---

## Benefits of This Architecture

**Performance**

- Per-file parallelization uses all CPU cores
- Clear phase boundaries enable optimization
- Predictable memory usage patterns

**Maintainability**

- Clear separation of concerns
- Each phase has explicit inputs/outputs
- Language-agnostic core with specific extensions
- Testable modules with defined interfaces

**Extensibility**

- New languages can be added incrementally
- Additional analysis passes can be inserted
- Enrichment functions can be extended
- Cache layers can be added transparently

**Correctness**

- Phase separation prevents circular dependencies
- Enrichment pattern ensures consistency
- Global validation catches cross-file issues
- Type flow is bidirectional where needed
