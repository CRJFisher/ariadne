---
id: task-100.11.13
title: Implement return type tracking for method chains
status: Done
assignee: []
created_date: '2025-08-04 19:00'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

Method call chains like `obj.getInner().process()` only detect the first call (getInner) but miss subsequent calls (process) because the system doesn't track method return types. This significantly impacts the nodes-called-by-others metric.

## Acceptance Criteria

- [x] Method return types are tracked
- [x] Chained method calls are fully resolved
- [x] Test coverage for method chains
- [x] Nodes-called-by-others percentage improves

## Implementation Plan

1. Add return type field to function definitions
2. Analyze function bodies to infer return types
3. Update method resolution to use return type info
4. Handle complex chains with multiple steps
5. Test with real-world patterns

## Implementation Notes

### Approach taken
- Added `return_type` field to the Def interface in the types package
- Created `return_type_analyzer.ts` module to extract return types from function/method AST nodes
- Integrated return type analysis into `scope_resolution.ts` during definition creation
- Modified `call_analysis.ts` to resolve chained method calls by:
  - Detecting when a method is called on a call_expression (chained pattern)
  - Resolving the return type of the inner call
  - Using that type to find the method being called
- Added support for explicit TypeScript return type annotations
- Fixed ScopeGraph to store language information needed by the analyzer
- Added scope query pattern for chained method calls in TypeScript

### Features implemented or modified
- **Type tracking**: Return types are now extracted and stored for all functions/methods
- **Chain resolution**: Method chains like `obj.getInner().process()` are fully resolved
- **Scope queries**: Added pattern to capture chained method references
- **Cross-file support**: Works with types defined in other files

### Technical decisions and trade-offs
- Focus on explicit return type annotations first (TypeScript, Python, Rust)
- Added basic heuristics for common patterns (constructors, getters)
- Did not implement full type inference from function bodies (would require dataflow analysis)
- Store language in ScopeGraph to enable language-specific analysis

### Modified or added files
- `packages/types/src/index.ts`: Added return_type field to Def interface
- `packages/core/src/call_graph/return_type_analyzer.ts`: New module for return type analysis
- `packages/core/src/scope_resolution.ts`: Integrated return type analysis
- `packages/core/src/call_graph/call_analysis.ts`: Added chained method resolution
- `packages/core/src/graph.ts`: Added lang property to ScopeGraph
- `packages/core/src/languages/typescript/scopes.scm`: Added chained method call pattern
- `packages/core/test_return_types.ts`: Created comprehensive test

### Results
- Direct method calls were already working: `inner1.process()` detected correctly
- Chained calls now work: `outer.getInner().process()` fully resolved
- All 3 process() calls and 2 getData() calls detected in test
- Improved nodes-called-by-others from ~36% to 66% in test scenario