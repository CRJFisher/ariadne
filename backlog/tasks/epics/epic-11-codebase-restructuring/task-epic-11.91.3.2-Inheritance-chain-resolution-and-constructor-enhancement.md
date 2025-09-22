# Task: Inheritance Chain Resolution and Constructor Enhancement

**Task ID**: task-epic-11.91.3.2
**Parent**: task-epic-11.91.3
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Completed**: 2025-01-22
**Estimated Effort**: 1-1.5 days
**Actual Effort**: ~1 hour

## Problem Statement

With basic method resolution complete, we need to enhance it with inheritance chain resolution, interface/trait method lookup, and comprehensive constructor handling. This enables accurate method resolution through complex inheritance hierarchies and polymorphic calls.

### Current State

After task 11.91.3.1:
- ✅ Basic type-based method lookup
- ✅ Static vs instance method handling
- ✅ Basic constructor resolution
- ❌ Inheritance chain traversal
- ❌ Interface/trait method resolution
- ❌ Complex constructor scenarios

## Solution Overview

Enhance method resolution with:
- Inheritance hierarchy traversal for method lookup
- Interface and trait method implementation resolution
- Advanced constructor call scenarios (super calls, delegation)
- Method overriding and polymorphism handling

### Architecture

```
symbol_resolution/
├── method_resolution/
│   ├── inheritance_resolver.ts    # Inheritance chain traversal
│   ├── interface_resolver.ts      # Interface/trait method resolution
│   ├── constructor_resolver.ts    # Enhanced constructor handling
│   ├── polymorphism_handler.ts    # Method overriding and polymorphism
│   └── ...                        # (Basic infrastructure from 11.91.3.1)
```

## Implementation Plan

### 1. Inheritance Chain Resolution

**Module**: `method_resolution/inheritance_resolver.ts`

Enhanced method lookup through inheritance hierarchies:

```typescript
export function resolve_method_with_inheritance(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext
): MethodCallResolution | null {
  // 1. Try direct method lookup first (from basic resolution)
  const direct_result = resolve_method_on_type(method_name, receiver_type, is_static_call, context);
  if (direct_result) {
    return direct_result;
  }

  // 2. Try inheritance chain lookup
  const inherited_result = lookup_inherited_method(method_name, receiver_type, is_static_call, context);
  if (inherited_result) {
    return inherited_result;
  }

  // 3. Try interface/trait method lookup
  const interface_result = lookup_interface_method(method_name, receiver_type, is_static_call, context);
  if (interface_result) {
    return interface_result;
  }

  return null;
}

function lookup_inherited_method(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext
): MethodCallResolution | null {
  const inheritance_chain = build_inheritance_chain(receiver_type, context);

  for (const ancestor_type of inheritance_chain) {
    const ancestor_methods = get_type_methods(ancestor_type, context);
    if (!ancestor_methods) continue;

    const method_map = is_static_call ? ancestor_methods.static_methods : ancestor_methods.methods;
    const method_symbol = method_map.get(method_name);

    if (method_symbol) {
      return {
        call_location: null as any, // Will be set by caller
        resolved_method: method_symbol,
        receiver_type,
        method_kind: is_static_call ? "static" : "instance",
        resolution_path: "inherited"
      };
    }
  }

  return null;
}

function build_inheritance_chain(
  type_id: TypeId,
  context: MethodLookupContext
): TypeId[] {
  const chain: TypeId[] = [];
  const visited = new Set<TypeId>();
  const inheritance_map = context.type_resolution.inheritance_hierarchy;

  let current_types = inheritance_map.get(type_id) || [];

  while (current_types.length > 0) {
    const next_types: TypeId[] = [];

    for (const parent_type of current_types) {
      if (!visited.has(parent_type)) {
        visited.add(parent_type);
        chain.push(parent_type);

        // Add grandparents to next iteration
        const grandparents = inheritance_map.get(parent_type) || [];
        next_types.push(...grandparents);
      }
    }

    current_types = next_types;
  }

  return chain;
}
```

### 2. Interface/Trait Method Resolution

**Module**: `method_resolution/interface_resolver.ts`

Handle interface implementations and trait methods:

```typescript
function lookup_interface_method(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext
): MethodCallResolution | null {
  const implemented_interfaces = get_implemented_interfaces(receiver_type, context);

  for (const interface_type of implemented_interfaces) {
    const interface_methods = get_type_methods(interface_type, context);
    if (!interface_methods) continue;

    const method_map = is_static_call ? interface_methods.static_methods : interface_methods.methods;
    const method_symbol = method_map.get(method_name);

    if (method_symbol) {
      // Find the actual implementation in the receiver type or its hierarchy
      const implementation_symbol = find_method_implementation(
        method_symbol,
        receiver_type,
        context
      );

      if (implementation_symbol) {
        return {
          call_location: null as any,
          resolved_method: implementation_symbol,
          receiver_type,
          method_kind: is_static_call ? "static" : "instance",
          resolution_path: "interface"
        };
      }
    }
  }

  return null;
}

function get_implemented_interfaces(
  type_id: TypeId,
  context: MethodLookupContext
): TypeId[] {
  // Get interfaces/traits implemented by this type
  const interface_map = context.type_resolution.interface_implementations;
  return interface_map.get(type_id) || [];
}

function find_method_implementation(
  interface_method: SymbolId,
  implementing_type: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  // Find the concrete implementation of an interface method
  // This involves matching method signatures and names

  const interface_method_def = find_symbol_definition(interface_method, context);
  if (!interface_method_def) return null;

  const method_name = interface_method_def.name;

  // Look in implementing type and its hierarchy
  const search_types = [implementing_type, ...build_inheritance_chain(implementing_type, context)];

  for (const search_type of search_types) {
    const type_methods = get_type_methods(search_type, context);
    if (!type_methods) continue;

    const implementation = type_methods.methods.get(method_name);
    if (implementation) {
      // Verify this is actually an implementation of the interface method
      if (is_method_implementation(implementation, interface_method, context)) {
        return implementation;
      }
    }
  }

  return null;
}

function is_method_implementation(
  candidate_method: SymbolId,
  interface_method: SymbolId,
  context: MethodLookupContext
): boolean {
  // Compare method signatures to determine if this is an implementation
  const candidate_def = find_symbol_definition(candidate_method, context);
  const interface_def = find_symbol_definition(interface_method, context);

  if (!candidate_def || !interface_def) return false;

  // Basic check: same name
  if (candidate_def.name !== interface_def.name) return false;

  // TODO: More sophisticated signature matching
  return true;
}
```

### 3. Enhanced Constructor Resolution

**Module**: `method_resolution/constructor_resolver.ts`

Handle complex constructor scenarios:

```typescript
export function resolve_constructor_calls_enhanced(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  // Process different types of constructor calls
  resolutions.push(...resolve_new_expressions(index, context));
  resolutions.push(...resolve_super_constructor_calls(index, context));
  resolutions.push(...resolve_delegated_constructors(index, context));

  return resolutions;
}

function resolve_new_expressions(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  if (index.local_type_flow?.constructor_calls) {
    for (const ctor_call of index.local_type_flow.constructor_calls) {
      const resolution = resolve_constructor_with_inheritance(ctor_call, context);
      if (resolution) {
        resolutions.push(resolution);
      }
    }
  }

  return resolutions;
}

function resolve_constructor_with_inheritance(
  ctor_call: ConstructorCall,
  context: MethodLookupContext
): MethodCallResolution | null {
  const constructed_type = ctor_call.constructed_type;
  if (!constructed_type) return null;

  // 1. Look for explicit constructor
  if (ctor_call.constructor_name) {
    const explicit_constructor = find_named_constructor(
      ctor_call.constructor_name,
      constructed_type,
      context
    );
    if (explicit_constructor) {
      return create_constructor_resolution(explicit_constructor, ctor_call, constructed_type);
    }
  }

  // 2. Look for default constructor
  const default_constructor = find_default_constructor(constructed_type, context);
  if (default_constructor) {
    return create_constructor_resolution(default_constructor, ctor_call, constructed_type);
  }

  // 3. Look for inherited constructors
  const inherited_constructor = find_inherited_constructor(constructed_type, context);
  if (inherited_constructor) {
    return create_constructor_resolution(inherited_constructor, ctor_call, constructed_type);
  }

  return null;
}

function find_named_constructor(
  constructor_name: SymbolName,
  type_id: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  const type_methods = get_type_methods(type_id, context);
  return type_methods?.constructors.get(constructor_name) || null;
}

function find_default_constructor(
  type_id: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  const type_methods = get_type_methods(type_id, context);
  if (!type_methods) return null;

  // Try common constructor names
  const constructor_names = ["constructor", "new", "__init__"] as SymbolName[];

  for (const name of constructor_names) {
    const constructor = type_methods.constructors.get(name);
    if (constructor) return constructor;
  }

  return null;
}

function find_inherited_constructor(
  type_id: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  const inheritance_chain = build_inheritance_chain(type_id, context);

  for (const ancestor_type of inheritance_chain) {
    const constructor = find_default_constructor(ancestor_type, context);
    if (constructor) return constructor;
  }

  return null;
}

function resolve_super_constructor_calls(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  // Handle super() calls in constructors
  const resolutions: MethodCallResolution[] = [];

  for (const call_ref of index.references.calls) {
    if (call_ref.call_type === "super_constructor") {
      const resolution = resolve_super_call(call_ref, context);
      if (resolution) {
        resolutions.push(resolution);
      }
    }
  }

  return resolutions;
}

function resolve_super_call(
  call_ref: CallReference,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Find the current class and its parent
  const current_class = find_containing_class(call_ref.location, context);
  if (!current_class) return null;

  const parent_classes = context.type_resolution.inheritance_hierarchy.get(current_class) || [];
  if (parent_classes.length === 0) return null;

  // Find constructor in parent class
  const parent_constructor = find_default_constructor(parent_classes[0], context);
  if (parent_constructor) {
    return {
      call_location: call_ref.location,
      resolved_method: parent_constructor,
      receiver_type: parent_classes[0],
      method_kind: "constructor",
      resolution_path: "inherited"
    };
  }

  return null;
}
```

### 4. Method Overriding and Polymorphism

**Module**: `method_resolution/polymorphism_handler.ts`

Handle method overriding and virtual method dispatch:

```typescript
export function resolve_polymorphic_method_call(
  method_name: SymbolName,
  receiver_type: TypeId,
  call_context: CallContext,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Find all possible method implementations in the inheritance hierarchy
  const possible_methods = find_all_method_implementations(method_name, receiver_type, context);

  if (possible_methods.length === 0) {
    return null;
  }

  // For static analysis, choose the most specific implementation
  const most_specific = choose_most_specific_method(possible_methods, receiver_type, context);

  return {
    call_location: call_context.location,
    resolved_method: most_specific.symbol_id,
    receiver_type,
    method_kind: "instance",
    resolution_path: most_specific.source_type === receiver_type ? "direct" : "inherited"
  };
}

interface MethodImplementation {
  symbol_id: SymbolId;
  source_type: TypeId;
  override_depth: number;
}

function find_all_method_implementations(
  method_name: SymbolName,
  receiver_type: TypeId,
  context: MethodLookupContext
): MethodImplementation[] {
  const implementations: MethodImplementation[] = [];
  const search_types = [receiver_type, ...build_inheritance_chain(receiver_type, context)];

  search_types.forEach((type_id, depth) => {
    const type_methods = get_type_methods(type_id, context);
    if (type_methods) {
      const method_symbol = type_methods.methods.get(method_name);
      if (method_symbol) {
        implementations.push({
          symbol_id: method_symbol,
          source_type: type_id,
          override_depth: depth
        });
      }
    }
  });

  return implementations;
}

function choose_most_specific_method(
  implementations: MethodImplementation[],
  receiver_type: TypeId,
  context: MethodLookupContext
): MethodImplementation {
  // Choose implementation with lowest override depth (most specific)
  return implementations.reduce((most_specific, current) => {
    return current.override_depth < most_specific.override_depth ? current : most_specific;
  });
}
```

### 5. Integration and Enhanced API

Update the main method resolution to use inheritance:

```typescript
// Enhanced phase4_resolve_methods
export function phase4_resolve_methods_enhanced(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap
): MethodResolutionMap {
  const method_calls = new Map<LocationKey, SymbolId>();
  const constructor_calls = new Map<LocationKey, SymbolId>();
  const calls_to_method = new Map<SymbolId, Location[]>();
  const resolution_details = new Map<LocationKey, MethodCallResolution>();

  for (const [file_path, index] of indices) {
    const context: MethodLookupContext = {
      type_resolution: types,
      imports,
      current_file: file_path,
      current_index: index
    };

    // Enhanced member access resolution with inheritance
    for (const member_access of index.references.member_accesses) {
      const resolution = resolve_member_access_with_inheritance(member_access, context);
      if (resolution) {
        record_method_resolution(resolution, member_access.location, method_calls, calls_to_method, resolution_details);
      }
    }

    // Enhanced constructor resolution
    const constructor_resolutions = resolve_constructor_calls_enhanced(index, context);
    for (const resolution of constructor_resolutions) {
      record_constructor_resolution(resolution, constructor_calls, calls_to_method, resolution_details);
    }
  }

  return { method_calls, constructor_calls, calls_to_method, resolution_details };
}

function resolve_member_access_with_inheritance(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): MethodCallResolution | null {
  const receiver_type = get_receiver_type(member_access, context);
  if (!receiver_type) return null;

  const is_static_call = determine_if_static_call(member_access, context);

  // Use enhanced resolution with inheritance
  return resolve_method_with_inheritance(
    member_access.member_name,
    receiver_type,
    is_static_call,
    context
  );
}
```

## Testing Strategy

### Unit Tests

- Inheritance chain method resolution
- Interface method implementation lookup
- Constructor inheritance and super calls
- Method overriding and polymorphism
- Complex inheritance hierarchies

### Integration Tests

- Multi-level inheritance scenarios
- Interface implementation across files
- Constructor delegation patterns
- Method resolution with multiple interfaces

### Test Fixtures

```
fixtures/
├── inheritance/
│   ├── single_inheritance/
│   ├── multiple_inheritance/
│   ├── interface_implementation/
│   └── method_overriding/
└── constructors/
    ├── constructor_chaining/
    ├── super_calls/
    └── delegated_constructors/
```

## Success Criteria

1. **Inheritance Resolution**: Correctly resolves methods through inheritance chains
2. **Interface Support**: Handles interface/trait method implementations
3. **Constructor Complexity**: Supports advanced constructor scenarios
4. **Polymorphism**: Accurate method resolution for overridden methods
5. **Cross-File Support**: Works across module boundaries
6. **Language Compliance**: Follows language-specific inheritance rules

## Dependencies

- **Prerequisite**: task-epic-11.91.3.1 (Basic method resolution) - must be completed
- **Prerequisite**: task-epic-11.90 (Type resolution with inheritance data)
- **Enables**: Complete Phase 4 method resolution
- **Enables**: Full symbol resolution pipeline completion

## Implementation Notes

- Build upon basic method resolution infrastructure
- Use inheritance hierarchy data from type resolution
- Handle language-specific inheritance semantics
- Optimize for common inheritance patterns
- Provide detailed resolution path information for debugging

## References

- Object-oriented inheritance and method resolution principles
- Language-specific inheritance rules (JavaScript prototypes, Python MRO, Rust traits)
- Existing type_resolution inheritance tracking
- Polymorphism and virtual method dispatch patterns

## Implementation Results

### Completed Components

Successfully implemented all planned components with comprehensive inheritance support:

1. **Extended TypeResolutionMap** (`types.ts`)
   - ✅ Added `inheritance_hierarchy` for parent type relationships
   - ✅ Added `interface_implementations` for interface/trait implementations

2. **Inheritance Resolver** (`inheritance_resolver.ts`)
   - ✅ `resolve_method_with_inheritance()` - Main resolution with 3-stage lookup
   - ✅ `build_inheritance_chain()` - Traverses hierarchy with cycle detection
   - ✅ `lookup_inherited_method()` - Searches parent classes for methods
   - ✅ `lookup_interface_method()` - Resolves through interface implementations

3. **Interface Resolver** (`interface_resolver.ts`)
   - ✅ `get_implemented_interfaces()` - Gets all interfaces for a type
   - ✅ `find_method_implementation()` - Maps interface methods to concrete implementations
   - ✅ `is_method_implementation()` - Verifies implementation compatibility
   - ✅ `type_implements_interface()` - Checks interface relationships
   - ✅ `find_interface_implementations()` - Finds all types implementing an interface

4. **Enhanced Constructor Resolver** (`constructor_resolver.ts`)
   - ✅ `resolve_constructor_calls_enhanced()` - Main enhanced resolution
   - ✅ `resolve_constructor_with_inheritance()` - Finds constructors with parent fallback
   - ✅ `resolve_super_constructor_calls()` - Handles super() calls
   - ✅ `resolve_delegated_constructors()` - Handles this() constructor delegation
   - ✅ `find_default_constructor()` - Locates default constructors
   - ✅ `find_inherited_constructor()` - Searches parent classes for constructors
   - ✅ `find_explicit_constructor()` - Finds explicitly defined constructors

5. **Polymorphism Handler** (`polymorphism_handler.ts`)
   - ✅ `resolve_polymorphic_method_call()` - Resolves overridden methods
   - ✅ `find_all_method_implementations()` - Finds all implementations in hierarchy
   - ✅ `choose_most_specific_method()` - Selects most derived implementation
   - ✅ `is_method_override()` - Detects method overriding
   - ✅ `find_method_overrides()` - Finds all overrides of a method
   - ✅ `determine_dispatch_type()` - Identifies static vs dynamic dispatch

6. **Updated Main Resolver** (`method_resolver.ts`)
   - ✅ Integrated enhanced resolution with polymorphism support
   - ✅ Uses `resolve_polymorphic_method_call()` first for better override handling
   - ✅ Falls back to `resolve_method_with_inheritance()` for standard resolution
   - ✅ Uses `resolve_constructor_calls_enhanced()` for all constructor scenarios

7. **Comprehensive Tests**
   - ✅ Added tests for inheritance chain building and traversal
   - ✅ Added tests for interface method resolution
   - ✅ Added tests for method overriding and polymorphism
   - ✅ Added tests for constructor inheritance
   - ✅ All 23 tests passing

### Key Implementation Details

1. **Resolution Strategy**: Implemented a three-stage resolution approach:
   - Direct lookup (from basic resolution)
   - Inheritance chain traversal
   - Interface/trait method lookup

2. **Polymorphism Priority**: Enhanced resolution to try polymorphic method resolution first, then fall back to inheritance resolution if needed. This ensures better handling of method overrides.

3. **Constructor Enhancement**: Added support for:
   - Explicit constructors via type resolution constructors map
   - Default constructors with common language-specific names
   - Inherited constructors from parent classes
   - Super constructor calls
   - Delegated constructor calls (this())

4. **Cross-File Support**: All resolvers use `MethodLookupContext` with access to:
   - Current file index
   - All file indices
   - Type resolution data
   - Import resolution data

### Deviations from Original Plan

1. **Simplified Constructor Resolution**: Instead of the complex `ConstructorCall` type in the plan, used the existing `LocalConstructorCall` type from semantic index for simpler integration.

2. **Enhanced Polymorphism Handling**: Added `CallContext` type for better context management during polymorphic resolution, which wasn't in the original plan.

3. **Additional Utility Functions**: Added several helper functions not in the original plan:
   - `find_derived_types()` - Finds all types deriving from a base
   - `find_method_overrides()` - Finds all overrides of a method
   - `location_is_within()` - Helper for location containment checks

4. **Test Infrastructure**: Tests required adding inheritance and interface maps to the base test setup, ensuring all tests have proper type resolution context.

### Follow-On Work Identified

1. **Signature Matching Enhancement** (Low Priority)
   - Current `is_method_implementation()` only checks method names
   - Could add parameter type and return type matching for more accurate verification
   - Language-specific signature compatibility rules

2. **Performance Optimization** (Medium Priority)
   - Inheritance chain traversal could be cached
   - Pre-compute transitive closures for faster lookup
   - Memoize method resolution results

3. **Language-Specific Enhancements** (Medium Priority)
   - Python: Method Resolution Order (MRO) algorithm
   - JavaScript: Prototype chain handling
   - Rust: Trait bounds and associated types
   - TypeScript: Structural type compatibility

4. **Error Reporting** (Low Priority)
   - Add detailed error messages for unresolved methods
   - Track resolution attempts for debugging
   - Provide suggestions for typos in method names

5. **Generic Type Support** (Future Task)
   - Handle generic methods and type parameters
   - Resolve methods on parameterized types
   - Support bounded type parameters

### Testing Coverage

- ✅ Basic method resolution (instance and static)
- ✅ Constructor resolution
- ✅ Inheritance chain traversal
- ✅ Interface method resolution
- ✅ Method overriding and polymorphism
- ✅ Constructor inheritance
- ✅ Cross-file symbol definition lookup
- ✅ Error conditions and edge cases

### Performance Considerations

- Inheritance chains are traversed breadth-first with cycle detection
- Method lookups stop at first match for efficiency
- Polymorphic resolution finds all implementations then selects most specific
- No caching implemented yet (could be added for optimization)

### Integration Status

The enhanced method resolution is fully integrated into the symbol resolution pipeline and ready for use in Phase 4. The implementation provides comprehensive support for object-oriented codebases with inheritance, interfaces, and polymorphism.