# Task 11.108.13: Complete TypeScript Interface Method Parameters

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2-3 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.1 (builder enhancements - COMPLETE)
**Blocks:** task-epic-11.108.7 (TypeScript test updates)

## Objective

Add interface method parameter tracking to TypeScript builder. Currently, interface methods are captured but their parameters are ignored, making interface signatures incomplete.

## Problem Statement

**From task-epic-11.108.3:**

TypeScript interface methods are added via `add_method_signature_to_interface()`, but their parameters are never captured or added to the method signatures.

**Example:**
```typescript
interface Calculator {
  add(x: number, y: number): number;      // ← parameters NOT tracked
  divide(a: number, b: number, precision?: number): number;  // ← parameters NOT tracked
}
```

**Result:** Interface method signatures have empty `parameters` arrays.

## Files to Modify

### 1. Query File

**File:** [packages/core/src/index_single_file/query_code_tree/language_configs/queries/typescript.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/typescript.scm)

**Add interface method parameter captures:**

```scheme
; Interface method signatures with parameters
(method_signature
  name: (property_identifier) @definition.interface.method
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @definition.interface.method.param)))

; Optional parameters in interface methods
(method_signature
  parameters: (formal_parameters
    (optional_parameter
      pattern: (identifier) @definition.interface.method.param.optional)))

; Rest parameters in interface methods
(method_signature
  parameters: (formal_parameters
    (rest_parameter
      pattern: (identifier) @definition.interface.method.param.rest)))
```

### 2. Builder Config

**File:** [packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts)

**Add handler for interface method parameters:**

```typescript
[
  "definition.interface.method.param",
  {
    process: (capture, builder, context) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_interface_method(capture);

      if (!parent_id) return;

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        type: extract_parameter_type(capture.node),
        optional: false,
      });
    },
  },
],

[
  "definition.interface.method.param.optional",
  {
    process: (capture, builder, context) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_interface_method(capture);

      if (!parent_id) return;

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        type: extract_parameter_type(capture.node),
        optional: true,  // ← Mark as optional
      });
    },
  },
],
```

### 3. Helper Function

**Add to `typescript_builder.ts`:**

```typescript
/**
 * Find the containing interface method for a parameter
 */
function find_containing_interface_method(capture: CaptureNode): SymbolId | undefined {
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

  return undefined;
}

/**
 * Check if parameter is optional (has ? token)
 */
function is_optional_parameter(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Check for optional_parameter parent
  if (parent.type === "optional_parameter") return true;

  // Check for ? token in children
  for (const child of parent.children || []) {
    if (child.type === "?" || child.text === "?") return true;
  }

  return false;
}
```

## Implementation Steps

### Phase 1: Inspect TypeScript AST

Check the AST structure for interface method parameters:

```typescript
// test_sample.ts
interface Calculator {
  add(x: number, y: number): number;
  divide(a: number, b: number, precision?: number): number;
}
```

```bash
tree-sitter parse test_sample.ts
```

Look for:
- `method_signature` nodes
- `formal_parameters` nodes
- `required_parameter` vs `optional_parameter` nodes

### Phase 2: Add Query Patterns

Update `typescript.scm` with the patterns above.

### Phase 3: Add Handler

Add handler for `definition.interface.method.param` in `typescript_builder.ts`.

### Phase 4: Add Helper Functions

Add `find_containing_interface_method()` and `is_optional_parameter()` helpers.

### Phase 5: Write Tests

**File:** `semantic_index.typescript.test.ts`

Add comprehensive test:

```typescript
it("extracts interface method parameters", () => {
  const code = `
    interface Calculator {
      add(x: number, y: number): number;
      divide(a: number, b: number, precision?: number): number;
    }
  `;

  const result = index_single_file(code, "test.ts" as FilePath, "typescript");

  const interface_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "interface" && d.name === "Calculator"
  );

  expect(interface_def).toBeDefined();
  const methods = Array.from(interface_def?.methods?.values() || []);
  expect(methods).toHaveLength(2);

  // Check add method
  const add_method = methods.find((m) => m.name === "add");
  expect(add_method?.parameters).toHaveLength(2);
  expect(add_method?.parameters[0]).toMatchObject({
    name: "x",
    type: "number",
    optional: false,
  });
  expect(add_method?.parameters[1]).toMatchObject({
    name: "y",
    type: "number",
    optional: false,
  });

  // Check divide method with optional parameter
  const divide_method = methods.find((m) => m.name === "divide");
  expect(divide_method?.parameters).toHaveLength(3);
  expect(divide_method?.parameters[2]).toMatchObject({
    name: "precision",
    type: "number",
    optional: true,  // ← Verify optional flag
  });
});
```

### Phase 6: Verify

```bash
# Run TypeScript tests
npm test -- semantic_index.typescript.test.ts

# Should see new test pass
npm test -- semantic_index.typescript.test.ts -t "interface method parameters"
```

## Success Criteria

- ✅ Query patterns capture interface method parameters
- ✅ Handler adds parameters to interface method signatures
- ✅ Optional parameters marked correctly
- ✅ Helper functions implemented
- ✅ Test passes
- ✅ No regressions in existing TypeScript tests
- ✅ TypeScript compilation succeeds

## Edge Cases to Handle

### Generic Parameters

```typescript
interface Container<T> {
  get(index: number): T;
  set(index: number, value: T): void;
}
```

Parameter type is `T` (generic type parameter).

### Rest Parameters

```typescript
interface Logger {
  log(...args: any[]): void;
}
```

Rest parameter should be captured.

### Destructured Parameters

```typescript
interface Parser {
  parse({ x, y }: Point): void;
}
```

May need special handling for destructured parameters.

### Default Values

```typescript
interface Config {
  init(port: number = 3000): void;  // Default value in interface (rare but valid)
}
```

## Verification Test Cases

**Required tests:**

1. ✅ Simple parameters with types
2. ✅ Optional parameters (`?` modifier)
3. ✅ Generic type parameters
4. ✅ Rest parameters (`...args`)
5. ⚠️ Destructured parameters (document if not supported)

## Related Files

- [typescript.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/typescript.scm) - Query patterns
- [typescript_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts) - Handlers and helpers
- [semantic_index.typescript.test.ts](../../../packages/core/src/index_single_file/semantic_index.typescript.test.ts) - Tests
- [definition_builder.ts](../../../packages/core/src/index_single_file/definitions/definition_builder.ts) - Builder (already supports interface method parameters)

## Notes

This is the **last missing piece** of TypeScript definition processing. Once complete, TypeScript will have full parity with JavaScript plus all TypeScript-specific features.

**Time estimate:** 2-3 hours including query development, handler implementation, and testing.
