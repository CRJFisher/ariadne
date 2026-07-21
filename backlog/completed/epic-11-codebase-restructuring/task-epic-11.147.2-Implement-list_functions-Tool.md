# Task: Implement list_functions Tool

**Status**: Completed
**Epic**: epic-11.147 - Overhaul MCP Package for Call Graph Analysis
**Created**: 2025-10-22
**Completed**: 2025-10-22
**Priority**: Medium
**Dependencies**: task-epic-11.147.1

## Overview

Create MCP tool that lists all top-level (entry point) functions ordered by tree-size (total unique functions transitively called).

This helps understand codebase structure and identify the most complex entry points.

## Tool Specification

**Tool Name**: `list_functions`

**Input Schema**:
```typescript
{
  // No parameters - lists all entry points in loaded project
}
```

**Output Format** (text):
```
Top-Level Functions (by call tree size):

- handle_request(req: Request, res: Response): Promise<void> -- 42 functions
  Entry point: packages/api/src/handlers/main.ts:15

- batch_process(items: DataItem[]): void -- 23 functions
  Entry point: packages/batch/src/processor.ts:50

- simple_util(): string -- 0 functions
  Entry point: packages/utils/src/helpers.ts:100

Total: 3 entry points
```

## Algorithm

### 1. Get Call Graph

```typescript
const call_graph = project.get_call_graph();
```

### 2. For Each Entry Point, Calculate Tree Size

For each `entry_point_id` in `call_graph.entry_points`:

a. Get the `CallableNode` from `call_graph.nodes.get(entry_point_id)`

b. Traverse call tree depth-first to count unique called functions:

```typescript
function count_tree_size(node_id: SymbolId, visited: Set<SymbolId>): number {
  if (visited.has(node_id)) return 0; // Cycle detection
  visited.add(node_id);

  const node = call_graph.nodes.get(node_id);
  if (!node) return 0;

  let count = 0;
  for (const call_ref of node.enclosed_calls) {
    if (call_ref.symbol_id) {
      count += 1 + count_tree_size(call_ref.symbol_id, visited);
    }
  }

  return count;
}
```

c. Build function signature from definition:

```typescript
function build_signature(def: AnyDefinition): string {
  if (def.kind === 'function' || def.kind === 'method') {
    const params = def.parameters
      .map(p => `${p.name}: ${p.type_annotation || 'any'}`)
      .join(', ');
    const return_type = def.return_type_annotation || 'unknown';
    return `${def.name}(${params}): ${return_type}`;
  }
  return def.name;
}
```

### 3. Sort and Format

```typescript
const entries = entry_points
  .map(id => ({
    id,
    node: call_graph.nodes.get(id)!,
    tree_size: count_tree_size(id, new Set())
  }))
  .sort((a, b) => b.tree_size - a.tree_size);

const output = entries.map(entry => {
  const signature = build_signature(entry.node.definition);
  const location = `${entry.node.location.file_path}:${entry.node.location.start_line}`;
  return `- ${signature} -- ${entry.tree_size} functions\n  Entry point: ${location}`;
}).join('\n\n');
```

## Implementation Notes

### Handle Edge Cases

1. **No Entry Points**: Return "No entry points found (all functions are called)"
2. **Cycles**: Track visited nodes to avoid infinite loops
3. **Unresolved Calls**: Count them separately, show as "X unresolved calls"
4. **Large Trees**: Consider limiting output or adding pagination

### Type Information

Extract types from definition metadata:
- Parameters: `def.parameters[i].type_annotation`
- Return type: `def.return_type_annotation`
- Default to `unknown` if missing

### Signature Formatting

For different definition types:
- **Function**: `func_name(param: type): return_type`
- **Method**: `method_name(this, param: type): return_type`
- **Constructor**: `constructor(param: type)`

## Testing

### Unit Tests

- Tree size calculation (no cycles)
- Tree size calculation (with cycles)
- Signature building for functions
- Signature building for methods
- Sorting by tree size

### Integration Tests

Test with realistic codebases:
1. **TypeScript API server**:
   - Multiple route handlers (entry points)
   - Shared utilities
   - Database access

2. **Python CLI tool**:
   - Main entry point
   - Command handlers
   - Utilities

3. **JavaScript library**:
   - Exported functions (entry points)
   - Internal helpers

### Expected Results

For a simple API server:
```
- handle_get_users(req, res): Promise<void> -- 15 functions
- handle_create_user(req, res): Promise<void> -- 12 functions
- health_check(): string -- 0 functions
```

## Acceptance Criteria

- [x] Tool registered in MCP server with correct schema
- [x] Lists all entry points from call graph
- [x] Calculates tree-size correctly via DFS traversal
- [x] Detects and handles cycles
- [x] Sorts by tree-size descending
- [x] Shows function signatures with parameters and return types
- [x] Shows file path and line number for each entry point
- [x] Handles missing type information gracefully
- [x] Returns meaningful message when no entry points exist
- [x] Output format matches specification
- [x] Tested with TypeScript (manual integration test)

## Implementation Summary

### Files Created

**packages/mcp/src/tools/list_functions.ts** (~240 lines):

- `list_functions_schema`: Zod schema (empty object - no parameters)
- `list_functions()`: Main tool function
- `count_tree_size()`: DFS traversal with cycle detection via visited set
- `build_signature()`: Formats function signatures with parameters and return types
- `format_output()`: ASCII formatting with proper pluralization

### Files Modified

**packages/mcp/src/start_server.ts**:

- Added imports for MCP SDK schemas and list_functions tool
- Registered tool in `ListToolsRequestSchema` handler with descriptive schema
- Added switch case in `CallToolRequestSchema` handler
- Loads project files before calling tool

### Key Implementation Details

1. **Cycle Detection**: Uses `Set<SymbolId>` to track visited nodes during DFS
2. **Type Handling**: Defaults to `any` for missing parameter types, `unknown` for missing return types
3. **Signature Building**: Handles FunctionDefinition, MethodDefinition, and ConstructorDefinition
4. **Unresolved Calls**: Tracks and displays count of unresolved calls (external/unfound symbols)
5. **Pythonic Naming**: All functions use snake_case consistently

### Verification

**Manual Integration Test Results**:
```
Top-Level Functions (by call tree size):

- main(): unknown -- 4 functions
  Entry point: test1.ts:2

- api_handler(req: Request, res: Response): Promise<void> -- 3 functions
  Entry point: test2.ts:2

- standalone(): unknown -- 0 functions
  Entry point: test1.ts:21

Total: 3 entry points
```

✅ Correctly identifies entry points
✅ Correctly counts transitive function calls
✅ Properly formats signatures with types
✅ Sorts by tree size descending

### Next Steps

Tool is ready for use. Proceed to [task-epic-11.147.3](task-epic-11.147.3-Implement-show_call_tree_down-Tool.md) for the next MCP tool.

## Related Files

- [detect_call_graph.ts](../../../../packages/core/src/trace_call_graph/detect_call_graph.ts)
- [call_chains.ts](../../../../packages/types/src/call_chains.ts)
- [project.ts](../../../../packages/core/src/project/project.ts)
- [list_functions.ts](../../../../packages/mcp/src/tools/list_functions.ts) (NEW)
- [start_server.ts](../../../../packages/mcp/src/start_server.ts) (MODIFIED)
