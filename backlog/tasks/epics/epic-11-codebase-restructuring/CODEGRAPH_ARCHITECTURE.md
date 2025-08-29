# CodeGraph Architecture Design

## Overview

The CodeGraph is the primary output of Ariadne's code analysis. Instead of forcing all analysis results into a generic graph structure, we use appropriate data structures for each type of analysis while maintaining cross-references between them.

## Core Design Principles

1. **Use Appropriate Data Structures**: Trees for hierarchies, graphs for relationships, maps for indices
2. **Maintain Structure**: Don't lose semantic information by flattening to generic nodes/edges
3. **Enable Cross-References**: Different analyses can reference each other
4. **Support Incremental Updates**: Structure should allow for efficient updates
5. **Optimize for Queries**: Common queries should be fast

## CodeGraph Structure

```typescript
export interface CodeGraph {
  // File-level analysis results (foundation layer)
  files: Map<string, FileAnalysis>;

  // Global structures built from file analyses
  modules: ModuleGraph; // Module dependency graph
  calls: CallGraph; // Function/method call relationships
  classes: ClassHierarchy; // Class inheritance tree
  types: TypeIndex; // Global type information
  symbols: SymbolIndex; // Global symbol table

  // Metadata
  metadata: {
    root_path: string;
    file_count: number;
    analysis_time: number;
    language_stats: Map<Language, number>; // Files per language
  };
}
```

## Component Definitions

### FileAnalysis

Per-file analysis results that serve as the foundation for global structures.

```typescript
interface FileAnalysis {
  path: string;
  language: Language;
  scopes: ScopeTree; // Hierarchical scope structure
  imports: ImportInfo[]; // What this file imports
  exports: ExportInfo[]; // What this file exports
  functions: FunctionInfo[]; // Functions defined in file
  classes: ClassInfo[]; // Classes defined in file
  ast?: Tree; // Optional: parsed AST for further analysis
}
```

### ModuleGraph

Represents dependencies between modules/files.

```typescript
interface ModuleGraph {
  nodes: Map<string, ModuleNode>; // File path → module info
  edges: ModuleEdge[]; // Import/export relationships
  entry_points: Set<string>; // Main entry points
  external_modules: Set<string>; // External dependencies
}

interface ModuleNode {
  file_path: string;
  language: Language;
  exports: ExportInfo[];
  imports: ImportInfo[];
  is_entry_point: boolean;
  is_external: boolean;
}

interface ModuleEdge {
  from: string; // Source module
  to: string; // Target module
  type: "import" | "export" | "dynamic";
  symbols: string[]; // What symbols are imported
}
```

### CallGraph

Represents function and method call relationships.

```typescript
interface CallGraph {
  // Function/method definitions
  functions: Map<string, FunctionNode>;

  // Call relationships
  calls: CallEdge[];

  // Resolved cross-file calls (after type analysis)
  resolved_calls: Map<string, ResolvedCall[]>;

  // Call chains for deep analysis
  call_chains: Map<string, CallChain>;
}

interface FunctionNode {
  id: string; // Unique identifier (file#function)
  name: string;
  file_path: string;
  type: "function" | "method" | "constructor";
  parent_class?: string; // For methods
  signature?: FunctionSignature;
}

interface CallEdge {
  from: string; // Caller function ID
  to: string; // Callee function ID
  location: Location;
  is_resolved: boolean; // False if target unknown
  is_dynamic: boolean; // Dynamic dispatch
}

interface ResolvedCall extends CallEdge {
  resolution_type: "direct" | "virtual" | "interface";
  resolved_via?: "type_analysis" | "import_resolution";
}
```

### ClassHierarchy

Represents class inheritance and interface implementation relationships.

```typescript
interface ClassHierarchy {
  classes: Map<string, ClassNode>;
  inheritance: InheritanceEdge[];
  implementations: ImplementationEdge[];

  // Computed relationships
  subclasses: Map<string, Set<string>>; // Class → its subclasses
  superclasses: Map<string, Set<string>>; // Class → its superclasses
  method_overrides: Map<string, MethodOverride[]>;
}

interface ClassNode {
  id: string; // Unique identifier
  name: string;
  file_path: string;
  type: "class" | "interface" | "trait";
  methods: MethodInfo[];
  properties: PropertyInfo[];
  is_abstract: boolean;
}

interface InheritanceEdge {
  from: string; // Subclass
  to: string; // Superclass
  type: "extends" | "implements";
}
```

### TypeIndex

Global type information for variables, functions, and type definitions.

```typescript
interface TypeIndex {
  // Variable → Type mapping
  variables: Map<string, VariableType>;

  // Function signatures
  functions: Map<string, FunctionSignature>;

  // Type definitions (classes, interfaces, type aliases)
  definitions: Map<string, TypeDefinition>;

  // Type relationships for inference
  type_graph: TypeGraph;
}

interface VariableType {
  name: string;
  type: TypeInfo;
  scope: string; // Scope where defined
  is_mutable: boolean;
}

interface FunctionSignature {
  parameters: ParameterType[];
  return_type: TypeInfo;
  type_parameters?: TypeParameter[]; // Generic parameters
  is_async: boolean;
  is_generator: boolean;
}
```

### SymbolIndex

Global symbol table for all definitions and usages.

```typescript
interface SymbolIndex {
  // Symbol → definition location
  definitions: Map<string, Definition>;

  // Symbol → all usage locations
  usages: Map<string, Usage[]>;

  // File → exported symbols
  exports_by_file: Map<string, ExportedSymbol[]>;

  // Symbol resolution cache
  resolution_cache: Map<string, ResolvedSymbol>;
}

interface Definition {
  symbol: string;
  location: Location;
  type: "function" | "class" | "variable" | "type" | "module";
  is_exported: boolean;
}

interface Usage {
  symbol: string;
  location: Location;
  type: "call" | "reference" | "type_annotation" | "import";
}
```

## Processing Stages

### Stage 1: File Analysis

Each file is analyzed independently to extract:

- Scope structure
- Local symbols
- Import/export declarations
- Function/class definitions
- Type annotations

### Stage 2: Global Structure Building

File analyses are combined to build:

- Module dependency graph
- Initial call graph (unresolved)
- Class hierarchy
- Symbol index

### Stage 3: Cross-File Resolution

Using global structures to resolve:

- Cross-file imports
- Method calls (using class hierarchy)
- Type propagation across files
- Symbol references

### Stage 4: Enhancement

Additional analysis passes:

- Call chain analysis
- Type inference
- Dead code detection
- Circular dependency detection

## Query Interface

The structure enables efficient queries:

```typescript
// Find all callers of a function
function getCallers(graph: CodeGraph, functionId: string): FunctionNode[];

// Find all methods that override a base method
function getOverrides(graph: CodeGraph, methodId: string): MethodInfo[];

// Get type of a variable at a location
function getVariableType(graph: CodeGraph, location: Location): TypeInfo;

// Find unused exports
function findUnusedExports(graph: CodeGraph): ExportedSymbol[];

// Get call chain between two functions
function getCallChain(graph: CodeGraph, from: string, to: string): CallChain;
```

## Benefits

1. **Semantic Preservation**: Each analysis maintains its natural structure
2. **Efficient Queries**: Direct access without filtering generic nodes
3. **Cross-Reference Support**: Easy to navigate between different analyses
4. **Incremental Updates**: Can update individual components
5. **Language Agnostic**: Works across different programming languages
6. **Extensible**: Easy to add new analysis types

## Implementation Notes

- Start with basic structures (FileAnalysis, ModuleGraph)
- Build incrementally (CallGraph, then ClassHierarchy, then TypeIndex)
- Add cross-file resolution as a separate pass
- Keep raw ASTs optional for memory efficiency
- Use string IDs for cross-references (e.g., "file.ts#className#methodName")

## Future Extensions

- **Data Flow Graph**: Track data flow through the program
- **Control Flow Graph**: Represent control flow within functions
- **Security Analysis**: Track tainted data and security patterns
- **Performance Analysis**: Identify hot paths and bottlenecks
- **Dependency Impact**: Analyze change impact across the codebase
