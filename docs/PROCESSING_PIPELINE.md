# Code Analysis Processing Pipeline

## Overview

The processing pipeline follows a **two-phase architecture**:

1. **Per-File Analysis** (parallel) - Extract local information from each file independently
2. **Global Assembly** (sequential) - Combine file analyses to resolve cross-file dependencies

## Phase 1: Per-File Analysis (Parallel)

Each file is analyzed independently to extract local information without needing other files.

### Layer 0: Foundation

**No dependencies**

#### Existing Modules:

- AST Parsing (via tree-sitter) - Parse source into AST

**Outputs:** `ParsedFile { ast: SyntaxNode, source: string, language: Language }`

---

### Layer 1: Scope Analysis

**Depends on: AST**

#### Existing Modules:

- [`/scope_analysis/scope_tree`](/packages/core/src/scope_analysis/scope_tree) - Builds hierarchical scope structure
- [`/scope_analysis/definition_finder`](/packages/core/src/scope_analysis/definition_finder) - Finds symbol definitions
- [`/scope_analysis/usage_finder`](/packages/core/src/scope_analysis/usage_finder) - Finds symbol usages

#### Missing Modules:

- **Variable Declaration Analysis** - Track where variables are declared with their initial types
- **Closure Analysis** - Track captured variables in closures/lambdas

**Outputs:** `ScopeTree`, symbol definitions, variable declarations, closure captures

---

### Layer 2: Local Structure Detection

**Depends on: Scope Analysis**

#### Existing Modules:

- [`/import_export/import_resolution`](/packages/core/src/import_export/import_resolution) - Extracts import declarations
- [`/import_export/export_detection`](/packages/core/src/import_export/export_detection) - Detects export statements

#### Missing Modules:

- [`/inheritance/class_detection`](/packages/core/src/inheritance/class_detection) - **MISSING** (referenced in Architecture.md but doesn't exist!)
- **Interface/Trait Detection** - Extract interface/trait definitions
- **Enum Detection** - Extract enum definitions
- **Type Alias Detection** - Extract type aliases
- **Decorator/Annotation Detection** - Extract decorators (Python/TS)

**Outputs:** imports, exports, class/interface/enum definitions, type aliases, decorators

---

### Layer 3: Local Type Analysis

**Depends on: Local Structure Detection, Scope Analysis**

#### Existing Modules:

- [`/type_analysis/type_tracking`](/packages/core/src/type_analysis/type_tracking) - Tracks local variable types
- [`/type_analysis/parameter_type_inference`](/packages/core/src/type_analysis/parameter_type_inference) - Infers parameter types
- [`/type_analysis/return_type_inference`](/packages/core/src/type_analysis/return_type_inference) - Infers return types

#### Missing Modules:

- **Type Annotation Parsing** - Parse explicit type annotations
- **Type Guard Analysis** - Track type narrowing in conditionals
- **Generic Type Parameter Extraction** - Extract generic parameters from definitions

**Outputs:** variable type maps, inferred types, type annotations, type guards

---

### Layer 4: Local Call Analysis

**Depends on: Local Type Analysis, Scope Analysis**

#### Existing Modules:

- [`/call_graph/function_calls`](/packages/core/src/call_graph/function_calls) - Finds function calls
- [`/call_graph/method_calls`](/packages/core/src/call_graph/method_calls) - Finds method calls
- [`/call_graph/constructor_calls`](/packages/core/src/call_graph/constructor_calls) - Finds constructor calls

#### Missing Modules:

- **Async Call Detection** - Track async/await calls and promise chains
- **Callback Registration** - Track callback and event handler registration
- **Dynamic Call Detection** - Track indirect calls (through variables, computed properties)

**Outputs:** function calls, method calls, constructor calls, async calls, callbacks

---

## Phase 2: Global Assembly (Sequential)

Combines per-file analyses to build global understanding and resolve cross-file dependencies.

### Layer 5: Module Graph Construction

**Depends on: All per-file imports/exports**

#### Existing Modules:

- [`/import_export/module_graph`](/packages/core/src/import_export/module_graph) - Builds module dependency graph

#### Missing Modules:

- **Module Resolution Strategy** - Resolve module paths (node_modules, relative, absolute, aliases)
- **Circular Dependency Detection** - Detect and handle circular imports
- **Re-export Resolution** - Trace through re-exports to find actual definitions

**Outputs:** `ModuleGraph`, resolved import paths, circular dependencies

---

### Layer 6: Type Registry & Class Hierarchy

**Depends on: Module Graph, All per-file type definitions**

#### Existing Modules:

- [`/inheritance/class_hierarchy`](/packages/core/src/inheritance/class_hierarchy) - Builds inheritance tree
- [`/inheritance/interface_implementation`](/packages/core/src/inheritance/interface_implementation) - Tracks interface implementations
- [`/inheritance/method_override`](/packages/core/src/inheritance/method_override) - Tracks method overrides

#### Missing Modules:

- **Type Registry** - **CRITICAL GAP** - Central registry of all type definitions
- **Trait Implementation Registry** - Track trait implementations (Rust)
- **Mixin Resolution** - Resolve mixin chains (Python, TS)
- **Protocol Conformance** - Track protocol implementations (Python)

**Outputs:** `TypeRegistry`, `ClassHierarchy`, method resolution order, virtual method tables

---

### Layer 7: Cross-File Type Resolution

**Depends on: Type Registry, Module Graph, Class Hierarchy**

#### Existing Modules:

- [`/type_analysis/type_resolution`](/packages/core/src/type_analysis/type_resolution) - Resolves cross-file types
- [`/type_analysis/type_propagation`](/packages/core/src/type_analysis/type_propagation) - Propagates types through data flow
- [`/import_export/namespace_resolution`](/packages/core/src/import_export/namespace_resolution) - Resolves namespace members

#### Missing Modules:

- **Generic Type Resolution** - Resolve generic type parameters with concrete types
- **Union/Intersection Type Resolution** - Resolve complex type compositions
- **Type Alias Resolution** - Resolve type aliases to their definitions
- **Structural Type Checking** - Check structural compatibility (TS duck typing)

**Outputs:** resolved types, generic instantiations, type compatibility matrix

---

### Layer 8: Global Symbol Resolution

**Depends on: Type Resolution, Module Graph**

#### Existing Modules:

- [`/scope_analysis/symbol_resolution`](/packages/core/src/scope_analysis/symbol_resolution) - Resolves symbol references
  - **ISSUE**: Currently duplicates import extraction! Should consume from Layer 5

#### Missing Modules:

- **Global Symbol Table** - Unified symbol table across all files
- **Namespace Member Resolution** - Resolve namespaced symbols
- **Alias Resolution** - Resolve import/export aliases

**Outputs:** resolved symbol references, global symbol table

---

### Layer 9: Call Graph Completion

**Depends on: Symbol Resolution, Type Resolution, Class Hierarchy**

#### Existing Modules:

- [`/call_graph/call_chain_analysis`](/packages/core/src/call_graph/call_chain_analysis) - Traces call chains

#### Missing Modules:

- **Virtual Method Resolution** - Resolve polymorphic calls
- **Async Flow Analysis** - Trace async execution flows
- **Event Flow Analysis** - Trace event-driven execution
- **Recursive Call Detection** - Detect direct and indirect recursion
- **Dead Code Detection** - Find unreachable code

**Outputs:** complete call graph, call chains, execution flows, dead code

---

### Layer 10: Macro & Meta-Programming

**Depends on: All previous layers**

#### Missing Modules (Language-Specific):

- **Rust Macro Expansion** - Expand and analyze Rust macros
- **Python Decorator Application** - Apply and analyze decorators
- **TypeScript Decorator Processing** - Process TS decorators
- **Python Metaclass Analysis** - Analyze metaclass-generated code
- **Code Generation Analysis** - Analyze generated code patterns

**Outputs:** expanded code, decorator effects, generated symbols

---

## Critical Dependencies

### Correct Dependencies That Need Wiring:

1. **Type Tracking → Import Resolution**

   - Type tracking needs to know about imported types
   - Currently has TODO but no actual dependency

2. **Method Calls → Type Tracking**

   - Method calls need receiver types to resolve methods
   - Currently missing this dependency

3. **Method Calls → Class Hierarchy**

   - Need inheritance info for virtual method resolution
   - Currently missing this dependency

4. **Constructor Calls → Type Tracking**

   - Constructors should update type maps
   - Currently no bidirectional flow

5. **Type Propagation → Call Graph**

   - Type flow follows execution flow
   - Needs all call types (function, method, constructor)

6. **Symbol Resolution → Import Resolution**
   - Should consume imports, not re-extract them
   - Currently duplicates import extraction

### Circular Dependency Concerns:

These require careful handling or event-based updates:

1. **Type Inference ↔ Call Analysis**

   - Calls need types to resolve targets
   - Type inference needs calls to propagate types
   - Solution: Iterative refinement or event propagation

2. **Constructor Calls ↔ Type Tracking**
   - Constructors create typed instances
   - Type tracking helps identify constructor calls
   - Solution: Constructor detection first, then type update

## Processing Order

### Per-File Phase (Parallel):

```
For each file in parallel:
  1. Parse AST
  2. Build scope tree
  3. Find definitions and usages
  4. Extract imports/exports
  5. Detect classes/interfaces/types
  6. Track local types
  7. Find local calls
```

### Global Assembly Phase (Sequential):

```
1. Build module graph from all imports/exports
2. Build type registry from all type definitions
3. Build class hierarchy from all classes
4. Resolve types across files
5. Resolve symbols globally
6. Complete call graph with cross-file calls
7. Analyze call chains and flows
8. Process meta-programming constructs
```

## Implementation Status

### Fully Implemented:

- Basic scope analysis
- Import/export detection
- Local call detection (function, method, constructor)
- Module graph construction
- Basic type tracking

### Partially Implemented:

- Type resolution (missing generic support)
- Symbol resolution (duplicates import extraction)
- Class hierarchy (missing type registry dependency)
- Call chain analysis (missing virtual method resolution)

### Critical Gaps:

1. **Type Registry** - No central type definition storage
2. **Class Detection** - Referenced but missing
3. **Generic Type Resolution** - No generic type support
4. **Virtual Method Resolution** - No polymorphic call resolution
5. **Async Flow Analysis** - No async execution tracking
6. **Module Resolution Strategy** - No configurable resolution

## Next Steps

### Immediate Priority (Breaking Issues):

1. Create [`/inheritance/class_detection`](/packages/core/src/inheritance/class_detection) module
2. Create `/type_analysis/type_registry` module
3. Remove import extraction from symbol_resolution
4. Wire type_tracking to use import_resolution

### Medium Priority (Integration):

1. Connect method_calls to type_tracking
2. Connect method_calls to class_hierarchy
3. Implement generic type resolution
4. Add virtual method resolution

### Long Term (Completeness):

1. Add async flow analysis
2. Add macro/decorator processing
3. Add structural type checking
4. Add dead code detection

## Language-Specific Considerations

### JavaScript/TypeScript:

- Prototype chain affects method resolution
- Dynamic typing requires runtime-like analysis
- Multiple module systems (CommonJS, ES6)
- Decorators (experimental in JS, stable in TS)
- Structural typing in TypeScript

### Python:

- Duck typing affects type inference
- Metaclasses can modify class behavior
- Decorators are first-class
- Multiple inheritance with MRO
- Protocol/ABC system

### Rust:

- Trait bounds affect type resolution
- Ownership affects call semantics
- Macros can generate significant code
- No inheritance, only trait composition
- Lifetime analysis affects type compatibility

## Benefits of This Architecture

1. **Parallelization**: Per-file analysis can use all CPU cores
2. **Incremental Updates**: Only reprocess changed files and their dependents
3. **Clear Dependencies**: Each layer has explicit inputs/outputs
4. **Language Agnostic Core**: Common patterns with language-specific implementations
5. **Testability**: Each module can be tested in isolation
6. **Caching**: Results at each layer can be cached
