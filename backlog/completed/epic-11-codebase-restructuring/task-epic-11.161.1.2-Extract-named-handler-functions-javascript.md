# Task 11.161.1.2: Extract Named Handler Functions (JavaScript)

## Status: Completed

## Parent: Task 11.161.1

## Goal

Migrate JavaScript handlers from anonymous functions in Map to named, exported functions.

## Current State

`javascript_builder_config.ts` contains ~740 lines with handlers like:

```typescript
const JAVASCRIPT_BASE_CONFIG: LanguageBuilderConfig = new Map([
  [
    "definition.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const class_id = create_class_id(capture);
        // ... implementation
      },
    },
  ],
  // ... many more handlers
]);
```

## Target State

`capture_handlers/capture_handlers.javascript.ts` with named functions:

```typescript
import type { CaptureNode, ProcessingContext } from "../../semantic_index";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { HandlerRegistry } from "./capture_handlers.types";
import { create_class_id, create_method_id, ... } from "../symbol_factories/symbol_factories.javascript";

// ============================================================================
// DOCUMENTATION HANDLERS
// ============================================================================

export function handle_definition_function_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  store_documentation(capture.text, capture.location.end_line);
}

export function handle_definition_class_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  store_documentation(capture.text, capture.location.end_line);
}

// ============================================================================
// DEFINITION HANDLERS
// ============================================================================

export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const class_id = create_class_id(capture);
  const extends_clause = capture.node.childForFieldName?.("heritage");
  const export_info = extract_export_info(capture.node, capture.text);
  const docstring = consume_documentation(capture.location);

  builder.add_class({
    symbol_id: class_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    extends: extends_clause ? extract_extends(capture.node) : [],
    docstring: docstring ? [docstring] : undefined,
  });
}

export function handle_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const class_id = find_containing_class(capture);
  const docstring = consume_documentation(capture.location);
  // ... rest of implementation
}

// ... more handlers

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const JAVASCRIPT_HANDLERS: HandlerRegistry = {
  // Documentation
  "definition.function.documentation": handle_definition_function_documentation,
  "definition.class.documentation": handle_definition_class_documentation,
  "definition.method.documentation": handle_definition_method_documentation,
  "definition.variable.documentation": handle_definition_variable_documentation,

  // Definitions
  "definition.class": handle_definition_class,
  "definition.method": handle_definition_method,
  "definition.function": handle_definition_function,
  "definition.variable": handle_definition_variable,
  // ... all other handlers
} as const;
```

## Implementation Steps

### 1. Inventory Current Handlers

Extract list of all capture names handled in `javascript_builder_config.ts`:

- Documentation handlers (4)
- Definition handlers (~15)
- Reference handlers (~10)
- Export handlers (~5)
- Import handlers (~5)
- Assignment handlers (~3)

### 2. Create Handler Functions

For each Map entry, create a named function:

- Name: `handle_{capture_name}` (with dots replaced by underscores)
- Example: `"definition.class"` → `handle_definition_class`

### 3. Move Helper Functions

Some helpers may need to move to `symbol_factories/javascript.ts`:

- `create_class_id`
- `create_method_id`
- `create_function_id`
- `find_containing_class`
- etc.

### 4. Create Handler Registry

Create `JAVASCRIPT_HANDLERS` object with named function references.

### 5. Update Imports

Update `semantic_index.ts` and tests to use new imports.

### 6. Update Tests

- `javascript_builder.test.ts` → `capture_handlers/javascript.test.ts`
- Update imports to use named handlers
- Tests can now import individual handlers for unit testing

## Files to Create/Modify

- Create: `capture_handlers/capture_handlers.javascript.ts`
- Create: `capture_handlers/capture_handlers.javascript.test.ts`
- Modify: `symbol_factories/symbol_factories.javascript.ts` (add helpers)
- Modify: `capture_handlers/index.ts` (add JavaScript to factory)
- Delete (later): `language_configs/javascript_builder_config.ts`

## Dependencies

- Task 11.161.1.1 (directory structure)
- Task 11.161.1.7 (symbol factories) - can be done in parallel

## Success Criteria

1. All JavaScript handlers are named, exported functions
2. `JAVASCRIPT_HANDLERS` registry uses named function references
3. All existing tests pass
4. Handlers can be imported individually for testing

## Implementation Notes

### Files Created

- `capture_handlers/capture_handlers.javascript.ts` - Contains 30 named handler functions and `JAVASCRIPT_HANDLERS` registry

### Files Modified

- `capture_handlers/index.ts` - Added `get_handler_registry()` support for JavaScript/TypeScript
- `javascript_builder_config.ts` - Refactored to import handlers from new module

### Files Deleted

- `javascript_reexport_config.ts` - Handlers moved to `capture_handlers/capture_handlers.javascript.ts`

### Handler Categories

1. **Documentation handlers** (4): function, class, method, variable documentation
2. **Definition handlers** (11): class, method, constructor, function, arrow, anonymous_function, param, parameter, variable, field, property
3. **Import handlers** (6): import, import.named, import.default, import.namespace, import.require, import.require.simple
4. **Re-export handlers** (9): reexport, reexport.named.simple, reexport.named, reexport.named.alias, reexport.default.original, reexport.default.alias, reexport.as_default.alias, reexport.namespace.source, reexport.namespace.alias

### Tests

All JavaScript builder tests pass (125 tests across 2 test files).
All JavaScript integration tests pass (30 tests).
