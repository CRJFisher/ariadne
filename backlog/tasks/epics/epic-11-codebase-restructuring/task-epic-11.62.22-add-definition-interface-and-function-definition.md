# Task 11.62.22: Add Common Definition Interface and FunctionDefinition Type

**Status:** Not Started  
**Assignee:** Unassigned  
**Priority:** Critical  
**Estimated Effort:** 2 hours  
**Dependencies:** None (foundational task)  
**Created:** 2025-09-01  

## Summary

Create a common `Definition` interface that all entity-specific definition types extend, and add the missing `FunctionDefinition` type to the type system. This provides a foundation for properly typed class hierarchy processing.

## Problem Statement

The current type system has several critical gaps:

1. **No FunctionDefinition type** - Functions use `FunctionInfo` but there's no corresponding definition type
2. **No common interface** - Definition types (ClassDefinition, MethodDefinition, etc.) don't share a common base
3. **Generic Def type is too weak** - The current `Def` type loses all rich metadata
4. **Type fragmentation** - Can't handle collections of mixed definition types cleanly

## Research & Analysis

### Current State

**Existing Definition Types in `/packages/types/src/definitions.ts`:**
- `ClassDefinition` - Rich class metadata
- `MethodDefinition` - Method within a class
- `PropertyDefinition` - Class property
- `InterfaceDefinition` - Interface/protocol
- `EnumDefinition` - Enum types
- `TypeAliasDefinition` - Type aliases
- `StructDefinition` - Rust structs
- `TraitDefinition` - Rust traits
- `ProtocolDefinition` - Python protocols

**Missing:**
- `FunctionDefinition` - Standalone functions
- Common `Definition` interface

**Current Def Type (too generic):**
```typescript
interface Def {
  readonly name: string;
  readonly kind: 'function' | 'class' | 'variable' | 'type' | 'method' | 'property';
  readonly location: Location;
  readonly file_path: string;
  readonly language: Language;
}
```

## Solution Design

### 1. Common Definition Interface

Create a base interface that all definition types extend:

```typescript
// Base definition interface - shared by all entity types
export interface Definition {
  readonly name: string;
  readonly location: Location;
  readonly file_path: string;
  readonly language: Language;
  // Note: No 'kind' field - the type itself indicates the kind
}
```

### 2. FunctionDefinition Type

Add the missing function definition type:

```typescript
export interface FunctionDefinition extends Definition {
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: string;
  readonly is_async: boolean;
  readonly is_generator: boolean;
  readonly is_exported: boolean;
  readonly generics?: readonly GenericParameter[];
  readonly decorators?: readonly string[];
  readonly docstring?: string;
  readonly is_arrow_function?: boolean; // For JS/TS
  readonly is_anonymous?: boolean;
  readonly closure_captures?: readonly string[]; // Variables from outer scope
}
```

### 3. Update Existing Types

All existing definition types should extend the base:

```typescript
export interface ClassDefinition extends Definition {
  // ... existing fields
}

export interface InterfaceDefinition extends Definition {
  // ... existing fields
}

// etc. for all definition types
```

### 4. Discriminated Union Type

For cases where we need to handle mixed definitions:

```typescript
export type AnyDefinition = 
  | FunctionDefinition
  | ClassDefinition
  | InterfaceDefinition
  | EnumDefinition
  | TypeAliasDefinition
  | StructDefinition
  | TraitDefinition
  | ProtocolDefinition;

// Type guards for runtime checks
export function isFunctionDefinition(def: Definition): def is FunctionDefinition {
  return 'parameters' in def && 'is_async' in def;
}

export function isClassDefinition(def: Definition): def is ClassDefinition {
  return 'methods' in def && 'properties' in def;
}

// ... more type guards
```

## Implementation Steps

1. **Update `/packages/types/src/definitions.ts`:**
   - Add `Definition` base interface
   - Add `FunctionDefinition` interface
   - Update all existing definition types to extend `Definition`
   - Add `AnyDefinition` union type
   - Add type guard functions

2. **Export new types:**
   - Ensure proper exports in `/packages/types/src/index.ts`

3. **Update tests:**
   - Add tests for new types
   - Ensure type guards work correctly

## Acceptance Criteria

- [ ] Common `Definition` interface exists and is exported
- [ ] `FunctionDefinition` type exists with all necessary fields
- [ ] All existing definition types extend `Definition`
- [ ] `AnyDefinition` union type is available
- [ ] Type guards are implemented and tested
- [ ] No breaking changes to existing code
- [ ] Types compile without errors

## Benefits

1. **Type Safety:** Proper typing instead of generic `Def`
2. **Rich Metadata:** Access to all entity-specific fields
3. **Flexibility:** Can handle collections of mixed definitions
4. **Future-Proof:** Easy to add new definition types
5. **Better IDE Support:** Proper autocomplete and type checking

## Testing Plan

1. Compile the types package
2. Create test instances of each definition type
3. Verify type guards work correctly
4. Ensure backward compatibility

## Related Tasks

- **Next:** Task 11.62.23 - Update class_hierarchy.ts to use ClassDefinition
- **Blocks:** All subsequent class hierarchy integration tasks

## Implementation Notes

_To be filled during implementation_

## Completion Checklist

- [ ] Code implemented
- [ ] Tests written and passing
- [ ] Types compile without errors
- [ ] Documentation updated
- [ ] No regression in existing functionality