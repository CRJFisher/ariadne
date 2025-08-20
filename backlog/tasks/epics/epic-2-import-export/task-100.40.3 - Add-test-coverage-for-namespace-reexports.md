---
id: task-100.40.3
title: Add test coverage for namespace re-exports
status: To Do
assignee: []
created_date: '2025-08-20 14:49'
labels: [testing, import-resolution, technical-debt]
dependencies: []
parent_task_id: task-100.40
---

## Description

Add test coverage for the namespace re-export functionality in the import_resolution module. This code currently has no test coverage, which allowed type errors to go undetected.

## Problem Statement

The following functions in `/packages/core/src/import_resolution/namespace_imports.ts` have no test coverage:
- `find_reexported_namespaces()` - Finds re-exported namespaces in target files
- `is_in_export_context()` - Checks if a reference is in an export context (currently always returns false)

This lack of coverage allowed type errors to exist in the code:
- Using non-existent `imported_from` property on Import type
- Accessing non-existent `scope_id` property on Ref type

## Current Behavior

The `is_in_export_context` function always returns `false` with a TODO comment indicating proper implementation is needed. This means the re-export detection never actually works.

## Desired Behavior

1. Implement proper `is_in_export_context` detection
2. Add comprehensive tests for re-export scenarios
3. Ensure all code paths are exercised

## Acceptance Criteria

- [ ] Implement proper export context detection in `is_in_export_context`
- [ ] Add tests for basic namespace re-exports
- [ ] Add tests for nested namespace re-exports
- [ ] Add tests for all supported languages (JavaScript, TypeScript, Python, Rust)
- [ ] Ensure 100% code coverage for the re-export code paths

## Test Cases to Create

```javascript
// Test 1: Basic namespace re-export
// file1.js
export * as utils from './utils';

// file2.js
import * as lib from './file1';
lib.utils.someFunction(); // Should resolve to utils module

// Test 2: Direct namespace re-export
// file1.js
import * as helpers from './helpers';
export { helpers };

// Test 3: Re-export with renaming
// file1.js
import * as original from './original';
export { original as renamed };
```

## Implementation Notes

The type errors were fixed in commit eb66c28, but the functionality still needs to be properly implemented and tested.

### Code Locations
- `/packages/core/src/import_resolution/namespace_imports.ts` - Lines 79-113
- Tests should go in `/packages/core/src/import_resolution/namespace_imports.test.ts` or language-specific test files

## Related Issues

- Type errors were discovered during epic-11 refactoring
- The `is_in_export_context` function needs AST analysis to determine if a reference is in an export statement