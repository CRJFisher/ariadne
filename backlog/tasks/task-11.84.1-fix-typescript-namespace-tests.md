# Task 11.84.1: Fix Failing TypeScript Namespace Export Tests

## Overview

Fix 6 failing tests in `export_detection.typescript.bespoke.test.ts` related to namespace and module declaration handling.

## Failing Tests

1. **should detect exported namespaces**
   - Error: `expected undefined to be defined`
   - Line: `src/import_export/export_detection/export_detection.typescript.bespoke.test.ts:92`

2. **should detect module declarations**
   - Error: `expected undefined to be defined`
   - Line: `src/import_export/export_detection/export_detection.typescript.bespoke.test.ts:111`

3. **should handle nested namespaces**
   - Error: `expected false to be true`
   - Not finding 'Outer' namespace

4. **should mark namespace members appropriately**
   - Error: `expected undefined to be true`
   - `namespace_export` flag not being set

5. **should detect namespace and function merging**
   - Error: `expected ['function', 'named'] to include 'namespace'`
   - Declaration merging not detecting namespace type

6. **should handle all TypeScript-specific patterns**
   - Error: `expected false to be true`
   - Not finding 'External' and 'NS' exports

## Root Cause Analysis

The current implementation in `handle_namespace_exports` has issues with:
1. AST traversal not correctly identifying namespace/module nodes
2. Export statement structure not being parsed correctly
3. Namespace body members not being visited properly
4. Declaration merging not recognizing namespace declarations

## Implementation Notes

### Current Code Issue
```typescript
// Current problematic pattern
if (node.type === 'export_statement') {
  for (const child of node.children) {
    if (child.type === 'module_declaration' || child.type === 'namespace_declaration') {
      // This is not finding the namespace nodes correctly
    }
  }
}
```

### Required Fix Areas

1. **AST Structure**: Need to verify actual TypeScript AST structure for:
   - `export namespace Name { }`
   - `export module Name { }`
   - Nested namespace declarations

2. **Traversal Logic**: Fix the visitor pattern to:
   - Correctly identify namespace nodes within export statements
   - Properly traverse namespace body for member exports
   - Handle nested namespace structures

3. **Declaration Merging**: Update `get_declaration_kind` to:
   - Return 'namespace' for namespace/module declarations
   - Properly track merged declaration types

## Test Cases to Verify

```typescript
// Basic namespace export
export namespace Utils {
  export function helper() {}
  export interface Config {}
}

// Module declaration
export module MyModule {
  export class MyClass {}
  export const constant = 42;
}

// Nested namespaces
export namespace Outer {
  export namespace Inner {
    export function deepFunction() {}
  }
}

// Declaration merging
export function MyFunction() {}
export namespace MyFunction {
  export const version = '1.0';
}
```

## Acceptance Criteria

- [ ] All 6 TypeScript namespace tests pass
- [ ] Namespace exports are correctly identified
- [ ] Namespace members are properly marked with `namespace_export: true`
- [ ] Declaration merging correctly identifies namespace types
- [ ] No regression in other TypeScript tests

## Technical Approach

1. Debug actual AST structure using tree-sitter CLI or test harness
2. Update visitor pattern in `handle_namespace_exports`
3. Fix namespace member detection logic
4. Update declaration merging to handle namespace types
5. Verify all test cases pass

## Priority

HIGH - These are core TypeScript features that must work correctly