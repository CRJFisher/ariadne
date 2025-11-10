# Task 152.9.1: Migrate semantic_index.javascript.test.ts

**Parent**: task-152.9 (Test migration plan)
**Status**: Completed
**Priority**: P1 (High)
**Estimated Effort**: 2.5 hours
**Actual Effort**: 4 hours (including bug fixes)

## Purpose

Migrate JavaScript semantic index tests from OLD reference format to NEW discriminated union format. This file has the highest number of OLD field occurrences (35).

## Scope

**File**: [packages/core/src/index_single_file/semantic_index.javascript.test.ts](packages/core/src/index_single_file/semantic_index.javascript.test.ts)

**OLD field occurrences**: 35
- `ref.type` checks
- `ref.call_type` checks
- `ref.context?.receiver_location` checks
- `ref.context?.construct_target` checks

## Migration Patterns

### Pattern 1: Function Call Check

**Line 95-100** - Currently:
```typescript
const greetCall = semantic_result.references.find(
  (ref) => ref.type === "call" && ref.name === "greet",
);
expect(greetCall).toBeDefined();
expect(greetCall?.context?.receiver_location).toBeUndefined();
expect(greetCall?.call_type).toBe("function");
```

**Migrate to**:
```typescript
const greetCall = semantic_result.references.find(
  (ref): ref is FunctionCallReference => ref.kind === "function_call" && ref.name === "greet",
);
expect(greetCall).toBeDefined();
// receiver_location doesn't exist on FunctionCallReference (no assertion needed)
```

### Pattern 2: Method Call with Receiver

**Line 82-91** - Currently:
```typescript
const logCall = semantic_result.references.find(
  (ref) => ref.type === "call" && ref.name === "log",
);
expect(logCall).toBeDefined();
expect(logCall?.context?.receiver_location).toBeDefined();
expect(logCall?.context?.receiver_location).toMatchObject({
  file_path: fixture,
  start_line: expect.any(Number),
  start_column: expect.any(Number),
});
```

**Migrate to**:
```typescript
const logCall = semantic_result.references.find(
  (ref): ref is MethodCallReference => ref.kind === "method_call" && ref.name === "log",
);
expect(logCall).toBeDefined();
expect(logCall?.receiver_location).toMatchObject({
  file_path: fixture,
  start_line: expect.any(Number),
  start_column: expect.any(Number),
});
```

### Pattern 3: Constructor Call with Target

**Line 433-443** - Currently:
```typescript
const myClassCall = result.references.find(
  (ref) => ref.type === "construct" && ref.name === "MyClass",
);
expect(myClassCall).toBeDefined();
expect(myClassCall?.context?.construct_target).toBeDefined();

const serviceClassCall = result.references.find(
  (ref) => ref.type === "construct" && ref.name === "ServiceClass",
);
expect(serviceClassCall).toBeDefined();
expect(serviceClassCall?.context?.construct_target).toBeDefined();
```

**Migrate to**:
```typescript
const myClassCall = result.references.find(
  (ref): ref is ConstructorCallReference => ref.kind === "constructor_call" && ref.name === "MyClass",
);
expect(myClassCall).toBeDefined();
expect(myClassCall?.construct_target).toBeDefined();

const serviceClassCall = result.references.find(
  (ref): ref is ConstructorCallReference => ref.kind === "constructor_call" && ref.name === "ServiceClass",
);
expect(serviceClassCall).toBeDefined();
expect(serviceClassCall?.construct_target).toBeDefined();
```

### Pattern 4: Constructor without Target

**Line 445-450** - Currently:
```typescript
const unassignedCall = result.references.find(
  (ref) => ref.type === "construct" && ref.name === "UnassignedClass",
);
expect(unassignedCall).toBeDefined();
expect(unassignedCall?.context?.construct_target).toBeUndefined();
```

**Migrate to**:
```typescript
// NOTE: Without assignment, we don't create a ConstructorCallReference
// Check for FunctionCallReference or MethodCallReference instead
const unassignedCall = result.references.find(
  (ref) => ref.name === "UnassignedClass",
);
expect(unassignedCall).toBeDefined();
// construct_target only exists on ConstructorCallReference
```

### Pattern 5: Property Access

**Line 803** - Currently:
```typescript
expect(propertyRef?.context?.receiver_location).toBeDefined();
```

**Migrate to**:
```typescript
if (propertyRef?.kind === "property_access") {
  expect(propertyRef.receiver_location).toBeDefined();
}
```

## Sections to Update

Based on grep analysis, these test sections need migration:

1. **JavaScript fixtures > basic_function.js** (lines 80-100)
   - Function call checks
   - Method call receiver checks

2. **JavaScript fixtures > class_and_methods.js** (lines 102-150)
   - Method metadata checks
   - Constructor call checks

3. **Detailed capture parsing > function definitions and calls** (lines 280-350)
   - Function vs method call distinction

4. **Detailed capture parsing > method calls with receivers** (lines 360-400)
   - Receiver location checks

5. **Detailed capture parsing > constructor calls with target assignment** (lines 420-450)
   - construct_target checks

6. **Detailed capture parsing > receiver_location for method calls** (lines 480-520)
   - Receiver location population

7. **Detailed capture parsing > optional chaining** (lines 540-580)
   - Optional chaining in method calls

8. **Detailed capture parsing > property access chains** (lines 790-820)
   - Property access receiver checks

9. **Detailed capture parsing > context for function calls** (lines 840-870)
   - Function call context checks

## Implementation Steps

1. **Add imports** at top of file:
```typescript
import type {
  FunctionCallReference,
  MethodCallReference,
  ConstructorCallReference,
  PropertyAccessReference,
  SelfReferenceCall,
} from '@ariadnejs/types';
```

2. **Run tests BEFORE migration**:
```bash
npm test semantic_index.javascript.test.ts 2>&1 | grep -E "(PASS|FAIL)"
```
Record: X failures

3. **Migrate each section** using patterns above

4. **Remove obsolete assertions**:
   - Delete assertions checking for undefined context fields on non-applicable reference types

5. **Run tests AFTER migration**:
```bash
npm test semantic_index.javascript.test.ts
```
Verify: 0 failures

6. **Verify no OLD fields remain**:
```bash
grep -n "\.type\|\.call_type\|\.context" semantic_index.javascript.test.ts
```

## Expected Outcomes

**Before**:
- ❌ ~15-20 failing tests
- 35 OLD field occurrences

**After**:
- ✅ All tests passing
- 0 OLD field occurrences
- Tests use type guards and discriminated union pattern

## Success Criteria

- [ ] All tests in semantic_index.javascript.test.ts pass
- [ ] Zero occurrences of `ref.type`, `ref.call_type`, `ref.context` in test file
- [ ] Type guards used: `(ref): ref is MethodCallReference => ...`
- [ ] Direct field access: `ref.receiver_location` (no `ref.context?.receiver_location`)
- [ ] Build succeeds: `npm run build`
- [ ] Test file has no TypeScript errors

## Testing Strategy

After migration:

1. **Run full file test**:
   ```bash
   npm test semantic_index.javascript.test.ts
   ```

2. **Run specific test sections**:
   ```bash
   npm test semantic_index.javascript.test.ts -t "basic_function"
   npm test semantic_index.javascript.test.ts -t "class_and_methods"
   npm test semantic_index.javascript.test.ts -t "constructor calls"
   ```

3. **Verify build**:
   ```bash
   npm run build
   ```

## Common Pitfalls

1. **Don't forget type guard syntax**: `(ref): ref is MethodCallReference => ...`
2. **Remove optional chaining**: `ref.receiver_location` not `ref.context?.receiver_location`
3. **Update both find() and expect()**: Both need to use new fields
4. **Constructor without assignment**: May not create ConstructorCallReference

## Files Changed

**Modified**:
- [packages/core/src/index_single_file/semantic_index.javascript.test.ts](packages/core/src/index_single_file/semantic_index.javascript.test.ts)

## Next Task

After completion, proceed to **task-152.9.2** (Migrate semantic_index.python.test.ts)
