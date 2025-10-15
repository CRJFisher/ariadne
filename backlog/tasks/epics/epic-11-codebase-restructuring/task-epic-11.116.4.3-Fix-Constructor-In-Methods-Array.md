# Task epic-11.116.4.3: Fix Constructor Appearing in Methods Array

**Status:** Not Started
**Parent:** task-epic-11.116.4
**Priority:** Low (Quality issue - redundant data but not incorrect)
**Created:** 2025-10-15

## Overview

TypeScript constructors are appearing in both the dedicated `constructor` field AND in the `methods` array of ClassDefinition objects. This is redundant and makes fixtures harder to navigate.

## Problem Description

**Observed in:** `typescript/semantic_index/classes/basic_class.json`

**Source code:**
```typescript
export class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  greet(): string {
    return `Hello, ${this.name}`;
  }
}
```

**Current fixture output:**
```json
{
  "constructor": [
    {
      "kind": "constructor",
      "name": "constructor",
      ...
    }
  ],
  "methods": [
    {
      "name": "constructor",
      "return_type": null
    },
    {
      "name": "greet",
      "return_type": "string"
    }
  ]
}
```

**Expected fixture output:**
```json
{
  "constructor": [
    {
      "kind": "constructor",
      "name": "constructor",
      ...
    }
  ],
  "methods": [
    {
      "name": "greet",
      "return_type": "string"
    }
  ]
}
```

## Root Cause

The TypeScript builder is likely adding the constructor to both:
1. The dedicated `constructor` array (via `add_constructor_to_class`)
2. The `methods` array (via `add_method_to_class` or general method processing)

## Proposed Fix

**Location:** `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`

1. Check the tree-sitter query captures for constructors
2. Ensure constructor captures are only processed by the constructor handler, not the method handler
3. OR add a filter in method processing to skip nodes with name "constructor"

## Testing

1. Regenerate TypeScript class fixtures
2. Verify `methods` array does NOT contain constructor entries
3. Verify `constructor` field still has constructor data
4. Check JavaScript class fixtures as they may have the same issue

## Affected Fixtures

- `typescript/semantic_index/classes/basic_class.json`
- Potentially all TypeScript class fixtures with constructors
- Potentially JavaScript class fixtures

## Success Criteria

- ✅ Constructor only appears in `constructor` field
- ✅ Constructor does NOT appear in `methods` array
- ✅ Other methods still appear correctly in `methods` array
- ✅ No functional regression in constructor handling

## Estimated Effort

**1-2 hours**

- 0.5 hours: Identify where constructor is being added to methods
- 0.5-1 hour: Implement fix (likely a filter or query adjustment)
- 0.5 hours: Test and regenerate fixtures
