# Task 104.3.3: Wire JavaScript/TypeScript Extractors Into Semantic Index

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 45 minutes
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.2, task-epic-11.104.3.1

## Objective

Update `semantic_index.ts` to pass language-specific metadata extractors to `ReferenceBuilder`, enabling actual metadata extraction instead of stubbed `undefined` returns.

## File to Modify

`packages/core/src/index_single_file/semantic_index.ts`

## Current State

The file calls `process_references(context)` without extractors (line 127):

```typescript
// PASS 4: Process references (language-agnostic)
const all_references = process_references(context);
```

## Implementation Details

### 1. Import Metadata Extractors

Add imports at top of file:

```typescript
import type { MetadataExtractors } from "./query_code_tree/language_configs/metadata_types";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/javascript_metadata";
// Python and Rust will be added in later tasks
```

### 2. Create Extractor Router Function

Add function after `get_language_config()`:

```typescript
/**
 * Get language-specific metadata extractors
 */
function get_metadata_extractors(language: Language): MetadataExtractors {
  switch (language) {
    case "javascript":
    case "typescript":
      return JAVASCRIPT_METADATA_EXTRACTORS;

    case "python":
      // Will be implemented in task 104.4.3
      throw new Error(`Metadata extractors not yet implemented for ${language}`);

    case "rust":
      // Will be implemented in task 104.5.3
      throw new Error(`Metadata extractors not yet implemented for ${language}`);

    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
```

### 3. Update process_references() Call

Modify the call site in `build_semantic_index()` (line 127):

```typescript
// PASS 4: Process references with language-specific metadata extraction
const extractors = get_metadata_extractors(language);
const all_references = process_references(context, extractors);
```

### 4. Add Documentation Comment

Update the comment above the call to reflect metadata extraction:

```typescript
  // PASS 4: Process references with language-specific metadata extraction
  // Extractors parse AST structures to extract:
  // - Type information from annotations
  // - Method call receiver locations
  // - Property access chains
  // - Assignment source/target
  // - Constructor call targets
  const extractors = get_metadata_extractors(language);
  const all_references = process_references(context, extractors);
```

## Implementation Steps

1. Add import for `MetadataExtractors` type
2. Add import for `JAVASCRIPT_METADATA_EXTRACTORS`
3. Create `get_metadata_extractors()` function
4. Update comment above reference processing
5. Add extractor router call
6. Pass extractors to `process_references()`
7. Verify TypeScript compilation
8. Run JavaScript tests to verify integration

## Testing

Run the JavaScript integration test to verify wiring:

```bash
cd packages/core
npx vitest run src/index_single_file/semantic_index.javascript.test.ts
```

Expected: Tests may still fail but should now call the extractors instead of stubbed functions. Failures should be related to test assertions, not "undefined" parameters.

## Success Criteria

- ✅ `JAVASCRIPT_METADATA_EXTRACTORS` imported
- ✅ `get_metadata_extractors()` function created
- ✅ Function routes JavaScript and TypeScript to JS extractors
- ✅ Function throws for Python and Rust (temporary)
- ✅ `process_references()` receives extractors
- ✅ TypeScript compiles without errors
- ✅ semantic_index.javascript.test.ts runs (may have failures to fix in 104.3.4)

## Notes

### Why Throw for Python/Rust?

Throwing errors for unimplemented languages ensures:
1. Clear failure if those languages are tested before implementation
2. Reminder to update this function when adding new extractors
3. No silent failures with undefined behavior

### Testing Strategy

Don't fix all test failures in this task - that's for 104.3.4. This task only verifies:
1. Extractors are called
2. No TypeScript errors
3. Basic integration works

### Expected Test Behavior

After this change:
- JavaScript/TypeScript tests: Will call extractors (may still fail on assertions)
- Python tests: Will throw "not yet implemented" error
- Rust tests: Will throw "not yet implemented" error

This is expected and will be resolved in tasks 104.4.3 and 104.5.3.

## Related Files

- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts` (updated in 104.2)
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts` (created in 104.3.1)
- `packages/core/src/index_single_file/semantic_index.javascript.test.ts` (will fix in 104.3.4)
