# Task epic-11.116.6.1: Refactor TypeScript symbol_resolution Tests

**Status:** Not Started
**Parent:** task-epic-11.116.6
**Depends On:** 116.6.0
**Language:** TypeScript
**Priority:** High
**Estimated Effort:** 2.5 hours

## Objective

Refactor `symbol_resolution.typescript.test.ts` to use semantic_index JSON as input and resolved_symbols JSON as expected output.

## Test Pattern

```typescript
it("should resolve class constructor calls", () => {
  const semantic_index_json = load_semantic_index_fixture(
    "typescript/semantic_index/classes/basic_class.semantic_index.json"
  );
  const semantic_index = deserialize_semantic_index(semantic_index_json);
  const actual = resolve_symbols([semantic_index]);
  const expected = load_resolved_symbols_fixture(
    "typescript/resolved_symbols/classes/basic_class.resolved_symbols.json"
  );
  expect(compare_resolved_symbols(actual, expected)).toEqual({ matches: true });
});
```

## Test Coverage

- [ ] Class constructor calls
- [ ] Method calls on instances
- [ ] Static method calls
- [ ] Interface-based method resolution (.todo if not implemented)
- [ ] Generic type resolution (.todo if not implemented)
- [ ] Cross-file imports (.todo if not implemented)
- [ ] Method chaining (.todo if not implemented)

## Deliverables

- [ ] All tests refactored to use fixtures
- [ ] `.todo()` tests updated but still marked
- [ ] All non-todo tests passing
