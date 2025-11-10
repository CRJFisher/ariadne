# Task 152.9.4: Migrate Nested Scope and Project Integration Tests

**Parent**: task-152.9 (Test migration plan)
**Status**: Not Started
**Priority**: P2 (Medium)
**Estimated Effort**: 1.5 hours

## Purpose

Migrate nested scope resolution tests and project-level integration tests from OLD reference format to NEW discriminated union format.

## Scope

**Files**:
1. [packages/core/src/test_nested_scope.test.ts](packages/core/src/test_nested_scope.test.ts) - 8 OLD occurrences
2. [packages/core/src/project/project.integration.test.ts](packages/core/src/project/project.integration.test.ts) - 3 OLD occurrences
3. [packages/core/src/project/project.javascript.integration.test.ts](packages/core/src/project/project.javascript.integration.test.ts) - 2 OLD occurrences

**Total OLD field occurrences**: 13

## test_nested_scope.test.ts - Key Tests

This file tests scope resolution across nested function scopes, which is critical for the `this.method()` bug fix.

### Test 1: Constructor Call Tracking

**Current (line 140-150)**:
```typescript
const constructor_call = result.references.find(
  (ref) => ref.call_type === "constructor"
);

expect(constructor_call).toBeDefined();
expect(constructor_call?.name).toBe("ReferenceBuilder");
expect(constructor_call?.type).toBe("construct");
```

**Migrate to**:
```typescript
const constructor_call = result.references.find(
  (ref): ref is ConstructorCallReference => ref.kind === "constructor_call"
);

expect(constructor_call).toBeDefined();
expect(constructor_call?.name).toBe("ReferenceBuilder");
expect(constructor_call?.construct_target).toBeDefined();
```

### Test 2: This.method() Call Tracking

**Current (line 260-265)**:
```typescript
const this_call = result.references.find(
  (ref) => ref.type === "call" && ref.name === "build_class"
);

expect(this_call).toBeDefined();
expect(this_call?.context?.receiver_keyword).toBe("this");
```

**Migrate to**:
```typescript
const this_call = result.references.find(
  (ref): ref is SelfReferenceCall =>
    ref.kind === "self_reference_call" &&
    ref.name === "build_class" &&
    ref.keyword === "this"
);

expect(this_call).toBeDefined();
expect(this_call?.property_chain).toEqual(["this", "build_class"]);
```

### Test 3: Nested Constructor in Real File

**Current (line 200-210)**:
```typescript
const constructor_calls = result.references.filter(
  (ref) => ref.call_type === "constructor"
);

expect(constructor_calls.length).toBeGreaterThan(0);
console.log("Constructor calls:", constructor_calls.map(ref => ({
  name: ref.name,
  type: ref.type,
  construct_target: ref.context?.construct_target
})));
```

**Migrate to**:
```typescript
const constructor_calls = result.references.filter(
  (ref): ref is ConstructorCallReference => ref.kind === "constructor_call"
);

expect(constructor_calls.length).toBeGreaterThan(0);
console.log("Constructor calls:", constructor_calls.map(ref => ({
  name: ref.name,
  kind: ref.kind,
  construct_target: ref.construct_target
})));
```

## project.integration.test.ts - Project-Level Tests

These tests verify references work correctly across multi-file projects.

### Pattern: Cross-File Reference Checks

**Current**:
```typescript
const method_calls = project_index.references.filter(
  ref => ref.type === "call" && ref.call_type === "method"
);

expect(method_calls.length).toBeGreaterThan(0);
expect(method_calls[0]?.context?.receiver_location).toBeDefined();
```

**Migrate to**:
```typescript
const method_calls = project_index.references.filter(
  (ref): ref is MethodCallReference => ref.kind === "method_call"
);

expect(method_calls.length).toBeGreaterThan(0);
expect(method_calls[0]?.receiver_location).toBeDefined();
```

## project.javascript.integration.test.ts - JavaScript Project Tests

These tests verify JavaScript-specific behavior in project context.

### Pattern: JavaScript Method Resolution

**Current**:
```typescript
const console_log = refs.find(
  ref => ref.type === "call" && ref.name === "log"
);

expect(console_log?.context?.receiver_location).toBeDefined();
```

**Migrate to**:
```typescript
const console_log = refs.find(
  (ref): ref is MethodCallReference =>
    ref.kind === "method_call" && ref.name === "log"
);

expect(console_log?.receiver_location).toBeDefined();
```

## Migration Patterns

### Pattern 1: Constructor Call Filter

```typescript
// OLD
const constructors = refs.filter(ref => ref.call_type === "constructor");

// NEW
const constructors = refs.filter(
  (ref): ref is ConstructorCallReference => ref.kind === "constructor_call"
);
```

### Pattern 2: Self-Reference Call with Keyword Check

```typescript
// OLD
const selfCall = refs.find(ref =>
  ref.type === "call" && ref.context?.receiver_keyword === "this"
);

// NEW
const selfCall = refs.find((ref): ref is SelfReferenceCall =>
  ref.kind === "self_reference_call" && ref.keyword === "this"
);
```

### Pattern 3: Method Call Filter

```typescript
// OLD
const methods = refs.filter(ref =>
  ref.type === "call" && ref.call_type === "method"
);

// NEW
const methods = refs.filter(
  (ref): ref is MethodCallReference => ref.kind === "method_call"
);
```

### Pattern 4: Console.log() Debugging

```typescript
// OLD
console.log("Refs:", refs.map(ref => ({
  name: ref.name,
  type: ref.type,
  call_type: ref.call_type,
  context: ref.context
})));

// NEW
console.log("Refs:", refs.map(ref => ({
  name: ref.name,
  kind: ref.kind,
  // Add kind-specific fields based on discriminated union
  ...(ref.kind === "method_call" && { receiver: ref.receiver_location }),
  ...(ref.kind === "constructor_call" && { target: ref.construct_target })
})));
```

## Implementation Steps

### For test_nested_scope.test.ts

1. **Add imports**:
```typescript
import type {
  ConstructorCallReference,
  SelfReferenceCall,
  MethodCallReference,
} from '@ariadnejs/types';
```

2. **Run tests BEFORE**:
```bash
npm test test_nested_scope.test.ts 2>&1 | grep -E "(PASS|FAIL)"
```

3. **Migrate 3 key tests**:
   - Constructor call tracking
   - this.method() call tracking
   - Real file constructor tracking

4. **Run tests AFTER**:
```bash
npm test test_nested_scope.test.ts
```

### For project.integration.test.ts

1. **Add imports** (same as above)

2. **Run tests BEFORE**:
```bash
npm test project.integration.test.ts
```

3. **Migrate project-level reference checks**:
   - Cross-file method calls
   - Project-wide reference filtering

4. **Run tests AFTER**:
```bash
npm test project.integration.test.ts
```

### For project.javascript.integration.test.ts

1. **Add imports** (same as above)

2. **Run tests BEFORE**:
```bash
npm test project.javascript.integration.test.ts
```

3. **Migrate JavaScript-specific checks**:
   - console.log() method calls
   - JavaScript method resolution

4. **Run tests AFTER**:
```bash
npm test project.javascript.integration.test.ts
```

### Final Verification

5. **Verify no OLD fields remain**:
```bash
grep -n "\.type\|\.call_type\|\.context" test_nested_scope.test.ts
grep -n "\.type\|\.call_type\|\.context" project.integration.test.ts
grep -n "\.type\|\.call_type\|\.context" project.javascript.integration.test.ts
```

6. **Run all 3 tests together**:
```bash
npm test test_nested_scope.test.ts project.integration.test.ts project.javascript.integration.test.ts
```

## Expected Test Sections

### test_nested_scope.test.ts

1. **Nested function scopes > constructor calls within same file**
   - Tests constructor call capture in nested scopes

2. **Nested function scopes > constructor in actual ReferenceBuilder.ts**
   - Tests real file with complex nesting

3. **Nested function scopes > this.method() calls within same class**
   - Tests self-reference call resolution (THE BUG FIX scenario)

### project.integration.test.ts

1. **Multi-file project indexing**
   - Cross-file reference tracking

2. **Project-level reference resolution**
   - Method call resolution across files

### project.javascript.integration.test.ts

1. **JavaScript project semantics**
   - JavaScript-specific method call patterns

## Expected Outcomes

**Before**:
- ❌ 5-8 failing tests across 3 files
- 13 OLD field occurrences total

**After**:
- ✅ All tests passing in all 3 files
- 0 OLD field occurrences
- Self-reference call tests verify bug fix

## Success Criteria

- [ ] All tests in test_nested_scope.test.ts pass
- [ ] All tests in project.integration.test.ts pass
- [ ] All tests in project.javascript.integration.test.ts pass
- [ ] Zero occurrences of `ref.type`, `ref.call_type`, `ref.context` in all 3 files
- [ ] this.method() tests use `kind === "self_reference_call"`
- [ ] Constructor tests use `kind === "constructor_call"`
- [ ] Type guards used correctly
- [ ] Build succeeds: `npm run build`
- [ ] All 3 test files have no TypeScript errors

## Testing Strategy

After migration:

1. **Run test_nested_scope tests**:
   ```bash
   npm test test_nested_scope.test.ts
   npm test test_nested_scope.test.ts -t "constructor"
   npm test test_nested_scope.test.ts -t "this.method"
   ```

2. **Run project integration tests**:
   ```bash
   npm test project.integration.test.ts
   npm test project.javascript.integration.test.ts
   ```

3. **Run all together**:
   ```bash
   npm test -- test_nested_scope project.integration project.javascript
   ```

4. **Verify build**:
   ```bash
   npm run build
   ```

## Importance for Bug Fix

**test_nested_scope.test.ts is CRITICAL** because it tests the exact scenario that was broken:

```typescript
class Builder {
  process() {
    this.build_class(node);  // ← Was failing before self_reference_resolver.ts
  }
  build_class(node) { }
}
```

After migration, these tests will verify that:
1. Self-reference calls are correctly identified (`kind === "self_reference_call"`)
2. `this` keyword is captured (`keyword === "this"`)
3. Property chain is correct (`["this", "build_class"]`)
4. Resolution works (in task-152.9.5)

## Common Pitfalls

1. **Console.log debugging**: Update to use `ref.kind` instead of `ref.type`
2. **Filter predicates**: Use type guards `(ref): ref is MethodCallReference`
3. **Nested scope complexity**: Test file has complex nesting, be careful with scope IDs
4. **Real file tests**: Some tests read actual source files, ensure behavior matches

## Files Changed

**Modified**:
- [packages/core/src/test_nested_scope.test.ts](packages/core/src/test_nested_scope.test.ts)
- [packages/core/src/project/project.integration.test.ts](packages/core/src/project/project.integration.test.ts)
- [packages/core/src/project/project.javascript.integration.test.ts](packages/core/src/project/project.javascript.integration.test.ts)

## Next Task

After completion, proceed to **task-152.9.5** (Create self_reference_resolver.test.ts - THE BUG FIX VERIFICATION)
