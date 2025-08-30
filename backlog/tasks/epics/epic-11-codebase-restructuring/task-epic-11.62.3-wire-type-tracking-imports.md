---
id: task-epic-11.62.3
title: Wire Type Tracking to Import Resolution
status: Completed
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, integration, type-tracking]
dependencies: [task-epic-11.62.1, task-epic-11.62.2]
parent_task_id: task-epic-11.62
---

## Description

Wire the type_tracking module to consume ImportInfo[] from import_resolution instead of extracting imports itself. This eliminates duplication and ensures consistent import handling across the codebase.

## Current Problem

From `/packages/core/src/type_analysis/type_tracking/type_tracking.ts`:

```typescript
// TODO: Integration Points
// - Should consume ImportInfo[] from import_resolution module
// - Should use ScopeTree from scope_analysis for variable resolution
// - Should register discovered types with type_registry
```

The module currently has TODOs but no actual integration - it works in isolation.

## Acceptance Criteria

### Remove Duplicate Import Extraction

- [x] Remove any import extraction logic from type_tracking module
- [x] Update function to accept ImportInfo[] as parameter:

```typescript
export function track_types(
  context: ProcessingContext // Contains imports in layer2
): TypeTrackingResult {
  const imports = context.layer2?.imports || [];
  // Use imports for type resolution
}
```

### Use Imports for Type Resolution

- [x] When encountering an identifier, check if it's imported:

```typescript
function resolve_type_from_identifier(
  identifier: string,
  imports: ImportInfo[]
): string | undefined {
  // Check if identifier is imported
  const importInfo = imports.find(
    (i) => i.name === identifier || i.alias === identifier
  );

  if (importInfo) {
    return importInfo.source; // Qualified type name
  }

  // Fall back to local resolution
}
```

### Handle Different Import Patterns

- [x] Support default imports: `import Foo from './foo'`
- [x] Support named imports: `import { Bar } from './bar'`
- [x] Support namespace imports: `import * as baz from './baz'`
- [x] Support type-only imports (TypeScript): `import type { Type } from './types'`

### Language-Specific Implementation

- [x] JavaScript: Use ImportInfo for class/function imports
- [x] TypeScript: Additionally handle type-only imports
- [x] Python: Handle from...import patterns
- [x] Rust: Handle use statements and module paths

## Implementation Notes

### Data Flow

1. import_resolution runs first (Layer 2)
2. Produces ImportInfo[] with all imports
3. type_tracking receives this via ProcessingContext
4. Uses imports to resolve type references

### Example Integration

```typescript
// In type_tracking.typescript.ts
export function track_types_typescript(
  context: ProcessingContext
): TypeTrackingResult {
  const { ast, source } = context.layer0;
  const imports = context.layer2?.imports || [];
  const classes = context.layer2?.classes || [];

  const type_map = new Map<VariableName, TypeInfo>();

  // When we find a variable declaration with a type
  ast.descendantsOfType("variable_declarator").forEach((node) => {
    const typeNode = node.childForFieldName("type");
    if (typeNode) {
      const typeName = get_node_text(typeNode, source);

      // Check if this type is imported
      const resolvedType = resolve_imported_type(typeName, imports);

      // Store the resolved type
      const varName = get_node_text(node.childForFieldName("name"), source);
      type_map.set(varName, {
        type: resolvedType || typeName,
        location: node_to_location(node),
        is_imported: !!resolvedType,
      });
    }
  });

  return { type_map };
}
```

## Testing Requirements

- [x] Test that imported types are correctly resolved
- [x] Test that local types still work
- [x] Test namespace imports (`Foo.Bar` types)
- [x] Test type alias resolution
- [x] Verify no duplicate import extraction

## Success Metrics

- [x] Type tracking uses ImportInfo[] from context
- [x] No import extraction code in type_tracking module
- [x] Imported types are properly qualified
- [x] All existing type tracking tests still pass
- [x] Integration test shows correct cross-file type resolution

## References

- Parent task: task-epic-11.62
- Type tracking module: `/packages/core/src/type_analysis/type_tracking/`
- Import resolution: `/packages/core/src/import_export/import_resolution/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 3 depends on Layer 2)

## Implementation Notes

### Completed (2025-08-29)

Successfully wired type_tracking to use ImportInfo[] from import_resolution layer instead of extracting imports itself.

#### Key Changes

1. **Created import_type_resolver.ts**
   - `resolve_type_from_imports()` - Resolves type references using ImportInfo[]
   - `build_import_type_map()` - Creates fast lookup map
   - `is_imported_type()` - Checks if a type is imported
   - `get_qualified_type_name()` - Returns fully qualified type names
   - Handles namespace imports (e.g., `React.Component`)
   - Supports type-only imports for TypeScript

2. **Updated type_tracking/index.ts**
   - Removed `track_imports()` function entirely
   - Added `process_imports_for_types()` to use ImportInfo[] from Layer 1
   - Removed all language-specific import tracking imports
   - Updated `process_file_for_types()` to process imports first
   - Removed `is_import_node()` helper - no longer needed

3. **Removed Duplicate Import Extraction**
   - No longer extracting imports from AST in type_tracking
   - Using ImportInfo[] passed from import_resolution layer
   - Eliminated redundant parsing and potential inconsistencies

4. **Added Comprehensive Tests**
   - Created import_type_resolver.test.ts with 12 tests
   - Tests cover default imports, named imports, aliases, namespaces
   - All tests passing successfully

#### Benefits

1. **Single Source of Truth**: Import extraction happens only in import_resolution
2. **Consistency**: All modules use the same import information
3. **Performance**: No duplicate AST traversal for imports
4. **Type Safety**: Using proper ImportInfo[] type from @ariadnejs/types
5. **Better Resolution**: Can now properly resolve namespace imports and type-only imports

#### Architecture Impact

This change properly implements the layered architecture where:
- Layer 1 (import_resolution) extracts imports
- Layer 3 (type_tracking) consumes imports
- No duplicate work or inconsistent import handling

The type_tracking module is now properly integrated with the processing pipeline.
