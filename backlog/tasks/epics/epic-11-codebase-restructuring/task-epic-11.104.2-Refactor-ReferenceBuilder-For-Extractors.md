# Task 104.2: Refactor ReferenceBuilder to Accept Extractors

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 hours
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.1

## Objective

Refactor `reference_builder.ts` to accept a `MetadataExtractors` parameter and replace all stubbed metadata extraction functions with calls to the extractors.

## File to Modify

`packages/core/src/index_single_file/query_code_tree/reference_builder.ts`

## Current State

The file has stubbed functions that always return `undefined`:
- `extract_type_info()` - lines 153-167
- `extract_context()` - lines 169-277
- Inline stubs in `process_method_reference()` - line 290
- Inline stubs in `process_type_reference()` - line 327
- Inline stubs in `ReferenceBuilder.process()` - lines 403, 419, 429

## Implementation Details

### 1. Add MetadataExtractors Parameter to Constructor

Update the `ReferenceBuilder` class:

```typescript
import type { MetadataExtractors } from "./language_configs/metadata_types";

export class ReferenceBuilder {
  private readonly references: SymbolReference[] = [];

  constructor(
    private readonly context: ProcessingContext,
    private readonly extractors: MetadataExtractors  // ADD THIS
  ) {}

  // ... rest of class
}
```

### 2. Update process_references() Function

Update the main entry point to require extractors:

```typescript
export function process_references(
  context: ProcessingContext,
  extractors: MetadataExtractors  // ADD THIS
): SymbolReference[] {
  return context.captures
    .filter(
      (capture) =>
        capture.category === "reference" ||
        capture.category === "assignment" ||
        capture.category === "return"
    )
    .reduce(
      (builder, capture) => builder.process(capture),
      new ReferenceBuilder(context, extractors)  // PASS EXTRACTORS
    )
    .build();
}
```

### 3. Replace extract_type_info() Function

Replace the stubbed function (lines 153-167) with extractor calls:

```typescript
/**
 * Extract type information from capture using language-specific extractors
 */
function extract_type_info(
  capture: CaptureNode,
  extractors: MetadataExtractors
): TypeInfo | undefined {
  // Delegate to language-specific extractor
  return extractors.extract_type_from_annotation(
    capture.node,
    capture.location.file_path
  );
}
```

Update all call sites to pass `this.extractors`.

### 4. Replace extract_context() Function

Replace the stubbed function (lines 169-277) with extractor calls:

```typescript
/**
 * Extract reference context from capture using language-specific extractors
 */
function extract_context(
  capture: CaptureNode,
  extractors: MetadataExtractors
): ReferenceContext | undefined {
  const kind = determine_reference_kind(capture);

  // Method calls: extract receiver location
  if (kind === ReferenceKind.METHOD_CALL) {
    const receiver_location = extractors.extract_call_receiver(
      capture.node,
      capture.location.file_path
    );
    if (receiver_location) {
      return { receiver_location };
    }
  }

  // Property access: extract property chain
  if (kind === ReferenceKind.PROPERTY_ACCESS) {
    const property_chain = extractors.extract_property_chain(capture.node);
    if (property_chain && property_chain.length > 0) {
      return { property_chain };
    }
  }

  // Assignments: extract source and target
  if (kind === ReferenceKind.ASSIGNMENT) {
    const { source, target } = extractors.extract_assignment_parts(
      capture.node,
      capture.location.file_path
    );
    if (source || target) {
      return {
        ...(source && { assignment_source: source }),
        ...(target && { assignment_target: target }),
      };
    }
  }

  // Constructor calls: extract target variable
  if (kind === ReferenceKind.CONSTRUCTOR_CALL) {
    const construct_target = extractors.extract_construct_target(
      capture.node,
      capture.location.file_path
    );
    if (construct_target) {
      return { construct_target };
    }
  }

  return undefined;
}
```

Update all call sites to pass `this.extractors`.

### 5. Update process_method_reference()

Replace inline stub (line 290):

```typescript
function process_method_reference(
  capture: CaptureNode,
  context: ProcessingContext,
  extractors: MetadataExtractors  // ADD THIS
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);
  const reference_type = map_to_reference_type(ReferenceKind.METHOD_CALL);

  // Extract type information from node
  const type_info = extract_type_info(capture, extractors);

  // Build member access details
  const member_access = {
    object_type: type_info,  // Use extracted type info
    access_type: "method" as const,
    is_optional_chain: false,
  };

  return {
    location: capture.location,
    type: reference_type,
    scope_id: scope_id,
    name: capture.text,
    context: extract_context(capture, extractors),
    type_info: type_info,
    call_type: "method",
    member_access: member_access,
  };
}
```

Update call site in `ReferenceBuilder.process()` line 376 to pass extractors.

### 6. Update process_type_reference()

Replace inline stub (line 327):

```typescript
function process_type_reference(
  capture: CaptureNode,
  context: ProcessingContext,
  extractors: MetadataExtractors  // ADD THIS
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);

  // Extract type information and generic arguments
  const type_info = extract_type_info(capture, extractors);
  const type_args = extractors.extract_type_arguments(capture.node);

  // Enhance type info with generic parameters if available
  const enhanced_type_info =
    type_args && type_args.length > 0 && type_info
      ? {
          ...type_info,
          type_name: `${type_info.type_name}<${type_args.join(', ')}>` as SymbolName,
        }
      : type_info;

  return {
    location: capture.location,
    type: "type",
    scope_id: scope_id,
    name: capture.text,
    context: extract_context(capture, extractors),
    type_info: enhanced_type_info,
  };
}
```

Update call site in `ReferenceBuilder.process()` line 381 to pass extractors.

### 7. Update ReferenceBuilder.process() Method

Update all extractor calls in the main processing method:

```typescript
process(capture: CaptureNode): ReferenceBuilder {
  // ... existing category check ...

  const kind = determine_reference_kind(capture);

  // Route to special handlers
  if (kind === ReferenceKind.METHOD_CALL) {
    this.references.push(
      process_method_reference(capture, this.context, this.extractors)
    );
    return this;
  }

  if (kind === ReferenceKind.TYPE_REFERENCE) {
    this.references.push(
      process_type_reference(capture, this.context, this.extractors)
    );
    return this;
  }

  // Build standard reference
  const scope_id = this.context.get_scope_id(capture.location);
  const reference_type = map_to_reference_type(kind);

  const reference: SymbolReference = {
    location: capture.location,
    type: reference_type,
    scope_id: scope_id,
    name: capture.text,
    context: extract_context(capture, this.extractors),  // USE EXTRACTORS
    type_info: extract_type_info(capture, this.extractors),  // USE EXTRACTORS
    call_type: determine_call_type(kind),
  };

  // Assignment handling
  if (kind === ReferenceKind.ASSIGNMENT) {
    const type_info = extract_type_info(capture, this.extractors);
    if (type_info) {
      const type_flow_info = {
        source_type: undefined,  // Could be enhanced later
        target_type: type_info,
        is_narrowing: false,
        is_widening: false,
      };
      const updated_ref = { ...reference, type_flow: type_flow_info };
      this.references.push(updated_ref);
      return this;
    }
  }

  // Return handling
  if (kind === ReferenceKind.RETURN) {
    const return_type = extract_type_info(capture, this.extractors);
    if (return_type) {
      const updated_ref = { ...reference, return_type };
      this.references.push(updated_ref);
      return this;
    }
  }

  // Property access handling
  if (kind === ReferenceKind.PROPERTY_ACCESS) {
    const type_info = extract_type_info(capture, this.extractors);
    const member_access_info = {
      object_type: type_info,
      access_type: "property" as const,
      is_optional_chain: false,
    };
    const updated_ref = { ...reference, member_access: member_access_info };
    this.references.push(updated_ref);
    return this;
  }

  this.references.push(reference);
  return this;
}
```

### 8. Remove Unused Imports

Remove `ReferenceContext` and `TypeInfo` from imports if no longer directly used.

## Implementation Steps

1. Add import for `MetadataExtractors`
2. Update `ReferenceBuilder` constructor signature
3. Update `process_references()` function signature
4. Replace `extract_type_info()` implementation
5. Replace `extract_context()` implementation
6. Update `process_method_reference()` signature and implementation
7. Update `process_type_reference()` signature and implementation
8. Update all extractor calls in `ReferenceBuilder.process()`
9. Remove any unused imports or dead code
10. Verify TypeScript compilation

## Testing

This task breaks existing tests - that's expected. Tests will be fixed in subsequent tasks after language-specific extractors are implemented.

Expected test failures:
- `reference_builder.test.ts` - needs extractors parameter
- All semantic_index tests - need to pass extractors

## Success Criteria

- ✅ `ReferenceBuilder` accepts `MetadataExtractors` parameter
- ✅ All stubbed functions replaced with extractor calls
- ✅ `process_references()` requires extractors parameter
- ✅ No direct `undefined` returns - delegates to extractors
- ✅ TypeScript compiles (tests may fail - will be fixed in 104.3+)
- ✅ All TODO comments related to metadata extraction removed

## Notes

- This is a pure refactoring - no new functionality, just infrastructure
- Tests will fail until extractors are implemented and wired in
- Keep extractor calls simple - complexity belongs in language-specific implementations
- Preserve existing logic for determining reference kinds

## Related Files

- `packages/core/src/index_single_file/semantic_index.ts` (will need update in 104.3.3)
- `packages/core/src/index_single_file/query_code_tree/reference_builder.test.ts` (will need update in 104.6.1)
