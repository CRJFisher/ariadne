# Task 11.161.1.4: Extract Named Handler Functions (Python)

## Status: Completed

## Parent: Task 11.161.1

## Goal

Migrate Python handlers from anonymous functions to named, exported functions.

## Current State

`python_builder_config.ts` contains Python-specific handlers:

```typescript
export const PYTHON_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  ["definition.class", { process: (capture, builder, context) => { ... } }],
  ["definition.method", { process: (capture, builder, context) => { ... } }],
  ["definition.function", { process: (capture, builder, context) => { ... } }],
  // ... Python-specific handlers for decorators, imports, etc.
]);
```

## Target State

`capture_handlers/python.ts`:

```typescript
import type { HandlerRegistry } from "./types";

// ============================================================================
// PYTHON DEFINITION HANDLERS
// ============================================================================

export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const class_id = create_class_id(capture);
  const base_classes = extract_extends(capture.node.parent || capture.node);
  // ... Python-specific implementation
}

export function handle_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const name = capture.text;

  // Skip __init__ - handled by definition.constructor
  if (name === "__init__") return;

  // Check if Protocol method
  const protocol_id = find_containing_protocol(capture);
  // ... Python-specific implementation
}

// ... more Python handlers

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const PYTHON_HANDLERS: HandlerRegistry = {
  // Classes
  "definition.class": handle_definition_class,

  // Methods
  "definition.method": handle_definition_method,
  "definition.method.static": handle_definition_method_static,
  "definition.method.class": handle_definition_method_class,
  "definition.constructor": handle_definition_constructor,

  // Functions
  "definition.function": handle_definition_function,

  // Properties
  "definition.property": handle_definition_property,

  // Decorators
  "decorator.function": handle_decorator_function,
  "decorator.class": handle_decorator_class,

  // Protocols
  "definition.protocol": handle_definition_protocol,

  // Imports
  "import.name": handle_import_name,
  "import.from": handle_import_from,
  "import.alias": handle_import_alias,

  // ... all other Python handlers
} as const;
```

## Python-Specific Handlers to Extract

1. **Class handlers**
   - `definition.class`

2. **Method handlers**
   - `definition.method`
   - `definition.method.static`
   - `definition.method.class`
   - `definition.constructor`

3. **Function handlers**
   - `definition.function`

4. **Property handlers**
   - `definition.property`

5. **Decorator handlers**
   - `decorator.function`
   - `decorator.class`

6. **Protocol handlers**
   - `definition.protocol`

7. **Import handlers** (from `python_imports.ts`)
   - `import.name`
   - `import.from`
   - `import.alias`

8. **Type annotation handlers**
   - `definition.type_alias`

## Implementation Steps

1. Create `capture_handlers/python.ts`
2. Extract each handler as named function
3. Merge handlers from `python_imports.ts`
4. Move helpers to `symbol_factories/python.ts`
5. Update tests

## Dependencies

- Task 11.161.1.1 (directory structure)

## Success Criteria

1. All Python handlers are named, exported functions
2. Import handlers merged into main registry
3. All existing tests pass

## Implementation Notes

### Files Created

- `capture_handlers/python.ts` - Contains 36 named handler functions and `PYTHON_HANDLERS` registry (~29KB)
- `capture_handlers/python_imports.ts` - Contains 8 import handler functions (~8KB, split due to 32KB file size limit)

### Files Modified

- `capture_handlers/index.ts` - Added `get_handler_registry()` support for Python
- `python_builder_config.ts` - Refactored to import handlers from new module

### Files Deleted

- `language_configs/python_imports.ts` - Handlers consolidated into `capture_handlers/python_imports.ts`

### Handler Categories

1. **Class handlers** (1): class
2. **Method handlers** (4): method, method.static, method.class, constructor
3. **Property handlers** (2): property, field
4. **Function handlers** (4): function, function.async, lambda, anonymous_function
5. **Parameter handlers** (6): parameter, parameter.default, parameter.typed, parameter.typed.default, parameter.args, parameter.kwargs
6. **Variable handlers** (5): variable, variable.typed, variable.multiple, variable.tuple, variable.destructured
7. **Loop/comprehension handlers** (5): loop_var, loop_var.multiple, comprehension_var, except_var, with_var
8. **Import handlers** (8): import, import.named, import.named.source, import.named.alias, import.module, import.module.source, import.module.alias, import.star
9. **Protocol handlers** (2): interface, property.interface
10. **Enum handlers** (2): enum, enum_member
11. **Decorator handlers** (4): decorator.variable, decorator.function, decorator.property, decorator.method
12. **Type alias handlers** (1): type_alias

### Tests

All Python builder tests pass (75 tests).
All Python semantic index tests pass (53 tests).
All Python integration tests pass (37 tests).
