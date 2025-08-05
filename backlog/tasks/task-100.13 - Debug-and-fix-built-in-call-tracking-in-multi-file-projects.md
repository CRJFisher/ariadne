---
id: task-100.13
title: Debug and fix built-in call tracking in multi-file projects
status: To Do
assignee: ['@claude']
created_date: '2025-08-05 07:04'
labels: ['bug', 'critical', 'validation']
dependencies: ['task-100.11.14']
parent_task_id: task-100
---

## Description

Built-in call tracking works perfectly for single files but fails when analyzing multiple files together. This causes the validation to show only 34.7% nodes with calls instead of the expected 85%+.

**Critical Finding**: The built-in tracking implementation from task-100.11.14 is actually present and working in the codebase, but there's a state management bug that causes it to fail in multi-file scenarios.

## Acceptance Criteria

- [ ] Built-in calls tracked correctly in multi-file projects
- [ ] Validation shows 85%+ nodes with calls (currently 34.7%)
- [ ] generateLargeFile shows 19 calls in multi-file context (currently 0)
- [ ] No regression when adding more files
- [ ] Test coverage for multi-file built-in tracking

## Investigation Findings (2025-08-05)

### 1. Built-in Tracking Implementation Status

The implementation is present in `analyze_calls_from_definition` (lines 142-163):
- Correctly identifies unresolved calls using `is_reference_called`
- Creates synthetic definitions with `<builtin>#` prefix
- Adds calls to the calls array
- Tests pass showing it works

### 2. Single File vs Multi-File Behavior

**Single file test results:**
```
// Loading only src/benchmark-incremental.ts
Total nodes: 2
Total edges: 5
generateLargeFile: 19 calls (including push, console.log, etc.)
benchmark: 3 calls
Nodes with calls: 2/2 (100.0%) ✅
```

**Multi-file test results:**
```
// Loading src/benchmark-incremental.ts + graph.ts + index.ts
Total nodes: 33
Total edges: 20
generateLargeFile: 0 calls ❌
Nodes with calls: 16/33 (48.5%)
```

### 3. Validation Script Issues Found and Fixed

1. **Counting bug**: Validation was counting edges instead of node.calls
   - Built-in calls don't create edges (by design)
   - Fixed to use `node.calls.length` instead of edge count
   
2. **get_calls_from_definition**: Missing required parameters
   - Fixed by adding goToDefinition and getImportsWithDefinitions

### 4. Root Cause Analysis

The issue is NOT in:
- ❌ The built-in tracking logic (works correctly)
- ❌ The is_reference_called function (detects calls properly)
- ❌ The synthetic definition creation (creates proper <builtin># entries)
- ❌ The validation script (now fixed)

The issue IS likely in:
- ✅ State management during multi-file call graph construction
- ✅ How CallGraphService.extractCallGraph processes multiple files
- ✅ Possible state mutation or overwriting when processing subsequent files

### 5. Specific Symptoms

1. `generateLargeFile` function:
   - Single file: 19 calls tracked (push, console.log, etc.)
   - Multi-file: 0 calls tracked
   
2. Overall metrics:
   - Single file: 100% nodes with calls
   - Multi-file: 48.5% nodes with calls
   - Validation (44 files): 34.7% nodes with calls

3. The built-in calls are being detected during analysis but lost during call graph construction

### 6. Code Locations to Investigate

1. `CallGraphService.extractCallGraph` - How it processes multiple files
2. `CallGraphService.getCallGraph` - The main entry point
3. `build_call_graph_for_display` - How it constructs the final graph
4. State management in the immutable architecture

### 7. Test Case to Reproduce

```typescript
const project = new Project();
project.add_or_update_file('file1.ts', 'function f1() { console.log("test"); }');
project.add_or_update_file('file2.ts', 'function f2() { console.log("test"); }');
const graph = project.get_call_graph();
// Expected: Both f1 and f2 have 1 call each
// Actual: One or both may have 0 calls
```
