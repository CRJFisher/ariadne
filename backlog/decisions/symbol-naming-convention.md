# Symbol Naming Convention

**Date**: 2025-07-18  
**Status**: Accepted  
**Author**: Assistant  
**Related Tasks**: task-40  

## Context

RefScope needs a consistent way to uniquely identify symbols across the entire codebase. This is critical for:
- Building accurate call graphs
- Avoiding symbol name collisions
- Cross-file symbol resolution
- Clear API responses

## Decision

Adopt a hierarchical symbol naming scheme using the format: `<module_path>#<symbol_name>`

### Format Specification

```
<module_path>#<symbol_name>
```

Where:
- `<module_path>`: Normalized file path without extension
- `#`: Separator character
- `<symbol_name>`: The symbol's local name, potentially qualified for nested symbols

### Examples

```
src/utils/helpers#process_data
src/components/Button#render
src/models/User#User.validate
tests/test_utils#test_process_data
```

## Detailed Rules

### 1. Module Path Normalization

- Use forward slashes (`/`) on all platforms
- Remove file extension
- Use relative path from project root
- No leading slash

```typescript
// Input: /Users/chuck/project/src/utils/helpers.ts
// Output: src/utils/helpers
```

### 2. Nested Symbol Handling

For symbols nested within other symbols (e.g., methods in classes):

```
<module_path>#<container>.<symbol>
```

Examples:
- Class method: `src/models/User#User.validate`
- Nested function: `src/utils/helpers#process_data.normalize`
- Static method: `src/models/User#User.fromJSON`

### 3. Special Cases

#### Anonymous Functions
Use position-based naming:
```
src/utils/helpers#<anonymous_line_42_col_10>
```

#### Lambdas/Arrow Functions
If assigned to a variable, use the variable name:
```
src/utils/helpers#processCallback
```

If inline, use position:
```
src/utils/helpers#<arrow_line_15_col_20>
```

#### Constructors
Use the class name:
```
src/models/User#User
```

## Implementation Strategy

### 1. Core Functions

```typescript
/**
 * Generate a unique symbol identifier.
 */
export function get_symbol_id(def: Def): string {
  const module_path = normalize_module_path(def.file_path);
  const symbol_name = get_qualified_name(def);
  return `${module_path}#${symbol_name}`;
}

/**
 * Parse a symbol ID into its components.
 */
export function parse_symbol_id(symbol_id: string): {
  module_path: string;
  symbol_name: string;
} {
  const [module_path, ...name_parts] = symbol_id.split('#');
  return {
    module_path,
    symbol_name: name_parts.join('#') // Handle edge case of # in name
  };
}
```

### 2. Module Path Normalization

```typescript
export function normalize_module_path(file_path: string): string {
  // Remove extension
  const without_ext = file_path.replace(/\.[^/.]+$/, '');
  
  // Normalize slashes to forward slashes
  const normalized = without_ext.replace(/\\/g, '/');
  
  // Remove leading slash if present
  return normalized.replace(/^\//, '');
}
```

### 3. Qualified Name Generation

```typescript
export function get_qualified_name(def: Def): string {
  // For methods, include the class name
  if (def.metadata?.class_name) {
    return `${def.metadata.class_name}.${def.name}`;
  }
  
  // For anonymous functions, use position
  if (def.name === '<anonymous>' || !def.name) {
    return `<anonymous_line_${def.range.start.row}_col_${def.range.start.column}>`;
  }
  
  return def.name;
}
```

## Language-Specific Considerations

### TypeScript/JavaScript
- Handle default exports: `src/components/Button#default`
- Handle named exports normally
- Destructured imports maintain original names

### Python
- Handle `__init__` methods as constructors
- Private methods (`_method`) maintain underscore
- Magic methods (`__str__`) maintain double underscore

### Rust
- Handle module paths: `src/lib#module::function`
- Trait implementations: `src/types#Type::trait::method`

## Benefits

1. **Uniqueness**: Every symbol has a globally unique identifier
2. **Readability**: IDs are human-readable and meaningful
3. **Consistency**: Same format across all languages
4. **Parseable**: Easy to extract components programmatically
5. **Stable**: IDs remain consistent across runs

## Migration Plan

1. Add new symbol ID generation functions
2. Update CallGraphNode to use symbol IDs
3. Update call graph construction to use new IDs
4. Add backward compatibility layer if needed

## Future Considerations

- May need to handle generics/templates
- Consider versioning for symbols that change over time
- May need escaping for special characters in names