# Task 11.100.0.5.27: Replace AST Processing Modules with Stubs

## Status
Status: Completed
Priority: High
Created: 2025-09-14
Completed: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary
Replace all manual AST traversal modules with stub implementations that return empty results. This will clear the way for implementing tree-sitter query-based extraction while preserving the cross-file enhancement logic.

## Modules to Replace with Stubs

### Direct AST Processing (to stub):
1. **scope_analysis/scope_tree**
   - `build_scope_tree()` - manual AST traversal
   - `extract_variables_from_scopes()` - processes AST nodes
   
2. **call_graph/function_calls**
   - `find_function_calls()` - manual AST traversal
   
3. **call_graph/method_calls**  
   - `find_method_calls()` - manual AST traversal
   - Keep: `method_hierarchy_resolver.ts` (enhancement)
   
4. **call_graph/constructor_calls**
   - `find_constructor_calls()` - manual AST traversal
   - Keep: `constructor_type_resolver.ts` (enhancement)
   
5. **inheritance/class_detection**
   - `find_class_definitions()` - manual AST traversal
   
6. **type_analysis/type_tracking**
   - `process_file_for_types()` - manual AST traversal
   
7. **type_analysis/return_type_inference**
   - `infer_all_return_types()` - manual AST traversal
   
8. **type_analysis/parameter_type_inference**
   - `infer_all_parameter_types()` - manual AST traversal
   
9. **import_export/import_resolution**
   - `extract_imports()` - manual AST traversal
   
10. **import_export/export_detection**
    - `extract_exports()` - manual AST traversal

### Additional AST Processing Modules Identified

Based on comprehensive search patterns, the following additional modules were found to perform direct AST processing:

11. **scope_analysis/symbol_resolution**
    - `symbol_resolution.ts` - Contains AST node processing functions
    - Already partially stubbed, enhanced with proper stubs

12. **scope_analysis/usage_finder**
    - `find_all_references()` - Manual AST traversal for symbol references
    - `find_usages()` - AST node processing
    - Stubbed to return empty arrays

13. **ast/member_access**
    - `find_member_access_expressions()` - Direct AST traversal for member access patterns
    - Configuration-driven but still processes SyntaxNodes directly
    - Already had partial stub implementation

14. **inheritance/interface_implementation**
    - `extract_interfaces_generic()` - AST traversal for interface detection
    - Configuration-driven interface/trait/protocol detection
    - Already had partial stub implementation

15. **inheritance/method_override**
    - `extract_class_methods_generic()` - AST processing for method extraction
    - Configuration-driven override detection
    - Already had partial stub implementation

16. **import_export/namespace_resolution**
    - `resolve_namespace_imports()` - AST processing for namespace resolution
    - Configuration-driven but uses SyntaxNode directly
    - Already had partial stub implementation

17. **type_analysis/type_propagation**
    - AST traversal for type flow analysis
    - Configuration-driven type propagation
    - Already had partial stub implementation

18. **type_analysis/generic_resolution**
    - AST processing for generic type resolution
    - Language-specific generic handling
    - Already had partial stub implementation

19. **call_graph/constructor_calls/constructor_type_extraction**
    - `extract_constructor_calls_with_types()` - AST processing for constructor type extraction
    - Bidirectional flow between constructor calls and type tracking
    - Enhanced functionality - kept as enhancement module

### Infrastructure Modules (Not Stubbed)

The following modules provide AST processing infrastructure but don't perform direct semantic extraction:

- **ast/node_utils.ts** - Utility functions for working with SyntaxNode objects
- **ast/query_executor.ts** - Infrastructure for tree-sitter query execution (future architecture)
- **file_analyzer.ts** - Orchestrates other modules, doesn't do direct AST processing itself
- **types/query.ts** - Type definitions for query-based architecture

## Comprehensive AST Processing Search Results

### Search Methodology

1. **SyntaxNode Type Usage**: Found 42 TypeScript files using `SyntaxNode`
2. **Parser.Tree Usage**: Found 7 occurrences across 6 files
3. **tree.rootNode Usage**: Found 100+ occurrences in test files and processing modules
4. **Node Traversal Patterns**: Found 29 files using `.child()`, `.childCount`, `traverse`, `.children[`

### Search Pattern Results

#### Files with Direct AST Processing (SyntaxNode usage):
- **Core processing modules**: 19 files in `/src/` directories
- **Test files**: 23 files with test-specific AST processing
- **Already stubbed**: Most core modules had existing partial stubs

#### Parser.Tree Usage Analysis:
- **file_analyzer.ts**: Main orchestrator returning Parser.Tree
- **class_hierarchy modules**: Using Parser.Tree for context
- **namespace_resolution**: Parser.Tree in processing context
- **Test files**: Parser.Tree for test setup

#### Node Traversal Patterns:
- **Manual traversal**: Found in 15+ core processing modules
- **Configuration-driven**: Most modules use language configs with manual traversal fallback
- **Test utilities**: Extensive traversal in test helper functions

### Language-Specific Implementation Removal

**Deleted 67 language-specific files**:
- `*.javascript.ts` - 17 files
- `*.python.ts` - 17 files
- `*.rust.ts` - 16 files
- `*.typescript.ts` - 17 files

These files contained language-specific AST processing logic that has been replaced with configuration-driven approaches in the main stub implementations.

### Cross-File Enhancement Modules Preserved

The following modules perform cross-file analysis and were kept as enhancement modules:
- **method_hierarchy_resolver.ts** - Resolves method calls across class hierarchies
- **constructor_type_resolver.ts** - Resolves constructor types across files
- **receiver_type_resolver.ts** - Resolves method receiver types
- **constructor_type_extraction.ts** - Extracts type information from constructor calls

These modules consume the output of the stubbed AST processing modules and enhance it with cross-file information.

## Implementation Approach

For each module:
1. Create a stub function that returns empty/minimal data structure
2. Remove all internal implementation functions
3. Delete language-specific implementations (*.javascript.ts, *.python.ts, etc.)
4. Keep the exported type definitions
5. Add TODO comment referencing future tree-sitter query implementation

## Example Stub Implementation

```typescript
// scope_analysis/scope_tree/scope_tree.ts
export function build_scope_tree(
  root: SyntaxNode,
  source: string,
  language: Language
): ScopeTree {
  // TODO: Implement using tree-sitter queries from scope_queries/*.scm
  return {
    root: {
      id: "root",
      type: "global",
      range: { start: 0, end: source.length },
      children: [],
      symbols: new Map()
    }
  };
}
```

## Success Criteria ✅

All success criteria have been achieved:

- ✅ **All AST processing functions return minimal valid structures**
  - 19+ core AST processing modules now return empty/minimal data structures
  - Each stub includes TODO comments referencing future tree-sitter query implementation

- ✅ **Cross-file enhancement modules continue to work (with empty data)**
  - Enhancement modules preserved: method_hierarchy_resolver, constructor_type_resolver, receiver_type_resolver, constructor_type_extraction
  - These modules will receive empty data from stubs but remain architecturally intact

- ✅ **Type system compiles without errors**
  - Source files compile successfully with `npx tsc --noEmit`
  - No compilation errors in main source code
  - Test errors are expected due to stub behavior changes

- ✅ **Language-specific implementations removed**
  - All 67 language-specific files (*.javascript.ts, *.python.ts, *.rust.ts, *.typescript.ts) deleted
  - Configuration-driven approaches preserved in main stub implementations

## Dependencies
- None - this is cleanup work

## Follow-up Tasks
- Task 28: Preserve tree-sitter query files
- Task 29: Implement query-based extraction for each module