# Task 11.108.5: Rust - Complete Definition Processing

**Status:** Not Started
**Priority:** **CRITICAL**
**Estimated Effort:** 6-8 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.1 (builder enhancements)

## Objective

**CRITICAL:** Fix Rust builder to track parameters and imports, which are currently completely missing. Also migrate constructors and add trait method signatures.

## Current Status - CRITICAL GAPS

Rust builder has the most serious gaps of all languages:
- ✅ Structs, enums, traits tracked
- ✅ Functions and methods tracked
- ✅ Fields tracked
- ✅ Type aliases tracked
- ❌ **NO PARAMETERS TRACKED** - Empty implementation!
- ❌ **NO IMPORTS TRACKED** - Use statements ignored!
- ❌ Trait methods not added to interfaces
- ⚠️ Constructors (new) added as methods

## Critical Issues

### 1. ❌ EMPTY Parameter Implementation

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`

**Current code (line 506-508):**
```typescript
["definition.parameter", { process: () => {} }],  // ❌ DOES NOTHING!
["definition.parameter.self", { process: () => {} }],  // ❌ DOES NOTHING!
["definition.parameter.closure", { process: () => {} }],  // ❌ DOES NOTHING!
```

**Impact:**
- ALL function signatures are incomplete
- ALL method signatures lack parameters
- Type information for parameters is completely lost
- Call graph analysis impossible

**MUST FIX THIS FIRST**

### 2. ❌ NO Import Tracking

**No handlers for:**
- `use` statements
- External crate imports
- Module imports
- Glob imports

**Impact:**
- Cross-file resolution impossible
- Can't track dependencies
- Module system not represented

## Changes Required

### 1. Add Parameter Tracking

**Critical fix - line 506:**

**Current (BROKEN):**
```typescript
["definition.parameter", { process: () => {} }],
```

**Fixed:**
```typescript
[
  "definition.parameter",
  {
    process: (capture, builder, context) => {
      const param_id = create_parameter_id(capture);
      const parent_id = find_containing_callable(capture);

      builder.add_parameter_to_callable(parent_id, {
        symbol_id: param_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        type: extract_parameter_type(capture.node.parent || capture.node),
      });
    },
  },
],
```

**Need helper functions:**
```typescript
/**
 * Find the containing function/method for a parameter
 */
function find_containing_callable(capture: CaptureNode): SymbolId {
  let node = capture.node.parent;

  while (node) {
    if (node.type === "function_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return create_function_id({
          node: nameNode,
          text: nameNode.text as SymbolName,
          location: extract_location(nameNode),
          name: nameNode.text as SymbolName,
        });
      }
    } else if (node.type === "function_signature_item") {
      // Trait method signature
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return create_method_id({
          node: nameNode,
          text: nameNode.text as SymbolName,
          location: extract_location(nameNode),
          name: nameNode.text as SymbolName,
        });
      }
    }

    node = node.parent;
  }

  return function_symbol("unknown" as SymbolName, capture.location);
}

/**
 * Create parameter symbol ID
 */
function create_parameter_id(capture: CaptureNode): SymbolId {
  return parameter_symbol(capture.text, capture.location);
}

/**
 * Extract parameter type from node
 */
function extract_parameter_type(node: SyntaxNode): SymbolName | undefined {
  // Look for type annotation
  const typeNode = node.childForFieldName?.("type");
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}
```

**Add to rust_builder_helpers.ts:**
```typescript
export function create_parameter_id(capture: CaptureNode): SymbolId {
  return parameter_symbol(capture.text, capture.location);
}
```

### 2. Add Import Tracking

**Add use statement handlers:**

```typescript
[
  "import.use",
  {
    process: (capture, builder, context) => {
      const import_id = create_variable_id(capture);
      const import_path = extract_use_path(capture.node);

      builder.add_import({
        symbol_id: import_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: { scope: "file-private" },
        import_path: import_path,
        import_kind: "named",
        original_name: undefined,
      });
    },
  },
],

[
  "import.use.glob",
  {
    process: (capture, builder, context) => {
      const import_id = create_variable_id(capture);
      const import_path = extract_use_path(capture.node);

      builder.add_import({
        symbol_id: import_id,
        name: "*" as SymbolName,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: { scope: "file-private" },
        import_path: import_path,
        import_kind: "namespace",
        original_name: undefined,
      });
    },
  },
],

[
  "import.extern_crate",
  {
    process: (capture, builder, context) => {
      const import_id = create_variable_id(capture);

      builder.add_import({
        symbol_id: import_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: { scope: "file-private" },
        import_path: capture.text as any, // Crate name is the path
        import_kind: "namespace",
        original_name: undefined,
      });
    },
  },
],
```

**Helper function:**
```typescript
function extract_use_path(node: SyntaxNode): ModulePath {
  // Traverse up to find use_declaration
  let current = node;
  while (current && current.type !== "use_declaration") {
    current = current.parent!;
  }

  if (!current) return "" as ModulePath;

  // Extract the path from use declaration
  // use std::collections::HashMap -> "std::collections::HashMap"
  const pathNode = current.childForFieldName?.("argument");
  if (pathNode) {
    return pathNode.text as ModulePath;
  }

  return "" as ModulePath;
}
```

### 3. Migrate Constructor Handling

**Current code (line 444-472):**
```typescript
[
  "definition.constructor",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);
      const impl_info = find_containing_impl(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (impl_info?.struct && capture.text === "new") {
        builder.add_method_to_class(impl_info.struct, {  // ❌ Wrong
          symbol_id: method_id,
          name: "constructor" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: extract_visibility(capture.node.parent || capture.node),
          return_type: returnType,
          static: true,
        });
      }
    },
  },
],
```

**Fixed:**
```typescript
[
  "definition.constructor",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);
      const impl_info = find_containing_impl(capture);

      if (impl_info?.struct && capture.text === "new") {
        builder.add_constructor_to_class(impl_info.struct, {  // ✅ Correct
          symbol_id: method_id,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: extract_visibility(capture.node.parent || capture.node),
        });
      }
    },
  },
],
```

### 4. Add Trait Method Signatures to Interfaces

**Current code (line 387-410) adds to class, should add to interface:**

```typescript
[
  "definition.method.default",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);
      const trait_id = find_containing_trait(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (trait_id) {
        // ❌ Wrong - adds as method not signature
        builder.add_method_to_class(trait_id, {
          symbol_id: method_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "public" },
          return_type: returnType,
        });
      }
    },
  },
],
```

**Fixed:**
```typescript
[
  "definition.method.default",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);
      const trait_id = find_containing_trait(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (trait_id) {
        // ✅ Correct - adds as method signature
        builder.add_method_signature_to_interface(trait_id, {
          symbol_id: method_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          return_type: returnType,
        });
      }
    },
  },
],
```

**Also need handler for trait method signatures (no default implementation):**
```typescript
[
  "definition.trait.method.signature",
  {
    process: (capture, builder, context) => {
      const method_id = create_method_id(capture);
      const trait_id = find_containing_trait(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (trait_id) {
        builder.add_method_signature_to_interface(trait_id, {
          symbol_id: method_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          return_type: returnType,
        });
      }
    },
  },
],
```

## Query File Changes

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/rust.scm`

**Add parameter captures:**
```scheme
; Function parameters
(parameters
  (parameter
    pattern: (identifier) @definition.parameter
    type: (_)?)
  (self_parameter) @definition.parameter.self)

; Closure parameters
(closure_parameters
  (identifier) @definition.parameter.closure)
```

**Add import captures:**
```scheme
; Use statements
(use_declaration
  argument: (scoped_identifier
    name: (identifier) @import.use))

(use_declaration
  argument: (identifier) @import.use)

; Glob imports
(use_declaration
  argument: (use_wildcard) @import.use.glob)

; Extern crate
(extern_crate_declaration
  name: (identifier) @import.extern_crate)
```

**Add trait method signature capture:**
```scheme
; Trait method signatures (no body)
(trait_item
  (function_signature_item
    name: (identifier) @definition.trait.method.signature))
```

## Testing Changes

**File:** `packages/core/src/index_single_file/semantic_index.rust.test.ts`

**Add critical test for parameters:**
```typescript
it("should extract function parameters", () => {
  const code = `
    fn add(x: i32, y: i32) -> i32 {
        x + y
    }
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const func_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "add"
  );

  expect(func_def).toBeDefined();
  expect(func_def?.parameters).toHaveLength(2);
  expect(func_def?.parameters[0].name).toBe("x");
  expect(func_def?.parameters[0].type).toBe("i32");
  expect(func_def?.parameters[1].name).toBe("y");
  expect(func_def?.parameters[1].type).toBe("i32");
});

it("should extract method parameters", () => {
  const code = `
    struct Point { x: i32, y: i32 }

    impl Point {
        fn new(x: i32, y: i32) -> Self {
            Point { x, y }
        }

        fn distance(&self, other: &Point) -> f64 {
            0.0
        }
    }
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const struct_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "Point"
  );

  expect(struct_def).toBeDefined();

  const new_method = Array.from(struct_def?.methods?.values() || []).find(
    (m) => m.name === "constructor"
  );
  expect(new_method).toBeDefined();
  expect(new_method?.parameters).toHaveLength(2); // x, y (not self)

  const distance_method = Array.from(struct_def?.methods?.values() || []).find(
    (m) => m.name === "distance"
  );
  expect(distance_method).toBeDefined();
  expect(distance_method?.parameters).toHaveLength(2); // self, other
});

it("should extract use statements", () => {
  const code = `
    use std::collections::HashMap;
    use std::io::*;
    extern crate serde;
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const imports = Array.from(result.definitions.values()).filter(
    (d) => d.kind === "import"
  );

  expect(imports).toHaveLength(3);

  const hashmap_import = imports.find((i) => i.name === "HashMap");
  expect(hashmap_import).toBeDefined();
  expect(hashmap_import?.import_path).toBe("std::collections::HashMap");

  const glob_import = imports.find((i) => i.name === "*");
  expect(glob_import).toBeDefined();

  const serde_import = imports.find((i) => i.name === "serde");
  expect(serde_import).toBeDefined();
});

it("should extract trait method signatures", () => {
  const code = `
    trait Drawable {
        fn draw(&self);
        fn color(&self) -> String {
            "black".to_string()
        }
    }
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const trait_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "interface" && d.name === "Drawable"
  );

  expect(trait_def).toBeDefined();
  expect(trait_def?.methods?.size).toBe(2);

  const draw = Array.from(trait_def?.methods?.values() || []).find(
    (m) => m.name === "draw"
  );
  expect(draw).toBeDefined();
  expect(draw?.parameters).toHaveLength(1); // self

  const color = Array.from(trait_def?.methods?.values() || []).find(
    (m) => m.name === "color"
  );
  expect(color).toBeDefined();
  expect(color?.return_type).toBe("String");
});
```

## Implementation Steps

1. **CRITICAL - Add parameter tracking:**
   - Implement `definition.parameter` handler
   - Add helper functions
   - Update query file if needed

2. **Add import tracking:**
   - Add use statement handlers
   - Add extern crate handler
   - Update query file

3. **Migrate constructor:**
   - Change to `add_constructor_to_class`

4. **Fix trait methods:**
   - Use `add_method_signature_to_interface`

5. **Add comprehensive tests**

6. **Verify:**
   ```bash
   npx tsc --noEmit packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts
   npm test -- semantic_index.rust.test.ts
   ```

## Success Criteria

- ✅ **CRITICAL:** Parameters tracked for all functions/methods
- ✅ **CRITICAL:** Use statements tracked
- ✅ Constructor uses `add_constructor_to_class`
- ✅ Trait methods use `add_method_signature_to_interface`
- ✅ All tests pass
- ✅ No regression in other features

## Related Files

- [rust_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts)
- [rust_builder_helpers.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts)
- [rust.scm](../../../packages/core/src/index_single_file/query_code_tree/language_configs/queries/rust.scm)
- [semantic_index.rust.test.ts](../../../packages/core/src/index_single_file/semantic_index.rust.test.ts)

## Notes

**THIS IS THE MOST CRITICAL TASK** in the builder audit. Rust currently has:
- NO parameter information on ANY functions or methods
- NO import tracking whatsoever

This makes Rust semantic indexing essentially useless for call graph analysis and cross-file resolution. This must be fixed with highest priority.
