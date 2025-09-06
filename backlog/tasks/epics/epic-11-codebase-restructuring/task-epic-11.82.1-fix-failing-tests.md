# Task 11.82.1: Fix Failing Tests in constructor_calls

## Parent Task
11.82 - Refactor constructor_calls to Configuration-Driven Pattern

## Overview
Fix 22 failing tests in the constructor_calls module. Most failures are pre-existing issues from incomplete implementations.

## Current State
- 17 tests failing in `constructor_type_resolver.test.ts` 
- 4 tests failing in `constructor_type_extraction.test.ts`
- 1 test was failing in `constructor_calls.javascript.bespoke.test.ts` (now fixed)

## Root Causes

### constructor_type_resolver.test.ts
- Imports non-existent `create_type_registry` function
- Should use `build_type_registry` from `../../type_analysis/type_registry`
- Missing TypeRegistry implementation

### constructor_type_extraction.test.ts
- Property assignments test fails - not detecting `this.myProp` assignments
- Return value test fails - missing `is_return_value` field in TypeInfo
- Python self property test fails - not detecting `self.prop` assignments  
- Python module.Class pattern test fails - not finding calls

## Acceptance Criteria
- [x] Fix import for type_registry functions
- [ ] Implement missing helper functions:
  - [ ] `is_property_assignment()`
  - [ ] `is_return_value()` 
  - [ ] `walk_tree()` export
- [ ] Fix property assignment detection for JS/TS
- [ ] Fix self property detection for Python
- [ ] Fix module.Class pattern for Python
- [ ] All 86 tests passing (82/86 passing - 4 need helper functions from task 11.82.4)

## Technical Notes
- These tests were already broken before refactoring
- Need to coordinate with type_registry module
- Some functionality may need to be implemented in bespoke handlers

## Priority
CRITICAL - Tests must pass for refactoring to be complete

## Implementation Notes
PARTIALLY COMPLETE (82/86 tests passing):
- Fixed import issue: Changed `create_type_registry` to `build_type_registry`
- Fixed type registry to properly pass file_path parameter to register functions
- Added support for structs in type registry (treated as classes)
- Fixed members Map population in register_class to include constructor parameters
- Fixed qualified name handling in find_local_type (added support for '#' separator)
- Fixed type alias registration to properly map to aliased type
- Fixed export statement format in tests to match interface
- Fixed get_constructable_types to extract file_path from qualified name

Remaining 4 tests require helper functions from task 11.82.4:
- Property assignment detection (this.myProp)
- Return value detection
- Python self property detection
- Python module.Class pattern detection