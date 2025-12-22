# Task 11.162.1: Fix body_scope_id Assignment in find_body_scope_for_definition

## Status: Planning

## Parent: task-epic-11.162

## Overview

The `find_body_scope_for_definition` function in `scopes.utils.ts` uses overly permissive matching that causes multiple functions to incorrectly share the same `body_scope_id`. This was discovered during diagnostic testing for Task 11.162.

## Problem Description

### Symptom

Multiple functions are assigned the same `body_scope_id`, causing their enclosed calls to be incorrectly attributed.

### Evidence from Diagnostic Testing

```text
Functions with body_scope_id:
  inner (line 16): body_scope_id = function:...16:17:16:30
  with_reduce (line 20): body_scope_id = function:...16:17:16:30  ← SAME AS inner!
  <anonymous> (line 21): body_scope_id = function:...16:17:16:30  ← SAME AS inner!
```

Three different functions at different lines share the same `body_scope_id`.

### Root Cause

The `find_body_scope_for_definition` function in [scopes.utils.ts:27-100](packages/core/src/index_single_file/scopes/scopes.utils.ts#L27-L100) has:

1. **Overly permissive distance check**: `distance >= -100000` allows matching scopes up to 100,000 positions before the definition
2. **Fuzzy name matching**: Partial and case-insensitive matching can match wrong functions
3. **Fallback location-only matching**: Pure location-based matching without name validation

```typescript
// Current problematic code (lines 52-80)
if (distance >= -100000 && distance < smallest_distance) {
  // This distance check is extremely permissive
  // Could match wrong function entirely
}

// Fallback matching (lines 71-79)
if (distance >= -50 && distance < 1000) {
  // Pure location-based matching without name validation
}
```

## Solution Approach

Replace permissive distance/name matching with **containment-based matching**:

1. A function's body scope location must **contain** the function's body
2. The scope must start at or immediately after the function's declaration
3. Name matching should be exact, not fuzzy
4. Fallback to smallest containing scope if exact match fails

### Proposed Algorithm

```typescript
function find_body_scope_for_definition(
  capture: CaptureNode,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  def_name: SymbolName,
  def_location: Location,
): ScopeId {
  const callable_scopes = Array.from(scopes.values()).filter(scope =>
    scope.type === "function" || scope.type === "method" || scope.type === "constructor"
  );

  // Strategy 1: Find scope with exact name match that contains the definition
  for (const scope of callable_scopes) {
    if (scope.name === def_name && scope_starts_at_or_after(scope, def_location)) {
      return scope.id;
    }
  }

  // Strategy 2: Find smallest containing function scope
  let best_match: LexicalScope | undefined;
  let smallest_size = Infinity;

  for (const scope of callable_scopes) {
    if (scope_contains(scope.location, def_location)) {
      const size = scope_size(scope.location);
      if (size < smallest_size) {
        smallest_size = size;
        best_match = scope;
      }
    }
  }

  if (best_match) {
    return best_match.id;
  }

  throw new Error(`No body scope found for ${def_name} at ${location_to_string(def_location)}`);
}
```

## Implementation Plan

### Step 1: Add Test Cases

Create test cases that expose the current bug:

- Multiple functions with similar locations
- Nested functions
- Anonymous functions at different positions

### Step 2: Implement Containment-Based Matching

Modify `find_body_scope_for_definition` to use containment-based matching instead of distance-based matching.

### Step 3: Validate

- Run existing tests to ensure no regression
- Run diagnostic tests to verify each function gets unique `body_scope_id`

## Files to Modify

- `packages/core/src/index_single_file/scopes/scopes.utils.ts` - Primary fix location

## Success Criteria

1. Each function gets a unique `body_scope_id`
2. No regression in existing tests
3. Scope matching is deterministic and reliable

## Dependencies

- Part of Task 11.162 investigation
- Independent fix that can be implemented separately

## Priority

Medium - This is a correctness issue but not the primary cause of the false positives (which is import resolution in Task 11.162).
