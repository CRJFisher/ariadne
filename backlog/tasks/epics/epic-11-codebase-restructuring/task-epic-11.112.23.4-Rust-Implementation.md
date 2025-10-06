# Task epic-11.112.23.4: Implement is_exported for Rust

**Parent:** task-epic-11.112.23
**Status:** Not Started
**Estimated Time:** 1.5 hours
**Dependencies:** task-epic-11.112.23.1

## Objective

Update Rust language builder to populate the new `is_exported` flag based on Rust's `pub` visibility modifiers and module scope rules.

## Language Rules

### Rust Export Rules

Rust has explicit visibility modifiers:

1. **`pub` makes items public (exportable)**
   - `pub fn foo() {}` → `is_exported = true`
   - `pub struct Bar {}` → `is_exported = true`
   - `pub const X: i32 = 1` → `is_exported = true`

2. **No `pub` means module-private (not exportable)**
   - `fn foo() {}` → `is_exported = false`
   - `struct Bar {}` → `is_exported = false`

3. **Nested items follow parent visibility**
   - `pub` items inside private modules are not externally visible
   - For now, simplify: check if item itself has `pub`
   - Future: Track module visibility hierarchy

4. **`pub(crate)`, `pub(super)`, etc.**
   - For now, treat any `pub` variant as `is_exported = true`
   - Future: Distinguish between different pub levels

## Implementation Steps

### 1. Add Visibility Checker (20 min)

In `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`:

```typescript
/**
 * Check if a Rust node has pub visibility modifier
 */
function has_pub_modifier(node: SyntaxNode): boolean {
  // Check if node has a visibility_modifier child
  for (const child of node.children) {
    if (child.type === "visibility_modifier") {
      // Any form of pub counts as exported
      return child.text.startsWith("pub");
    }
  }
  return false;
}

/**
 * Extract export info for Rust definitions
 */
function extract_export_info(node: SyntaxNode): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  const has_pub = has_pub_modifier(node);

  return {
    is_exported: has_pub,
    export: undefined, // Rust doesn't have export aliases like JS
  };
}
```

### 2. Update Definition Builders (30 min)

Update each Rust builder to use the new export info:

```typescript
// Function definitions
function_item: {
  process: (capture: CaptureNode, builder: DefinitionBuilder, context: ProcessingContext) => {
    const node = capture.node;
    const export_info = extract_export_info(node);

    builder.add_function({
      symbol_id: function_id,
      name: capture.text,
      location: capture.location,
      defining_scope_id: context.get_scope_id(capture.location),
      availability: determine_availability(node), // Keep for migration
      is_exported: export_info.is_exported,       // NEW
      export: export_info.export,                 // NEW
      // ... other fields
    });
  }
}

// Apply same pattern to:
// - struct_item (structs)
// - enum_item (enums)
// - const_item (constants)
// - type_item (type aliases)
// - impl_item (implementations - usually not directly exported)
// - mod_item (modules)
```

### 3. Update determine_availability Helper (15 min)

The existing availability logic should be updated to align with pub checking:

```typescript
/**
 * Determine availability for Rust symbols (legacy, keep for migration)
 */
function determine_availability(node: SyntaxNode): SymbolAvailability {
  if (has_pub_modifier(node)) {
    return { scope: "public" };
  }
  return { scope: "file-private" };
}
```

### 4. Handle Impl Blocks (15 min)

Rust implementations need special handling:

```typescript
/**
 * For impl blocks, check if the type being implemented is pub
 */
function is_impl_exported(impl_node: SyntaxNode): boolean {
  // Check if impl has pub modifier (rare but possible)
  if (has_pub_modifier(impl_node)) {
    return true;
  }

  // TODO: Check if the type being implemented is pub
  // This requires looking up the struct/enum definition
  // For now, default to false
  return false;
}
```

### 5. Add Tests (10 min)

Add test cases in:
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.test.ts`

Test scenarios:
- ✅ `pub fn foo()` has `is_exported = true`
- ✅ `fn foo()` has `is_exported = false`
- ✅ `pub struct Bar` has `is_exported = true`
- ✅ `struct Bar` has `is_exported = false`
- ✅ `pub(crate) fn foo()` has `is_exported = true` (simplified for now)

## Files Modified

- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts`

## Testing

```bash
npm test -- rust_builder.test.ts
npm test -- semantic_index.rust.test.ts
```

## Success Criteria

- ✅ Items with `pub` have `is_exported = true`
- ✅ Items without `pub` have `is_exported = false`
- ✅ All Rust tests pass

## Future Work

**Note for future tasks:**
- Implement proper module visibility tracking (`pub(crate)`, `pub(super)`, etc.)
- Handle visibility inheritance from parent modules
- Track re-exports with `pub use`

## Next Task

**task-epic-11.112.24** - Implement Export Alias Resolution
