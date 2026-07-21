# Task: Simplify get_call_graph() and Remove Cache

**Epic**: Epic 11 - Codebase Restructuring
**Parent Task**: task-epic-11.143 - Implement Eager Resolution in Project Class
**Status**: Completed
**Priority**: Medium
**Complexity**: Low

## Overview

Simplify `get_call_graph()` by removing both the `resolve_all_pending()` call and the `call_graph_cache` field. With eager resolution, all files are already resolved, and we can just recalculate the call graph on demand.

## Context

Currently, `get_call_graph()` manages a cache and checks for pending resolutions:

```typescript
// Field:
private call_graph_cache: CallGraph | null = null;

// Method:
get_call_graph(): CallGraph {
  if (this.call_graph_cache) {
    return this.call_graph_cache;
  }

  // Resolve all pending files
  this.resolve_all_pending();

  // Build call graph using detect_call_graph
  this.call_graph_cache = detect_call_graph(
    this.semantic_indexes,
    this.definitions,
    this.resolutions
  );

  return this.call_graph_cache;
}
```

With eager resolution, files are always resolved. We also remove caching complexity entirely - if users want to cache, they can do it themselves:

```typescript
// No field needed!

// Method:
get_call_graph(): CallGraph {
  // Simply build and return - always up-to-date
  return detect_call_graph(
    this.semantic_indexes,
    this.definitions,
    this.resolutions
  );
}
```

**Benefits**:
- No cache invalidation logic needed
- Always correct (can't have stale cache)
- Simpler code (one less field, no cache management)
- YAGNI - optimize only if profiling shows it's needed
- Users can cache externally if needed

## Goals

1. Remove `call_graph_cache` field from Project class
2. Remove caching logic from `get_call_graph()`
3. Remove `resolve_all_pending()` call
4. Update method documentation
5. Verify existing tests still pass

## Implementation

### 1. Remove call_graph_cache Field

Delete the field declaration (around line 158):

```typescript
// DELETE THIS LINE
private call_graph_cache: CallGraph | null = null;
```

### 2. Simplify get_call_graph() Method

Replace the method in `project.ts` (around line 370-386):

```typescript
// BEFORE
get_call_graph(): CallGraph {
  if (this.call_graph_cache) {
    return this.call_graph_cache;
  }

  // Resolve all pending files
  this.resolve_all_pending();

  // Build call graph using detect_call_graph
  this.call_graph_cache = detect_call_graph(
    this.semantic_indexes,
    this.definitions,
    this.resolutions
  );

  return this.call_graph_cache;
}
```

```typescript
// AFTER
get_call_graph(): CallGraph {
  // Build call graph from current state
  // All resolutions are always up-to-date (eager resolution)
  return detect_call_graph(
    this.semantic_indexes,
    this.definitions,
    this.resolutions
  );
}
```

### 3. Update Method Documentation

Update the docstring:

```typescript
/**
 * Get the call graph for the project.
 *
 * Builds the call graph from current state. All resolutions are maintained
 * up-to-date by update_file() and remove_file(), so this method always returns
 * accurate results.
 *
 * Note: This method does not cache. If you need to call it multiple times,
 * consider caching the result yourself.
 *
 * @returns The call graph
 */
get_call_graph(): CallGraph {
  // ...
}
```

## Testing

### Verify Existing Tests

All existing tests that call `get_call_graph()` should still pass:

```bash
npm test --workspace=@ariadnejs/core -- project.test.ts
npm test --workspace=@ariadnejs/core -- project.integration.test.ts
```

### Add Verification Test

Add a test to verify that `get_call_graph()` works without explicit resolution:

```typescript
describe("get_call_graph (no cache)", () => {
  it("should build call graph without explicit resolution", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    project.update_file(file1, `
      function foo() { return 42; }
      function bar() { return foo(); }
    `);

    // Should work immediately - no resolve_file() needed
    const call_graph = project.get_call_graph();

    expect(call_graph).toBeDefined();
    expect(call_graph.nodes.size).toBeGreaterThan(0);
    expect(call_graph.edges.size).toBeGreaterThan(0);
  });

  it("should recalculate call graph on each call (no caching)", async () => {
    const project = new Project();
    await project.initialize();

    project.update_file("file1.ts" as FilePath, "function foo() {}");

    // First call - builds call graph
    const call_graph1 = project.get_call_graph();

    // Second call - builds again (no cache)
    const call_graph2 = project.get_call_graph();

    // Should be DIFFERENT references (recalculated each time)
    expect(call_graph1).not.toBe(call_graph2);

    // But should have same structure
    expect(call_graph1.nodes.size).toBe(call_graph2.nodes.size);
  });

  it("should reflect changes immediately after file update", async () => {
    const project = new Project();
    await project.initialize();

    const file1 = "file1.ts" as FilePath;
    project.update_file(file1, "function foo() {}");

    const call_graph1 = project.get_call_graph();
    const nodes_before = call_graph1.nodes.size;

    // Update file (adds more functions)
    project.update_file(file1, `
      function foo() {}
      function bar() {}
      function baz() { bar(); }
    `);

    const call_graph2 = project.get_call_graph();
    const nodes_after = call_graph2.nodes.size;

    // Should have more nodes after update
    expect(nodes_after).toBeGreaterThan(nodes_before);
  });
});
```

## Verification

After completing this task:

1. **Run all tests**: `npm test --workspace=@ariadnejs/core`
2. **Verify**:
   - `get_call_graph()` works immediately after `update_file()`
   - Call graph is recalculated each time (no caching)
   - Always returns current state without stale data

## Success Criteria

- [ ] `call_graph_cache` field deleted from Project class
- [ ] Caching logic removed from `get_call_graph()`
- [ ] `resolve_all_pending()` call removed from `get_call_graph()`
- [ ] Method documentation updated
- [ ] New tests added
- [ ] All existing tests passing
- [ ] Call graph builds correctly from eager-resolved state
- [ ] No references to `call_graph_cache` remain in Project class

## Notes

- Removes both caching complexity and lazy resolution
- The real work was done in 143.2 and 143.3 (eager resolution)
- This task demonstrates multiple benefits of eager resolution:
  - Simpler code (no cache management)
  - Always correct (no stale data)
  - One less field to maintain
- If profiling shows call graph computation is slow, users can cache externally
- YAGNI principle: don't optimize prematurely

## Dependencies

- **Requires**: task-epic-11.143.3 completed (eager resolution fully wired up)
- **Blocks**: task-epic-11.143.5 (can now remove resolve_all_pending method)

## Estimated Effort

- Implementation: 0.5 hour
- Testing: 0.5-0.75 hour
- **Total**: 1-1.25 hours
