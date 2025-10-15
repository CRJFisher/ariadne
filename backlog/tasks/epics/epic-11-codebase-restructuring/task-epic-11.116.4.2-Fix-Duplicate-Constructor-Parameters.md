# Task epic-11.116.4.2: Fix Duplicate Constructor Parameter Properties

**Status:** Not Started
**Parent:** task-epic-11.116.4
**Priority:** Medium (Quality issue - fixtures contain duplicate data)
**Created:** 2025-10-15

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
