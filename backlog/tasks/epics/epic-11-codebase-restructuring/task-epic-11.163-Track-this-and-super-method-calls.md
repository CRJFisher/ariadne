# Task 11.163: Track this.method() and super.method() Calls

## Status: Planning

## Parent: epic-11-codebase-restructuring

## Overview

Method calls using `this.methodName()` and `super.methodName()` are not being tracked as references in the call graph. This causes class internal methods and parent class methods to incorrectly appear as entry points.

## False Positive Groups Addressed

This task addresses the following false positive groups from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **super-method-calls-not-tracked** (1 entry)
   - `super.methodName()` calls to parent class methods not tracked
   - Example: `TypeScriptScopeBoundaryExtractor` calling `super.extract_class_boundaries()`

2. **class-internal-method-calls-not-tracked** (1 entry)
   - `this.privateMethod()` calls within same class not tracked
   - Example: `extract_block_boundaries` called via `this.` from public method

## Root Cause Analysis

The call extraction and resolution system doesn't properly handle:

1. **`this.` receiver context**: When the receiver is `this`, the call should resolve to a method on the same class instance
2. **`super.` receiver context**: When the receiver is `super`, the call should resolve to a method on the parent class

These require understanding the class hierarchy context at the call site.

## Solution Approach

### Phase 1: Capture this/super Method Calls

Modify reference extraction to identify and tag method calls where the receiver is `this` or `super`:

```typescript
interface MethodCallReference {
  method_name: SymbolName;
  receiver_kind: 'this' | 'super' | 'identifier' | 'expression';
  location: Location;
  containing_class?: SymbolId;  // The class containing this call
}
```

### Phase 2: Resolve this.method() Calls

For `this.methodName()` calls:
1. Find the containing class at the call location
2. Look up `methodName` in that class's members
3. If not found, walk inheritance chain (handle inherited methods)

### Phase 3: Resolve super.method() Calls

For `super.methodName()` calls:
1. Find the containing class at the call location
2. Get the parent class(es) from inheritance info
3. Look up `methodName` in parent class members

## Implementation Plan

### 11.163.1: Enhance Call Reference Extraction

- Add `receiver_kind` field to call references
- Detect `this` and `super` receivers in tree-sitter queries
- Preserve containing class context for resolution

### 11.163.2: Implement this.method() Resolution

- Add resolution logic for `this` receiver context
- Handle same-class method lookups
- Handle inherited method lookups via `this`

### 11.163.3: Implement super.method() Resolution

- Add resolution logic for `super` receiver context
- Find parent class from type hierarchy
- Resolve method in parent class members

### 11.163.4: Update Tests

- Add fixtures for this/super method calls
- Verify false positives eliminated
- Test complex inheritance scenarios

## Files to Modify

- `packages/core/src/index_single_file/references/reference_builder.ts`
- `packages/core/src/resolve_references/call_resolution/method_resolver.ts`
- `packages/core/src/index_single_file/query_code_tree/queries/*.scm`

## Success Criteria

1. Both false positive entries are eliminated
2. `this.method()` calls resolve to class methods
3. `super.method()` calls resolve to parent class methods
4. All tests pass

## Dependencies

- Requires class hierarchy information from type resolution (Task 11.91.3)
- Complements Task 11.162 (body call extraction)

## Priority

Medium-High - Important for accurate class-based call graphs.
