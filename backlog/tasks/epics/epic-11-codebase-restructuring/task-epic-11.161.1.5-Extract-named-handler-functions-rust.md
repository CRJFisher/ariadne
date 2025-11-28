# Task 11.161.1.5: Extract Named Handler Functions (Rust)

## Status: Planning

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

`capture_handlers/rust.ts`:

```typescript
import type { HandlerRegistry } from "./types";

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

- `rust_builder.ts` → `capture_handlers/rust.ts`
- `rust_method_config.ts` → merge into `capture_handlers/rust.ts`
- `rust_builder_helpers.ts` → `symbol_factories/rust.ts`
- `rust_callback_detection.ts` → `symbol_factories/rust.ts`
- `rust_import_extraction.ts` → `symbol_factories/rust.ts`

## Implementation Steps

1. Create `capture_handlers/rust.ts`
2. Extract each handler as named function
3. Merge handlers from `rust_method_config.ts`
4. Move helpers to `symbol_factories/rust.ts`
5. Update tests

## Dependencies

- Task 11.161.1.1 (directory structure)

## Success Criteria

1. All Rust handlers are named, exported functions
2. Scattered Rust files consolidated
3. All existing tests pass
