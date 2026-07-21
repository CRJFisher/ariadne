# Task: Implement show_call_tree_down Tool

**Status**: To Do
**Epic**: epic-11.147 - Overhaul MCP Package for Call Graph Analysis
**Created**: 2025-10-22
**Priority**: Medium
**Dependencies**: task-epic-11.147.1

## Overview

Create MCP tool that displays an ASCII call graph tree UNDERNEATH a given callable node.

Shows what functions are called by the target function, recursively.

## Tool Specification

**Tool Name**: `show_call_tree_down`

**Input Schema**:

```typescript
{
  symbol_name: string;      // Required - Name of the callable
  file_path: string;        // Required - File path where callable is defined
  line_number?: number;     // Optional - Line number to disambiguate overloads
}
```

**Output Format** (ASCII tree):

```
process_data (src/main.ts:42)
├─ validate_input (src/validators.ts:10)
│  ├─ check_type (src/validators.ts:5)
│  └─ sanitize (src/utils.ts:100)
├─ transform (src/transform.ts:20)
│  └─ apply_rules (src/rules.ts:50)
│     ├─ get_config (src/config.ts:15)
│     └─ log_event (src/logger.ts:30) (cycle)
└─ save_result (src/storage.ts:75)

Total: 6 functions called
Cycles detected: 1
```

## Algorithm

### 1. Resolve Symbol to SymbolId

```typescript
// Find definition by name + file + optional line
const defs = project.definitions.get_by_file(file_path);
let target_def = defs.find(d => d.name === symbol_name);

if (line_number && multiple matches) {
  target_def = defs.find(d =>
    d.name === symbol_name &&
    d.location.start_line === line_number
  );
}

const symbol_id = target_def.symbol_id;
```

### 2. Get CallableNode

```typescript
const call_graph = project.get_call_graph();
const node = call_graph.nodes.get(symbol_id);

if (!node) {
  return "Error: Symbol is not a callable or has no body";
}
```

### 3. Build ASCII Tree Recursively

```typescript
interface TreeNode {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  children: TreeNode[];
  is_cycle: boolean;
}

function build_tree(
  current_id: SymbolId,
  visited: Set<SymbolId>
): TreeNode {
  const node = call_graph.nodes.get(current_id);
  const is_cycle = visited.has(current_id);

  if (is_cycle) {
    return {
      symbol_id: current_id,
      name: node.name,
      location: node.location,
      children: [],
      is_cycle: true
    };
  }

  visited.add(current_id);

  const children = node.enclosed_calls
    .filter(call => call.symbol_id)
    .map(call => build_tree(call.symbol_id!, new Set(visited)));

  return {
    symbol_id: current_id,
    name: node.name,
    location: node.location,
    children,
    is_cycle: false
  };
}
```

### 4. Format as ASCII Tree

```typescript
function format_tree(
  tree: TreeNode,
  prefix: string = '',
  is_last: boolean = true
): string {
  const connector = is_last ? '└─' : '├─';
  const location = `${tree.location.file_path}:${tree.location.start_line}`;
  const cycle = tree.is_cycle ? ' (cycle)' : '';

  let output = `${prefix}${connector} ${tree.name} (${location})${cycle}\n`;

  if (!tree.is_cycle) {
    const child_prefix = prefix + (is_last ? '   ' : '│  ');
    tree.children.forEach((child, index) => {
      const child_is_last = index === tree.children.length - 1;
      output += format_tree(child, child_prefix, child_is_last);
    });
  }

  return output;
}
```

### 5. Count Total Functions

```typescript
function count_unique_functions(tree: TreeNode, visited: Set<SymbolId>): number {
  if (visited.has(tree.symbol_id)) return 0;
  visited.add(tree.symbol_id);

  let count = 1;
  for (const child of tree.children) {
    count += count_unique_functions(child, visited);
  }

  return count;
}
```

## Implementation Notes

### Root Node Display

The root node (target function) should be displayed differently:

```typescript
const location = `${node.location.file_path}:${node.location.start_line}`;
output = `${node.name} (${location})\n`;
```

### Cycle Detection

Mark cycles with `(cycle)` suffix and don't expand them:
- Track visited nodes per traversal path
- When revisiting a node, mark as cycle
- Don't traverse children of cycle nodes

### Handling Unresolved Calls

For calls where `symbol_id` is null:

```typescript
if (!call.symbol_id) {
  // Show unresolved call
  output += `${prefix}├─ ${call.name} (unresolved)\n`;
}
```

## Testing

### Unit Tests

- Symbol resolution by name + file
- Symbol resolution with line number
- Tree building (simple linear)
- Tree building (with branching)
- Cycle detection
- ASCII formatting
- Counting unique functions

### Integration Tests

**Test Case 1: Simple Linear Chain**

```typescript
function a() { b(); }
function b() { c(); }
function c() { }
```

Expected:

```
a (test.ts:1)
└─ b (test.ts:2)
   └─ c (test.ts:3)

Total: 2 functions called
```

**Test Case 2: Branching Tree**

```typescript
function main() {
  validate();
  process();
}
```

Expected:

```
main (test.ts:1)
├─ validate (test.ts:5)
└─ process (test.ts:6)

Total: 2 functions called
```

**Test Case 3: Cycle**

```typescript
function a() { b(); }
function b() { a(); }
```

Expected:

```
a (test.ts:1)
└─ b (test.ts:2)
   └─ a (test.ts:1) (cycle)

Total: 1 function called
Cycles detected: 1
```

## Acceptance Criteria

- [ ] Tool registered in MCP server with correct schema
- [ ] Resolves symbol by name + file_path
- [ ] Handles optional line_number for disambiguation
- [ ] Gets CallableNode from call graph
- [ ] Builds ASCII tree with proper indentation
- [ ] Uses box drawing characters (├─ └─ │)
- [ ] Shows file:line for each function
- [ ] Detects and marks cycles with "(cycle)"
- [ ] Doesn't expand cycle nodes
- [ ] Counts total unique functions correctly
- [ ] Shows cycle count in summary
- [ ] Handles unresolved calls gracefully
- [ ] Returns error for unknown symbol
- [ ] Returns error for non-callable symbol
- [ ] Tested with TypeScript, JavaScript, Python, and Rust

## Related Files

- [detect_call_graph.ts](../../../../packages/core/src/trace_call_graph/detect_call_graph.ts)
- [call_chains.ts](../../../../packages/types/src/call_chains.ts)
- [project.ts](../../../../packages/core/src/project/project.ts)
