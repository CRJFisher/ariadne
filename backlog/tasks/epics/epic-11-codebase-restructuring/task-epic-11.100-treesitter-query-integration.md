# Task 11.100: Integrate Tree-sitter Query System for Scope Analysis

## Executive Summary

Tree-sitter query files (`.scm`) containing sophisticated scope analysis patterns exist but are completely unused. The entire scope analysis system uses manual AST traversal instead. This represents a massive missed opportunity for 10-100x performance improvement with no external API changes required.

## The Discovery

On 2025-09-11, user discovered that:
- 4 query files totaling ~44KB of sophisticated patterns exist in `src/scope_queries/`
- `load_scope_query()` function exists but is never called
- `query_executor.ts` has a complete Query API implementation that's never imported
- Entire scope analysis manually traverses AST instead of using optimized queries

## Current State

### Unused Assets
1. **Query Files** (`src/scope_queries/`):
   - `javascript.scm` (13,630 bytes)
   - `typescript.scm` (12,351 bytes)
   - `python.scm` (6,754 bytes)
   - `rust.scm` (11,265 bytes)

2. **Orphaned Code**:
   - `load_scope_query()` - Never called
   - `query_executor.ts` - Complete implementation, never imported

3. **Manual Implementation** (`scope_analysis/scope_tree/`):
   - ~2000+ lines of manual AST traversal
   - Language-specific files with hardcoded patterns
   - Configuration-driven but still manual node checking

### Example: What We're Missing

The `.scm` files handle sophisticated edge cases like:

```scheme
;; Handles assignments inside sequence expressions
;; const a = 2; throw f = 1, f, a;
(sequence_expression) @local.scope
```

Our manual traversal almost certainly doesn't catch this level of nuance.

## Why This Can Be Isolated

**Key Insight**: The ScopeTree output interface is stable and well-defined in `@ariadnejs/types`. We're only changing HOW we build it, not WHAT it contains.

### The Interface Contract

```typescript
interface ScopeTree {
  readonly root_id: ScopeId;
  readonly nodes: ReadonlyMap<ScopeId, ScopeNode>;
  readonly file_path?: string;
}
```

This structure remains identical regardless of implementation.

### What Changes vs What Doesn't

**Changes (Internal Only)**:
- FROM: `if (node.type === 'function_declaration')` checks
- TO: `(function_declaration) @scope` queries
- Implementation files in `scope_tree/` module

**Doesn't Change**:
- `build_scope_tree()` function signature
- ScopeTree output structure
- All consuming modules (10+ direct dependencies)
- Any external APIs

## Implementation Strategy

### Phase 1: Build Query-Based Implementation

1. Create `scope_tree_query.ts` as drop-in replacement
2. Load `.scm` files using existing `load_scope_query()`
3. Use `query_executor.ts` utilities (already exist!)
4. Build ScopeTree from query captures:

```typescript
const querySource = load_scope_query(language);
const query = new Parser.Query(language, querySource);
const captures = query.captures(tree.rootNode);

for (const {name, node} of captures) {
  switch(name) {
    case 'local.scope': createScope(node);
    case 'definition.function': addSymbol(node);
    // etc.
  }
}
```

### Phase 2: Validation

1. **Shadow Mode**: Run both implementations in parallel
2. **Differential Testing**: Compare outputs on real codebases
3. **Performance Benchmarking**: Measure speed improvement
4. **Edge Case Testing**: Verify sophisticated patterns work

### Phase 3: Migration

1. **Feature Flag**: Add switch between implementations
2. **Gradual Rollout**: Test in production gradually
3. **Single Switch**: Once validated, make one-line change
4. **Cleanup**: Remove manual implementation

## Expected Benefits

### Performance
- **10-100x faster**: C++ query engine vs JavaScript traversal
- **Lower memory**: No recursive JavaScript call stacks
- **Better caching**: Query results can be memoized

### Accuracy
- **Edge cases handled**: Queries catch patterns we miss
- **Battle-tested patterns**: Tree-sitter queries are widely used
- **Consistent behavior**: Declarative patterns reduce bugs

### Maintainability
- **Code reduction**: ~50-70% less code
- **Declarative patterns**: Easier to understand and modify
- **Single source of truth**: Patterns in `.scm` files only

## Risk Assessment

### Low Risk Because:
1. **No API changes**: Pure internal implementation swap
2. **Existing code works**: Can fallback anytime
3. **Gradual migration**: Can validate extensively
4. **Well-defined interface**: ScopeTree structure is stable

### Potential Challenges:
1. **Scope ID stability**: Tests might expect specific IDs
2. **Discovery differences**: Queries might find more/fewer scopes
3. **Metadata completeness**: Ensuring all fields populated
4. **Performance characteristics**: Different memory patterns

## Success Criteria

- [ ] Query-based implementation returns identical ScopeTree structure
- [ ] All existing tests pass without modification
- [ ] Performance improves by at least 5x
- [ ] No changes required in consuming modules
- [ ] Edge cases from `.scm` files are properly handled

## Priority

**HIGH** - This is low-risk, high-reward:
- Massive performance improvement
- No breaking changes
- Implementation already partially exists
- Can be done in isolation

## Estimated Effort

- Investigation: ✅ Complete
- Implementation: 3-5 days
- Testing/Validation: 3-5 days
- Migration: 1-2 days
- **Total: 1-2 weeks**

## Files Involved

### To Use (Currently Orphaned):
- `/src/scope_queries/*.scm` - Query patterns
- `/src/scope_queries/loader.ts` - Query loader
- `/src/ast/query_executor.ts` - Query execution utilities

### To Replace (Eventually):
- `/src/scope_analysis/scope_tree/scope_tree.ts` - Manual traversal
- `/src/scope_analysis/scope_tree/scope_tree.*.ts` - Language-specific
- `/src/scope_analysis/scope_tree/language_configs.ts` - Hardcoded patterns

### Entry Point (No Changes):
- `/src/scope_analysis/scope_tree/index.ts` - Public API

## Conclusion

This is a rare opportunity for massive performance improvement with zero breaking changes. The implementation is straightforward because:

1. Query files already exist
2. Query executor already exists
3. Output interface is stable
4. Can be done in complete isolation

The fact that this sophisticated infrastructure exists but is unused represents technical debt that, when resolved, will benefit the entire codebase's performance without any external changes required.