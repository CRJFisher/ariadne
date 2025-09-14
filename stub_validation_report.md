# Stubbed Module SymbolId Validation Report

## Executive Summary

After thorough analysis of stubbed modules, I found **critical violations** of the SymbolId architecture that would prevent proper type checking and cause runtime errors when stubs are implemented.

## Key Findings

### 1. Interface Inconsistency Crisis

**Problem**: Multiple competing interface definitions across the codebase:

**✅ CORRECT (packages/types/src):**
```typescript
// Proper SymbolId-based interfaces
export interface ImportedSymbol {
  readonly name: ImportName;
  readonly local_name?: SymbolId;  // ✅ Uses SymbolId
  readonly is_namespace: boolean;
}

export interface NamespaceInfo {
  readonly name: SymbolId;  // ✅ Uses SymbolId
  readonly exports: ReadonlyMap<SymbolId, NamespaceExportInfo>;  // ✅ Uses SymbolId keys
}
```

**❌ WRONG (Multiple core modules):**
```typescript
// Competing interface using raw strings
interface ImportInfo {
  name: string;  // ❌ Should be SymbolId
  namespace_name?: string;  // ❌ Should be SymbolId
}
```

### 2. Critical Stubbed Module Violations

#### constructor_type_extraction.ts
```typescript
// ❌ VIOLATIONS
export interface ConstructorCallResult {
  type_assignments: Map<string, TypeInfo[]>;  // Should be Map<SymbolId, TypeInfo[]>
}

export interface ConstructorTypeAssignment {
  variable_name: string;  // Should be SymbolId
  type_name: string;     // Should be SymbolId or TypeName
}
```

#### constructor_type_resolver.ts
```typescript
// ❌ VIOLATIONS
export interface ParameterInfo {
  name: string;  // Should be SymbolId
}

// Function parameters using strings
validate_constructor(class_name: string, ...)  // Should be SymbolId
imports?: Map<string, any[]>  // Should be Map<SymbolId, any[]>
```

#### namespace_resolution.ts
```typescript
// ❌ VIOLATIONS
export interface NamespaceImportInfo {
  namespace_name: string;  // Should be SymbolId
  members?: string[];      // Should be SymbolId[]
}

export interface NamespaceExport {
  name: string;  // Should be SymbolId
}
```

### 3. Return Type Analysis

**Stub modules with CORRECT return types:**
- ✅ `import_extraction.ts` - Returns `Import[]` (correct type)
- ✅ `export_extraction.ts` - Returns `Export[]` (correct type)

**Stub modules with INCORRECT return types:**
- ❌ `constructor_type_extraction.ts` - Returns interfaces with string maps
- ❌ `namespace_resolution.ts` - Returns interfaces with string fields
- ❌ `import_resolution.ts` - Uses `Map<string, ExportedSymbol>`

### 4. Cascading Type Errors

Running `npm run typecheck` reveals **80+ type errors** caused by:

1. **String vs SymbolId mismatches**
2. **Missing SymbolId conversions**
3. **Inconsistent interface usage**
4. **Test files using deprecated types**

## Critical Issues Requiring Immediate Fix

### Issue 1: Constructor Type Maps
**Location**: `constructor_type_extraction.ts:16`
**Problem**: `Map<string, TypeInfo[]>` should be `Map<SymbolId, TypeInfo[]>`
**Impact**: Type errors when storing variable type information

### Issue 2: Parameter Name Types
**Location**: `constructor_type_resolver.ts:23`
**Problem**: `name: string` should be `name: SymbolId`
**Impact**: Parameter validation cannot use SymbolId system

### Issue 3: Namespace Symbol Storage
**Location**: `namespace_resolution.ts` throughout
**Problem**: All symbol storage uses raw strings
**Impact**: Namespace resolution completely bypasses SymbolId system

### Issue 4: Duplicate Interface Definitions
**Location**: Multiple modules define `ImportInfo` with different signatures
**Problem**: Creates confusion about which interface to use
**Impact**: Inconsistent type checking across modules

## Validation Strategy

### Phase 1: Fix Core Stub Interfaces
1. Update `ConstructorCallResult` to use `Map<SymbolId, TypeInfo[]>`
2. Update `ConstructorTypeAssignment` to use SymbolId fields
3. Update `ParameterInfo` to use SymbolId for names
4. Update namespace interfaces to use SymbolId consistently

### Phase 2: Eliminate Duplicate Interfaces
1. Remove local `ImportInfo` definitions
2. Use official `ImportedSymbol` from types package
3. Standardize on single interface definitions

### Phase 3: Update Function Signatures
1. Change all string parameters to SymbolId where appropriate
2. Update Map keys from string to SymbolId
3. Add proper symbol factory function usage

### Phase 4: Fix Stub Return Values
1. Ensure stubs return empty collections of correct types
2. Add proper SymbolId creation in placeholder data
3. Validate all stub return types pass type checking

## Recommended Fixes

### constructor_type_extraction.ts
```typescript
// BEFORE
export interface ConstructorCallResult {
  calls: ConstructorCall[];
  type_assignments: Map<string, TypeInfo[]>;  // ❌
}

// AFTER
export interface ConstructorCallResult {
  calls: ConstructorCall[];
  type_assignments: Map<SymbolId, TypeInfo[]>;  // ✅
}
```

### constructor_type_resolver.ts
```typescript
// BEFORE
export interface ParameterInfo {
  name: string;  // ❌
}

// AFTER
export interface ParameterInfo {
  name: SymbolId;  // ✅
}
```

### namespace_resolution.ts
```typescript
// BEFORE
export interface NamespaceImportInfo {
  namespace_name: string;  // ❌
  members?: string[];      // ❌
}

// AFTER
export interface NamespaceImportInfo {
  namespace_symbol: SymbolId;  // ✅
  members?: SymbolId[];        // ✅
}
```

## Risk Assessment

**High Risk**: If these issues are not fixed:
1. **Type safety is compromised** - Stub implementations will have type errors
2. **Architecture consistency is broken** - Some modules use SymbolId, others don't
3. **Future implementations will fail** - Stubs don't match expected types
4. **Test failures are inevitable** - Type mismatches will cause runtime errors

## Success Criteria

- [ ] All stub interfaces use SymbolId for symbol storage
- [ ] No duplicate interface definitions exist
- [ ] All Map keys use SymbolId where appropriate
- [ ] All function parameters use SymbolId for symbols
- [ ] TypeScript compilation passes without SymbolId-related errors
- [ ] All stub return types match expected SymbolId architecture

## Next Steps

1. **Immediate**: Fix the 4 critical interfaces identified above
2. **Short-term**: Eliminate duplicate interface definitions
3. **Medium-term**: Update all function signatures to use SymbolId
4. **Long-term**: Add validation to prevent future SymbolId violations

The stubbed modules currently **fail to maintain SymbolId architecture consistency**, creating a significant technical debt that must be addressed before any implementations can proceed.