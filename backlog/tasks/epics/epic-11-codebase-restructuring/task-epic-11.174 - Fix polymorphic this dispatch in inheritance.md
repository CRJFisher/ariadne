---
id: task-epic-11.174
title: Fix polymorphic this dispatch in inheritance
status: To Do
assignee: []
created_date: '2026-01-20'
labels:
  - bug
  - call-graph
  - epic-11
dependencies: []
---

## Description

When a base class method calls `this.methodName()`, and a child class overrides that method, the call graph fails to connect the base class call site to the child class implementation. This causes overridden methods to incorrectly appear as entry points.

This was identified during the entrypoint self-analysis pipeline as the **method-call-via-this-not-tracked** false positive group (2 entries).

## Problem

### Current Behavior

Two methods in `javascript_typescript_scope_boundary_extractor.ts` appear as false positive entry points:

1. `extract_constructor_boundaries` at line 196
2. `extract_block_boundaries` at line 204

### Root Cause

The base class `CommonScopeBoundaryExtractor.extract_boundaries()` calls `this.extract_constructor_boundaries()`:

```typescript
// boundary_base.ts:68-86
export class CommonScopeBoundaryExtractor implements ScopeBoundaryExtractor {
  extract_boundaries(node, scope_type, file_path): ScopeBoundaries {
    switch (scope_type) {
      case "constructor":
        return this.extract_constructor_boundaries(node, file_path);  // Line 80
      case "block":
        return this.extract_block_boundaries(node, file_path);        // Line 82
      // ...
    }
  }
}
```

The child class overrides these methods:

```typescript
// javascript_typescript_scope_boundary_extractor.ts:196-214
export abstract class JavaScriptTypeScriptScopeBoundaryExtractor
  extends CommonScopeBoundaryExtractor {

  protected extract_constructor_boundaries(node, file_path): ScopeBoundaries {
    return this.extract_function_boundaries(node, file_path);
  }

  protected extract_block_boundaries(node, file_path): ScopeBoundaries {
    // ...
  }
}
```

### The Gap

The current `this.method()` resolution in `self_reference.ts`:

1. Finds the enclosing class for the call site
2. Looks up the method in that class's member index
3. Does NOT traverse to child classes that override the method

For polymorphic dispatch through `this`:

- The call site is in `CommonScopeBoundaryExtractor`
- `this` could be any subclass at runtime
- The method might be overridden in a child class
- We need to resolve to ALL possible targets (base + all overriding children)

## Affected False Positives

1. `extract_constructor_boundaries` in `javascript_typescript_scope_boundary_extractor.ts:196`
2. `extract_block_boundaries` in `javascript_typescript_scope_boundary_extractor.ts:204`

## Acceptance Criteria

- [ ] `extract_constructor_boundaries` no longer appears as entry point
- [ ] `extract_block_boundaries` no longer appears as entry point
- [ ] `this.method()` calls in base classes resolve to child overrides
- [ ] All existing tests pass
- [ ] Test added for polymorphic this dispatch

## Proposed Solution

### Option A: Bidirectional Override Tracking

When resolving `this.methodName()`:

1. Resolve to the method in the current class (existing behavior)
2. Also find all child classes that override this method
3. Add edges to all override implementations

This requires:

- Building an "override graph" during type registration
- Walking subtypes to find overrides during method resolution

### Option B: Mark Overriding Methods as Called via Parent

When building the call graph:

1. For each `this.methodName()` call in a base class
2. Find all subtypes of that class
3. For each subtype, if it has an override of `methodName`, mark it as called

## Files to Modify

- `packages/core/src/resolve_references/call_resolution/self_reference.ts` - `this` resolution
- `packages/core/src/resolve_references/registries/type.ts` - Subtype tracking
- `packages/core/src/resolve_references/call_resolution/method_lookup.ts` - Polymorphic resolution

## Related

- Part of epic-11 codebase restructuring
- Builds on Task epic-11.163 (this/super call resolution) - completed but didn't fully address this
- Complements Task epic-11.167 (polymorphic factory calls) - completed but different pattern
