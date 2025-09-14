# Comprehensive Map<> SymbolId Analysis

## Executive Summary

After analyzing all 100+ Map declarations in the codebase, I found **27 critical violations** where Maps are using `string` keys to store symbols when they should be using `SymbolId`.

## Critical Violations (MUST fix)

### 1. namespace_resolution.ts - 4 violations
```typescript
// ❌ WRONG - Export names are symbols
exports: Map<string, NamespaceExport>
const exports = new Map<string, NamespaceExport>();
const seen = new Map<string, NamespaceImportInfo>();  // namespace names
const exports = new Map<string, NamespaceExportInfo>();

// ✅ SHOULD BE
exports: Map<SymbolId, NamespaceExport>
const exports = new Map<SymbolId, NamespaceExport>();
const seen = new Map<SymbolId, NamespaceImportInfo>();
const exports = new Map<SymbolId, NamespaceExportInfo>();
```

### 2. import_resolution.ts - 2 violations
```typescript
// ❌ WRONG - Caching resolved symbols
resolution_cache: new Map<string, ExportedSymbol | undefined>()
return new Map<string, NamespaceExport>();

// ✅ SHOULD BE
resolution_cache: new Map<SymbolId, ExportedSymbol | undefined>()
return new Map<SymbolId, NamespaceExport>();
```

### 3. export_detection/index.ts - 1 violation
```typescript
// ❌ WRONG - Export names are symbols
const by_source = new Map<string, Export[]>();

// ✅ SHOULD BE
const by_source = new Map<SymbolId, Export[]>();
```

### 4. file_analyzer.ts - 2 violations
```typescript
// ❌ WRONG - Parameter and function names are symbols
inferred_parameters: Map<string, ParameterAnalysis>;
inferred_returns: Map<string, ReturnTypeInfo>;

// ✅ SHOULD BE
inferred_parameters: Map<SymbolId, ParameterAnalysis>;
inferred_returns: Map<SymbolId, ReturnTypeInfo>;
```

### 5. method_override/method_override.ts - 2 violations
```typescript
// ❌ WRONG - Method names are symbols
all_methods: Map<string, Def[]>;
overrides: Map<string, OverrideInfo>;

// ✅ SHOULD BE
all_methods: Map<SymbolId, Def[]>;
overrides: Map<SymbolId, OverrideInfo>;
```

### 6. interface_implementation/types.ts - 5 violations
```typescript
// ❌ WRONG - All of these store symbol names
implemented_methods: Map<string, MethodSignature>;
implemented_properties?: Map<string, PropertySignature>;
interfaces: Map<string, InterfaceDefinition>;
implementations: Map<string, InterfaceImplementation[]>;
class_interfaces: Map<string, string[]>;

// ✅ SHOULD BE
implemented_methods: Map<SymbolId, MethodSignature>;
implemented_properties?: Map<SymbolId, PropertySignature>;
interfaces: Map<SymbolId, InterfaceDefinition>;
implementations: Map<SymbolId, InterfaceImplementation[]>;
class_interfaces: Map<SymbolId, SymbolId[]>;
```

### 7. constructor_type_extraction.ts - 3 violations
```typescript
// ❌ WRONG - Variable names are symbols
type_assignments: Map<string, TypeInfo[]>;
type_map1: Map<string, TypeInfo[]>;
type_map2: Map<string, TypeInfo[]>;

// ✅ SHOULD BE
type_assignments: Map<SymbolId, TypeInfo[]>;
type_map1: Map<SymbolId, TypeInfo[]>;
type_map2: Map<SymbolId, TypeInfo[]>;
```

### 8. method_hierarchy_resolver.ts - 1 violation
```typescript
// ❌ WRONG - Method names are symbols
const methods = new Map<string, string>();

// ✅ SHOULD BE
const methods = new Map<SymbolId, SymbolId>();
```

### 9. call_chain_analysis.ts - 2 violations
```typescript
// ❌ WRONG - Function names in call graphs are symbols
call_graph: Map<string, Set<string>>;
const graph = new DefaultMap<string, Set<string>>(() => new Set());

// ✅ SHOULD BE
call_graph: Map<SymbolId, Set<SymbolId>>;
const graph = new DefaultMap<SymbolId, Set<SymbolId>>(() => new Set());
```

### 10. constructor_type_resolver.ts - 1 violation
```typescript
// ❌ WRONG - Import names can be symbols
imports?: Map<string, any[]>

// ✅ SHOULD BE
imports?: Map<SymbolId, any[]>
```

### 11. receiver_type_resolver.ts - 1 violation
```typescript
// ❌ WRONG - Variable names are symbols
type_map: Map<string, TypeInfo[]> | undefined,

// ✅ SHOULD BE
type_map: Map<SymbolId, TypeInfo[]> | undefined,
```

### 12. type_tracking.ts - 2 violations
```typescript
// ❌ WRONG - Import class names are symbols
imported_classes: Map<string, any>;
types: Map<string, TypeInfo>  // in utils

// ✅ SHOULD BE
imported_classes: Map<SymbolId, any>;
types: Map<SymbolId, TypeInfo>
```

### 13. import_type_resolver.ts - 1 violation
```typescript
// ❌ WRONG - Type names are symbols
const type_map = new Map<string, any>();

// ✅ SHOULD BE
const type_map = new Map<SymbolId, any>();
```

## Acceptable Maps (correctly NOT using SymbolId)

### File and module maps (should use FilePath/ModulePath)
- `file_name_to_tree: Map<FilePath, Parser.Tree>` ✅
- `namespace_map = new Map<FilePath, NamespaceInfo>()` ✅
- `resolved_members = new Map<Location, ResolvedNamespaceType>()` ✅
- `imports_by_file: Map<string, readonly Import[]>` ✅
- `exports_by_file: Map<string, readonly Export[]>` ✅

### Cache and storage maps
- `astCache = new Map<string, any>()` ✅
- `analysisCache = new Map<string, any>()` ✅
- `file_cache = new Map<string, any>()` ✅
- `files: ReadonlyMap<string, StoredFile>` ✅

### Statistical and configuration maps
- `by_source: Map<string, number>` ✅ (file path statistics)
- `files_by_language: Map<string, number>` ✅
- `language_stats = new Map<Language, number>()` ✅
- `handlers = new Map<Language, BespokeHandlers>()` ✅

### Type system maps (correctly using type identifiers)
- `types: ReadonlyMap<QualifiedName, TypeDefinition>` ✅
- `aliases: ReadonlyMap<SymbolId, QualifiedName>` ✅ (correctly uses SymbolId!)
- `builtins: ReadonlyMap<Language, ReadonlySet<TypeName>>` ✅

## Summary

**Total Maps analyzed:** ~100+
**Critical violations:** 27
**Files requiring fixes:** 13
**Most violations in:** interface_implementation/types.ts (5), namespace_resolution.ts (4)

## Impact Assessment

These violations prevent the universal SymbolId architecture from being enforced:

1. **Type Safety Loss** - Raw strings can be mixed up between different symbol types
2. **Resolution Failures** - Symbol resolution caches using wrong keys
3. **Cross-file Analysis Broken** - Namespace and import resolution fails
4. **Call Graph Corruption** - Function names not properly tracked
5. **Type Inference Broken** - Parameter and return type tracking fails

## Priority for Fixes

1. **P0 (Critical):** namespace_resolution, import_resolution, call_chain_analysis
2. **P1 (High):** file_analyzer, method_override, constructor types
3. **P2 (Medium):** interface_implementation, type_tracking
4. **P3 (Low):** Various helper functions

All 27 violations must be fixed to achieve universal SymbolId enforcement.