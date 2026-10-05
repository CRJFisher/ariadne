# Task 11.161.1.5: Extract Named Handler Functions (Rust)

## Status: Completed

## Parent: Task 11.161.1

## Goal

Migrate Rust handlers from anonymous functions to named, exported functions.

## Current State

`rust_builder.ts` contains Rust handlers and helpers mixed together (~970 lines):

```typescript
const RUST_BASE_CONFIG: LanguageBuilderConfig = new Map([
  ["definition.function", { process: (capture, builder, context) => { ... } }],
  ["definition.struct", { process: (capture, builder, context) => { ... } }],
  ["definition.enum", { process: (capture, builder, context) => { ... } }],
  // ... many Rust-specific handlers
]);

export const RUST_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  ...RUST_BASE_CONFIG,
  ...RUST_METHOD_CONFIG,
]);
```

Additional files:
- `rust_method_config.ts` - Method-specific handlers
- `rust_builder_helpers.ts` - Helper functions
- `rust_callback_detection.ts` - Callback detection
- `rust_import_extraction.ts` - Import extraction

## Target State

`capture_handlers/capture_handlers.rust.ts` (follows `{dir}.{language}.ts` naming convention):

```typescript
import type { HandlerRegistry } from "./capture_handlers.types";

// ============================================================================
// RUST DEFINITION HANDLERS
// ============================================================================

export function handle_definition_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // ... implementation
}

export function handle_definition_struct(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // ... implementation
}

export function handle_definition_enum(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // ... implementation
}

export function handle_definition_trait(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // ... implementation
}

export function handle_definition_impl(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // ... implementation
}

// ... more Rust handlers

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const RUST_HANDLERS: HandlerRegistry = {
  // Functions
  "definition.function": handle_definition_function,
  "definition.function.async": handle_definition_function_async,

  // Structs
  "definition.struct": handle_definition_struct,
  "definition.struct.field": handle_definition_struct_field,

  // Enums
  "definition.enum": handle_definition_enum,
  "definition.enum.variant": handle_definition_enum_variant,

  // Traits
  "definition.trait": handle_definition_trait,
  "definition.trait.method": handle_definition_trait_method,

  // Impl blocks
  "definition.impl": handle_definition_impl,
  "definition.method": handle_definition_method,
  "definition.method.static": handle_definition_method_static,

  // Imports (use statements)
  "import.use": handle_import_use,
  "import.use.glob": handle_import_use_glob,
  "import.use.alias": handle_import_use_alias,

  // ... all other Rust handlers
} as const;
```

## Rust-Specific Handlers to Extract

1. **Function handlers**
   - `definition.function`
   - `definition.function.async`

2. **Struct handlers**
   - `definition.struct`
   - `definition.struct.field`
   - `definition.struct.tuple`

3. **Enum handlers**
   - `definition.enum`
   - `definition.enum.variant`

4. **Trait handlers**
   - `definition.trait`
   - `definition.trait.method`
   - `definition.trait.type`

5. **Impl handlers**
   - `definition.impl`
   - `definition.method`
   - `definition.method.static`

6. **Import handlers**
   - `import.use`
   - `import.use.glob`
   - `import.use.alias`

7. **Type handlers**
   - `definition.type_alias`
   - `reference.type`

8. **Macro handlers**
   - `definition.macro`

## Files to Consolidate

- `rust_builder.ts` → `capture_handlers/capture_handlers.rust.ts`
- `rust_method_config.ts` → merge into `capture_handlers/capture_handlers.rust.ts`
- `rust_builder_helpers.ts` → `symbol_factories/symbol_factories.rust.ts`
- `rust_callback_detection.ts` → `symbol_factories/symbol_factories.rust.ts`
- `rust_import_extraction.ts` → `symbol_factories/symbol_factories.rust.ts`

## Implementation Steps

1. Create `capture_handlers/capture_handlers.rust.ts`
2. Extract each handler as named function
3. Merge handlers from `rust_method_config.ts`
4. Move helpers to `symbol_factories/symbol_factories.rust.ts`
5. Update tests

## Dependencies

- Task 11.161.1.1 (directory structure)

## Success Criteria

1. All Rust handlers are named, exported functions
2. Scattered Rust files consolidated
3. All existing tests pass

## Implementation Notes

### Files Created

- `capture_handlers/capture_handlers.rust.ts` - Contains 46 named handler functions and `RUST_HANDLERS` registry (~30KB)

### Files Modified

- `capture_handlers/index.ts` - Added `get_handler_registry()` support for Rust
- `rust_builder.ts` - Refactored to import handlers from new module

### Files Deleted

- `rust_method_config.ts` - Handlers merged into `capture_handlers/capture_handlers.rust.ts`

### Handler Categories

1. **Struct/Class handlers** (2): class, class.generic
2. **Enum handlers** (3): enum, enum.generic, enum_member
3. **Trait/Interface handlers** (3): interface, interface.generic, interface.method
4. **Function handlers** (5): function, function.generic, function.async, function.const, function.unsafe
5. **Field handlers** (1): field
6. **Parameter handlers** (3): parameter, parameter.self, parameter.closure
7. **Variable handlers** (3): variable, constant, variable.mut
8. **Module handlers** (2): module, module.public
9. **Type handlers** (3): type, type_alias, type_alias.impl
10. **Macro handlers** (1): macro
11. **Type parameter handlers** (2): type_parameter, type_parameter.constrained
12. **Import handlers** (2): import, reexport
13. **Anonymous function handlers** (1): anonymous_function
14. **Other handlers** (6): function.closure, function.async_closure, function.async_move_closure, function.returns_impl, function.accepts_impl, visibility
15. **Method handlers** (5): method, method.associated, method.default, method.async, constructor

### Architecture

`RUST_HANDLERS` is a plain object mapping capture names to handler functions.
The handler registry is accessed via `get_handler_registry("rust")` from the index.
Helper functions remain in `rust_builder_helpers.ts` (to be moved to `symbol_factories/` in task 11.161.1.7).

### Tests

All Rust builder tests pass (68 tests).
All Rust semantic index tests pass (68 tests).
