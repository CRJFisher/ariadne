# Task: Basic Method Resolution and Type Lookup

**Task ID**: task-epic-11.91.3.1
**Parent**: task-epic-11.91.3
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Completed**: 2025-01-22
**Estimated Effort**: 1-1.5 days
**Actual Effort**: 0.5 days

## Problem Statement

Phase 4 method resolution requires foundational infrastructure for type-based method lookup and basic method call resolution. This task implements the core type lookup mechanisms, method matching algorithms, and basic resolution infrastructure that will be extended with inheritance support.

### Current State

After previous tasks:
- ✅ Import resolution (task 11.91.1)
- ✅ Function resolution (task 11.91.2)
- ✅ Type resolution refactoring (task 11.90)
- ❌ Method resolution infrastructure

## Solution Overview

Build basic method resolution infrastructure that provides:
- Type-based method lookup using resolved types
- Method call resolution for direct method access
- Static vs instance method handling
- Integration with existing type resolution system

### Architecture

```
symbol_resolution/
├── method_resolution/
│   ├── index.ts              # Public API
│   ├── method_types.ts       # Method resolution types
│   ├── type_lookup.ts        # Type-based method lookup
│   ├── method_resolver.ts    # Basic method resolution
│   └── static_resolution.ts  # Static vs instance handling
```

## Implementation Plan

### 1. Method Resolution Types

**Module**: `method_resolution/method_types.ts`

```typescript
interface MethodCallResolution {
  readonly call_location: Location;
  readonly resolved_method: SymbolId;
  readonly receiver_type: TypeId;
  readonly method_kind: "instance" | "static" | "constructor";
  readonly resolution_path: "direct" | "inherited" | "interface" | "trait";
  readonly receiver_symbol?: SymbolId;
}

interface MethodResolutionMap {
  readonly method_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly constructor_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly calls_to_method: ReadonlyMap<SymbolId, readonly Location[]>;
  readonly resolution_details: ReadonlyMap<LocationKey, MethodCallResolution>;
}

interface MethodLookupContext {
  readonly type_resolution: TypeResolutionMap;
  readonly imports: ImportResolutionMap;
  readonly current_file: FilePath;
  readonly current_index: SemanticIndex;
}

interface TypeMethodMap {
  readonly type_id: TypeId;
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;
  readonly static_methods: ReadonlyMap<SymbolName, SymbolId>;
  readonly constructors: ReadonlyMap<SymbolName, SymbolId>;
}
```

### 2. Type-Based Method Lookup

**Module**: `method_resolution/type_lookup.ts`

Core method lookup using type information:

```typescript
export function resolve_method_on_type(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Get method map for this type
  const type_methods = get_type_methods(receiver_type, context);
  if (!type_methods) {
    return null;
  }

  // Choose appropriate method map based on call type
  const method_map = is_static_call ? type_methods.static_methods : type_methods.methods;
  const method_symbol = method_map.get(method_name);

  if (method_symbol) {
    return {
      call_location: null as any, // Will be set by caller
      resolved_method: method_symbol,
      receiver_type,
      method_kind: is_static_call ? "static" : "instance",
      resolution_path: "direct"
    };
  }

  return null;
}

function get_type_methods(
  type_id: TypeId,
  context: MethodLookupContext
): TypeMethodMap | null {
  // Use type resolution to get type members
  const type_members = context.type_resolution.type_members.get(type_id);
  if (!type_members) {
    return null;
  }

  // Build method maps by examining symbol definitions
  const methods = new Map<SymbolName, SymbolId>();
  const static_methods = new Map<SymbolName, SymbolId>();
  const constructors = new Map<SymbolName, SymbolId>();

  for (const [member_name, member_symbol] of type_members) {
    const symbol_def = find_symbol_definition(member_symbol, context);
    if (!symbol_def) continue;

    switch (symbol_def.kind) {
      case "method":
        if (symbol_def.modifiers?.includes("static")) {
          static_methods.set(member_name, member_symbol);
        } else {
          methods.set(member_name, member_symbol);
        }
        break;

      case "constructor":
        constructors.set(member_name, member_symbol);
        break;
    }
  }

  return { type_id, methods, static_methods, constructors };
}

function find_symbol_definition(
  symbol_id: SymbolId,
  context: MethodLookupContext
): SymbolDefinition | null {
  // First try current file
  const current_def = context.current_index.symbols.get(symbol_id);
  if (current_def) {
    return current_def;
  }

  // Search in other files (symbols might be imported)
  for (const [file_path, file_index] of context.type_resolution.indices) {
    const symbol_def = file_index.symbols.get(symbol_id);
    if (symbol_def) {
      return symbol_def;
    }
  }

  return null;
}
```

### 3. Method Call Resolution

**Module**: `method_resolution/method_resolver.ts`

Main method call resolution algorithm:

```typescript
export function resolve_method_calls(
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

    // Process member access calls (obj.method())
    for (const member_access of index.references.member_accesses) {
      const resolution = resolve_member_access_call(member_access, context);
      if (resolution) {
        record_method_resolution(resolution, member_access.location, method_calls, calls_to_method, resolution_details);
      }
    }

    // Process constructor calls (new Class())
    const constructor_resolutions = resolve_constructor_calls_basic(index, context);
    for (const resolution of constructor_resolutions) {
      record_constructor_resolution(resolution, constructor_calls, calls_to_method, resolution_details);
    }
  }

  return { method_calls, constructor_calls, calls_to_method, resolution_details };
}

function resolve_member_access_call(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Get receiver type from type flow
  const receiver_type = get_receiver_type(member_access, context);
  if (!receiver_type) {
    return null;
  }

  // Determine if this is a static call
  const is_static_call = determine_if_static_call(member_access, context);

  // Look up method on type
  return resolve_method_on_type(
    member_access.member_name,
    receiver_type,
    is_static_call,
    context
  );
}

function get_receiver_type(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): TypeId | null {
  // Use type flow to get receiver type
  const local_type_flow = context.current_index.local_type_flow;
  if (!local_type_flow) return null;

  // Look for type information at the member access location
  for (const type_ref of local_type_flow.type_references) {
    if (locations_overlap(type_ref.location, member_access.receiver_location)) {
      return type_ref.type_id;
    }
  }

  // Fallback: try to resolve receiver symbol and get its type
  return resolve_receiver_symbol_type(member_access, context);
}

function resolve_receiver_symbol_type(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): TypeId | null {
  // If receiver is a simple identifier, try to find its type
  const receiver_symbol = find_symbol_at_location(
    member_access.receiver_location,
    context.current_index
  );

  if (receiver_symbol) {
    return context.type_resolution.symbol_types.get(receiver_symbol) || null;
  }

  return null;
}
```

### 4. Static vs Instance Resolution

**Module**: `method_resolution/static_resolution.ts`

Handle static method vs instance method distinction:

```typescript
export function determine_if_static_call(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): boolean {
  // Check if receiver is a type name (static call) or instance (instance call)

  // 1. Check if member access is explicitly marked as static
  if (member_access.is_static_access === true) {
    return true;
  }

  // 2. Check if receiver is a type identifier rather than instance
  const receiver_symbol = find_symbol_at_location(
    member_access.receiver_location,
    context.current_index
  );

  if (receiver_symbol) {
    const symbol_def = context.current_index.symbols.get(receiver_symbol);
    if (symbol_def && (symbol_def.kind === "class" || symbol_def.kind === "type")) {
      return true; // Calling method on class/type directly
    }
  }

  // 3. Default to instance method
  return false;
}

export function get_method_kind(
  method_symbol: SymbolId,
  context: MethodLookupContext
): "instance" | "static" | "constructor" {
  const symbol_def = find_symbol_definition(method_symbol, context);
  if (!symbol_def) {
    return "instance"; // Default
  }

  if (symbol_def.kind === "constructor") {
    return "constructor";
  }

  if (symbol_def.modifiers?.includes("static")) {
    return "static";
  }

  return "instance";
}
```

### 5. Constructor Call Resolution

Basic constructor call handling:

```typescript
function resolve_constructor_calls_basic(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  // Process constructor calls from type flow
  if (index.local_type_flow?.constructor_calls) {
    for (const ctor_call of index.local_type_flow.constructor_calls) {
      const resolution = resolve_constructor_call_basic(ctor_call, context);
      if (resolution) {
        resolutions.push(resolution);
      }
    }
  }

  return resolutions;
}

function resolve_constructor_call_basic(
  ctor_call: ConstructorCall,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Get the type being constructed
  const constructed_type = ctor_call.constructed_type;
  if (!constructed_type) {
    return null;
  }

  // Find constructor method for this type
  const type_methods = get_type_methods(constructed_type, context);
  if (!type_methods) {
    return null;
  }

  // Look for default constructor or named constructor
  const constructor_name = ctor_call.constructor_name || "constructor" as SymbolName;
  const constructor_symbol = type_methods.constructors.get(constructor_name);

  if (constructor_symbol) {
    return {
      call_location: ctor_call.location,
      resolved_method: constructor_symbol,
      receiver_type: constructed_type,
      method_kind: "constructor",
      resolution_path: "direct"
    };
  }

  return null;
}
```

### 6. Helper Functions

```typescript
function record_method_resolution(
  resolution: MethodCallResolution,
  location: Location,
  method_calls: Map<LocationKey, SymbolId>,
  calls_to_method: Map<SymbolId, Location[]>,
  resolution_details: Map<LocationKey, MethodCallResolution>
): void {
  const location_key_val = location_key(location);

  // Update resolution with correct location
  const complete_resolution = { ...resolution, call_location: location };

  method_calls.set(location_key_val, resolution.resolved_method);
  resolution_details.set(location_key_val, complete_resolution);

  // Update reverse mapping
  const call_locations = calls_to_method.get(resolution.resolved_method) || [];
  call_locations.push(location);
  calls_to_method.set(resolution.resolved_method, call_locations);
}

function locations_overlap(loc1: Location, loc2: Location): boolean {
  return (
    loc1.file_path === loc2.file_path &&
    loc1.start_line <= loc2.end_line &&
    loc1.end_line >= loc2.start_line
  );
}

function find_symbol_at_location(
  location: Location,
  index: SemanticIndex
): SymbolId | null {
  // Find symbol definition that contains this location
  for (const [symbol_id, symbol_def] of index.symbols) {
    if (locations_overlap(symbol_def.location, location)) {
      return symbol_id;
    }
  }
  return null;
}
```

## Testing Strategy

### Unit Tests

- Type-based method lookup with various type structures
- Static vs instance method resolution
- Basic constructor call resolution
- Method resolution priority and accuracy

### Test Fixtures

```
fixtures/
├── method_resolution/
│   ├── basic_methods/
│   ├── static_methods/
│   ├── constructor_calls/
│   └── type_based_lookup/
└── integration/
    ├── mixed_calls/
    └── cross_file_methods/
```

## Success Criteria

1. **Type-Based Lookup**: Accurately resolves methods using type information
2. **Static/Instance Distinction**: Correctly handles static vs instance methods
3. **Constructor Resolution**: Basic constructor call resolution works
4. **Integration**: Seamlessly uses existing type resolution data
5. **Performance**: Efficient lookup for common method call patterns

## Dependencies

- **Prerequisite**: task-epic-11.91.1 (Import resolution)
- **Prerequisite**: task-epic-11.91.2 (Function resolution)
- **Prerequisite**: task-epic-11.90 (Type resolution refactoring) - ✅ Complete
- **Enables**: task-epic-11.91.3.2 (Inheritance chain resolution)

## Implementation Notes

- Leverage existing type resolution from task 11.90
- Focus on direct method resolution, defer inheritance to 11.91.3.2
- Use type flow information from semantic_index where available
- Handle missing type information gracefully
- Optimize for common method call patterns

## References

- Existing type_resolution modules from task 11.90
- Method call semantics for supported languages
- Type flow and member access extraction from semantic_index
- Object-oriented programming method resolution principles

## Implementation Notes

**Completed**: 2025-01-22

### Modules Implemented

1. **method_types.ts** - Core type definitions for method resolution
2. **type_lookup.ts** - Type-based method lookup functionality
3. **static_resolution.ts** - Static vs instance method determination
4. **method_resolver.ts** - Main method and constructor resolution algorithm
5. **index.ts** - Public API exports

### Key Design Decisions

1. **Receiver Type Resolution**: Enhanced to handle static method calls by looking up class types in file_symbols_by_name when receiver location doesn't have explicit type information
2. **Type Method Categorization**: get_type_methods() separates methods into static/instance/constructor categories by examining symbol modifiers
3. **Constructor Resolution**: Dual approach - looks for constructors in type_methods first, falls back to type_resolution.constructors map
4. **Fallback Strategy**: When direct type lookup fails, tries to resolve through symbol lookup and type mapping

### Test Coverage

- Instance method resolution ✅
- Static method resolution ✅
- Constructor call resolution ✅
- Static vs instance method differentiation ✅

### Integration Points

- Uses TypeResolutionMap from Phase 3 (task 11.90)
- Reads MemberAccessReference from semantic_index
- Processes LocalConstructorCall from type flow references
- Integrates with existing symbol and type resolution infrastructure

### Known Limitations

- Inheritance resolution deferred to task 11.91.3.2
- Interface/trait method resolution not yet implemented
- No support for method overloading disambiguation
- Cross-file method resolution depends on complete type resolution

### Next Steps

- Task 11.91.3.2 will add inheritance chain resolution
- Enhanced constructor resolution with parameter matching
- Support for interface and trait method resolution

## Implementation Results & Deviations

### Delivered Functionality

All planned core functionality was delivered:
- ✅ Type-based method lookup infrastructure
- ✅ Method matching algorithms (basic implementation)
- ✅ Static vs instance method determination
- ✅ Basic constructor call resolution
- ✅ Integration with existing type resolution system

### Deviations from Original Plan

1. **Receiver Type Resolution Enhancement**: Original plan assumed receiver types would always be available from type flow. Implementation required adding fallback strategy using file_symbols_by_name for cases like static method calls on class names (e.g., `MyClass.staticMethod()`).

2. **Dual Constructor Resolution**: Plan assumed constructors would be in type_members. Implementation needed to check both type_members.constructors and the separate TypeResolutionMap.constructors for flexibility.

3. **Test Infrastructure Requirements**: Tests revealed that file_symbols_by_name must be properly populated for method resolution to work correctly - this wasn't explicitly mentioned in the original design.

### Discovered Issues & Solutions

1. **Static Method Call Resolution**: Initially failed for patterns like `ClassName.staticMethod()`. Solution: Enhanced resolve_receiver_symbol_type() to iterate through file symbols looking for matching types with the requested method.

2. **Missing Type Information**: When receiver locations lack explicit type information, the system now tries multiple resolution strategies rather than failing immediately.

3. **Symbol Definition Lookup**: Had to implement cross-file symbol definition lookup in find_symbol_definition() to handle symbols defined in other files.

### Work Deferred or Out of Scope

1. **Method Overloading**: No disambiguation based on parameter types/count (would require signature matching)
2. **Generic Methods**: Type parameter resolution not implemented
3. **Cross-file Optimization**: Current implementation does linear search through all files
4. **Complex Receiver Expressions**: Only handles simple member access, not chained calls or complex expressions

### Follow-on Tasks Identified

1. **High Priority (for 11.91.3.2)**:
   - Inheritance chain traversal for inherited methods
   - Interface method resolution
   - Trait/mixin support

2. **Medium Priority (potential new tasks)**:
   - **Parameter-based resolution**: Match constructors/methods based on argument types
   - **Performance optimization**: Index methods by type for O(1) lookup
   - **Generic type resolution**: Handle parameterized types in method calls

3. **Low Priority (nice-to-have)**:
   - Method resolution caching
   - Diagnostic information for unresolved methods
   - Support for extension methods (language-specific)

### Lessons Learned

1. **Type Resolution Dependency**: Method resolution is heavily dependent on complete and accurate type resolution from Phase 3. Any gaps in type information cascade into method resolution failures.

2. **Fallback Strategies Essential**: Real-world code often lacks complete type annotations, requiring multiple resolution strategies.

3. **Test Data Setup Critical**: Tests must properly setup all data structures (symbols, types, file_symbols_by_name) that production code expects.

### Recommendations for Next Tasks

1. **11.91.3.2 Implementation**: Should focus on inheritance first, as it's the most common OOP pattern
2. **Consider separate task**: Interface/trait resolution might warrant its own focused task
3. **Performance profiling**: Before optimization task, profile with real codebases to identify bottlenecks
4. **Documentation**: Consider adding usage examples and resolution strategy documentation