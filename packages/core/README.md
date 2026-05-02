# @ariadnejs/core

Code intelligence engine for detecting call graphs and entry points across multi-file codebases.

## Overview

This package provides the core functionality for building semantic indexes of code symbols, resolving cross-file references, and detecting call graphs. It uses tree-sitter for parsing and custom scope resolution algorithms.

## Features

- **Semantic Indexing**: Extracts definitions, references, scopes, and type information from source files
- **Cross-file Resolution**: Resolves imports and references across multiple files
- **Call Graph Analysis**: Builds complete function call graphs with entry point detection
- **Indirect Reachability**: Tracks functions stored in collections (Maps, Arrays, Objects) that are read but not directly called
- **Multi-language Support**: JavaScript, TypeScript, Python, and Rust

## Installation

```bash
npm install @ariadnejs/core
```

The package includes prebuilt binaries for common platforms. If prebuilt binaries aren't available for your platform, it will automatically build from source.

## Quick Start

```typescript
import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";
import * as fs from "fs";

// Create and initialize a project
const project = new Project();
await project.initialize("/path/to/project" as FilePath);

// Add files to the project
const source = fs.readFileSync("src/main.ts", "utf-8");
project.update_file("src/main.ts" as FilePath, source);

// Build call graph and find entry points (true positives only —
// framework-invoked routes, Python dunders, pytest fixtures, etc. are
// filtered out by the bundled known-issues registry).
const call_graph = project.get_call_graph();
console.log("Entry points:", call_graph.entry_points.length);

// Inspect a specific function node
for (const [symbol_id, node] of call_graph.nodes) {
  console.log(`${node.name}: ${node.enclosed_calls.length} calls`);
}
```

## API Reference

### `Project`

The main class for managing code intelligence across multiple files.

#### Initialization

##### `initialize(root_folder?: FilePath, excluded_folders?: string[]): Promise<void>`

Initializes the project with a root folder path. Must be called before adding files.

- `root_folder` - Absolute path to the project root (defaults to cwd)
- `excluded_folders` - Folder names to exclude (e.g., `["node_modules", "dist"]`)

#### File Management

##### `update_file(file_id: FilePath, content: string): void`

Adds a new file or updates an existing file in the project. Automatically re-resolves affected files.

##### `remove_file(file_id: FilePath): void`

Removes a file from the project and re-resolves dependent files.

##### `get_all_files(): FilePath[]`

Returns all file paths currently tracked in the project.

##### `get_dependents(file_id: FilePath): Set<FilePath>`

Returns all files that import from the specified file.

#### Call Graph

##### `get_call_graph(options?: ClassifyOptions): CallGraph`

Builds the call graph from current project state. `entry_points` contains true positives only — entry points matching the bundled known-issues registry (Python dunders, Flask `@app.route` handlers, pytest fixtures, JSX components, etc.) are filtered out.

```typescript
const call_graph = project.get_call_graph();

// Entry points: probably-dead functions (true positives only)
for (const entry_id of call_graph.entry_points) {
  const node = call_graph.nodes.get(entry_id);
  console.log(`Entry point: ${node?.name}`);
}

// Check indirect reachability (functions in collections)
if (call_graph.indirect_reachability) {
  for (const [fn_id, info] of call_graph.indirect_reachability) {
    console.log(`${fn_id} reachable via ${info.reason.type}`);
  }
}
```

##### `get_classified_entry_points(options?: ClassifyOptions): ClassifiedEntryPoints`

Returns every candidate entry point paired with its classification verdict, split into true positives and known false positives. Used by triage workflows that need to inspect why a particular entry point is suppressed.

```typescript
const { true_entry_points, known_false_positives } =
  project.get_classified_entry_points();

for (const fp of known_false_positives) {
  const c = fp.classification;
  switch (c.kind) {
    case "framework_invoked":
      console.log(`${fp.symbol_id} called by ${c.framework} (${c.group_id})`);
      break;
    case "dunder_protocol":
      console.log(`${fp.symbol_id} is dunder ${c.protocol}`);
      break;
    case "test_only":
    case "indirect_only":
      console.log(`${fp.symbol_id}: ${c.kind} (${c.group_id})`);
      break;
  }
}
```

Both methods accept the same options and share an internal cache, so calling them in sequence does the classification work once.

```typescript
interface ClassifyOptions {
  /** Include test-file callables in entry-point detection. Default: false. */
  include_tests?: boolean;
  /**
   * Override the bundled permanent registry. Used by the self-healing
   * pipeline to load the full skill registry (including `wip` rules).
   */
  registry?: KnownIssuesRegistry;
}
```

#### Introspection

##### `get_stats(): { file_count, definition_count, resolution_count }`

Returns statistics about the project state.

##### `get_index_single_file(file_id: FilePath): SemanticIndex | undefined`

Returns the semantic index for a specific file, containing all extracted definitions, references, and scopes.

##### `get_definition(symbol_id: SymbolId): AnyDefinition | undefined`

Looks up a definition by its symbol ID.

##### `get_type_info(symbol_id: SymbolId): TypeMemberInfo | undefined`

Returns type member information for a symbol.

##### `get_source_code(file_id: FilePath, location: Location): string | undefined`

Extracts source code for a given location range.

#### Registries

The Project exposes several registries for advanced use cases:

- `project.definitions` - All symbol definitions
- `project.resolutions` - Resolved references and call graph data
- `project.scopes` - Scope hierarchy information
- `project.types` - Type registry with member information
- `project.imports` - Import graph between files
- `project.exports` - Exported symbols per file

### Types

```typescript
// Location in source code
interface Location {
  file_path: FilePath;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
}

// Call graph structure
interface CallGraph {
  // All callable nodes (functions, methods, constructors)
  nodes: ReadonlyMap<SymbolId, CallableNode>;

  // True-positive entry points only. Known false positives (framework
  // routes, dunder protocols, pytest fixtures, etc.) are filtered out.
  entry_points: readonly SymbolId[];

  // Functions reachable through indirect mechanisms (e.g., collection reads)
  indirect_reachability?: ReadonlyMap<SymbolId, IndirectReachability>;
}

// Classification verdict for a candidate entry point. Mutually exclusive.
type EntryPointClassification =
  | { kind: "true_entry_point" }
  | { kind: "framework_invoked"; group_id: string; framework: string }
  | { kind: "dunder_protocol"; group_id: string; protocol: string }
  | { kind: "test_only"; group_id: string }
  | {
      kind: "indirect_only";
      group_id: string;
      via: IndirectReachabilityReason;
    };

interface ClassifiedEntryPoint {
  symbol_id: SymbolId;
  classification: EntryPointClassification;
}

interface ClassifiedEntryPoints {
  true_entry_points: readonly ClassifiedEntryPoint[];
  known_false_positives: readonly ClassifiedEntryPoint[];
}

// Node in the call graph
interface CallableNode {
  symbol_id: SymbolId;
  name: SymbolName;
  enclosed_calls: readonly CallReference[]; // Calls made by this function
  location: Location;
  definition: AnyDefinition;
}

// Indirect reachability tracking
interface IndirectReachability {
  function_id: SymbolId;
  reason: {
    type: "collection_read";
    collection_id: SymbolId;
    read_location: Location;
  };
}

// Reference to a function call
interface CallReference {
  location: Location;
  name: SymbolName;
  scope_id: ScopeId;
  call_type: "function" | "method" | "constructor";
  resolutions: readonly Resolution[]; // All possible call targets
  is_callback_invocation?: boolean;
}
```

## Entry Point Detection

Entry points are functions that are never called by any other function in the codebase. The algorithm considers:

1. **Direct calls**: Function A calls function B → B is not an entry point
2. **Indirect reachability**: Function stored in a collection that is read → function is not an entry point
3. **Classification against known false positives**: Each candidate entry point is checked against a bundled registry of framework-invocation patterns (Flask routes, pytest fixtures, JSX components, dynamic dispatch, Python dunders, etc.). Matched candidates are excluded from `CallGraph.entry_points` and surfaced separately by `get_classified_entry_points()`.

Example of indirect reachability:

```typescript
// Handler functions are stored in HANDLERS
const HANDLERS = {
  create: handle_create,
  delete: handle_delete,
} as const;

// HANDLERS is read here - all stored functions become reachable
function dispatch(action: string) {
  const handler = HANDLERS[action];
  handler?.();
}
```

In this case, `handle_create` and `handle_delete` are NOT entry points because they are indirectly reachable through the `HANDLERS` collection read.

## Supported Languages

- JavaScript (including JSX)
- TypeScript (including TSX)
- Python
- Rust

## License

ISC
