# Task Epic 11.104: Implement Reference Metadata Extraction

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 12-16 hours
**Dependencies:** task-epic-11.103 (capture name validation complete)

## Overview

Implement Phase 2 & 3 of the Reference Metadata Extraction plan: create language-specific metadata extractors and wire them into `reference_builder.ts` to extract rich context for method resolution and call-chain detection.

## Problem Statement

Currently, `reference_builder.ts` creates basic `SymbolReference` objects but leaves critical metadata fields stubbed:

- ❌ `context.*` - Always returns `undefined`
- ❌ `type_info` - Always returns `undefined`
- ❌ `member_access.object_type` - Always `undefined`

This metadata is **essential for accurate method resolution** in `symbol_resolution.ts`:
- Method calls need `receiver_location` to trace the receiver object
- Type information helps resolve which class a method belongs to
- Property chains enable tracking chained method calls (`a.b.c.method()`)

## Architecture

### Language-Specific Metadata Extractors

Create separate metadata extractor modules for each language since tree-sitter AST structures differ:

```
query_code_tree/language_configs/
├── metadata_types.ts          # Shared interface
├── javascript_metadata.ts     # JS/TS extractors
├── javascript_metadata.test.ts
├── python_metadata.ts         # Python extractors
├── python_metadata.test.ts
├── rust_metadata.ts           # Rust extractors
└── rust_metadata.test.ts
```

Each extractor implements:

```typescript
export interface MetadataExtractors {
  extract_type_from_annotation(node: SyntaxNode): TypeInfo | undefined;
  extract_call_receiver(node: SyntaxNode): Location | undefined;
  extract_property_chain(node: SyntaxNode): SymbolName[] | undefined;
  extract_assignment_parts(node: SyntaxNode): {
    source: Location | undefined;
    target: Location | undefined;
  };
  extract_construct_target(node: SyntaxNode): Location | undefined;
  extract_type_arguments(node: SyntaxNode): string[] | undefined;
}
```

### Integration with ReferenceBuilder

Update `reference_builder.ts` to:
1. Accept a `MetadataExtractors` parameter
2. Call extractors instead of returning `undefined`
3. Properly populate `context`, `type_info`, and `member_access` fields

Update `semantic_index.ts` to:
1. Get language-specific extractors based on `language` parameter
2. Pass extractors to `ReferenceBuilder` constructor

## Success Criteria

1. ✅ All metadata extractor modules implemented and tested
2. ✅ `reference_builder.ts` uses extractors instead of stubbed functions
3. ✅ 80%+ method calls have `receiver_location` populated
4. ✅ 90%+ type references have `type_info` populated
5. ✅ All semantic_index language integration tests pass
6. ✅ No regressions in existing tests

## Implementation Strategy

### Phase 1: Foundation (Tasks 104.1-104.2)
- Create metadata extractor interface
- Update reference_builder architecture

### Phase 2: JavaScript/TypeScript (Tasks 104.3.1-104.3.6)
- Implement JS/TS metadata extractors
- Test extractors in isolation
- Wire into reference_builder
- Fix semantic_index integration tests

### Phase 3: Python (Tasks 104.4.1-104.4.4)
- Implement Python metadata extractors
- Test and integrate
- Fix Python integration tests

### Phase 4: Rust (Tasks 104.5.1-104.5.4)
- Implement Rust metadata extractors
- Test and integrate
- Fix Rust integration tests

### Phase 5: Integration & Validation (Tasks 104.6.1-104.6.3)
- Update reference_builder tests
- End-to-end validation
- Documentation updates

## Sub-Tasks

1. **104.1** - Create metadata extractor interface and types
2. **104.2** - Refactor reference_builder to accept extractors
3. **104.3** - Implement JavaScript/TypeScript metadata extraction
   - 104.3.1 - Implement javascript_metadata.ts
   - 104.3.2 - Test javascript_metadata.ts
   - 104.3.3 - Wire JS/TS extractors into semantic_index
   - 104.3.4 - Fix semantic_index.javascript.test.ts
   - 104.3.5 - Fix semantic_index.typescript.test.ts
   - 104.3.6 - Fix javascript_builder.test.ts for metadata
4. **104.4** - Implement Python metadata extraction
   - 104.4.1 - Implement python_metadata.ts
   - 104.4.2 - Test python_metadata.ts
   - 104.4.3 - Wire Python extractors into semantic_index
   - 104.4.4 - Fix semantic_index.python.test.ts
5. **104.5** - Implement Rust metadata extraction
   - 104.5.1 - Implement rust_metadata.ts
   - 104.5.2 - Test rust_metadata.ts
   - 104.5.3 - Wire Rust extractors into semantic_index
   - 104.5.4 - Fix semantic_index.rust.test.ts
6. **104.6** - Integration and validation
   - 104.6.1 - Update reference_builder.test.ts for metadata
   - 104.6.2 - End-to-end validation across all languages
   - 104.6.3 - Clean up TODOs and update documentation

## Testing Strategy

### Unit Tests
Each `*_metadata.ts` file has corresponding `*_metadata.test.ts`:
- Test each extractor function in isolation
- Use minimal code snippets parsed with tree-sitter
- Verify correct AST traversal for each language

### Integration Tests
Update existing `semantic_index.*.test.ts` files:
- Add assertions for metadata fields being populated
- Verify method calls have receiver information
- Verify type references have type_info
- Ensure no regressions in existing assertions

## Notes

- Start with JavaScript as proof-of-concept (most common language)
- Python and Rust can reuse JavaScript patterns but with language-specific AST handling
- Keep extractors pure functions for easy testing
- Document any AST traversal gotchas discovered during implementation

## Related Files

- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`
- `packages/core/src/index_single_file/semantic_index.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/`
- `packages/core/src/resolve_references/method_resolution_simple/method_resolution.ts`
- `REFERENCE_METADATA_PLAN.md`
