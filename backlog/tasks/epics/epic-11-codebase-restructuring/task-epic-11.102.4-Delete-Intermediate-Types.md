# Task: Delete Intermediate Types

## Status: Created

## Parent Task

task-epic-11.102 - Replace NormalizedCapture with Direct Definition Builders

## Objective

Delete all intermediate capture types and their associated infrastructure, replacing them with direct Definition creation.

## Files to Delete

### Core Type Files

```typescript
// DELETE ENTIRELY:
packages / core / src / parse_and_query_code / capture_types.ts; // Contains NormalizedCapture
packages / core / src / parse_and_query_code / capture_normalizer.ts; // Conversion logic
```

### Types to Remove

From `capture_types.ts`, delete:

- `NormalizedCapture` interface
- `SemanticModifiers` interface
- `CaptureContext` interface
- `SemanticCategory` enum (keep if needed for RawCapture)
- `SemanticEntity` enum (keep if needed for routing)
- `GroupedCaptures` interface
- Any helper types that depend on NormalizedCapture

## Types to Keep/Move

These may be useful for the new system:

- `SemanticCategory` - Move to definition_builder.ts if needed
- `SemanticEntity` - Move to definition_builder.ts if needed
- `Location` - Already in @ariadnejs/types

## Code to Update

### Remove NormalizedCapture Usage

Search and remove all references to:

```bash
# Find all imports
grep -r "NormalizedCapture" packages/
grep -r "SemanticModifiers" packages/
grep -r "CaptureContext" packages/
grep -r "capture_normalizer" packages/
```

### Update Import Statements

Replace:

```typescript
import { NormalizedCapture } from "../capture_types";
```

With:

```typescript
import { RawCapture } from "../definition_builder";
```

## Migration Notes

- This is a BREAKING change - no deprecation
- All consuming code must be updated to use the builder pattern
- Tests will fail until all updates are complete

## Success Criteria

- [ ] capture_types.ts deleted
- [ ] capture_normalizer.ts deleted
- [ ] No references to NormalizedCapture remain
- [ ] No references to SemanticModifiers remain
- [ ] No references to CaptureContext remain
- [ ] All imports updated

## Dependencies

- task-epic-11.102.1, 102.2, 102.3 must be complete (all builders exist)

## Estimated Effort

~1 hour
