# Task 11.161.1.7: Migrate Symbol Factories

## Status: Planning

## Parent: Task 11.161.1

## Goal

Extract symbol creation helpers from `*_builder.ts` files to `symbol_factories/` directory.

## Current State

Symbol creation functions scattered across `*_builder.ts` files:

**javascript_builder.ts** exports:
- `create_class_id(capture)`
- `create_method_id(capture)`
- `create_function_id(capture)`
- `create_variable_id(capture)`
- `create_parameter_id(capture)`
- `create_property_id(capture)`
- `create_import_id(capture)`
- `find_function_scope_at_location(location, scopes)`
- `find_containing_class(capture)`
- `find_containing_callable(capture)`
- `extract_export_info(node, text)`
- `extract_return_type(node)`
- `extract_parameter_type(node)`
- `extract_property_type(node)`
- `extract_type_annotation(node)`
- `extract_initial_value(node)`
- `extract_default_value(node)`
- `extract_import_path(node)`
- `extract_require_path(node)`
- `extract_original_name(node)`
- `is_default_import(node)`
- `is_namespace_import(node)`
- `extract_extends(node)`
- `store_documentation(text, line)`
- `consume_documentation(location)`
- `detect_callback_context(capture)`
- `detect_function_collection(capture)`
- `extract_derived_from(node)`

**python_builder.ts** exports similar functions with Python-specific logic.

**rust_builder.ts** + **rust_builder_helpers.ts** export Rust-specific versions.

## Target State

```
symbol_factories/
├── types.ts          # Shared types
├── index.ts          # Re-exports
├── javascript.ts     # JavaScript symbol factories
├── typescript.ts     # TypeScript extensions
├── python.ts         # Python symbol factories
└── rust.ts           # Rust symbol factories
```

## Implementation Steps

### 1. Create symbol_factories/types.ts

```typescript
import type { SymbolId, SymbolLocation } from "@ariadnejs/types";
import type { CaptureNode } from "../../semantic_index";

export interface ExportInfo {
  is_exported: boolean;
  export?: {
    exported_name: string;
    is_default: boolean;
    is_reexport: boolean;
  };
}

export interface CallbackContext {
  is_callback: boolean;
  callback_type?: "argument" | "property" | "array_element";
}

export interface FunctionCollectionContext {
  is_in_collection: boolean;
  collection_type?: "object" | "array" | "map";
}
```

### 2. Create symbol_factories/javascript.ts

Move from `javascript_builder.ts`:

```typescript
// Symbol ID creators
export function create_class_id(capture: CaptureNode): SymbolId { ... }
export function create_method_id(capture: CaptureNode): SymbolId { ... }
export function create_function_id(capture: CaptureNode): SymbolId { ... }
export function create_variable_id(capture: CaptureNode): SymbolId { ... }
export function create_parameter_id(capture: CaptureNode): SymbolId { ... }
export function create_property_id(capture: CaptureNode): SymbolId { ... }
export function create_import_id(capture: CaptureNode): SymbolId { ... }

// Scope finders
export function find_function_scope_at_location(...): ScopeId | undefined { ... }
export function find_containing_class(capture: CaptureNode): SymbolId | undefined { ... }
export function find_containing_callable(capture: CaptureNode): SymbolId | undefined { ... }

// Export extraction
export function extract_export_info(node: SyntaxNode, text: string): ExportInfo { ... }

// Type extraction
export function extract_return_type(node: SyntaxNode): TypeExpression | undefined { ... }
export function extract_parameter_type(node: SyntaxNode): TypeExpression | undefined { ... }
export function extract_property_type(node: SyntaxNode): TypeExpression | undefined { ... }
export function extract_type_annotation(node: SyntaxNode): TypeExpression | undefined { ... }

// Value extraction
export function extract_initial_value(node: SyntaxNode): string | undefined { ... }
export function extract_default_value(node: SyntaxNode): string | undefined { ... }

// Import extraction
export function extract_import_path(node: SyntaxNode): string | undefined { ... }
export function extract_require_path(node: SyntaxNode): string | undefined { ... }
export function extract_original_name(node: SyntaxNode): string | undefined { ... }
export function is_default_import(node: SyntaxNode): boolean { ... }
export function is_namespace_import(node: SyntaxNode): boolean { ... }

// Inheritance
export function extract_extends(node: SyntaxNode): string[] { ... }

// Documentation
export function store_documentation(text: string, line: number): void { ... }
export function consume_documentation(location: SymbolLocation): string | undefined { ... }

// Callback detection
export function detect_callback_context(capture: CaptureNode): CallbackContext { ... }
export function detect_function_collection(capture: CaptureNode): FunctionCollectionContext { ... }

// Misc
export function extract_derived_from(node: SyntaxNode): SymbolLocation | undefined { ... }
```

### 3. Create symbol_factories/typescript.ts

TypeScript may share most with JavaScript, import and re-export:

```typescript
// Re-export JavaScript factories
export * from "./javascript";

// TypeScript-specific additions
export function create_interface_id(capture: CaptureNode): SymbolId { ... }
export function create_type_alias_id(capture: CaptureNode): SymbolId { ... }
export function create_enum_id(capture: CaptureNode): SymbolId { ... }
export function create_namespace_id(capture: CaptureNode): SymbolId { ... }
```

### 4. Create symbol_factories/python.ts

Move from `python_builder.ts`:

```typescript
export function create_class_id(capture: CaptureNode): SymbolId { ... }
export function create_method_id(capture: CaptureNode): SymbolId { ... }
export function create_function_id(capture: CaptureNode): SymbolId { ... }
// ... Python-specific versions
export function find_containing_protocol(capture: CaptureNode): SymbolId | undefined { ... }
export function determine_method_type(node: SyntaxNode): MethodType { ... }
export function is_async_function(node: SyntaxNode): boolean { ... }
```

### 5. Create symbol_factories/rust.ts

Consolidate from `rust_builder.ts`, `rust_builder_helpers.ts`, etc.:

```typescript
export function create_function_id(capture: CaptureNode): SymbolId { ... }
export function create_struct_id(capture: CaptureNode): SymbolId { ... }
export function create_enum_id(capture: CaptureNode): SymbolId { ... }
export function create_trait_id(capture: CaptureNode): SymbolId { ... }
// ... Rust-specific versions
export function find_impl_block(capture: CaptureNode): ImplBlockInfo | undefined { ... }
export function extract_visibility(node: SyntaxNode): Visibility { ... }
```

### 6. Create symbol_factories/index.ts

```typescript
// Re-export all factories organized by language
export * as javascript from "./javascript";
export * as typescript from "./typescript";
export * as python from "./python";
export * as rust from "./rust";

// Common types
export type { ExportInfo, CallbackContext, FunctionCollectionContext } from "./types";
```

## Files to Delete (After Migration)

- `language_configs/javascript_builder.ts` (after handlers + factories extracted)
- `language_configs/typescript_builder.ts`
- `language_configs/python_builder.ts`
- `language_configs/rust_builder.ts`
- `language_configs/rust_builder_helpers.ts`

## Dependencies

- Task 11.161.1.1 (directory structure)
- Should be done in parallel with handler extraction (11.161.1.2-5)

## Success Criteria

1. All symbol factory functions moved to `symbol_factories/`
2. Functions properly organized by language
3. Handlers import from `symbol_factories/`
4. All tests pass
