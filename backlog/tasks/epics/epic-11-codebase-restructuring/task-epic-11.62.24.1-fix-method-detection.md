# Task 11.62.24.1: Fix Method Detection in method_hierarchy_resolver.ts

**Parent Task:** 11.62.24 - Fix method_hierarchy_resolver.ts type issues  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 1 hour  
**Dependencies:** Task 11.62.23 (Update class_hierarchy types)  
**Created:** 2025-09-01  

## Summary

Fix the broken method detection logic in method_hierarchy_resolver.ts that tries to access non-existent `members` field on Def type.

## Problem Analysis

### Current Broken Code (Lines 111-121)

```typescript
function class_has_method(class_info: ClassInfo): boolean {
  const def = class_info.definition;
  if (def.members) {  // ERROR: Property 'members' does not exist on type 'Def'
    return def.members.some(member => 
      member.symbol_kind === 'method' &&  
      member.symbol_name === method_name
    );
  }
  return false;
}
```

### Root Cause

The Def type doesn't have:
- `members` array
- `symbol_kind` on members
- `symbol_name` on members

## Solution Options

### Option A: Use ClassNode from Shared Types

If class_hierarchy.ts is updated to use shared types:

```typescript
function class_has_method(class_node: ClassNode, method_name: string): boolean {
  // ClassNode has methods as a Map
  return class_node.methods.has(method_name);
}
```

### Option B: Extract Methods from Def

If still using Def internally:

```typescript
function class_has_method(class_info: ClassInfo, method_name: string): boolean {
  // Need a way to get methods from a class Def
  // This might require parsing or external method provider
  const methods = get_class_methods(class_info.definition);
  return methods.some(m => m.name === method_name);
}

function get_class_methods(class_def: Def): MethodInfo[] {
  // Implementation depends on how methods are stored
  // Might need to:
  // 1. Look up in a separate methods registry
  // 2. Parse from AST
  // 3. Use metadata attached to Def
  return [];
}
```

### Option C: Pass Method Provider

Make the resolver accept a method provider function:

```typescript
interface MethodProvider {
  get_methods(class_def: Def): MethodInfo[];
}

function class_has_method(
  class_info: ClassInfo, 
  method_name: string,
  method_provider: MethodProvider
): boolean {
  const methods = method_provider.get_methods(class_info.definition);
  return methods.some(m => m.name === method_name);
}
```

## Recommended Solution

Use **Option A** if class_hierarchy is updated to shared types, otherwise **Option C** for flexibility.

## Implementation Steps

1. **Update function signature**
   ```typescript
   function class_has_method(
     class_info: ClassInfo | ClassNode,
     method_name: string
   ): boolean
   ```

2. **Add type guard**
   ```typescript
   function is_class_node(info: any): info is ClassNode {
     return 'methods' in info && info.methods instanceof Map;
   }
   ```

3. **Implement detection logic**
   ```typescript
   function class_has_method(
     class_info: ClassInfo | ClassNode,
     method_name: string
   ): boolean {
     if (is_class_node(class_info)) {
       // New path: Use ClassNode.methods Map
       return class_info.methods.has(method_name);
     } else {
       // Legacy path: Need another way to get methods
       // For now, return false or throw error
       console.warn('Cannot detect methods from ClassInfo with Def');
       return false;
     }
   }
   ```

4. **Update callers**
   - resolve_method_in_hierarchy
   - get_available_methods
   - Any other functions using class_has_method

## Testing Requirements

1. Test with ClassNode (shared type)
2. Test with ClassInfo (legacy type)
3. Test method found/not found cases
4. Test with inherited methods
5. Test with interface methods

## Acceptance Criteria

- [ ] Method detection works without accessing non-existent fields
- [ ] No TypeScript errors in method detection
- [ ] Works with both ClassNode and ClassInfo (if needed)
- [ ] Correctly identifies methods by name
- [ ] Handles edge cases (no methods, null checks)

## Related Code Sections

- Lines 111-121: class_has_method function
- Line 139: Usage in resolve_recursive
- Line 165: Usage for interface methods
- Line 276: Usage in collect_methods

## Next Steps

- Task 11.62.24.2: Fix interface detection
- Task 11.62.24.3: Fix symbol ID access
- Task 11.62.24.4: Update method resolution logic