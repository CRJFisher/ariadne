# Task 11.100.14: Refactor return_type_inference

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Module Overview

**Location**: `packages/core/src/type_analysis/return_type_inference/`
**Main File**: `return_type_inference.ts`

## Return Type Creation

Use functions from `type_analysis_types.ts`:

```typescript
const returnType = createObjectType({
  properties: new Map([
    ['value', createPrimitiveType(toTypeName('number'))],
    ['success', createPrimitiveType(toTypeName('boolean'))]
  ]),
  language: 'javascript'
});

// Map function symbol to its return type
returnTypes.set(
  toSymbolId('functionName'),
  returnType
);
```

## Implementation Details

### Function Signature

```typescript
export function infer_return_types(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Map<SymbolId, TypeDefinition>
```

### Key Requirements

- Use SymbolId for function identifiers
- Return TypeDefinition objects
- Support all languages (JavaScript, TypeScript, Python, Rust)
- Implement using tree-sitter queries

### Type Definition Structure

TypeDefinition objects should include:
- `id`: SymbolId of the type
- `name`: SymbolName of the type
- `kind`: ResolvedTypeKind (e.g., 'primitive', 'class', 'interface')
- `type_expression`: TypeExpression for complex types
- `is_nullable`: boolean flag for nullable types
- `is_optional`: boolean flag for optional types

## Success Criteria

- [ ] Function returns Map<SymbolId, TypeDefinition>
- [ ] All language tests pass
- [ ] Query-based implementation
- [ ] TypeScript compilation succeeds