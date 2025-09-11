# Task 11.100: CRITICAL - Tree-sitter Query System Completely Disconnected from Scope Analysis

## Critical Issue Summary

**MONUMENTAL ARCHITECTURAL ISSUE DISCOVERED**: The Tree-sitter query files (`.scm` files) in `src/scope_queries/` are completely disconnected from the actual scope analysis implementation. These sophisticated query files are never loaded or used anywhere in production code.

## Current State (BROKEN)

### What Exists But Is Unused

1. **Query Files** in `src/scope_queries/`:
   - `javascript.scm` (13,630 bytes) - Sophisticated scope/definition/reference queries
   - `typescript.scm` (12,351 bytes) - TypeScript-specific patterns
   - `python.scm` (6,754 bytes) - Python scope patterns
   - `rust.scm` (11,265 bytes) - Rust-specific queries

2. **Orphaned Functions**:
   - `load_scope_query()` in `loader.ts` - Never called anywhere
   - Should load `.scm` files and use them with Tree-sitter's Query API

3. **UNUSED Query Executor** in `src/ast/query_executor.ts`:
   - **Complete Query API implementation exists but is never imported!**
   - `execute_query()` - Runs tree-sitter queries
   - `get_captures()` - Extracts specific captures
   - `find_nodes()` - Pattern matching
   - `execute_query_with_predicates()` - Advanced query features
   - This module shows HOW queries should be used, but it's orphaned!

4. **Tree-sitter Query Patterns** define:
   - Scope boundaries (`@local.scope`)
   - Symbol definitions (`@definition.function`, `@definition.class`, etc.)
   - Symbol references (`@reference`)
   - Hoisting patterns (`@hoist.definition`)
   - Import/export patterns

5. **Partial Query Usage** (only in method_override module):
   - `method_override.rust.ts` uses `new Query()` directly
   - `method_override.ts` uses queries for hierarchy detection
   - Shows queries DO work, but only used in one small corner of codebase

### What Is Actually Happening (Manual AST Traversal)

The entire scope analysis system is **manually traversing the AST** instead of using Tree-sitter queries:

1. **`scope_tree/scope_tree.ts`**: 
   - Manually walks AST nodes
   - Uses configuration objects to identify scope-creating nodes
   - ~500+ lines of manual traversal logic

2. **Language-specific files**:
   - `scope_tree.javascript.ts` - Manual JS/JSX handling
   - `scope_tree.typescript.ts` - Manual TS/TSX handling  
   - `scope_tree.python.ts` - Manual Python handling
   - `scope_tree.rust.ts` - Manual Rust handling

3. **Configuration-driven pattern matching**:
   - `language_configs.ts` - Hardcoded node type lists
   - Duplicates patterns already defined in `.scm` files
   - Less powerful than Tree-sitter queries

## Investigation Required

### Phase 1: Understand Current Implementation

1. **Map all manual AST traversal points**:
   - [ ] Document all files doing manual node.type checking
   - [ ] List all hardcoded node type patterns
   - [ ] Identify all scope/symbol extraction logic

2. **Analyze .scm query files**:
   - [ ] Document what each query file captures
   - [ ] Compare with manual implementation coverage
   - [ ] Identify missing functionality in manual approach

3. **Find integration points**:
   - [ ] Where Tree-sitter Parser is created
   - [ ] Where AST traversal begins
   - [ ] Where scope tree is built

### Phase 2: Determine Integration Strategy

1. **Tree-sitter Query API Requirements**:
   ```typescript
   // What SHOULD be happening:
   const querySource = load_scope_query(language);
   const query = new Parser.Query(language, querySource);
   const captures = query.captures(tree.rootNode);
   
   // Process captures to build scope tree
   for (const {name, node} of captures) {
     switch(name) {
       case 'local.scope': // Create scope
       case 'definition.function': // Add function def
       case 'reference': // Track reference
     }
   }
   ```

2. **Migration Path Options**:
   - Option A: Full replacement - Rewrite scope analysis using queries
   - Option B: Hybrid - Use queries for core patterns, manual for edge cases
   - Option C: Gradual - Start with one language, migrate others

## Impact Analysis

### What We're Missing By Not Using Queries

1. **Performance**: 
   - Tree-sitter queries are optimized C++ code
   - Current manual traversal is JavaScript/TypeScript
   - Could be 10-100x faster

2. **Accuracy**:
   - Query patterns are battle-tested
   - Handle edge cases we likely miss
   - More precise pattern matching

3. **Maintainability**:
   - .scm files are declarative and concise
   - Current code is imperative and verbose
   - Easier to add new patterns

4. **Features**:
   - Queries support complex patterns we can't easily express
   - Predicates, alternations, anchoring
   - Field matching and captures

### Affected Systems - WIDESPREAD IMPACT

#### Direct Dependencies (10 modules outside scope_analysis):
1. **file_analyzer.ts** - Core file analysis entry point
2. **call_graph/function_calls** - Function call tracking
3. **symbol_resolution** (5 files) - All symbol resolution logic  
4. **usage_finder** - Finding symbol usages
5. **type_propagation** - Type flow analysis
6. **utils/scope_path_builder** - Scope path utilities

#### Indirect Dependencies (via file_analyzer):
- **code_graph.ts** - Main graph builder (calls file_analyzer)
- **All export modules** - Depend on accurate scopes
- **All import modules** - Need proper symbol resolution
- **Method calls** - Require scope context
- **Constructor calls** - Need class scope info
- **Inheritance modules** - Depend on class hierarchy in scopes

#### Test Impact:
- **47+ non-test references** to ScopeTree outside scope_analysis
- **21 test files** directly import scope_tree functions
- Hundreds of tests depend on scope analysis accuracy

### Ramification Analysis

**THIS IS NOT ISOLATED** - The scope tree is the foundation of the entire codebase analysis:

1. **Central Bottleneck**: `build_scope_tree()` is called by `file_analyzer.ts`, which is the entry point for ALL file analysis

2. **Cascading Performance Impact**: Since file_analyzer processes every file, the 10-100x performance improvement would affect:
   - Initial parsing time
   - Incremental analysis 
   - Memory usage
   - Response time for all queries

3. **Accuracy Ripple Effects**: Better scope analysis would improve:
   - Symbol resolution accuracy
   - Type inference precision
   - Call graph completeness
   - Dead code detection
   - Refactoring safety

4. **API Stability Required**: The ScopeTree interface is used everywhere, so:
   - Must maintain backward compatibility
   - Can't change the data structure
   - Need adapter layer between queries and current API

## Migration Strategy Recommendation

Given the widespread impact, recommend:

1. **DO NOT attempt big-bang replacement** - Too risky with this many dependencies
2. **Create parallel implementation** - New query-based system alongside current one
3. **Gradual migration** - Switch one module at a time with feature flags
4. **Maintain compatibility layer** - Ensure ScopeTree API remains stable

## Implementation Plan

### Step 1: Proof of Concept
- [ ] Create `scope_tree_query.ts` using Tree-sitter queries
- [ ] Test with JavaScript only
- [ ] Compare results with current implementation
- [ ] Benchmark performance difference

### Step 2: Design New Architecture
- [ ] Define capture name conventions
- [ ] Design scope tree builder from captures
- [ ] Plan migration strategy for each language
- [ ] Create compatibility layer for existing API

### Step 3: Implementation
- [ ] Implement query-based scope tree builder
- [ ] Migrate one language at a time
- [ ] Maintain backward compatibility
- [ ] Add comprehensive tests

### Step 4: Migration
- [ ] Replace manual implementation gradually
- [ ] Update all dependent systems
- [ ] Remove old manual traversal code
- [ ] Delete redundant configuration

## Files to Investigate

### Currently Unused (Should Be Core)
- `/src/scope_queries/*.scm` - Query definitions
- `/src/scope_queries/loader.ts` - Query loader

### Currently Used (Should Be Replaced)
- `/src/scope_analysis/scope_tree/scope_tree.ts` - Manual traversal
- `/src/scope_analysis/scope_tree/scope_tree.*.ts` - Language-specific
- `/src/scope_analysis/scope_tree/language_configs.ts` - Hardcoded patterns

### Entry Points
- `/src/code_graph.ts` - Main consumer
- `/src/scope_analysis/scope_tree/index.ts` - Current API

## Priority

**CRITICAL** - This is a fundamental architectural issue that affects:
- Performance of entire codebase analysis
- Accuracy of scope/symbol resolution
- Maintainability of the project
- Feature completeness

## Estimated Effort

- Investigation: 2-3 days
- Design: 2-3 days  
- Implementation: 5-10 days
- Testing/Migration: 5-10 days
- **Total: 2-4 weeks**

## Dependencies

- Must understand Tree-sitter Query API
- Need to maintain backward compatibility
- Should coordinate with any active scope analysis work

## Success Criteria

- [ ] All .scm query files are loaded and used
- [ ] Scope analysis uses Tree-sitter queries not manual traversal
- [ ] Performance improves by at least 5x
- [ ] No regression in functionality
- [ ] Code reduction of at least 50% in scope analysis

## Evidence of Query Sophistication

Example from `javascript.scm` showing complexity we're missing:

```scheme
;; Handles edge case: assignments inside sequence expressions
;; const a = 2;
;; throw f = 1, f, a;
;; 
;; Correctly produces:
;; {
;;   defs: [ a ],
;;   scopes [{
;;      defs: [ f ],
;;      refs: [ f, a ]
;;   }],
;; }
(sequence_expression) @local.scope
```

Our manual traversal almost certainly doesn't handle this level of nuance!

## Root Cause Analysis

This represents a **fundamental architectural debt** that has accumulated. The fact that sophisticated query files exist but are completely unused suggests either:

1. **Incomplete migration**: Started converting to queries but never finished
2. **Abandoned refactoring**: Changed approach but left old files
3. **Parallel development**: Two approaches developed but never integrated
4. **Knowledge loss**: Original implementer left, knowledge not transferred

## Critical Discovery Credit

This issue was discovered by user during code review on 2025-09-11, revealing that months/years of development have been operating on a fundamentally flawed architecture.

This MUST be fixed for the project to reach its full potential.