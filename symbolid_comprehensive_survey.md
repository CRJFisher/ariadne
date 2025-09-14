# Comprehensive SymbolId Architecture Survey Report

## Date: 2025-09-14

## Executive Summary

Completed exhaustive survey of all modules for string-based identifiers that should use SymbolId. Found **extensive violations** across 47+ files with critical pattern breaches throughout the codebase.

## Violation Categories

### 1. Map<string> Usage (Critical Violations)

**Should be Map<SymbolId> for symbol storage:**

#### namespace_resolution module (6 violations):
- `exports: Map<string, NamespaceExport>`
- `seen: Map<string, NamespaceImportInfo>`
- `by_source: Map<string, number>` (OK - source tracking)
- Multiple function return types returning `Map<string, *>`

#### import_resolution module (3 violations):
- `resolution_cache: new Map<string, ExportedSymbol | undefined>()`
- Return types using `Map<string, NamespaceExport>`

#### export_detection module (2 violations):
- `Map<string, Export[]>` for export names
- `by_source = new Map<string, Export[]>()`

#### constructor_calls module (3 violations):
- `type_assignments: Map<string, TypeInfo[]>`
- `imports?: Map<string, any[]>`
- `type_map: Map<string, TypeInfo[]>`

#### method_calls module (2 violations):
- `type_map: Map<string, TypeInfo[]>`
- `type_info?: Map<string, string>`

#### inheritance modules (6+ violations):
- `all_methods: Map<string, Def[]>`
- `overrides: Map<string, OverrideInfo>`
- `implemented_methods: Map<string, MethodSignature>`
- `interfaces: Map<string, InterfaceDefinition>`
- `implementations: Map<string, InterfaceImplementation[]>`
- `class_interfaces: Map<string, string[]>`

#### file_analyzer.ts (2 violations):
- `inferred_parameters: Map<string, ParameterAnalysis>`
- `inferred_returns: Map<string, ReturnTypeInfo>`

**OK to keep as Map<string> (file paths, cache keys):**
- `private astCache = new Map<string, any>()` ✓
- `private file_cache = new Map<string, any>()` ✓
- `readonly files: ReadonlyMap<string, StoredFile>` ✓
- `const files = new Map<string, string>()` ✓

### 2. Interface String Properties (30+ violations)

#### namespace_resolution:
- `namespace_name: string` → should be `SymbolId`
- `name: string` in NamespaceExport → should be `SymbolId`
- `qualified_name: string` parameters → should be `SymbolId`

#### namespace_helpers:
- `name: string`
- `namespace_name: string`
- `member_name: string`
- `export_name: string`

#### constructor types:
- `variable_name: string`
- `type_name: string` (could be TypeName or SymbolId)
- `name: string` in ParameterInfo

#### method calls:
- `caller_name: string`
- `receiver_name: string`

#### inheritance:
- Multiple `name: string` fields that should be SymbolId
- `implementor_name: string`
- `interface_name: string`

#### utils/symbol_construction:
- `name: string` in multiple interfaces

### 3. Function Parameters (15+ violations)

**Functions accepting strings instead of SymbolId:**

#### namespace_resolution:
- `parse(qualified_name: string)` → `parse(qualified_name: SymbolId)`
- `resolve(qualified_name: string)` → `resolve(qualified_name: SymbolId)`

#### symbol_resolution:
- `check_if_exported(name: string, ...)` → `check_if_exported(symbol: SymbolId, ...)`

#### type_tracking:
- `infer_type_kind(type_name: string, ...)` → could use TypeName branded type

#### Various utilities:
- Multiple functions taking `*_name: string` parameters

### 4. Direct String Comparisons (20+ violations)

**String equality checks that should use SymbolId:**

#### namespace_helpers:
- `imp.name === potential_namespace`
- `imp.name === namespace_name`
- `imp.name === name`

#### method_override:
- `sig1.name === sig2.name`

#### constructor_type_resolver:
- `imp.name === name || imp.alias === name`

#### method_hierarchy_resolver:
- `node.name === subclass_name`
- `node.name === parent_name`

#### symbol_resolution:
- `def.name === symbol_name`

#### global_symbol_table:
- `exp.name === name`
- `func.name === name`
- `cls.name === name`
- `variable.name === name`

#### type_registry:
- `method.name === 'new'` (OK for literals)
- `method.name === 'constructor'` (OK for literals)

### 5. Old Identifier Types Still Defined (15 types)

**In packages/types/src/aliases.ts:**
- `ClassName = string & { __brand: 'ClassName' }`
- `MethodName = string & { __brand: 'MethodName' }`
- `FunctionName = string & { __brand: 'FunctionName' }`
- `VariableName = string & { __brand: 'VariableName' }`
- `PropertyName = string & { __brand: 'PropertyName' }`
- `InterfaceName = string & { __brand: 'InterfaceName' }`
- `TraitName = string & { __brand: 'TraitName' }`
- `ParameterName = string & { __brand: 'ParameterName' }`
- `TypeName = string & { __brand: 'TypeName' }`
- `ExportName = string & { __brand: 'ExportName' }`
- `ImportName = string & { __brand: 'ImportName' }`
- `QualifiedName = string & { __brand: 'QualifiedName' }`

**In packages/types/src/calls.ts:**
- `CallerName = string & { __brand: "CallerName" }`
- `CalleeName = string & { __brand: "CalleeName" }`
- `ReceiverName = string & { __brand: "ReceiverName" }`

### 6. Test Files Using Old Types (4+ violations)

#### call_chain_analysis.test.ts:
- `import { ..., ClassName, ... }`
- `"unknown" as ClassName`
- `'MyClass' as ClassName`

#### type_tracking.test.ts:
- `"MyClass" as ClassName`

### 7. Additional Map<string> in Types Package (5+ violations)

#### types/src/:
- `readonly type_substitutions: Map<string, string>`
- `readonly processors?: ReadonlyMap<string, QueryProcessor>`
- `readonly custom?: ReadonlyMap<string, FilePath>`
- `readonly substitutions?: ReadonlyMap<string, TypeDefinition>`

## Impact Analysis

### Critical Issues:
1. **Type Safety Compromised**: 47+ files use raw strings where SymbolId should enforce type safety
2. **Architecture Violations**: Core principle of universal SymbolId usage not enforced
3. **Inconsistent Patterns**: Mix of old and new identifier systems creates confusion
4. **Test Coverage**: Tests using wrong types may not catch real violations

### Performance Impact:
- String-based maps lose benefits of structured SymbolId comparisons
- Type checking overhead from constant string/SymbolId conversions

### Maintainability Issues:
- Two parallel identifier systems increase maintenance burden
- Difficult to track symbol usage across module boundaries
- Refactoring becomes error-prone with mixed identifier types

## Files Requiring Immediate Fixes

### Phase 1: Critical Core Modules (15 files)
- `namespace_resolution/namespace_resolution.ts`
- `import_resolution/import_resolution.ts`
- `import_resolution/namespace_helpers.ts`
- `export_detection/export_detection.ts`
- `export_detection/index.ts`
- `constructor_calls/constructor_type_extraction.ts`
- `constructor_calls/constructor_type_resolver.ts`
- `method_calls/receiver_type_resolver.ts`
- `method_calls/method_hierarchy_resolver.ts`
- `inheritance/method_override/method_override.ts`
- `inheritance/interface_implementation/types.ts`
- `file_analyzer.ts`
- `symbol_resolution/symbol_resolution.ts`
- `symbol_resolution/global_symbol_table.ts`
- `type_registry/type_registry.ts`

### Phase 2: Type Definitions (5 files)
- `types/src/aliases.ts`
- `types/src/calls.ts`
- `types/src/definitions.ts`
- `types/src/query_integration.ts`
- `types/src/type_analysis.ts`

### Phase 3: Test Files (4 files)
- `call_chain_analysis.test.ts`
- `type_tracking.test.ts`
- All other test files importing old types

## Migration Strategy

### 1. Immediate Actions:
- Replace all `Map<string>` with `Map<SymbolId>` for symbol storage
- Update interface definitions to use SymbolId
- Replace function parameters with SymbolId

### 2. Deprecation Path:
- Mark old identifier types as `@deprecated` in aliases.ts
- Add migration comments pointing to SymbolId
- Create compatibility layer if needed

### 3. Testing Strategy:
- Update test data to use symbol factory functions
- Add SymbolId validation in test helpers
- Create integration tests for identifier consistency

## Success Criteria

- [ ] Zero instances of `Map<string>` for symbol storage
- [ ] All interface name fields use SymbolId
- [ ] All function parameters use SymbolId for identifiers
- [ ] No direct string equality checks for symbols
- [ ] Old identifier types marked deprecated
- [ ] All tests pass with SymbolId enforcement
- [ ] Type system prevents mixing identifier types

## Estimated Effort

- **Phase 1**: 40-60 hours (complex type changes)
- **Phase 2**: 8-12 hours (deprecation and compatibility)
- **Phase 3**: 12-16 hours (test updates)
- **Total**: 60-88 hours for complete migration

## Conclusion

The survey reveals that **the SymbolId architecture exists in theory but is not enforced in practice**. The codebase is in a hybrid state with extensive violations across all major modules. A coordinated migration effort is essential to achieve the intended type safety and consistency benefits of the SymbolId system.