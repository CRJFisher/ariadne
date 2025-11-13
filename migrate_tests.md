# Test Migration Plan

## Summary
Reorganizing orphan test files (`test_nested_scope.test.ts` and `verify_scopes.test.ts`) into proper companion test files following the codebase pattern.

## Migration Mapping

### Phase 1: verify_scopes.test.ts → semantic_index.<lang>.test.ts

#### TypeScript scope test → semantic_index.typescript.test.ts
- **Test**: "TypeScript: class, interface, enum in module scope"
- **New name**: "should assign class, interface, and enum to module scope"
- **Location**: Add new describe block "Scope assignment" before final `});`

#### JavaScript scope test → semantic_index.javascript.test.ts
- **Test**: "JavaScript: class in module scope"
- **New name**: "should assign class to module scope"
- **Location**: Add new describe block "Scope assignment" before final `});`

#### Python scope test → semantic_index.python.test.ts
- **Test**: "Python: class in module scope"
- **New name**: "should assign class to module scope"
- **Location**: Add new describe block "Scope assignment" before final `});`

#### Rust scope test → semantic_index.rust.test.ts
- **Test**: "Rust: struct, enum, trait in module scope"
- **New name**: "should assign struct, enum, and trait to module scope"
- **Location**: Add new describe block "Scope assignment" before final `});`

### Phase 2: test_nested_scope.test.ts → Split into semantic + project tests

#### Semantic Index Tests → semantic_index.typescript.test.ts
1. **"should create separate scopes for nested arrow functions"**
   - Add to new describe block "Anonymous functions and nested scopes"

2. **"should track constructor calls within same file"**
   - Add to existing constructor test area or new describe block "Constructor calls"

3. **~~"should track constructor in actual ReferenceBuilder.ts file"~~**
   - **DELETE** - This tests a real file, not a pattern. Not appropriate for unit tests.

4. **"should track this.method() calls within same class"**
   - Add to new describe block "Self-reference calls"

#### Project Integration Tests → Split by language

**TypeScript tests → project.typescript.integration.test.ts:**
- **"should resolve this.method() calls in call graph"**
  - Add to new describe block "Call graph resolution"

**JavaScript tests → project.javascript.integration.test.ts:**
- **"should detect callback context for anonymous functions in array methods"**
  - Add to new describe block "Callback detection and invocation"

- **"should create callback invocation reference for external function callbacks"**
  - Add to same describe block

- **"should NOT create callback invocation for internal function callbacks"**
  - Add to same describe block

## Files to Create

### Fixture Files (if needed for semantic tests)

**packages/core/tests/fixtures/typescript/callbacks.ts:**
```typescript
// External callbacks (forEach, map, filter)
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map((n) => n * 2);
const evens = numbers.filter((n) => n % 2 === 0);
numbers.forEach((n) => console.log(n));

// Internal callbacks
function runCallback(cb: () => void) {
  cb();
}
runCallback(() => console.log("internal"));

// Nested callbacks
const nested = numbers.map((n) => [n].filter((x) => x > 2));
```

**packages/core/tests/fixtures/javascript/callbacks.js:**
```javascript
// Similar to TypeScript version
```

**packages/core/tests/fixtures/python/callbacks.py:**
```python
# Lambda callbacks
numbers = [1, 2, 3, 4, 5]
doubled = list(map(lambda x: x * 2, numbers))
evens = list(filter(lambda x: x % 2 == 0, numbers))

# List comprehension (not callbacks, but for comparison)
doubled_comp = [x * 2 for x in numbers]
```

**Extend packages/core/tests/fixtures/rust/functions_and_closures.rs:**
Already has excellent callback examples (lines 257-299). No new file needed.

## Deletion Checklist

After successful migration:
- [ ] Delete `packages/core/src/test_nested_scope.test.ts`
- [ ] Delete `packages/core/src/verify_scopes.test.ts`
- [ ] Run `npm test` to verify all tests still pass
- [ ] Verify no orphan imports or references

## Test Additions Needed

### Additional Callback Tests (New, not migrated)

Each semantic_index.<lang>.test.ts needs:
1. Test for callback context detection (is_callback: true)
2. Test for non-callback anonymous function (is_callback: false)
3. Test for callback_context fields (receiver_location)

Each project.<lang>.integration.test.ts needs:
1. Test for callback invocation edge creation
2. Test for external vs internal classification
3. Test that callbacks don't appear as entry points

## Execution Order

1. ✅ Create migration plan (this document)
2. Create fixture files
3. Add scope tests to semantic_index files
4. Add semantic tests from test_nested_scope to semantic_index files
5. Add project tests from test_nested_scope to project integration files
6. Verify all new tests pass
7. Delete orphan files
8. Run full test suite
9. Document completion
