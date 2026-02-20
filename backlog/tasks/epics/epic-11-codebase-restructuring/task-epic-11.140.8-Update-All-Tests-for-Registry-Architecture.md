# Sub-Task 11.140.8: Update All Tests for Registry Architecture

**Parent Task**: task-epic-11.140
**Status**: Not Started
**Priority**: High
**Estimated Effort**: 2-3 hours

---

## Goal

Update all `detect_call_graph` tests to use the new registry-based signature instead of pre-computed data structures.

---

## Affected Test Files

1. **`packages/core/src/trace_call_graph/detect_call_graph.test.ts`**
   - Main unit tests for detect_call_graph
   - Tests for build_function_nodes
   - Tests for detect_entry_points

2. **`packages/core/src/trace_call_graph/detect_call_graph.integration.test.ts`** (if exists)
   - End-to-end call graph detection
   - Multi-file scenarios

3. **`packages/core/src/project/project.test.ts`**
   - Project-level integration tests
   - Verify call graph works in full pipeline

---

## Test Update Pattern

### Before (Old Test Structure)
```typescript
it('detects simple call graph', () => {
  const code = `
    function main() {
      helper();
    }
    function helper() {
      return 42;
    }
  `;

  const semantic_index = index_source_code(code, 'test.ts', 'typescript');
  const definitions = build_definition_registry([semantic_index]);
  const imports = build_import_registry([semantic_index]);
  const resolved = resolve_references([semantic_index], definitions, imports);

  const call_graph = detect_call_graph([semantic_index], resolved);

  // assertions...
});
```

### After (New Test Structure)
```typescript
it('detects simple call graph', () => {
  const code = `
    function main() {
      helper();
    }
    function helper() {
      return 42;
    }
  `;

  const semantic_index = index_source_code(code, 'test.ts', 'typescript');
  const definitions = build_definition_registry([semantic_index]);
  const imports = build_import_registry([semantic_index]);
  const resolutions = resolve_references([semantic_index], definitions, imports);

  // New signature: pass registries directly
  const call_graph = detect_call_graph(
    new Map([['test.ts', semantic_index]]),
    definitions,
    resolutions
  );

  // assertions remain the same...
});
```

---

## Key Changes in Tests

1. **Replace `resolved` with `resolutions`**
   - Old: `resolve_references` returned custom object
   - New: Returns ResolutionCache

2. **Pass DefinitionRegistry explicitly**
   - Old: Embedded in `resolved`
   - New: Separate parameter

3. **Convert semantic_indexes to Map**
   - Signature expects `ReadonlyMap<FilePath, SemanticIndex>`

---

## Testing Scenarios to Verify

### Core Functionality
- [ ] Simple function calls (A → B)
- [ ] Recursive calls (A → A)
- [ ] Mutual recursion (A ↔ B)
- [ ] Method calls (class.method())
- [ ] Nested function calls (A → B → C)

### Entry Point Detection
- [ ] Single entry point
- [ ] Multiple entry points
- [ ] No entry points (all functions called)
- [ ] All functions are entry points

### Edge Cases
- [ ] Empty file
- [ ] No function definitions
- [ ] Functions with no calls
- [ ] Unresolved references (shouldn't crash)

### Multi-File Scenarios
- [ ] Cross-file function calls
- [ ] Import-based calls
- [ ] Mixed entry points across files

---

## Implementation Strategy

### Step 1: Update Test Helpers (if any)
```typescript
// Create test helper for common setup
function setup_call_graph_test(code: string, file_path = 'test.ts', language = 'typescript') {
  const semantic_index = index_source_code(code, file_path, language);
  const semantic_indexes = new Map([[file_path, semantic_index]]);
  const definitions = build_definition_registry([semantic_index]);
  const imports = build_import_registry([semantic_index]);
  const resolutions = resolve_references([semantic_index], definitions, imports);

  return {
    semantic_indexes,
    definitions,
    resolutions,
    detect_call_graph: () => detect_call_graph(semantic_indexes, definitions, resolutions)
  };
}
```

### Step 2: Update Each Test
- Replace old setup with new helper or inline setup
- Verify assertions still make sense
- Run test to ensure it passes

### Step 3: Verify Coverage
- Check that all code paths are tested
- Add missing tests for edge cases

---

## Acceptance Criteria

- [ ] All tests updated to new signature
- [ ] All tests pass
- [ ] No deprecated test patterns remain
- [ ] Test coverage maintained or improved
- [ ] No behavior regressions detected

---

## Dependencies

**Depends on**:
- 11.140.1 (body_scope_id added to definitions)
- 11.140.2 (enclosing_function_scope_id added to references)
- 11.140.3 (ResolutionCache.get_all_referenced_symbols)
- 11.140.4-6 (detect_call_graph refactored)
- 11.140.7 (Project integration updated)

**Blocks**:
- 11.140.9 (performance validation)

---

## Notes

- **Fix issues, don't hide them** - If a test fails, fix the implementation
- **Add new test cases** for the enhanced data (body_scope_id, enclosing_function_scope_id)
- **Document any gaps** discovered during testing
