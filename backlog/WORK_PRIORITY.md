# Work Priority Guide

## Current Focus: Call Analysis Architecture Refactoring

The goal is to fix cross-file resolution properly and make the codebase maintainable through clean separation of concerns. We've identified that the current architecture has circular dependencies, unclear ownership, and overly complex functions that make debugging difficult.

## Phase 1: Foundation (Immediate Priority)

### 1. Create ImportResolver Service (task-100.20)

**Why First**: This is the foundation - import resolution is currently scattered across multiple services with unclear ownership. Creating a dedicated service will:

- Eliminate the circular dependency between NavigationService and QueryService
- Provide a single source of truth for import resolution
- Enable proper testing of import logic in isolation

### 2. Add Error Handling (task-100.19)

**Why Second**: Silent failures (empty arrays, null returns) made debugging the cross-file bug extremely difficult. Adding proper "not implemented" errors will:

- Make future issues immediately visible
- Prevent wasted debugging time
- Force proper implementation instead of placeholders

### 3. Standardize Import Patterns (task-100.25)

**Why Third**: Before refactoring other components, we need consistent patterns so that:

- All services use ImportResolver consistently
- No duplicate import resolution logic exists
- Clear boundaries between services

## Phase 2: Refactoring (Next Priority)

### 4. Split Reference Resolution (task-100.21)

**After Foundation**: With ImportResolver in place, we can properly separate:

- DirectReferenceResolver
- MethodCallResolver
- StaticMethodResolver
- ChainedCallResolver
  Each <50 lines, single responsibility, fully testable

### 5. Refactor CallAnalyzer (task-100.22)

**Depends on #4**: Clear two-phase separation:

- Phase 1: Type discovery (constructors, assignments)
- Phase 2: Call resolution (using discovered types)
- Clean data flow between phases

### 6. Simplify Import Matching (task-100.26)

**Depends on #1**: With ImportResolver established, simplify the complex fallback logic:

- Maximum nesting depth of 2
- Each strategy in its own method
- Clear documentation of fallback order

## Phase 3: Clean-up & Testing

### 7. Remove Dead Code (task-100.24)

**After Refactoring**: Clean up all TODOs and placeholder implementations

### 8. Clean Debug Logging (task-100.16)

**After Refactoring**: Remove temporary debug statements

### 9. Add Import Tests (task-100.23)

**After ImportResolver**: Comprehensive test suite for the new service

### 10. Document AST Fix (task-100.17)

**Documentation**: Explain the object identity comparison issue for future reference

## Phase 4: Validation & Metrics

### 11. JavaScript Test Updates (task-100.10)

**After Core Fixes**: Update tests to match new architecture

### 12. Validation Metrics (task-100.14)

**After All Fixes**: Add detailed breakdown to understand improvements

### 13. Investigate Metrics (task-100.12)

**Final Analysis**: Verify we meet the 85% thresholds

## Phase 5: Feature Additions

### 14. CommonJS/ES6 Support (task-100.9)

**Only After Stable**: Add new export formats once architecture is solid

## Success Criteria

Each phase must be completed before moving to the next:

- Phase 1 establishes the foundation with proper service boundaries
- Phase 2 refactors complexity into manageable, testable units
- Phase 3 ensures code quality and test coverage
- Phase 4 validates that our changes actually improved the metrics
- Phase 5 adds new capabilities on the solid foundation

## Key Principles

1. **Fix Architecture First**: Don't add features to broken foundations
2. **Test Each Change**: Every refactoring needs tests before and after
3. **Clear Ownership**: Each service should have a single, clear responsibility
4. **No Silent Failures**: Explicit errors are better than wrong results
5. **Incremental Progress**: Complete each task fully before starting the next
