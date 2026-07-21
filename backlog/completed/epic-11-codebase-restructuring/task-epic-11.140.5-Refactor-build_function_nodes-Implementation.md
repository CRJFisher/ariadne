# Sub-Task 11.140.5: Refactor build_function_nodes Implementation

**Parent Task**: task-epic-11.140
**Status**: Not Started
**Priority**: High
**Estimated Effort**: 2-3 hours

---

## Goal

Rewrite `build_function_nodes` to use semantic_index data directly. With `body_scope_id` and `enclosing_function_scope_id`, this becomes trivial filtering!

---

## Implementation

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

### New build_function_nodes

```typescript
/**
 * Build function nodes with their enclosed calls.
 * Now trivial thanks to semantic_index changes!
 */
function build_function_nodes(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry
): Map<SymbolId, FunctionNode> {
  const nodes = new Map<SymbolId, FunctionNode>();
  
  // For each file
  for (const [file_path, index] of semantic_indexes) {
    // Get all definitions in this file
    const file_defs = definitions.get_file_definitions(file_path);
    
    // Filter to function/method/constructor definitions only
    const function_defs = file_defs.filter(is_function_like);
    
    // For each function definition
    for (const func_def of function_defs) {
      // Find all CallReferences enclosed by this function
      // Simple filter: enclosing_function_scope_id === body_scope_id
      const enclosed_calls = index.references.filter(ref => {
        // Check if reference is a CallReference
        if (!is_call_reference(ref)) return false;
        
        // Check if call is enclosed by this function
        return ref.enclosing_function_scope_id === func_def.body_scope_id;
      });
      
      // Create function node
      nodes.set(func_def.symbol_id, {
        symbol_id: func_def.symbol_id,
        name: func_def.name,
        enclosed_calls: enclosed_calls as CallReference[],
        location: func_def.location,
        definition: func_def
      });
    }
  }
  
  return nodes;
}

/**
 * Type guard: check if definition is function-like
 */
function is_function_like(def: AnyDefinition): def is (FunctionDefinition | MethodDefinition | ConstructorDefinition) {
  return (
    def.kind === 'function' ||
    def.kind === 'method' ||
    def.kind === 'constructor'
  );
}

/**
 * Type guard: check if reference is a CallReference
 */
function is_call_reference(ref: any): ref is CallReference {
  return 'call_type' in ref;
}
```

---

## Key Simplifications

### Before (Complex)
```typescript
// Had to:
// 1. Look up what each reference resolves TO
// 2. Figure out which function ENCLOSES the reference
// 3. Group references by enclosing function

for (const reference of resolved.references) {
  const ref_location_key = location_key(reference.location);
  const resolved_symbol_id = resolved.resolved_references.get(ref_location_key);
  // ^ This is the ENCLOSING function, not the target!
  // Complex mapping required...
}
```

### After (Simple)
```typescript
// Just filter:
const enclosed_calls = references.filter(ref =>
  ref.enclosing_function_scope_id === func_def.body_scope_id
);
```

**Why it works**: All the hard work was done at semantic index time!

---

## Edge Cases

### 1. Top-Level Calls
- Calls with `enclosing_function_scope_id === module_scope_id`
- Won't match any function's body_scope_id
- Won't appear in any function node (correct!)

### 2. Functions with No Calls
- Filter returns empty array
- Node created with empty enclosed_calls (correct!)

### 3. Nested Functions
- Each function only gets calls where `enclosing_function_scope_id` matches its own `body_scope_id`
- Inner function calls don't leak to outer function (correct!)

---

## Testing Strategy

### Manual Walkthrough

Before writing tests, manually trace through with example:

```typescript
// Example code:
function outer() {
  helper1();
  function inner() {
    helper2();
  }
}

// After semantic_index:
// outer_def.body_scope_id = "outer_body"
// inner_def.body_scope_id = "inner_body"
// helper1_ref.enclosing_function_scope_id = "outer_body"
// helper2_ref.enclosing_function_scope_id = "inner_body"

// build_function_nodes:
// outer node: filter for enclosing === "outer_body" → [helper1_ref]
// inner node: filter for enclosing === "inner_body" → [helper2_ref]
```

Verify logic is correct before proceeding to 11.140.9 (full tests).

---

## Acceptance Criteria

- [ ] Function implemented using simple filtering
- [ ] Type guards added (is_function_like, is_call_reference)
- [ ] Logic walkthrough confirms correctness
- [ ] Code compiles
- [ ] Ready for testing in 11.140.9

---

## Dependencies

**Depends on**:
- 11.140.1 (needs body_scope_id)
- 11.140.2 (needs enclosing_function_scope_id)
- 11.140.4 (needs new signature)

**Blocks**: 11.140.7 (Project integration)
