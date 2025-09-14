# SymbolId Architecture Survey Report

## Survey Date: 2025-09-14

## Executive Summary

Found multiple violations of the SymbolId architecture across the codebase. Key areas requiring fixes:

1. **Map<string usage** - Found in namespace_resolution, import_resolution, and cache modules
2. **Raw string parameters** - Found in constructor calls, namespace resolution, and import helpers
3. **Old identifier types** - Still referenced in test files and some core modules

## Detailed Findings

### 1. Map<string Violations

#### namespace_resolution module
- `exports: Map<string, NamespaceExport>` - should use SymbolId
- `seen: Map<string, NamespaceImportInfo>` - should use SymbolId
- `by_source: Map<string, number>` - OK (file paths)

#### import_resolution module
- `resolution_cache: new Map<string, ExportedSymbol | undefined>()` - should use SymbolId

#### export_detection module
- `Map<string, Export[]>` - should use SymbolId for export names

#### cache and storage modules
- `astCache = new Map<string, any>()` - OK (cache keys)
- `file_cache = new Map<string, any>()` - OK (file paths)
- `files: ReadonlyMap<string, StoredFile>` - OK (file paths)

### 2. String Parameters in Symbol Functions

#### namespace_resolution
- `namespace_name: string` - should be SymbolId
- `name: string` in NamespaceExport - should be SymbolId
- `qualified_name: string` - should be SymbolId

#### namespace_helpers
- `namespace_name: string` - should be SymbolId
- `member_name: string` - should be SymbolId
- `export_name: string` - should be SymbolId

#### constructor_type_extraction
- `variable_name: string` - should be SymbolId
- `type_name: string` - should be SymbolId or TypeName

#### constructor_type_resolver
- `name: string` in ParameterInfo - should be SymbolId

### 3. Old Identifier Types Still in Use

#### types package (aliases.ts)
- Still defines: ClassName, MethodName, FunctionName, VariableName, etc.
- These should be deprecated in favor of SymbolId

#### Test files still using old types
- call_chain_analysis.test.ts imports ClassName
- type_tracking.test.ts uses ClassName

#### Core modules referencing old types
- class_hierarchy.ts imports ClassName
- classes.ts uses ClassName, MethodName

### 4. Files Needing Fixes

Priority 1 (Core functionality):
- packages/core/src/import_export/namespace_resolution/namespace_resolution.ts
- packages/core/src/import_export/import_resolution/import_resolution.ts
- packages/core/src/import_export/import_resolution/namespace_helpers.ts
- packages/core/src/call_graph/constructor_calls/constructor_type_extraction.ts
- packages/core/src/call_graph/constructor_calls/constructor_type_resolver.ts

Priority 2 (Type definitions):
- packages/types/src/aliases.ts - deprecate old types
- packages/types/src/classes.ts - use SymbolId
- packages/types/src/calls.ts - use SymbolId

Priority 3 (Tests):
- Update test files to use SymbolId

## Recommended Migration Strategy

1. **Phase 1**: Fix core modules to use SymbolId for all symbol storage
2. **Phase 2**: Update type definitions to deprecate old identifier types
3. **Phase 3**: Migrate test files to use SymbolId
4. **Phase 4**: Add runtime validation to catch any remaining violations

## Validation Script

```bash
# Check for remaining violations after fixes
npm run typecheck
grep -r "Map<string," packages/core/src --include="*.ts" --exclude="*.test.ts" | grep -v "FilePath"
grep -r "name: string" packages/core/src --include="*.ts" | grep -v "file_name"
```