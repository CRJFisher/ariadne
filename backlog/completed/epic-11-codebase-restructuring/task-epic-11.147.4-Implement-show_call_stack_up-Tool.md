# Task: Implement show_call_stack_up Tool

**Status**: To Do
**Epic**: epic-11.147 - Overhaul MCP Package for Call Graph Analysis
**Created**: 2025-10-22
**Priority**: Medium
**Dependencies**: task-epic-11.147.1

## Overview

Create MCP tool that displays an ASCII call stack ABOVE a given callable node.

Shows what functions call the target function, recursively. This is the inverse of `show_call_tree_down`.

## Tool Specification

**Tool Name**: `show_call_stack_up`

**Input Schema**:

```typescript
{
  symbol_name: string;      // Required - Name of the callable
  file_path: string;        // Required - File path where callable is defined
  line_number?: number;     // Optional - Line number to disambiguate overloads
}
```

**Output Format** (ASCII inverted tree):

```
validate_input (src/validators.ts:10)

Called by:
├─ process_data (src/main.ts:42)
│  ├─ handle_request (src/handlers.ts:100) [ENTRY POINT]
│  └─ batch_process (src/batch.ts:25) [ENTRY POINT]
└─ quick_validate (src/api.ts:50)
   └─ health_check (src/api.ts:10) [ENTRY POINT]

Total: 4 callers
Entry points: 3
```

## Algorithm

### 1. Resolve Symbol to SymbolId

Same as `show_call_tree_down`:

```typescript
const target_symbol_id = resolve_symbol(symbol_name, file_path, line_number);
```

### 2. Build Reverse Call Map

Build a map of "who calls whom":

```typescript
const callers_map = new Map<SymbolId, Set<SymbolId>>();

for (const [caller_id, node] of call_graph.nodes) {
  for (const call_ref of node.enclosed_calls) {
    if (call_ref.symbol_id) {
      const callee_id = call_ref.symbol_id;
      if (!callers_map.has(callee_id)) {
        callers_map.set(callee_id, new Set());
      }
      callers_map.get(callee_id)!.add(caller_id);
    }
  }
}
```

### 3. Build Inverted Tree Recursively

```typescript
interface CallerNode {
  symbol_id: SymbolId;
  name: string;
  location: Location;
  callers: CallerNode[];
  is_entry_point: boolean;
  is_cycle: boolean;
}

function build_caller_tree(
  current_id: SymbolId,
  visited: Set<SymbolId>
): CallerNode {
  const node = call_graph.nodes.get(current_id);
  const is_cycle = visited.has(current_id);
  const is_entry_point = call_graph.entry_points.includes(current_id);

  if (is_cycle) {
    return {
      symbol_id: current_id,
      name: node.name,
      location: node.location,
      callers: [],
      is_entry_point,
      is_cycle: true
    };
  }

  visited.add(current_id);

  const caller_ids = callers_map.get(current_id) || new Set();
  const callers = Array.from(caller_ids).map(caller_id =>
    build_caller_tree(caller_id, new Set(visited))
  );

  return {
    symbol_id: current_id,
    name: node.name,
    location: node.location,
    callers,
    is_entry_point,
    is_cycle: false
  };
}
```

### 4. Format as ASCII Tree

Similar to `show_call_tree_down` but traverse `callers` instead of `children`:

```typescript
function format_caller_tree(
  tree: CallerNode,
  prefix: string = '',
  is_last: boolean = true
): string {
  const connector = is_last ? '└─' : '├─';
  const location = `${tree.location.file_path}:${tree.location.start_line}`;
  const entry = tree.is_entry_point ? ' [ENTRY POINT]' : '';
  const cycle = tree.is_cycle ? ' (cycle)' : '';

  let output = `${prefix}${connector} ${tree.name} (${location})${entry}${cycle}\n`;

  if (!tree.is_cycle) {
    const child_prefix = prefix + (is_last ? '   ' : '│  ');
    tree.callers.forEach((caller, index) => {
      const caller_is_last = index === tree.callers.length - 1;
      output += format_caller_tree(caller, child_prefix, caller_is_last);
    });
  }

  return output;
}
```

### 5. Handle Special Cases

**No Callers (Entry Point)**:

```typescript
if (!callers_map.has(target_symbol_id)) {
  return `${target_name} (${target_location})\n\n[ENTRY POINT]\nThis function is never called by other functions.`;
}
```

**Root Display**:

```typescript
const location = `${node.location.file_path}:${node.location.start_line}`;
output = `${node.name} (${location})\n\nCalled by:\n`;
```

## Implementation Notes

### Entry Point Detection

A function is an entry point if:
- It appears in `call_graph.entry_points`, OR
- It is not called by any other function in the graph

Mark entry points with `[ENTRY POINT]` label.

### Cycle Detection

Same as `show_call_tree_down`:
- Track visited nodes per path
- Mark cycles with `(cycle)` suffix
- Don't expand cycle nodes

### Multiple Call Sites

If function A calls function B multiple times, only show A once in the caller tree.

### Counting Statistics

```typescript
function count_stats(tree: CallerNode): { callers: number; entry_points: number } {
  const visited = new Set<SymbolId>();
  let entry_points = 0;

  function traverse(node: CallerNode) {
    if (visited.has(node.symbol_id)) return;
    visited.add(node.symbol_id);

    if (node.is_entry_point) entry_points++;

    for (const caller of node.callers) {
      traverse(caller);
    }
  }

  traverse(tree);

  return {
    callers: visited.size - 1, // Exclude target itself
    entry_points
  };
}
```

## Testing

### Unit Tests

- Building reverse caller map
- Building caller tree (simple)
- Building caller tree (branching)
- Cycle detection
- Entry point detection
- ASCII formatting

### Integration Tests

**Test Case 1: Single Caller Chain**

```typescript
function a() { b(); }
function b() { c(); }
function c() { }
```

For `c()`:

```
c (test.ts:3)

Called by:
└─ b (test.ts:2)
   └─ a (test.ts:1) [ENTRY POINT]

Total: 2 callers
Entry points: 1
```

**Test Case 2: Multiple Callers**

```typescript
function a() { c(); }
function b() { c(); }
function c() { }
```

For `c()`:

```
c (test.ts:3)

Called by:
├─ a (test.ts:1) [ENTRY POINT]
└─ b (test.ts:2) [ENTRY POINT]

Total: 2 callers
Entry points: 2
```

**Test Case 3: Entry Point**

```typescript
function main() { }
```

For `main()`:

```
main (test.ts:1)

[ENTRY POINT]
This function is never called by other functions.
```

**Test Case 4: Cycle**

```typescript
function a() { b(); }
function b() { a(); }
```

For `b()`:

```
b (test.ts:2)

Called by:
└─ a (test.ts:1)
   └─ b (test.ts:2) (cycle)

Total: 1 caller
Cycles detected: 1
```

## Acceptance Criteria

- [ ] Tool registered in MCP server with correct schema
- [ ] Resolves symbol by name + file_path
- [ ] Handles optional line_number for disambiguation
- [ ] Builds reverse caller map correctly
- [ ] Builds ASCII inverted tree with proper indentation
- [ ] Uses box drawing characters (├─ └─ │)
- [ ] Shows file:line for each function
- [ ] Marks entry points with [ENTRY POINT]
- [ ] Detects and marks cycles with "(cycle)"
- [ ] Doesn't expand cycle nodes
- [ ] Counts total callers correctly
- [ ] Counts entry points correctly
- [ ] Shows meaningful message for entry point functions
- [ ] Returns error for unknown symbol
- [ ] Tested with TypeScript, JavaScript, Python, and Rust

## Related Files

- [detect_call_graph.ts](../../../../packages/core/src/trace_call_graph/detect_call_graph.ts)
- [call_chains.ts](../../../../packages/types/src/call_chains.ts)
- [project.ts](../../../../packages/core/src/project/project.ts)
