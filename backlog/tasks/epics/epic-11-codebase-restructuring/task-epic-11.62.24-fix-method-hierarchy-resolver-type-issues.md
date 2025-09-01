# Task 11.62.24: Fix method_hierarchy_resolver.ts Type Issues

**Status:** Not Started  
**Assignee:** Unassigned  
**Priority:** Critical  
**Estimated Effort:** 2 hours  
**Dependencies:** Task 11.62.23 (Update class_hierarchy.ts)  
**Created:** 2025-09-01  

## Summary

Fix type issues in `method_hierarchy_resolver.ts` caused by the generic `Def` type lacking necessary fields. Update to work with the properly typed `ClassDefinition` from the updated class_hierarchy module.

## Problem Statement

The `method_hierarchy_resolver.ts` module has multiple type errors:

1. **Line 114:** Tries to access `def.members` which doesn't exist on `Def`
2. **Line 116:** Accesses `member.symbol_kind` which doesn't exist
3. **Line 117:** Accesses `member.symbol_name` which doesn't exist
4. **Line 153:** Uses `symbol_kind === 'interface'` but field doesn't exist
5. **Line 164:** Accesses `symbol_id` on generic `Def`

## Research & Analysis

### Current Broken Code

```typescript
// Lines 111-121: Broken method detection
function class_has_method(class_info: ClassInfo): boolean {
  const def = class_info.definition;
  if (def.members) {  // ERROR: Property 'members' does not exist on type 'Def'
    return def.members.some(member => 
      member.symbol_kind === 'method' &&  // ERROR: These fields don't exist
      member.symbol_name === method_name
    );
  }
  return false;
}
```

### Root Cause

The module imports `ClassInfo` from the old class_hierarchy which uses `Def`. After Task 11.62.23, `ClassInfo` will use `ClassDefinition` which has proper fields.

## Solution Design

### 1. Update Imports

```typescript
import { 
  MethodCallInfo,
  ClassDefinition,
  InterfaceDefinition,
  MethodDefinition 
} from '@ariadnejs/types';
import { 
  ClassHierarchy, 
  ClassInfo 
} from '../../inheritance/class_hierarchy';
```

### 2. Fix Method Detection

```typescript
function class_has_method(
  class_info: ClassInfo, 
  method_name: string
): boolean {
  // ClassDefinition has methods array
  return class_info.definition.methods.some(
    method => method.name === method_name
  );
}
```

### 3. Fix Interface Detection

```typescript
// Line 153: Check if definition is an interface
is_interface_method: class_info.definition instanceof InterfaceDefinition
// OR use a type guard
is_interface_method: 'extends' in class_info.definition && 
                     !('methods' in class_info.definition)
```

### 4. Fix Symbol ID Access

```typescript
// Generate symbol ID from ClassDefinition
function get_symbol_id(def: ClassDefinition): string {
  return `${def.file_path}#${def.name}`;
}

// Line 164: Use proper symbol ID
const interface_info = hierarchy.classes.get(
  get_symbol_id(interface_def)
);
```

### 5. Update Method Resolution

```typescript
export function resolve_method_in_hierarchy(
  class_name: string,
  method_name: string,
  hierarchy: ClassHierarchy
): MethodResolution | undefined {
  // ... existing code ...
  
  // Helper now properly typed
  function class_has_method(class_info: ClassInfo): boolean {
    return class_info.definition.methods.some(
      method => method.name === method_name
    );
  }
  
  // Check interface implementation properly
  for (const interface_def of class_info.interface_defs) {
    const interface_key = `${interface_def.file_path}#${interface_def.name}`;
    const interface_info = hierarchy.classes.get(interface_key);
    
    if (interface_info) {
      // InterfaceDefinition has methods array
      const has_method = interface_def.methods.some(
        method => method.name === method_name
      );
      
      if (has_method) {
        return {
          defining_class: interface_def.name,
          is_override: false,
          override_chain: [interface_def.name],
          is_interface_method: true
        };
      }
    }
  }
  
  return undefined;
}
```

### 6. Update Available Methods Collection

```typescript
function collect_methods(current_class: string) {
  const class_info = hierarchy.classes.get(current_class);
  if (!class_info) return;
  
  // Add methods from ClassDefinition
  for (const method of class_info.definition.methods) {
    if (!methods.has(method.name)) {
      methods.set(method.name, current_class);
    }
  }
  
  // ... rest of the function
}
```

## Implementation Steps

1. **Wait for Task 11.62.23** to complete (class_hierarchy updates)
2. **Update imports** to use new types
3. **Fix all method detection** to use `definition.methods`
4. **Fix interface checks** to use proper type checking
5. **Update symbol ID generation** and usage
6. **Remove all references** to non-existent fields
7. **Add type assertions** where needed
8. **Update tests** with proper types

## Acceptance Criteria

- [ ] No type errors in method_hierarchy_resolver.ts
- [ ] Method detection uses ClassDefinition.methods
- [ ] Interface detection works properly
- [ ] Symbol IDs generated correctly
- [ ] All tests pass
- [ ] Integration with updated class_hierarchy works

## Benefits

1. **Type Safety:** No more accessing non-existent fields
2. **Cleaner Code:** Direct access to methods array
3. **Better Performance:** No need for existence checks
4. **Maintainability:** Clear, typed interfaces
5. **Reliability:** Compile-time type checking

## Testing Plan

1. Test method resolution with real ClassDefinition data
2. Test interface method detection
3. Test virtual method analysis
4. Test method inheritance chains
5. Verify all enrichment functions work

## Implementation Notes

_To be filled during implementation_

## Completion Checklist

- [ ] All type errors resolved
- [ ] Method detection updated
- [ ] Interface checks fixed
- [ ] Symbol ID generation working
- [ ] Tests updated and passing
- [ ] Integration verified with class_hierarchy