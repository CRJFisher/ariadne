# Ariadne Agent Validation Report - 2025-08-04

## Summary

- Total nodes validated: 103
- Accurate top-level identification: 0/36 (0%) - Most "top-level" nodes are actually called by project_call_graph.ts
- Accurate call relationships: Very low - method calls not detected
- File summary accuracy: Cannot verify due to key file being skipped

## Critical Issues Found

### 1. File Size Limit Causing Major Analysis Gaps

- ❌ **project_call_graph.ts (60.1KB)** was skipped due to 32KB tree-sitter limit
- This file contains the core call graph logic and calls many functions marked as "top-level"
- Without this file, the analysis is fundamentally incomplete

### 2. Method Calls Not Detected

Functions show 0 outgoing calls despite having many method calls:

- ❌ `apply_max_depth_filter`: Uses `nodes.get()`, `visited.has()`, `visited.add()`, `queue.push()`, `queue.shift()`, `edges.filter()`
- ❌ `generateLargeFile`: Uses `lines.push()` (multiple times), `lines.join()`
- ❌ All array, Map, Set, and other built-in type method calls are ignored

### 3. False Top-Level Node Identification

Due to project_call_graph.ts being skipped:

- ❌ `apply_max_depth_filter` marked as top-level but called by project_call_graph.ts
- ❌ `is_position_within_range` marked as top-level but called 8 times in project_call_graph.ts
- ❌ `get_function_node_range` likely also called by the skipped file

## Validation Statistics vs Thresholds

- **Nodes with calls: 36.9%** (need 85%) ❌
  - Root cause: Method calls on built-in types not tracked
- **Nodes called by others: 65.0%** (need 85%) ❌  
  - Root cause: Key file with many function calls skipped
- **Top-level accuracy: 100%** but meaningless due to missing file

## Specific Examples of Missed Calls

### Example 1: apply_max_depth_filter

```typescript
// Lines 39-44 contain multiple method calls:
const caller_node = nodes.get(node);  // Map.get() not tracked
if (caller_node) {
  for (const call of caller_node.calls) {
    if (!visited.has(call.symbol)) {  // Set.has() not tracked
      visited.add(call.symbol);        // Set.add() not tracked
      queue.push({ node: call.symbol, depth: depth + 1 }); // Array.push() not tracked
```

### Example 2: generateLargeFile  

```typescript
// Multiple array method calls throughout:
lines.push(`import { Something } from './module';`); // Not tracked
lines.push('');  // Not tracked
// ... many more push calls
return lines.join('\n'); // Array.join() not tracked
```

## Root Causes Summary

1. **File size limit (32KB)** prevents analysis of critical files
2. **Method call detection** only works for direct function calls, not method calls
3. **Built-in type methods** (Array, Map, Set, String, etc.) are completely ignored

## Conclusion

The current implementation significantly undercounts both:

- Functions that make calls (missing all method calls)
- Functions that are called (missing calls from large files)

This explains why the metrics are at 36.9% and 65% instead of the required 85%.
