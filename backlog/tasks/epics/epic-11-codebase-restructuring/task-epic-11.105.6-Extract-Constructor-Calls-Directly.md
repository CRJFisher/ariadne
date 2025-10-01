# Task 105.6: Extract Constructor Calls Directly

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 hours
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.4, task-epic-11.105.5

## Objective

Flatten the structure by adding `constructor_calls` directly to `SemanticIndex` instead of nesting it in `local_type_flow`. Since `LocalTypeFlowData` now only has one field, the wrapper is unnecessary.

## Rationale

Current structure:
```typescript
index.local_type_flow.constructor_calls  // Awkward nesting
```

Proposed structure:
```typescript
index.constructor_calls  // Direct, clear
```

**Benefits:**
- Simpler API (less nesting)
- Consistent with other fields (`type_annotations`, not `local.type_annotations`)
- Clear purpose (not "type flow", just "constructor calls")

## Changes

### 1. Update SemanticIndex Interface (5 min)

**File:** `src/index_single_file/semantic_index.ts`

```typescript
export interface SemanticIndex {
  // ... other fields ...

  readonly type_annotations: TypeAnnotation[];

  // BEFORE
  readonly local_type_flow: LocalTypeFlowData;

  // AFTER
  readonly constructor_calls: ConstructorCall[];
}
```

### 2. Rename Type (5 min)

**File:** `src/index_single_file/references/type_flow_references/type_flow_references.ts`

Or better, create new focused module:
**File:** `src/index_single_file/references/constructor_calls/constructor_calls.ts`

```typescript
/**
 * Constructor call extraction for type hint tracking
 */

export interface ConstructorCall {
  /** Class being instantiated (unresolved name) */
  readonly class_name: SymbolName;

  /** Location of the new expression */
  readonly location: Location;

  /** Variable name if assigned (const x = new Foo()) */
  readonly assigned_to?: SymbolName;

  /** Number of arguments (for overload resolution) */
  readonly argument_count: number;

  /** Containing scope */
  readonly scope_id: ScopeId;
}

/**
 * Extract constructor calls from captures
 */
export function extract_constructor_calls(
  captures: NormalizedCapture[],
  scopes: Map<ScopeId, LexicalScope>
): ConstructorCall[] {
  // Implementation moved from extract_type_flow
}
```

### 3. Move Implementation (30 min)

Create new module structure:

```bash
mkdir -p packages/core/src/index_single_file/references/constructor_calls
```

**Create files:**
1. `constructor_calls.ts` - Main implementation
2. `constructor_calls.test.ts` - Tests (moved from type_flow_references.test.ts)
3. `index.ts` - Exports

**Move code:**
- Copy constructor extraction logic from `type_flow_references.ts`
- Copy helper functions: `is_constructor_call`, `extract_class_name`, etc.
- Copy related tests from `type_flow_references.test.ts`

### 4. Update Semantic Index Builder (10 min)

**File:** `src/index_single_file/semantic_index.ts`

```typescript
// BEFORE
import { extract_type_flow, LocalTypeFlowData } from "./references/type_flow_references";

const local_type_flow = extract_type_flow(type_flow_captures, scopes);

return {
  // ...
  local_type_flow,
};

// AFTER
import { extract_constructor_calls, ConstructorCall } from "./references/constructor_calls";

const constructor_calls = extract_constructor_calls(
  grouped.references,  // Or appropriate captures
  scopes
);

return {
  // ...
  type_annotations,
  constructor_calls,
};
```

### 5. Update Usage in local_type_context (15 min)

**File:** `src/resolve_references/local_type_context/local_type_context.ts`

```typescript
// BEFORE
if (index.local_type_flow?.constructor_calls) {
  for (const call of index.local_type_flow.constructor_calls) {
    // ...
  }
}

// AFTER
if (index.constructor_calls) {
  for (const call of index.constructor_calls) {
    // ...
  }
}
```

### 6. Update Usage in heuristic_resolver (10 min)

**File:** `src/resolve_references/method_resolution_simple/heuristic_resolver.ts`

Check if it accesses `local_type_flow`:

```bash
grep -n "local_type_flow" packages/core/src/resolve_references/method_resolution_simple/heuristic_resolver.ts
```

Update any usage:
```typescript
// BEFORE
context.local_type_context.constructor_calls

// AFTER (if it uses semantic index directly)
context.current_index.constructor_calls
```

### 7. Update enhanced_context (10 min)

**File:** `src/resolve_references/method_resolution_simple/enhanced_context.ts`

```typescript
// BEFORE
const type_flow = index.local_type_flow;
const initializer_map = build_initializer_map(type_tracking, type_flow);

// AFTER
const constructor_calls = index.constructor_calls;
const initializer_map = build_initializer_map(constructor_calls);
```

Update helper functions to accept `ConstructorCall[]` instead of `LocalTypeFlowData`.

### 8. Delete Old Module (5 min)

After all usage updated:

```bash
# If type_flow_references is now empty/unused
rm -rf packages/core/src/index_single_file/references/type_flow_references/
```

Or keep a minimal version if there's remaining code.

### 9. Update Test Utilities (10 min)

**File:** `src/resolve_references/test_utilities.ts`

Update mock objects:

```typescript
function create_mock_semantic_index(): SemanticIndex {
  return {
    // ...

    // BEFORE
    local_type_flow: {
      constructor_calls: []
    },

    // AFTER
    constructor_calls: [],
  };
}
```

## Validation

### 1. Compilation
```bash
npm run build
# Should compile successfully
```

### 2. Test All Constructor Features
```bash
npm test -- constructor_calls.test.ts
npm test -- local_type_context.test.ts
# Should pass
```

### 3. Integration Tests
```bash
npm test -- semantic_index.*.test.ts
# All semantic index tests should pass
```

### 4. Verify Clean API
```typescript
const index = build_semantic_index(file, tree, "typescript");

// ✅ Clean access
index.type_annotations.forEach(...)
index.constructor_calls.forEach(...)

// ❌ Old nested access - should not exist
expect(index.local_type_flow).toBeUndefined();
```

## Deliverables

- [ ] New `/constructor_calls/` module created
- [ ] `constructor_calls` field added to `SemanticIndex`
- [ ] `local_type_flow` field removed
- [ ] All usage updated to new API
- [ ] Tests migrated and passing
- [ ] Old module deleted (if empty)
- [ ] Code compiles and all tests pass

## Benefits

**API Clarity:**
```typescript
// BEFORE: Nested, unclear
index.local_type_flow.constructor_calls[0].class_name

// AFTER: Flat, obvious
index.constructor_calls[0].class_name
```

**Reduced Complexity:**
- One less type definition (`LocalTypeFlowData` removed)
- One less module (merge or delete `type_flow_references`)
- Clearer purpose (not "flow", just "constructor calls")

## Next Steps

- Task 105.7: Enhance local_type_context building with better strategies
