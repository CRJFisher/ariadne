# Task: Enhance Method and Constructor Resolution

**Task ID**: task-epic-11.91.3
**Parent**: task-epic-11.91
**Status**: Created
**Priority**: Critical
**Created**: 2025-01-20
**Estimated Effort**: 2-3 days

## Problem Statement

Phase 4 of the symbol resolution pipeline has a basic implementation but lacks the integration with Phases 1-2 and sophisticated type-based resolution. With import and function resolution now available, method and constructor resolution can be significantly enhanced.

### Current State

```typescript
// symbol_resolution.ts - Phase 4 has basic implementation
function phase4_resolve_methods(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap
): MethodResolutionMap {
  // Basic implementation exists but needs enhancement
  // - Limited type-based method lookup
  // - No inheritance chain resolution
  // - Missing static vs instance method handling
  // - No constructor resolution integration
}
```

## Solution Overview

Enhance Phase 4 to provide comprehensive method and constructor resolution using fully resolved types, inheritance chains, and import context from previous phases.

### Architecture

```
symbol_resolution/
├── method_resolution/
│   ├── index.ts              # Public API
│   ├── method_resolver.ts    # Enhanced method resolution
│   ├── constructor_resolver.ts # Constructor call resolution
│   ├── type_lookup.ts        # Type-based method lookup
│   ├── inheritance_resolver.ts # Method inheritance resolution
│   ├── method_types.ts       # Type definitions
│   └── language_handlers/    # Language-specific method resolution
│       ├── javascript.ts     # JS/TS method resolution
│       ├── python.ts         # Python method resolution
│       └── rust.ts           # Rust method resolution
```

## Implementation Plan

### 1. Enhanced Type Infrastructure

**Module**: `method_resolution/method_types.ts`

Define enhanced resolution data structures:

```typescript
interface MethodResolution {
  call_location: Location;
  resolved_method: SymbolId;
  receiver_type: TypeId;
  method_kind: "instance" | "static" | "constructor";
  resolution_path: "direct" | "inherited" | "interface" | "trait";
  inheritance_chain?: TypeId[];
}

interface MethodLookupContext {
  receiver_type: TypeId;
  method_name: SymbolName;
  type_members: Map<TypeId, Map<SymbolName, SymbolId>>;
  inheritance_hierarchy: Map<TypeId, TypeId[]>;
  interfaces: Map<TypeId, TypeId[]>;
}
```

### 2. Type-Based Method Lookup

**Module**: `method_resolution/type_lookup.ts`

Implement sophisticated method resolution using type information:

```typescript
function resolve_method_on_type(
  method_name: SymbolName,
  receiver_type: TypeId,
  context: MethodLookupContext
): MethodResolution | null {
  // 1. Try direct method lookup on type
  const direct_method = lookup_direct_method(method_name, receiver_type, context);
  if (direct_method) {
    return {
      resolved_method: direct_method,
      receiver_type,
      method_kind: "instance",
      resolution_path: "direct"
    };
  }

  // 2. Try inherited method lookup
  const inherited_method = lookup_inherited_method(method_name, receiver_type, context);
  if (inherited_method) {
    return inherited_method;
  }

  // 3. Try interface/trait method lookup
  const interface_method = lookup_interface_method(method_name, receiver_type, context);
  if (interface_method) {
    return interface_method;
  }

  return null;
}
```

### 3. Inheritance Chain Resolution

**Module**: `method_resolution/inheritance_resolver.ts`

Handle method resolution through inheritance hierarchies:

```typescript
function lookup_inherited_method(
  method_name: SymbolName,
  receiver_type: TypeId,
  context: MethodLookupContext
): MethodResolution | null {
  const inheritance_chain = build_inheritance_chain(receiver_type, context);

  for (const ancestor_type of inheritance_chain) {
    const method_symbol = context.type_members.get(ancestor_type)?.get(method_name);

    if (method_symbol) {
      return {
        resolved_method: method_symbol,
        receiver_type,
        method_kind: "instance",
        resolution_path: "inherited",
        inheritance_chain
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

  let current_types = context.inheritance_hierarchy.get(type_id) || [];

  while (current_types.length > 0) {
    const next_types: TypeId[] = [];

    for (const parent_type of current_types) {
      if (!visited.has(parent_type)) {
        visited.add(parent_type);
        chain.push(parent_type);

        const grandparents = context.inheritance_hierarchy.get(parent_type) || [];
        next_types.push(...grandparents);
      }
    }

    current_types = next_types;
  }

  return chain;
}
```

### 4. Constructor Call Resolution

**Module**: `method_resolution/constructor_resolver.ts`

Enhance constructor call resolution with type integration:

```typescript
function resolve_constructor_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  types: TypeResolutionMap,
  imports: ImportResolutionMap
): Map<Location, SymbolId> {
  const constructor_calls = new Map<Location, SymbolId>();

  for (const [file_path, index] of indices) {
    // Process constructor calls from type flow
    if (index.local_type_flow?.constructor_calls) {
      for (const ctor_call of index.local_type_flow.constructor_calls) {
        const resolved_constructor = resolve_constructor_call(
          ctor_call,
          types,
          imports.imports.get(file_path) || new Map(),
          index
        );

        if (resolved_constructor) {
          constructor_calls.set(ctor_call.location, resolved_constructor);
        }
      }
    }

    // Process constructor calls from call references
    for (const call_ref of index.references.calls) {
      if (call_ref.call_type === "constructor") {
        const resolved_constructor = resolve_constructor_from_call_ref(
          call_ref,
          types,
          imports.imports.get(file_path) || new Map(),
          index
        );

        if (resolved_constructor) {
          constructor_calls.set(call_ref.location, resolved_constructor);
        }
      }
    }
  }

  return constructor_calls;
}
```

### 5. Static vs Instance Method Resolution

Handle different method call types:

```typescript
function determine_method_kind(
  call_ref: CallReference,
  receiver_type: TypeId,
  method_symbol: SymbolId,
  symbols: Map<SymbolId, SymbolDefinition>
): "instance" | "static" {
  // Check if explicitly marked as static call
  if (call_ref.is_static_call === true) {
    return "static";
  }

  // Check method definition for static modifier
  const method_def = symbols.get(method_symbol);
  if (method_def && method_def.modifiers?.includes("static")) {
    return "static";
  }

  // Default to instance method
  return "instance";
}
```

### 6. Enhanced Phase 4 Integration

Update the main Phase 4 function to use enhanced resolution:

```typescript
function phase4_resolve_methods(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap
): MethodResolutionMap {
  const method_calls = new Map<Location, SymbolId>();
  const constructor_calls = resolve_constructor_calls(indices, types, imports);
  const calls_to_method = new Map<SymbolId, Location[]>();

  // Enhanced method call resolution
  for (const [file_path, index] of indices) {
    for (const member_access of index.references.member_accesses) {
      const resolved_method = resolve_member_access_call(
        member_access,
        types,
        imports.imports.get(file_path) || new Map(),
        index
      );

      if (resolved_method) {
        method_calls.set(member_access.location, resolved_method);

        // Update reverse mapping
        const call_locations = calls_to_method.get(resolved_method) || [];
        call_locations.push(member_access.location);
        calls_to_method.set(resolved_method, call_locations);
      }
    }
  }

  // Merge constructor calls into calls_to_method
  for (const [location, constructor_id] of constructor_calls) {
    const call_locations = calls_to_method.get(constructor_id) || [];
    call_locations.push(location);
    calls_to_method.set(constructor_id, call_locations);
  }

  return { method_calls, constructor_calls, calls_to_method };
}
```

## Language-Specific Enhancements

### JavaScript/TypeScript

**Module**: `language_handlers/javascript.ts`

- Class method resolution with inheritance
- Interface method implementation
- Generic method instantiation
- Prototype chain method lookup
- Static method vs instance method distinction

### Python

**Module**: `language_handlers/python.ts`

- Class method resolution with MRO (Method Resolution Order)
- Static methods vs class methods vs instance methods
- Property vs method distinction
- Multiple inheritance resolution
- Descriptor protocol handling

### Rust

**Module**: `language_handlers/rust.ts`

- Trait method resolution
- Associated functions vs methods
- Implementation block method lookup
- Generic trait implementations
- Method receiver types (self, &self, &mut self)

## Integration with Previous Phases

### Import Resolution Integration

Use resolved imports for cross-file method resolution:

```typescript
function resolve_imported_type_method(
  method_name: SymbolName,
  type_name: SymbolName,
  imports: Map<SymbolName, SymbolId>,
  types: TypeResolutionMap
): SymbolId | null {
  // 1. Check if type is imported
  const imported_type_symbol = imports.get(type_name);
  if (!imported_type_symbol) return null;

  // 2. Find TypeId for imported symbol
  const type_id = types.symbol_types.get(imported_type_symbol);
  if (!type_id) return null;

  // 3. Look up method on resolved type
  const type_members = types.type_members.get(type_id);
  return type_members?.get(method_name) || null;
}
```

### Function Resolution Integration

Leverage function resolution for method calls that might be function calls:

```typescript
function resolve_ambiguous_call(
  call_ref: CallReference,
  functions: FunctionResolutionMap,
  method_resolution: MethodResolution | null
): SymbolId | null {
  // If method resolution succeeded, prefer it
  if (method_resolution) {
    return method_resolution.resolved_method;
  }

  // Fall back to function resolution
  return functions.function_calls.get(call_ref.location) || null;
}
```

## Testing Strategy

### Unit Tests

- Type-based method lookup
- Inheritance chain resolution
- Static vs instance method resolution
- Constructor call resolution
- Cross-file method resolution

### Integration Tests

- Complex inheritance hierarchies
- Interface implementation resolution
- Generic method instantiation
- Multi-language method resolution
- Performance tests on large class hierarchies

### Test Fixtures

```
fixtures/
├── javascript/
│   ├── class_inheritance/
│   ├── interface_implementation/
│   └── static_methods/
├── typescript/
│   ├── generic_methods/
│   ├── method_overloads/
│   └── abstract_classes/
├── python/
│   ├── multiple_inheritance/
│   ├── method_resolution_order/
│   └── metaclasses/
└── rust/
    ├── trait_methods/
    ├── associated_functions/
    └── generic_traits/
```

## Success Criteria

1. **Accurate Method Resolution**: Method calls correctly mapped to definitions through inheritance
2. **Constructor Resolution**: Constructor calls properly resolved with type context
3. **Static vs Instance**: Correct distinction between static and instance methods
4. **Cross-File Support**: Method resolution works across module boundaries
5. **Multi-Language**: Handles language-specific method resolution semantics
6. **Performance**: Efficient resolution for complex inheritance hierarchies

## Dependencies

- **Prerequisite**: task-epic-11.91.1 (Import resolution)
- **Prerequisite**: task-epic-11.91.2 (Function resolution)
- **Prerequisite**: task-epic-11.90 (Type resolution refactoring) - ✅ Complete
- **Enables**: Complete call graph construction
- **Enables**: Advanced IDE features (method hierarchy, implementations)

## Risks and Mitigations

### Risk 1: Complex Inheritance Semantics

Each language has unique inheritance and method resolution rules.

**Mitigation**: Implement language-specific handlers, extensive test coverage for edge cases.

### Risk 2: Performance with Deep Hierarchies

Method resolution through deep inheritance chains can be expensive.

**Mitigation**: Cache inheritance chains, optimize lookup algorithms.

### Risk 3: Ambiguous Method Calls

Some calls may be ambiguous between functions and methods.

**Mitigation**: Clear resolution priority rules, fallback mechanisms.

## Implementation Notes

- Leverage existing type_resolution modules from task-epic-11.90
- Use inheritance resolution from `symbol_resolution/type_resolution/inheritance.ts`
- Follow functional programming patterns
- Include comprehensive logging for resolution decisions
- Support incremental re-resolution for changed types

## References

- JavaScript prototype chain specification
- Python Method Resolution Order (MRO) documentation
- Rust trait system guide
- TypeScript interface implementation rules
- Existing type_resolution implementation