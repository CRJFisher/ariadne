# Task 11.108.2: JavaScript - Complete Definition Processing

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2-3 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.1 (builder enhancements)

## Objective

Ensure JavaScript builder properly tracks all definitions and nested objects, migrating from constructor-as-method workaround to dedicated constructor support.

## Current Status

JavaScript builder is mostly complete but uses workarounds:
- ✅ Classes, methods, functions tracked
- ✅ Parameters tracked for functions and methods
- ✅ Properties tracked
- ✅ Imports tracked
- ⚠️ Constructors added as methods (not using dedicated API)
- ⚠️ Constructor parameters tracked via method parameters

## Changes Required

### 1. Migrate Constructor Handling

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`

**Current code (line 459-484):**
```typescript
[
  "definition.constructor",
  {
    process: (capture, builder, context) => {
      const class_id = find_containing_class(capture);
      if (class_id) {
        const constructor_id = method_symbol("constructor", capture.location);
        builder.add_method_to_class(class_id, {  // ❌ Wrong method
          symbol_id: constructor_id,
          name: "constructor",
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_method_availability(capture.node),
          return_type: undefined,
        });
      }
    },
  },
],
```

**New code:**
```typescript
[
  "definition.constructor",
  {
    process: (capture, builder, context) => {
      const class_id = find_containing_class(capture);
      if (class_id) {
        const constructor_id = method_symbol("constructor", capture.location);
        builder.add_constructor_to_class(class_id, {  // ✅ Dedicated API
          symbol_id: constructor_id,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_method_availability(capture.node),
        });
      }
    },
  },
],
```

### 2. Verify Parameter Tracking

**Check that parameters are added to all callables:**
- Functions: `definition.function`, `definition.arrow` → parameters via `definition.param`
- Methods: `definition.method` → parameters via `definition.param`
- Constructors: `definition.constructor` → parameters via `definition.param`

**Current parameter handling (line 529-548):**
```typescript
[
  "definition.param",
  {
    process: (capture, builder, context) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        type: extract_parameter_type(capture.node),
        default_value: extract_default_value(capture.node),
      });
    },
  },
],
```

**Verify `find_containing_callable` finds constructors:**

The function needs to check for constructor nodes:
```typescript
function find_containing_callable(capture: CaptureNode): SymbolId {
  let node = capture.node;

  while (node) {
    // Check for method_definition first (includes constructor)
    if (node.type === "method_definition") {
      const nameNode = node.childForFieldName?.("name");
      const methodName = nameNode ? nameNode.text : "anonymous";
      return method_symbol(methodName as SymbolName, extract_location(nameNode || node));
    }

    if (
      node.type === "function_declaration" ||
      node.type === "function_expression" ||
      node.type === "arrow_function"
    ) {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return function_symbol(nameNode.text as SymbolName, extract_location(nameNode));
      } else {
        return function_symbol("anonymous" as SymbolName, extract_location(node));
      }
    }

    node = node.parent || null;
  }

  return function_symbol("anonymous" as SymbolName, capture.location);
}
```

**Should already work** - method_definition covers constructors.

### 3. Query File Verification

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/javascript.scm`

**Verify these captures exist:**

```scheme
; Classes
(class_declaration
  name: (identifier) @definition.class)

; Constructors
(method_definition
  name: (property_identifier) @definition.constructor
  (#eq? @definition.constructor "constructor"))

; Methods
(method_definition
  name: (property_identifier) @definition.method
  (#not-eq? @definition.method "constructor"))

; Parameters (should match constructor parameters)
(formal_parameters
  (identifier) @definition.param)

; Properties
(public_field_definition
  property: (property_identifier) @definition.field)
```

**No changes needed** - queries should already capture constructors and parameters.

### 4. Double-Check All Definition Types

Review builder config for completeness:

| Definition Type | Capture Name | Builder Method | Status |
|----------------|--------------|----------------|--------|
| Class | `definition.class` | `add_class` | ✅ |
| Constructor | `definition.constructor` | `add_constructor_to_class` | ⚠️ Update |
| Method | `definition.method` | `add_method_to_class` | ✅ |
| Function | `definition.function` | `add_function` | ✅ |
| Arrow Function | `definition.arrow` | `add_function` | ✅ |
| Parameter | `definition.param` | `add_parameter_to_callable` | ✅ |
| Parameter | `definition.parameter` | `add_parameter_to_callable` | ✅ |
| Variable | `definition.variable` | `add_variable` | ✅ |
| Property | `definition.field` | `add_property_to_class` | ✅ |
| Property | `definition.property` | `add_property_to_class` | ✅ |
| Import | `definition.import` | `add_import` | ✅ |
| Import Named | `import.named` | `add_import` | ✅ |
| Import Default | `import.default` | `add_import` | ✅ |
| Import Namespace | `import.namespace` | `add_import` | ✅ |

## Testing Changes

### Verification Test Cases

**File:** `packages/core/src/index_single_file/semantic_index.javascript.test.ts`

**Add test for constructor with parameters:**

```typescript
it("should extract constructor with parameters", () => {
  const code = `
    class MyClass {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
    }
  `;

  const result = index_single_file(code, "test.js" as FilePath, "javascript");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "MyClass"
  );

  expect(class_def).toBeDefined();
  expect(class_def?.constructor).toBeDefined();
  expect(class_def?.constructor?.parameters).toHaveLength(2);
  expect(class_def?.constructor?.parameters[0].name).toBe("x");
  expect(class_def?.constructor?.parameters[1].name).toBe("y");
});
```

## Implementation Steps

1. **Update constructor handling:**
   - Change `add_method_to_class` to `add_constructor_to_class`
   - Remove `return_type: undefined` (not needed for constructors)

2. **Verify parameter tracking:**
   - Run existing tests to ensure parameters still tracked
   - Add new test for constructor parameters

3. **Compile and test:**
   ```bash
   npx tsc --noEmit packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts
   npm test -- semantic_index.javascript.test.ts
   ```

## Verification Steps

1. **Constructor migration:**
   ```bash
   grep -n "add_constructor_to_class" packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts
   ```
   Should find usage in `definition.constructor` handler.

2. **No more constructor-as-method:**
   ```bash
   grep -A 5 "definition.constructor" packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts | grep "add_method_to_class"
   ```
   Should return nothing.

3. **Tests pass:**
   ```bash
   npm test -- semantic_index.javascript.test.ts
   ```

## Success Criteria

- ✅ Constructor uses `add_constructor_to_class` not `add_method_to_class`
- ✅ Constructor parameters tracked via `add_parameter_to_callable`
- ✅ All existing tests pass
- ✅ New test for constructor parameters passes
- ✅ No regression in other definition types

## Related Files

- [javascript_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts)
- [javascript.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/javascript.scm)
- [semantic_index.javascript.test.ts](../../../packages/core/src/index_single_file/semantic_index.javascript.test.ts)

## Notes

JavaScript implementation is nearly complete. The main change is migrating from the constructor workaround to the dedicated API. This improves semantic clarity and ensures the data model matches the conceptual model (constructors are not methods).
