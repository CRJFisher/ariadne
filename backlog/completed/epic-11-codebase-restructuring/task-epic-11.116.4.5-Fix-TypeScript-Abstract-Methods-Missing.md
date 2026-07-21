# Task epic-11.116.4.5: Fix TypeScript Abstract Methods Missing from Classes

**Status:** Completed
**Parent:** task-epic-11.116.4
**Priority:** Medium (Feature gap - affects API/contract understanding)
**Created:** 2025-10-15

## Overview

Abstract methods declared in TypeScript abstract classes are not being captured in the semantic index. The methods appear neither in the `methods` array nor flagged as abstract anywhere.

## Problem Description

**Observed in:** `typescript/semantic_index/classes/inheritance.json`

**Source code:**
```typescript
abstract class Animal {
  constructor(public name: string) {}
  
  abstract makeSound(): string;  // <-- This method is missing!
  
  move(distance: number = 0): void {
    console.log(`${this.name} moved ${distance} meters`);
  }
}
```

**Current fixture output:**
```json
{
  "Animal": {
    "methods": [
      {"name": "constructor", "abstract": false},
      {"name": "move", "abstract": false}
    ]
  }
}
```

**Expected fixture output:**
```json
{
  "Animal": {
    "methods": [
      {"name": "constructor", "abstract": false},
      {"name": "makeSound", "abstract": true},
      {"name": "move", "abstract": false}
    ]
  }
}
```

## Impact

- **Medium severity**: Abstract methods define the contract/interface that subclasses must implement
- Makes it impossible to validate that subclasses implement required abstract methods
- Affects understanding of class APIs and inheritance contracts
- Could cause confusion when analyzing polymorphic call sites

## Root Cause

Likely in `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`:
- Abstract method declarations may not be captured by tree-sitter queries
- OR they're captured but filtered out somewhere
- OR the definition builder doesn't handle method signatures without bodies

Tree-sitter node for abstract methods:
```
(method_signature  ; Abstract method declaration
  name: (property_identifier)
  parameters: (formal_parameters)
  return_type: (type_annotation)?
)
```

vs regular methods:
```
(method_definition  ; Concrete method with body
  name: (property_identifier)
  parameters: (formal_parameters)
  body: (statement_block)
)
```

## Proposed Fix

1. Add tree-sitter query to capture `method_signature` nodes (abstract methods)
2. Process these as MethodDefinition with `abstract: true` flag
3. Ensure they don't require a body_scope_id (abstract methods have no body)
4. Test with interfaces too (interface methods are also method_signatures)

**Note:** Need to distinguish between:
- Abstract class method signatures (should be in class methods)
- Interface method signatures (already handled separately?)

## Testing

1. Regenerate `typescript/semantic_index/classes/inheritance.json`
2. Verify Animal.methods includes `makeSound` with `abstract: true`
3. Test with multiple abstract methods
4. Ensure concrete method implementations in subclasses are NOT marked abstract
5. Verify interface method signatures still work correctly

## Success Criteria

- ✅ Abstract methods appear in class `methods` array
- ✅ Abstract methods have `abstract: true` flag
- ✅ Abstract methods have no `body_scope_id` (or it's undefined)
- ✅ Concrete implementations in subclasses have `abstract: false`
- ✅ No regression in interface method signature handling

## Estimated Effort

**2-3 hours**

- 1 hour: Add tree-sitter query for method_signature
- 1 hour: Process abstract methods in builder
- 0.5-1 hour: Test and handle edge cases

## Related

- May need to coordinate with interface handling
- Abstract class flag is also not being captured (separate issue?)

## Implementation Notes

**Completed:** 2025-10-15

### Root Cause Identified

The issue was that abstract methods in TypeScript use a different tree-sitter node type than regular methods:
- Regular methods: `method_definition`
- Abstract methods: `abstract_method_signature`

The query was only capturing `method_definition` nodes, so abstract methods were not being indexed.

### Changes Made

1. **Updated typescript.scm query** ([typescript.scm:397-415](packages/core/src/index_single_file/query_code_tree/queries/typescript.scm#L397-L415))
   - Added capture patterns for `abstract_method_signature` nodes
   - Handles both `abstract_class_declaration` and `class_declaration` (for flexibility)
   - Tagged as `@definition.method.abstract` to distinguish from regular methods

2. **Added handler in typescript_builder_config.ts** ([typescript_builder_config.ts:466-496](packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts#L466-L496))
   - New handler for `definition.method.abstract`
   - Sets `abstract: true` flag
   - Sets `async: false` (abstract methods cannot be async)
   - Extracts return type and generics like regular methods
   - Does not create body scope (abstract methods have no implementation)

### Testing

Verified with `typescript/semantic_index/classes/inheritance.json`:

```json
{
  "Animal": {
    "methods": [
      {"name": "makeSound", "abstract": true, "return_type": "string"},
      {"name": "move", "abstract": false, "return_type": "void"}
    ]
  }
}
```

**Success criteria met:**
- ✅ Abstract methods appear in class `methods` array
- ✅ Abstract methods have `abstract: true` flag
- ✅ Return types captured correctly
- ✅ Concrete implementations in subclasses have `abstract: false`

### Key Learning

Tree-sitter TypeScript uses specific node types for abstract syntax:
- `abstract_class_declaration` for abstract classes
- `abstract_method_signature` for abstract methods

Always verify actual tree-sitter node types when working with language-specific features.
