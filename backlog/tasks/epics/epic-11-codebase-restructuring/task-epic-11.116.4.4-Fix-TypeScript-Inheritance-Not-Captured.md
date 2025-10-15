# Task epic-11.116.4.4: Fix TypeScript Inheritance Not Being Captured

**Status:** Not Started
**Parent:** task-epic-11.116.4  
**Priority:** High (Critical feature missing - breaks call graph analysis)
**Created:** 2025-10-15

## Overview

TypeScript class inheritance relationships are not being captured. The `extends` field for all classes shows empty arrays `[]` instead of the parent class names, making it impossible to trace inheritance hierarchies.

## Problem Description

**Observed in:** `typescript/semantic_index/classes/inheritance.json`

**Source code:**
```typescript
abstract class Animal {
  constructor(public name: string) {}
  abstract makeSound(): string;
  move(distance: number = 0): void { }
}

class Dog extends Animal {
  constructor(name: string) {
    super(name);
  }
  makeSound(): string {
    return "Woof!";
  }
}

class Cat extends Animal {
  makeSound(): string {
    return "Meow!";
  }
}
```

**Current fixture output:**
```json
{
  "classes": {
    "Animal": {"extends": []},
    "Dog": {"extends": []},
    "Cat": {"extends": []}
  }
}
```

**Expected fixture output:**
```json
{
  "classes": {
    "Animal": {"extends": []},
    "Dog": {"extends": ["Animal"]},
    "Cat": {"extends": ["Animal"]}
  }
}
```

**Note:** Python inheritance IS working correctly:
```json
{
  "Dog": {"extends": ["Animal"]},
  "Cat": {"extends": ["Animal"]}
}
```

So this is TypeScript-specific.

## Impact

- **High severity**: Inheritance relationships are critical for:
  - Method resolution order (MRO)
  - Call graph analysis
  - Type hierarchy navigation
  - Understanding class structures

- **Affects fixtures:**
  - `typescript/semantic_index/classes/inheritance.json`
  - Potentially `typescript/semantic_index/generics/generic_classes.json`
  - Any other TypeScript fixtures with class inheritance

## Root Cause

Likely in `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`:
- The tree-sitter query may not be capturing the `extends` clause
- OR the captured extends clause is not being processed correctly
- OR the extends value is being set but then overwritten with empty array

Compare with Python implementation which works correctly.

## Proposed Fix

1. Check tree-sitter query for TypeScript classes - ensure it captures heritage clauses
2. Check `definition.class` handler in typescript_builder_config.ts
3. Look for where `extends` field is set on ClassDefinition
4. Compare with Python's working implementation
5. Fix the extraction/processing of extends clause

## Testing

1. Regenerate `typescript/semantic_index/classes/inheritance.json`
2. Verify Dog has `"extends": ["Animal"]`
3. Verify Cat has `"extends": ["Animal"]`
4. Test with multiple inheritance levels (if supported)
5. Test with interface extends as well

## Success Criteria

- ✅ TypeScript classes correctly show parent class in `extends` field
- ✅ Abstract base class shows `extends: []` (no parent)
- ✅ Derived classes show correct parent in `extends: ["ParentClassName"]`
- ✅ Behavior matches Python's working implementation

## Estimated Effort

**2-3 hours**

- 1 hour: Investigate why extends is not being captured
- 1-1.5 hours: Implement fix
- 0.5 hours: Test and regenerate fixtures

## Priority Justification

**High** because:
- Inheritance is a fundamental OOP feature
- Blocks accurate call graph analysis
- Python implementation already works, so we know it's possible
- Relatively isolated fix (TypeScript-specific)
