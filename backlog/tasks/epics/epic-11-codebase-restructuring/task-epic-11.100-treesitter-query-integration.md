# Task 11.100: Transform Entire Codebase to Tree-sitter Query System

## Executive Summary

Complete architectural transformation from manual AST traversal to Tree-sitter queries across ALL analysis modules. This will reduce codebase by ~85% (from ~22,000 to ~3,000 lines), improve performance 10-100x, and fundamentally simplify the entire system.

## Strategic Decision: Option B - Full System Transformation

After analysis, we're pursuing the most ambitious but highest-reward approach:
- Replace ALL manual AST traversal with Tree-sitter queries
- Single unified query system for all extraction
- One-pass analysis instead of multiple tree walks
- Dramatic simplification of entire codebase

## Current State: Massive Duplication

### The Problem
- **22,000+ lines** of manual AST traversal code
- **14+ separate modules** each walking the tree independently
- **Parser called once**, tree walked 14+ times
- Each module reinvents node type checking
- Massive code duplication across modules

### Unused Infrastructure
- 44KB of sophisticated `.scm` query files sitting unused
- Complete `query_executor.ts` implementation never imported
- `load_scope_query()` function never called
- Years of Tree-sitter query development ignored

## Future State: Unified Query Architecture

### The Vision
```typescript
// Single analysis function replaces 14 modules
const analysis = await analyzeWithQueries(file);
// Returns EVERYTHING: scopes, imports, exports, classes, calls, types...
```

### How It Works
1. **Parse once**: Create AST
2. **Query once**: Execute unified query capturing all patterns
3. **Build once**: Transform captures into structures
4. **Done**: No recursive traversal, no repeated walks

## Implementation Strategy

### Phase 1: Build Unified Query System
1. Create comprehensive `.scm` files combining all patterns
2. Build single `QueryAnalyzer` class
3. Implement capture-to-structure transformers
4. Run in shadow mode alongside current system

### Phase 2: Module-by-Module Migration
Each module gets a subtask (see below) for transformation:
- Document current patterns extracted
- Convert to Tree-sitter query patterns
- Build transformer for captures
- Validate output matches current

### Phase 3: Integration & Cutover
1. Replace `file_analyzer.ts` internals
2. Remove old manual traversal modules
3. Delete configuration files
4. Update all tests

## Modules to Transform (Subtasks Below)

1. **scope_analysis/scope_tree** → 11.100.1
2. **import_export/import_resolution** → 11.100.2
3. **import_export/export_detection** → 11.100.3
4. **inheritance/class_detection** → 11.100.4
5. **call_graph/function_calls** → 11.100.5
6. **call_graph/method_calls** → 11.100.6
7. **call_graph/constructor_calls** → 11.100.7
8. **scope_analysis/symbol_resolution** → 11.100.8
9. **type_analysis/type_tracking** → 11.100.9
10. **type_analysis/return_type_inference** → 11.100.10
11. **type_analysis/parameter_type_inference** → 11.100.11
12. **inheritance/class_hierarchy** → 11.100.12
13. **inheritance/method_override** → 11.100.13
14. **ast/member_access** → 11.100.14

## Expected Outcomes

### Metrics
- **Code reduction**: 85% (22,000 → 3,000 lines)
- **Performance**: 10-100x faster
- **Memory**: 50% reduction (no recursive call stacks)
- **Maintenance**: 90% fewer files to modify

### Benefits
1. **Single source of truth**: All patterns in `.scm` files
2. **Consistency**: Same extraction logic everywhere
3. **Performance**: C++ query engine vs JavaScript
4. **Simplicity**: Declarative patterns vs imperative code
5. **Extensibility**: Add patterns without code changes

## Risk Mitigation

### Semantic Compatibility
- Run both systems in parallel initially
- Extensive differential testing
- Log all differences for analysis
- Gradual semantic improvements

### Migration Safety
- Module-by-module transformation
- Each module can fallback independently
- Comprehensive test coverage required
- Performance benchmarks at each step

## Success Criteria

- [ ] All 14 modules transformed to queries
- [ ] 85% code reduction achieved
- [ ] 10x performance improvement minimum
- [ ] All existing tests pass
- [ ] No semantic regressions in analysis

## Timeline

- Week 1-2: Build unified query system
- Week 3-4: Transform core modules (scope, imports, exports)
- Week 5-6: Transform analysis modules (calls, types)
- Week 7-8: Integration and optimization
- Week 9-10: Testing and cutover

## Conclusion

This is not an incremental improvement - it's a fundamental architectural transformation that will:
1. Eliminate 85% of the codebase
2. Improve performance by orders of magnitude
3. Make the system dramatically simpler
4. Align with Tree-sitter's intended architecture

The infrastructure already exists. We just need to use it.

---

## Subtasks

See individual subtask files for detailed transformation plans:

- [11.100.1 - Transform scope_tree to queries](./task-epic-11.100.1-transform-scope-tree.md)
- [11.100.2 - Transform import_resolution to queries](./task-epic-11.100.2-transform-import-resolution.md)
- [11.100.3 - Transform export_detection to queries](./task-epic-11.100.3-transform-export-detection.md)
- [11.100.4 - Transform class_detection to queries](./task-epic-11.100.4-transform-class-detection.md)
- [11.100.5 - Transform function_calls to queries](./task-epic-11.100.5-transform-function-calls.md)
- [11.100.6 - Transform method_calls to queries](./task-epic-11.100.6-transform-method-calls.md)
- [11.100.7 - Transform constructor_calls to queries](./task-epic-11.100.7-transform-constructor-calls.md)
- [11.100.8 - Transform symbol_resolution to queries](./task-epic-11.100.8-transform-symbol-resolution.md)
- [11.100.9 - Transform type_tracking to queries](./task-epic-11.100.9-transform-type-tracking.md)
- [11.100.10 - Transform return_type_inference to queries](./task-epic-11.100.10-transform-return-type-inference.md)
- [11.100.11 - Transform parameter_type_inference to queries](./task-epic-11.100.11-transform-parameter-type-inference.md)
- [11.100.12 - Transform class_hierarchy to queries](./task-epic-11.100.12-transform-class-hierarchy.md)
- [11.100.13 - Transform method_override to queries](./task-epic-11.100.13-transform-method-override.md)
- [11.100.14 - Transform member_access to queries](./task-epic-11.100.14-transform-member-access.md)