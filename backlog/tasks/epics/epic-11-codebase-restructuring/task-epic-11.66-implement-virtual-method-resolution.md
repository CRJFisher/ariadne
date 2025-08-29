---
id: task-epic-11.66
title: Implement Virtual Method Resolution
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, layer-9, inheritance, polymorphism, missing-functionality]
dependencies: [task-epic-11.60, task-epic-11.61, task-epic-11.62]
parent_task_id: epic-11
---

## Description

Implement virtual method resolution to handle polymorphic calls correctly. Currently, we cannot resolve method calls through inheritance hierarchies, missing overridden methods and polymorphic dispatch.

## Context

From PROCESSING_PIPELINE.md Layer 9:
- Need Virtual Method Resolution for polymorphic calls
- Must resolve methods through inheritance chains
- Handle method overrides and interface implementations

From call analysis:
- Method calls don't check parent classes
- Interface method calls not resolved
- Dynamic dispatch not handled

## Acceptance Criteria

### Core Virtual Method Resolution
- [ ] Create `/call_graph/virtual_method_resolution/index.ts` module
- [ ] Implement method resolution order (MRO) lookup:
  ```typescript
  // Given: dog.bark() where dog: Dog extends Animal
  // Resolve: Dog.bark() or Animal.bark() based on override
  ```
- [ ] Handle method overrides:
  ```typescript
  class Animal { speak() {} }
  class Dog extends Animal { speak() {} } // Override
  ```
- [ ] Resolve interface/trait methods:
  ```typescript
  interface Speaker { speak(): void }
  class Dog implements Speaker { speak() {} }
  ```

### Language-Specific Method Resolution

**JavaScript/TypeScript:**
- [ ] Prototype chain traversal:
  ```javascript
  // Check: obj → obj.constructor.prototype → parent.prototype → ...
  ```
- [ ] ES6 class inheritance with super
- [ ] Mixin patterns
- [ ] Interface implementation (TypeScript)

**Python:**
- [ ] Method Resolution Order (C3 linearization):
  ```python
  class D(B, C): pass  # MRO: D → B → C → object
  ```
- [ ] Multiple inheritance resolution
- [ ] Abstract methods (@abstractmethod)
- [ ] Protocol methods

**Rust:**
- [ ] Trait method resolution:
  ```rust
  impl Display for MyType { ... }
  mytype.to_string() // Resolve through Display trait
  ```
- [ ] Associated methods vs trait methods
- [ ] Default trait implementations
- [ ] Trait bounds and where clauses

### Resolution Algorithm
- [ ] Build method lookup table per class:
  ```typescript
  interface MethodTable {
    class_name: string;
    own_methods: Map<string, MethodInfo>;
    inherited_methods: Map<string, MethodInfo>;
    overridden_methods: Set<string>;
  }
  ```
- [ ] Implement resolution strategy:
  1. Check receiver's actual type
  2. Look for method in class
  3. Walk inheritance chain
  4. Check implemented interfaces/traits
  5. Return first match or undefined

### Polymorphic Call Analysis
- [ ] Track possible receiver types:
  ```typescript
  function process(animal: Animal) {
    animal.speak(); // Could be any Animal subclass
  }
  ```
- [ ] Build virtual call sites:
  ```typescript
  interface VirtualCallSite {
    call_location: Location;
    method_name: string;
    possible_receivers: Set<string>; // All possible types
    resolved_methods: Map<string, MethodInfo>; // Type → Method
  }
  ```
- [ ] Handle dynamic dispatch

### Integration Points
- [ ] Consume class_hierarchy for inheritance chains:
  ```typescript
  import { get_ancestors } from '../inheritance/class_hierarchy';
  ```
- [ ] Use type_tracking for receiver types:
  ```typescript
  import { get_variable_type } from '../type_analysis/type_tracking';
  ```
- [ ] Update method_calls to use virtual resolution:
  ```typescript
  // In method_calls
  const resolved = resolve_virtual_method(receiver_type, method_name);
  ```
- [ ] Feed into call_chain_analysis

### Edge Cases
- [ ] Handle abstract/pure virtual methods
- [ ] Resolve static vs instance methods correctly
- [ ] Handle method hiding (new in C#/Java style)
- [ ] Deal with private method inheritance
- [ ] Support generic method resolution

### Testing
- [ ] Test simple inheritance override
- [ ] Test multiple inheritance (Python)
- [ ] Test interface implementation
- [ ] Test trait resolution (Rust)
- [ ] Test complex hierarchies:
  ```typescript
  class A { foo() {} }
  class B extends A { foo() {} }
  class C extends B { }
  // C.foo() should resolve to B.foo()
  ```
- [ ] Test with type unions/intersections

## Implementation Notes

### Data Structures

```typescript
interface VirtualMethodResolver {
  method_tables: Map<string, MethodTable>;
  inheritance_graph: ClassHierarchy;
  interface_implementations: Map<string, Set<string>>;
}

interface MethodResolution {
  method: MethodInfo;
  declaring_class: string;
  is_override: boolean;
  is_abstract: boolean;
  resolution_path: string[]; // Classes checked
}

interface PolymorphicCallSite {
  location: Location;
  receiver_type: string | UnionType;
  method_name: string;
  possible_resolutions: MethodResolution[];
}
```

### Resolution Strategies by Language

**JavaScript:**
```typescript
function resolve_js_method(obj_type: string, method: string) {
  // 1. Check own properties
  // 2. Check prototype
  // 3. Walk prototype chain
  // 4. Check Object.prototype
}
```

**Python:**
```python
def resolve_python_method(cls, method):
  # Use __mro__ (Method Resolution Order)
  for base in cls.__mro__:
    if method in base.__dict__:
      return base.__dict__[method]
```

**TypeScript:**
```typescript
function resolve_ts_method(type: string, method: string) {
  // 1. Check class methods
  // 2. Check inherited methods
  // 3. Check implemented interfaces
  // 4. Check intersection types
}
```

**Rust:**
```rust
fn resolve_rust_method(type: &str, method: &str) {
  // 1. Check inherent implementations
  // 2. Check trait implementations
  // 3. Check deref coercion
}
```

### Performance Optimization
- Cache method resolution results
- Build method tables once during analysis
- Use bloom filters for quick negative lookups
- Limit inheritance depth traversal

## Migration to @ariadnejs/types

```typescript
export interface MethodResolution {
  method: MethodInfo;
  declaring_class: ClassName;
  is_override: boolean;
  is_virtual: boolean;
  is_abstract: boolean;
}

export interface VirtualCallSite {
  location: Location;
  method_name: MethodName;
  possible_receivers: ClassName[];
  resolutions: MethodResolution[];
}
```

## Success Metrics
- Can resolve methods through inheritance
- Handles multiple inheritance correctly (Python)
- Resolves trait methods (Rust)
- Identifies all possible targets for polymorphic calls
- No false positives for method existence
- Performance: < 5ms per method resolution

## References
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 9)
- Related modules:
  - `/inheritance/class_hierarchy` (provides inheritance data)
  - `/inheritance/method_override` (tracks overrides)
  - `/call_graph/method_calls` (needs virtual resolution)
  - `/type_analysis/type_tracking` (provides receiver types)

## Notes
Virtual method resolution is critical for accurate call graphs in OOP code. Without it, we miss many actual call targets and cannot properly analyze polymorphic code.

The implementation should be incremental:
1. Start with simple single inheritance
2. Add interface/trait support
3. Handle multiple inheritance
4. Optimize performance