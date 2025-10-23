# Task: Rust Property Type Extraction

**Parent**: task-epic-11.150
**Status**: TODO
**Priority**: High
**Estimated Effort**: 0.75 day

## Goal

Extract field types from Rust struct definitions, handling generics and lifetime annotations.

## Files to Modify

1. `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`
2. `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts`
3. `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.test.ts`

## Implementation Steps

### Step 1: Update Rust Query

```scheme
; Struct field with type
(field_declaration
  (visibility_modifier)? @definition.property.visibility
  name: (field_identifier) @definition.property
  type: (_) @definition.property.type
) @definition.property.container

; Tuple struct field
(tuple_struct_pattern
  (identifier) @definition.property.type
) @definition.property.container
```

### Step 2: Extract Rust Types

```typescript
function extract_rust_type(type_node: SyntaxNode): string {
  // Handle generic types: Vec<T>, HashMap<K, V>
  // Handle reference types: &Type, &mut Type
  // Handle lifetime annotations: &'a Type
  // Handle tuple types: (i32, String)
  return type_node.text;
}
```

### Step 3: Add Tests

```rust
describe("Property type extraction", () => {
  it("should extract type from struct field", () => {
    const code = `
struct Service {
    registry: DefinitionRegistry,
}
    `;
    
    const index = build_semantic_index_for_test(code, "Rust");
    const service_struct = Array.from(index.classes.values())[0];
    const registry_field = service_struct.properties[0];
    
    expect(registry_field.type).toBe("DefinitionRegistry");
  });
  
  it("should extract type from pub field", () => {
    const code = `
struct Config {
    pub name: String,
    pub count: usize,
}
    `;
    
    const index = build_semantic_index_for_test(code, "Rust");
    const config_struct = Array.from(index.classes.values())[0];
    
    expect(config_struct.properties[0].type).toBe("String");
    expect(config_struct.properties[1].type).toBe("usize");
  });
  
  it("should extract type from generic struct", () => {
    const code = `
struct Container<T> {
    items: Vec<T>,
    mapping: HashMap<String, T>,
}
    `;
    
    const index = build_semantic_index_for_test(code, "Rust");
    const container_struct = Array.from(index.classes.values())[0];
    
    expect(container_struct.properties[0].type).toBe("Vec<T>");
    expect(container_struct.properties[1].type).toBe("HashMap<String, T>");
  });
  
  it("should extract type from tuple struct", () => {
    const code = `
struct Point(i32, i32);
struct Color(u8, u8, u8);
    `;
    
    const index = build_semantic_index_for_test(code, "Rust");
    
    expect(index.classes.size).toBe(2);
    // Tuple structs should have fields with types i32, u8, etc.
  });
  
  it("should extract lifetime-annotated types", () => {
    const code = `
struct Wrapper<'a> {
    data: &'a str,
    owner: &'a mut Vec<u8>,
}
    `;
    
    const index = build_semantic_index_for_test(code, "Rust");
    const wrapper_struct = Array.from(index.classes.values())[0];
    
    expect(wrapper_struct.properties[0].type).toBe("&'a str");
    expect(wrapper_struct.properties[1].type).toBe("&'a mut Vec<u8>");
  });
  
  it("should extract Option and Result types", () => {
    const code = `
struct State {
    value: Option<String>,
    result: Result<i32, Error>,
}
    `;
    
    const index = build_semantic_index_for_test(code, "Rust");
    const state_struct = Array.from(index.classes.values())[0];
    
    expect(state_struct.properties[0].type).toBe("Option<String>");
    expect(state_struct.properties[1].type).toBe("Result<i32, Error>");
  });
});
```

## Acceptance Criteria

- [ ] Types extracted from struct fields
- [ ] Generic types preserved correctly
- [ ] Lifetime annotations included in type strings
- [ ] Reference types (&, &mut) handled
- [ ] Tuple struct types extracted
- [ ] All 6 test cases pass
- [ ] No regressions in existing Rust tests
