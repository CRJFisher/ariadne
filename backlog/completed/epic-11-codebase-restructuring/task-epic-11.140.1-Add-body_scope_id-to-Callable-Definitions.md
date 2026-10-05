# Sub-Task 11.140.1: Add body_scope_id to Callable Definitions

**Parent Task**: task-epic-11.140
**Status**: In Progress
**Priority**: High
**Estimated Effort**: 3-4 hours

---

## Goal

Link function/method/constructor definitions to their body scopes by adding a `body_scope_id` field. This enables O(1) lookup from definition → scope for call graph detection.

---

## Context

Currently, function definitions know their `defining_scope_id` (where they're defined), but NOT the scope ID of their body (where their code lives). We need the body scope to determine which calls are "inside" each function.

**Example**:
```typescript
function outer() {           // defining_scope_id: module scope
  function inner() {         // defining_scope_id: outer's body scope
    helper();                // This call is inside inner's body scope
  }
}
```

For `inner`'s definition, we need:
- `defining_scope_id`: outer's body scope (already exists)
- `body_scope_id`: inner's body scope (NEW - what we're adding)

---

## Changes Required

### 1. Update Type Definitions

**File**: `packages/types/src/symbol_definitions.ts`

Add `body_scope_id` to callable definitions:

```typescript
export interface FunctionDefinition {
  // ... existing fields
  readonly body_scope_id: ScopeId;  // NEW
}

export interface MethodDefinition {
  // ... existing fields
  readonly body_scope_id: ScopeId;  // NEW
}

export interface ConstructorDefinition {
  // ... existing fields
  readonly body_scope_id: ScopeId;  // NEW
}
```

**Note**: Only callable definitions need this. Classes, variables, etc. don't have "body scopes" in the same sense.

---

### 2. Update scope_processor.ts (Scope Creation)

**File**: `packages/core/src/index_single_file/scopes/scope_processor.ts`

**No changes needed here!** Scopes are already created with correct IDs. This file creates the scopes that definitions will reference.

**What we have**:
- Scopes created with IDs based on type + location
- Function/method/constructor scopes already exist
- Parent-child relationships established

**What we need**: A way to find "which scope corresponds to this function definition?"

---

### 3. Update Definition Handlers (Add body_scope_id)

**Files to update**:
- `packages/core/src/index_single_file/definitions/function_handler.ts`
- `packages/core/src/index_single_file/definitions/method_handler.ts`
- `packages/core/src/index_single_file/definitions/constructor_handler.ts`

**For each handler**, add logic to compute `body_scope_id`:

```typescript
// In function/method/constructor handler:

function create_definition(capture: CaptureNode, context: ProcessingContext): FunctionDefinition {
  // ... existing logic to get defining_scope_id, location, name, etc.

  // NEW: Find the body scope
  const body_scope_id = find_body_scope_for_definition(
    capture,
    context.scopes,
    definition_name,
    location
  );

  return {
    // ... existing fields
    body_scope_id,  // NEW
  };
}
```

---

### 4. Implement find_body_scope_for_definition Helper

**File**: `packages/core/src/index_single_file/scopes/scope_utils.ts` (new or existing)

**Strategy**: Match scopes by type, name, and location proximity.

```typescript
/**
 * Find the body scope for a function/method/constructor definition.
 * 
 * Matches by:
 * 1. Scope type (function/method/constructor)
 * 2. Scope name matches definition name
 * 3. Scope location contains or closely follows definition location
 * 
 * @param capture - The definition's capture node
 * @param scopes - All scopes in the file
 * @param def_name - Definition name
 * @param def_location - Definition location
 * @returns The matching scope ID
 */
export function find_body_scope_for_definition(
  capture: CaptureNode,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  def_name: SymbolName,
  def_location: Location
): ScopeId {
  // Filter to function/method/constructor scopes only
  const callable_scopes = Array.from(scopes.values()).filter(scope =>
    scope.type === 'function' || scope.type === 'method' || scope.type === 'constructor'
  );

  // Find scope with matching name
  let candidates = callable_scopes.filter(scope => scope.name === def_name);

  // If no name match (anonymous functions), use location only
  if (candidates.length === 0) {
    candidates = callable_scopes;
  }

  // Find scope whose location contains or immediately follows the definition
  // The scope's location should start at or just after the definition's location
  let best_match: LexicalScope | undefined;
  let smallest_distance = Infinity;

  for (const scope of candidates) {
    // Check if scope location is close to definition location
    const distance = calculate_location_distance(def_location, scope.location);
    
    if (distance >= 0 && distance < smallest_distance) {
      smallest_distance = distance;
      best_match = scope;
    }
  }

  if (!best_match) {
    throw new Error(
      `No body scope found for ${def_name} at ${def_location.file_path}:${def_location.start_line}`
    );
  }

  return best_match.id;
}

/**
 * Calculate distance between definition location and scope location.
 * Returns:
 * - 0 if scope starts exactly at definition
 * - Positive number if scope starts after definition (typical)
 * - Negative number if scope starts before definition (shouldn't happen)
 */
function calculate_location_distance(def_loc: Location, scope_loc: Location): number {
  const def_pos = def_loc.start_line * 10000 + def_loc.start_column;
  const scope_pos = scope_loc.start_line * 10000 + scope_loc.start_column;
  return scope_pos - def_pos;
}
```

---

## Edge Cases to Handle

### 1. Anonymous Functions
- **Problem**: No name to match
- **Solution**: Match by location proximity only

### 2. Nested Functions with Same Name
- **Problem**: Multiple scopes with name "helper"
- **Solution**: Choose closest by location distance

### 3. Method in Class
- **Problem**: Need to distinguish method scopes from functions
- **Solution**: Scope type should already be "method"

### 4. Constructor
- **Problem**: Name might be class name or "constructor"
- **Solution**: Scope type "constructor" + location matching

### 5. Arrow Functions (JavaScript/TypeScript)
- **Problem**: Might not have a separate body scope in tree-sitter output
- **Solution**: Verify scope_processor creates scopes for arrow functions, or handle specially

---

## Testing Strategy

### Unit Tests

**File**: `packages/core/src/index_single_file/scopes/scope_utils.test.ts`

Test `find_body_scope_for_definition`:

```typescript
describe('find_body_scope_for_definition', () => {
  it('should find body scope for simple function', () => {
    // Create mock scopes and definition
    // Verify body_scope_id matches expected scope
  });

  it('should find body scope for nested function', () => {
    // Test nested function can find its own body scope
  });

  it('should find body scope for anonymous function', () => {
    // Test matching by location when name is unavailable
  });

  it('should find body scope for method', () => {
    // Test method scope matching
  });

  it('should find body scope for constructor', () => {
    // Test constructor scope matching
  });

  it('should throw error when no scope matches', () => {
    // Test error handling
  });
});
```

### Integration Tests

**File**: `packages/core/src/index_single_file/semantic_index.test.ts`

Test that definitions created from real code have correct `body_scope_id`:

```typescript
describe('semantic_index with body_scope_id', () => {
  it('should set body_scope_id for function definitions', () => {
    const code = `
      function outer() {
        function inner() {
          return 42;
        }
        return inner();
      }
    `;
    
    const index = build_semantic_index(code, 'test.ts' as FilePath);
    
    // Find 'outer' definition
    const outer_def = find_definition(index, 'outer');
    expect(outer_def.body_scope_id).toBeDefined();
    
    // Verify body_scope is a function scope
    const outer_body_scope = index.scopes.get(outer_def.body_scope_id);
    expect(outer_body_scope?.type).toBe('function');
    expect(outer_body_scope?.name).toBe('outer');
    
    // Same for 'inner'
    const inner_def = find_definition(index, 'inner');
    expect(inner_def.body_scope_id).toBeDefined();
    
    const inner_body_scope = index.scopes.get(inner_def.body_scope_id);
    expect(inner_body_scope?.type).toBe('function');
    expect(inner_body_scope?.name).toBe('inner');
  });
});
```

---

## Acceptance Criteria

- [ ] `body_scope_id` field added to FunctionDefinition, MethodDefinition, ConstructorDefinition types
- [ ] `find_body_scope_for_definition` helper implemented and tested
- [ ] All definition handlers updated to compute and set `body_scope_id`
- [ ] Unit tests pass for scope matching logic
- [ ] Integration tests pass for real code examples
- [ ] Edge cases handled: anonymous functions, nested functions, methods, constructors
- [ ] No TypeScript compilation errors
- [ ] Existing tests still pass (no regressions)

---

## Dependencies

**Depends on**: None (this is the first sub-task)

**Blocks**:
- 11.140.2 (needs body_scope_id concept established)
- 11.140.5 (refactoring detect_call_graph needs this data)

---

## Implementation Notes

*(Fill in during implementation)*

### Matching Strategy Results

- How well does location-based matching work?
- Any cases where matching fails?

### Performance

- Time to compute body_scope_id during indexing?
- Impact on overall indexing time?

### Discoveries

- Any unexpected edge cases?
- Any simplifications found?
