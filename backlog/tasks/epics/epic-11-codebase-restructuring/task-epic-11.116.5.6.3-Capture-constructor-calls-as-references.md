# Task: Capture constructor calls as references in JavaScript

**ID**: epic-11.116.5.6.3
**Status**: To Do
**Priority**: HIGH
**Parent**: epic-11.116.5.6

## Description

Constructor calls (`new Foo()`) are not currently captured as SymbolReference objects in JavaScript semantic indexing. This prevents resolution of constructor calls to their class definitions.

## Current Behavior

- `new Foo()` calls are parsed but not captured as references
- Cannot resolve constructor call location to class definition
- Tests skip constructor call verification with "might not be captured" comment
- This is a critical gap in semantic understanding

## Required Behavior

- Capture `new_expression` nodes as constructor call references
- Add appropriate query patterns in `javascript.scm`
- Create reference handler in `javascript_builder_config.ts`
- Constructor calls should resolve to class definitions via `project.resolutions.resolve()`
- Handle both local and imported class constructors

## Implementation Plan

1. **Add Query Pattern** (`javascript.scm`)
   - Add pattern to capture `new_expression` constructor identifier
   - Pattern should capture both simple and member expression constructors

2. **Create Reference Handler** (`javascript_builder_config.ts`)
   - Add handler for constructor call references
   - Set `call_type: "constructor"`
   - Extract class name from new_expression

3. **Update Tests** (`project.javascript.integration.test.ts`)
   - Revert "should capture method calls on imported class instances" to test constructor resolution
   - Revert "should handle aliased class imports and method calls" to test aliased constructor resolution
   - Tests should verify `project.resolutions.resolve()` returns the class definition

## Test Coverage

- Constructor call on imported class: `new User()` → resolves to User class in user_class.js
- Constructor call on aliased class: `new Manager()` → resolves to DataManager class in utils_aliased.js
- Constructor call on local class: already tested in "should resolve ES6 class methods"

## Acceptance Criteria

- [ ] Constructor calls captured as SymbolReference with `call_type: "constructor"`
- [ ] `project.resolutions.resolve()` returns class SymbolId for constructor calls
- [ ] Integration tests pass for imported class constructors
- [ ] Integration tests pass for aliased class constructors
- [ ] Existing tests remain passing

## Related Files

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`
- `packages/core/src/project/project.javascript.integration.test.ts`

## Notes

TypeScript has the same limitation - consider applying the same fix to TypeScript after this is working for JavaScript.
