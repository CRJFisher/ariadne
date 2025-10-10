# Task: Complete Architecture Cleanup and Documentation

**Status**: Not Started
**Parent**: task-epic-11.141-Fix-Python-Class-Body-Scope-Boundaries
**Dependencies**: task-epic-11.141.5 (TS/JS migration)
**Estimated Effort**: 3-4 hours

## Objective

Complete the scope boundary extractor architecture by:
1. Implementing Rust extractor (if needed)
2. Removing all ad-hoc boundary adjustment logic from `scope_processor.ts`
3. Comprehensive testing across all languages
4. Documentation of scope boundary semantics

## Part 1: Rust Scope Boundary Extractor

### Assess Need

Check if Rust has scope boundary issues:
```bash
npm test -- semantic_index.rust.test.ts
```

If all pass, Rust may not need special handling. Check `scope_processor.ts` for Rust-specific logic.

### Implementation (if needed)

File: `extractors/rust_scope_boundary_extractor.ts`

```typescript
export class RustScopeBoundaryExtractor extends BaseScopeBoundaryExtractor {
  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Rust: struct, impl, trait definitions
    // Similar to TypeScript - body is explicitly available
    const name_node = node.childForFieldName("name");
    const body_node = node.childForFieldName("body");

    return {
      symbol_location: node_to_location(name_node!, file_path),
      scope_location: node_to_location(body_node!, file_path),
    };
  }

  protected extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Rust functions: scope starts at parameters
    const name_node = node.childForFieldName("name");
    const params_node = node.childForFieldName("parameters");
    const body_node = node.childForFieldName("body");

    return {
      symbol_location: node_to_location(name_node!, file_path),
      scope_location: {
        file_path,
        start_line: params_node!.startPosition.row + 1,
        start_column: params_node!.startPosition.column + 1,
        end_line: body_node!.endPosition.row + 1,
        end_column: body_node!.endPosition.column,
      },
    };
  }

  // ... other methods
}
```

## Part 2: Remove Ad-Hoc Logic from scope_processor.ts

Once all languages use extractors, remove the old logic:

### Remove (lines ~71-100):
```typescript
// Adjust callable scope boundaries
if (is_callable_scope_type(scope_type)) {
  const is_named_function_expr = ...;
  // ... DELETE ALL THIS
}
```

### Replace with:
```typescript
// All languages now use scope boundary extractors
const boundaries = extractor.extract_boundaries(
  capture.node,
  scope_type,
  file.file_path
);

const location = boundaries.scope_location;
```

### Simplify the loop:
```typescript
for (const capture of sorted_captures) {
  if (capture.category !== SemanticCategory.SCOPE) continue;

  const scope_type = map_capture_to_scope_type(capture);
  if (!scope_type || scope_type === "module") continue;

  // Extract boundaries - works for ALL languages
  const boundaries = extractor.extract_boundaries(
    capture.node,
    scope_type,
    file.file_path
  );

  const scope_id = create_scope_id(scope_type, boundaries.scope_location);
  // ... rest of scope creation
}
```

## Part 3: Comprehensive Testing

Create a unified test suite that verifies all languages:

### File: `scope_boundary_extractor.integration.test.ts`

```typescript
describe("Scope Boundary Extractor - All Languages", () => {
  const test_cases = [
    {
      language: "python",
      code: `class Foo:\n    def bar(self): pass`,
      expected_depths: { class: 1, method: 2 },
    },
    {
      language: "typescript",
      code: `class Foo {\n  bar() {}\n}`,
      expected_depths: { class: 1, method: 2 },
    },
    {
      language: "javascript",
      code: `class Foo {\n  bar() {}\n}`,
      expected_depths: { class: 1, method: 2 },
    },
    // Add Rust if needed
  ];

  test_cases.forEach(({ language, code, expected_depths }) => {
    it(`should extract correct depths for ${language}`, () => {
      const index = build_semantic_index_for_language(code, language);
      const depths = compute_scope_depths(index.scopes);

      const class_scope = find_scope_by_type(index.scopes, "class");
      const method_scope = find_scope_by_type(index.scopes, "method");

      expect(depths.get(class_scope.id)).toBe(expected_depths.class);
      expect(depths.get(method_scope.id)).toBe(expected_depths.method);
    });
  });
});
```

## Part 4: Documentation

### Update CLAUDE.md

Add section on scope boundary semantics:

```markdown
## Scope Boundary Semantics

### Three Critical Positions

Every scope-creating construct has three positions:

1. **Symbol Location**: Where the name is declared (belongs to parent scope)
   - Class name, function name, etc.
   - Used by definition processing to determine where symbols are defined

2. **Scope Start**: Where the new scope begins
   - After class declaration syntax (`:` in Python, `{` in TS/JS)
   - Excludes the declaration itself

3. **Scope End**: Where the scope ends
   - Typically the end of the body block

### Language-Specific Extractors

Each language has a `ScopeBoundaryExtractor` that converts tree-sitter node positions
to our semantic scope model:

- **Python**: `PythonScopeBoundaryExtractor`
  - Finds `:` token for class bodies (tree-sitter reports wrong position)
  - Function scopes start at parameters

- **TypeScript/JavaScript**: `TypeScriptScopeBoundaryExtractor` / `JavaScriptScopeBoundaryExtractor`
  - Class bodies start at `{`
  - Named function expressions have special handling
  - Scope starts after `function` keyword

- **Rust**: `RustScopeBoundaryExtractor` (if implemented)
  - Similar to TypeScript

### Why This Architecture?

Tree-sitter grammars report node positions inconsistently:
- Python's `(block)` starts at first child, not at `:`
- TypeScript's `class_body` starts at `{` (correct)

Instead of scattering language-specific logic throughout `scope_processor.ts`,
we centralize it in extractor classes that transform raw positions to semantic boundaries.

### Adding New Languages

To add a new language:

1. Create `extractors/{language}_scope_boundary_extractor.ts`
2. Implement `extract_boundaries()` for each scope type
3. Add to factory in `scope_boundary_extractor.ts`
4. Write tests for boundary extraction
5. Verify scope depths are correct
```

### Create Architecture Diagram

Document the transformation:

```
┌─────────────────────┐
│  Tree-Sitter Query  │  What: Captures scope-creating nodes
│   (*.scm files)     │
└──────────┬──────────┘
           │ CaptureNode with raw position
           ▼
┌─────────────────────┐
│ Scope Boundary      │  Where: Transforms raw positions to semantic boundaries
│    Extractor        │  (language-specific)
└──────────┬──────────┘
           │ { symbol_location, scope_location }
           ▼
┌─────────────────────┐
│  Scope Processor    │  How: Builds scope tree from semantic boundaries
│                     │  (language-agnostic)
└─────────────────────┘
```

## Success Criteria

- [ ] All language extractors implemented
- [ ] All ad-hoc boundary logic removed from `scope_processor.ts`
- [ ] Unified extractor call for all languages
- [ ] All test suites pass:
  - ✅ Python: 46/46
  - ✅ TypeScript: all pass
  - ✅ JavaScript: 41/41
  - ✅ Rust: all pass
- [ ] Integration test suite created
- [ ] CLAUDE.md updated with scope boundary semantics
- [ ] Architecture diagram documented
- [ ] No "Malformed scope tree" errors across any language

## Verification Commands

```bash
# Run all semantic index tests
npm test -- semantic_index.*.test.ts

# Run scope processor tests
npm test -- scope_processor.test.ts

# Run new integration tests
npm test -- scope_boundary_extractor.integration.test.ts

# Full test suite
npm test
```

## Code Quality Checks

- [ ] No language-specific conditionals in `scope_processor.ts`
- [ ] All extractors follow same interface
- [ ] Pythonic naming throughout: `extract_boundaries`, `node_to_location`
- [ ] Comprehensive test coverage per language
- [ ] Clear error messages when extraction fails
- [ ] Documentation explains "why" not just "what"

## Non-Goals

- Performance optimization (future work)
- Changing definition/reference processing (future work)
- Adding new languages beyond current support

## Notes

This task completes the scope boundary extractor architecture. After this:
- All languages use consistent boundary extraction
- `scope_processor.ts` is language-agnostic
- Easy to add new languages
- Scope boundary semantics are explicit and documented
