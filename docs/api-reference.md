# API Reference

Complete API documentation for the TypeScript tree-sitter implementation.

## Table of Contents

1. [Project Class](#project-class)
2. [ScopeGraph Class](#scopegraph-class)
3. [Types and Interfaces](#types-and-interfaces)
4. [Helper Functions](#helper-functions)
5. [Language Configuration](#language-configuration)

## Project Class

The main entry point for multi-file code intelligence operations.

### Constructor

```typescript
new Project()
```

Creates a new project instance with an empty file collection.

#### Example

```typescript
import { Project } from 'ts-tree-sitter';

const project = new Project();
```

### Methods

#### add_or_update_file

```typescript
add_or_update_file(file_path: string, content: string): void
```

Adds a new file or updates an existing file in the project.

**Parameters:**
- `file_path` - The path identifier for the file
- `content` - The source code content

**Example:**

```typescript
project.add_or_update_file('src/main.ts', 'const x = 42;');
project.add_or_update_file('src/utils.ts', 'export function helper() {}');
```

#### remove_file

```typescript
remove_file(file_path: string): void
```

Removes a file from the project.

**Parameters:**
- `file_path` - The path identifier for the file to remove

**Example:**

```typescript
project.remove_file('src/old-file.ts');
```

#### go_to_definition

```typescript
go_to_definition(file_path: string, position: Point): Def | null
```

Finds the definition of a symbol at the given position.

**Parameters:**
- `file_path` - The file containing the position
- `position` - The cursor position (0-indexed)

**Returns:**
- `Def` object if found, `null` otherwise

**Example:**

```typescript
const definition = project.go_to_definition('src/main.ts', { row: 5, column: 10 });
if (definition) {
  console.log(`Found ${definition.name} at ${definition.range.start.row}:${definition.range.start.column}`);
}
```

#### find_references

```typescript
find_references(file_path: string, position: Point): Ref[]
```

Finds all references to the symbol at the given position.

**Parameters:**
- `file_path` - The file containing the position
- `position` - The cursor position (0-indexed)

**Returns:**
- Array of `Ref` objects

**Example:**

```typescript
const refs = project.find_references('src/utils.ts', { row: 1, column: 16 });
console.log(`Found ${refs.length} references`);
```

## ScopeGraph Class

Represents the scope graph for a single file.

### Constructor

```typescript
new ScopeGraph(root_node: Parser.SyntaxNode, language_name: string)
```

Creates a new scope graph with a root scope.

**Parameters:**
- `root_node` - The root AST node from tree-sitter
- `language_name` - The name of the language

### Properties

#### nodes

```typescript
nodes: Map<number, Node>
```

Map of node IDs to node objects.

#### edges

```typescript
edges: Edge[]
```

Array of all edges in the graph.

### Methods

#### insert_local_scope

```typescript
insert_local_scope(scope: Scope): number
```

Inserts a new scope as a child of the current scope.

**Parameters:**
- `scope` - The scope to insert

**Returns:**
- The ID of the inserted scope

**Example:**

```typescript
const scope: Scope = {
  id: graph.get_next_node_id(),
  kind: 'scope',
  range: { start: { row: 5, column: 0 }, end: { row: 10, column: 1 } }
};
const scope_id = graph.insert_local_scope(scope);
```

#### insert_local_def

```typescript
insert_local_def(def: Def): number
```

Inserts a definition in the current scope.

**Parameters:**
- `def` - The definition to insert

**Returns:**
- The ID of the inserted definition

#### insert_hoisted_def

```typescript
insert_hoisted_def(def: Def): number
```

Inserts a definition hoisted to the nearest function/module scope.

**Parameters:**
- `def` - The definition to insert

**Returns:**
- The ID of the inserted definition

#### insert_ref

```typescript
insert_ref(ref: Ref): number
```

Inserts a reference and attempts to resolve it.

**Parameters:**
- `ref` - The reference to insert

**Returns:**
- The ID of the inserted reference

#### findNodeAtPosition

```typescript
findNodeAtPosition(position: Point): Node | null
```

Finds the node at the given source position.

**Parameters:**
- `position` - The source position

**Returns:**
- The node at the position, or null

#### findExportedDef

```typescript
findExportedDef(name: string): Def | null
```

Finds an exported definition by name.

**Parameters:**
- `name` - The name to search for

**Returns:**
- The exported definition, or null

#### getNodes

```typescript
getNodes<T extends Node>(kind: NodeKind): T[]
```

Gets all nodes of a specific kind.

**Type Parameters:**
- `T` - The node type

**Parameters:**
- `kind` - The node kind to filter by

**Returns:**
- Array of nodes of the specified kind

**Example:**

```typescript
const allRefs = graph.getNodes<Ref>('reference');
const allDefs = graph.getNodes<Def>('definition');
```

## Types and Interfaces

### Point

```typescript
interface Point {
  row: number;    // 0-indexed line number
  column: number; // 0-indexed column number
}
```

### Range

```typescript
interface Range {
  start: Point;
  end: Point;
}
```

### BaseNode

```typescript
interface BaseNode {
  id: number;
  kind: NodeKind;
  range: Range;
}
```

### NodeKind

```typescript
type NodeKind = 'scope' | 'definition' | 'reference' | 'import';
```

### Scope

```typescript
interface Scope extends BaseNode {
  kind: 'scope';
}
```

### Def

```typescript
interface Def extends BaseNode {
  kind: 'definition';
  name: string;
  symbol_kind: string;
}
```

### Ref

```typescript
interface Ref extends BaseNode {
  kind: 'reference';
  name: string;
  symbol_kind?: string;
}
```

### Import

```typescript
interface Import extends BaseNode {
  kind: 'import';
  name: string;          // Local name
  source_name?: string;  // Original name if renamed
  source_module?: string; // Module path
}
```

### Edge

```typescript
interface Edge {
  kind: EdgeKind;
  source: number; // Source node ID
  target: number; // Target node ID
}
```

### EdgeKind

```typescript
enum EdgeKind {
  ScopeToScope = 'ScopeToScope',
  DefToScope = 'DefToScope',
  RefToDef = 'RefToDef',
  ImportToScope = 'ImportToScope',
  RefToImport = 'RefToImport'
}
```

### LanguageConfig

```typescript
interface LanguageConfig {
  name: string;
  parser: Parser.Language;
  scope_query: string;
  namespaces: string[][];
}
```

## Helper Functions

### build_scope_graph

```typescript
function build_scope_graph(
  tree: Parser.Tree,
  config: LanguageConfig
): ScopeGraph
```

Builds a scope graph from a parsed tree.

**Parameters:**
- `tree` - The parsed tree from tree-sitter
- `config` - The language configuration

**Returns:**
- A populated scope graph

**Example:**

```typescript
import Parser from 'tree-sitter';
import { build_scope_graph } from 'ts-tree-sitter';
import { typescriptConfig } from 'ts-tree-sitter/languages';

const parser = new Parser();
parser.setLanguage(typescriptConfig.parser);
const tree = parser.parse(sourceCode);
const graph = build_scope_graph(tree, typescriptConfig);
```

### find_definition

```typescript
function find_definition(
  file_path: string,
  position: Point,
  file_graphs: Map<string, ScopeGraph>
): Def | null
```

Finds the definition of a symbol across multiple files.

**Parameters:**
- `file_path` - The file containing the reference
- `position` - The position of the reference
- `file_graphs` - Map of file paths to scope graphs

**Returns:**
- The definition, or null

### find_all_references

```typescript
function find_all_references(
  file_path: string,
  position: Point,
  file_graphs: Map<string, ScopeGraph>
): Ref[]
```

Finds all references to a symbol across multiple files.

**Parameters:**
- `file_path` - The file containing the symbol
- `position` - The position of the symbol
- `file_graphs` - Map of file paths to scope graphs

**Returns:**
- Array of references

## Language Configuration

### Available Languages

```typescript
import { languageConfigs } from 'ts-tree-sitter/languages';

// Available configurations:
languageConfigs.typescript  // TypeScript
languageConfigs.tsx         // TypeScript with JSX
```

### Custom Language Configuration

```typescript
import Parser from 'tree-sitter';
import MyLanguage from 'tree-sitter-my-language';
import { LanguageConfig } from 'ts-tree-sitter';

const myLanguageConfig: LanguageConfig = {
  name: 'my-language',
  parser: MyLanguage as Parser.Language,
  scope_query: `
    (function) @local.scope
    (function name: (identifier) @local.definition.function)
  `,
  namespaces: [
    ['class', 'type'],
    ['function', 'variable']
  ]
};
```

## Usage Examples

### Basic Symbol Resolution

```typescript
const project = new Project();

// Add some TypeScript files
project.add_or_update_file('utils.ts', `
export function calculateSum(a: number, b: number): number {
  return a + b;
}
`);

project.add_or_update_file('main.ts', `
import { calculateSum } from './utils';

const result = calculateSum(5, 10);
console.log(result);
`);

// Find definition of calculateSum from main.ts
const def = project.go_to_definition('main.ts', { row: 3, column: 15 });
console.log(def); // Points to function in utils.ts

// Find all references to calculateSum
const refs = project.find_references('utils.ts', { row: 1, column: 16 });
console.log(refs); // Includes usage in main.ts
```

### Working with Renamed Imports

```typescript
project.add_or_update_file('helpers.ts', `
export function formatDate(date: Date): string {
  return date.toISOString();
}
`);

project.add_or_update_file('app.ts', `
import { formatDate as format } from './helpers';

const now = new Date();
const formatted = format(now);
`);

// Clicking on 'format' resolves to 'formatDate'
const def = project.go_to_definition('app.ts', { row: 4, column: 18 });
console.log(def?.name); // 'formatDate'
```

### Direct Graph Access

```typescript
// Access the underlying graph for advanced operations
const graph = (project as any).file_graphs.get('main.ts');

// Get all imports in a file
const imports = graph.getNodes<Import>('import');

// Get all function definitions
const functions = graph.getNodes<Def>('definition')
  .filter(def => def.symbol_kind === 'function');

// Walk the scope tree
function printScopes(scope_id: number = 0, indent = 0) {
  const defs = graph.get_defs_in_scope(scope_id);
  console.log(' '.repeat(indent) + `Scope ${scope_id}: ${defs.length} definitions`);
  
  // Get child scopes
  const children = graph.getOutgoingEdges(scope_id)
    .filter(e => e.kind === EdgeKind.ScopeToScope)
    .map(e => e.target);
    
  for (const child of children) {
    printScopes(child, indent + 2);
  }
}
```

## Error Handling

The API uses null returns rather than throwing exceptions:

```typescript
// Safe usage pattern
const definition = project.go_to_definition('file.ts', position);
if (definition) {
  // Use definition
} else {
  // Handle not found
}

// Check file exists
const graph = (project as any).file_graphs.get('file.ts');
if (!graph) {
  console.error('File not in project');
}
```

## Performance Considerations

1. **File Updates**: Rebuilds the entire graph for the file
2. **Large Files**: Consider chunking or incremental parsing
3. **Many Files**: Searches are O(n) where n is number of files

## Further Reading

- [Architecture Overview](../README.md#architecture-overview)
- [Scope Mechanism](scope-mechanism.md)
- [Graph Structure](graph-structure.md)
- [Symbol Resolution](symbol-resolution.md)