# Task 152.9.3: Migrate TypeScript and Rust Semantic Index Tests

**Parent**: task-152.9 (Test migration plan)
**Status**: Not Started
**Priority**: P1 (High)
**Estimated Effort**: 1.5 hours

## Purpose

Migrate TypeScript and Rust semantic index tests from OLD reference format to NEW discriminated union format. These files have fewer OLD occurrences and can be grouped together.

## Scope

**Files**:
1. [packages/core/src/index_single_file/semantic_index.typescript.test.ts](packages/core/src/index_single_file/semantic_index.typescript.test.ts) - 14 OLD occurrences
2. [packages/core/src/index_single_file/semantic_index.rust.test.ts](packages/core/src/index_single_file/semantic_index.rust.test.ts) - 3 OLD occurrences

**Total OLD field occurrences**: 17

## TypeScript-Specific Considerations

### This-Reference Calls

TypeScript uses `this` keyword:
```typescript
class MyClass {
  method() {
    this.other();  // ← SelfReferenceCall with keyword="this"
  }
}
```

### Constructor Calls with `new` Keyword

TypeScript has explicit `new` keyword:
```typescript
const obj = new MyClass();  // ← ConstructorCallReference
```

### Optional Chaining

TypeScript supports optional chaining:
```typescript
obj?.method?.();  // ← MethodCallReference with optional_chaining=true
```

## Rust-Specific Considerations

### Self-Reference Calls

Rust uses `self` keyword:
```rust
impl MyStruct {
    fn method(&self) {
        self.other();  // ← SelfReferenceCall with keyword="self"
    }
}
```

### Associated Functions

Rust has associated functions (static methods):
```rust
MyStruct::new()  // ← Function call, NOT constructor
```

### Struct Instantiation

Rust struct instantiation is different:
```rust
let obj = MyStruct { field: value };  // ← ConstructorCallReference?
```

## Migration Patterns

### Pattern 1: TypeScript this.method() Calls

```typescript
// OLD
const thisCall = refs.find(ref =>
  ref.type === "call" &&
  ref.context?.receiver_keyword === "this"
);

// NEW
const thisCall = refs.find((ref): ref is SelfReferenceCall =>
  ref.kind === "self_reference_call" &&
  ref.keyword === "this"
);
```

### Pattern 2: TypeScript Constructor Calls

```typescript
// OLD
const constructorCall = refs.find(ref =>
  ref.type === "construct" && ref.name === "MyClass"
);
expect(constructorCall?.context?.construct_target).toBeDefined();

// NEW
const constructorCall = refs.find((ref): ref is ConstructorCallReference =>
  ref.kind === "constructor_call" && ref.name === "MyClass"
);
expect(constructorCall?.construct_target).toBeDefined();
```

### Pattern 3: TypeScript Optional Chaining

```typescript
// OLD
const optionalCall = refs.find(ref =>
  ref.type === "call" &&
  ref.context?.optional_chaining === true
);

// NEW
const optionalCall = refs.find((ref): ref is MethodCallReference =>
  ref.kind === "method_call" &&
  ref.optional_chaining === true
);
```

### Pattern 4: Rust Self Calls

```typescript
// OLD
const rustSelfCall = refs.find(ref =>
  ref.type === "call" &&
  ref.context?.receiver_keyword === "self"
);

// NEW
const rustSelfCall = refs.find((ref): ref is SelfReferenceCall =>
  ref.kind === "self_reference_call" &&
  ref.keyword === "self"
);
```

### Pattern 5: Rust Associated Functions

```typescript
// OLD
const associatedFn = refs.find(ref =>
  ref.type === "call" &&
  ref.call_type === "function" &&
  ref.context?.receiver_type
);

// NEW - Associated functions are still function calls
const associatedFn = refs.find((ref): ref is FunctionCallReference =>
  ref.kind === "function_call"
);
```

## Implementation Steps

### For semantic_index.typescript.test.ts

1. **Add imports**:
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
npm test semantic_index.typescript.test.ts 2>&1 | grep -E "(PASS|FAIL)"
```

3. **Migrate TypeScript patterns**:
   - this.method() calls
   - Constructor calls with `new`
   - Optional chaining checks
   - Method vs function distinction

4. **Run tests AFTER migration**:
```bash
npm test semantic_index.typescript.test.ts
```

### For semantic_index.rust.test.ts

1. **Add imports** (same as above)

2. **Run tests BEFORE migration**:
```bash
npm test semantic_index.rust.test.ts 2>&1 | grep -E "(PASS|FAIL)"
```

3. **Migrate Rust patterns**:
   - self.method() calls
   - Associated function calls (MyStruct::new)
   - Struct instantiation

4. **Run tests AFTER migration**:
```bash
npm test semantic_index.rust.test.ts
```

### Final Verification

5. **Verify no OLD fields remain**:
```bash
grep -n "\.type\|\.call_type\|\.context" semantic_index.typescript.test.ts
grep -n "\.type\|\.call_type\|\.context" semantic_index.rust.test.ts
```

6. **Run both tests together**:
```bash
npm test semantic_index.typescript.test.ts semantic_index.rust.test.ts
```

## Expected Test Sections

### TypeScript Tests

1. **Class method calls**
   - this.method() resolution
   - Method call receivers

2. **Constructor calls**
   - new MyClass() with assignment
   - Constructor target tracking

3. **Optional chaining**
   - obj?.method?.()
   - Optional property access

4. **Function vs method distinction**
   - Standalone function calls
   - Method calls on objects

### Rust Tests

1. **Impl block methods**
   - self.method() calls
   - Method receivers

2. **Associated functions**
   - MyStruct::new() calls
   - Static function calls

3. **Struct instantiation**
   - MyStruct { field: value }
   - Constructor semantics in Rust

## Expected Outcomes

**Before**:
- ❌ ~5-8 failing tests across both files
- 17 OLD field occurrences total

**After**:
- ✅ All tests passing in both files
- 0 OLD field occurrences
- Language-specific patterns properly tested

## Success Criteria

- [ ] All tests in semantic_index.typescript.test.ts pass
- [ ] All tests in semantic_index.rust.test.ts pass
- [ ] Zero occurrences of `ref.type`, `ref.call_type`, `ref.context` in both files
- [ ] TypeScript `this` keyword handled correctly
- [ ] Rust `self` keyword handled correctly
- [ ] Optional chaining tests migrated
- [ ] Type guards used correctly
- [ ] Build succeeds: `npm run build`
- [ ] Both test files have no TypeScript errors

## Testing Strategy

After migration:

1. **Run TypeScript tests**:
   ```bash
   npm test semantic_index.typescript.test.ts
   npm test semantic_index.typescript.test.ts -t "this.method"
   npm test semantic_index.typescript.test.ts -t "constructor"
   npm test semantic_index.typescript.test.ts -t "optional chaining"
   ```

2. **Run Rust tests**:
   ```bash
   npm test semantic_index.rust.test.ts
   npm test semantic_index.rust.test.ts -t "self"
   npm test semantic_index.rust.test.ts -t "associated"
   ```

3. **Run both together**:
   ```bash
   npm test -- semantic_index.typescript.test.ts semantic_index.rust.test.ts
   ```

4. **Verify build**:
   ```bash
   npm run build
   ```

## Language Comparison Table

| Feature | TypeScript | Rust | Discriminated Union Kind |
|---------|-----------|------|-------------------------|
| Self-reference | `this` | `self` | `self_reference_call` |
| Constructor | `new MyClass()` | `MyStruct { }` | `constructor_call` |
| Method call | `obj.method()` | `obj.method()` | `method_call` |
| Function call | `func()` | `func()` | `function_call` |
| Static method | `MyClass.static()` | `MyStruct::new()` | `function_call` |
| Optional chaining | `obj?.method?.()` | N/A | `method_call` with `optional_chaining=true` |

## Common Pitfalls

1. **TypeScript vs Rust self**: TypeScript uses `this`, Rust uses `self`
2. **Rust associated functions**: These are NOT method calls, they're function calls
3. **Optional chaining**: Only exists in TypeScript, stored as field on reference
4. **Type guards**: Must use type guard syntax for TypeScript narrowing

## Files Changed

**Modified**:
- [packages/core/src/index_single_file/semantic_index.typescript.test.ts](packages/core/src/index_single_file/semantic_index.typescript.test.ts)
- [packages/core/src/index_single_file/semantic_index.rust.test.ts](packages/core/src/index_single_file/semantic_index.rust.test.ts)

## Next Task

After completion, proceed to **task-152.9.4** (Migrate nested scope and project integration tests)
