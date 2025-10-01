# Task 105.4: Remove Unused Type Flow Fields

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1 hour
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.1

## Objective

Simplify `LocalTypeFlowData` to only contain `constructor_calls`. Remove unused fields (`assignments`, `returns`, `call_assignments`) that have stub implementations.

## Problem

Current interface has 4 fields but only 1 is used:

```typescript
export interface LocalTypeFlowData {
  readonly constructor_calls: LocalConstructorCall[];  // ✅ USED
  readonly assignments: LocalAssignmentFlow[];         // ❌ Stub implementation
  readonly returns: LocalReturnFlow[];                 // ❌ Stub implementation
  readonly call_assignments: LocalCallAssignment[];    // ❌ Stub implementation
}
```

The unused fields have placeholder implementations that return hardcoded/incomplete data.

## Changes

### 1. Simplify Interface (5 min)

**File:** `src/index_single_file/references/type_flow_references/type_flow_references.ts`

```typescript
// BEFORE
export interface LocalTypeFlowData {
  readonly constructor_calls: LocalConstructorCall[];
  readonly assignments: LocalAssignmentFlow[];
  readonly returns: LocalReturnFlow[];
  readonly call_assignments: LocalCallAssignment[];
}

// AFTER
export interface LocalTypeFlowData {
  readonly constructor_calls: LocalConstructorCall[];
}
```

### 2. Remove Unused Type Definitions (10 min)

Delete these interfaces from same file:

```typescript
// ❌ DELETE
export interface LocalAssignmentFlow { ... }
export interface LocalReturnFlow { ... }
export interface LocalCallAssignment { ... }
export type FlowSource = ...;
```

Keep only:
```typescript
export interface LocalConstructorCall { ... }
export interface LocalTypeFlowData {
  readonly constructor_calls: LocalConstructorCall[];
}
```

### 3. Simplify Extraction Function (20 min)

**File:** `src/index_single_file/references/type_flow_references/type_flow_references.ts`

```typescript
// BEFORE: Complex multi-pattern extraction
export function extract_type_flow(
  captures: NormalizedCapture[],
  scopes: Map<ScopeId, LexicalScope>
): LocalTypeFlowData {
  const constructor_calls: LocalConstructorCall[] = [];
  const assignments: LocalAssignmentFlow[] = [];
  const returns: LocalReturnFlow[] = [];
  const call_assignments: LocalCallAssignment[] = [];
  // ... 100+ lines of complex logic
}

// AFTER: Focused constructor extraction
export function extract_type_flow(
  captures: NormalizedCapture[],
  scopes: Map<ScopeId, LexicalScope>
): LocalTypeFlowData {
  const constructor_calls: LocalConstructorCall[] = [];

  // Extract only constructor calls
  for (const capture of captures) {
    if (is_constructor_call(capture)) {
      constructor_calls.push({
        class_name: extract_class_name(capture),
        location: capture.node_location,
        assigned_to: extract_assignment_target(capture),
        argument_count: count_arguments(capture),
        scope_id: get_scope_id(capture, scopes),
      });
    }
  }

  return { constructor_calls };
}
```

### 4. Remove Helper Functions (15 min)

Delete unused helper functions:

```typescript
// ❌ DELETE
function extract_assignment_flow(...)
function extract_return_flow(...)
function extract_call_assignment(...)
function is_function_call(...)
function has_assignment_target(...)
```

Keep only constructor-related helpers:
```typescript
// ✅ KEEP
function is_constructor_call(...)
function extract_class_name(...)
function extract_assignment_target(...)
function count_arguments(...)
```

### 5. Update Usage in enhanced_context.ts (10 min)

**File:** `src/resolve_references/method_resolution_simple/enhanced_context.ts`

Update code that accessed deleted fields:

```typescript
// BEFORE
const assignment_chain = build_assignment_chain(type_flow);
const return_type_map = build_return_type_map(type_flow);

// AFTER - remove these features
// assignment_chain not needed - was stub anyway
// return_type_map not needed - was stub anyway
```

If enhanced_context is still present, update it to not use removed fields.

## Validation

### 1. Type Checking (5 min)
```bash
npm run build
# Should compile without errors
```

### 2. Unit Tests (10 min)

Update test file:
**File:** `src/index_single_file/references/type_flow_references/type_flow_references.test.ts`

Remove tests for deleted features:
```typescript
// ❌ DELETE tests
describe('extract_type_flow - assignments', () => { ... })
describe('extract_type_flow - returns', () => { ... })
describe('extract_type_flow - call_assignments', () => { ... })
```

Keep only:
```typescript
// ✅ KEEP
describe('extract_type_flow - constructor_calls', () => { ... })
```

### 3. Integration Tests
```bash
npm test -- type_flow_references.test.ts
npm test -- local_type_context.test.ts
# Both should pass
```

### 4. Verify No Usage
```bash
# Should find no results
grep -r "assignments:" packages/core/src/index_single_file/references/type_flow_references/
grep -r "returns:" packages/core/src/index_single_file/references/type_flow_references/
grep -r "call_assignments:" packages/core/src/index_single_file/references/type_flow_references/
```

## Deliverables

- [ ] `LocalTypeFlowData` simplified to one field
- [ ] Unused type definitions removed
- [ ] `extract_type_flow()` simplified to 30-50 LOC
- [ ] Unused helper functions deleted
- [ ] Tests updated to match new interface
- [ ] Code compiles and tests pass

## Benefits

**Before:** 273 LOC with stub implementations
**After:** ~100 LOC with focused, complete implementation

- Clearer purpose: "Extract constructor calls for type hints"
- No misleading/incomplete features
- Easier to understand and maintain

## Next Steps

- Task 105.5: Rename local_type_annotations → type_annotations
- Task 105.6: Extract constructor_calls directly
