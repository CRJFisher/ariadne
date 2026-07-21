# Task epic-11.116.4.2: Fix Duplicate Constructor Parameter Properties

**Status:** Completed
**Parent:** task-epic-11.116.4
**Priority:** Medium (Quality issue - fixtures contain duplicate data)
**Created:** 2025-10-15
**Completed:** 2025-10-15

## Overview

TypeScript classes with constructor parameter properties (e.g., `constructor(public name: string)`) are being captured twice in the fixture:
1. Once as a property with the full parameter syntax: `"public name: string"`
2. Once as the actual property: `"name"` with type `"string"`

This duplication makes fixtures harder to read and indicates the semantic indexer is over-capturing.

## Problem Description

**Observed in:** `typescript/semantic_index/classes/basic_class.json`

**Source code:**
```typescript
export class User {
  constructor(
    public name: string,
    public email: string
  ) {}
}
```

**Current fixture output:**
```json
{
  "properties": [
    {"name": "public name: string", "type": null},
    {"name": "name", "type": "string"},
    {"name": "public email: string", "type": null},
    {"name": "email", "type": "string"}
  ]
}
```

**Expected fixture output:**
```json
{
  "properties": [
    {"name": "name", "type": "string"},
    {"name": "email", "type": "string"}
  ]
}
```

## Root Cause

The TypeScript semantic indexer is likely capturing both:
1. The parameter declaration node (which includes the `public` modifier)
2. The implicit property created by the parameter property shorthand

## Proposed Fix

**Location:** Likely in `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`

1. Identify where constructor parameter properties are processed
2. Either:
   - Skip the parameter declaration nodes that have property modifiers (public/private/protected)
   - OR filter out property names that match the pattern `"(public|private|protected) .+"`

## Testing

1. Regenerate `typescript/semantic_index/classes/basic_class.json`
2. Verify properties array contains only 2 entries (name, email)
3. Verify no entries with "public" in the name
4. Check other class fixtures with constructor parameter properties

## Affected Fixtures

- `typescript/semantic_index/classes/basic_class.json`
- Potentially other TypeScript class fixtures using parameter properties

## Success Criteria

- ✅ Each constructor parameter property appears exactly once in the properties array
- ✅ Property names are clean identifiers without modifiers
- ✅ Property types are correctly captured
- ✅ No duplicate entries in properties

## Estimated Effort

**1-2 hours**

- 0.5 hours: Locate and understand the duplicate capture logic
- 0.5-1 hour: Implement fix
- 0.5 hours: Test and regenerate fixtures

## Implementation Notes

**Date Completed:** 2025-10-15

### Root Cause Analysis

The duplication occurred because the tree-sitter query in `typescript.scm` had TWO separate capture patterns for constructor parameter properties:

1. Lines 236-239: Captured the ENTIRE `required_parameter` node with `@definition.property` tag
   - This captured text like `"public name: string"` (the full declaration)
2. Lines 242-245: Captured just the identifier with `@definition.field.param_property` tag
   - This captured text like `"name"` (just the identifier)

Both patterns were processed, creating duplicate property entries.

### Solution Implemented

**File 1: [typescript.scm](packages/core/src/index_single_file/query_code_tree/queries/typescript.scm#L235-L247)**

Consolidated the two patterns into one that captures only the identifier with BOTH tags:

```scm
; Constructor parameter properties (with access modifiers)
; These create both a parameter AND an implicit class property
(required_parameter
  (accessibility_modifier)
  pattern: (identifier) @definition.parameter @definition.field.param_property
)

; Constructor parameter properties (readonly)
; These create both a parameter AND an implicit class property
(required_parameter
  "readonly"
  pattern: (identifier) @definition.parameter @definition.field.param_property
)
```

**Key insight:** By capturing the `identifier` node directly (not the parent `required_parameter`), we get the clean name `"name"` instead of `"public name: string"`.

**File 2: [typescript_builder_config.ts](packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts#L620-L637)**

Removed the redundant `param.property` handler (lines 623-650 in original). Now only the `definition.field.param_property` handler processes these captures, creating properties with:
- Correct name: identifier text only
- Correct type: extracted from type annotation
- Correct modifiers: extracted from parent node

### Files Changed

1. `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm` (lines 235-257)
2. `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts` (removed lines 623-650)

### Testing Status

- ✅ TypeScript builder unit tests pass (24/24 tests)
- ✅ Fixtures regenerated and verified (27/27 fixtures pass)
- ✅ `basic_class.json` confirmed: properties array contains exactly 2 entries (name, email)
- ✅ No duplicate properties with "public" prefix
- ✅ Property types correctly captured as "string"

### Verification Completed

All verification steps completed successfully:

1. ✅ Built changes: `npm run build`
2. ✅ Regenerated fixtures: `npm run generate-fixtures:ts --workspace=@ariadnejs/core`
3. ✅ Verified `basic_class.json`: properties = ["name", "email"] (lines 123-155)
4. ✅ All fixtures pass: `npm run verify-fixtures --workspace=@ariadnejs/core` (27/27)

### Relationship to Other Tasks

**No overlap with Task 11.116.4.3** (Constructor in Methods Array):

- This task (11.116.4.2): Fixes duplicate entries in `properties` array
- Task 11.116.4.3: Fixes constructor appearing in `methods` array
- Both are complementary fixes modifying different parts of `typescript.scm`
