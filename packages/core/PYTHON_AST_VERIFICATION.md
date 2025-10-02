# Python AST Verification for Query Patterns

This document verifies the tree-sitter AST structure for Python code patterns used in `python.scm` query files.

## Write References - Variable Assignments

### 1. Simple Assignment: `x = 42`

**AST Structure:**
```
assignment [left: identifier, right: integer]
  identifier "x"
  integer "42"
```

**Query Pattern:**
```scheme
(assignment
  left: (identifier) @reference.write
)
```

**Test Result:** ✅ PASS - Captures "x"

---

### 2. Augmented Assignment: `count += 1`

**AST Structure:**
```
augmented_assignment [left: identifier, operator: integer]
  identifier "count"
  integer "1"
```

**Query Pattern:**
```scheme
(augmented_assignment
  left: (identifier) @reference.write
)
```

**Test Result:** ✅ PASS - Captures "count"

---

### 3. Multiple Assignment: `a, b = 1, 2`

**AST Structure:**
```
assignment [left: pattern_list, right: expression_list]
  pattern_list "a, b"
    identifier "a"
    identifier "b"
  expression_list "1, 2"
    integer "1"
    integer "2"
```

**Query Pattern:**
```scheme
(assignment
  left: (pattern_list
    (identifier) @reference.write
  )
)
```

**Test Result:** ✅ PASS - Captures "a", "b"

---

### 4. Attribute Assignment: `self.value = 42`

**AST Structure:**
```
assignment [left: attribute, right: integer]
  attribute [object: identifier, attribute: identifier]
    identifier "self"
    identifier "value"
  integer "42"
```

**Key Field:** The `attribute` node has a field named `attribute` that contains the identifier being assigned.

**Query Pattern:**
```scheme
(assignment
  left: (attribute
    attribute: (identifier) @reference.write
  )
)
```

**Test Result:** ✅ PASS - Captures "value"

---

## None Type References - Nullable Types

### 5. None in Return Type: `def foo() -> None:`

**AST Structure:**
```
function_definition [name: identifier, parameters: parameters, return_type: type, body: block]
  identifier "foo"
  parameters "()"
  type "None"
    none "None"
  block "pass"
```

**Key Field:** `return_type` field contains a `type` node.

**Query Pattern:**
```scheme
(function_definition
  return_type: (type
    (none) @reference.type
  )
)
```

**Test Result:** ✅ PASS - Captures "None"

---

### 6. None in Pipe Union (Right): `def foo() -> int | None:`

**AST Structure:**
```
function_definition
  type "int | None"
    binary_operator [left: identifier, operator: "|", right: none]
      identifier "int"
      none "None"
```

**Key Insight:** The `operator` field points to the "|" token itself, NOT a string. Don't filter by `operator: "|"`.

**Query Pattern:**
```scheme
(binary_operator
  right: (none) @reference.type
)
```

**Test Result:** ✅ PASS - Captures "None"

---

### 7. None in Pipe Union (Left): `def foo() -> None | int:`

**AST Structure:**
```
binary_operator [left: none, operator: "|", right: identifier]
  none "None"
  identifier "int"
```

**Query Pattern:**
```scheme
(binary_operator
  left: (none) @reference.type
)
```

**Test Result:** ✅ PASS - Captures "None"

---

### 8. None in Parameter Type: `def foo(x: str | None):`

**AST Structure:**
```
function_definition
  parameters "(x: str | None)"
    typed_parameter [type: type]
      identifier "x"
      type "str | None"
        binary_operator
          identifier "str"
          none "None"
```

**Key Field:** `typed_parameter` has a `type` field.

**Query Pattern:**
```scheme
(typed_parameter
  type: (type
    (none) @reference.type
  )
)
```

**Test Result:** ✅ PASS - Captures "None"

---

### 9. None in Variable Annotation: `x: int | None = 5`

**AST Structure:**
```
assignment [left: identifier, type: type, right: integer]
  identifier "x"
  type "int | None"
    binary_operator
      identifier "int"
      none "None"
  integer "5"
```

**Query Pattern:**
```scheme
(type
  (none) @reference.type
)
```

**Test Result:** ✅ PASS - Captures "None" (general catch-all)

---

## Common Pitfalls

### ❌ WRONG: Filtering by operator value
```scheme
; DON'T DO THIS:
(binary_operator
  operator: "|"  ; ❌ Won't work - operator is a node, not a value
  right: (none) @reference.type
)
```

### ✅ CORRECT: Match by field name only
```scheme
; DO THIS:
(binary_operator
  right: (none) @reference.type
)
```

### Field Names Matter

Always verify field names using tree-sitter inspection:
```javascript
const fieldName = node.fieldNameForChild(i);
```

Common field names in Python:
- `left`, `right` - Binary operators, assignments
- `name` - Function/class definitions
- `parameters` - Function signatures
- `return_type` - Function return types
- `type` - Type annotations
- `body` - Function/class bodies
- `attribute` - Attribute access (both object and attribute field)
- `object` - Object in attribute access

---

## Test Verification

All query patterns verified using tree-sitter parser:

```bash
node /Users/chuck/workspace/ariadne/test_python_queries.js
```

**Results:**
- ✅ Write References: 4/4 patterns passing
- ✅ None Type References: 5/5 patterns passing
- ✅ Zero false positives
- ✅ All expected captures found

**Test Suite:** `semantic_index.python.test.ts`
- 41 tests passing
- 3 tests skipped (unrelated features)
- 0 regressions

---

## Maintenance

When adding new query patterns:

1. Create sample code in `/tmp/test.py`
2. Run AST inspection: `node inspect_python_ast.js`
3. Verify field names using `verify_fields.js`
4. Write query pattern
5. Test with `test_python_queries.js`
6. Add test case to `semantic_index.python.test.ts`
7. Document in this file

**Last Verified:** 2025-10-02
**Tree-sitter Python Version:** Latest
**Query File:** `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
