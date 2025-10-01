# Task 11.109.3: Implement Type Context

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 5-6 days
**Parent:** task-epic-11.109
**Dependencies:**
- task-epic-11.109.1 (ScopeResolverIndex - uses for type name resolution)
- task-epic-11.105 (Type preprocessing - integrates with)

## Objective

Build a type tracking system that determines the type of variables/parameters and provides type member lookup for method resolution. Uses the on-demand resolver index to resolve type names.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── type_resolution/
    ├── type_context.ts
    └── type_context.test.ts
```

### Core Interface

```typescript
export interface TypeContext {
  /**
   * Get the type of a symbol (variable, parameter, etc.)
   * Returns the SymbolId of the type (class, interface, etc.)
   */
  get_symbol_type(symbol_id: SymbolId): SymbolId | null

  /**
   * Get a member (method/property) of a type by name
   * Walks inheritance chain if necessary
   */
  get_type_member(
    type_id: SymbolId,
    member_name: SymbolName
  ): SymbolId | null

  /**
   * Get all members of a type (for debugging)
   */
  get_type_members(type_id: SymbolId): ReadonlyMap<SymbolName, SymbolId>
}

export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache
): TypeContext
```

### Type Tracking Sources

**Priority 1: Type Annotations (Highest Confidence)**
```typescript
// TypeScript/Python with type hints
const user: User = getUser()
function process(data: DataType) { ... }
```

**Priority 2: Constructor Assignments**
```typescript
// Direct construction
const helper = new Helper()
const obj = Helper()  // Python
```

**Priority 3: Return Types (from annotations)**
```typescript
function getUser(): User { ... }
const user = getUser()  // user has type User
```

**Priority 4: Inference (Future - out of scope)**
```typescript
const x = 5  // Infer number
```

### Implementation: Build Type Maps

```typescript
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache
): TypeContext {

  // Map: symbol_id -> type_id
  const symbol_types = new Map<SymbolId, SymbolId>()

  // Map: type_id -> (member_name -> member_symbol_id)
  const type_members = new Map<SymbolId, Map<SymbolName, SymbolId>>()

  // PASS 1: Extract type annotations
  for (const [file_path, index] of indices) {

    // 1A. Variable type annotations
    for (const [var_id, var_def] of index.variables) {
      if (var_def.type) {
        // Resolve type name ON-DEMAND using resolver index
        const type_symbol = resolver_index.resolve(
          var_def.scope_id,
          var_def.type,
          cache
        )
        if (type_symbol) {
          symbol_types.set(var_id, type_symbol)
        }
      }
    }

    // 1B. Parameter type annotations
    // (Parameters are already in function/method definitions)
    for (const [func_id, func_def] of index.functions) {
      for (const param of func_def.signature.parameters) {
        if (param.type) {
          const type_symbol = resolver_index.resolve(
            param.scope_id,
            param.type,
            cache
          )
          if (type_symbol) {
            symbol_types.set(param.symbol_id, type_symbol)
          }
        }
      }
    }

    // 1C. Function return types
    for (const [func_id, func_def] of index.functions) {
      if (func_def.return_type) {
        const type_symbol = resolver_index.resolve(
          func_def.scope_id,
          func_def.return_type,
          cache
        )
        // Store function return type for later use
        // When we see: const x = foo()
        // We can look up foo's return type
        if (type_symbol) {
          // TODO: Track return types for assignment tracking
        }
      }
    }
  }

  // PASS 2: Track constructor assignments
  for (const [file_path, index] of indices) {
    const constructor_calls = index.references.filter(
      ref => ref.type === "call" && ref.call_type === "constructor"
    )

    for (const ctor_ref of constructor_calls) {
      // Resolve class name to type ON-DEMAND
      const class_symbol = resolver_index.resolve(
        ctor_ref.scope_id,
        ctor_ref.name,
        cache
      )

      if (class_symbol && ctor_ref.context?.construct_target) {
        // Find the variable at construct_target location
        const target_var = find_variable_at_location(
          ctor_ref.context.construct_target,
          index
        )
        if (target_var) {
          symbol_types.set(target_var, class_symbol)
        }
      }
    }
  }

  // PASS 3: Build type member maps
  for (const [file_path, index] of indices) {

    // 3A. Class members
    for (const [class_id, class_def] of index.classes) {
      const members = new Map<SymbolName, SymbolId>()

      // Add methods
      for (const method of class_def.methods) {
        members.set(method.name, method.symbol_id)
      }

      // Add properties
      for (const prop of class_def.properties) {
        members.set(prop.name, prop.symbol_id)
      }

      type_members.set(class_id, members)
    }

    // 3B. Interface members
    for (const [iface_id, iface_def] of index.interfaces) {
      const members = new Map<SymbolName, SymbolId>()

      for (const method of iface_def.methods) {
        members.set(method.name, method.symbol_id)
      }

      for (const prop of iface_def.properties) {
        members.set(prop.name, prop.symbol_id)
      }

      type_members.set(iface_id, members)
    }
  }

  // Return implementation
  return {
    get_symbol_type(symbol_id: SymbolId): SymbolId | null {
      return symbol_types.get(symbol_id) || null
    },

    get_type_member(
      type_id: SymbolId,
      member_name: SymbolName
    ): SymbolId | null {
      const members = type_members.get(type_id)
      if (!members) return null

      // Direct lookup
      const member = members.get(member_name)
      if (member) return member

      // TODO: Walk inheritance chain
      return null
    },

    get_type_members(type_id: SymbolId) {
      return type_members.get(type_id) || new Map()
    }
  }
}

/**
 * Find variable definition at a specific location
 */
function find_variable_at_location(
  location: Location,
  index: SemanticIndex
): SymbolId | null {
  for (const [var_id, var_def] of index.variables) {
    if (locations_match(var_def.location, location)) {
      return var_id
    }
  }
  return null
}

function locations_match(a: Location, b: Location): boolean {
  return (
    a.file_path === b.file_path &&
    a.start_line === b.start_line &&
    a.start_column === b.start_column
  )
}
```

## Integration with Task 11.105

Task 11.105 preprocesses type information in `SemanticIndex`. Integration points:

### Enhanced SemanticIndex (from 11.105)
```typescript
interface SemanticIndex {
  // Existing fields...

  // NEW from 11.105: Preprocessed type information
  readonly type_annotations?: ReadonlyMap<LocationKey, SymbolName>
  readonly inferred_types?: ReadonlyMap<LocationKey, SymbolName>
  readonly type_inheritance?: ReadonlyMap<SymbolId, readonly SymbolId[]>
}
```

### Enhanced build_type_context (post-11.105)
```typescript
// Use preprocessed type annotations
if (index.type_annotations) {
  for (const [loc_key, type_name] of index.type_annotations) {
    const scope_id = get_scope_at_location(loc_key)
    const type_symbol = resolver_index.resolve(
      scope_id,
      type_name,
      cache
    )
    // Store mapping...
  }
}

// Use preprocessed inheritance chains
if (index.type_inheritance) {
  for (const [class_id, parents] of index.type_inheritance) {
    // Build member lookup with inheritance...
  }
}
```

## Test Coverage

### Unit Tests (`type_context.test.ts`)

**Type Annotation Tracking:**
1. ✅ Variable annotations - `const x: Type = ...`
2. ✅ Parameter annotations - `function f(x: Type)`
3. ✅ Return type tracking - `function f(): Type { ... }`
4. ✅ Generic types - `const x: Array<T>`

**Constructor Assignment Tracking:**
5. ✅ Direct construction - `const x = new Class()`
6. ✅ Python construction - `x = Class()`
7. ✅ Nested construction - `this.x = new Class()`

**Member Lookup:**
8. ✅ Method lookup - Get method from class
9. ✅ Property lookup - Get property from class
10. ✅ Interface member lookup - Get from interface
11. ✅ Not found - Return null gracefully

**Resolver Index Integration:**
12. ✅ Type names resolved on-demand
13. ✅ Cache is used for repeated type lookups
14. ✅ Shadowing works correctly for type names

**Per-Language Tests:**
15. ✅ JavaScript - Constructor tracking (10 cases)
16. ✅ TypeScript - Type annotations (30 cases)
17. ✅ Python - Type hints (20 cases)
18. ✅ Rust - Trait system (25 cases)

## Success Criteria

### Functional
- ✅ Type annotations tracked correctly
- ✅ Constructor assignments tracked
- ✅ Type member lookup works
- ✅ Uses resolver index for type name resolution
- ✅ All 4 languages supported

### Integration
- ✅ Works with on-demand resolver index
- ✅ Uses cache for type name resolution
- ✅ Can consume preprocessed types from 11.105
- ✅ Interface accommodates future enhancements

### Testing
- ✅ Unit tests for each type tracking source
- ✅ Unit tests for member lookup
- ✅ Integration tests with resolver index
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

### On-Demand Type Resolution

Type names are resolved lazily using the resolver index:

```typescript
// Type annotation: const user: User
const type_symbol = resolver_index.resolve(
  var_def.scope_id,  // Scope where variable is defined
  "User",            // Type name
  cache              // Cache for performance
)
```

This automatically handles:
- Local type definitions shadowing imports
- Imported types from other files
- Nested scopes with type shadowing

## Performance Considerations

- Type name resolution: O(1) with cache
- Member lookup: O(1) for direct members
- Build time: O(variables + parameters + classes)

## Known Limitations

Document for future work:

1. **No type inference** - Only explicit annotations
2. **No flow analysis** - Don't track type changes
3. **No generics** - Generic parameters ignored
4. **No union types** - Pick first type only
5. **No inheritance walking** - Direct members only (initially)

## Dependencies

**Uses:**
- `ScopeResolverIndex` for resolving type names
- `ResolutionCache` for caching type resolutions
- `SemanticIndex` for definitions

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
