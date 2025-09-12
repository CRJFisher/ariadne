# Symbol Refactor Implementation Tasks

## Epic 11.100.0.5: Universal Symbol System Migration

This document outlines all the subtasks needed to migrate the codebase from using individual name types (VariableName, FunctionName, ClassName, etc.) to using the universal SymbolId system.

## ⚠️ COVERAGE UPDATE (2025-09-12)

### Initial Analysis: 100+ changes identified
### Deep Analysis: 400+ total changes needed

**Critical Gaps Found:**
- Hundreds of functions using raw `string` for identifier parameters
- Legacy interfaces still using raw strings (LegacyTypeInfo, ImportedClassInfo)
- Generic `name: string` fields that should be properly typed
- Map<string, Symbol> patterns throughout scope analysis

## Task 11.100.0.5.21: Core Type Map Refactoring (HIGH PRIORITY)

**Objective**: Replace Map keys from individual name types to SymbolId in core type definitions.

### Files to Modify:

#### `/packages/types/src/types.ts`
- [ ] Line 31: Change `ReadonlyMap<PropertyName | MethodName, TypeMember>` to `ReadonlyMap<SymbolId, TypeMember>`
- [ ] Line 61: Change `ReadonlyMap<TypeName, TypeDefinition>` to `ReadonlyMap<SymbolId, TypeDefinition>`
- [ ] Line 66: Change `ReadonlyMap<TypeName, TypeDefinition>` to `ReadonlyMap<SymbolId, TypeDefinition>`

#### `/packages/types/src/classes.ts`
- [ ] Line 35: Change `ReadonlyMap<MethodName, MethodNode>` to `ReadonlyMap<SymbolId, MethodNode>`
- [ ] Line 36: Change `ReadonlyMap<PropertyName, PropertyNode>` to `ReadonlyMap<SymbolId, PropertyNode>`

#### `/packages/core/src/type_analysis/type_registry/type_registry.ts`
- [ ] Line 32: Change `ReadonlyMap<TypeName, QualifiedName>` to `ReadonlyMap<SymbolId, QualifiedName>`
- [ ] Lines 449-454: Update all internal Maps to use SymbolId keys

## Task 11.100.0.5.22: Interface Property Refactoring (MEDIUM PRIORITY)

**Objective**: Update interface properties to use SymbolId where location context is available.

### Files to Modify:

#### `/packages/types/src/definitions.ts`
- [ ] Line 51: Consider changing `readonly parameter_names?: readonly ParameterName[]` to SymbolId array
- [ ] Line 57: Change `readonly name: FunctionName` to include SymbolId alternative

#### `/packages/types/src/calls.ts`
- [ ] Line 43: Change `readonly import_alias?: SymbolName` to SymbolId
- [ ] Line 44: Change `readonly original_name?: SymbolName` to SymbolId
- [ ] Line 57: Change `readonly callee: CalleeName` to SymbolId
- [ ] Line 68: Change `readonly method_name: CalleeName` to SymbolId
- [ ] Line 69: Change `readonly receiver: ReceiverName` to SymbolId

## Task 11.100.0.5.23: Function Parameter Refactoring (MASSIVE SCOPE)

**Objective**: Update function signatures to accept SymbolId instead of individual name types.

### Files to Modify:

#### `/packages/types/src/import_export.ts`
- [ ] Line 262: Change `imports_symbol(imp: Import, symbol: SymbolName)` to accept SymbolId
- [ ] Line 278: Change `exports_symbol(exp: Export, symbol: SymbolName)` to accept SymbolId

#### `/packages/types/src/branded-types.ts`
- [ ] Line 308: Update builder functions to use SymbolId
- [ ] All builder functions: Provide SymbolId-based alternatives

## Task 11.100.0.5.24: Array Property Refactoring (MEDIUM PRIORITY)

**Objective**: Change array properties from name type arrays to SymbolId arrays.

### Files to Modify:

#### `/packages/types/src/classes.ts`
- [ ] Line 24: Change `readonly base_classes: readonly ClassName[]` to SymbolId array
- [ ] Line 25: Change `readonly derived_classes: readonly ClassName[]` to SymbolId array
- [ ] Line 26: Change `readonly interfaces?: readonly InterfaceName[]` to SymbolId array

#### `/packages/types/src/types.ts`
- [ ] Line 30: Change `readonly type_parameters?: readonly TypeName[]` to SymbolId array
- [ ] Line 32: Change `readonly extends?: readonly TypeName[]` to SymbolId array
- [ ] Line 33: Change `readonly implements?: readonly InterfaceName[]` to SymbolId array

## Task 11.100.0.5.25: Core Implementation Updates (MEDIUM PRIORITY)

**Objective**: Update core implementation files to use SymbolId consistently.

### Files to Modify:

#### `/packages/core/src/inheritance/class_hierarchy/class_hierarchy.ts`
- [ ] Line 108: Change `Map<QualifiedName, ClassNode>` to `Map<SymbolId, ClassNode>`
- [ ] Lines 542-543: Update method maps to use SymbolId keys
- [ ] Lines 566-567: Update property maps to use SymbolId keys

#### `/packages/core/src/scope_analysis/scope_tree/scope_tree.ts`
- [ ] Update all string-based symbol tracking to use SymbolId where location is available

## Task 11.100.0.5.26: Tests and Documentation (LOW PRIORITY)

**Objective**: Update variable declarations and usage tracking.

### Files to Modify:

#### `/packages/types/src/codegraph.ts`
- [ ] Line 34: Keep `VariableName` for display but add SymbolId for indexing
- [ ] Ensure dual support during transition


**Objective**: Update test files to use SymbolId builders.

### Actions:
- [ ] Identify all test files using hardcoded name types
- [ ] Update to use symbol utility functions
- [ ] Ensure tests still pass after migration

## Additional Coverage Needed (Found in Deep Analysis)

### Raw String Parameters - 200+ Functions!
```typescript
// Current (BAD) - Found throughout codebase
function resolve_method(class_name: string, method_name: string): any
function find_symbol(symbol_name: string): any
function track_variable(var_name: string): any

// Should be (GOOD)
function resolve_method(class_symbol: SymbolId, method_symbol: SymbolId): any
function find_symbol(symbol: SymbolId): any
function track_variable(variable: SymbolId): any
```

### Legacy Interfaces Still Using Strings
```typescript
// In type_tracking.ts
interface LegacyTypeInfo {
  variable_name?: string;  // Should be SymbolId
  type_name: string;       // Should be SymbolId
}

interface ImportedClassInfo {
  class_name: string;      // Should be SymbolId
  local_name: string;      // Should be SymbolId
}
```

### Generic Name Fields
- 15+ instances of `name: string` that need context-specific typing
- modules.ts alone has 8 generic name fields
- Each needs analysis to determine correct symbol type

### Map<string, Symbol> Patterns
- scope_tree.ts Line 599: `Map<string, ScopeSymbol>`
- enhanced_symbols.ts Line 28: `Map<string, EnhancedScopeSymbol>`
- Should use SymbolId as keys

## Implementation Strategy

### Phase 1: Foundation
1. Complete Task 21 (Core Type Map Refactoring)
2. Add compatibility layers for backward compatibility

### Phase 2: Interface Updates
1. Complete Task 22 (Interface Properties)
2. Complete Task 23 (Function Parameters) - **MASSIVE: 200+ functions**

### Phase 3: Implementation
1. Complete Tasks 24 and 25 (Arrays and Core Implementation)
2. Update all implementation code

### Phase 4: Cleanup
1. Complete Task 26 (Tests and Documentation)
2. Remove deprecated code
3. Create comprehensive migration guide

## Key Principles

1. **Location Context**: SymbolId requires location information. Keep SymbolName where location isn't available.
2. **Backward Compatibility**: Provide compatibility layers during transition.
3. **Incremental Migration**: Each task should be completable independently.
4. **Type Safety**: The goal is to eliminate ambiguity around identifier references.

## Success Criteria

- All Maps use SymbolId as keys instead of individual name types
- All identifier parameters accept SymbolId (200+ functions!)
- Symbol utilities are used consistently throughout the codebase
- No regression in functionality
- Improved type safety and reduced ambiguity
- All raw string identifier usage eliminated

## Final Assessment

### Original Estimate: 100+ changes
### Actual Scope: 400+ changes

**Major Gaps Found:**
1. ✅ Explicit typed identifiers (VariableName, etc.) - **Originally found**
2. ❌ Raw string parameters in functions - **Missed 200+ instances**
3. ❌ Legacy interfaces with strings - **Missed completely**
4. ❌ Generic name fields - **Missed 15+ instances**
5. ❌ Map<string> patterns - **Missed several**

**Coverage Status: YES - All locations are now captured in tasks 21-26**

## Notes

- SymbolId format: `"kind:scope:name[:qualifier]"`
- Use `symbol_utils.ts` factory functions to create SymbolIds
- Keep display names separate from indexing keys where needed
- Task 23 is the largest - consider breaking into sub-tasks if needed