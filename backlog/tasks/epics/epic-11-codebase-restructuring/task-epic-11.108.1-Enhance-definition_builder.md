# Task 11.108.1: Enhance definition_builder.ts

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 4 hours
**Parent:** task-epic-11.108
**Dependencies:** None

## Objective

Add missing builder methods to [definition_builder.ts](../../../packages/core/src/index_single_file/definitions/definition_builder.ts) to support dedicated constructor tracking and proper parameter handling for all callable types.

## Current Issues

1. **No constructor API** - `ConstructorBuilderState` exists but no `add_constructor_to_class` method
2. **Limited parameter support** - `add_parameter_to_callable` doesn't find constructors or interface methods
3. **Workaround usage** - Constructors added as methods with special naming

## Changes Required

### 1. Add `add_constructor_to_class` Method

**Location:** After `add_method_to_class` (around line 348)

**Implementation:**
```typescript
/**
 * Add a constructor to a class
 *
 * Constructors are special methods that initialize class instances.
 * Unlike regular methods, they:
 * - Don't have explicit return types (implicitly return instance)
 * - Are called with 'new' keyword
 * - Initialize instance properties
 *
 * @param class_id - The class containing this constructor
 * @param definition - Constructor definition (location, scope, parameters handled separately)
 * @returns This builder for chaining
 */
add_constructor_to_class(
  class_id: SymbolId,
  definition: {
    symbol_id: SymbolId;
    location: Location;
    scope_id: ScopeId;
    availability: SymbolAvailability;
  }
): DefinitionBuilder {
  const class_state = this.classes.get(class_id);
  if (!class_state) {
    this.orphan_additions.push({
      type: "constructor",
      parent_id: class_id,
      data: definition,
    });
    return this;
  }

  class_state.constructor = {
    symbol_id: definition.symbol_id,
    location: definition.location,
    scope_id: definition.scope_id,
    availability: definition.availability,
    parameters: [],
  };

  return this;
}
```

### 2. Update `add_parameter_to_callable`

**Location:** Existing method (around line 312)

**Current code:**
```typescript
add_parameter_to_callable(
  callable_id: SymbolId,
  parameter: ParameterBuilderState
): DefinitionBuilder {
  // Check functions
  const func = this.functions.get(callable_id);
  if (func) {
    func.parameters.push(parameter);
    return this;
  }

  // Check methods in classes
  for (const class_state of this.classes.values()) {
    const method = class_state.methods.get(callable_id);
    if (method) {
      method.parameters.push(parameter);
      return this;
    }
  }

  // Not found - silently fail
  return this;
}
```

**Enhanced code:**
```typescript
add_parameter_to_callable(
  callable_id: SymbolId,
  parameter: ParameterBuilderState
): DefinitionBuilder {
  // Check functions
  const func = this.functions.get(callable_id);
  if (func) {
    func.parameters.push(parameter);
    return this;
  }

  // Check methods and constructors in classes
  for (const class_state of this.classes.values()) {
    // Check methods
    const method = class_state.methods.get(callable_id);
    if (method) {
      method.parameters.push(parameter);
      return this;
    }

    // Check constructor
    if (class_state.constructor?.symbol_id === callable_id) {
      class_state.constructor.parameters.push(parameter);
      return this;
    }
  }

  // Check method signatures in interfaces
  for (const interface_state of this.interfaces.values()) {
    const method_sig = interface_state.methods.get(callable_id);
    if (method_sig) {
      if (!method_sig.parameters) {
        method_sig.parameters = [];
      }
      method_sig.parameters.push(parameter);
      return this;
    }
  }

  // Not found - add to orphans for later processing
  this.orphan_additions.push({
    type: "parameter",
    parent_id: callable_id,
    data: parameter,
  });

  return this;
}
```

### 3. Update Orphan Processing

**Location:** `process_orphans` method (around line 167)

**Add handling for new orphan types:**
```typescript
private process_orphans(): void {
  for (const orphan of this.orphan_additions) {
    switch (orphan.type) {
      case "method":
        this.add_method_to_class(orphan.parent_id, orphan.data);
        break;
      case "property":
        this.add_property_to_class(orphan.parent_id, orphan.data);
        break;
      case "constructor":  // NEW
        this.add_constructor_to_class(orphan.parent_id, orphan.data);
        break;
      case "parameter":  // NEW
        this.add_parameter_to_callable(orphan.parent_id, orphan.data);
        break;
      // ... other cases
    }
  }
  this.orphan_additions = [];
}
```

### 4. Update Type Definitions

**Location:** Top of file (around line 91)

**Verify ConstructorBuilderState includes parameters:**
```typescript
interface ConstructorBuilderState {
  symbol_id: SymbolId;
  location: Location;
  scope_id: ScopeId;
  availability: SymbolAvailability;
  parameters: ParameterBuilderState[];  // Ensure this exists
}
```

**Update orphan type:**
```typescript
private orphan_additions: Array<{
  type: "method" | "property" | "constructor" | "parameter" | /* ... */;
  parent_id: SymbolId;
  data: any;
}> = [];
```

### 5. Update `build_constructor` Method

**Location:** Around line 685

**Ensure it handles parameters:**
```typescript
private build_constructor(
  state: ConstructorBuilderState
): ConstructorDefinition {
  return {
    symbol_id: state.symbol_id,
    location: state.location,
    scope_id: state.scope_id,
    availability: state.availability,
    parameters: state.parameters.map((p) => this.build_parameter(p)),
  };
}
```

### 6. Clarify `add_type` Documentation

**Location:** Around line 512

**Issue:** The method name `add_type` suggests it's for ALL types, but it's specifically for TYPE ALIASES.

**Current JSDoc:**
```typescript
/**
 * Add a type definition (type alias or type)
 */
add_type(definition: { /* ... */ }): DefinitionBuilder
```

**Enhanced JSDoc:**
```typescript
/**
 * Add a type ALIAS definition
 *
 * Type aliases create alternative names for type expressions.
 * This is NOT for type definitions (classes, interfaces, enums).
 *
 * Type ALIAS examples:
 * - TypeScript: `type Point = { x: number, y: number }`
 * - Rust: `type Kilometers = i32`
 * - Python: `Point: TypeAlias = tuple[int, int]`
 *
 * Type DEFINITION examples (use other methods):
 * - Classes: use `add_class` - creates new nominal type
 * - Interfaces: use `add_interface` - creates type contract
 * - Enums: use `add_enum` - creates enumerated type
 *
 * The distinction:
 * - Type ALIAS: transparent alternative name for existing type
 * - Type DEFINITION: creates new type with identity/structure
 *
 * @param definition - Type alias definition
 * @returns This builder for chaining
 */
add_type(definition: {
  kind: "type" | "type_alias";
  symbol_id: SymbolId;
  name: SymbolName;
  location: Location;
  scope_id: ScopeId;
  availability: SymbolAvailability;
  type_expression?: string;
  type_parameters?: string[];
}): DefinitionBuilder
```

**Why this matters:**
- Prevents confusion about when to use `add_type`
- Clarifies that classes/interfaces/enums are NOT aliases
- Documents the semantic distinction

## Testing Changes

### Unit Tests

Create test cases in `definition_builder.test.ts`:

```typescript
describe("add_constructor_to_class", () => {
  it("should add constructor to class", () => {
    const builder = new DefinitionBuilder(file_path);
    const class_id = class_symbol("MyClass", location);
    const constructor_id = method_symbol("constructor", location);

    builder
      .add_class({
        symbol_id: class_id,
        name: "MyClass",
        location,
        scope_id,
        availability: { scope: "public" }
      })
      .add_constructor_to_class(class_id, {
        symbol_id: constructor_id,
        location,
        scope_id,
        availability: { scope: "public" }
      });

    const result = builder.build();
    const class_def = result.definitions.get(class_id);

    expect(class_def).toBeDefined();
    expect(class_def?.constructor).toBeDefined();
    expect(class_def?.constructor?.symbol_id).toBe(constructor_id);
  });

  it("should handle constructor parameters", () => {
    const builder = new DefinitionBuilder(file_path);
    const class_id = class_symbol("MyClass", location);
    const constructor_id = method_symbol("constructor", location);
    const param_id = parameter_symbol("x", location);

    builder
      .add_class({ /* ... */ })
      .add_constructor_to_class(class_id, { /* ... */ })
      .add_parameter_to_callable(constructor_id, {
        symbol_id: param_id,
        name: "x",
        location,
        scope_id,
        type: "number"
      });

    const result = builder.build();
    const class_def = result.definitions.get(class_id);

    expect(class_def?.constructor?.parameters).toHaveLength(1);
    expect(class_def?.constructor?.parameters[0].name).toBe("x");
  });
});

describe("add_parameter_to_callable - enhanced", () => {
  it("should add parameters to constructors", () => {
    // Test case above
  });

  it("should add parameters to interface methods", () => {
    const builder = new DefinitionBuilder(file_path);
    const interface_id = interface_symbol("MyInterface", location);
    const method_id = method_symbol("myMethod", location);
    const param_id = parameter_symbol("x", location);

    builder
      .add_interface({ /* ... */ })
      .add_method_signature_to_interface(interface_id, {
        symbol_id: method_id,
        name: "myMethod",
        location,
        scope_id
      })
      .add_parameter_to_callable(method_id, {
        symbol_id: param_id,
        name: "x",
        location,
        scope_id,
        type: "string"
      });

    const result = builder.build();
    const interface_def = result.definitions.get(interface_id);
    const method_sig = interface_def?.methods?.get(method_id);

    expect(method_sig?.parameters).toHaveLength(1);
    expect(method_sig?.parameters[0].name).toBe("x");
  });

  it("should handle orphan parameters", () => {
    const builder = new DefinitionBuilder(file_path);
    const func_id = function_symbol("myFunc", location);
    const param_id = parameter_symbol("x", location);

    // Add parameter before function (orphan)
    builder
      .add_parameter_to_callable(func_id, {
        symbol_id: param_id,
        name: "x",
        location,
        scope_id
      })
      .add_function({
        symbol_id: func_id,
        name: "myFunc",
        location,
        scope_id,
        availability: { scope: "public" }
      });

    const result = builder.build();
    const func_def = result.definitions.get(func_id);

    expect(func_def?.parameters).toHaveLength(1);
  });
});
```

## Verification Steps

1. **TypeScript compilation:**
   ```bash
   npx tsc --noEmit packages/core/src/index_single_file/definitions/definition_builder.ts
   ```

2. **Run tests:**
   ```bash
   npm test packages/core/src/index_single_file/definitions/definition_builder.test.ts
   ```

3. **Verify method exists:**
   ```bash
   grep "add_constructor_to_class" packages/core/src/index_single_file/definitions/definition_builder.ts
   ```

4. **Check parameter handling:**
   ```bash
   grep -A 20 "add_parameter_to_callable" packages/core/src/index_single_file/definitions/definition_builder.ts
   ```

## Success Criteria

- ✅ `add_constructor_to_class` method implemented with JSDoc
- ✅ `add_parameter_to_callable` supports constructors
- ✅ `add_parameter_to_callable` supports interface methods
- ✅ Orphan handling supports new types
- ✅ All tests pass
- ✅ TypeScript compilation succeeds
- ✅ No breaking changes to existing API

## Related Files

- [definition_builder.ts](../../../packages/core/src/index_single_file/definitions/definition_builder.ts)
- [definition_builder.test.ts](../../../packages/core/src/index_single_file/definitions/definition_builder.test.ts)
- [BUILDER_AUDIT.md](../../../BUILDER_AUDIT.md)

## Notes

This enhancement unlocks proper constructor tracking across all languages. Once implemented, language builders can migrate from the method workaround to dedicated constructor support, improving semantic accuracy and enabling better analysis.
