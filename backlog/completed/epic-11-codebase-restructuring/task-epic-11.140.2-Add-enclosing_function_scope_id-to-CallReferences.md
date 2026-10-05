# Sub-Task 11.140.2: Add enclosing_function_scope_id to CallReferences

**Parent Task**: task-epic-11.140
**Status**: Not Started
**Priority**: High
**Estimated Effort**: 3-4 hours

---

## Goal

Track which function scope encloses each call reference by adding `enclosing_function_scope_id` field. This enables trivial grouping of calls by their containing function during call graph detection.

---

## Context

Currently, CallReference has `scope_id` (the immediate scope where the call occurs), but NOT which function/method/constructor encloses it.

**Example**:
```typescript
function outer() {                    // Function scope A
  if (condition) {                    // Block scope B (child of A)
    helper();                         // Call reference
                                      // scope_id: B (block scope)
                                      // enclosing_function_scope_id: A (outer's body scope) ← NEW
  }
}
```

With `enclosing_function_scope_id`, we can instantly know "this call is inside `outer`" without traversing the scope tree.

---

## Changes Required

### 1. Update CallReference Type

**File**: `packages/types/src/call_chains.ts`

Add `enclosing_function_scope_id`:

```typescript
export interface CallReference {
  readonly location: Location;
  readonly name: SymbolName;
  readonly scope_id: ScopeId;
  readonly call_type: "function" | "method" | "constructor" | "super" | "macro";
  
  // NEW: The function/method/constructor scope that encloses this call
  // Used for call graph detection - groups calls by containing function
  readonly enclosing_function_scope_id: ScopeId;
  
  // ... other fields
}
```

---

### 2. Implement find_enclosing_function_scope Helper

**File**: `packages/core/src/index_single_file/scopes/scope_utils.ts`

**Strategy**: Traverse up scope tree until hitting a function/method/constructor scope.

```typescript
/**
 * Find the enclosing function/method/constructor scope for a given scope.
 * Traverses up the scope tree until finding a callable scope.
 * 
 * @param scope_id - Starting scope ID
 * @param scopes - All scopes in the file  
 * @returns The enclosing function scope ID, or module scope if no function found
 */
export function find_enclosing_function_scope(
  scope_id: ScopeId,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): ScopeId {
  let current_id: ScopeId | null = scope_id;
  
  while (current_id !== null) {
    const scope = scopes.get(current_id);
    if (!scope) {
      throw new Error(`Scope ${current_id} not found`);
    }
    
    // Check if this is a function/method/constructor scope
    if (is_function_scope(scope)) {
      return scope.id;
    }
    
    // Move to parent
    current_id = scope.parent_id;
  }
  
  // If no function scope found, return the root scope
  // This handles top-level calls (calls at module scope)
  return find_root_scope(scopes);
}

/**
 * Check if a scope is a function/method/constructor scope.
 */
function is_function_scope(scope: LexicalScope): boolean {
  return (
    scope.type === 'function' ||
    scope.type === 'method' ||
    scope.type === 'constructor'
  );
}

/**
 * Find root scope (module scope) in a scope map.
 */
function find_root_scope(scopes: ReadonlyMap<ScopeId, LexicalScope>): ScopeId {
  for (const scope of scopes.values()) {
    if (scope.parent_id === null) {
      return scope.id;
    }
  }
  throw new Error('No root scope found');
}
```

---

### 3. Update Reference Handlers

**Files to update**:
- `packages/core/src/index_single_file/references/call_handler.ts`
- Any other handlers that create CallReferences

**For each handler**, compute `enclosing_function_scope_id`:

```typescript
// In call_handler.ts:

function create_call_reference(
  capture: CaptureNode,
  context: ProcessingContext
): CallReference {
  // ... existing logic to get scope_id, location, name, etc.
  
  // NEW: Find the enclosing function scope
  const enclosing_function_scope_id = find_enclosing_function_scope(
    scope_id,  // The immediate scope
    context.scopes
  );
  
  return {
    location,
    name,
    scope_id,
    call_type,
    enclosing_function_scope_id,  // NEW
    // ... other fields
  };
}
```

---

## Edge Cases to Handle

### 1. Top-Level Calls (Module Scope)
- **Problem**: Call at module scope has no enclosing function
- **Solution**: `enclosing_function_scope_id` = module scope ID
- **Note**: These won't appear in any function's enclosed_calls (correct behavior)

### 2. Nested Functions
- **Problem**: Call inside nested function should belong to inner function, not outer
- **Solution**: Traverse stops at FIRST function scope encountered
- **Test**: Verify nested calls attributed to correct function

### 3. Calls Inside Class Methods
- **Problem**: Need to ensure method scope is detected
- **Solution**: `is_function_scope` checks for type === 'method'

### 4. Calls Inside Constructors
- **Problem**: Need to ensure constructor scope is detected
- **Solution**: `is_function_scope` checks for type === 'constructor'

### 5. Calls Inside Lambdas/Closures
- **Problem**: Lambda scope should be treated as function scope
- **Solution**: Verify scope_processor creates function-type scopes for lambdas

---

## Testing Strategy

### Unit Tests

**File**: `packages/core/src/index_single_file/scopes/scope_utils.test.ts`

Test `find_enclosing_function_scope`:

```typescript
describe('find_enclosing_function_scope', () => {
  it('should find enclosing function for call in block scope', () => {
    // Create scope tree: module > function > block
    // Call in block scope
    // Should return function scope
  });
  
  it('should return same scope for call directly in function', () => {
    // Call in function scope (not nested deeper)
    // Should return that function scope
  });
  
  it('should return module scope for top-level call', () => {
    // Call in module scope
    // Should return module scope
  });
  
  it('should stop at first function scope', () => {
    // Scope tree: module > outer_func > inner_func > block
    // Call in block
    // Should return inner_func, NOT outer_func
  });
  
  it('should handle method scope', () => {
    // Scope tree: module > class > method > block
    // Call in block
    // Should return method scope
  });
  
  it('should handle constructor scope', () => {
    // Scope tree: module > class > constructor > block
    // Call in block
    // Should return constructor scope
  });
});
```

### Integration Tests

**File**: `packages/core/src/index_single_file/semantic_index.test.ts`

Test that references created from real code have correct `enclosing_function_scope_id`:

```typescript
describe('semantic_index with enclosing_function_scope_id', () => {
  it('should set enclosing_function_scope_id for calls', () => {
    const code = `
      function outer() {
        helper1();
        if (true) {
          helper2();
        }
        function inner() {
          helper3();
        }
      }
    `;
    
    const index = build_semantic_index(code, 'test.ts' as FilePath);
    
    // Find outer's definition and body scope
    const outer_def = find_definition(index, 'outer');
    const outer_body_scope_id = outer_def.body_scope_id;
    
    // Find inner's definition and body scope
    const inner_def = find_definition(index, 'inner');
    const inner_body_scope_id = inner_def.body_scope_id;
    
    // Find call references
    const helper1_ref = find_call_reference(index, 'helper1');
    const helper2_ref = find_call_reference(index, 'helper2');
    const helper3_ref = find_call_reference(index, 'helper3');
    
    // Verify enclosing function scopes
    expect(helper1_ref.enclosing_function_scope_id).toBe(outer_body_scope_id);
    expect(helper2_ref.enclosing_function_scope_id).toBe(outer_body_scope_id); // In if block, but outer function
    expect(helper3_ref.enclosing_function_scope_id).toBe(inner_body_scope_id);  // In inner function
  });
  
  it('should handle top-level calls', () => {
    const code = `
      helper();
      function foo() {
        bar();
      }
    `;
    
    const index = build_semantic_index(code, 'test.ts' as FilePath);
    
    const helper_ref = find_call_reference(index, 'helper');
    const bar_ref = find_call_reference(index, 'bar');
    
    // helper is at module scope
    const module_scope_id = find_root_scope(index.scopes);
    expect(helper_ref.enclosing_function_scope_id).toBe(module_scope_id);
    
    // bar is in foo
    const foo_def = find_definition(index, 'foo');
    expect(bar_ref.enclosing_function_scope_id).toBe(foo_def.body_scope_id);
  });
});
```

---

## Acceptance Criteria

- [ ] `enclosing_function_scope_id` field added to CallReference type
- [ ] `find_enclosing_function_scope` helper implemented and tested
- [ ] All reference handlers updated to compute and set `enclosing_function_scope_id`
- [ ] Unit tests pass for scope traversal logic
- [ ] Integration tests pass for real code examples
- [ ] Edge cases handled: nested functions, top-level calls, methods, constructors
- [ ] No TypeScript compilation errors
- [ ] Existing tests still pass (no regressions)

---

## Dependencies

**Depends on**: 
- 11.140.1 (uses same scope matching concepts, but not strictly required)

**Blocks**:
- 11.140.5 (detect_call_graph refactoring needs this data)

---

## Implementation Notes

*(Fill in during implementation)*

### Traversal Performance

- How deep are scope trees typically?
- Any performance issues with traversal?

### Edge Case Discoveries

- Any unexpected scope configurations?
- Top-level calls behave as expected?

### Simplifications

- Any ways to optimize the traversal?
- Caching opportunities?
