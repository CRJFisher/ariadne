# Task 11.165: Filter Non-Callable Definitions from Entry Points

## Status: Planning

## Parent: epic-11-codebase-restructuring

## Overview

TypeScript interface method signatures are being detected as entry points, but interfaces are type definitions only - they have no implementation and cannot be "called". These should be filtered from entry point detection.

## False Positive Groups Addressed

This task addresses the following false positive group from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **typescript-interface-method-signatures-detected-as-entry-points** (7 entries)
   - Interface method signatures incorrectly detected as entry points
   - Examples:
     - `extract_assignment_parts` (interface method in `MetadataExtractors`)
     - `extract_construct_target` (interface method)
     - `get_scope_id` (interface method in `SemanticIndex`)

## Root Cause Analysis

The semantic indexer captures interface method signatures as definitions (correctly), but the entry point detection algorithm doesn't distinguish between:

1. **Callable definitions**: Functions, methods, constructors - have implementation bodies
2. **Type definitions**: Interface method signatures, abstract methods - no implementation

Interface method signatures should not be considered potential entry points because:
- They have no implementation body
- They cannot be executed
- Only their concrete implementations (in classes/objects) are callable

## Solution Approach

### Option A: Filter at Entry Point Detection (Recommended)

Add a filter in the entry point detection logic to exclude non-callable definition kinds:

```typescript
const NON_CALLABLE_KINDS = new Set([
  'interface_method_signature',
  'type_alias',
  'abstract_method',
  // ... other non-callable kinds
]);

function is_potential_entry_point(definition: AnyDefinition): boolean {
  if (NON_CALLABLE_KINDS.has(definition.kind)) {
    return false;
  }
  // ... existing entry point logic
}
```

### Option B: Tag Definitions as Callable/Non-Callable

Add a `is_callable` flag to definitions during semantic indexing:

```typescript
interface Definition {
  // ...existing fields
  is_callable: boolean;
}
```

## Implementation Plan

### 11.165.1: Identify All Non-Callable Definition Kinds

- Audit all definition kinds in the codebase
- Classify each as callable or non-callable
- Document the classification criteria

### 11.165.2: Add Entry Point Filter

- Implement filter in entry point detection
- Exclude interface method signatures
- Exclude abstract method declarations
- Exclude type aliases

### 11.165.3: Update Tests

- Add test cases for interface methods
- Verify they're excluded from entry points
- Test edge cases (e.g., interface with call signature)

## Definition Kind Classification

| Kind | Callable | Notes |
|------|----------|-------|
| `function` | ✅ | Has implementation |
| `method` | ✅ | Has implementation |
| `constructor` | ✅ | Has implementation |
| `arrow_function` | ✅ | Has implementation |
| `interface_method_signature` | ❌ | Type only |
| `property_signature` | ❌ | Type only |
| `type_alias` | ❌ | Type only |
| `abstract_method` | ❌ | No implementation |
| `variable` | Depends | Only if function-typed |
| `class` | ❌ | Constructors are callable, not classes |

## Files to Modify

- `packages/core/src/trace_call_graph/` (entry point detection logic)
- `top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts`

## Success Criteria

1. All 7 interface method signature false positives are eliminated
2. Abstract methods are also excluded
3. Actual callable methods are still detected as entry points
4. All tests pass

## Dependencies

- Standalone task, no dependencies on other call graph tasks
- Can be implemented in parallel with other tasks

## Priority

Medium - 7 entries, straightforward filter implementation.
