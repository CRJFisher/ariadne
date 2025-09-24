# Architecture

## Executive Summary

Ariadne is a tree-sitter query-based code analysis tool that extracts structural information from source code across multiple programming languages. The architecture leverages tree-sitter's powerful query system to declaratively specify what information to extract from Abstract Syntax Trees (ASTs).

## Core Architecture

### Query-Driven Processing

The system uses tree-sitter queries (.scm files) as the primary mechanism for extracting information from code:

```txt
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Parse    │ →   │    Query     │ →   │   Process    │ →   │   Assemble   │
│     AST     │     │   Execution  │     │    Matches   │     │    Results   │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Processing Stages

#### 1. Per-File Analysis

Each file is analyzed independently using tree-sitter queries:

```typescript
// Parse file into AST
const tree = parser.parse(sourceCode);

// Execute queries
const matches = query.matches(tree.rootNode);

// Process results
const fileAnalysis = processMatches(matches);
```

**Core Analysis Modules:**

- `/scope_analysis/scope_tree` - Extracts scope hierarchy and symbols
- `/call_graph/function_calls` - Finds function/method calls
- `/call_graph/method_calls` - Identifies method invocations
- `/import_export/import_resolution` - Tracks import statements
- `/import_export/export_detection` - Finds export declarations
- `/type_analysis/type_tracking` - Extracts type information
- `/inheritance/class_detection` - Identifies class structures

#### 2. Global Assembly

Combines per-file analyses into a unified code graph:

```typescript
const codeGraph = {
  files: Map<string, FileAnalysis>,      // Per-file results
  modules: ModuleGraph,                  // Import/export relationships
  calls: CallGraph,                      // Function call relationships
  classes: ClassHierarchy,               // Inheritance tree
  types: TypeIndex,                      // Type definitions
  symbols: SymbolIndex                   // Global symbol table
};
```

**Assembly Modules:**

- `/import_export/module_graph` - Builds dependency graph
- `/inheritance/class_hierarchy` - Constructs inheritance relationships
- `/scope_analysis/symbol_resolution` - Links symbol references and resolves types
- `/call_graph/call_chain_analysis` - Traces call paths

**Note:** Type resolution has been consolidated into the symbol resolution pipeline for improved efficiency and consistency.

## Query System Architecture

### Query File Structure

Each module contains language-specific query files:

```text
module_name/
├── index.ts              # Public API
├── module_name.ts        # Query execution logic
└── queries/
    ├── javascript.scm    # JavaScript patterns
    ├── typescript.scm    # TypeScript patterns
    ├── python.scm        # Python patterns
    └── rust.scm          # Rust patterns
```

### Query Pattern Design

Queries use S-expression syntax to match AST patterns:

```scheme
; Find function declarations
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.params
  body: (statement_block) @function.body)

; Find method calls
(call_expression
  function: (member_expression
    object: (_) @method.object
    property: (property_identifier) @method.name)
  arguments: (arguments) @method.args)
```

### Query Execution Pipeline

1. **Load Queries**: Read .scm files for the target language
2. **Compile Queries**: Parse S-expressions into query objects
3. **Execute Queries**: Match patterns against AST nodes
4. **Process Captures**: Extract information from matched nodes
5. **Transform Results**: Convert captures into structured data

## Module Organization

### Feature Modules

Modules are organized by functionality:

```text
src/
├── scope_analysis/           # Scope and symbol extraction
│   ├── scope_tree/          # Build scope hierarchy
│   ├── symbol_resolution/   # Unified symbol and type resolution
│   └── definition_finder/   # Find symbol definitions
├── call_graph/               # Call relationship analysis
│   ├── function_calls/      # Function call detection
│   ├── method_calls/        # Method call detection
│   └── call_chain_analysis/ # Call path tracing
├── import_export/            # Module dependency analysis
│   ├── import_resolution/   # Import statement parsing
│   ├── export_detection/    # Export declaration finding
│   └── module_graph/        # Dependency graph building
└── inheritance/              # Class hierarchy analysis
    ├── class_detection/     # Class structure extraction
    └── class_hierarchy/     # Inheritance tree building
```

**Key Changes (2024):**
- **Consolidated Type Resolution**: The `symbol_resolution` module now handles all type resolution functionality in a unified pipeline
- **Integrated Processing**: Type registry, inheritance, annotations, tracking, flow analysis, and member resolution are coordinated through `phase3_resolve_types`
- **Comprehensive Testing**: New testing infrastructure validates all 8 type resolution features with cross-language consistency
- **Removed Duplication**: Previous separate `type_analysis/type_resolution` has been integrated into the main pipeline

## Language Support

### Supported Languages

- JavaScript (ES6+)
- TypeScript
- Python
- Rust

### Language-Specific Queries

Each language has tailored query patterns:

```scheme
; JavaScript arrow functions
(arrow_function
  parameters: (_) @arrow.params
  body: (_) @arrow.body)

; Python decorators
(decorated_definition
  (decorator) @decorator
  definition: (_) @decorated)

; Rust macros
(macro_invocation
  macro: (identifier) @macro.name
  (token_tree) @macro.args)
```

### Adding Language Support

1. Install tree-sitter parser: `npm install tree-sitter-[language]`
2. Create query files in each module's `queries/` directory
3. Add fixtures for testing
4. Implement language-specific tests

## Type System

### Public API Types

All public types are defined in `@ariadnejs/types`:

```typescript
export interface FileAnalysis {
  path: string;
  language: Language;
  scopes: ScopeTree;
  calls: CallInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  classes: ClassInfo[];
  types: TypeInfo[];
}

export interface CodeGraph {
  files: Map<string, FileAnalysis>;
  modules: ModuleGraph;
  calls: CallGraph;
  classes: ClassHierarchy;
  types: TypeIndex;
  symbols: SymbolIndex;
}
```

### Universal Symbol System

The codebase uses a universal `SymbolId` system for all identifiers, replacing individual name types (VariableName, FunctionName, ClassName, etc.):

#### SymbolId Format
```typescript
// Format: "kind:scope:name[:qualifier]"
type SymbolId = string & { __brand: 'SymbolId' };

// Examples:
"variable:src/utils.ts:processData"
"method:src/classes.ts:MyClass:getValue"
"function:src/helpers.ts:calculateTotal"
```

#### Benefits
- **Unique Identification**: Every symbol has a globally unique identifier
- **Context Preservation**: Encodes kind, scope, and qualification in the ID
- **Type Safety**: Branded types prevent string mixing
- **Consistent API**: All Maps and functions use the same identifier type

#### Usage
```typescript
import { SymbolId, symbol_string, symbol_from_string } from '@ariadnejs/types';

// Create a symbol
const funcId = symbol_string({
  kind: 'function',
  scope: 'src/utils.ts',
  name: 'processData',
  location: { file_path: 'src/utils.ts', line: 10, column: 0 }
});

// Parse a symbol
const symbol = symbol_from_string(funcId);
console.log(symbol.name); // "processData"

// All Maps use SymbolId as keys
const symbols = new Map<SymbolId, SymbolDefinition>();
symbols.set(funcId, definition);
```

See `packages/types/src/symbol_utils.ts` for the complete API.

## Consolidated Type Resolution Architecture

### Overview

The type resolution system processes 8 distinct features through a unified pipeline:

1. **Data Collection**: Extract local type information from SemanticIndex
2. **Type Registry**: Build global registry with unique TypeIds
3. **Inheritance Resolution**: Construct type hierarchy graphs
4. **Type Members**: Resolve members including inherited ones
5. **Type Annotations**: Map annotations to concrete TypeIds
6. **Type Tracking**: Track variable types across scopes
7. **Type Flow Analysis**: Analyze type flow through assignments and calls
8. **Constructor Discovery**: Map constructors to their types

### Pipeline Architecture

```typescript
// Phase 3: Consolidated Type Resolution
function phase3_resolve_types(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap
): TypeResolutionMap {
  // 1. Extract all local type information
  const local_types = collect_local_types(indices);

  // 2. Build global type registry with unique TypeIds
  const type_registry = build_global_type_registry(local_types, imports);

  // 3. Resolve inheritance relationships
  const type_hierarchy = resolve_inheritance(local_types, imports);

  // 4. Resolve type members with inheritance
  const type_members = resolve_type_members(type_registry, type_hierarchy);

  // 5. Resolve type annotations to TypeIds
  const annotations = resolve_type_annotations(local_types, type_registry);

  // 6. Track variable types across scopes
  const tracking = resolve_type_tracking(local_types, type_registry);

  // 7. Analyze type flow patterns
  const flow = analyze_type_flow(local_types, functions, type_registry);

  // 8. Consolidate all results
  return consolidate_type_resolution(/* ... */);
}
```

### Testing Infrastructure

Comprehensive test suites validate the consolidated system:

- **End-to-end tests**: `type_resolution_consolidated.test.ts`
- **Module integration**: `cross_module_integration.test.ts`
- **Mock factories**: `test_utilities/mock_factories.ts`
- **Edge cases**: `test_utilities/edge_case_generators.ts`

The testing infrastructure covers all 8 features with cross-language consistency validation and complex scenario generation.

### Coordinate Systems

- **Location**: 1-based line/column (editor convention)
- **tree-sitter**: 0-based row/column
- Conversion handled in `/ast/node_utils.ts`