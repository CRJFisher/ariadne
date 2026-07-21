# Task 11.164: Track Object Literal and Property Method Calls

## Status: Planning

## Parent: epic-11-codebase-restructuring

## Overview

Method calls on object literals and class properties are not being tracked correctly, causing false positive entry points.

## False Positive Groups Addressed

This task addresses the following false positive groups from `top-level-nodes-analysis/results/false_positive_groups.json`:

1. **object-literal-internal-method-calls-not-tracked** (2 entries)
   - Calls between methods in the same object literal using `OBJECT_NAME.method()`
   - Example: `extract_receiver_info` calling `JAVASCRIPT_METADATA_EXTRACTORS.extract_property_chain`

2. **class-property-method-calls-not-tracked** (17 entries)
   - `this.property.method()` calls not tracked
   - Example: `this.imports.update_file()` in `Project` class calling `ImportGraph.update_file`

## Root Cause Analysis

### Object Literal Internal Calls

When an object literal method calls a sibling method using the full object name:

```typescript
const MY_OBJECT = {
  method_a() {
    return MY_OBJECT.method_b(); // Call not tracked
  },
  method_b() { ... }
};
```

The call is not tracked because:
1. The receiver `MY_OBJECT` is not recognized as referring to the containing object
2. No type information links the call site to the method definition

### Class Property Method Calls

When a class calls methods on its properties:

```typescript
class Project {
  imports: ImportGraph;

  update() {
    this.imports.update_file(...); // Call not tracked
  }
}
```

The call is not tracked because:
1. `this.imports` resolves to a property, not a direct type
2. The method `update_file` is on `ImportGraph`, not `Project`
3. Property type → method resolution chain is incomplete

## Solution Approach

### Phase 1: Object Literal Self-Reference Detection

Track when object literal methods reference their containing object:

1. When building semantic index, record the variable name assigned to object literals
2. When extracting calls, check if receiver matches containing object name
3. Resolve call to sibling method in same object literal

### Phase 2: Property Type Method Resolution

Resolve method calls through property types:

1. For `this.property.method()`, first resolve `this.property` to get its type
2. Then resolve `method` on that type
3. Chain: `this` → class → property → property_type → method

### Phase 3: Member Access Chain Resolution

Handle arbitrary depth member access chains:

```typescript
this.a.b.c.method()  // Resolve through a → type_of_a.b → type_of_b.c → type_of_c.method
```

## Implementation Plan

### 11.164.1: Enhance Object Literal Tracking

- Track object literal variable bindings in definitions
- Detect self-referential calls within object literal methods
- Add resolution for `OBJECT_NAME.method()` pattern

### 11.164.2: Implement Property Type Method Resolution

- Resolve `this.property` to get property type
- Chain property type → type members → method lookup
- Handle readonly/private property types

### 11.164.3: Implement Member Access Chain Resolution

- Walk member access chains left to right
- Resolve type at each step
- Final step resolves method on terminal type

### 11.164.4: Update Tests

- Fixtures for object literal internal calls
- Fixtures for class property method calls
- Fixtures for deep member access chains

## Files to Modify

- `packages/core/src/resolve_references/call_resolution/method_resolver.ts`
- `packages/core/src/resolve_references/registries/type_registry.ts`
- `packages/core/src/index_single_file/definitions/definition_builder.ts`

## Success Criteria

1. All 19 false positive entries are eliminated
2. Object literal internal method calls resolve correctly
3. Class property method calls resolve correctly
4. All tests pass

## Dependencies

- Requires type registry for property type lookups
- Complements Task 11.163 (this/super calls)
- May require enhancements from Task 11.91.3 (method resolution)

## Priority

High - 17 entries from class-property-method-calls-not-tracked makes this a significant contributor to false positives.
