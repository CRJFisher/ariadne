# Task: Verify Python Tests Pass

**Status**: Not Started
**Parent**: task-epic-11.141-Fix-Python-Class-Body-Scope-Boundaries
**Dependencies**: task-epic-11.141.3 (Integration)
**Estimated Effort**: 1-2 hours

## Objective

Verify that all Python semantic index tests pass after integrating the scope boundary extractor, confirming that the class/method depth issue is resolved.

## Expected Results

### Before Integration
- ❌ 5 Python tests failing with "Malformed scope tree" errors
- ❌ Class and method scopes at same depth (siblings)

### After Integration
- ✅ 46/46 Python tests passing
- ✅ Class scopes at depth 1 (children of module)
- ✅ Method scopes at depth 2 (children of class)

## Tests to Verify

Run the full Python semantic index test suite:
```bash
npm test -- semantic_index.python.test.ts
```

These 5 tests should now pass:
1. `Type metadata extraction > should handle generic type arguments`
2. `Attribute Access Chain Metadata > should handle self and cls in property chains`
3. `Class and method handling > should extract class definitions and methods`
4. `Definition Builder > should extract Enum classes with enum members`
5. `Definition Builder > should extract Protocol classes with property signatures`

## Verification Checklist

### 1. Scope Tree Structure
For each failing test, verify:
- [ ] Class scope exists at depth 1
- [ ] Method scopes exist at depth 2
- [ ] Method scopes are children of class scope
- [ ] No "Malformed scope tree" errors

### 2. Scope Boundaries
For Python class code:
```python
class Calculator:
    def add(self, x):
        return x + 1
```

Verify:
- [ ] Class scope starts after `:` (line 1, col ~18)
- [ ] Class scope does NOT start at `def` (line 2)
- [ ] Method scope starts at parameters `(` (line 2, col ~12)
- [ ] Method parent_id equals class scope id

### 3. Edge Cases
Test with:
- [ ] Classes with base classes: `class Child(Parent):`
- [ ] Decorated classes: `@dataclass\nclass Foo:`
- [ ] Nested classes
- [ ] Multiple methods in one class
- [ ] Async methods
- [ ] Class methods with decorators

## Debugging Strategy

If tests still fail, check:

### 1. Scope Depths
Add debug logging:
```typescript
const depths = compute_scope_depths(scopes);
for (const [scope_id, depth] of depths) {
  const scope = scopes.get(scope_id);
  console.log(`${scope.type} "${scope.name}" at depth ${depth}`);
}
```

Expected output:
```
module "" at depth 0
class "Calculator" at depth 1
method "add" at depth 2
```

### 2. Scope Locations
Check the actual boundaries:
```typescript
console.log("Class scope:", class_scope.location);
console.log("Method scope:", method_scope.location);
```

Class should start BEFORE method.

### 3. Parent-Child Relationships
```typescript
console.log("Method parent:", method_scope.parent_id);
console.log("Class id:", class_scope.id);
console.log("Class children:", class_scope.child_ids);
```

Method's parent should be class.
Class's children should include method.

## Success Criteria

- [ ] All 46 Python semantic index tests pass
- [ ] No "Malformed scope tree" errors in Python tests
- [ ] Scope depth assertions pass:
  - Module at depth 0
  - Classes at depth 1
  - Methods at depth 2
  - Nested classes at depth 2
  - Methods in nested classes at depth 3
- [ ] No regressions in other language tests

## If Tests Fail

Document the failure:
1. Which test failed?
2. What error message?
3. What are the actual scope depths?
4. What are the actual scope boundaries?

Then either:
- Fix the extractor (task 11.141.2)
- Fix the integration (task 11.141.3)
- Update this task with new findings

## Additional Verification

Run full test suite to ensure no regressions:
```bash
# All scope tests
npm test -- scope_processor.test.ts

# All Python tests
npm test -- semantic_index.python.test.ts

# Quick check of other languages
npm test -- semantic_index.typescript.test.ts
npm test -- semantic_index.javascript.test.ts
```

Expected:
- ✅ 25/25 scope_processor tests pass
- ✅ 46/46 Python tests pass
- ✅ TypeScript tests pass (no regression)
- ✅ JavaScript tests pass (no regression)

## Documentation

Update the test at `scope_processor.test.ts:1134`:
- Remove the error expectation
- Add verification of correct hierarchy
- Document that this was fixed by the scope boundary extractor

```typescript
it("should correctly handle Python class/method scope hierarchy", () => {
  // This test previously failed with "Malformed scope tree" error
  // Fixed by implementing Python scope boundary extractor (task 11.141)

  const code = `class Calculator:
    def add(self, x, y):
        return x + y`;

  const tree = pyParser.parse(code);
  const parsedFile = createParsedFile(code, "test.py", tree, "python");
  const index = build_semantic_index(parsedFile, tree, "python");

  const class_scope = Array.from(index.scopes.values()).find(
    (s) => s.type === "class"
  );
  const method_scopes = Array.from(index.scopes.values()).filter(
    (s) => s.type === "method"
  );

  expect(class_scope).toBeDefined();
  expect(method_scopes.length).toBeGreaterThan(0);

  // Verify proper parent-child relationship
  for (const method_scope of method_scopes) {
    expect(method_scope.parent_id).toBe(class_scope!.id);
  }
  expect(class_scope!.child_ids).toEqual(
    expect.arrayContaining(method_scopes.map((m) => m.id))
  );

  // Verify depths
  const depths = compute_scope_depths(index.scopes);
  expect(depths.get(class_scope!.id)).toBe(1);
  for (const method_scope of method_scopes) {
    expect(depths.get(method_scope.id)).toBe(2);
  }
});
```

## Non-Goals

- Fixing other language issues (separate tasks)
- Performance optimization (future work)
- Refactoring test structure (future work)

## Notes

This is primarily a verification task. If tests pass, document success and move to next task. If tests fail, diagnose and fix in previous tasks (11.141.2 or 11.141.3).
