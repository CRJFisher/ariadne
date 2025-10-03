# Task epic-11.112.29: Populate visibility in Builder Configs

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 5 files modified
**Dependencies:** task-epic-11.112.28

## Objective

Update all language builder configs to populate the `visibility` field when creating definitions. This involves determining the appropriate visibility for each construct based on context (scope, exports, etc.).

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_config.ts`
- `packages/core/src/index_single_file/query_code_tree/definition_builder.ts`

## Implementation Steps

### 1. Create Visibility Helper Function (30 min)

Add to `definition_builder.ts`:

```typescript
import { VisibilityKind, scope_local_visibility, scope_children_visibility, file_visibility, exported_visibility } from '@ariadnejs/types';

/**
 * Determine visibility based on availability and context.
 * This bridges old availability system to new visibility system.
 */
export function determine_visibility(
  availability: Availability,
  is_parameter: boolean = false
): VisibilityKind {
  switch (availability) {
    case "local":
      // Parameters are visible in function body (children)
      // Local variables are only visible in their block (local)
      return is_parameter ? scope_children_visibility() : scope_local_visibility();

    case "file":
      return file_visibility();

    case "file-export":
      // TODO: Determine actual export kind from node
      // For now, assume named export
      return exported_visibility({ kind: "named", export_name: "TODO" });

    default:
      // Default to file visibility for unknown cases
      return file_visibility();
  }
}
```

### 2. Update JavaScript Class Handler (15 min)

```typescript
// In javascript_builder_config.ts

{
  name: "definition.class",
  handler: (capture, context, builder) => {
    const class_id = class_symbol(/* ... */);
    const availability = determine_availability(capture.node);

    builder.add_class({
      symbol_id: class_id,
      name: capture.text,
      location: capture.location,
      defining_scope_id: context.get_defining_scope_id(capture.location),
      availability,  // Keep old system
      visibility: determine_visibility(availability),  // Add new system
      // ... rest
    });
  }
}
```

### 3. Update JavaScript Function Handler (15 min)

```typescript
{
  name: "definition.function",
  handler: (capture, context, builder) => {
    const func_id = function_symbol(/* ... */);
    const availability = determine_availability(capture.node);

    builder.add_function({
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      defining_scope_id: context.get_defining_scope_id(capture.location),
      availability,
      visibility: determine_visibility(availability),
      parameters: extract_parameters(capture.node),
      // ... rest
    });
  }
}
```

### 4. Update Parameter Handlers (15 min)

Parameters need special handling (scope_children):

```typescript
{
  name: "definition.parameter",
  handler: (capture, context, builder) => {
    const param_id = variable_symbol(/* ... */);
    const availability = "local";

    builder.add_parameter({
      symbol_id: param_id,
      name: capture.text,
      location: capture.location,
      defining_scope_id: context.get_defining_scope_id(capture.location),
      availability,
      visibility: determine_visibility(availability, true),  // is_parameter = true
      // ... rest
    });
  }
}
```

### 5. Update Variable Handlers (15 min)

Local variables use scope_local:

```typescript
{
  name: "definition.variable",
  handler: (capture, context, builder) => {
    const var_id = variable_symbol(/* ... */);
    const availability = determine_availability(capture.node);

    builder.add_variable({
      symbol_id: var_id,
      name: capture.text,
      location: capture.location,
      defining_scope_id: context.get_defining_scope_id(capture.location),
      availability,
      visibility: determine_visibility(availability, false),  // not a parameter
      // ... rest
    });
  }
}
```

### 6. Apply Pattern to All Languages (60 min)

Apply same pattern to:
- TypeScript: classes, interfaces, enums, functions, variables, parameters
- Python: classes, functions, variables, parameters
- Rust: structs, enums, functions, variables, parameters

For each handler:
1. Calculate availability (already done)
2. Add visibility: `determine_visibility(availability, is_parameter)`

### 7. Handle Export Cases (20 min)

Improve export handling in `determine_visibility`:

```typescript
export function determine_visibility(
  availability: Availability,
  is_parameter: boolean = false,
  export_name?: string  // Add optional export name
): VisibilityKind {
  switch (availability) {
    case "file-export":
      return exported_visibility({
        kind: "named",
        export_name: export_name || "unknown"  // Use provided name
      });
    // ... rest
  }
}
```

Update handlers to pass export name:
```typescript
const export_name = get_export_name(capture.node);
const visibility = determine_visibility(availability, false, export_name);
```

### 8. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: No type errors - all definitions now have `visibility` field.

### 9. Run Tests (10 min)

```bash
npm test -- semantic_index.*.test.ts
```

Expected: Tests pass (visibility field populated but not yet used).

## Success Criteria

- ✅ Helper function `determine_visibility()` created
- ✅ All builder configs populate `visibility` field
- ✅ Parameters use scope_children visibility
- ✅ Local variables use scope_local visibility
- ✅ File-scoped symbols use file visibility
- ✅ Exported symbols use exported visibility
- ✅ Type checker passes
- ✅ Tests pass

## Outputs

- All definitions now have `visibility` field populated

## Next Task

**task-epic-11.112.30** - Implement VisibilityChecker service
