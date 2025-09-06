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
- [x] Implement missing helper functions:
  - [x] `is_property_assignment()`
  - [x] `is_return_value()` 
  - [x] `walk_tree()` export
- [x] Fix property assignment detection for JS/TS
- [x] Fix self property detection for Python
- [x] Fix module.Class pattern for Python
- [x] All 86 tests passing (86/86 passing - 100% complete)

## Technical Notes
- These tests were already broken before refactoring
- Need to coordinate with type_registry module
- Some functionality may need to be implemented in bespoke handlers

## Priority
CRITICAL - Tests must pass for refactoring to be complete

## Implementation Notes
COMPLETE (86/86 tests passing - 100%):

**Phase 1 - Type Registry Integration (Tasks 11.82.1 & 11.82.2):**
- Fixed import issue: Changed `create_type_registry` to `build_type_registry`
- Fixed type registry to properly pass file_path parameter to register functions
- Added support for structs in type registry (treated as classes)
- Fixed members Map population in register_class to include constructor parameters
- Fixed qualified name handling in find_local_type (added support for '#' separator)
- Fixed type alias registration to properly map to aliased type
- Fixed export statement format in tests to match interface
- Fixed get_constructable_types to extract file_path from qualified name

**Phase 2 - Helper Functions (Task 11.82.4):**
- Extended TypeInfo interface with `is_return_value` and `is_property_assignment` fields
- Enhanced `find_assignment_target` to handle member expressions (this.prop, self.prop)
- Fixed Python module.Class pattern recognition by adding special handling for attribute nodes
- Updated both `extract_name_from_node` and `extract_constructor_name` functions
- Imported `walk_tree` from constructor_calls.ts (already exported)

**Result:**
- All 86 tests now passing (100% success rate)
- All helper functions properly implemented
- Full support for property assignments and return values
- Python module.Class pattern now working correctly