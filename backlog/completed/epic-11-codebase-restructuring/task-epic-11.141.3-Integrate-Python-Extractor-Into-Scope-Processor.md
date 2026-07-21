# Task: Integrate Python Extractor Into Scope Processor

**Status**: Not Started
**Parent**: task-epic-11.141-Fix-Python-Class-Body-Scope-Boundaries
**Dependencies**:
  - task-epic-11.141.1 (Infrastructure)
  - task-epic-11.141.2 (Python extractor)
**Estimated Effort**: 3-4 hours

## Objective

Refactor `scope_processor.ts` to use the Python scope boundary extractor, replacing the current ad-hoc location handling with the structured boundary extraction approach.

## Current Problem

`scope_processor.ts` currently:
1. Uses `capture.location` directly from tree-sitter
2. Has some ad-hoc adjustments for callable scopes (functions/methods)
3. Does NOT handle Python class body boundaries correctly

We need to:
1. Call `extractor.extract_boundaries()` for each scope capture
2. Use `scope_location` (not raw `capture.location`) for scope tree building
3. Preserve `symbol_location` for later use in definition processing

## Key Changes

### Change 1: Add Extractor Call

**Current code** (lines 59-65):
```typescript
for (const capture of sorted_captures) {
  if (capture.category !== SemanticCategory.SCOPE) continue;

  let location = capture.location;
  const scope_type = map_capture_to_scope_type(capture);

  if (!scope_type) continue;
```

**New code**:
```typescript
const extractor = get_scope_boundary_extractor(file.lang);

for (const capture of sorted_captures) {
  if (capture.category !== SemanticCategory.SCOPE) continue;

  const scope_type = map_capture_to_scope_type(capture);
  if (!scope_type) continue;
  if (scope_type === "module") continue; // Already created manually

  // Extract semantic boundaries using language-specific logic
  const boundaries = extractor.extract_boundaries(
    capture.node,
    scope_type,
    file.file_path
  );

  let location = boundaries.scope_location; // Use scope location, not raw capture location
```

### Change 2: Remove Ad-Hoc Adjustments (for Python)

**Current code** (lines 71-100):
```typescript
// Adjust callable scope boundaries
if (is_callable_scope_type(scope_type)) {
  const is_named_function_expr = ...;
  if (is_named_function_expr) {
    // Special handling
  } else {
    const params_node = capture.node.childForFieldName("parameters");
    if (params_node) {
      location = {
        ...location,
        start_line: params_node.startPosition.row + 1,
        start_column: params_node.startPosition.column + 1,
      };
    }
  }
}
```

**New approach**:
- This logic is now handled by `PythonScopeBoundaryExtractor.extract_function_boundaries()`
- Keep it for other languages until they're migrated
- Add conditional: `if (file.lang !== "python")` around the ad-hoc adjustment block

### Change 3: Store Both Locations (Preparation for Future)

The `symbol_location` will be needed later for definition processing. For now, we can store it in a comment or prepare data structure for future tasks:

```typescript
// Store scope info with both locations
const scope_info = {
  scope_type,
  scope_location: boundaries.scope_location,
  symbol_location: boundaries.symbol_location, // Will be used in future tasks
  symbol_name: capture.text as SymbolName,
};
```

## Implementation Steps

### Step 1: Import and Initialize Extractor

```typescript
// At top of process_scopes function
import { get_scope_boundary_extractor } from "./scope_boundary_extractor";

export function process_scopes(
  captures: CaptureNode[],
  file: ParsedFile
): Map<ScopeId, LexicalScope> {
  // ... existing root scope creation ...

  // NEW: Get language-specific extractor
  const extractor = get_scope_boundary_extractor(file.lang);
```

### Step 2: Replace Location Extraction

Replace the location extraction logic:

```typescript
for (const capture of sorted_captures) {
  if (capture.category !== SemanticCategory.SCOPE) continue;

  const scope_type = map_capture_to_scope_type(capture);
  if (!scope_type) continue;
  if (scope_type === "module") continue;

  // NEW: Extract boundaries using language-specific logic
  let location: Location;

  if (file.lang === "python") {
    // Use extractor for Python
    const boundaries = extractor.extract_boundaries(
      capture.node,
      scope_type,
      file.file_path
    );
    location = boundaries.scope_location;
  } else {
    // Keep existing logic for other languages (for now)
    location = capture.location;

    // Existing callable scope adjustments
    if (is_callable_scope_type(scope_type)) {
      // ... keep existing code ...
    }
  }

  // Rest of scope creation logic unchanged
  const scope_id = create_scope_id(scope_type, location);
  // ...
}
```

### Step 3: Test with Python Only

The integration should:
- ✅ Use extractor for Python
- ✅ Keep existing logic for TypeScript/JavaScript/Rust
- ✅ Pass all scope_processor tests
- ✅ Fix the 5 failing Python semantic index tests

## Testing Strategy

### Unit Tests

Update `scope_processor.test.ts`:

```typescript
it("should use scope boundary extractor for Python scopes", () => {
  // This test verifies the extractor is called
  // Mock the extractor to verify it's being used
  const spy = vi.spyOn(PythonScopeBoundaryExtractor.prototype, 'extract_boundaries');

  const code = `class Calculator:
    def add(self, x):
        return x`;

  const tree = pyParser.parse(code);
  const parsedFile = createParsedFile(code, "test.py", tree, "python");
  const scopes = process_scopes(captures, parsedFile);

  // Extractor should have been called for class and method
  expect(spy).toHaveBeenCalledTimes(2);
});
```

### Integration Tests

The existing test at `scope_processor.test.ts:1134` should now pass instead of throwing:

```typescript
// Change from:
it("should detect malformed Python class/method scopes at same depth", () => {
  expect(() => {
    build_semantic_index(...);
  }).toThrow(/Malformed scope tree/);
});

// To:
it("should correctly handle Python class/method scope hierarchy", () => {
  const index = build_semantic_index(...);

  const class_scope = find_scope_by_type(index.scopes, "class");
  const method_scope = find_scope_by_type(index.scopes, "method");

  // Method should be child of class
  expect(method_scope.parent_id).toBe(class_scope.id);
  expect(class_scope.child_ids).toContain(method_scope.id);

  // Verify depths
  const depths = compute_depths(index.scopes);
  expect(depths.get(class_scope.id)).toBe(1);  // Child of module
  expect(depths.get(method_scope.id)).toBe(2); // Child of class
});
```

## Success Criteria

- [ ] `get_scope_boundary_extractor()` called at start of `process_scopes()`
- [ ] Python scopes use extractor boundaries
- [ ] Other languages continue using existing logic (no regression)
- [ ] All 25 scope_processor tests pass
- [ ] Test at line 1134 updated to verify correct hierarchy (not error)
- [ ] TypeScript compilation succeeds
- [ ] No breaking changes to other language processing

## Verification

Run these test suites:
```bash
# Scope processor tests (should all pass)
npm test -- scope_processor.test.ts

# Python semantic index tests (5 should now pass that were failing)
npm test -- semantic_index.python.test.ts
```

Expected results:
- ✅ 25/25 scope_processor tests pass
- ✅ 46/46 Python semantic index tests pass (was 41/46)

## Rollback Plan

If integration causes issues:
1. Wrap extractor usage in try-catch
2. Fall back to old logic on error
3. Log warning for debugging

```typescript
try {
  if (file.lang === "python") {
    const boundaries = extractor.extract_boundaries(...);
    location = boundaries.scope_location;
  }
} catch (error) {
  console.warn(`Extractor failed for ${file.lang}:`, error);
  location = capture.location; // Fallback
}
```

## Non-Goals

- Migrating TypeScript/JavaScript/Rust (tasks 11.141.5-7)
- Removing old adjustment logic completely (task 11.141.8)
- Updating definition processing to use symbol_location (future work)

## Notes

- This is a targeted change for Python only
- Keep existing logic for other languages
- The 5 failing Python tests should pass after this integration
- Prepare for future tasks by structuring code to be easily extended
