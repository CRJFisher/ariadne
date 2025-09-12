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
    const [category, type] = capture.name.split(".");

    switch (category) {
      case "scope":
        handleScopeCapture(capture, scopeTree, scopeStack);
        break;
      case "definition":
        handleDefinitionCapture(capture, scopeTree, scopeStack);
        break;
    }
  }

  return scopeTree;
}
```

## Transformation Steps

### 0. Migrate Functions from file_analyzer.ts

**IMPORTANT**: The function `extract_variables_from_scopes` (lines 512-545 in file_analyzer.ts) should be moved to `scope_tree.ts` as part of this transformation. This function:
- Iterates through all scopes in the scope tree
- Extracts variable symbols from each scope
- Converts scope symbols to VariableDeclaration format

This should become an exported helper function from the module after conversion to queries.

### 1. Extract Patterns

- [ ] Document all node types that create scopes
- [ ] Document all symbol definition patterns
- [ ] Document hoisting rules
- [ ] Document special cases (closures, etc.)

### 2. Migrate Existing Query Files

**SPECIAL CASE**: scope_tree already has sophisticated `.scm` files in `scope_queries/`

- [ ] **Move existing query files** from `scope_queries/` to `src/scope_analysis/scope_tree/queries/`:

  - `scope_queries/javascript.scm` → `src/scope_analysis/scope_tree/queries/javascript.scm`
  - `scope_queries/typescript.scm` → `src/scope_analysis/scope_tree/queries/typescript.scm`
  - `scope_queries/python.scm` → `src/scope_analysis/scope_tree/queries/python.scm`
  - `scope_queries/rust.scm` → `src/scope_analysis/scope_tree/queries/rust.scm`
  - (Any other language files found)

- [ ] **Update query loader** to use new file locations
- [ ] **Preserve existing sophisticated patterns** - these files are already well-developed
- [ ] **Extend if needed** for any missing scope or symbol patterns
- [ ] **Validate all moved files** work with current Tree-sitter versions

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

### 5. Test Overhaul (Critical)

- [ ] **Audit all existing tests** in `scope_tree.test.ts` and related files
- [ ] **Add comprehensive query-specific tests**:
  - Query file loading and parsing
  - Capture processing correctness
  - Language-specific scope detection
  - Symbol definition extraction
  - Hoisting behavior validation
  - Error handling for malformed queries
- [ ] **Cross-language consistency tests**:
  - Same logical constructs produce equivalent scopes across languages
  - Symbol definitions consistent across language variants
- [ ] **Performance regression tests**:
  - Benchmark old vs new implementation
  - Memory usage validation
  - Large file handling tests
- [ ] **Integration tests**:
  - Test with real codebases
  - Validate with complex nested scopes
  - Test edge cases and error conditions
- [ ] **Achieve 100% test coverage** - no exceptions
- [ ] **All tests must pass** before task completion

### 6. TypeScript Compliance (Critical)

- [ ] **Fix all TypeScript compiler errors**:
  - Run `npx tsc --noEmit` on module files
  - Run `npx tsc --noEmit` on test files
  - Address all type errors, warnings, and issues
- [ ] **Type safety validation**:
  - Proper typing for all query result processing
  - Type guards for runtime type checking
  - Generic type parameters properly constrained
- [ ] **Strict mode compliance**:
  - Enable and pass `--strict` mode
  - No `any` types without explicit justification
  - Proper null/undefined handling
- [ ] **Import/export validation**:
  - All module imports resolve correctly
  - Public API exports properly typed
  - No circular dependency issues

### 7. Migration and Validation

- [ ] Add feature flag for query mode
- [ ] Run both implementations in parallel initially
- [ ] Performance benchmark and comparison
- [ ] Switch to query mode by default after validation

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

**ALL CRITERIA MUST BE MET:**

### Functional Requirements

- [ ] Identical ScopeTree output compared to current implementation
- [ ] All existing functionality preserved
- [ ] No regressions in scope detection accuracy
- [ ] Language-specific patterns work correctly

### Quality Requirements

- [ ] **100% test coverage achieved**
- [ ] **All tests passing** (old and new)
- [ ] **Zero TypeScript compiler errors** (`npx tsc --noEmit`)
- [ ] **Full --strict mode compliance**
- [ ] Code review approval from team

### Performance Requirements

- [ ] 10x+ performance improvement demonstrated
- [ ] Memory usage improvement or neutral
- [ ] No performance regressions on large files

### Architecture Requirements

- [ ] 80%+ code reduction achieved
- [ ] Query files properly organized and documented
- [ ] Integration with refined type system
- [ ] Follows updated architectural guidelines
