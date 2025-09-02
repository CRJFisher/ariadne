# Task 11.74.7: Merge Definition Finder into Symbol Resolution

## Status: Created
**Priority**: HIGH
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Consolidation

## Summary

Consolidate the `scope_analysis/definition_finder` module into `scope_analysis/symbol_resolution` to eliminate significant duplication. Both modules find definitions, but symbol_resolution is already wired and more comprehensive.

## Context

We have two modules with overlapping functionality:
- `symbol_resolution`: Finds symbols and their definitions (wired, Layer 8-9)
- `definition_finder`: Finds definitions with scope context (not wired)

This causes:
- Redundant definition-finding logic
- Confusion about which API to use
- Maintenance burden of similar codebases
- Inconsistent results between modules

## Problem Statement

Both modules solve the same problem:
```typescript
// symbol_resolution:
const definition = find_symbol_definition(symbol, context);

// definition_finder:
const definition = find_definition_for_symbol(symbol, context);
```

The definition_finder module adds some language-specific enhancements, but these should be part of symbol_resolution.

## Success Criteria

- [ ] Definition finder features merged into symbol_resolution
- [ ] Language-specific enhancements preserved
- [ ] Go-to-definition functionality integrated
- [ ] Hoisting and special JS features preserved
- [ ] definition_finder module deleted
- [ ] All types migrated to use @ariadnejs/types shared types
- [ ] Duplicate type definitions removed and consolidated
- [ ] All consumers updated to use symbol_resolution

## Technical Approach

### Migration Strategy

1. **Audit unique features** in definition_finder
2. **Enhance symbol_resolution** with these features
3. **Update all imports** to use symbol_resolution
4. **Delete definition_finder** module

### Implementation Steps

1. **Identify unique features to preserve**:
```typescript
// From definition_finder:
- go_to_definition_from_ref()
- find_constructor_definition()
- find_prototype_method()
- find_object_property()
- find_arrow_function()
- is_hoisted_definition()
- JavaScript-specific enhancements
```

2. **Enhance symbol_resolution with features**:
```typescript
// In symbol_resolution/symbol_resolution.ts

// Add JavaScript-specific features
export {
  // Existing exports...
  
  // NEW: Merged from definition_finder
  go_to_definition,
  find_constructor_definition,
  find_prototype_method,
  is_hoisted_definition
};

// Add go-to-definition functionality
export function go_to_definition(
  position: Position,
  context: ResolutionContext
): SymbolDefinition | null {
  // Find symbol at position
  const symbol = find_symbol_at_position(position, context);
  if (!symbol) return null;
  
  // Resolve to definition
  const definition = resolve_symbol(symbol, context);
  
  // Apply language-specific enhancements
  if (context.language === 'javascript') {
    return enhance_javascript_definition(definition, context);
  }
  
  return definition;
}

// Port JavaScript enhancements
function enhance_javascript_definition(
  definition: SymbolDefinition,
  context: ResolutionContext
): SymbolDefinition {
  // Check for hoisting
  if (is_hoisted_definition(definition)) {
    definition.is_hoisted = true;
  }
  
  // Check for prototype methods
  if (is_prototype_method(definition)) {
    definition.is_prototype = true;
  }
  
  // Handle constructor functions
  if (is_constructor_function(definition)) {
    definition.kind = 'constructor';
  }
  
  return definition;
}
```

3. **Update language-specific dispatchers**:
```typescript
// In symbol_resolution/index.ts

import {
  // Port JavaScript-specific imports
  find_constructor_definition as js_find_constructor,
  find_prototype_method as js_find_prototype,
  find_object_property as js_find_property,
  find_arrow_function as js_find_arrow,
  is_hoisted_definition as js_is_hoisted
} from './symbol_resolution.javascript';

// Update dispatcher to include new features
export function find_definition_with_language(
  symbol: string,
  context: ResolutionContext
): SymbolDefinition | null {
  const base_definition = find_symbol_definition(symbol, context);
  
  // Apply language-specific enhancements
  switch (context.language) {
    case 'javascript':
    case 'typescript':
      return enhance_javascript_definition(base_definition, context);
    case 'python':
      return enhance_python_definition(base_definition, context);
    case 'rust':
      return enhance_rust_definition(base_definition, context);
    default:
      return base_definition;
  }
}
```

4. **Migrate JavaScript-specific file**:
```typescript
// Move content from definition_finder.javascript.ts
// to symbol_resolution.javascript.ts

// Merge unique functions
export function find_constructor_definition(
  node: SyntaxNode,
  context: JavaScriptResolutionContext
): SymbolDefinition | null {
  // Implementation from definition_finder
}

export function find_prototype_method(
  className: string,
  methodName: string,
  context: JavaScriptResolutionContext
): SymbolDefinition | null {
  // Implementation from definition_finder
}
```

5. **Update all imports**:
```bash
# Find all imports of definition_finder
grep -r "definition_finder" packages/

# Update to use symbol_resolution
sed -i 's/definition_finder/symbol_resolution/g' packages/**/*.ts
```

6. **Delete definition_finder**:
```bash
rm -rf packages/core/src/scope_analysis/definition_finder/
```

## Type Review Requirements

### CRITICAL: Use Shared Types from @ariadnejs/types

During consolidation, review ALL type definitions to ensure:

1. **Use shared types** from `@ariadnejs/types` package:
   - `SymbolDefinition`, `ResolvedSymbol`, `SymbolKind`
   - `ResolutionContext`, `Position`, `Location`
   - `Def`, `Ref` (if still used)
   - Any other types that exist in the shared package

2. **Remove duplicate definitions**:
   - Both modules likely have overlapping type definitions
   - Use shared types for the consolidated module
   - Delete all redundant type definitions

3. **Type migration checklist**:
   - [ ] Audit symbol_resolution types - use `@ariadnejs/types` where possible
   - [ ] Audit definition_finder types before deletion
   - [ ] Ensure `DefinitionResult` uses shared types or is added to shared
   - [ ] Verify `ResolutionContext` uses shared base types
   - [ ] Remove any ad-hoc type definitions that should be shared

4. **Common duplications to watch for**:
   - `SymbolDefinition`, `SymbolKind` - use shared
   - `Position`, `Location`, `Range` - use shared
   - `ResolutionContext`, `DefinitionContext` - consolidate and use shared
   - Custom definition-related types that might already exist

### Example Migration

```typescript
// BEFORE: Two different definition types
// symbol_resolution: interface SymbolDefinition { ... }
// definition_finder: interface DefinitionResult { ... }

// AFTER: Use shared type
import { SymbolDefinition, ResolvedSymbol } from '@ariadnejs/types';
// Consolidate functionality into shared types
```

## Dependencies

- Must preserve all language-specific features
- Go-to-definition API must be maintained
- JavaScript hoisting logic must work

## Testing Requirements

### Feature Preservation Tests
```typescript
test("finds hoisted function definitions", () => {
  const code = `
    console.log(hoisted());  // Usage before declaration
    
    function hoisted() {  // Hoisted definition
      return "value";
    }
  `;
  
  const def = go_to_definition(position_of_call, context);
  expect(def.is_hoisted).toBe(true);
  expect(def.location).toEqual(position_of_function);
});

test("finds prototype methods", () => {
  const code = `
    MyClass.prototype.method = function() {};
    const instance = new MyClass();
    instance.method();  // Should find prototype definition
  `;
  
  const def = go_to_definition(position_of_call, context);
  expect(def.is_prototype).toBe(true);
});
```

### Migration Tests
- All existing definition_finder tests moved to symbol_resolution
- Verify identical results for same inputs
- Test language-specific enhancements

## Risks

1. **API Changes**: Consumers might expect specific APIs
2. **Feature Loss**: Missing JavaScript-specific logic
3. **Performance**: Combined module might be slower

## Implementation Notes

### Functions to Migrate

Core functions:
- `find_definition_at_position()` → merge with `resolve_symbol_at_position()`
- `find_all_definitions()` → merge with `get_all_symbol_definitions()`
- `go_to_definition_from_ref()` → new `go_to_definition()`

JavaScript-specific:
- `find_constructor_definition()` → preserve in .javascript file
- `find_prototype_method()` → preserve in .javascript file
- `is_hoisted_definition()` → preserve as utility

### Benefits of Consolidation

1. **Single source of truth** for definition finding
2. **Consistent API** across the codebase
3. **Better cross-file resolution** (symbol_resolution is wired)
4. **Reduced code duplication**
5. **Clearer module boundaries**

## Estimated Effort

- Audit and plan: 0.5 days
- Merge core functionality: 0.5 days
- Migrate JavaScript features: 0.5 days
- Update imports and tests: 0.5 days
- **Total**: 2 days

## Notes

This consolidation is critical because having two definition-finding modules creates confusion and maintenance burden. The symbol_resolution module is already wired into the pipeline and handles cross-file resolution, making it the natural home for all definition-finding logic. The language-specific enhancements from definition_finder should be preserved but integrated into the symbol_resolution architecture.