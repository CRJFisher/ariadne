# Task 11.100.1: Transform scope_tree to Tree-sitter Queries

## Parent Task
11.100 - Transform Entire Codebase to Tree-sitter Query System

## Module Overview
**Location**: `src/scope_analysis/scope_tree/`
**Files**: 7 files (~2,500 lines)
- `scope_tree.ts` - Generic processor
- `scope_tree.javascript.ts` - JS-specific  
- `scope_tree.typescript.ts` - TS-specific
- `scope_tree.python.ts` - Python-specific
- `scope_tree.rust.ts` - Rust-specific
- `language_configs.ts` - Configuration
- `index.ts` - Public API

## Current Implementation

### Manual Traversal Pattern
```typescript
function visit_node(node: SyntaxNode, context: ScopeContext) {
  // Check if node creates scope
  if (creates_scope(node.type, context.language)) {
    const scope = create_scope_node(node, context);
    // ... add to tree
  }
  
  // Check for symbol definitions
  if (is_definition(node.type, context.language)) {
    const symbol = extract_symbol(node, context);
    // ... add to current scope
  }
  
  // Recursively visit children
  for (let i = 0; i < node.childCount; i++) {
    visit_node(node.child(i)!, context);
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern
```scheme
;; scope_queries/scopes.scm

;; JavaScript/TypeScript scopes
(function_declaration) @scope.function
(function_expression) @scope.function
(arrow_function) @scope.arrow
(class_body) @scope.class
(block_statement) @scope.block
(for_statement) @scope.loop
(catch_clause) @scope.catch

;; Symbol definitions
(variable_declarator 
  name: (identifier) @definition.variable)

(function_declaration
  name: (identifier) @definition.function)

(class_declaration
  name: (identifier) @definition.class)

(method_definition
  key: (property_identifier) @definition.method)

;; Hoisted symbols
(function_declaration
  name: (identifier) @definition.hoisted)

(var_statement
  (variable_declarator 
    name: (identifier) @definition.hoisted))
```

### New Implementation Structure
```typescript
export function build_scope_tree_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): ScopeTree {
  // Load scope queries
  const querySource = load_scope_query(language);
  const query = new Parser.Query(parser.getLanguage(), querySource);
  
  // Execute query
  const captures = query.captures(tree.rootNode);
  
  // Build scope tree from captures
  const scopeTree = create_empty_scope_tree();
  const scopeStack: ScopeId[] = [scopeTree.root_id];
  
  for (const capture of captures) {
    const [category, type] = capture.name.split('.');
    
    switch (category) {
      case 'scope':
        handleScopeCapture(capture, scopeTree, scopeStack);
        break;
      case 'definition':
        handleDefinitionCapture(capture, scopeTree, scopeStack);
        break;
    }
  }
  
  return scopeTree;
}
```

## Transformation Steps

### 1. Extract Patterns
- [ ] Document all node types that create scopes
- [ ] Document all symbol definition patterns
- [ ] Document hoisting rules
- [ ] Document special cases (closures, etc.)

### 2. Create Query Files
- [ ] Extend existing `scope_queries/*.scm` files
- [ ] Add scope patterns for all languages
- [ ] Add symbol definition patterns
- [ ] Add metadata capture patterns

### 3. Build Query Processor
- [ ] Create `scope_tree_query.ts` 
- [ ] Implement capture handlers
- [ ] Build scope hierarchy from captures
- [ ] Extract symbol metadata

### 4. Validation
- [ ] Run both implementations in parallel
- [ ] Compare scope trees for differences
- [ ] Validate all symbols found
- [ ] Check scope nesting correctness

### 5. Migration
- [ ] Add feature flag for query mode
- [ ] Update tests to use both modes
- [ ] Performance benchmark
- [ ] Switch to query mode by default

## Expected Improvements

### Code Reduction
- **Before**: ~2,500 lines across 7 files
- **After**: ~300 lines + queries
- **Reduction**: 88%

### Performance
- **Before**: Recursive JS traversal
- **After**: Single-pass C++ query
- **Expected**: 10-20x faster

### Accuracy
- Query patterns handle edge cases we likely miss
- Consistent scope detection across languages

## Dependencies
- Existing `.scm` files in `scope_queries/`
- `query_executor.ts` utilities
- Parser instances for each language

## Success Criteria
- [ ] Identical ScopeTree output
- [ ] All tests pass without modification
- [ ] 10x performance improvement
- [ ] 80%+ code reduction