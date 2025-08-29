---
id: task-epic-11.62.3
title: Wire Type Tracking to Import Resolution
status: To Do
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

- [ ] Remove any import extraction logic from type_tracking module
- [ ] Update function to accept ImportInfo[] as parameter:

```typescript
export function track_types(
  context: ProcessingContext // Contains imports in layer2
): TypeTrackingResult {
  const imports = context.layer2?.imports || [];
  // Use imports for type resolution
}
```

### Use Imports for Type Resolution

- [ ] When encountering an identifier, check if it's imported:

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

- [ ] Support default imports: `import Foo from './foo'`
- [ ] Support named imports: `import { Bar } from './bar'`
- [ ] Support namespace imports: `import * as baz from './baz'`
- [ ] Support type-only imports (TypeScript): `import type { Type } from './types'`

### Language-Specific Implementation

- [ ] JavaScript: Use ImportInfo for class/function imports
- [ ] TypeScript: Additionally handle type-only imports
- [ ] Python: Handle from...import patterns
- [ ] Rust: Handle use statements and module paths

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

- [ ] Test that imported types are correctly resolved
- [ ] Test that local types still work
- [ ] Test namespace imports (`Foo.Bar` types)
- [ ] Test type alias resolution
- [ ] Verify no duplicate import extraction

## Success Metrics

- [ ] Type tracking uses ImportInfo[] from context
- [ ] No import extraction code in type_tracking module
- [ ] Imported types are properly qualified
- [ ] All existing type tracking tests still pass
- [ ] Integration test shows correct cross-file type resolution

## References

- Parent task: task-epic-11.62
- Type tracking module: `/packages/core/src/type_analysis/type_tracking/`
- Import resolution: `/packages/core/src/import_export/import_resolution/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 3 depends on Layer 2)
