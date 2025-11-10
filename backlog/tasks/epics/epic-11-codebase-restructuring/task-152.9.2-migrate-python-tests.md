# Task 152.9.2: Migrate semantic_index.python.test.ts

**Parent**: task-152.9 (Test migration plan)
**Status**: Not Started
**Priority**: P1 (High)
**Estimated Effort**: 2 hours

## Purpose

Migrate Python semantic index tests from OLD reference format to NEW discriminated union format. Python has language-specific reference patterns (no `new` keyword, `self` instead of `this`).

## Scope

**File**: [packages/core/src/index_single_file/semantic_index.python.test.ts](packages/core/src/index_single_file/semantic_index.python.test.ts)

**OLD field occurrences**: 21
- `ref.type` checks
- `ref.call_type` checks
- `ref.context?.receiver_location` checks

## Python-Specific Considerations

### Self-Reference Calls

Python uses `self` keyword instead of `this`:
```python
class MyClass:
    def method(self):
        self.other_method()  # ← SelfReferenceCall with keyword="self"
```

**Migration**:
```typescript
// OLD
const selfCall = refs.find(ref =>
  ref.type === "call" && ref.context?.receiver_keyword === "self"
);

// NEW
const selfCall = refs.find((ref): ref is SelfReferenceCall =>
  ref.kind === "self_reference_call" && ref.keyword === "self"
);
```

### Constructor Calls (No `new` Keyword)

Python constructors are regular function calls syntactically:
```python
obj = MyClass()  # Looks like function call, semantically is constructor
```

**Migration**:
```typescript
// OLD
const constructorCall = refs.find(ref =>
  ref.type === "construct" || ref.call_type === "constructor"
);

// NEW
const constructorCall = refs.find((ref): ref is ConstructorCallReference =>
  ref.kind === "constructor_call"
);
```

### Method Calls

Python method calls are similar to JavaScript:
```python
obj.method()  # MethodCallReference
```

## Migration Patterns

### Pattern 1: Self.method() Calls

```typescript
// OLD
const selfMethodCall = refs.find(ref =>
  ref.type === "call" &&
  ref.name === "other_method" &&
  ref.context?.receiver_keyword === "self"
);
expect(selfMethodCall?.context?.receiver_location).toBeDefined();

// NEW
const selfMethodCall = refs.find((ref): ref is SelfReferenceCall =>
  ref.kind === "self_reference_call" &&
  ref.name === "other_method" &&
  ref.keyword === "self"
);
expect(selfMethodCall?.property_chain).toEqual(["self", "other_method"]);
```

### Pattern 2: Regular Method Calls

```typescript
// OLD
const methodCall = refs.find(ref =>
  ref.type === "call" &&
  ref.name === "process" &&
  ref.context?.receiver_location
);

// NEW
const methodCall = refs.find((ref): ref is MethodCallReference =>
  ref.kind === "method_call" &&
  ref.name === "process"
);
expect(methodCall?.receiver_location).toBeDefined();
```

### Pattern 3: Function Calls

```typescript
// OLD
const funcCall = refs.find(ref =>
  ref.type === "call" &&
  ref.call_type === "function"
);
expect(funcCall?.context?.receiver_location).toBeUndefined();

// NEW
const funcCall = refs.find((ref): ref is FunctionCallReference =>
  ref.kind === "function_call"
);
// receiver_location doesn't exist on FunctionCallReference
```

### Pattern 4: Constructor Calls (Python-specific)

```typescript
// OLD
const constructorCall = refs.find(ref =>
  ref.type === "construct" && ref.name === "MyClass"
);
expect(constructorCall?.call_type).toBe("constructor");

// NEW
const constructorCall = refs.find((ref): ref is ConstructorCallReference =>
  ref.kind === "constructor_call" && ref.name === "MyClass"
);
expect(constructorCall?.construct_target).toBeDefined();
```

## Implementation Steps

1. **Add imports** at top of file:
```typescript
import type {
  FunctionCallReference,
  MethodCallReference,
  ConstructorCallReference,
  SelfReferenceCall,
} from '@ariadnejs/types';
```

2. **Run tests BEFORE migration**:
```bash
npm test semantic_index.python.test.ts 2>&1 | grep -E "(PASS|FAIL)"
```
Record: X failures

3. **Migrate Python-specific patterns**:
   - Self-reference calls (self.method())
   - Constructor calls (MyClass())
   - Method calls (obj.method())
   - Function calls (standalone functions)

4. **Update test assertions**:
   - Replace `ref.type` with `ref.kind`
   - Replace `ref.call_type` checks with discriminated union kind checks
   - Replace `ref.context?.receiver_location` with `ref.receiver_location`
   - Replace `ref.context?.receiver_keyword` with `ref.keyword`

5. **Run tests AFTER migration**:
```bash
npm test semantic_index.python.test.ts
```
Verify: 0 failures

6. **Verify no OLD fields remain**:
```bash
grep -n "\.type\|\.call_type\|\.context" semantic_index.python.test.ts
```

## Expected Test Sections

Based on Python semantic index tests, these sections likely need updates:

1. **Python class with methods**
   - Self-reference calls (self.method())
   - Method definitions

2. **Python function calls**
   - Standalone function calls
   - Function vs method distinction

3. **Python constructor calls**
   - Class instantiation without `new` keyword

4. **Python decorators**
   - Decorator resolution (if tested)

5. **Python import statements**
   - Import reference checks

## Expected Outcomes

**Before**:
- ❌ ~10-15 failing tests
- 21 OLD field occurrences

**After**:
- ✅ All tests passing
- 0 OLD field occurrences
- Tests use Python-specific discriminated union patterns

## Success Criteria

- [ ] All tests in semantic_index.python.test.ts pass
- [ ] Zero occurrences of `ref.type`, `ref.call_type`, `ref.context` in test file
- [ ] Self-reference calls check `keyword === "self"`
- [ ] Constructor calls use `kind === "constructor_call"`
- [ ] Type guards used correctly
- [ ] Build succeeds: `npm run build`
- [ ] Test file has no TypeScript errors

## Testing Strategy

After migration:

1. **Run full file test**:
   ```bash
   npm test semantic_index.python.test.ts
   ```

2. **Run specific test sections**:
   ```bash
   npm test semantic_index.python.test.ts -t "Python class"
   npm test semantic_index.python.test.ts -t "self.method"
   npm test semantic_index.python.test.ts -t "constructor"
   ```

3. **Verify build**:
   ```bash
   npm run build
   ```

## Language-Specific Notes

### Python Self-Reference Semantics

**Python classes always use `self`**:
```python
class MyClass:
    def method(self):
        self.other()  # Always "self", not "this"
```

**Discriminated union check**:
```typescript
if (ref.kind === "self_reference_call") {
  expect(ref.keyword).toBe("self");  // Python always uses "self"
}
```

### Python Constructor Semantics

**Python constructors are regular calls**:
```python
# Syntactically identical to function call
obj = MyClass()
result = process_data()

# Semantic difference determined by:
# 1. PascalCase convention
# 2. Type information (is MyClass a class?)
```

**Test should verify correct classification**:
```typescript
const constructorCall = refs.find((ref): ref is ConstructorCallReference =>
  ref.kind === "constructor_call" && ref.name === "MyClass"
);
expect(constructorCall).toBeDefined();

const functionCall = refs.find((ref): ref is FunctionCallReference =>
  ref.kind === "function_call" && ref.name === "process_data"
);
expect(functionCall).toBeDefined();
```

## Common Pitfalls

1. **Self vs This**: Python uses `self`, not `this`
2. **Constructor Detection**: No `new` keyword in Python
3. **Type Guards**: Must use type guard syntax for type narrowing
4. **Property Chain**: `self.method()` has property_chain `["self", "method"]`

## Files Changed

**Modified**:
- [packages/core/src/index_single_file/semantic_index.python.test.ts](packages/core/src/index_single_file/semantic_index.python.test.ts)

## Next Task

After completion, proceed to **task-152.9.3** (Migrate TypeScript and Rust tests)
