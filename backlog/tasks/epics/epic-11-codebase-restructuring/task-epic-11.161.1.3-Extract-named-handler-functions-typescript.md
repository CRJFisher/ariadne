# Task 11.161.1.3: Extract Named Handler Functions (TypeScript)

## Status: Completed

## Parent: Task 11.161.1

## Goal

Migrate TypeScript handlers from anonymous functions to named, exported functions.

## Current State

`typescript_builder_config.ts` extends JavaScript config with TypeScript-specific handlers:

```typescript
export const TYPESCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  ...JAVASCRIPT_BUILDER_CONFIG,
  // TypeScript-specific handlers
  ["definition.interface", { process: (capture, builder, context) => { ... } }],
  ["definition.type_alias", { process: (capture, builder, context) => { ... } }],
  ["definition.enum", { process: (capture, builder, context) => { ... } }],
  // ... more TypeScript-specific handlers
]);
```

## Target State

`capture_handlers/typescript.ts`:

```typescript
import type { HandlerRegistry } from "./types";
import { JAVASCRIPT_HANDLERS } from "./javascript";

// ============================================================================
// TYPESCRIPT-SPECIFIC HANDLERS
// ============================================================================

export function handle_definition_interface(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // ... implementation
}

export function handle_definition_type_alias(
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

// ... more TypeScript-specific handlers

// ============================================================================
// HANDLER REGISTRY (extends JavaScript)
// ============================================================================

export const TYPESCRIPT_HANDLERS: HandlerRegistry = {
  ...JAVASCRIPT_HANDLERS,

  // TypeScript-specific definitions
  "definition.interface": handle_definition_interface,
  "definition.type_alias": handle_definition_type_alias,
  "definition.enum": handle_definition_enum,
  "definition.namespace": handle_definition_namespace,

  // TypeScript-specific decorators
  "decorator.class": handle_decorator_class,
  "decorator.method": handle_decorator_method,
  "decorator.property": handle_decorator_property,

  // ... more TypeScript-specific handlers
} as const;
```

## TypeScript-Specific Handlers to Extract

1. **Interface handlers**
   - `definition.interface`
   - `definition.interface.property`
   - `definition.interface.method`

2. **Type alias handlers**
   - `definition.type_alias`

3. **Enum handlers**
   - `definition.enum`
   - `definition.enum.member`

4. **Namespace handlers**
   - `definition.namespace`

5. **Decorator handlers**
   - `decorator.class`
   - `decorator.method`
   - `decorator.property`
   - `decorator.parameter`

6. **Generic type handlers**
   - `reference.type.generic`
   - `definition.type_parameter`

## Implementation Steps

1. Create `capture_handlers/typescript.ts`
2. Extract each TypeScript-specific handler as named function
3. Import `JAVASCRIPT_HANDLERS` and spread into `TYPESCRIPT_HANDLERS`
4. Move TypeScript-specific helpers to `symbol_factories/typescript.ts`
5. Update tests

## Dependencies

- Task 11.161.1.2 (JavaScript handlers must be done first)

## Success Criteria

1. All TypeScript handlers are named, exported functions
2. `TYPESCRIPT_HANDLERS` extends `JAVASCRIPT_HANDLERS`
3. All existing tests pass

## Implementation Notes

### Files Created

- `capture_handlers/typescript.ts` - Contains 23 named handler functions and `TYPESCRIPT_HANDLERS` registry

### Files Modified

- `capture_handlers/index.ts` - Added `get_handler_registry()` support for TypeScript (distinct from JavaScript)
- `typescript_builder_config.ts` - Refactored to import handlers from new module

### Handler Categories

1. **JavaScript overrides** (7): variable, function, anonymous_function, class, method, field, parameter
2. **Interface handlers** (3): interface, interface.method, interface.property
3. **Type alias handlers** (1): type_alias
4. **Enum handlers** (2): enum, enum.member
5. **Namespace handlers** (1): namespace
6. **Decorator handlers** (3): decorator.class, decorator.method, decorator.property
7. **Method handlers** (2): method.private, method.abstract
8. **Field handlers** (2): field.private, field.param_property
9. **Parameter handlers** (2): parameter.optional, parameter.rest

### Architecture

`TYPESCRIPT_HANDLERS` extends `JAVASCRIPT_HANDLERS` via object spread, then overrides
and adds TypeScript-specific handlers. The handler registry supports distinct handler
sets for JavaScript vs TypeScript via `get_handler_registry()`.

### Tests

All TypeScript builder tests pass (48 tests).
All language config tests pass for JavaScript/TypeScript (512 tests).
