# Task 11.32 Sub-task Priority Order

## Recommended Execution Order

### Priority 1: Critical Bug Fixes (Must do first)

#### 1. **task-epic-11.32.8** - Fix build_module_graph incorrect inputs
- **Severity**: CRITICAL - Runtime error
- **Issue**: Function called with completely wrong arguments (ImportInfo[] instead of string[], etc.)
- **Impact**: System will crash when build_module_graph is called
- **Why first**: Blocks all graph_builder functionality

#### 2. **task-epic-11.32.6** - Fix module-level call handling
- **Severity**: HIGH - Type safety violation
- **Issue**: FunctionCallInfo.caller_name is non-nullable but module-level calls have no caller
- **Impact**: Runtime errors for module-level function calls
- **Why second**: Common scenario that will cause failures

#### 3. **task-epic-11.32.5** - Fix method vs function scope type mismatch
- **Severity**: HIGH - Logic bug
- **Issue**: ScopeType doesn't include 'method' but graph_builder checks for it
- **Impact**: Methods will never be detected in the graph
- **Why third**: Fundamental type mismatch affecting class analysis

### Priority 2: Foundational Types (Enables other work)

#### 4. **task-epic-11.32.3** - Add FileMetadata type
- **Type**: Foundation
- **Purpose**: Create standardized metadata type for all analysis functions
- **Dependencies**: Required by 11.32.4
- **Why fourth**: Establishes type foundation for subsequent improvements

### Priority 3: Performance & Efficiency

#### 5. **task-epic-11.32.4** - Eliminate redundant scope graph computation
- **Type**: Performance
- **Purpose**: Pass pre-computed scope tree instead of recomputing
- **Dependencies**: Requires 11.32.3 (FileMetadata)
- **Why fifth**: Significant performance improvement, builds on FileMetadata

### Priority 4: Type Safety Improvements

#### 6. **task-epic-11.32.7** - Add typed metadata to graph types
- **Type**: Type Safety
- **Purpose**: Replace untyped Record<string, any> with proper interfaces
- **Dependencies**: Has dependency on task-epic-11.33 but can proceed
- **Why sixth**: Improves maintainability and catches errors at compile time

### Priority 5: New Capabilities

#### 7. **task-epic-11.32.1** - Implement cross-file reference resolution
- **Type**: Enhancement
- **Purpose**: Link calls, imports, and types across module boundaries
- **Dependencies**: Needs stable foundation from previous fixes
- **Why seventh**: New functionality that extends capabilities

#### 8. **task-epic-11.32.2** - Replace stub graph interfaces
- **Type**: Architectural
- **Purpose**: Replace Map-based structure with proper graph data structure
- **Dependencies**: Better done after all fixes are stable
- **Why last**: Major architectural change requiring library evaluation

## Execution Strategy

### Phase 1: Critical Fixes (Tasks 1-3)
**Goal**: Make graph_builder functional
- Fix runtime errors
- Fix type safety issues
- Fix logic bugs
- **Estimated effort**: 1-2 days

### Phase 2: Foundation (Task 4)
**Goal**: Establish proper typing foundation
- Create FileMetadata type
- Update all analysis functions
- **Estimated effort**: 0.5 days

### Phase 3: Optimization (Task 5)
**Goal**: Eliminate redundancy
- Pass scope tree through metadata
- Remove duplicate computation
- **Estimated effort**: 0.5 days

### Phase 4: Type Safety (Task 6)
**Goal**: Full type safety
- Create typed metadata interfaces
- Use discriminated unions
- **Estimated effort**: 1 day

### Phase 5: Enhancements (Tasks 7-8)
**Goal**: Extend capabilities
- Add cross-file resolution
- Evaluate and implement proper graph structure
- **Estimated effort**: 2-3 days

## Total Estimated Effort: 5-7 days

## Notes

- Tasks 1-3 are **blocking issues** that prevent graph_builder from working
- Task 4 is a **foundational change** that several other tasks depend on
- Tasks 5-6 are **quality improvements** that make the code more maintainable
- Tasks 7-8 are **capability extensions** that add new functionality

## Validation Criteria

After completing each phase:
1. All tests should pass
2. No TypeScript compilation errors
3. No runtime errors in graph_builder
4. Performance should be equal or better
5. Type safety should be improved