# Task Epic-11.156.2.5: Comprehensive Callback Edge Case Tests

**Status**: TODO
**Priority**: P2 (Medium - Ensures robustness)
**Estimated Effort**: 1-2 days
**Parent Task**: task-epic-11.156.2 (Callback Invocation Detection)
**Depends On**:
- task-epic-11.156.2.1 (Migrate orphan tests)
- task-epic-11.156.2.2 (Unit tests)
- task-epic-11.156.2.3 (Semantic index tests)
- task-epic-11.156.2.4 (Project integration tests)
**Epic**: epic-11-codebase-restructuring

## Problem

The current test suite covers basic callback detection and classification, but may miss edge cases that could cause bugs:
- Deeply nested callbacks (3+ levels)
- Callbacks with complex parameter patterns
- Callbacks in unusual syntactic positions
- Callbacks mixed with other anonymous functions
- Callbacks in error handling contexts
- Callbacks with captured variables
- Cross-language edge case differences

Without edge case tests:
- Subtle bugs may go undetected
- Refactoring becomes risky
- Language-specific quirks aren't documented
- Performance issues may not be caught

## Scope

Add comprehensive edge case tests across all test levels:
- Unit tests (detect_callback_context edge cases)
- Semantic index tests (complex parsing scenarios)
- Project integration tests (complex call graph scenarios)

Target all 4 languages: TypeScript, JavaScript, Python, Rust

## Edge Cases to Cover

### 1. Deeply Nested Callbacks (3+ levels)

**Scenario**: Callback inside callback inside callback
```typescript
// TypeScript
items.map(x =>
  [x].filter(y =>
    [y].map(z => z * 2)
  )
);
```

**Test Requirements**:
- All 3 callbacks detected
- Each has correct receiver_location
- All marked as external
- None appear as entry points

### 2. Callbacks with Multiple Parameters

**Scenario**: Callback with index, array parameters
```typescript
items.map((item, index, array) => item * index);
items.reduce((acc, item, index) => acc + item, 0);
```

**Test Requirements**:
- Callback detection works regardless of parameter count
- Parameter names captured correctly in signature

### 3. Callbacks with Destructured Parameters

**Scenario**: Parameter destructuring
```typescript
// TypeScript/JavaScript
items.map(({ id, name }) => name);
items.filter(([key, value]) => value > 0);
```

```python
# Python (if supported)
items = [{'id': 1, 'name': 'Alice'}]
# Python doesn't support destructuring in lambdas directly
```

**Test Requirements**:
- Callback detection works with destructured parameters
- Doesn't crash on complex parameter patterns

### 4. Callbacks as Second or Third Argument

**Scenario**: Callback not in first position
```typescript
setTimeout(() => console.log("done"), 1000);
array.reduce((acc, x) => acc + x, 0);
```

```python
sorted(items, key=lambda x: x.name)
```

**Test Requirements**:
- Position in arguments doesn't affect detection
- receiver_location correctly points to full call

### 5. Immediately Invoked Callbacks

**Scenario**: Callback that's immediately invoked
```typescript
items.forEach(item => {
  (() => console.log(item))();  // IIFE inside callback
});
```

**Test Requirements**:
- Outer callback detected
- Inner IIFE detected as separate anonymous function
- Inner IIFE NOT detected as callback (it's invoked, not passed)

### 6. Callbacks Returning Callbacks

**Scenario**: Higher-order callback patterns
```typescript
items.map(x => (y => x + y));  // Returns a function
```

**Test Requirements**:
- Outer callback detected
- Inner function detected as separate anonymous function
- Inner function NOT detected as callback (it's returned, not passed)

### 7. Callbacks in Chained Method Calls

**Scenario**: Multiple callbacks in chain
```typescript
items
  .filter(x => x > 0)
  .map(x => x * 2)
  .forEach(x => console.log(x));
```

**Test Requirements**:
- All 3 callbacks detected
- Each has distinct receiver_location
- All marked as external

### 8. Callbacks with Try-Catch Blocks

**Scenario**: Error handling in callbacks
```typescript
items.forEach(item => {
  try {
    process(item);
  } catch (e) {
    console.error(e);
  }
});
```

**Test Requirements**:
- Callback detected correctly
- Try-catch doesn't interfere with detection

### 9. Callbacks with Async/Await (TypeScript/JavaScript)

**Scenario**: Async callbacks
```typescript
items.map(async (x) => await fetch(x));
Promise.all(items.map(async (x) => await process(x)));
```

**Test Requirements**:
- Async callbacks detected
- await doesn't interfere with detection

### 10. Callbacks in Object Methods (TypeScript/JavaScript)

**Scenario**: Callbacks using `this`
```typescript
class Processor {
  items = [1, 2, 3];

  process() {
    this.items.forEach(x => this.handle(x));
  }

  handle(x: number) { }
}
```

**Test Requirements**:
- Callback detected
- `this` references don't interfere

### 11. Callbacks with Type Annotations (TypeScript only)

**Scenario**: Explicit type annotations
```typescript
items.map((x: number): number => x * 2);
items.filter((x: string): x is string => typeof x === 'string');
```

**Test Requirements**:
- Type annotations don't interfere with detection
- Return type captured correctly

### 12. Callbacks in Ternary Expressions

**Scenario**: Conditional callback selection
```typescript
items.forEach(condition ? (x => handle1(x)) : (x => handle2(x)));
```

**Test Requirements**:
- Both callback branches detected
- Each marked correctly

### 13. Rust-Specific: Closures with Move Semantics

**Scenario**: Move closures
```rust
let data = vec![1, 2, 3];
items.iter().map(move |x| x + data[0]);
```

**Test Requirements**:
- Move closures detected same as regular closures
- Ownership semantics don't affect detection

### 14. Rust-Specific: Closures with Explicit Type Annotations

**Scenario**: Typed closures
```rust
items.iter().map(|x: &i32| -> i32 { x * 2 });
```

**Test Requirements**:
- Type annotations don't interfere with detection

### 15. Python-Specific: Nested Lambdas

**Scenario**: Lambda inside lambda
```python
list(map(lambda x: list(map(lambda y: y * 2, [x])), items))
```

**Test Requirements**:
- Both lambdas detected
- Nesting doesn't cause issues

## Implementation Plan

### Phase 1: Identify Test Location

For each edge case, determine the appropriate test file:
- **Unit tests**: If testing detect_callback_context() directly → `<lang>_builder.test.ts`
- **Semantic index**: If testing parsing/indexing → `semantic_index.<lang>.test.ts`
- **Project integration**: If testing call graph/entry points → `project.<lang>.integration.test.ts`

### Phase 2: Create Edge Case Tests

Add new describe blocks to existing test files:

**Example structure**:
```typescript
describe("Callback edge cases", () => {
  describe("Deeply nested callbacks", () => {
    it("should detect 3-level nested callbacks in TypeScript", () => {
      // Test implementation
    });
  });

  describe("Callbacks with multiple parameters", () => {
    it("should detect callback with index and array parameters", () => {
      // Test implementation
    });
  });

  // ... more edge cases
});
```

### Phase 3: Language-Specific Edge Cases

Create language-specific test sections:

**TypeScript/JavaScript specific**:
```typescript
describe("TypeScript-specific edge cases", () => {
  it("should handle async callbacks", () => { });
  it("should handle type-annotated callbacks", () => { });
  it("should handle type guards in callbacks", () => { });
});
```

**Python specific**:
```typescript
describe("Python-specific edge cases", () => {
  it("should handle lambda with keyword arguments", () => { });
  it("should handle lambda in comprehensions", () => { });
});
```

**Rust specific**:
```typescript
describe("Rust-specific edge cases", () => {
  it("should handle move closures", () => { });
  it("should handle closures with lifetime annotations", () => { });
});
```

### Phase 4: Performance Tests (Optional)

Add performance regression tests:
```typescript
describe("Performance edge cases", () => {
  it("should handle 100 callbacks in same function without timeout", () => {
    const code = `
      function process() {
        ${Array(100).fill(0).map((_, i) =>
          `items${i}.forEach(x => console.log(x));`
        ).join('\n')}
      }
    `;

    const start = Date.now();
    const index = build_semantic_index({...});
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // 5 second max
  });
});
```

## Success Criteria

- [ ] At least 15 edge case tests added across all languages
- [ ] Each language has at least 3 edge case tests
- [ ] Language-specific quirks documented in tests
- [ ] All edge case tests pass
- [ ] No performance regressions (test execution time acceptable)
- [ ] Test coverage for all identified edge cases

## Test Distribution

**TypeScript** (5 edge cases):
1. Deeply nested callbacks (3 levels)
2. Callbacks with destructured parameters
3. Async callbacks
4. Callbacks returning callbacks
5. Callbacks in chained method calls

**JavaScript** (5 edge cases):
1. Callbacks with multiple parameters
2. Callbacks as second/third argument
3. Immediately invoked callbacks in callback
4. Callbacks in try-catch blocks
5. Callbacks in object methods

**Python** (3 edge cases):
1. Nested lambdas in map/filter
2. Lambda in reduce with initial value
3. Lambda as keyword argument (key=lambda)

**Rust** (4 edge cases):
1. Move closures
2. Closures with type annotations
3. Closures in chained iterators
4. Closures with lifetime annotations (if applicable)

## Execution Steps

1. **Review edge case list**: Prioritize most likely to occur
2. **For each language**:
   - Open relevant test file
   - Add "Callback edge cases" describe block
   - Implement edge case tests
   - Run: `npm test <test-file>`
   - Fix any failures
3. **Cross-language validation**: Ensure consistent behavior
4. **Performance check**: Run full test suite, verify no slowdown
5. **Documentation**: Document any surprising edge case behaviors
6. **Commit**: `test(callbacks): Add comprehensive edge case tests`

## Related Tasks

- **task-epic-11.156.2.2**: Unit tests (may overlap with edge cases)
- **task-epic-11.156.2.3**: Semantic index tests (add edge cases here)
- **task-epic-11.156.2.4**: Project integration tests (add edge cases here)
- **task-epic-11.156.2.6**: Coverage verification (validates edge case coverage)

## Notes

- **Prioritize by likelihood**: Focus on edge cases most likely to occur in real code
- **Document unexpected behavior**: If edge case reveals surprising behavior, document it
- **Balance coverage vs. maintenance**: Don't test every possible combination, focus on meaningful edge cases
- **Performance awareness**: Some edge cases (deeply nested) may have performance implications
