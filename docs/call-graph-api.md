# Call Graph API

Ariadne provides a comprehensive call graph API for analyzing function call relationships across your codebase. This API enables you to build call hierarchies, trace dependencies, and understand code flow across multiple files and languages.

## Overview

The call graph API consists of three levels:
1. **Low-level building blocks** for custom analysis
2. **High-level convenience API** for complete call graphs
3. **Symbol naming utilities** for consistent identification

## API Reference

### Low-Level APIs

#### `get_definitions(file_path: string): Def[]`

Returns all definitions (functions, methods, classes, variables) in a file.

```typescript
import { get_definitions } from '@ariadnejs/core';

const definitions = get_definitions('src/utils.ts');
const functions = definitions.filter(d => d.symbol_kind === 'function');
```

#### `get_calls_from_definition(def: Def): FunctionCall[]`

Returns all function/method calls made within a definition's body. Automatically resolves imports to their actual definitions.

```typescript
const mainFunc = definitions.find(d => d.name === 'main');
const calls = project.get_calls_from_definition(mainFunc);

calls.forEach(call => {
  console.log(`${call.caller_def.name} calls ${call.called_def.name} at line ${call.call_location.row}`);
});
```

### High-Level API

#### `get_call_graph(options?: CallGraphOptions): CallGraph`

Builds a complete call graph for your project.

```typescript
// Using Project instance
const callGraph = project.get_call_graph({
  file_filter: (path) => !path.includes('test'),
  max_depth: 5,
  include_external: false
});

// Using standalone function
import { get_call_graph } from '@ariadnejs/core';
const callGraph = get_call_graph('./src', options);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include_external` | `boolean` | `false` | Include calls to external libraries |
| `max_depth` | `number` | `undefined` | Limit traversal depth from top-level nodes |
| `file_filter` | `(path: string) => boolean` | `undefined` | Filter which files to analyze |

**Returns:**

```typescript
interface CallGraph {
  nodes: Map<string, CallGraphNode>;  // All functions/methods in the graph
  edges: CallGraphEdge[];             // All call relationships
  top_level_nodes: string[];          // Entry points (not called by others)
}
```

### Symbol Naming

Ariadne uses a consistent symbol naming scheme for identifying functions across files:

- Format: `<module_path>#<symbol_name>`
- Examples:
  - `src/utils/helpers#processData` - Regular function
  - `models/user#User.validate` - Class method
  - `lib/math#<anonymous_line_42_col_10>` - Anonymous function

```typescript
import { get_symbol_id, parse_symbol_id } from '@ariadnejs/core';

// Generate symbol ID for a definition
const symbolId = get_symbol_id(def); // "src/utils#processData"

// Parse symbol ID
const { module_path, symbol_name } = parse_symbol_id(symbolId);
```

## Type Definitions

### Core Types

```typescript
interface Def {
  name: string;
  symbol_kind: "function" | "method" | "class" | "variable" | "const" | "let" | "constant" | "generator" | "constructor";
  range: SimpleRange;
  file_path: string;
  enclosing_range?: SimpleRange;
  parent?: string;
  metadata?: {
    signature?: string;
    docstring?: string;
    class_name?: string;
    is_async?: boolean;
    decorators?: string[];
  };
  symbol_id: string;
}

interface FunctionCall {
  caller_def: Def;
  called_def: Def;
  call_location: Point;
  is_method_call: boolean;
}

interface CallGraphNode {
  symbol: string;              // Symbol ID
  definition: Def;             // Function/method definition
  calls: Call[];              // Outgoing calls
  called_by: string[];        // Incoming call symbols
}

interface CallGraphEdge {
  from: string;               // Caller symbol ID
  to: string;                 // Callee symbol ID
  location: SimpleRange;      // Call location
}
```

## Usage Examples

### Finding Entry Points

```typescript
const callGraph = project.get_call_graph();

// Find all entry points (functions not called by any other)
console.log('Entry points:', callGraph.top_level_nodes);

// Analyze a specific entry point
const mainNode = callGraph.nodes.get('src/index#main');
if (mainNode) {
  console.log(`main() makes ${mainNode.calls.length} calls`);
}
```

### Tracing Call Paths

```typescript
function traceCallPath(callGraph: CallGraph, startSymbol: string, targetSymbol: string): string[][] {
  const paths: string[][] = [];
  const visited = new Set<string>();
  
  function dfs(current: string, path: string[]) {
    if (current === targetSymbol) {
      paths.push([...path, current]);
      return;
    }
    
    if (visited.has(current)) return;
    visited.add(current);
    
    const node = callGraph.nodes.get(current);
    if (node) {
      for (const call of node.calls) {
        dfs(call.symbol, [...path, current]);
      }
    }
  }
  
  dfs(startSymbol, []);
  return paths;
}
```

### Analyzing Dependencies

```typescript
// Find all functions that depend on a specific function
function findDependents(callGraph: CallGraph, targetSymbol: string): string[] {
  const node = callGraph.nodes.get(targetSymbol);
  return node ? node.called_by : [];
}

// Find all functions that a specific function depends on
function findDependencies(callGraph: CallGraph, sourceSymbol: string): string[] {
  const node = callGraph.nodes.get(sourceSymbol);
  return node ? node.calls.map(c => c.symbol) : [];
}
```

### Filtering by Scope

```typescript
// Analyze only a specific module
const callGraph = project.get_call_graph({
  file_filter: (path) => path.startsWith('src/auth/')
});

// Exclude test files
const prodGraph = project.get_call_graph({
  file_filter: (path) => !path.includes('test') && !path.includes('spec')
});

// Limit depth for large projects
const shallowGraph = project.get_call_graph({
  max_depth: 3
});
```

## Language Support

The call graph API supports:

- **TypeScript/JavaScript**: ES6 imports, CommonJS (limited), arrow functions, classes
- **Python**: import/from imports, class methods, decorators, nested functions
- **Rust**: mod imports, impl blocks, trait methods, associated functions

### Language-Specific Examples

#### TypeScript
```typescript
// Handles various TypeScript patterns
class UserService {
  async getUser(id: string) {
    const data = await this.fetchData(id);
    return this.processUser(data);
  }
  
  private fetchData = async (id: string) => {
    // Arrow function method
  }
}
```

#### Python
```python
# Handles Python-specific patterns
class DataProcessor:
    def process(self, data):
        return self._validate(data)
    
    @staticmethod
    def validate_schema(schema):
        # Static method
        pass
```

## Cross-File Resolution

The API automatically resolves imports across files:

```typescript
// file1.ts
export function helper() { return 42; }

// file2.ts
import { helper } from './file1';
function main() { 
  return helper(); // This call is correctly resolved to file1.ts#helper
}
```

## Performance Considerations

- **File Filtering**: Use `file_filter` to analyze only relevant files
- **Depth Limiting**: Use `max_depth` for large codebases to limit traversal
- **Caching**: The Project instance caches parsed files for repeated operations

## Limitations

- CommonJS `require()` has limited support compared to ES6 imports
- External library calls (node_modules) are not tracked by default
- Dynamic imports and runtime-evaluated calls cannot be statically analyzed

## See Also

- [Symbol Resolution](./symbol-resolution.md) - How Ariadne resolves symbols
- [API Reference](./api-reference.md) - Complete API documentation
- Examples in `src/call_graph.test.ts` and `src/call_graph_integration.test.ts`