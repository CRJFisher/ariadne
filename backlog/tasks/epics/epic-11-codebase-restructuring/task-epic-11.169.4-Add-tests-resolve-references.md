# Task 11.169.4: Add Tests for resolve_references Submodules

## Status: To Do

## Parent: task-epic-11.169-Add-missing-test-files

## Overview

Add test files for call resolution, import resolution, and registry modules.

## Files to Create

1. `packages/core/src/resolve_references/call_resolution/call_resolution.collection_dispatch.test.ts`
2. `packages/core/src/resolve_references/call_resolution/call_resolution.constructor.test.ts`
3. `packages/core/src/resolve_references/import_resolution/import_resolution.test.ts`
4. `packages/core/src/resolve_references/registries/registries.export.test.ts`

## Implementation Files

- `call_resolution.collection_dispatch.ts` - Dispatch logic for collection method calls
- `call_resolution.constructor.ts` - Constructor call resolution
- `import_resolution.ts` - Import statement resolution
- `registries.export.ts` - Export registry management

## Test Approach

1. Test collection dispatch for array/map/set methods
2. Test constructor resolution for class instantiation
3. Test import resolution for various import styles
4. Test export registry operations

## Success Criteria

- All exported functions have test coverage
- Tests cover edge cases in resolution logic
