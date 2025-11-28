# Task 11.161.1.8: Update Imports and Delete Old Files

## Status: Planning

## Parent: Task 11.161.1

## Goal

Update all imports to use new directory structure and delete old `language_configs/` files.

## Prerequisites

All previous subtasks must be completed:

- 11.161.1.1: Directory structure created
- 11.161.1.2-5: Handler functions extracted
- 11.161.1.6: Metadata extractors migrated
- 11.161.1.7: Symbol factories migrated

## Implementation Steps

### 1. Update semantic_index.ts

Primary consumer of language configs:

```typescript
// Before
import { JAVASCRIPT_BUILDER_CONFIG } from "./query_code_tree/language_configs/javascript_builder_config";
import { TYPESCRIPT_BUILDER_CONFIG } from "./query_code_tree/language_configs/typescript_builder_config";
import { PYTHON_BUILDER_CONFIG } from "./query_code_tree/language_configs/python_builder_config";
import { RUST_BUILDER_CONFIG } from "./query_code_tree/language_configs/rust_builder";
import type { LanguageBuilderConfig } from "./query_code_tree/language_configs/javascript_builder";

// After
import { get_handler_registry } from "./query_code_tree/capture_handlers";
import type { HandlerRegistry } from "./query_code_tree/capture_handlers/types";
```

Update `get_language_config` function:

```typescript
// Before
function get_language_config(language: Language): LanguageBuilderConfig { ... }

// After
function get_handler_registry_for_language(language: Language): HandlerRegistry {
  return get_handler_registry(language);
}
```

Update dispatch code:

```typescript
// Before
const handler = config.get(capture.name);
if (handler) {
  handler.process(capture, builder, context);
}

// After
const handler = registry[capture.name];
if (handler) {
  handler(capture, builder, context);
}
```

### 2. Update reference_builder.ts

```typescript
// Before
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/javascript_metadata";
import type { MetadataExtractors } from "./query_code_tree/language_configs/metadata_types";

// After
import { get_metadata_extractor } from "./query_code_tree/metadata_extractors";
import type { MetadataExtractors } from "./query_code_tree/metadata_extractors/types";
```

### 3. Update Test Files

Update imports in all test files:

```typescript
// Before
import { JAVASCRIPT_BUILDER_CONFIG } from "../language_configs/javascript_builder_config";

// After
import { JAVASCRIPT_HANDLERS, handle_definition_class } from "../capture_handlers/javascript";
```

Tests can now import individual handlers for focused testing:

```typescript
describe("handle_definition_class", () => {
  it("should create class definition", () => {
    // Direct test of named handler
    handle_definition_class(capture, builder, context);
    // assertions
  });
});
```

### 4. Delete Old Files

After all imports updated and tests pass:

**language_configs/ files to delete:**

- `javascript_builder.ts`
- `javascript_builder_config.ts`
- `javascript_reexport_config.ts`
- `javascript_export_analysis.ts`
- `typescript_builder.ts`
- `typescript_builder_config.ts`
- `python_builder.ts`
- `python_builder_config.ts`
- `python_imports.ts`
- `rust_builder.ts`
- `rust_builder_helpers.ts`
- `rust_method_config.ts`
- `rust_callback_detection.ts`
- `rust_import_extraction.ts`
- `metadata_types.ts`
- `javascript_metadata.ts`
- `typescript_metadata.ts`
- `python_metadata.ts`
- `rust_metadata.ts`

**Test files to delete (after moving):**

- `javascript_builder.test.ts`
- `typescript_builder.test.ts`
- `python_builder.test.ts`
- `rust_builder.test.ts`
- `javascript_metadata.test.ts`
- `python_metadata.test.ts`
- `rust_metadata.test.ts`
- `collection_resolution.test.ts` (move to appropriate location)
- `export_verification.test.ts` (move to appropriate location)

### 5. Delete language_configs Directory

Once empty:

```bash
rm -r packages/core/src/index_single_file/query_code_tree/language_configs
```

### 6. Run Full Test Suite

```bash
npm test
```

Verify:

- All unit tests pass
- All integration tests pass
- No TypeScript errors
- No ESLint errors

## Files to Update

| File | Changes |
|------|---------|
| `semantic_index.ts` | Import from `capture_handlers`, use `HandlerRegistry` |
| `reference_builder.ts` | Import from `metadata_extractors` |
| `definitions/definition_builder.ts` | May need updates |
| All `*.test.ts` in old location | Move to new locations |

## Verification Checklist

- [ ] All imports updated
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Old files deleted
- [ ] `language_configs/` directory removed
- [ ] No dead code remaining

## Success Criteria

1. No references to `language_configs/` directory
2. All tests pass
3. No TypeScript errors
4. Clean directory structure
