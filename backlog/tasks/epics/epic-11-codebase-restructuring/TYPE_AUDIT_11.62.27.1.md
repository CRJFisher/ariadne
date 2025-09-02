# Import/Export Type Audit for Task 11.62.27.1

## Executive Summary

This audit documents all import/export type definitions across the Ariadne codebase, analyzing field usage, compatibility, and proposing a unified type design.

## Part 1: Complete Type Inventory

### @ariadnejs/types Package (Canonical)

#### import_export.ts
```typescript
interface ImportStatement {
  readonly source: ModulePath;
  readonly symbol_names: readonly SymbolName[];  // ISSUE: Always 0-1 elements
  readonly location: Location;
  readonly is_type_import?: boolean;
  readonly is_namespace_import?: boolean;
  readonly namespace_name?: string;
}

interface ExportStatement {
  readonly symbol_names: readonly SymbolName[];  // ISSUE: Always 0-1 elements
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_type_export?: boolean;
  readonly source?: ModulePath;  // for re-exports
}
```

#### modules.ts
```typescript
interface ImportInfo {
  readonly name: string;              // The imported name
  readonly source: string;            // The module path/source
  readonly alias?: string;            // Local alias if renamed
  readonly kind: 'named' | 'default' | 'namespace' | 'dynamic';
  readonly location: Location;
  readonly is_type_only?: boolean;    // TypeScript type-only import
  readonly namespace_name?: string;   // For namespace imports (import * as X)
}

interface ExportInfo {
  readonly name: string;              // The exported name
  readonly kind: 'named' | 'default' | 'namespace';
  readonly location: Location;
  readonly local_name?: string;       // Internal name if different
  readonly is_type_only?: boolean;    // TypeScript type-only export
  readonly is_reexport?: boolean;     // If re-exporting from another module
  readonly source?: string;           // Source module for re-exports
}

interface ImportedModule {
  readonly source: ModulePath;
  readonly symbols: readonly ImportedSymbol[];
  readonly is_type_import?: boolean;
  readonly location: Location;
}

interface ImportedSymbol {
  readonly name: ImportName;
  readonly local_name?: SymbolName;
  readonly is_namespace?: boolean;
  readonly is_default?: boolean;
  readonly is_type?: boolean;
}

interface ExportedSymbol {
  readonly name: ExportName;
  readonly kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum';
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_re_export?: boolean;
  readonly source_module?: ModulePath;
}
```

#### types.ts
```typescript
interface ImportedClassInfo {
  readonly class_name: string;
  readonly source_module: ModulePath;
  readonly local_name?: string;
  readonly is_default?: boolean;
  readonly is_type?: boolean;
}
```

### packages/core Duplicates

#### export_detection/export_detection.ts
```typescript
interface ExportInfo {  // INCOMPATIBLE with @ariadnejs/types!
  name: string;               
  export_name: string;        
  definition?: Def;           // Uses Def type - different!
  is_default: boolean;        
  is_reexport: boolean;       
  source_module?: string;     
  is_type_export?: boolean;   
  range: {                    // Different location format!
    start: Point;
    end: Point;
  };
}
```

#### import_resolution/import_resolution.ts
```typescript
interface ImportInfo {  // COMPLETELY DIFFERENT!
  import_statement: ImportedSymbol;
  imported_function: ExportedSymbol;
  local_name: string;
}
```

#### module_graph/module_graph.ts
```typescript
interface ModuleImportInfo {
  readonly source_module: string;
  readonly imported_names: readonly string[];
  readonly is_namespace: boolean;
  readonly is_default: boolean;
  readonly is_dynamic?: boolean;
  readonly location?: {
    readonly line: number;
    readonly column: number;
  };
}
```

#### type_tracking/type_tracking.ts
```typescript
interface ImportedClassInfo {  // DUPLICATE of types.ts version!
  class_name: string;
  source_module: string;
  local_name: string;
  is_default?: boolean;
  is_type_only?: boolean;
}

interface ExportedTypeInfo {
  class_name: string;
  class_def: Def;
  source_file: string;
  is_default?: boolean;
  is_type_only?: boolean;
}
```

#### namespace_resolution/namespace_resolution.ts
```typescript
interface NamespaceImportInfo {
  namespace_name: string;
  source_module: string;
  location: Location;
  resolved_path?: string;
}
```

#### constructor_type_resolver.ts
```typescript
interface ImportInfo {  // YET ANOTHER VERSION!
  name: string;
  source: string;
  local_name?: string;
}
```

## Part 2: Field Usage Analysis

### Critical Fields (Used Everywhere)
- `name` / `symbol_name` - The identifier being imported/exported
- `source` / `source_module` - Module path
- `location` - Where in source code
- `kind` - Type of import/export (named, default, namespace)

### Important Fields (Frequently Used)
- `is_type_only` / `is_type` - TypeScript type-only
- `is_default` - Default import/export
- `alias` / `local_name` - Renamed imports
- `is_namespace` / `namespace_name` - Namespace imports

### Specialized Fields (Specific Use Cases)
- `definition` / `class_def` - AST node reference (internal only)
- `export_name` - Different from local name
- `is_reexport` / `is_re_export` - Re-exports
- `is_dynamic` - Dynamic imports
- `imported_names` - Multiple symbols (module graph)

### Vestigial/Redundant Fields
- `symbol_names` array - Always 0-1 elements
- `import_statement` / `imported_function` - Confusing naming
- Multiple location formats (Location vs Point vs line/column)

## Part 3: Compatibility Matrix

| Field | ImportInfo (@types) | ImportInfo (core) | ImportStatement | ModuleImportInfo |
|-------|-------------------|------------------|-----------------|------------------|
| name | ✓ | ✗ (different) | ✗ (array) | ✗ (imported_names) |
| source | ✓ | ✗ | ✓ | ✓ (source_module) |
| location | ✓ | ✗ | ✓ | ✓ (partial) |
| kind | ✓ | ✗ | ✗ | ✗ (booleans) |
| is_type_only | ✓ | ✗ | ✓ (is_type_import) | ✓ (is_type_import) |
| alias | ✓ | ✓ (local_name) | ✗ | ✗ |

## Part 4: Consolidated Type Design

### Design Principles
1. **Single source of truth** - One type per concept
2. **Compatibility** - Preserve all necessary fields
3. **Clarity** - Clear naming and purpose
4. **Flexibility** - Support all languages and patterns

### Proposed Unified Types

```typescript
// Core import/export info for extraction and detection
export interface ImportInfo {
  readonly name: string;                      // Imported symbol name
  readonly source: ModulePath;                // Module being imported from
  readonly kind: 'named' | 'default' | 'namespace' | 'dynamic';
  readonly location: Location;                // Location in source
  readonly alias?: string;                    // Local name if renamed
  readonly is_type_only?: boolean;            // TypeScript type-only
  readonly namespace_name?: string;           // For namespace imports
  readonly is_side_effect_only?: boolean;     // import 'module' (no symbols)
}

export interface ExportInfo {
  readonly name: string;                      // Exported symbol name
  readonly kind: 'named' | 'default' | 'namespace';
  readonly location: Location;                // Location in source
  readonly local_name?: string;               // Internal name if different
  readonly is_type_only?: boolean;            // TypeScript type-only
  readonly is_reexport?: boolean;             // Re-exported from another module
  readonly source?: ModulePath;               // Source for re-exports
  readonly export_name?: string;              // Export name if different
}

// Simplified API for FileAnalysis (with single symbol_name)
export interface ImportStatement {
  readonly source: ModulePath;
  readonly symbol_name?: SymbolName;          // Single symbol (was array)
  readonly location: Location;
  readonly is_type_import?: boolean;
  readonly is_namespace_import?: boolean;
  readonly namespace_name?: string;
  readonly is_side_effect_only?: boolean;
}

export interface ExportStatement {
  readonly symbol_name?: SymbolName;          // Single symbol (was array)
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_type_export?: boolean;
  readonly source?: ModulePath;               // for re-exports
  readonly export_name?: string;              // if different from symbol_name
}

// For type tracking specifically
export interface ImportedTypeInfo {
  readonly type_name: string;
  readonly source_module: ModulePath;
  readonly local_name?: string;
  readonly is_default?: boolean;
  readonly is_type_only?: boolean;
  readonly kind: 'class' | 'interface' | 'type' | 'enum';
}

export interface ExportedTypeInfo {
  readonly type_name: string;
  readonly kind: 'class' | 'interface' | 'type' | 'enum';
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_type_only?: boolean;
  readonly source?: ModulePath;               // for re-exports
}

// Module graph specific
export interface ModuleImport {
  readonly source: ModulePath;
  readonly symbols: readonly string[];        // All imported symbols
  readonly kind: 'static' | 'dynamic';
  readonly location?: Location;
  readonly is_type_only?: boolean;
  readonly is_namespace?: boolean;
  readonly namespace_name?: string;
}

export interface ModuleExport {
  readonly symbols: readonly string[];        // All exported symbols
  readonly kind: 'named' | 'default' | 'namespace';
  readonly location?: Location;
  readonly is_type_only?: boolean;
  readonly is_reexport?: boolean;
  readonly source?: ModulePath;
}
```

## Part 5: Migration Mapping

### ImportInfo (modules.ts) → ImportInfo (consolidated)
- All fields preserved as-is
- No changes needed

### ExportInfo (modules.ts) → ExportInfo (consolidated)  
- Add `export_name` field for clarity
- Otherwise compatible

### ImportStatement → ImportStatement (consolidated)
- `symbol_names[0]` → `symbol_name`
- Add `is_side_effect_only` for import 'module'

### ExportStatement → ExportStatement (consolidated)
- `symbol_names[0]` → `symbol_name`
- Add `export_name` for renamed exports

### ImportInfo (core duplicates) → ImportInfo (consolidated)
- `import_resolution.ts`: Complete rewrite needed
- `constructor_type_resolver.ts`: Map directly
- Use adapters for incompatible shapes

### ExportInfo (core duplicate) → ExportInfo (consolidated)
- `definition` field → Remove (internal only)
- `range` → `location` (use Location type)
- `export_name` → Preserve
- `is_reexport` → `is_reexport`

### ModuleImportInfo → ModuleImport
- `source_module` → `source`
- `imported_names` → `symbols`
- `is_dynamic` → `kind: 'dynamic'`
- Add other fields as needed

### ImportedClassInfo → ImportedTypeInfo
- `class_name` → `type_name`
- Add `kind` field for type category
- Otherwise compatible

### ExportedTypeInfo → ExportedTypeInfo (consolidated)
- Remove `class_def` (internal only)
- `class_name` → `type_name`
- Add `kind` field
- `source_file` → Use location.file_path

## Part 6: Implementation Strategy

### Phase 1: Add New Types (Non-Breaking)
1. Add consolidated types to @ariadnejs/types/import_export.ts
2. Keep old types temporarily with @deprecated tags
3. Add type aliases for compatibility

### Phase 2: Update Extractors
1. Update import_extraction.ts to use new ImportInfo
2. Update export_extraction.ts to use new ExportInfo
3. Add adapters for backward compatibility

### Phase 3: Remove Duplicates
1. Delete duplicate types from core
2. Update all imports
3. Fix type mismatches with adapters

### Phase 4: Update API
1. Change symbol_names to symbol_name
2. Update all consumers
3. Remove deprecated types

## Part 7: Risk Assessment

### High Risk Areas
1. **import_resolution.ts ImportInfo** - Completely different structure
2. **export_detection.ts ExportInfo** - Uses Def type, different fields
3. **Module graph** - May need significant updates

### Medium Risk Areas
1. **Type tracking** - Multiple duplicate types
2. **Tests** - Many assertions will need updates
3. **Symbol resolution** - Depends on import/export types

### Low Risk Areas
1. **Extraction functions** - Already use correct types
2. **Type adapters** - Designed to handle conversions
3. **Language-specific code** - Isolated changes

## Recommendations

1. **Start with @ariadnejs/types** - Establish the foundation
2. **Use adapters liberally** - Don't try to fix everything at once
3. **Test continuously** - Run tests after each phase
4. **Document everything** - Migration guide is critical
5. **Consider feature flag** - Allow gradual rollout if needed

## Conclusion

The type duplication is extensive but manageable. The proposed consolidated design preserves all necessary functionality while simplifying the API. The key is careful phased implementation with extensive testing at each step.