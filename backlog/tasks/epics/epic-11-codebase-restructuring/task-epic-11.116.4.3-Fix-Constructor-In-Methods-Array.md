# Task epic-11.116.4.3: Fix Constructor Appearing in Methods Array

**Status:** Completed
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

---

## Implementation Notes

### Root Cause Analysis

The issue was in the tree-sitter query captures. Constructors were being captured twice:

1. By `@definition.constructor` at [typescript.scm:407-411](../../../packages/core/src/index_single_file/query_code_tree/queries/typescript.scm#L407-L411) - specifically matches constructors
2. By `@definition.method` at [typescript.scm:396-401](../../../packages/core/src/index_single_file/query_code_tree/queries/typescript.scm#L396-L401) - matches ALL method_definition nodes (including constructors)

This dual capture caused constructors to be processed by both handlers:
- `definition.constructor` → `add_constructor_to_class()` → adds to `constructor` array
- `definition.method` → `add_method_to_class()` → adds to `methods` array

### Fix Implementation

Fixed at the tree-sitter query level by adding a predicate to exclude constructors from method captures. This is cleaner than filtering in the handler code.

**Files Modified:**

1. **[typescript.scm:391](../../../packages/core/src/index_single_file/query_code_tree/queries/typescript.scm#L391)**

   ```scheme
   (method_definition
     (accessibility_modifier)? @modifier.access_modifier
     "static"? @modifier.visibility
     name: (property_identifier) @definition.method
     (#not-eq? @definition.method "constructor")  ; Exclude constructors
   ) @scope.method
   ```

   The `(#not-eq? @definition.method "constructor")` predicate prevents constructors from being captured by `@definition.method`, so they're only captured by the dedicated `@definition.constructor` pattern.

2. **[javascript.scm:134](../../../packages/core/src/index_single_file/query_code_tree/queries/javascript.scm#L134)**

   ```scheme
   (method_definition
     "static"? @modifier.visibility
     name: (property_identifier) @definition.method
     (#not-eq? @definition.method "constructor")  ; Exclude constructors
   ) @scope.method
   ```

**Removed unnecessary code-level filters from:**

- [typescript_builder_config.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts)
- [javascript_builder_config.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts)

### Verification Completed

Fixtures were regenerated and verified:

- [x] `methods` array only contains `greet` method (no constructor) ✓
- [x] `constructor` array contains constructor definition ✓
- [x] All TypeScript class fixtures verified (19 fixtures pass)
- [x] All JavaScript class fixtures verified (2 fixtures pass)

**Results:**

- TypeScript `basic_class.json`: methods array = `["greet"]`, constructor field populated ✓
- JavaScript `basic_class.json`: methods array = `["greet", "getInfo", "activate", "deactivate"]`, constructor field populated ✓
- All 27 fixtures pass verification

### Commands to Complete Task

```bash
# Build the packages
npm run build

# Regenerate TypeScript fixtures
cd packages/core
npm run generate-fixtures:ts

# Regenerate JavaScript fixtures
npm run generate-fixtures:js

# Verify all fixtures
npm run verify-fixtures
```
