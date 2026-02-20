# Task Epic 11.113: Implement Inheritance Walking for Method Resolution

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 2-3 days
**Parent:** epic-11
**Dependencies:**
- task-epic-11.109 (Scope-Aware Symbol Resolution - provides infrastructure)
- task-epic-11.111 (Semantic Index Scope Bug Fix - ensures type resolution works)

## Objective

Enhance method resolution to walk inheritance hierarchies, finding methods defined in parent classes and implemented interfaces when not found directly on a type.

## Problem Statement

### Current Limitation

From task-epic-11.109.6 (Method Resolution):

**Current behavior:**
```typescript
class Base {
  baseMethod() {}
}

class Derived extends Base {
  derivedMethod() {}
}

const obj = new Derived();
obj.baseMethod();  // Does NOT resolve (limitation)
obj.derivedMethod();  // Resolves correctly
```

**Reason:** Method lookup only checks direct members of the class, not inherited members.

### What We Need

**Target behavior:**
```typescript
class Base {
  baseMethod() {}
}

class Derived extends Base {
  derivedMethod() {}
}

const obj = new Derived();
obj.baseMethod();  // Should resolve to Base.baseMethod
obj.derivedMethod();  // Should resolve to Derived.derivedMethod
```

## Implementation Plan

### Phase 1: Inheritance Chain Building (1 day)

**Build inheritance hierarchy during TypeContext construction**

#### File: `packages/core/src/resolve_references/type_resolution/type_context.ts`

1. **Add inheritance tracking:**
   ```typescript
   interface TypeContext {
     // Existing
     get_symbol_type(symbol_id: SymbolId): SymbolId | null;
     get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null;

     // NEW: Inheritance queries
     get_parent_class(class_id: SymbolId): SymbolId | null;
     get_implemented_interfaces(class_id: SymbolId): SymbolId[];
     walk_inheritance_chain(class_id: SymbolId): SymbolId[];
   }
   ```

2. **Extract inheritance during building:**
   ```typescript
   function build_type_context(
     indices: ReadonlyMap<FilePath, SemanticIndex>,
     resolver_index: ScopeResolverIndex,
     cache: ResolutionCache
   ): TypeContext {
     const parent_classes = new Map<SymbolId, SymbolId>();
     const implemented_interfaces = new Map<SymbolId, SymbolId[]>();

     for (const index of indices.values()) {
       for (const [class_id, class_def] of index.classes) {
         // Extract extends clause
         if (class_def.type_members?.extends) {
           const extends_name = class_def.type_members.extends[0];
           if (extends_name) {
             const parent_id = resolve_type_name(
               extends_name,
               class_def.scope_id,
               resolver_index,
               cache
             );
             if (parent_id) {
               parent_classes.set(class_id, parent_id);
             }
           }
         }

         // Extract implements clause
         if (class_def.type_members?.implements) {
           const interface_ids: SymbolId[] = [];
           for (const interface_name of class_def.type_members.implements) {
             const interface_id = resolve_type_name(
               interface_name,
               class_def.scope_id,
               resolver_index,
               cache
             );
             if (interface_id) {
               interface_ids.push(interface_id);
             }
           }
           if (interface_ids.length > 0) {
             implemented_interfaces.set(class_id, interface_ids);
           }
         }
       }
     }

     return {
       // ... existing methods

       get_parent_class: (class_id) =>
         parent_classes.get(class_id) || null,

       get_implemented_interfaces: (class_id) =>
         implemented_interfaces.get(class_id) || [],

       walk_inheritance_chain: (class_id) => {
         const chain: SymbolId[] = [class_id];
         let current = class_id;

         // Walk up extends chain
         while (true) {
           const parent = parent_classes.get(current);
           if (!parent) break;

           // Detect cycles
           if (chain.includes(parent)) break;

           chain.push(parent);
           current = parent;
         }

         return chain;
       }
     };
   }
   ```

3. **Test inheritance tracking:**
   ```typescript
   describe('TypeContext - Inheritance', () => {
     it('tracks extends relationships', () => {
       const code = `
         class Base {}
         class Derived extends Base {}
       `;
       const type_context = build_type_context(...);

       const derived_id = find_class(index, 'Derived');
       const base_id = find_class(index, 'Base');

       expect(type_context.get_parent_class(derived_id)).toBe(base_id);
     });

     it('walks full inheritance chain', () => {
       const code = `
         class A {}
         class B extends A {}
         class C extends B {}
       `;
       const type_context = build_type_context(...);

       const c_id = find_class(index, 'C');
       const b_id = find_class(index, 'B');
       const a_id = find_class(index, 'A');

       const chain = type_context.walk_inheritance_chain(c_id);
       expect(chain).toEqual([c_id, b_id, a_id]);
     });
   });
   ```

### Phase 2: Member Lookup with Inheritance (1 day)

**Update member lookup to check parent classes**

#### File: `packages/core/src/resolve_references/type_resolution/type_context.ts`

1. **Enhance `get_type_member()` to walk inheritance:**
   ```typescript
   function get_type_member(
     type_id: SymbolId,
     member_name: SymbolName
   ): SymbolId | null {
     // Walk inheritance chain from most derived to base
     const chain = walk_inheritance_chain(type_id);

     for (const class_id of chain) {
       // Check direct members first
       const direct_member = find_direct_member(class_id, member_name);
       if (direct_member) {
         return direct_member;
       }

       // Check implemented interfaces
       const interfaces = get_implemented_interfaces(class_id);
       for (const interface_id of interfaces) {
         const interface_member = find_direct_member(interface_id, member_name);
         if (interface_member) {
           return interface_member;
         }
       }
     }

     return null;
   }

   function find_direct_member(
     class_id: SymbolId,
     member_name: SymbolName
   ): SymbolId | null {
     const class_def = find_class_by_id(class_id);
     if (!class_def) return null;

     // Check methods
     for (const method of class_def.methods) {
       if (method.name === member_name) {
         return method.symbol_id;
       }
     }

     // Check properties
     for (const prop of class_def.properties || []) {
       if (prop.name === member_name) {
         return prop.symbol_id;
       }
     }

     return null;
   }
   ```

2. **Handle method overrides:**
   ```typescript
   // Most derived class wins (already handled by chain order)
   class Base {
     method() {}  // Base implementation
   }

   class Derived extends Base {
     method() {}  // Override - this one wins
   }
   ```

3. **Handle interface members:**
   ```typescript
   interface IComparable {
     compareTo(): number;
   }

   class MyClass implements IComparable {
     compareTo() { return 0; }  // Implementation wins
   }

   // But if not implemented:
   class MyClass implements IComparable {
     // compareTo should still resolve to interface declaration
   }
   ```

### Phase 3: Language-Specific Handling (4-8 hours)

#### TypeScript

- Multiple interface implementation
- Interface extends interface
- Abstract classes

#### Python

- Multiple inheritance (MRO - Method Resolution Order)
- Mixins
- `super()` calls

#### Rust

- Trait implementations
- Default trait methods
- Trait bounds

#### JavaScript

- Prototype chain (limited support)
- Class expressions

### Phase 4: Testing (4-8 hours)

#### Test Suite: `method_resolver_inheritance.test.ts`

1. **Simple inheritance:**
   ```typescript
   it('resolves method from parent class', () => {
     const code = `
       class Base {
         baseMethod() {}
       }
       class Derived extends Base {}

       const obj = new Derived();
       obj.baseMethod();  // Should resolve
     `;
   });
   ```

2. **Multi-level inheritance:**
   ```typescript
   it('resolves method from grandparent class', () => {
     const code = `
       class A {
         methodA() {}
       }
       class B extends A {}
       class C extends B {}

       const obj = new C();
       obj.methodA();  // Should resolve to A.methodA
     `;
   });
   ```

3. **Method override:**
   ```typescript
   it('uses most derived implementation', () => {
     const code = `
       class Base {
         method() {}  // Base version
       }
       class Derived extends Base {
         method() {}  // Override
       }

       const obj = new Derived();
       obj.method();  // Should resolve to Derived.method
     `;
   });
   ```

4. **Interface implementation:**
   ```typescript
   it('resolves interface methods', () => {
     const code = `
       interface IUser {
         getName(): string;
       }
       class User implements IUser {
         getName() { return ""; }
       }

       const user: IUser = new User();
       user.getName();  // Should resolve
     `;
   });
   ```

5. **Multiple interfaces:**
   ```typescript
   it('handles multiple interface implementations', () => {
     const code = `
       interface IA {
         methodA() {}
       }
       interface IB {
         methodB() {}
       }
       class C implements IA, IB {
         methodA() {}
         methodB() {}
       }

       const obj = new C();
       obj.methodA();  // Should resolve
       obj.methodB();  // Should resolve
     `;
   });
   ```

6. **Circular inheritance (error case):**
   ```typescript
   it('handles circular inheritance gracefully', () => {
     // Malformed code, but should not crash
     const code = `
       class A extends B {}
       class B extends A {}

       const obj = new A();
       obj.method();  // Should not infinite loop
     `;
   });
   ```

7. **Python MRO:**
   ```python
   it('respects Python MRO for multiple inheritance', () => {
     const code = `
       class A:
           def method(self): pass

       class B:
           def method(self): pass

       class C(A, B):
           pass

       obj = C()
       obj.method()  # Should resolve to A.method (left-to-right)
     `;
   });
   ```

8. **Rust traits:**
   ```rust
   it('resolves Rust trait methods', () => {
     const code = `
       trait Display {
           fn display(&self);
       }

       struct MyType;

       impl Display for MyType {
           fn display(&self) {}
       }

       let obj = MyType;
       obj.display();  // Should resolve
     `;
   });
   ```

## Success Criteria

### Functional
- ✅ Simple inheritance (1 level) works
- ✅ Multi-level inheritance (2+ levels) works
- ✅ Method overrides handled correctly
- ✅ Interface implementation works
- ✅ Multiple interfaces supported
- ✅ All 4 languages supported

### Edge Cases
- ✅ Circular inheritance detected (no infinite loops)
- ✅ Missing parent class handled gracefully
- ✅ Abstract classes work correctly
- ✅ Diamond inheritance (Python) works

### Performance
- ✅ No significant slowdown (< 10% regression)
- ✅ Inheritance chains cached
- ✅ Reasonable for deep hierarchies (10+ levels)

### Testing
- ✅ 30+ new tests for inheritance
- ✅ Language-specific tests (8+ per language)
- ✅ Integration tests updated
- ✅ No regressions

### Code Quality
- ✅ Clear documentation
- ✅ Type-safe implementation
- ✅ Consistent patterns
- ✅ Pythonic naming

## Known Limitations

### Not Implementing (Future Work)

1. **Prototype chain (JavaScript):**
   ```javascript
   function Base() {}
   Base.prototype.method = function() {};
   // Not supported (class-based only)
   ```

2. **Dynamic inheritance:**
   ```python
   def get_base():
       return Base
   class Derived(get_base()):
       pass
   ```

3. **Generic constraints:**
   ```typescript
   class Container<T extends Base> {
       // T has Base methods
   }
   ```

4. **Mixin patterns:**
   ```typescript
   class Mixed extends Mixin(Base) {}
   ```

## Files to Modify

1. **`packages/core/src/resolve_references/type_resolution/type_context.ts`**
   - Add inheritance tracking methods
   - Update `get_type_member()` to walk chain
   - Add `walk_inheritance_chain()` helper

2. **`packages/core/src/resolve_references/type_resolution/type_context.test.ts`**
   - Add inheritance tracking tests

3. **`packages/core/src/resolve_references/call_resolution/method_resolver_inheritance.test.ts`** (NEW)
   - Comprehensive inheritance resolution tests

4. **`packages/core/src/resolve_references/symbol_resolution.*.test.ts`**
   - Update integration tests with inheritance examples

## Performance Considerations

**Caching Strategy:**
- Cache inheritance chains (class_id → chain)
- Cache member lookups (class_id, member_name) → symbol_id
- Both use existing ResolutionCache

**Complexity:**
- Inheritance chain walk: O(depth) where depth = inheritance levels
- Member lookup with inheritance: O(depth × methods_per_class)
- Cached lookup: O(1)

**Typical case:**
- Depth: 2-5 levels
- Methods: 10-20 per class
- Total lookups per call: ~50
- Time: < 1ms with caching

## Dependencies

**Requires:**
- task-epic-11.109 (provides resolution infrastructure)
- task-epic-11.111 (fixes type resolution bug)

**Enables:**
- Complete method resolution coverage
- Accurate call graph for OOP code
- Foundation for trait/interface analysis

## Next Steps

After completion:
1. Update documentation with inheritance support
2. Measure improvement in resolution coverage
3. Consider task 11.114 (namespace imports)
4. Consider task 11.115 (generic type support)
