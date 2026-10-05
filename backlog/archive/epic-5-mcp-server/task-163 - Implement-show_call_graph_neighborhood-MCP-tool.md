---
id: task-163
title: Implement show_call_graph_neighborhood MCP tool
status: Completed
assignee: []
created_date: '2026-01-25'
labels: [mcp, call-graph, tooling]
dependencies: []
priority: Medium
---

# Task 163: Implement show_call_graph_neighborhood MCP tool

## Description

Create an MCP tool that displays the call graph neighborhood surrounding a given callable node. Given a symbol reference (from `list_entrypoints` output or constructed ad-hoc), it shows callers (n1 levels up) and callees (n2 levels down) with configurable depth and signature display options.

This is a companion tool to `list_entrypoints` that allows users to explore the call graph in detail around any callable node.

## Context

The `list_entrypoints` tool provides a high-level view of entry points with their call tree sizes. This companion tool enables drilling down into specific functions to see:

- What functions call this function (callers/upstream)
- What functions this function calls (callees/downstream)
- The full call chain context for understanding code flow

## Input Schema

```typescript
export const show_call_graph_neighborhood_schema = z.object({
  symbol_ref: z
    .string()
    .describe("Callable reference in format 'file_path:line#name' (e.g., 'src/handlers.ts:15#handle_request')"),
  callers_depth: z
    .number()
    .nullable()
    .optional()
    .describe("Levels of callers to show (null = unlimited, default: 1)"),
  callees_depth: z
    .number()
    .nullable()
    .optional()
    .describe("Levels of callees to show (null = unlimited, default: 1)"),
  show_full_signature: z
    .boolean()
    .optional()
    .default(true)
    .describe("Show full signature with params/return type (default: true) vs just name"),
});
```

## Output Format

```text
Call graph for: handle_request(req: Request): Promise<void>
Location: src/handlers.ts:15-42

Callers (1 level up):
  (none - this is an entry point)

Callees (2 levels down):
  ├── validate_request(req: Request): boolean
  │   Location: src/validation.ts:10-25
  │   └── check_auth(token: string): boolean
  │       Location: src/auth.ts:5-15
  └── process_data(data: Data): Result
      Location: src/processing.ts:30-80
```

## Acceptance Criteria

- [x] Takes `symbol_ref` parameter in format `file_path:line#name`
- [x] Parses symbol_ref and looks up the definition by file path and line number
- [x] `callers_depth` parameter: number of levels up (null = unlimited, default: 1)
- [x] `callees_depth` parameter: number of levels down (null = unlimited, default: 1)
- [x] `show_full_signature` flag: full signature (default: true) vs just name
- [x] Always displays location info in format: `<file-path>:<start-line>-<end-line>`
- [x] Handles cycles gracefully (marks revisited nodes with indicator like `[cycle]`)
- [x] ASCII tree output format for readability
- [x] Works with filtered `list_entrypoints` results (respects scoped analysis)
- [x] Graceful error message if symbol_ref doesn't resolve to a known callable
- [x] Unit tests for all parameters and edge cases
- [ ] E2E test demonstrating integration with `list_entrypoints` (tested manually)

## Technical Approach

### Symbol Reference Parsing

```typescript
interface ParsedSymbolRef {
  file_path: string;
  line: number;
  name: string;
}

function parse_symbol_ref(ref: string): ParsedSymbolRef {
  // Format: "file_path:line#name"
  // Example: "src/handlers.ts:15#handle_request"
  const hash_index = ref.lastIndexOf('#');
  const name = ref.slice(hash_index + 1);
  const file_line = ref.slice(0, hash_index);
  const colon_index = file_line.lastIndexOf(':');
  const file_path = file_line.slice(0, colon_index);
  const line = parseInt(file_line.slice(colon_index + 1), 10);
  return { file_path, line, name };
}
```

### Call Graph Navigation

**DOWN navigation (callees):**

```typescript
const node = call_graph.nodes.get(symbol_id);
for (const call of node.enclosed_calls) {
  for (const resolution of call.resolutions) {
    const callee = call_graph.nodes.get(resolution.symbol_id);
    // Recurse to depth limit
  }
}
```

**UP navigation (callers):**

```typescript
// Build reverse index on first call
const callers_index = new Map<SymbolId, Set<SymbolId>>();
for (const [node_id, node] of call_graph.nodes) {
  for (const call of node.enclosed_calls) {
    for (const resolution of call.resolutions) {
      if (!callers_index.has(resolution.symbol_id)) {
        callers_index.set(resolution.symbol_id, new Set());
      }
      callers_index.get(resolution.symbol_id)!.add(node_id);
    }
  }
}
```

### Cycle Detection

Track visited nodes during traversal:

```typescript
function traverse_callees(
  node_id: SymbolId,
  depth: number,
  visited: Set<SymbolId>
): TreeNode {
  if (visited.has(node_id)) {
    return { ...node, is_cycle: true };
  }
  visited.add(node_id);
  // ... recurse
}
```

### Signature Building

Reuse `build_signature()` from `list_entrypoints.ts` (already exported).

## Implementation Notes

### Files Created/Modified

- **Created**: `packages/mcp/src/tools/show_call_graph_neighborhood.ts` - Main implementation (~490 lines)
- **Created**: `packages/mcp/src/tools/show_call_graph_neighborhood.test.ts` - 34 unit tests
- **Modified**: `packages/mcp/src/start_server.ts` - Tool registration

### Key Implementation Details

1. **Symbol lookup**: Iterates call graph nodes matching by file path (supports relative/absolute), start_line, and name
2. **Callers index**: Built on-demand per request using `build_callers_index()`
3. **Cycle detection**: Uses cloned `visited` Set for each branch to handle branching paths correctly
4. **Signature display**: Reuses `build_signature()` exported from `list_entrypoints.ts`

### Exported Functions

For testing and potential reuse:

- `parse_symbol_ref(ref: string)` - Parse `file_path:line#name` format
- `find_node_by_symbol_ref(call_graph, parsed_ref)` - Find node by reference
- `build_callers_index(call_graph)` - Build reverse index

## Test Gaps

- E2E integration test with `list_entrypoints` not automated (tested manually)
- Polymorphic calls with multiple resolutions covered by traversal but not explicitly tested
- Very large graphs (performance testing not included)
