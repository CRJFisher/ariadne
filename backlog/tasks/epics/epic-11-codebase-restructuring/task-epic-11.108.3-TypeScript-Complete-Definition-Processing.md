# Task 11.108.3: TypeScript - Complete Definition Processing

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.1 (builder enhancements)

## Objective

Ensure TypeScript builder properly tracks all definitions and nested objects, including:
- Migrating constructors to dedicated API
- Adding parameter tracking for interface methods
- Verifying all TypeScript-specific features work

## Current Status

TypeScript extends JavaScript but has additional features:
- ✅ All JavaScript features inherited
- ✅ Interfaces with methods and properties
- ✅ Type aliases, enums, namespaces
- ✅ Decorators
- ⚠️ Constructors added as methods (not using dedicated API)
- ❌ Interface method parameters NOT tracked
- ⚠️ Parameter properties need verification

## Changes Required

### 1. Migrate Constructor Handling

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`

TypeScript inherits JavaScript config, so constructor handling comes from parent. However, it's **overridden** around line 926:

**Current code (inherited override):**
```typescript
[
  "definition.class",
  {
    process: (capture, builder, context) => {
      const class_id = create_class_id(capture);
      const parent = capture.node.parent;

      builder.add_class({
        symbol_id: class_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: determine_availability(capture.node),
        abstract: is_abstract_class(capture.node),
        extends: parent ? extract_extends(parent) : [],
        implements: parent ? extract_implements(parent) : [],
        type_parameters: parent ? extract_type_parameters(parent) : [],
      });
    },
  },
],
```

**No explicit constructor handler override**, so it inherits from JavaScript. **Need to verify JavaScript's constructor handler is fixed first** (task 11.108.2).

### 2. Add Interface Method Parameter Tracking

**Current issue:** Interface methods added but their parameters are ignored.

**Current code (line 703-726):**
```typescript
[
  "definition.interface.method",
  {
    process: (capture, builder, context) => {
      const interface_id = find_containing_interface(capture);
      if (!interface_id) return;

      const method_id = create_method_signature_id(capture, capture.text);

      builder.add_method_signature_to_interface(interface_id, {
        symbol_id: method_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        optional: is_optional_member(capture.node),
        type_parameters: extract_type_parameters(capture.node.parent),
        return_type: extract_return_type(capture.node),
      });
    },
  },
],
```

**Problem:** Parameters for interface methods are never added!

**Solution 1: Check if query captures interface method parameters**

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/typescript.scm`

**Add or verify capture:**
```scheme
; Interface method signatures with parameters
(method_signature
  name: (property_identifier) @definition.interface.method
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @definition.interface.method.param)))
```

**Solution 2: Add handler for interface method parameters**

**Add after `definition.interface.method`:**
```typescript
[
  "definition.interface.method.param",
  {
    process: (capture, builder, context) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_interface_method(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        type: extract_parameter_type(capture.node),
        optional: is_optional_parameter(capture.node),
      });
    },
  },
],
```

**Helper function needed:**
```typescript
function find_containing_interface_method(capture: CaptureNode): SymbolId {
  let node = capture.node.parent;

  while (node) {
    if (node.type === "method_signature") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return method_symbol(nameNode.text as SymbolName, extract_location(nameNode));
      }
    }
    node = node.parent;
  }

  return method_symbol("unknown" as SymbolName, capture.location);
}

function is_optional_parameter(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent) {
    // Check for optional token (?)
    for (const child of parent.children || []) {
      if (child.type === "?" || child.text === "?") return true;
    }
  }
  return false;
}
```

### 3. Verify Parameter Properties

**Current code (line 1057-1085):**
```typescript
[
  "param.property",
  {
    process: (capture, builder, context) => {
      const class_id = find_containing_class(capture);
      if (!class_id) return;

      const prop_id = create_property_id(capture);

      builder.add_property_to_class(class_id, {
        symbol_id: prop_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: determine_method_availability(capture.node),
        access_modifier: extract_access_modifier(capture.node),
        readonly: is_readonly_property(capture.node),
        type: extract_parameter_type(capture.node),
        initial_value: undefined,
        is_parameter_property: true,
      });
    },
  },
],
```

**Issue:** Parameter properties are added to class, but are they also added to constructor parameters?

**Query check:** Does `param.property` capture both the parameter AND property aspects?

**Potential fix:** Parameter properties should ALSO be added as constructor parameters:
```typescript
[
  "param.property",
  {
    process: (capture, builder, context) => {
      const class_id = find_containing_class(capture);
      if (!class_id) return;

      const prop_id = create_property_id(capture);
      const param_id = create_parameter_id(capture);

      // Add as property
      builder.add_property_to_class(class_id, {
        symbol_id: prop_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: determine_method_availability(capture.node),
        access_modifier: extract_access_modifier(capture.node),
        readonly: is_readonly_property(capture.node),
        type: extract_parameter_type(capture.node),
        initial_value: undefined,
        is_parameter_property: true,
      });

      // ALSO add as constructor parameter
      const constructor_id = find_constructor_in_class(class_id);
      if (constructor_id) {
        builder.add_parameter_to_callable(constructor_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          readonly: is_readonly_property(capture.node),
        });
      }
    },
  },
],
```

**Helper needed:**
```typescript
function find_constructor_in_class(class_id: SymbolId): SymbolId | undefined {
  // This is tricky - we need to find the constructor symbol ID
  // Option: Generate predictable constructor ID based on class location
  // Or: Store constructor IDs during class/constructor processing
  // For now, return undefined and document as limitation
  return undefined;
}
```

**Alternative:** Don't duplicate - document that parameter properties are properties, not constructor parameters.

### 4. Verify All TypeScript-Specific Features

| Definition Type | Capture Name | Builder Method | Status |
|----------------|--------------|----------------|--------|
| Interface | `definition.interface` | `add_interface` | ✅ |
| Interface Method | `definition.interface.method` | `add_method_signature_to_interface` | ✅ |
| Interface Method Param | NEW | `add_parameter_to_callable` | ❌ Add |
| Interface Property | `definition.interface.property` | `add_property_signature_to_interface` | ✅ |
| Type Alias | `definition.type_alias` | `add_type` | ✅ |
| Enum | `definition.enum` | `add_enum` | ✅ |
| Enum Member | `definition.enum.member` | `add_enum_member` | ✅ |
| Namespace | `definition.namespace` | `add_namespace` | ✅ |
| Decorator (class) | `decorator.class` | `add_decorator_to_target` | ✅ |
| Decorator (method) | `decorator.method` | `add_decorator_to_target` | ✅ |
| Decorator (property) | `decorator.property` | `add_decorator_to_target` | ✅ |
| Parameter Property | `param.property` | `add_property_to_class` | ⚠️ Verify |
| Optional Parameter | `definition.parameter.optional` | `add_parameter_to_callable` | ✅ |

## Query File Changes

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/typescript.scm`

**Add interface method parameter capture:**
```scheme
; Interface method parameters
(method_signature
  name: (property_identifier) @definition.interface.method
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @definition.interface.method.param)
    (optional_parameter
      pattern: (identifier) @definition.interface.method.param.optional)))
```

## Testing Changes

**File:** `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

**Add test for interface method parameters:**
```typescript
it("should extract interface method parameters", () => {
  const code = `
    interface MyInterface {
      myMethod(x: string, y?: number): void;
    }
  `;

  const result = index_single_file(code, "test.ts" as FilePath, "typescript");

  const interface_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "interface" && d.name === "MyInterface"
  );

  expect(interface_def).toBeDefined();
  const methods = Array.from(interface_def?.methods?.values() || []);
  expect(methods).toHaveLength(1);

  const method = methods[0];
  expect(method.name).toBe("myMethod");
  expect(method.parameters).toHaveLength(2);
  expect(method.parameters[0].name).toBe("x");
  expect(method.parameters[0].type).toBe("string");
  expect(method.parameters[1].name).toBe("y");
  expect(method.parameters[1].type).toBe("number");
  expect(method.parameters[1].optional).toBe(true);
});
```

**Add test for parameter properties:**
```typescript
it("should extract parameter properties", () => {
  const code = `
    class MyClass {
      constructor(public x: number, private y: string) {}
    }
  `;

  const result = index_single_file(code, "test.ts" as FilePath, "typescript");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "MyClass"
  );

  expect(class_def).toBeDefined();
  expect(class_def?.properties?.size).toBe(2);

  const x_prop = Array.from(class_def?.properties?.values() || []).find(
    (p) => p.name === "x"
  );
  expect(x_prop).toBeDefined();
  expect(x_prop?.access_modifier).toBe("public");
  expect(x_prop?.type).toBe("number");
});
```

## Implementation Steps

1. **Update typescript.scm:**
   - Add interface method parameter captures

2. **Update typescript_builder.ts:**
   - Add `definition.interface.method.param` handler
   - Add helper functions
   - Verify parameter property handling

3. **Add tests:**
   - Interface method parameters
   - Parameter properties
   - Optional parameters in interfaces

4. **Compile and test:**
   ```bash
   npx tsc --noEmit packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts
   npm test -- semantic_index.typescript.test.ts
   ```

## Success Criteria

- ✅ Constructor uses `add_constructor_to_class` (inherited from JS fix)
- ✅ Interface methods have parameters tracked
- ✅ Parameter properties work correctly
- ✅ All TypeScript-specific features still work
- ✅ All tests pass

## Related Files

- [typescript_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts)
- [typescript.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/typescript.scm)
- [semantic_index.typescript.test.ts](../../../packages/core/src/index_single_file/semantic_index.typescript.test.ts)

## Notes

TypeScript adds complexity with interfaces, generics, and parameter properties. The key gaps are interface method parameters and ensuring parameter properties are handled correctly. Once these are fixed, TypeScript will have complete definition coverage.
