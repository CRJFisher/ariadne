# @ariadnejs/core

Core code intelligence engine for Ariadne - Find references and definitions in your codebase using tree-sitter.

## Overview

This package provides the core functionality for building a scope graph of your code's symbols, their definitions, and their references. It enables language-agnostic code intelligence by leveraging tree-sitter for parsing and custom scope resolution algorithms.

## Features

- **AST Parsing**: Uses tree-sitter to parse source code into an Abstract Syntax Tree
- **Scope Resolution**: Builds a scope graph tracking definitions, references, imports, and lexical scopes
- **Cross-file Symbol Resolution**: Find definitions and references across multiple files
- **Consolidated Type Resolution**: Unified pipeline handling type registry, inheritance, annotations, tracking, flow analysis, and member resolution
- **Call Graph Analysis**: Build complete function call graphs with cross-file import resolution
- **Class Inheritance Analysis**: Track class hierarchies, interface implementations, and trait relationships
- **Incremental Parsing**: Efficiently handles file edits by reusing unchanged AST portions
- **Multi-language Support**: Extensible architecture supporting JavaScript, TypeScript, Python, and Rust

## Installation

```bash
npm install @ariadnejs/core
```

The package includes prebuilt binaries for common platforms, so you don't need build tools installed. If prebuilt binaries aren't available for your platform, it will automatically build from source.

## Quick Start

```typescript
import { Project } from "@ariadnejs/core";

// Create a project instance
const project = new Project();

// Add files to the project
project.add_or_update_file("src/main.ts", sourceCode);
project.add_or_update_file("src/utils.ts", utilsCode);

// Find definition of a symbol
const definition = project.go_to_definition("src/main.ts", {
  row: 10,
  column: 15,
});

// Find all references to a symbol
const references = project.find_references("src/utils.ts", {
  row: 5,
  column: 10,
});

// Get all definitions in a file
const definitions = project.get_definitions("src/main.ts");

// Build a call graph
const callGraph = project.get_call_graph();
console.log("Entry points:", callGraph.top_level_nodes);

// Analyze class inheritance
const classInfo = project.get_class_relationships(classDef);
console.log("Parent class:", classInfo?.parent_class);
console.log("Implements:", classInfo?.implemented_interfaces);
```

## API Reference

### `Project`

The main class for managing code intelligence across multiple files.

#### Core Methods

##### `add_or_update_file(file_path: string, source_code: string, edit?: Edit): void`

Adds a new file or updates an existing file in the project.

- `file_path` - Unique identifier for the file
- `source_code` - The complete source code of the file
- `edit` - Optional edit information for incremental parsing

##### `remove_file(file_path: string): void`

Removes a file from the project.

##### `go_to_definition(file_path: string, position: Point): Def | null`

Finds the definition of a symbol at the given position.

- Returns `Def` object with file path and position, or `null` if not found

##### `find_references(file_path: string, position: Point): Ref[]`

Finds all references to the symbol at the given position across all files.

- Returns array of `Ref` objects, each containing file path and position

##### `get_definitions(file_path: string): Def[]`

Get all symbol definitions in a file.

- Returns array of all definitions (functions, classes, variables, etc.)

##### `get_source_with_context(def: Def, file_path: string): SourceWithContext`

Extract source code with documentation and decorators.

- Returns source implementation, docstring, and decorators/annotations

#### Call Graph Methods

##### `get_call_graph(): CallGraph`

Build a complete function call graph for the project.

- Returns graph with nodes (functions) and edges (calls)
- Includes entry points and cross-file relationships

##### `get_exported_functions(file_path: string): Def[]`

Get all exported functions from a specific file.

#### Inheritance Methods

##### `get_class_relationships(class_def: Def): ClassRelationship | null`

Get inheritance information for a class/interface.

- Returns parent class, implemented interfaces, and resolved definitions

##### `find_subclasses(parent_class: Def): Def[]`

Find all classes that extend a given class.

##### `find_implementations(interface_def: Def): Def[]`

Find all classes that implement a given interface.

##### `get_inheritance_chain(class_def: Def): Def[]`

Get the complete inheritance hierarchy for a class.

##### `is_subclass_of(child: Def, parent: Def): boolean`

Check if one class inherits from another.

#### Incremental Updates

##### `update_file_range(file_path: string, start_position: Point, old_text: string, new_text: string): void`

Efficiently updates a portion of a file using incremental parsing.

### Types

```typescript
interface Point {
  row: number;    // 0-indexed line number
  column: number; // 0-indexed column number
}

interface Range {
  start: Point;
  end: Point;
}

interface Def {
  id: number;
  kind: "definition";
  name: string;
  symbol_kind: "function" | "class" | "interface" | "variable" | "method" | "property" | "type" | "enum" | "struct";
  range: Range;
  enclosing_range?: Range;  // Full range including body
  file_path: string;
  symbol_id: string;
  docstring?: string;
  metadata?: {
    line_count?: number;
  };
}

interface Ref {
  id: number;
  kind: "reference";
  range: Range;
  file_path: string;
  def_id: number;
  is_definition: boolean;
}

interface CallGraph {
  nodes: Map<string, CallNode>;
  edges: CallEdge[];
  top_level_nodes: string[];
}

interface ClassRelationship {
  parent_class?: string;
  parent_class_def?: Def;
  implemented_interfaces: string[];
  interface_defs: Def[];
}
```

## Supported Languages

- ✅ JavaScript (including JSX)
- ✅ TypeScript (including TSX)
- ✅ Python
- ✅ Rust
- 🚧 Go (coming soon)
- 🚧 Java (coming soon)
- 🚧 C/C++ (coming soon)

## Advanced Usage

### Working with Call Graphs

```typescript
const callGraph = project.get_call_graph();

// Find entry points (functions not called by others)
console.log("Entry points:", callGraph.top_level_nodes);

// Analyze specific function
const funcNode = callGraph.nodes.get("src/utils#calculateTotal");
if (funcNode) {
  console.log("This function calls:", funcNode.calls);
  console.log("Called by:", funcNode.called_by);
}
```

### Analyzing Class Hierarchies

```typescript
const defs = project.get_definitions("src/models.ts");
const userClass = defs.find(d => d.name === "User" && d.symbol_kind === "class");

if (userClass) {
  // Get inheritance info
  const relationships = project.get_class_relationships(userClass);
  console.log("Extends:", relationships?.parent_class);
  console.log("Implements:", relationships?.implemented_interfaces);
  
  // Find all subclasses
  const subclasses = project.find_subclasses(userClass);
  console.log("Subclasses:", subclasses.map(s => s.name));
}
```

### Incremental Updates for Performance

```typescript
// Instead of replacing entire file
project.update_file_range(
  "src/main.ts",
  { row: 10, column: 0 },
  "const",
  "let"
);
```

## License

ISC