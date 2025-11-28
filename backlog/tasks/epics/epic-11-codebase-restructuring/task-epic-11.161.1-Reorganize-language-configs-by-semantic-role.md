# Task 11.161.1: Reorganize language_configs by Semantic Role

## Status: Planning

## Parent: Task 11.161

## Goal

Split `packages/core/src/index_single_file/query_code_tree/language_configs/` into semantic role directories with named handler functions.

## Current State

The `language_configs/` directory contains ~28 files mixing three distinct concerns:

1. **Capture Handlers** - Map capture names to processing functions (`*_builder_config.ts`)
2. **Metadata Extractors** - Extract type info, receivers, property chains (`*_metadata.ts`)
3. **Symbol Factories** - Create SymbolIds, find containing scopes (`*_builder.ts`)

Current pattern uses anonymous functions in Maps:

```typescript
const CONFIG: LanguageBuilderConfig = new Map([
  ["definition.class", { process: (capture, builder, context) => { ... } }],
]);
```

## Target State

Three directories organized by semantic role, with named handler functions:

```
query_code_tree/
├── capture_handlers/
│   ├── types.ts          # HandlerFunction, HandlerRegistry types
│   ├── index.ts          # get_handler_registry(language)
│   ├── javascript.ts     # Named handlers + JAVASCRIPT_HANDLERS
│   ├── typescript.ts
│   ├── python.ts
│   └── rust.ts
│
├── metadata_extractors/
│   ├── types.ts          # MetadataExtractors interface
│   ├── index.ts          # get_metadata_extractor(language)
│   ├── javascript.ts
│   ├── typescript.ts
│   ├── python.ts
│   └── rust.ts
│
├── symbol_factories/
│   ├── types.ts
│   ├── index.ts
│   ├── javascript.ts
│   ├── typescript.ts
│   ├── python.ts
│   └── rust.ts
│
└── queries/              # Unchanged
```

Named handler pattern:

```typescript
// capture_handlers/javascript.ts
export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const class_id = create_class_id(capture);
  // ...
}

export const JAVASCRIPT_HANDLERS: HandlerRegistry = {
  "definition.class": handle_definition_class,
  "definition.method": handle_definition_method,
  // ...
} as const;
```

## Subtasks

### 11.161.1.1: Create Semantic Role Directory Structure

Create directories and type files:

- `capture_handlers/types.ts` - HandlerFunction, HandlerRegistry
- `metadata_extractors/types.ts` - MetadataExtractors (from metadata_types.ts)
- `symbol_factories/types.ts` - Shared types

### 11.161.1.2: Extract Named Handler Functions (JavaScript)

- Extract handlers from `javascript_builder_config.ts`
- Create named functions in `capture_handlers/javascript.ts`
- Create `JAVASCRIPT_HANDLERS` object
- Move JavaScript symbol helpers to `symbol_factories/javascript.ts`

### 11.161.1.3: Extract Named Handler Functions (TypeScript)

Same for TypeScript (extends JavaScript).

### 11.161.1.4: Extract Named Handler Functions (Python)

Same for Python.

### 11.161.1.5: Extract Named Handler Functions (Rust)

Same for Rust.

### 11.161.1.6: Migrate Metadata Extractors

- `javascript_metadata.ts` → `metadata_extractors/javascript.ts`
- `typescript_metadata.ts` → `metadata_extractors/typescript.ts`
- `python_metadata.ts` → `metadata_extractors/python.ts`
- `rust_metadata.ts` → `metadata_extractors/rust.ts`
- `metadata_types.ts` → `metadata_extractors/types.ts`

### 11.161.1.7: Migrate Symbol Factories

Extract symbol creation helpers from `*_builder.ts`:

- `create_class_id`, `create_method_id`, `create_function_id`, etc.
- `find_containing_class`, `find_containing_callable`, etc.
- `extract_export_info`, `extract_extends`, etc.

### 11.161.1.8: Update Imports and Delete Old Files

- Update imports in `semantic_index.ts`
- Update imports in test files
- Delete `language_configs/` directory
- Run full test suite

## Files to Modify

### Source Files

- `packages/core/src/index_single_file/semantic_index.ts` - Main consumer
- All files in `language_configs/` (migrate then delete)

### Test Files

- `javascript_builder.test.ts` → `capture_handlers/javascript.test.ts`
- `javascript_metadata.test.ts` → `metadata_extractors/javascript.test.ts`
- Similar for other languages

## Success Criteria

1. All handlers are named, exported functions
2. Directory structure matches target
3. All tests pass
4. No circular dependencies
5. Import paths updated throughout codebase
