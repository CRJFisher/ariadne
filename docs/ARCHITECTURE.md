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
- `/type_analysis/type_resolution` - Resolves cross-file types
- `/scope_analysis/symbol_resolution` - Links symbol references
- `/call_graph/call_chain_analysis` - Traces call paths

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
│   ├── symbol_resolution/   # Resolve symbol references
│   └── definition_finder/   # Find symbol definitions
├── call_graph/               # Call relationship analysis
│   ├── function_calls/      # Function call detection
│   ├── method_calls/        # Method call detection
│   └── call_chain_analysis/ # Call path tracing
├── import_export/            # Module dependency analysis
│   ├── import_resolution/   # Import statement parsing
│   ├── export_detection/    # Export declaration finding
│   └── module_graph/        # Dependency graph building
├── type_analysis/            # Type system analysis
│   ├── type_tracking/       # Type extraction
│   └── type_resolution/     # Cross-file type resolution
└── inheritance/              # Class hierarchy analysis
    ├── class_detection/     # Class structure extraction
    └── class_hierarchy/     # Inheritance tree building
```

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

### Coordinate Systems

- **Location**: 1-based line/column (editor convention)
- **tree-sitter**: 0-based row/column
- Conversion handled in `/ast/node_utils.ts`