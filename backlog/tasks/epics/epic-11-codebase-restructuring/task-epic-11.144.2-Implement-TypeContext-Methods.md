# Task: Implement TypeContext Methods on TypeRegistry

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.144 - Merge TypeContext into TypeRegistry
**Status**: Completed
**Priority**: High
**Complexity**: Medium

## Overview

Add all TypeContext interface methods directly to TypeRegistry, using the SymbolId-based storage from task 11.144.1. This makes TypeRegistry a complete replacement for TypeContext.

## Context

The TypeContext interface defines these methods:
- `get_symbol_type(symbol_id)` - Get the type of a symbol
- `get_type_member(type_id, member_name)` - Get a member of a type
- `get_parent_class(class_id)` - Get parent class
- `get_implemented_interfaces(class_id)` - Get implemented interfaces
- `walk_inheritance_chain(class_id)` - Walk full inheritance chain
- `get_namespace_member(namespace_id, member_name)` - Get namespace member

We'll implement all except `get_namespace_member()` (complex, rare usage).

## Goals

1. Add all TypeContext methods to TypeRegistry
2. Implement inheritance walking with cycle detection
3. Implement member lookup with inheritance support
4. Add comprehensive tests for all methods
5. Ensure performance with direct map lookups

## Implementation

### 1. Add TypeContext Methods

Add to TypeRegistry class (after existing methods):

```typescript
export class TypeRegistry {
  // ... existing storage and methods ...

  // ===== TypeContext Interface Implementation =====

  /**
   * Get the type of a symbol (variable, parameter, etc.)
   *
   * Returns the SymbolId of the type (class, interface, etc.) that the symbol is typed as.
   *
   * Priority:
   * 1. Explicit type annotations (const x: Type)
   * 2. Constructor assignments (const x = new Type())
   * 3. Return types from function calls (future)
   *
   * @param symbol_id - The symbol to get the type for
   * @returns SymbolId of the type, or null if type unknown
   *
   * @example
   * ```typescript
   * const user: User = new User();
   * //    ^--- symbol_id
   * //           ^--- returned type_id
   * ```
   */
  get_symbol_type(symbol_id: SymbolId): SymbolId | null {
    return this.symbol_types.get(symbol_id) || null;
  }

  /**
   * Get a member (method/property) of a type by name.
   *
   * Walks the inheritance chain to find inherited members.
   *
   * Search order:
   * 1. Direct members of the type
   * 2. Members of parent class (recursively)
   * 3. Members of implemented interfaces
   *
   * @param type_id - The type to look up members in
   * @param member_name - The member name to find
   * @returns SymbolId of the member, or null if not found
   *
   * @example
   * ```typescript
   * class Animal { speak() {} }
   * class Dog extends Animal { bark() {} }
   *
   * get_type_member(dog_id, "bark")  → dog.bark symbol_id
   * get_type_member(dog_id, "speak") → animal.speak symbol_id (inherited)
   * ```
   */
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null {
    // Walk inheritance chain from most derived to base
    const chain = this.walk_inheritance_chain(type_id);

    for (const class_id of chain) {
      // Check direct members first
      const members = this.resolved_type_members.get(class_id);
      if (members) {
        const member_id = members.get(member_name);
        if (member_id) {
          return member_id;
        }
      }

      // Check implemented interfaces
      const interfaces = this.implemented_interfaces.get(class_id) || [];
      for (const interface_id of interfaces) {
        const interface_members = this.resolved_type_members.get(interface_id);
        if (interface_members) {
          const member_id = interface_members.get(member_name);
          if (member_id) {
            return member_id;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the parent class of a class (from extends clause).
   *
   * @param class_id - The class to get parent for
   * @returns SymbolId of parent class, or null if no parent
   *
   * @example
   * ```typescript
   * class Dog extends Animal { }
   * get_parent_class(dog_id) → animal_id
   * ```
   */
  get_parent_class(class_id: SymbolId): SymbolId | null {
    return this.parent_classes.get(class_id) || null;
  }

  /**
   * Get implemented interfaces for a class.
   *
   * Note: In TypeScript, interfaces in extends clause (after first) are treated as
   * implemented interfaces.
   *
   * @param class_id - The class to get interfaces for
   * @returns Array of interface SymbolIds
   *
   * @example
   * ```typescript
   * class Duck implements Flyable, Swimmable { }
   * get_implemented_interfaces(duck_id) → [flyable_id, swimmable_id]
   * ```
   */
  get_implemented_interfaces(class_id: SymbolId): readonly SymbolId[] {
    return this.implemented_interfaces.get(class_id) || [];
  }

  /**
   * Walk the full inheritance chain from most derived to base.
   *
   * Returns array starting with the class itself, followed by parent,
   * grandparent, etc. Handles circular inheritance gracefully (stops at cycle).
   *
   * @param class_id - The class to start from
   * @returns Array of SymbolIds in inheritance chain
   *
   * @example
   * ```typescript
   * class Animal { }
   * class Mammal extends Animal { }
   * class Dog extends Mammal { }
   *
   * walk_inheritance_chain(dog_id) → [dog_id, mammal_id, animal_id]
   * ```
   */
  walk_inheritance_chain(class_id: SymbolId): readonly SymbolId[] {
    const chain: SymbolId[] = [class_id];
    const seen = new Set<SymbolId>([class_id]);
    let current = class_id;

    // Walk up extends chain
    while (true) {
      const parent = this.parent_classes.get(current);
      if (!parent) break;

      // Detect cycles (shouldn't happen in valid code, but be defensive)
      if (seen.has(parent)) {
        console.warn(`Circular inheritance detected: ${class_id} → ${parent}`);
        break;
      }

      chain.push(parent);
      seen.add(parent);
      current = parent;
    }

    return chain;
  }

  /**
   * Get a member of a namespace import by name.
   *
   * TODO: Not implemented yet. Requires ImportGraph + ExportRegistry integration.
   *
   * This is a complex operation that requires:
   * 1. Determining the source file for the namespace import
   * 2. Looking up the exported symbol in that file
   * 3. Resolving the symbol in the file's scope
   *
   * @param namespace_id - The namespace symbol (from import resolution)
   * @param member_name - The member name to find
   * @returns SymbolId of the member, or null if not found
   */
  get_namespace_member(
    _namespace_id: SymbolId,
    _member_name: SymbolName
  ): SymbolId | null {
    // TODO: Implement namespace member resolution
    // For now, return null - this is a rare edge case
    return null;
  }
}
```

### 2. Add Helper Methods (Optional)

You may want private helpers:

```typescript
/**
 * Check if a type has a direct member (no inheritance).
 * Private helper for get_type_member().
 */
private has_direct_member(type_id: SymbolId, member_name: SymbolName): boolean {
  const members = this.resolved_type_members.get(type_id);
  return members ? members.has(member_name) : false;
}

/**
 * Get all members of a type (direct only, no inheritance).
 * Useful for debugging and testing.
 */
get_direct_members(type_id: SymbolId): ReadonlyMap<SymbolName, SymbolId> | null {
  return this.resolved_type_members.get(type_id) || null;
}
```

## Testing

Add comprehensive tests in `type_registry.test.ts`:

```typescript
describe("TypeRegistry - TypeContext Methods", () => {
  describe("get_symbol_type", () => {
    it("should return type from explicit annotation", () => {
      // const user: User = ...
      // Verify get_symbol_type(user_symbol) returns User class
    });

    it("should return type from constructor assignment", () => {
      // const user = new User()
      // Verify get_symbol_type(user_symbol) returns User class
    });

    it("should return null for untyped symbols", () => {
      // const x = 42
      // Verify get_symbol_type(x_symbol) returns null
    });
  });

  describe("get_type_member", () => {
    it("should find direct members", () => {
      // class User { getName() {} }
      // Verify get_type_member(user_class, "getName") returns method
    });

    it("should find inherited members", () => {
      // class Animal { speak() {} }
      // class Dog extends Animal {}
      // Verify get_type_member(dog_class, "speak") returns animal.speak
    });

    it("should find interface members", () => {
      // interface Named { getName() }
      // class User implements Named { getName() {} }
      // Verify get_type_member works
    });

    it("should return null for non-existent members", () => {
      // class User {}
      // Verify get_type_member(user_class, "nonExistent") returns null
    });

    it("should prefer direct members over inherited", () => {
      // class Animal { speak() {} }
      // class Dog extends Animal { speak() {} }  // Override
      // Verify get_type_member(dog_class, "speak") returns dog.speak, not animal.speak
    });
  });

  describe("get_parent_class", () => {
    it("should return parent class", () => {
      // class Dog extends Animal {}
      // Verify get_parent_class(dog_class) returns animal_class
    });

    it("should return null for classes with no parent", () => {
      // class Animal {}
      // Verify get_parent_class(animal_class) returns null
    });
  });

  describe("get_implemented_interfaces", () => {
    it("should return all implemented interfaces", () => {
      // class Duck implements Flyable, Swimmable {}
      // Verify returns [flyable_id, swimmable_id]
    });

    it("should return empty array for classes with no interfaces", () => {
      // class Animal {}
      // Verify returns []
    });
  });

  describe("walk_inheritance_chain", () => {
    it("should return full inheritance chain", () => {
      // class Animal {}
      // class Mammal extends Animal {}
      // class Dog extends Mammal {}
      // Verify returns [dog_id, mammal_id, animal_id]
    });

    it("should include only the class itself if no parent", () => {
      // class Animal {}
      // Verify returns [animal_id]
    });

    it("should handle circular inheritance gracefully", () => {
      // Create artificial circular inheritance in test
      // Verify doesn't infinite loop, returns partial chain
    });
  });

  describe("get_namespace_member", () => {
    it("should return null (not implemented)", () => {
      // Just verify it returns null without crashing
      const result = registry.get_namespace_member(
        "any" as SymbolId,
        "any" as SymbolName
      );
      expect(result).toBeNull();
    });
  });
});
```

## Verification

After completing this task:

1. **All methods implemented**: 6 TypeContext methods on TypeRegistry
2. **Inheritance works**: walk_inheritance_chain() correctly traverses parents
3. **Member lookup works**: get_type_member() finds inherited members
4. **Tests pass**: All new tests passing
5. **No breaking changes**: Existing functionality still works

## Success Criteria

- [ ] `get_symbol_type()` implemented and tested
- [ ] `get_type_member()` implemented with inheritance support
- [ ] `get_parent_class()` implemented and tested
- [ ] `get_implemented_interfaces()` implemented and tested
- [ ] `walk_inheritance_chain()` implemented with cycle detection
- [ ] `get_namespace_member()` stubbed (returns null)
- [ ] Comprehensive tests for all methods
- [ ] All tests passing
- [ ] Member lookup finds inherited members correctly
- [ ] Circular inheritance handled gracefully

## Notes

- TypeRegistry now implements the TypeContext interface (functionally, not formally)
- Uses SymbolId-based storage from task 11.144.1
- `get_namespace_member()` left as TODO - complex and rarely used
- Next task (11.144.3) will integrate this into Project flow
- After that, we can delete the TypeContext interface entirely

## Dependencies

- **Requires**: task-epic-11.144.1 completed (needs SymbolId storage)
- **Blocks**: task-epic-11.144.3 (Project integration needs these methods)

## Estimated Effort

- Implementation: 2-2.5 hours
- Testing: 1.5-2 hours
- **Total**: 3.5-4.5 hours
