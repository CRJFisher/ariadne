# Task 11.109.3: Implement Type Context

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 5-6 days
**Parent:** task-epic-11.109
**Dependencies:**

- task-epic-11.109.1 (ScopeResolver - uses for type name resolution)
- task-epic-11.105 (Type preprocessing - integrates with)

## Objective

Build a type tracking system that determines the type of variables/parameters and provides type member lookup for method resolution. This bridges the gap between scope-aware name resolution and method call resolution.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── type_resolution/
    ├── type_context.ts
    ├── type_context.test.ts
    ├── type_tracker.ts
    └── type_tracker.test.ts
```

### Core Interface

```typescript
export interface TypeContext {
  /**
   * Get the type of a symbol (variable, parameter, etc.)
   * Returns the SymbolId of the type (class, interface, etc.)
   */
  get_symbol_type(symbol_id: SymbolId): SymbolId | null;

  /**
   * Get a member (method/property) of a type by name
   * Walks inheritance chain if necessary
   */
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null;

  /**
   * Get all members of a type (for debugging)
   */
  get_type_members(type_id: SymbolId): ReadonlyMap<SymbolName, SymbolId>;
}

export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver
): TypeContext;
```

### Type Tracking Sources

**Priority 1: Type Annotations (Highest Confidence)**

```typescript
// TypeScript/Python with type hints
const user: User = getUser();
function process(data: DataType) { ... }
```

**Priority 2: Constructor Assignments**

```typescript
// Direct construction
const helper = new Helper();
const obj = Helper(); // Python
```

**Priority 3: Return Types (from annotations)**

```typescript
function getUser(): User { ... }
const user = getUser();  // user has type User
```

**Priority 4: Inference (Future - out of scope)**

```typescript
const x = 5; // Infer number
```

### Implementation: Build Type Maps

```typescript
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver
): TypeContext {
  // Map: symbol_id -> type_id
  const symbol_types = new Map<SymbolId, SymbolId>();

  // Map: type_id -> (member_name -> member_symbol_id)
  const type_members = new Map<SymbolId, Map<SymbolName, SymbolId>>();

  // PASS 1: Extract type annotations
  for (const [file_path, index] of indices) {
    // 1A. Variable type annotations
    for (const [var_id, var_def] of index.variables) {
      if (var_def.type) {
        const type_symbol = scope_resolver.resolve_in_scope(
          var_def.type,
          var_def.scope_id
        );
        if (type_symbol) {
          symbol_types.set(var_id, type_symbol);
        }
      }
    }

    // 1B. Parameter type annotations
    // (Already in ParameterDefinition.type field)

    // 1C. Function return types
    for (const [func_id, func_def] of index.functions) {
      if (func_def.return_type) {
        // Store return type for this function
        // Used when resolving: const x = foo()
      }
    }
  }

  // PASS 2: Track constructor assignments
  for (const [file_path, index] of indices) {
    const constructor_calls = index.references.filter(
      (ref) => ref.call_type === "constructor" && ref.context?.construct_target
    );

    for (const ctor_ref of constructor_calls) {
      // Resolve class name to type
      const class_symbol = scope_resolver.resolve_in_scope(
        ctor_ref.name,
        ctor_ref.scope_id
      );

      if (class_symbol && ctor_ref.context?.construct_target) {
        // Find the variable at construct_target location
        const target_var = find_variable_at_location(
          ctor_ref.context.construct_target,
          index
        );
        if (target_var) {
          symbol_types.set(target_var, class_symbol);
        }
      }
    }
  }

  // PASS 3: Build type member maps
  for (const [file_path, index] of indices) {
    // 3A. Class members
    for (const [class_id, class_def] of index.classes) {
      const members = new Map<SymbolName, SymbolId>();

      // Add methods
      for (const method of class_def.methods) {
        members.set(method.name, method.symbol_id);
      }

      // Add properties
      for (const prop of class_def.properties) {
        members.set(prop.name, prop.symbol_id);
      }

      type_members.set(class_id, members);
    }

    // 3B. Interface members
    for (const [iface_id, iface_def] of index.interfaces) {
      const members = new Map<SymbolName, SymbolId>();

      for (const method of iface_def.methods) {
        members.set(method.name, method.symbol_id);
      }

      for (const prop of iface_def.properties) {
        members.set(prop.name, prop.symbol_id);
      }

      type_members.set(iface_id, members);
    }
  }

  // Return implementation
  return {
    get_symbol_type(symbol_id: SymbolId): SymbolId | null {
      return symbol_types.get(symbol_id) || null;
    },

    get_type_member(
      type_id: SymbolId,
      member_name: SymbolName
    ): SymbolId | null {
      const members = type_members.get(type_id);
      if (!members) return null;

      // Direct lookup
      const member = members.get(member_name);
      if (member) return member;

      // TODO: Walk inheritance chain
      return null;
    },

    get_type_members(type_id: SymbolId): ReadonlyMap<SymbolName, SymbolId> {
      return type_members.get(type_id) || new Map();
    },
  };
}
```

### Inheritance Chain Walking (Future Enhancement)

```typescript
function get_type_member_with_inheritance(
  type_id: SymbolId,
  member_name: SymbolName,
  indices: Map<...>
): SymbolId | null {
  // Check direct members
  const direct = type_members.get(type_id)?.get(member_name);
  if (direct) return direct;

  // Get class definition
  const class_def = find_class_definition(type_id, indices);
  if (!class_def) return null;

  // Walk extends chain
  for (const parent_name of class_def.extends) {
    const parent_type = resolve_type_name(parent_name, class_def.scope_id);
    if (parent_type) {
      const member = get_type_member_with_inheritance(parent_type, member_name, indices);
      if (member) return member;
    }
  }

  return null;
}
```

## Integration with Task 11.105

Task 11.105 preprocesses type information. Integration points:

### Enhanced SemanticIndex (from 11.105)

```typescript
interface SemanticIndex {
  // Existing fields...

  // NEW from 11.105: Preprocessed type information
  readonly type_annotations?: ReadonlyMap<LocationKey, SymbolName>;
  readonly inferred_types?: ReadonlyMap<LocationKey, SymbolName>;
  readonly type_inheritance?: ReadonlyMap<SymbolId, readonly SymbolId[]>;
}
```

### Enhanced build_type_context (post-11.105)

```typescript
// EASY: Leverage preprocessed data
for (const [file_path, index] of indices) {
  // Use preprocessed type annotations
  if (index.type_annotations) {
    for (const [loc_key, type_name] of index.type_annotations) {
      const type_symbol = scope_resolver.resolve_in_scope(
        type_name,
        get_scope_at_location(loc_key)
      );
      // Store mapping...
    }
  }

  // Use preprocessed inheritance chains
  if (index.type_inheritance) {
    for (const [class_id, parents] of index.type_inheritance) {
      // Build member lookup with inheritance...
    }
  }
}
```

## Test Coverage

### Unit Tests (`type_context.test.ts`)

Test cases for each language:

#### Type Annotation Tracking

1. **Variable annotations** - `const x: Type = ...`
2. **Parameter annotations** - `function f(x: Type)`
3. **Return type tracking** - `function f(): Type { ... }`
4. **Generic types** - `const x: Array<T>`

#### Constructor Assignment Tracking

1. **Direct construction** - `const x = new Class()`
2. **Python construction** - `x = Class()`
3. **Nested construction** - `this.x = new Class()`

#### Member Lookup

1. **Method lookup** - Get method from class
2. **Property lookup** - Get property from class
3. **Interface member lookup** - Get from interface
4. **Not found** - Return null gracefully

#### Inheritance (Future)

1. **Parent method** - Find method in parent class
2. **Grandparent method** - Walk multiple levels
3. **Interface implementation** - Find from interface

### Integration Tests

1. **Complete flow** - Variable annotation → type → member
2. **Constructor flow** - Construction → type → member
3. **Shadowing** - Local type shadows imported type
4. **Cross-file types** - Import type from another file

## Success Criteria

### Functional

- ✅ Type annotations tracked correctly
- ✅ Constructor assignments tracked
- ✅ Type member lookup works
- ✅ Integrates with ScopeResolver for type name resolution
- ✅ All 4 languages supported (JS/TS/Python/Rust)

### Integration with 11.105

- ✅ Can consume preprocessed type annotations
- ✅ Can consume preprocessed inheritance chains
- ✅ Interface accommodates future enhancements

### Testing

- ✅ Unit tests for each type tracking source
- ✅ Unit tests for member lookup
- ✅ Integration tests for complete flows
- ✅ Edge cases covered

### Code Quality

- ✅ Full JSDoc documentation
- ✅ Clear separation of concerns
- ✅ Type-safe implementation
- ✅ Extensible for inference

## Technical Notes

### Type Tracking Priority

When multiple sources provide type info:

1. Explicit annotations (highest priority)
2. Constructor assignments
3. Return type inference
4. No type (return null)

### Member Lookup Strategy

**Phase 1 (this task):** Direct members only

- Look in class methods/properties
- Look in interface methods/properties

**Phase 2 (future):** Inheritance walking

- Walk extends chain
- Walk implements chain
- Handle multiple inheritance (Python)

### Performance Considerations

- Build all maps once during initialization
- Lookups are O(1) for direct members
- Inheritance walking is O(depth) - typically small

## Known Limitations

Document for future work:

1. **No type inference** - Only explicit annotations
2. **No flow analysis** - Don't track type changes
3. **No generics** - Generic parameters ignored
4. **No union types** - Pick first type only
5. **No inheritance walking** - Direct members only (initially)

## Dependencies

**Uses:**

- `ScopeResolver` for resolving type names
- `SemanticIndex` for definitions
- `SymbolReference` for constructor calls

**Consumed by:**

- Task 11.109.5 (Method resolver)
- Task 11.109.6 (Constructor resolver)

**Integrates with:**

- Task 11.105 (Type preprocessing)

## Next Steps

After completion:

- Method resolver can determine receiver types
- Constructor resolver can validate constructor calls
- Future: Add inheritance walking
- Future: Add type inference
