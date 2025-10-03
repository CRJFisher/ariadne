# Task epic-11.116.5.0: Test Helpers for semantic_index Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** 116.4
**Priority:** High (blocks 116.5.1-116.5.4)
**Estimated Effort:** 2 hours

## Objective

Implement shared test helper functions for loading fixtures and comparing semantic index outputs. These helpers will be used across all language-specific semantic_index integration tests.

## Test Helpers to Implement

**Location:** `packages/core/tests/fixtures/test_helpers.ts`

### 1. load_code_fixture()

Load and parse a code fixture file:

```typescript
/**
 * Load and parse a code fixture
 * @param path - Relative path from fixtures root (e.g., "typescript/code/classes/basic_class.ts")
 * @returns Parsed code, ParsedFile object, and language
 */
export function load_code_fixture(path: string): {
  code: string;
  parsed: ParsedFile;
  language: Language;
  file_path: FilePath;
}
```

**Implementation requirements:**
- Resolve path from fixtures root
- Read file contents
- Determine language from file extension
- Initialize appropriate tree-sitter parser
- Parse code and create ParsedFile
- Return all relevant data

### 2. load_semantic_index_fixture()

Load a semantic index JSON fixture:

```typescript
/**
 * Load a semantic_index JSON fixture
 * @param path - Relative path from fixtures root
 * @returns Parsed JSON as SemanticIndexFixture
 */
export function load_semantic_index_fixture(path: string): SemanticIndexFixture
```

**Implementation requirements:**
- Resolve path from fixtures root
- Read and parse JSON
- Validate JSON structure (basic validation)
- Return typed fixture object

### 3. compare_semantic_index()

Compare actual semantic index against expected fixture:

```typescript
/**
 * Compare actual semantic index against expected fixture
 * @param actual - SemanticIndex from build_semantic_index()
 * @param expected - SemanticIndexFixture from JSON
 * @returns Comparison result with matches boolean and optional diffs
 */
export function compare_semantic_index(
  actual: SemanticIndex,
  expected: SemanticIndexFixture
): ComparisonResult

interface ComparisonResult {
  matches: boolean;
  diffs?: Array<{
    path: string;
    expected: any;
    actual: any;
    message?: string;
  }>;
}
```

**Implementation requirements:**
- Normalize both structures before comparing
- Sort collections by stable keys (IDs, locations)
- Handle optional fields gracefully
- Provide detailed diffs when mismatch found
- Support flexible matching where appropriate

### 4. serialize_semantic_index()

Serialize semantic index to fixture format (for debugging):

```typescript
/**
 * Serialize semantic index to fixture format
 * Useful for debugging - shows what actual output looks like as JSON
 */
export function serialize_semantic_index(index: SemanticIndex): SemanticIndexFixture
```

**Implementation requirements:**
- Convert SemanticIndex to JSON-serializable format
- Convert Maps to objects or arrays
- Ensure stable ordering (sorted keys)
- Match fixture schema from 116.1.2

### 5. Supporting Types

Define TypeScript types for fixtures:

```typescript
/**
 * Fixture format for SemanticIndex
 * Based on JSON schema from 116.1.2
 */
export interface SemanticIndexFixture {
  file_path: string;
  language: string;
  root_scope_id: string;
  scopes: { [key: string]: LexicalScopeFixture };
  functions: { [key: string]: FunctionDefinitionFixture };
  classes: { [key: string]: ClassDefinitionFixture };
  variables: { [key: string]: VariableDefinitionFixture };
  interfaces: { [key: string]: InterfaceDefinitionFixture };
  enums: { [key: string]: EnumDefinitionFixture };
  namespaces: { [key: string]: NamespaceDefinitionFixture };
  types: { [key: string]: TypeDefinitionFixture };
  imported_symbols: { [key: string]: ImportDefinitionFixture };
  exported_symbols: ExportDefinitionFixture[];
  references: SymbolReferenceFixture[];
  type_bindings?: { [key: string]: TypeBindingFixture };
  type_members?: { [key: string]: TypeMemberInfoFixture };
}

// Additional fixture types as needed...
```

## Comparison Strategy

### Normalization

Before comparing, normalize:
1. **Sort all collections** by stable keys (symbol IDs, location keys)
2. **Normalize whitespace** in string values
3. **Handle undefined vs null** consistently
4. **Sort array fields** where order doesn't matter

### Diff Generation

When mismatch detected:
1. **Path to mismatch**: Show JSON path (e.g., `functions.symbol:...:name`)
2. **Expected value**: Show what fixture expects
3. **Actual value**: Show what was produced
4. **Helpful message**: Explain the difference if possible

**Example diff:**
```typescript
{
  matches: false,
  diffs: [
    {
      path: "functions['symbol:test.ts:function:foo:1:0'].name",
      expected: "foo",
      actual: "bar",
      message: "Function name mismatch"
    },
    {
      path: "references[2]",
      expected: { name: "console", location: {...} },
      actual: undefined,
      message: "Expected reference not found"
    }
  ]
}
```

### Flexible Matching

Support flexible matching for:
- **Location offsets**: Minor variations in row/column acceptable
- **Optional fields**: Undefined in actual should match missing in fixture
- **Collection order**: Some collections may be unordered

## Error Handling

Helpers should provide clear errors for:
- **File not found**: "Code fixture not found: {path}"
- **Parse errors**: "Failed to parse code fixture: {error}"
- **Invalid JSON**: "Invalid JSON in fixture: {path}"
- **Schema mismatch**: "Fixture doesn't match expected schema: {issues}"

## Testing the Helpers

Create a small test file to validate helpers work:

**Location:** `packages/core/tests/fixtures/test_helpers.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  load_code_fixture,
  load_semantic_index_fixture,
  compare_semantic_index,
  serialize_semantic_index
} from './test_helpers';

describe('Test Helpers', () => {
  it('should load code fixture', () => {
    const result = load_code_fixture('typescript/code/classes/basic_class.ts');
    expect(result.code).toBeDefined();
    expect(result.language).toBe('typescript');
  });

  it('should load semantic index fixture', () => {
    const fixture = load_semantic_index_fixture(
      'typescript/semantic_index/classes/basic_class.semantic_index.json'
    );
    expect(fixture.file_path).toBeDefined();
  });

  it('should serialize and deserialize', () => {
    // Load fixture, serialize, compare
  });
});
```

## Deliverables

- [ ] `test_helpers.ts` implemented with all functions
- [ ] TypeScript types defined for fixtures
- [ ] Comparison logic provides detailed diffs
- [ ] Error handling is robust
- [ ] Helper tests passing
- [ ] Documentation/comments for each function

## Acceptance Criteria

- [ ] All 4+ helper functions implemented
- [ ] Fixture types match schema from 116.1.2
- [ ] Comparison provides useful diffs on mismatch
- [ ] Error messages are clear and actionable
- [ ] Test file validates helpers work correctly
- [ ] Ready for use in 116.5.1-116.5.4

## Notes

- These helpers will be reused in 116.6 and 116.7 with extensions
- Keep comparison logic configurable (strict vs flexible)
- Consider using existing diff libraries (jest-diff, etc.)
- Ensure serialization is deterministic (stable ordering)
