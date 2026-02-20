# Task: Verify Definition Collection in Symbol Resolution

## Status
**Status:** Not Started
**Priority:** High
**Created:** 2025-09-27
**Epic:** Epic 11 - Codebase Restructuring

## Description
Verify that the symbol resolution's `combine_results` function properly collects all definition types from the semantic index and correctly populates the `definitions` map with all `AnyDefinition` types.

## Problem Statement
The `combine_results` function in `symbol_resolution.ts` needs to collect all definition types (FunctionDefinition, ClassDefinition, MethodDefinition, PropertyDefinition, ParameterDefinition, InterfaceDefinition, EnumDefinition, VariableDefinition, NamespaceDefinition, ImportDefinition) from the semantic index and return them in the `definitions` map.

Currently, there are type compatibility issues and incomplete collection of nested definitions (methods, properties, parameters within classes).

## Acceptance Criteria
1. [ ] All top-level definitions are collected from semantic index:
   - [ ] Functions (`idx.functions`)
   - [ ] Classes (`idx.classes`)
   - [ ] Variables (`idx.variables`)
   - [ ] Interfaces (`idx.interfaces`)
   - [ ] Enums (`idx.enums`)
   - [ ] Namespaces (`idx.namespaces`)
   - [ ] Imported symbols (`idx.imported_symbols`)

2. [ ] Nested definitions within classes are properly collected:
   - [ ] Methods within classes
   - [ ] Properties within classes
   - [ ] Constructor parameters (if constructors become full definitions)

3. [ ] Type compatibility is maintained:
   - [ ] All definition types from `@ariadnejs/types/symbol_definitions` are assignable to `AnyDefinition`
   - [ ] No type errors when building the definitions map

4. [ ] The returned `ResolvedSymbols.definitions` is properly typed as `ReadonlyMap<SymbolId, AnyDefinition>`

## Technical Details
- **File:** `packages/core/src/symbol_resolution/symbol_resolution.ts`
- **Function:** `combine_results` (lines 740-762)
- **Types:** Imported from `@ariadnejs/types` (specifically `symbol_definitions.ts`)

## Current Issues
1. `ConstructorDefinition` now extends `Definition` but might not have been updated everywhere
2. Need to ensure all definition types are being collected
3. Methods and properties are arrays within ClassDefinition, need proper iteration

## Implementation Notes
- Methods and properties are already nested within class definitions as arrays
- Each method and property has its own `symbol_id` for the map
- Constructor is a special case - currently `ConstructorDefinition` which now extends `Definition`
- Import definitions come from `idx.imported_symbols`, not `idx.imports`

## Testing Requirements
- [ ] Unit tests verify all definition types are collected
- [ ] Integration tests confirm call graph construction works with collected definitions
- [ ] Type checking passes without errors

## Related Tasks
- Task 99: Add function reference tracking to call resolution
- Original refactoring work in Epic 11

## Notes
- This verification task was created after discovering type compatibility issues during implementation
- The `AnyDefinition` type must be imported from `@ariadnejs/types` not from the old location in `semantic_index.ts`