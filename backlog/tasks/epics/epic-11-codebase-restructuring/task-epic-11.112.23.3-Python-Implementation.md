# Task epic-11.112.23.3: Implement is_exported for Python

**Parent:** task-epic-11.112.23
**Status:** Not Started
**Estimated Time:** 1 hour
**Dependencies:** task-epic-11.112.23.1

## Objective

Update Python language builder to populate the new `is_exported` flag based on Python's module-level visibility conventions.

## Language Rules

### Python Export Rules

Python doesn't have explicit `export` keywords. Instead:

1. **Module-level definitions are importable** (unless prefixed with `_`)
   - `def foo(): pass` → `is_exported = true`
   - `class Bar: pass` → `is_exported = true`
   - `x = 1` → `is_exported = true`

2. **Names starting with underscore are private by convention**
   - `def _internal(): pass` → `is_exported = false`
   - `class _Private: pass` → `is_exported = false`
   - `_secret = 1` → `is_exported = false`

3. **Nested definitions are not importable**
   - Function inside function → `is_exported = false`
   - Class inside function → `is_exported = false`

4. **`__all__` controls explicit exports** (future work)
   - `__all__ = ["foo", "bar"]` → only these are exported
   - Note: Not implementing in this task, just document for future

## Implementation Steps

### 1. Update determine_availability Function (20 min)

In `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`:

```typescript
/**
 * Check if a Python symbol is exported and extract export metadata
 */
function extract_export_info(
  name: string,
  defining_scope_id: ScopeId,
  module_scope_id: ScopeId
): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  // Names starting with underscore are private (convention)
  if (is_private_name(name)) {
    return { is_exported: false };
  }

  // Only module-level definitions are importable
  if (defining_scope_id === module_scope_id) {
    return { is_exported: true };
  }

  // Nested definitions are not importable
  return { is_exported: false };
}

/**
 * Check if name starts with underscore (private by convention)
 */
function is_private_name(name: string): boolean {
  return name.startsWith("_");
}
```

### 2. Update determine_availability to Use New Logic (15 min)

The existing `determine_availability` function already has similar logic. Update it to also return the new format:

```typescript
export function determine_availability(name: string): SymbolAvailability {
  // Keep existing logic for backward compatibility
  if (is_private_name(name)) {
    return { scope: "file-private" };
  }
  return { scope: "public" };
}
```

### 3. Update All Definition Builders (20 min)

Update each builder to use the new export info:

```typescript
function_definition: {
  process: (capture: CaptureNode, builder: DefinitionBuilder, context: ProcessingContext) => {
    const node = capture.node;
    const name = capture.text;
    const defining_scope_id = context.get_scope_id(capture.location);
    const module_scope_id = context.module_scope_id; // Assumes this exists in context

    const export_info = extract_export_info(name, defining_scope_id, module_scope_id);

    builder.add_function({
      symbol_id: function_id,
      name: capture.text,
      location: capture.location,
      defining_scope_id: defining_scope_id,
      availability: determine_availability(name), // Keep for migration
      is_exported: export_info.is_exported,       // NEW
      export: export_info.export,                 // NEW
      // ... other fields
    });
  }
}

// Apply same pattern to:
// - class_definition
// - variable_definition
```

### 4. Add Context Support for Module Scope (5 min)

Ensure `ProcessingContext` provides access to the module scope ID:

```typescript
// In semantic_index.ts or wherever ProcessingContext is defined
interface ProcessingContext {
  get_scope_id(location: Location): ScopeId;
  module_scope_id: ScopeId;  // NEW: Reference to module-level scope
  // ... other fields
}
```

## Files Modified

- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts`
- `packages/core/src/index_single_file/semantic_index.ts` (if context needs updating)

## Testing

```bash
npm test -- python_builder.test.ts
npm test -- semantic_index.python.test.ts
```

Test scenarios:
- ✅ Module-level function without underscore → `is_exported = true`
- ✅ Module-level function with underscore → `is_exported = false`
- ✅ Nested function → `is_exported = false`
- ✅ Module-level class → `is_exported = true`
- ✅ Private class (with underscore) → `is_exported = false`

## Success Criteria

- ✅ Module-level non-private symbols have `is_exported = true`
- ✅ Private symbols (with `_`) have `is_exported = false`
- ✅ Nested definitions have `is_exported = false`
- ✅ All Python tests pass

## Future Work

**Note for future tasks:**
- Implement `__all__` support to respect explicit export lists
- Handle `from module import *` visibility rules

## Next Task

**task-epic-11.112.23.4** - Rust Implementation
