# Task 11.62.27: Consolidate Import/Export Types and Simplify API

**Status**: 🔴 Not Started  
**Assignee**: Unassigned  
**Estimated effort**: 8-12 hours  
**Actual effort**: Not recorded  
**Priority**: P1 (High) - Major type system cleanup  
**Tags**: #api #types #refactoring #breaking-change #consolidation

## Context

This task has expanded from a simple API fix to a major consolidation effort. Investigation revealed:

1. **The original issue**: `ImportStatement` and `ExportStatement` use misleading `symbol_names` arrays that always contain 0-1 elements

2. **A much bigger problem**: Massive duplication of import/export types across the codebase with incompatible definitions

## Problem Statement

### Current Behavior

```typescript
// export { User, Profile, Config } from './models';
// Produces 3 separate ExportStatement objects:
{ symbol_names: ['User'], source: './models', ... }
{ symbol_names: ['Profile'], source: './models', ... }
{ symbol_names: ['Config'], source: './models', ... }

// export default class MyClass {}
// Produces:
{ symbol_names: [], is_default: true, ... }  // Name is lost!
```

### Issues

**Original API Issues:**
1. **Misleading API**: Array suggests multiple symbols per statement, but it's always 0-1 elements
2. **Lost Information**: Default exports have empty `symbol_names`, losing the entity name
3. **Unnecessary Complexity**: Consumers must handle an array when they only ever get a single value
4. **Semantic Mismatch**: The data structure doesn't match the actual data model

**Type Duplication Crisis:**

### Duplicate Type Definitions Found

#### In @ariadnejs/types package (the canonical source):
- `import_export.ts`: ImportStatement, ExportStatement (for FileAnalysis)
- `modules.ts`: ImportInfo, ExportInfo, ImportedModule, ImportedSymbol, ExportedSymbol (for module graph)
- `types.ts`: ImportedClassInfo (for type tracking)
- `aliases.ts`: ImportName, ExportName (type aliases)

#### In packages/core (duplicates with different shapes!):

1. **import_export/export_detection/export_detection.ts**:
   - `ExportInfo` - DIFFERENT from @ariadnejs/types version! Has `Def`, `Point`, different fields
   - `ExportRegistry`, `ExportDetectionConfig`, `ExportDetectionContext`, `GroupedExports`

2. **import_export/import_resolution/import_resolution.ts**:
   - `ImportInfo` - COMPLETELY DIFFERENT! Has `ImportedSymbol`, `ExportedSymbol` fields
   - `ImportResolutionConfig`, `ImportResolutionContext`, `NamespaceExport`

3. **import_export/module_graph/module_graph.ts**:
   - `ModuleImportInfo` - Yet another import type variation

4. **type_analysis/type_tracking/type_tracking.ts**:
   - `ImportedClassInfo` - Duplicates the one in @ariadnejs/types
   - `ExportedTypeInfo` - New type for exported types

5. **import_export/namespace_resolution/namespace_resolution.ts**:
   - `NamespaceImportInfo`, `NamespaceExport` - More variations

6. **call_graph/constructor_calls/constructor_type_resolver.ts**:
   - `ImportInfo` - Yet another different local interface!

7. **import_export/export_detection/export_detection.rust.ts**:
   - `RustExportInfo extends ExportInfo` - Language-specific extension

### Type Usage Analysis

- **Extract functions** (import_extraction.ts, export_extraction.ts) correctly use types from @ariadnejs/types
- **Type adapters** convert between @ariadnejs/types and internal representations
- **Internal modules** define their own incompatible versions
- **No single source of truth** for what an import or export actually is

## Requirements

### Part 1: Consolidate Import/Export Types

1. **Move all import/export types to @ariadnejs/types/src/import_export.ts**
   - Consolidate ImportInfo, ExportInfo variations
   - Merge ImportStatement, ExportStatement with their Info counterparts if possible
   - Define clear type hierarchy for different use cases

2. **Remove all duplicate type definitions from packages/core**
   - Delete local ImportInfo/ExportInfo interfaces
   - Update all references to use @ariadnejs/types
   - Preserve necessary extensions (like RustExportInfo) as proper extensions

3. **Establish naming conventions**
   - `*Info` types for extraction/detection results
   - `*Statement` types for FileAnalysis API
   - Clear distinction between internal and public types

### Part 2: Simplify the API

1. Replace `symbol_names: readonly SymbolName[]` with `symbol_name?: SymbolName`
2. Ensure default exports include their entity name (or 'default' as fallback)
3. Update all type adapters to use the new field
4. Handle namespace imports/exports appropriately (symbol_name undefined, use namespace_name)

### Non-Functional Requirements

1. This is a breaking change - must be clearly documented
2. No loss of functionality - all existing features must work
3. Improved type safety - single source of truth for each type
4. Better developer experience - clear, consistent types

## Investigation Notes

### Research Findings

- Each `ImportInfo`/`ExportInfo` represents a single symbol (by design)
- Consolidation to group symbols was considered but provides no functional benefit
- All downstream processing (symbol resolution, type analysis, module graph) works perfectly with individual symbols
- The array structure is a vestigial design artifact

### Why Not Consolidate?

- **No functional benefit**: All processing is per-symbol, not per-statement
- **Added complexity**: Would require grouping logic with no value
- **Performance cost**: Extra processing for no gain
- **Current model works**: The 1:1 mapping is actually correct for how the data is used

## Solution Design

### Phase 1: Type Consolidation (Priority)

1. **Create unified type definitions in @ariadnejs/types/src/import_export.ts**:

```typescript
export interface ImportStatement {
  readonly source: ModulePath;
  readonly symbol_name?: SymbolName; // Changed from symbol_names array
  readonly location: Location;
  readonly is_type_import?: boolean;
  readonly is_namespace_import?: boolean;
  readonly namespace_name?: string;
}

export interface ExportStatement {
  readonly symbol_name?: SymbolName; // Changed from symbol_names array
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_type_export?: boolean;
  readonly source?: ModulePath;
}
```

2. **Update Type Adapters** (`packages/core/src/type_analysis/type_adapters.ts`):

```typescript
// ImportStatement adapter
export function convert_import_info_to_statement(
  import_info: ImportInfo,
  file_path: string
): ImportStatement {
  const symbol_name =
    import_info.name && import_info.kind !== "namespace"
      ? (import_info.name as SymbolName)
      : undefined;

  return {
    source: import_info.source as ModulePath,
    symbol_name, // Single value instead of array
    location,
    is_type_import: import_info.is_type_only,
    is_namespace_import: import_info.kind === "namespace",
    namespace_name: import_info.namespace_name,
  };
}

// ExportStatement adapter
export function convert_export_info_to_statement(
  export_info: ExportInfo
): ExportStatement {
  // Include name for all exports, including defaults
  const symbol_name = export_info.name
    ? (export_info.name as SymbolName)
    : export_info.kind === "default"
    ? ("default" as SymbolName)
    : undefined;

  return {
    symbol_name, // Single value instead of array
    location: export_info.location,
    is_default: export_info.kind === "default",
    is_type_export: export_info.is_type_only,
    source: export_info.source as ModulePath,
  };
}
```

### Phase 2: Remove Duplicate Types from packages/core

1. **Delete duplicate interfaces:**
   - Remove ExportInfo from export_detection.ts
   - Remove ImportInfo from import_resolution.ts  
   - Remove ImportedClassInfo from type_tracking.ts
   - Remove ModuleImportInfo from module_graph.ts
   - Update all imports to use @ariadnejs/types

2. **Handle special cases:**
   - Keep RustExportInfo but make it properly extend the canonical ExportInfo
   - Merge NamespaceImportInfo into ImportInfo with appropriate fields
   - Consolidate ExportedTypeInfo with ExportInfo

### Phase 3: Update Consumers

Update all code that references the old types or `symbol_names` array

## Implementation Checklist

### Phase 1: Type Consolidation
- [ ] Audit all existing import/export types for necessary fields
- [ ] Design consolidated type hierarchy in @ariadnejs/types
- [ ] Move/merge ImportInfo and ExportInfo to import_export.ts
- [ ] Update ImportStatement to use `symbol_name?: SymbolName`
- [ ] Update ExportStatement to use `symbol_name?: SymbolName`
- [ ] Add necessary fields from duplicate types to canonical versions

### Phase 2: Remove Duplicates
- [ ] Remove ExportInfo from export_detection/export_detection.ts
- [ ] Remove ImportInfo from import_resolution/import_resolution.ts
- [ ] Remove ImportedClassInfo from type_tracking/type_tracking.ts
- [ ] Remove ModuleImportInfo from module_graph.ts
- [ ] Remove duplicate ImportInfo from constructor_type_resolver.ts
- [ ] Update all imports to use @ariadnejs/types
- [ ] Fix any type mismatches from consolidation

### Phase 3: API Updates
- [ ] Update `convert_import_info_to_statement()` adapter
- [ ] Update `convert_export_info_to_statement()` adapter
- [ ] Ensure default exports include their name (or 'default' fallback)
- [ ] Handle namespace imports/exports correctly
- [ ] Search and update all consumers of `symbol_names`
- [ ] Update all tests to expect single `symbol_name` field

### Phase 4: Documentation
- [ ] Add migration guide to documentation
- [ ] Document the new type hierarchy
- [ ] Update API reference
- [ ] Add changelog entry
- [ ] Bump major version (breaking change)

## Test Cases

1. **Named Export**: `export { User }` → `symbol_name: 'User'`
2. **Default Export with Name**: `export default class MyClass` → `symbol_name: 'MyClass'`
3. **Anonymous Default Export**: `export default {}` → `symbol_name: 'default'`
4. **Type Export**: `export type { User }` → `symbol_name: 'User', is_type_export: true`
5. **Namespace Import**: `import * as foo` → `symbol_name: undefined, namespace_name: 'foo'`
6. **Re-export**: `export { User } from './models'` → `symbol_name: 'User', source: './models'`

## Success Criteria

- [ ] API is cleaner and more intuitive
- [ ] No loss of information (especially for default exports)
- [ ] All tests pass with updated expectations
- [ ] Performance is same or better
- [ ] Clear migration documentation provided

## Sub-Tasks

This work has been broken into manageable sub-tasks:

1. **11.62.27.1** - Audit and Design Consolidated Import/Export Types (2-3 hours)
2. **11.62.27.2** - Consolidate Types in @ariadnejs/types Package (2-3 hours)
3. **11.62.27.3** - Remove Duplicate Types from packages/core (3-4 hours)
4. **11.62.27.4** - Update All Consumers to Use New API (2-3 hours)

## Dependencies

- Must coordinate with any active work on import/export processing
- Breaking change requires version bump and changelog entry
- Blocks proper symbol resolution (needs clean types)
- May affect module graph construction
- Type tracking layer depends on these types

## Risks & Mitigation

1. **Risk**: Breaking many files at once
   - **Mitigation**: Do consolidation in phases, test each phase

2. **Risk**: Missing a duplicate type definition
   - **Mitigation**: Comprehensive grep search, TypeScript compiler will catch

3. **Risk**: Incompatible type shapes between duplicates
   - **Mitigation**: Careful field-by-field analysis, preserve all needed fields

## Notes

This expanded from a simple API fix to a major type consolidation effort. The investigation revealed that the `symbol_names` array issue was just a symptom of a much larger problem: massive type duplication with incompatible definitions throughout the codebase.

The consolidation will:
1. Establish a single source of truth for import/export types
2. Simplify the API to match the actual data model (1 symbol per statement)
3. Improve type safety and developer experience
4. Make the codebase more maintainable

This is critical technical debt that should be addressed before building more features on top of the current broken foundation.
