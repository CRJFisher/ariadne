---
id: task-epic-11.100.0.5.17.1
title: Fix function name extraction in scope tree analysis
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['bug-fix', 'function-extraction', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.17']
parent_task_id: task-epic-11.100.0.5.17
priority: high
---

## Description

Fix function name extraction where function names are appearing as "anonymous_scope_1", "anonymous_scope_2" instead of actual function names when extracting function definitions from scope tree.

## Background

After removing adapter usage in file_analyzer.ts, function extraction is now directly using scope tree data. However, the function names are not being correctly extracted from the scope metadata, resulting in generic anonymous names.

## Acceptance Criteria

- [ ] Function definitions show actual function names, not generic scope IDs
- [ ] Named functions extract correct names from scope metadata
- [ ] Anonymous functions show descriptive names based on context
- [ ] All comprehensive function extraction tests pass
- [ ] Function name extraction works across all supported languages (JS, TS, Python, Rust)

## Implementation Details

**Root Cause Analysis:**
```typescript
// Current problematic extraction in file_analyzer.ts:372-382
const func_name = scope.metadata?.name || `anonymous_${scope.id}`;
```

The issue is likely in:
1. Scope tree metadata not properly capturing function names during AST parsing
2. Function name extraction logic in scope_tree.ts
3. Metadata assignment in build_scope_tree()

**Investigation Required:**
- Check scope_tree.ts for function name extraction
- Verify metadata.name is populated correctly during scope building
- Test function name extraction across different function declaration types

## Affected Files

- `packages/core/src/file_analyzer.ts` (lines 372-382)
- `packages/core/src/scope_analysis/scope_tree/scope_tree.ts`
- `packages/core/src/file_analyzer.comprehensive.test.ts`

## Test Cases

```javascript
// Should extract "calculateSum" not "anonymous_scope_1"
function calculateSum(a, b) { return a + b; }

// Should extract "multiply" not "anonymous_scope_2"
const multiply = (x, y) => x * y;

// Should extract "processData" not "anonymous_scope_3"
async function processData() { /* ... */ }
```