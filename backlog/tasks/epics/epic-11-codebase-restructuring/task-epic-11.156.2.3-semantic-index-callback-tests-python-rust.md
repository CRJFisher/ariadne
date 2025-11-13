# Task Epic-11.156.2.3: Semantic Index Callback Tests for Python and Rust

**Status**: TODO
**Priority**: P1 (High - Missing language coverage)
**Estimated Effort**: 1 day
**Parent Task**: task-epic-11.156.2 (Callback Invocation Detection)
**Depends On**:
- task-epic-11.156.2.1 (Migrate orphan test files first)
- task-epic-11.156.2.2 (Unit tests for context detection)
**Epic**: epic-11-codebase-restructuring

## Problem

Callback detection is implemented for Python and Rust, but there are NO semantic index integration tests for these languages:
- Python: Has `detect_callback_context()` but NO tests validating callback_context fields
- Rust: Has `detect_callback_context()` but NO tests validating callback_context fields
- TypeScript/JavaScript: Have 3 tests in orphan file (will be migrated in 11.156.2.1)

Without semantic index tests:
- Can't verify callback_context is populated correctly
- Can't validate receiver_location is captured
- Can't test language-specific callback patterns
- Regressions in callback detection won't be caught

## Scope

Add callback detection tests to semantic index test files:
1. `packages/core/src/index_single_file/semantic_index.python.test.ts`
2. `packages/core/src/index_single_file/semantic_index.rust.test.ts`

**Note**: TypeScript and JavaScript tests will be added during task-epic-11.156.2.1 (orphan file migration).

## Test Coverage Requirements

Each language's semantic_index.<lang>.test.ts needs:

### Core Callback Detection Tests

1. **External callback in array method**
   - Verify `callback_context.is_callback === true`
   - Verify `callback_context.receiver_location` is populated
   - Test forEach, map, filter, reduce

2. **Non-callback anonymous function**
   - Verify `callback_context.is_callback === false`
   - Verify `callback_context.receiver_location === null`
   - Test variable assignment, return statement

3. **Nested callbacks**
   - Verify both outer and inner callbacks detected
   - Verify each has correct receiver_location
   - Test map inside forEach, filter inside map

### Language-Specific Patterns

**Python:**
- Lambda in `map(lambda x: x*2, items)`
- Lambda in `filter(lambda x: x>0, items)`
- Lambda in `sorted(items, key=lambda x: x.name)`
- Lambda in `reduce(lambda acc, x: acc+x, items)`
- List comprehension (NOT a callback - negative test)

**Rust:**
- Closure in `items.iter().map(|x| x * 2)`
- Closure in `items.iter().filter(|x| *x > 0)`
- Closure in `items.into_iter().for_each(|x| process(x))`
- Closure in `vec.sort_by(|a, b| a.cmp(b))`
- Closure variable assignment (NOT a callback - negative test)

## Implementation Plan

### Phase 1: Python Semantic Index Tests

Add new describe block "Callback context detection" to `semantic_index.python.test.ts`:

```typescript
describe("Callback context detection", () => {
  it("should detect callback context for lambda in map", () => {
    const code = `
numbers = [1, 2, 3, 4, 5]
doubled = list(map(lambda x: x * 2, numbers))
    `;

    const index = build_semantic_index({
      file_path: "test.py",
      file_contents: code,
      language: "python"
    });

    // Find the lambda function
    const lambdas = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;
    expect(lambda.callback_context).not.toBe(undefined);
    expect(lambda.callback_context.is_callback).toBe(true);
    expect(lambda.callback_context.receiver_location).not.toBe(null);
    expect(lambda.callback_context.receiver_location?.start_line).toBe(3);
  });

  it("should detect callback context for lambda in filter", () => {
    const code = `
numbers = [1, 2, 3, 4, 5]
evens = list(filter(lambda x: x % 2 == 0, numbers))
    `;

    const index = build_semantic_index({
      file_path: "test.py",
      file_contents: code,
      language: "python"
    });

    const lambdas = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;
    expect(lambda.callback_context.is_callback).toBe(true);
    expect(lambda.callback_context.receiver_location).not.toBe(null);
  });

  it("should detect callback context for lambda in sorted with key", () => {
    const code = `
items = [{'name': 'b'}, {'name': 'a'}]
sorted_items = sorted(items, key=lambda x: x['name'])
    `;

    const index = build_semantic_index({
      file_path: "test.py",
      file_contents: code,
      language: "python"
    });

    const lambdas = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;
    expect(lambda.callback_context.is_callback).toBe(true);
  });

  it("should detect callback context for lambda in reduce", () => {
    const code = `
from functools import reduce
numbers = [1, 2, 3, 4, 5]
sum_result = reduce(lambda acc, x: acc + x, numbers, 0)
    `;

    const index = build_semantic_index({
      file_path: "test.py",
      file_contents: code,
      language: "python"
    });

    const lambdas = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;
    expect(lambda.callback_context.is_callback).toBe(true);
  });

  it("should NOT detect callback context for lambda variable assignment", () => {
    const code = `
standalone_lambda = lambda x: x + 1
    `;

    const index = build_semantic_index({
      file_path: "test.py",
      file_contents: code,
      language: "python"
    });

    const lambdas = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;
    expect(lambda.callback_context.is_callback).toBe(false);
    expect(lambda.callback_context.receiver_location).toBe(null);
  });

  it("should NOT detect callback context for lambda as default argument", () => {
    const code = `
def with_default(func=lambda: "default"):
    return func()
    `;

    const index = build_semantic_index({
      file_path: "test.py",
      file_contents: code,
      language: "python"
    });

    const lambdas = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;
    expect(lambda.callback_context.is_callback).toBe(false);
  });

  it("should detect nested callback contexts", () => {
    const code = `
nested = list(map(lambda n: list(filter(lambda x: x > 2, [n])), numbers))
    `;

    const index = build_semantic_index({
      file_path: "test.py",
      file_contents: code,
      language: "python"
    });

    const lambdas = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(2);

    // Both should be callbacks
    expect(lambdas[0].callback_context.is_callback).toBe(true);
    expect(lambdas[1].callback_context.is_callback).toBe(true);

    // Each should have different receiver locations
    const line0 = lambdas[0].callback_context.receiver_location?.start_line;
    const line1 = lambdas[1].callback_context.receiver_location?.start_line;
    expect(line0).toBe(2);
    expect(line1).toBe(2);
  });
});
```

### Phase 2: Rust Semantic Index Tests

Add new describe block "Callback context detection" to `semantic_index.rust.test.ts`:

```typescript
describe("Callback context detection", () => {
  it("should detect callback context for closure in iter().map()", () => {
    const code = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
}
    `;

    const index = build_semantic_index({
      file_path: "test.rs",
      file_contents: code,
      language: "rust"
    });

    // Find the closure
    const closures = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;
    expect(closure.callback_context).not.toBe(undefined);
    expect(closure.callback_context.is_callback).toBe(true);
    expect(closure.callback_context.receiver_location).not.toBe(null);
  });

  it("should detect callback context for closure in iter().filter()", () => {
    const code = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let evens: Vec<&i32> = numbers.iter().filter(|x| *x % 2 == 0).collect();
}
    `;

    const index = build_semantic_index({
      file_path: "test.rs",
      file_contents: code,
      language: "rust"
    });

    const closures = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;
    expect(closure.callback_context.is_callback).toBe(true);
  });

  it("should detect callback context for closure in for_each()", () => {
    const code = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    numbers.iter().for_each(|x| println!("{}", x));
}
    `;

    const index = build_semantic_index({
      file_path: "test.rs",
      file_contents: code,
      language: "rust"
    });

    const closures = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;
    expect(closure.callback_context.is_callback).toBe(true);
  });

  it("should detect callback context for closure in sort_by()", () => {
    const code = `
fn main() {
    let mut vec = vec![5, 2, 8, 1, 9];
    vec.sort_by(|a, b| a.cmp(b));
}
    `;

    const index = build_semantic_index({
      file_path: "test.rs",
      file_contents: code,
      language: "rust"
    });

    const closures = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;
    expect(closure.callback_context.is_callback).toBe(true);
  });

  it("should NOT detect callback context for closure variable assignment", () => {
    const code = `
fn main() {
    let standalone = |x| x + 1;
}
    `;

    const index = build_semantic_index({
      file_path: "test.rs",
      file_contents: code,
      language: "rust"
    });

    const closures = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;
    expect(closure.callback_context.is_callback).toBe(false);
    expect(closure.callback_context.receiver_location).toBe(null);
  });

  it("should NOT detect callback context for closure return", () => {
    const code = `
fn factory() -> impl Fn(i32) -> i32 {
    |x| x + 1
}
    `;

    const index = build_semantic_index({
      file_path: "test.rs",
      file_contents: code,
      language: "rust"
    });

    const closures = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;
    expect(closure.callback_context.is_callback).toBe(false);
  });

  it("should detect nested callback contexts", () => {
    const code = `
fn main() {
    let nested: Vec<Vec<i32>> = numbers.iter()
        .map(|n| vec![*n].into_iter().filter(|x| *x > 2).collect())
        .collect();
}
    `;

    const index = build_semantic_index({
      file_path: "test.rs",
      file_contents: code,
      language: "rust"
    });

    const closures = index.definitions.filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(2);

    // Both should be callbacks
    expect(closures[0].callback_context.is_callback).toBe(true);
    expect(closures[1].callback_context.is_callback).toBe(true);
  });
});
```

### Phase 3: Use Fixture Files (Optional)

For more complex tests, use the fixture files:
- `packages/core/tests/fixtures/python/callbacks.py`
- `packages/core/tests/fixtures/rust/functions_and_closures.rs`

```typescript
it("should detect all callbacks in fixture file", () => {
  const fixture_path = path.join(__dirname, '../../../tests/fixtures/python/callbacks.py');
  const code = fs.readFileSync(fixture_path, 'utf-8');

  const index = build_semantic_index({
    file_path: fixture_path,
    file_contents: code,
    language: "python"
  });

  const lambdas = index.definitions.filter(
    d => d.kind === 'function' && d.name === '<anonymous>'
  );

  // Expect specific number of callbacks detected
  const callbacks = lambdas.filter(l => l.callback_context.is_callback);
  expect(callbacks.length).toBeGreaterThan(0);

  // Expect specific number of non-callbacks
  const non_callbacks = lambdas.filter(l => !l.callback_context.is_callback);
  expect(non_callbacks.length).toBeGreaterThan(0);
});
```

## Success Criteria

- [ ] Python semantic index tests added
  - [ ] At least 7 tests for callback detection
  - [ ] Tests cover: map, filter, sorted, reduce, nested callbacks
  - [ ] Tests cover negative cases: variable assignment, default parameter
  - [ ] All tests pass

- [ ] Rust semantic index tests added
  - [ ] At least 7 tests for callback detection
  - [ ] Tests cover: iter().map, iter().filter, for_each, sort_by
  - [ ] Tests cover negative cases: variable assignment, closure return
  - [ ] All tests pass

- [ ] Full test suite passes: `npm test`
- [ ] No regressions in existing tests

## Execution Steps

1. **Python tests**:
   - Open `semantic_index.python.test.ts`
   - Add new describe block "Callback context detection"
   - Implement 7+ tests
   - Run: `npm test semantic_index.python.test.ts`
   - Fix any failures

2. **Rust tests**:
   - Open `semantic_index.rust.test.ts`
   - Add new describe block "Callback context detection"
   - Implement 7+ tests
   - Run: `npm test semantic_index.rust.test.ts`
   - Fix any failures

3. **Full test suite**:
   - Run: `npm test`
   - Verify no regressions

4. **Commit**:
   - `test(semantic-index): Add callback detection tests for Python and Rust`

## Related Tasks

- **task-epic-11.156.2.1**: Migrate orphan tests (adds TypeScript/JavaScript semantic tests)
- **task-epic-11.156.2.2**: Unit tests for detect_callback_context() (lower-level testing)
- **task-epic-11.156.2.4**: Project integration tests (higher-level testing)

## Notes

- **Fixture files available**: Use `callbacks.py` and `functions_and_closures.rs` for comprehensive tests
- **Language-specific patterns**: Consult fixture files for realistic callback examples
- **Semantic index focus**: These tests validate the parsing/indexing layer, not resolution/call graph
- **Callback classification**: `receiver_is_external` remains `null` at semantic index level (resolved later)
