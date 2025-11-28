# Task 11.162: Track All Call Graph Edges from Function Bodies

## Status: Planning

## Parent: epic-11-codebase-restructuring

## Overview

The call graph detection system currently misses calls made from various syntactic contexts within function bodies. This task consolidates multiple related false positive groups into a single focused implementation effort.

## False Positive Groups Addressed

This task addresses the following false positive groups from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **internal-helper-function-calls-not-tracked** (2 entries)
   - Calls from non-exported named helper functions not tracked
   - Example: `process_definitions()` calling `DefinitionBuilder` constructor

2. **for-loop-body-calls-not-tracked** (3 entries)
   - Calls inside `for`, `for-of`, `while` loop bodies not tracked
   - Example: `is_valid_capture` called from within a for-of loop

3. **recursive-method-calls-not-tracked** (1 entry)
   - `this.methodName()` recursive calls not tracked
   - Example: `extract_call_receiver` calling itself recursively

4. **nested-function-calls-not-tracked** (3 entries)
   - Calls to nested named functions (functions inside functions) not tracked
   - Example: `process_use_list_items` nested inside `extract_imports_from_use_declaration`

5. **array-method-argument-calls-not-tracked** (1 entry)
   - Calls in `.reduce()`, `.map()`, `.filter()` argument positions not tracked
   - Example: `new ReferenceBuilder()` as initial value to `.reduce()`

## Root Cause Analysis

All these issues stem from the same root cause: **call expressions are only being extracted from certain syntactic contexts**. The reference extraction logic needs to traverse all possible locations where calls can occur:

- Top-level function body statements ✅ (works)
- Nested blocks (if/else, try/catch, loops) ❌
- Callback function bodies ❌
- Array method arguments ❌
- Nested function bodies ❌

## Solution Approach

### Option A: Exhaustive AST Traversal (Recommended)

Walk the entire function body AST and extract all `call_expression` nodes regardless of their parent context.

```typescript
// Pseudo-code for exhaustive call extraction
function extract_all_calls_from_body(body_node: SyntaxNode): CallReference[] {
  const calls: CallReference[] = [];

  function visit(node: SyntaxNode) {
    if (node.type === 'call_expression') {
      calls.push(extract_call_reference(node));
    }
    for (const child of node.children) {
      visit(child);
    }
  }

  visit(body_node);
  return calls;
}
```

### Option B: Extended Tree-Sitter Queries

Add tree-sitter query patterns for each missing context. This is more declarative but requires many patterns.

## Implementation Plan

### 11.162.1: Audit Current Call Extraction Logic

- Identify where call references are currently extracted
- Document which syntactic contexts are covered vs missed
- Create test cases for each missing context

### 11.162.2: Implement Exhaustive Call Extraction

- Modify `reference_builder.ts` to use exhaustive traversal
- Ensure all call types are captured (function calls, method calls, constructor calls)
- Handle scope context correctly for nested calls

### 11.162.3: Update Tests and Validate

- Add fixture files covering all syntactic contexts
- Verify false positive entries are eliminated
- Performance testing for large files

## Files to Modify

- `packages/core/src/index_single_file/references/reference_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/queries/*.scm`
- Test files for reference extraction

## Success Criteria

1. All 10 false positive entries in addressed groups are eliminated
2. No regression in existing call graph detection
3. All tests pass
4. Performance acceptable (< 10% increase in processing time)

## Dependencies

- Complements Task 11.161 (named handler extraction)
- May inform improvements to method resolution (Task 11.91.3)

## Priority

High - This affects fundamental call graph accuracy and is a prerequisite for running ariadne on itself successfully.
