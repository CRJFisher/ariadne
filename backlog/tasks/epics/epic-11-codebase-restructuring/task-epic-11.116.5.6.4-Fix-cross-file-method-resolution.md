# Task: Fix cross-file method resolution in JavaScript

**ID**: epic-11.116.5.6.4
**Status**: To Do
**Priority**: HIGH
**Parent**: epic-11.116.5.6

## Description

Method calls on imported class instances don't resolve via `project.resolutions.resolve()` across file boundaries. While method calls are captured and method definitions exist, the resolution chain from call site to method definition is broken.

## Current Behavior

- Method calls on imported class instances are captured as references
- Method definitions exist in class definitions
- `project.resolutions.resolve(method_call.scope_id, method_call.name)` returns null or wrong definition
- Tests work around this by verifying method existence in class definition rather than resolution

## Required Behavior

- Method calls should resolve through the full chain:
  1. Call site → variable with type binding
  2. Type binding → imported class
  3. Imported class → method definition
- `project.resolutions.resolve()` should return the correct method SymbolId
- Should work for both direct imports and aliased imports

## Root Cause Analysis Needed

The issue likely involves one or more of:
1. Type bindings not properly linking method call receivers to their types
2. Method resolution not following import chains
3. Type registry not properly populated for imported classes
4. Scope chain not correct for method lookups

## Implementation Plan

1. **Investigate Resolution Chain**
   - Debug `project.resolutions.resolve()` for method calls
   - Check type_bindings for receiver variables
   - Verify type registry has method information for imported classes
   - Trace through symbol_resolver.ts resolution logic

2. **Fix Type Binding Creation**
   - Ensure variables assigned from constructors have type bindings
   - Type bindings should work across import boundaries

3. **Fix Method Resolution**
   - Ensure method resolver checks type bindings for receiver
   - Method resolver should follow import chains to find class definition
   - Method resolver should look up method in class type information

4. **Update Tests**
   - Restore full resolution verification in tests
   - Tests should call `project.resolutions.resolve()` and verify method SymbolId

## Test Coverage

- Method call on imported class instance: `user.getName()` → resolves to getName method in User class
- Method call on aliased imported class: `manager.process()` → resolves to process method in DataManager class
- Method chaining on imported classes

## Acceptance Criteria

- [ ] Method calls on imported class instances resolve via `project.resolutions.resolve()`
- [ ] Resolution returns correct method SymbolId from defining file
- [ ] Works for simple imports: `import { User } from './user'`
- [ ] Works for aliased imports: `import { DataManager as Manager }`
- [ ] Integration tests pass with full resolution verification
- [ ] Existing tests remain passing

## Related Files

- `packages/core/src/resolve_references/symbol_resolver.ts`
- `packages/core/src/registries/type_registry.ts`
- `packages/core/src/project/project.javascript.integration.test.ts`
- `packages/core/src/index_single_file/semantic_index.ts` (type bindings)

## Notes

This is a more complex issue than constructor calls, as it involves the interaction between:
- Type bindings (linking variables to their types)
- Import resolution (following import chains)
- Method lookup (finding methods in classes)
- Type registry (storing class member information)

Consider adding debug logging to trace the resolution chain and identify where it breaks.
