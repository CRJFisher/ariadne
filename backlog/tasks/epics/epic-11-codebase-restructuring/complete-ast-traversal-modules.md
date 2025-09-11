# Complete List of Modules Performing AST Traversal

## Summary
**98 files** across **21 directories** currently perform manual AST traversal

## Modules Already Documented in Subtasks (7)

1. ✅ **scope_tree** (11.100.1)
2. ✅ **import_resolution** (11.100.2)  
3. ✅ **export_detection** (11.100.3)
4. ✅ **class_detection** (11.100.4)
5. ✅ **function_calls** (11.100.5)
6. ✅ **method_calls** (11.100.6)
7. ✅ **type_tracking** (11.100.7)

## Additional Modules Needing Subtasks (14)

### Constructor Calls (11.100.8 needed)
- `src/call_graph/constructor_calls/`
- Files: constructor_calls.ts, .javascript.ts, .typescript.ts, .python.ts, .rust.ts
- ~900 lines

### Symbol Resolution (11.100.9 needed)
- `src/scope_analysis/symbol_resolution/`
- Files: symbol_resolution.ts, language-specific files
- ~2,000 lines

### Return Type Inference (11.100.10 needed)
- `src/type_analysis/return_type_inference/`
- Files: return_type_inference.ts, language-specific files
- ~1,500 lines

### Parameter Type Inference (11.100.11 needed)
- `src/type_analysis/parameter_type_inference/`
- Files: parameter_type_inference.ts, language-specific files
- ~1,200 lines

### Class Hierarchy (11.100.12 needed)
- `src/inheritance/class_hierarchy/`
- Files: class_hierarchy.ts, language-specific files
- ~1,000 lines

### Method Override (11.100.13 needed)
- `src/inheritance/method_override/`
- Files: method_override.ts, language configs
- ~800 lines (already uses some queries!)

### Member Access (11.100.14 needed)
- `src/ast/member_access/`
- Files: member_access.ts, language-specific files
- ~1,500 lines

### Interface Implementation (11.100.15 needed)
- `src/inheritance/interface_implementation/`
- Files: interface_implementation.ts, language-specific
- ~1,200 lines

### Namespace Resolution (11.100.16 needed)
- `src/import_export/namespace_resolution/`
- Files: namespace_resolution.ts, language-specific
- ~1,000 lines

### Usage Finder (11.100.17 needed)
- `src/scope_analysis/usage_finder/`
- Files: index.ts, usage finding logic
- ~500 lines

### Generic Resolution (11.100.18 needed)
- `src/type_analysis/generic_resolution/`
- Files: generic_resolution.ts, language-specific
- ~800 lines

### Type Propagation (11.100.19 needed)
- `src/type_analysis/type_propagation/`
- Files: type_propagation.ts, language-specific
- ~1,500 lines (recently refactored but still manual)

### Node Utils (11.100.20 needed)
- `src/ast/node_utils.ts`
- Helper functions for AST manipulation
- ~100 lines

### File Analyzer (11.100.21 needed)
- `src/file_analyzer.ts`
- Orchestrates all analysis
- ~800 lines (mostly calls other modules)

## Total Impact

### Current State
- **21 modules** performing manual AST traversal
- **~25,000 total lines** of traversal code
- **98 files** involved

### After Query Transformation
- **1 unified query system**
- **~3,500 lines** total (85% reduction)
- **21 query files** (.scm) + 1 analyzer

## Priority Order

### Phase 1: Core Infrastructure (Weeks 1-2)
1. Build unified query system
2. scope_tree (foundation for everything)
3. symbol_resolution (needed by many)

### Phase 2: Import/Export System (Weeks 3-4)
4. import_resolution
5. export_detection
6. namespace_resolution

### Phase 3: Call Graph (Weeks 5-6)
7. function_calls
8. method_calls
9. constructor_calls
10. member_access

### Phase 4: Type System (Weeks 7-8)
11. type_tracking
12. return_type_inference
13. parameter_type_inference
14. type_propagation
15. generic_resolution

### Phase 5: Inheritance (Weeks 9-10)
16. class_detection
17. class_hierarchy
18. interface_implementation
19. method_override

### Phase 6: Cleanup (Week 11)
20. usage_finder
21. node_utils
22. file_analyzer refactor

## Note on Completeness

This list includes ALL modules that:
- Import SyntaxNode from tree-sitter
- Use node.childForFieldName()
- Access node.children
- Perform recursive tree walks
- Check node.type for patterns

Some modules like `query_executor.ts` already use queries but are included because they could be part of the unified system.