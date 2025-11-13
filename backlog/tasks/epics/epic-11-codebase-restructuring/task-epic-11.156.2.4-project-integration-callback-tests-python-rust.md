# Task Epic-11.156.2.4: Project Integration Callback Tests for Python and Rust

**Status**: TODO
**Priority**: P1 (High - Missing end-to-end testing)
**Estimated Effort**: 1-2 days
**Parent Task**: task-epic-11.156.2 (Callback Invocation Detection)
**Depends On**:
- task-epic-11.156.2.1 (Migrate orphan test files first)
- task-epic-11.156.2.3 (Semantic index tests)
**Epic**: epic-11-codebase-restructuring

## Problem

Callback invocation detection is implemented but lacks end-to-end testing for Python and Rust:
- Python: NO project integration tests for callback invocation edges
- Rust: NO project integration tests for callback invocation edges
- TypeScript/JavaScript: Have 3 tests in orphan file (will be migrated in 11.156.2.1)

Without project integration tests:
- Can't verify callback invocation edges are created
- Can't validate external vs internal classification
- Can't test that callbacks are excluded from entry points
- Can't verify call graph includes callback invocations

## Scope

Add callback invocation tests to project integration test files:
1. `packages/core/src/project/project.python.integration.test.ts` (may need creation)
2. `packages/core/src/project/project.rust.integration.test.ts` (may need creation)

**Note**: TypeScript and JavaScript tests will be added during task-epic-11.156.2.1 (orphan file migration).

## Test Coverage Requirements

Each language's project.<lang>.integration.test.ts needs:

### Callback Invocation Edge Creation

1. **External callback invocation reference created**
   - Test: Callback passed to built-in function
   - Verify: CallReference with `is_callback_invocation: true` exists
   - Verify: `symbol_id` points to anonymous function
   - Verify: `location` points to receiver call site

2. **Internal callback NOT creating invocation reference**
   - Test: Callback passed to user-defined function
   - Verify: NO CallReference with `is_callback_invocation: true`
   - Behavior: May or may not be entry point (depends on function body)

### External vs Internal Classification

3. **Built-in function classified as external**
   - Python: `map`, `filter`, `sorted`, `reduce`
   - Rust: `iter().map`, `iter().filter`, `for_each`
   - Verify: `callback_context.receiver_is_external === true`

4. **User-defined function classified as internal**
   - Define custom higher-order function in same file
   - Verify: `callback_context.receiver_is_external === false`

5. **Library function classified as external**
   - Python: Import from standard library
   - Rust: Use external crate iterator methods
   - Verify: `callback_context.receiver_is_external === true`

### Entry Point Detection

6. **External callbacks excluded from entry points**
   - Test: Callback passed to built-in function
   - Verify: Anonymous function NOT in `call_graph.entry_points`
   - Verify: Only top-level functions appear as entry points

7. **Internal callbacks may be entry points**
   - Test: Callback passed to internal function
   - Verify: May appear in entry_points (correct behavior)
   - Reason: We don't analyze if internal function calls the callback

### Call Graph Integration

8. **Callback invocations in call graph**
   - Test: Multiple callbacks in same function
   - Verify: All callback invocations appear in call graph
   - Verify: Can traverse from caller → receiver → callback

## Implementation Plan

### Phase 1: Python Project Integration Tests

Check if `project.python.integration.test.ts` exists. If not, create it following the pattern of existing integration test files.

Add new describe block "Callback detection and invocation":

```typescript
import { describe, it, expect } from "vitest";
import { Project } from "../project";
import path from "path";

describe("Callback detection and invocation", () => {
  it("should create callback invocation reference for external function callbacks", () => {
    const code = `
numbers = [1, 2, 3, 4, 5]

def process():
    # External callback: map is built-in
    doubled = list(map(lambda x: x * 2, numbers))
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    // Create temporary file for testing
    const test_file = "test_callbacks.py";
    project.add_file(test_file, code);

    const index = project.build_index();
    const call_graph = project.get_call_graph();

    // Find the lambda function
    const lambdas = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;

    // Verify callback context
    expect(lambda.callback_context.is_callback).toBe(true);
    expect(lambda.callback_context.receiver_is_external).toBe(true);

    // Verify callback invocation reference created
    const callback_calls = Array.from(index.resolved_calls.values())
      .flat()
      .filter(call => call.is_callback_invocation === true);

    expect(callback_calls.length).toBeGreaterThan(0);

    const callback_call = callback_calls.find(
      c => c.symbol_id === lambda.symbol_id
    );
    expect(callback_call).not.toBe(undefined);
    expect(callback_call?.location.start_line).toBe(6); // map call line
  });

  it("should NOT create callback invocation for internal function callbacks", () => {
    const code = `
def run_callback(cb):
    """User-defined higher-order function"""
    cb()

def process():
    # Internal callback: run_callback is user-defined
    run_callback(lambda: print("internal"))
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.py";
    project.add_file(test_file, code);

    const index = project.build_index();

    // Find the lambda function
    const lambdas = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;

    // Verify callback context
    expect(lambda.callback_context.is_callback).toBe(true);
    expect(lambda.callback_context.receiver_is_external).toBe(false);

    // Verify NO callback invocation reference created
    const callback_calls = Array.from(index.resolved_calls.values())
      .flat()
      .filter(call =>
        call.is_callback_invocation === true &&
        call.symbol_id === lambda.symbol_id
      );

    expect(callback_calls).toHaveLength(0);
  });

  it("should NOT mark external callbacks as entry points", () => {
    const code = `
numbers = [1, 2, 3, 4, 5]

def process():
    doubled = list(map(lambda x: x * 2, numbers))
    evens = list(filter(lambda x: x % 2 == 0, numbers))
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.py";
    project.add_file(test_file, code);

    const index = project.build_index();
    const call_graph = project.get_call_graph();

    // Find lambdas
    const lambdas = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(2);

    // Verify lambdas are NOT entry points
    const entry_point_ids = new Set(call_graph.entry_points);
    for (const lambda of lambdas) {
      expect(entry_point_ids.has(lambda.symbol_id)).toBe(false);
    }

    // Verify process() IS an entry point
    const process_def = Array.from(index.definitions.values()).find(
      d => d.name === 'process'
    );
    expect(process_def).not.toBe(undefined);
    expect(entry_point_ids.has(process_def!.symbol_id)).toBe(true);
  });

  it("should classify library function callbacks as external", () => {
    const code = `
from functools import reduce

numbers = [1, 2, 3, 4, 5]

def process():
    # reduce is from functools (standard library)
    sum_result = reduce(lambda acc, x: acc + x, numbers, 0)
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.py";
    project.add_file(test_file, code);

    const index = project.build_index();

    // Find lambda
    const lambdas = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(1);

    const lambda = lambdas[0] as FunctionDefinition;
    expect(lambda.callback_context.receiver_is_external).toBe(true);
  });

  it("should handle multiple callbacks in same function", () => {
    const code = `
numbers = [1, 2, 3, 4, 5]

def process():
    doubled = list(map(lambda x: x * 2, numbers))
    evens = list(filter(lambda x: x % 2 == 0, numbers))
    sorted_desc = sorted(numbers, key=lambda x: -x)
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.py";
    project.add_file(test_file, code);

    const index = project.build_index();

    // Find all lambdas
    const lambdas = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(lambdas).toHaveLength(3);

    // All should be callbacks to external functions
    for (const lambda of lambdas) {
      expect(lambda.callback_context.is_callback).toBe(true);
      expect(lambda.callback_context.receiver_is_external).toBe(true);
    }

    // All should have callback invocation references
    const callback_calls = Array.from(index.resolved_calls.values())
      .flat()
      .filter(call => call.is_callback_invocation === true);

    expect(callback_calls).toHaveLength(3);
  });
});
```

### Phase 2: Rust Project Integration Tests

Check if `project.rust.integration.test.ts` exists. If not, create it.

Add new describe block "Callback detection and invocation":

```typescript
describe("Callback detection and invocation", () => {
  it("should create callback invocation reference for external function callbacks", () => {
    const code = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
}
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.rs";
    project.add_file(test_file, code);

    const index = project.build_index();

    // Find closure
    const closures = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;

    // Verify callback context
    expect(closure.callback_context.is_callback).toBe(true);
    expect(closure.callback_context.receiver_is_external).toBe(true);

    // Verify callback invocation reference created
    const callback_calls = Array.from(index.resolved_calls.values())
      .flat()
      .filter(call =>
        call.is_callback_invocation === true &&
        call.symbol_id === closure.symbol_id
      );

    expect(callback_calls).toHaveLength(1);
  });

  it("should NOT create callback invocation for internal function callbacks", () => {
    const code = `
fn run_callback<F>(cb: F) where F: Fn() {
    cb()
}

fn main() {
    run_callback(|| println!("internal"));
}
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.rs";
    project.add_file(test_file, code);

    const index = project.build_index();

    // Find closure
    const closures = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(1);

    const closure = closures[0] as FunctionDefinition;

    // Verify callback context
    expect(closure.callback_context.is_callback).toBe(true);
    expect(closure.callback_context.receiver_is_external).toBe(false);

    // Verify NO callback invocation reference created
    const callback_calls = Array.from(index.resolved_calls.values())
      .flat()
      .filter(call =>
        call.is_callback_invocation === true &&
        call.symbol_id === closure.symbol_id
      );

    expect(callback_calls).toHaveLength(0);
  });

  it("should NOT mark external callbacks as entry points", () => {
    const code = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
    let evens: Vec<&i32> = numbers.iter().filter(|x| *x % 2 == 0).collect();
}
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.rs";
    project.add_file(test_file, code);

    const call_graph = project.get_call_graph();

    // Find closures
    const closures = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(2);

    // Verify closures are NOT entry points
    const entry_point_ids = new Set(call_graph.entry_points);
    for (const closure of closures) {
      expect(entry_point_ids.has(closure.symbol_id)).toBe(false);
    }

    // Verify main() IS an entry point
    const main_def = Array.from(index.definitions.values()).find(
      d => d.name === 'main'
    );
    expect(main_def).not.toBe(undefined);
    expect(entry_point_ids.has(main_def!.symbol_id)).toBe(true);
  });

  it("should handle multiple callbacks in same function", () => {
    const code = `
fn process() {
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
    let evens: Vec<&i32> = numbers.iter().filter(|x| *x % 2 == 0).collect();
    numbers.iter().for_each(|x| println!("{}", x));
}
    `;

    const project = Project.from_project_path(
      path.join(__dirname, "test_project")
    );

    const test_file = "test_callbacks.rs";
    project.add_file(test_file, code);

    const index = project.build_index();

    // Find all closures
    const closures = Array.from(index.definitions.values()).filter(
      d => d.kind === 'function' && d.name === '<anonymous>'
    );
    expect(closures).toHaveLength(3);

    // All should be callbacks to external functions
    for (const closure of closures) {
      expect(closure.callback_context.is_callback).toBe(true);
      expect(closure.callback_context.receiver_is_external).toBe(true);
    }

    // All should have callback invocation references
    const callback_calls = Array.from(index.resolved_calls.values())
      .flat()
      .filter(call => call.is_callback_invocation === true);

    expect(callback_calls).toHaveLength(3);
  });
});
```

## Success Criteria

- [ ] Python project integration tests added
  - [ ] At least 5 tests for callback invocation
  - [ ] Tests cover: external callback invocation, internal callback handling, entry point exclusion
  - [ ] All tests pass

- [ ] Rust project integration tests added
  - [ ] At least 4 tests for callback invocation
  - [ ] Tests cover: external callback invocation, internal callback handling, entry point exclusion
  - [ ] All tests pass

- [ ] Full test suite passes: `npm test`
- [ ] No regressions in existing tests

## Execution Steps

1. **Check for existing integration test files**:
   ```bash
   ls packages/core/src/project/project.python.integration.test.ts
   ls packages/core/src/project/project.rust.integration.test.ts
   ```

2. **Create files if needed**:
   - Copy structure from `project.typescript.integration.test.ts`
   - Update imports and language-specific setup

3. **Python integration tests**:
   - Add describe block "Callback detection and invocation"
   - Implement 5+ tests
   - Run: `npm test project.python.integration.test.ts`
   - Fix any failures

4. **Rust integration tests**:
   - Add describe block "Callback detection and invocation"
   - Implement 4+ tests
   - Run: `npm test project.rust.integration.test.ts`
   - Fix any failures

5. **Full test suite**:
   - Run: `npm test`
   - Verify no regressions

6. **Commit**:
   - `test(project): Add callback invocation tests for Python and Rust`

## Related Tasks

- **task-epic-11.156.2.1**: Migrate orphan tests (adds TypeScript/JavaScript integration tests)
- **task-epic-11.156.2.3**: Semantic index tests (lower-level validation)
- **task-epic-11.156.2.5**: Edge case tests (covers complex scenarios)

## Notes

- **Project API usage**: These tests use the high-level Project API, not build_semantic_index directly
- **Entry point verification**: Critical to test that callbacks don't appear as entry points
- **Classification testing**: Must verify external vs internal classification works correctly
- **Call graph integration**: Verify callback invocations appear in call graph data structures
