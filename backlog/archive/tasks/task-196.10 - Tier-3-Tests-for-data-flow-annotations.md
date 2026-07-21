---
id: TASK-196.10
title: "Tier 3: Tests for data flow annotations"
status: To Do
assignee: []
created_date: "2026-03-26 11:28"
labels:
  - testing
  - tier-3
dependencies:
  - TASK-196.9
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Comprehensive tests for argument text extraction, return value usage detection, and parameter-to-argument mapping.

### Argument Text Extraction Tests (~22 tests across languages)

**JS/TS** (in `metadata_extractors.javascript.test.ts`):

- Simple args: `foo(1, "hello", x)` → `["1", '"hello"', "x"]`
- Method call: `obj.method(a, b)` → `["a", "b"]`
- Constructor: `new Foo(config)` → `["config"]`
- Complex: `foo(a + b, arr.map(x => x * 2))` → full text
- No args: `foo()` → `[]`
- Spread: `foo(...args)` → `["...args"]`
- Nested calls: `foo(bar(x))` → `["bar(x)"]`
- Long arg truncation (>80 chars) with ellipsis
- Template literal, multi-line arg

**Python** (in `metadata_extractors.python.test.ts`):

- Keyword args: `foo(key=value)` → `["key=value"]`
- Star/double-star: `foo(*args, **kwargs)` → `["*args", "**kwargs"]`
- Comprehension as arg, self.method args

**Rust** (in `metadata_extractors.rust.test.ts`):

- Reference args: `foo(&x, &mut y)` → `["&x", "&mut y"]`
- Closure as arg, turbofish

### Return Value Usage Tests (~25 tests across languages)

**JS/TS**: assigned (const/let/reassign), passed_as_argument (1st/2nd position), returned, condition (if/while/ternary), chained, discarded
**Python**: assigned, condition (if/assert), returned, passed, discarded
**Rust**: let binding, if condition, chained (.unwrap()), discarded, implicit return (last expr without semicolon), match scrutinee

### Parameter Mapping Tests (~8 tests in `call_resolver.test.ts`)

- Positional with names and types
- Fewer args than params
- More args than params (rest/variadic)
- No args / no params → empty
- No callee definition → undefined param info
- Python keyword args mapped positionally
- Constructor parameter mapping

### Integration Tests (~10 tests in `project.integration.test.ts`)

- TS: argument_texts end-to-end, return_value_usage (assigned/discarded/condition/chained)
- TS: parameter mapping through call resolution, cross-file mapping
- Python: keyword args, condition usage
- Nested calls: inner call passed_as_argument
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 ~22 argument text extraction tests across 3 languages
- [ ] #2 ~25 return value usage detection tests across 3 languages
- [ ] #3 ~8 parameter-to-argument mapping tests
- [ ] #4 ~10 integration tests through real pipeline
- [ ] #5 All existing tests pass
- [ ] #6 All new tests pass
<!-- AC:END -->
