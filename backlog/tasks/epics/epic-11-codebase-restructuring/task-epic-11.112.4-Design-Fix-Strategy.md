# Task epic-11.112.4: Design Fix Strategy

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 1 decision document
**Dependencies:** tasks epic-11.112.1-11.112.3

## Objective

Based on Phase 1 findings, choose the best approach to fix scope assignment and document the implementation plan.

## Files to Create

- `backlog/tasks/epics/epic-11-codebase-restructuring/scope-fix-design-decision.md`

## Implementation Steps

### 1. Review Phase 1 Evidence (30 min)

Read and summarize:
- task-11.112.1 results (bug reproduction)
- task-11.112.2 results (sibling scope investigation)
- task-11.112.3 results (scope creation flow analysis)

Answer:
1. Do functions use the same get_scope_id() as classes?
2. Why do functions work correctly?
3. Is the issue ONLY with body-containing definitions?

### 2. Evaluate Option A: Use Start Position (20 min)

**Approach:** Modify get_scope_id() calls to use start position only

```typescript
// In language_configs
scope_id: context.get_scope_id({
  ...capture.location,
  end_line: capture.location.start_line,
  end_column: capture.location.start_column
})
```

**Pros:**
- Simple
- No new functions
- No .scm changes

**Cons:**
- Repeated pattern (many callsites)
- Less explicit intent
- Location manipulation feels hacky

### 3. Evaluate Option B: Create Helper Function (20 min)

**Approach:** New `get_defining_scope_id()` helper

```typescript
// In scope_processor.ts
get_defining_scope_id(location: Location): ScopeId {
  // Use start position only
  const start_point = {
    ...location,
    end_line: location.start_line,
    end_column: location.start_column,
  };
  return this.get_scope_id(start_point);
}

// In language_configs
scope_id: context.get_defining_scope_id(capture.location)
```

**Pros:**
- Explicit intent
- Centralized logic
- Easy to document
- Can enhance later if needed

**Cons:**
- New API surface
- Need to update interface

### 4. Evaluate Option C: Modify .scm Files (20 min)

**Approach:** Change tree-sitter queries to capture defining scope

**Pros:**
- Fix at source
- Potentially more accurate

**Cons:**
- Complex to implement
- Must follow @changes-notes.md#95-102
- Changes needed for ALL languages
- May not be possible with tree-sitter syntax
- Higher risk

### 5. Make Decision (30 min)

**Recommended: Option B**

Rationale:
1. **Clarity:** Function name explicitly states intent
2. **Maintainability:** Centralized in one place
3. **No .scm changes:** Lower risk, follows guidelines
4. **Testable:** Can unit test the helper independently
5. **Future-proof:** Can enhance if needed

### 6. Document Decision (60 min)

Create `scope-fix-design-decision.md`:

```markdown
# Scope Assignment Fix - Design Decision

**Date:** [date]
**Decision:** Option B - `get_defining_scope_id()` helper function

## Problem Summary

Classes/interfaces/enums receive wrong scope_id because:
- capture.location spans entire body (including nested methods)
- context.get_scope_id() finds deepest scope in range
- Result: definition assigned to nested scope instead of defining scope

## Solution: get_defining_scope_id() Helper

### Implementation
```typescript
// In ProcessingContext
get_defining_scope_id(location: Location): ScopeId {
  // Use only START position to find scope
  const start_point: Location = {
    file_path: location.file_path,
    start_line: location.start_line,
    start_column: location.start_column,
    end_line: location.start_line,
    end_column: location.start_column,
  };
  return this.get_scope_id(start_point);
}
```

### Usage
```typescript
// BEFORE:
scope_id: context.get_scope_id(capture.location)

// AFTER (for definitions):
scope_id: context.get_defining_scope_id(capture.location)
```

### When to Use Each

**Use get_scope_id():**
- References (need deepest scope)
- Scoped code blocks
- Anything where full span matters

**Use get_defining_scope_id():**
- Class definitions
- Interface definitions
- Enum definitions
- Type alias definitions
- Any definition where we want the declaring scope

## Implementation Plan

### Phase 1: Create Helper (task-epic-11.112.5)
- Implement in scope_processor.ts
- Add to ProcessingContext interface
- Unit test

### Phase 2: Update Language Configs (tasks 11.112.7-13)
- JavaScript: classes
- TypeScript: classes, interfaces, enums, type aliases
- Python: classes
- Rust: structs, enums

### Phase 3: Testing (tasks 11.112.14-20)
- Comprehensive scope assignment tests
- Verify each language's semantic tests
- Verify TypeContext tests (critical)

## Alternatives Considered

### Option A: Location Manipulation
Rejected because:
- Less explicit
- Repeated code
- Harder to maintain

### Option C: .scm Changes
Rejected because:
- Too complex
- High risk
- May not be possible
- Against @changes-notes.md guidelines

## Success Metrics

- TypeContext: 2/23 → 23/23 tests passing
- Zero regressions
- Clear, maintainable code
```

### 7. Design Helper Function Signature (30 min)

Add to decision document:

```markdown
## Detailed Design

### Interface Addition
```typescript
export interface ProcessingContext {
  captures: CaptureNode[];
  scopes: Map<ScopeId, LexicalScope>;
  scope_depths: Map<ScopeId, number>;
  root_scope_id: ScopeId;

  /**
   * Get the scope containing a location (finds deepest scope).
   * Use for: references, nested scopes, code blocks.
   */
  get_scope_id(location: Location): ScopeId;

  /**
   * Get the scope where a definition is DECLARED.
   * Uses only start position to avoid body span issues.
   * Use for: class, interface, enum, type definitions.
   *
   * Example: class MyClass { method() {} }
   * - Full span includes method scope
   * - Start position is in parent scope
   * - Returns parent scope (correct)
   */
  get_defining_scope_id(location: Location): ScopeId;
}
```

### Implementation Location
- File: `packages/core/src/index_single_file/scopes/scope_processor.ts`
- Function: `create_processing_context()`
- Add method alongside get_scope_id()

### Test Strategy
- Unit test in scope_processor.test.ts
- Integration test with bug reproduction from task-epic-11.112.1
```

## Success Criteria

- ✅ Decision made with clear rationale
- ✅ Decision documented in markdown file
- ✅ Helper function signature designed
- ✅ Implementation plan defined
- ✅ Ready for task-epic-11.112.5

## Outputs

- `scope-fix-design-decision.md` with complete design

## Next Task

**task-epic-11.112.5** - Implement helper function in scope_processor.ts
