# Task epic-11.112.23.2: Implement is_exported for JavaScript/TypeScript

**Parent:** task-epic-11.112.23
**Status:** Not Started
**Estimated Time:** 2 hours
**Dependencies:** task-epic-11.112.23.1

## Objective

Update JavaScript/TypeScript language builders to populate the new `is_exported` flag and `export` metadata based on the presence of `export` keywords in the AST.

## Language Rules

### JavaScript/TypeScript Export Rules
- `export function foo() {}` → `is_exported = true`
- `export class Bar {}` → `is_exported = true`
- `export const x = 1` → `is_exported = true`
- `export { foo }` → `is_exported = true`
- `export { foo as bar }` → `is_exported = true, export = { export_name: "bar" }`
- `export default foo` → `is_exported = true, export = { is_default: true }`
- `export { x } from './y'` → `is_exported = true, export = { is_reexport: true }`
- `function foo() {}` (no export) → `is_exported = false`

## Implementation Steps

### 1. Update determine_availability Helper (30 min)

In `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`:

```typescript
/**
 * Check if a node is exported and extract export metadata
 */
function extract_export_info(node: SyntaxNode): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  let current: SyntaxNode | null = node;

  while (current) {
    const parent = current.parent;

    // Direct export: export function foo() {}
    if (parent?.type === "export_statement") {
      const export_metadata = analyze_export_statement(parent);
      return {
        is_exported: true,
        export: export_metadata
      };
    }

    current = parent;
  }

  return { is_exported: false };
}

/**
 * Analyze export statement to extract metadata
 */
function analyze_export_statement(export_node: SyntaxNode): ExportMetadata | undefined {
  // Check for export default
  const is_default = export_node.children.some(
    child => child.type === "default"
  );

  if (is_default) {
    return { is_default: true };
  }

  // Check for export { x } from './y' (re-export)
  const has_from = export_node.children.some(
    child => child.type === "from"
  );

  if (has_from) {
    return { is_reexport: true };
  }

  // Check for export alias: export { foo as bar }
  const export_specifier = find_export_specifier(export_node);
  if (export_specifier) {
    const alias = extract_export_alias(export_specifier);
    if (alias) {
      return { export_name: alias };
    }
  }

  return undefined;
}
```

### 2. Add Export Specifier Helpers (20 min)

```typescript
/**
 * Find export_specifier node that contains alias information
 */
function find_export_specifier(export_node: SyntaxNode): SyntaxNode | null {
  // Look for export_clause → export_specifier pattern
  const export_clause = export_node.childForFieldName("declaration");
  if (export_clause?.type === "export_clause") {
    for (const child of export_clause.children) {
      if (child.type === "export_specifier") {
        return child;
      }
    }
  }
  return null;
}

/**
 * Extract export alias from export_specifier node
 * Returns the "bar" in: export { foo as bar }
 */
function extract_export_alias(specifier_node: SyntaxNode): SymbolName | null {
  const name_node = specifier_node.childForFieldName("name");
  const alias_node = specifier_node.childForFieldName("alias");

  if (alias_node) {
    return alias_node.text as SymbolName;
  }

  return null;
}
```

### 3. Update All Definition Builders (40 min)

Update each builder to use the new export info:

```typescript
// Function definitions
function_definition: {
  process: (capture: CaptureNode, builder: DefinitionBuilder, context: ProcessingContext) => {
    const node = capture.node;
    const export_info = extract_export_info(node);

    builder.add_function({
      symbol_id: function_id,
      name: capture.text,
      location: capture.location,
      defining_scope_id: context.get_scope_id(capture.location),
      availability: determine_availability(node), // Keep for migration
      is_exported: export_info.is_exported,       // NEW
      export: export_info.export,                 // NEW
      // ... other fields
    });
  }
}

// Apply same pattern to:
// - class_definition
// - variable_definition
// - interface_definition
// - enum_definition
// - type_alias_definition
```

### 4. Update TypeScript Builder (20 min)

In `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`:

TypeScript uses the same export syntax as JavaScript, so we can reuse the helpers:
- Import `extract_export_info` from javascript_builder
- Or duplicate the helper functions if we want to keep builders independent

### 5. Update Tests (10 min)

Add test cases in:
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.test.ts`

Test scenarios:
- ✅ Exported function has `is_exported = true`
- ✅ Non-exported function has `is_exported = false`
- ✅ Export alias populates `export.export_name`
- ✅ Default export sets `export.is_default = true`
- ✅ Re-export sets `export.is_reexport = true`

## Files Modified

- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.test.ts`
- `packages/core/src/index_single_file/definitions/definition_builder.ts`

## Testing

```bash
npm test -- javascript_builder.test.ts
npm test -- semantic_index.javascript.test.ts
npm test -- semantic_index.typescript.test.ts
```

## Success Criteria

- ✅ `extract_export_info()` correctly identifies exported symbols
- ✅ Export aliases captured in `export.export_name`
- ✅ Default exports marked with `export.is_default`
- ✅ Re-exports marked with `export.is_reexport`
- ✅ All JavaScript/TypeScript tests pass

## Next Task

**task-epic-11.112.23.3** - Python Implementation
