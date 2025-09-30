# Task 104.4: Implement Python Metadata Extraction (4 Sub-tasks)

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 4 hours total
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.3 (JavaScript complete)

## Overview

Implement language-specific metadata extractors for Python, following the same pattern as JavaScript but handling Python's unique AST structure.

## Sub-Tasks

### 104.4.1 - Implement python_metadata.ts (2 hours)

Create `packages/core/src/index_single_file/query_code_tree/language_configs/python_metadata.ts`

**Key Differences from JavaScript:**
- Method calls: `attribute` node instead of `member_expression`
- Type annotations: Python 3 type hints syntax
- Property access: `attribute` for all member access
- Constructor calls: `call` node with class name
- No generic syntax (type hints use subscript: `List[str]`)

**Python AST Examples:**
```python
# Method call:
obj.method()
# → call { function: attribute { object: "obj", attribute: "method" } }

# Type annotation:
def foo() -> int:
# → type_comment or return_type with identifier

# Property access:
a.b.c
# → attribute { object: attribute {...}, attribute: "c" }
```

**Implementation Notes:**
- Handle `self` parameter specially in methods
- Type hints may be in comments (`# type: int`) or annotations
- Constructor calls look like regular function calls
- Property chains use `attribute` nodes recursively

### 104.4.2 - Test python_metadata.ts (1 hour)

Create `packages/core/src/index_single_file/query_code_tree/language_configs/python_metadata.test.ts`

**Test Cases:**
- Method call receiver extraction: `obj.method()`
- Property chain: `a.b.c.d`
- Type hint extraction: `def foo() -> int:`
- Assignment parts: `target = source`
- Constructor target: `obj = MyClass()`
- Type annotation: `name: str = "Alice"`

**Python-Specific Tests:**
- `self` parameter handling
- Type comment parsing: `x = 5  # type: int`
- Multiple assignment: `a = b = c`
- Subscript type hints: `List[str]`

### 104.4.3 - Wire Python Extractors (30 minutes)

Update `semantic_index.ts`:

```typescript
import { PYTHON_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/python_metadata";

function get_metadata_extractors(language: Language): MetadataExtractors {
  switch (language) {
    case "javascript":
    case "typescript":
      return JAVASCRIPT_METADATA_EXTRACTORS;
    case "python":
      return PYTHON_METADATA_EXTRACTORS;  // NEW
    case "rust":
      throw new Error(`Metadata extractors not yet implemented for ${language}`);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
```

### 104.4.4 - Fix semantic_index.python.test.ts (30 minutes)

Update Python integration tests similar to JavaScript:
- Add metadata assertions
- Test method call receivers
- Test property chains
- Test type hint extraction
- Handle Python-specific patterns

## Python AST Reference

Use tree-sitter CLI to explore:
```bash
npx tree-sitter parse --scope source.python "obj.method()"
npx tree-sitter parse --scope source.python "def foo() -> int: pass"
```

## Success Criteria (All Sub-tasks)

- ✅ `python_metadata.ts` created and implements all 6 extractors
- ✅ Tests pass with >95% coverage
- ✅ Python extractors wired into semantic_index.ts
- ✅ semantic_index.python.test.ts passes
- ✅ Python-specific patterns handled correctly

## Notes

### Python Type Hints Complexity

Python 3 type hints can be:
1. Function annotations: `def foo() -> int:`
2. Variable annotations: `name: str = "value"`
3. Type comments: `x = 5  # type: int`

Start with #1 and #2, add #3 if needed.

### Self Parameter

In Python methods, `self.method()` may appear - handle differently from `obj.method()` if needed for resolution.

## Related Files

- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts` (reference implementation)
- `packages/core/src/index_single_file/semantic_index.python.test.ts` (integration tests)
