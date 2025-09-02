# Task 11.74.6: Merge Variable Analysis into Scope Tree

## Status: Created
**Priority**: HIGH
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Consolidation

## Summary

Consolidate the `variable_analysis/variable_extraction` module into `scope_analysis/scope_tree` to eliminate duplication. Both modules track variables, but scope_tree is more integrated and comprehensive.

## Context

We have two modules doing similar work:
- `scope_tree`: Tracks all symbols including variables within scopes
- `variable_extraction`: Separately extracts variable declarations

This duplication causes:
- Inconsistent variable tracking
- Redundant AST traversal
- Maintenance burden of two similar codebases
- Confusion about which to use

## Problem Statement

Current duplication:
```typescript
// scope_tree already tracks variables:
scope.symbols.push({ 
  name: "myVar", 
  kind: "variable",
  // ... 
});

// variable_extraction does the same:
variables.push({
  name: "myVar",
  declaration_type: "const",
  // ...
});
```

We're traversing the AST twice to extract essentially the same information.

## Success Criteria

- [ ] Variable extraction functionality merged into scope_tree
- [ ] Single AST traversal for all symbol extraction
- [ ] Variable-specific features preserved (const/let/var distinction)
- [ ] file_analyzer updated to use unified extraction
- [ ] variable_extraction module deleted
- [ ] All tests passing with consolidated module

## Technical Approach

### Migration Strategy

1. **Enhance scope_tree** with variable-specific features
2. **Update consumers** to use scope_tree for variables
3. **Delete variable_extraction** module
4. **Update imports** throughout codebase

### Implementation Steps

1. **Audit unique features in variable_extraction**:
```typescript
// Features to preserve:
- declaration_type (const/let/var/parameter)
- initialization tracking
- destructuring patterns
- hoisting behavior
```

2. **Enhance scope_tree symbols**:
```typescript
// In scope_tree/scope_tree.ts
interface EnhancedSymbol extends Symbol {
  // Existing fields
  name: string;
  kind: SymbolKind;
  location: Location;
  
  // NEW: Variable-specific fields
  declaration_type?: 'const' | 'let' | 'var' | 'parameter';
  is_initialized?: boolean;
  is_hoisted?: boolean;
  destructured_from?: string;
  type_annotation?: TypeInfo;
}
```

3. **Update scope_tree extraction**:
```typescript
function extract_symbols(node: SyntaxNode, context: Context): Symbol[] {
  const symbols = [];
  
  // Existing extraction...
  
  // Enhanced variable extraction
  if (is_variable_declaration(node)) {
    const var_symbols = extract_variable_symbols(node, context);
    symbols.push(...var_symbols);
  }
  
  return symbols;
}

function extract_variable_symbols(
  node: SyntaxNode,
  context: Context
): EnhancedSymbol[] {
  // Port logic from variable_extraction
  const declaration_type = get_declaration_type(node);
  const is_initialized = has_initializer(node);
  
  // Handle destructuring
  if (is_destructuring_pattern(node)) {
    return extract_destructured_variables(node, context);
  }
  
  // Regular variable
  return [{
    name: get_variable_name(node),
    kind: 'variable',
    location: node_to_location(node),
    declaration_type,
    is_initialized,
    is_hoisted: declaration_type === 'var',
    type_annotation: extract_type_annotation(node)
  }];
}
```

4. **Update file_analyzer.ts**:
```typescript
// DELETE Layer 5 entirely
// DELETE: const layer5 = extract_variables(...)

// Update analyze_file to get variables from scope_tree
function analyze_file(file: CodeFile) {
  // ... existing layers ...
  
  // Layer 1 now provides variables too
  const layer1 = analyze_scopes(...);
  const variables = extract_variables_from_scopes(layer1.scopes);
  
  // No more separate variable extraction layer
}

function extract_variables_from_scopes(
  scopes: ScopeTree
): VariableDeclaration[] {
  const variables = [];
  
  for (const scope of scopes.scopes) {
    const scope_vars = scope.symbols.filter(
      s => s.kind === 'variable'
    );
    
    variables.push(...scope_vars.map(v => ({
      name: v.name,
      location: v.location,
      type: v.type_annotation,
      declaration_type: v.declaration_type,
      scope: scope.id
    })));
  }
  
  return variables;
}
```

5. **Delete variable_extraction module**:
```bash
rm -rf packages/core/src/variable_analysis/
```

## Dependencies

- Must preserve all unique variable extraction features
- file_analyzer must be updated simultaneously
- Tests must be migrated to scope_tree

## Testing Requirements

### Migration Tests
```typescript
test("scope_tree extracts all variable types", () => {
  const code = `
    const a = 1;
    let b = 2;
    var c = 3;
    function fn(param) {}
  `;
  
  const scopes = build_scope_tree(...);
  const vars = get_variables_from_scopes(scopes);
  
  expect(vars).toContainEqual({
    name: 'a', declaration_type: 'const'
  });
  expect(vars).toContainEqual({
    name: 'param', declaration_type: 'parameter'
  });
});
```

### Feature Preservation Tests
- Destructuring patterns
- Hoisting behavior
- Type annotations
- Multi-declarations

## Risks

1. **Feature Loss**: Missing variable-specific features
2. **Performance**: Scope_tree might become too complex
3. **Breaking Changes**: Consumers expecting separate variable list

## Implementation Notes

### Features to Migrate

From `variable_extraction.ts`:
- `extract_variable_declarations()` → scope_tree
- Destructuring support → scope_tree
- Declaration type detection → scope_tree
- Type annotation extraction → scope_tree

### Benefits of Consolidation

1. **Single AST traversal** instead of two
2. **Unified symbol tracking** with scope context
3. **Better variable-in-scope detection**
4. **Reduced maintenance burden**
5. **Consistent symbol representation**

## Estimated Effort

- Enhance scope_tree: 0.5 days
- Update file_analyzer: 0.5 days
- Migrate tests: 0.5 days
- Delete and cleanup: 0.5 days
- **Total**: 2 days

## Notes

This consolidation makes sense because variables ARE symbols and should be tracked with other symbols in their scope context. The separate variable_extraction was likely created before scope_tree was comprehensive enough, but now it's redundant. This will also improve performance by eliminating duplicate AST traversal.