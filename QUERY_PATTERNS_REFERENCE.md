# Python Query Patterns - Quick Reference

This document shows the exact query patterns added to `python.scm` for write references and None type detection.

## Write Reference Patterns (6 total)

### 1. Simple Assignment
```scheme
; x = 42
(assignment
  left: (identifier) @reference.write
)
```

### 2. Augmented Assignment
```scheme
; count += 1
(augmented_assignment
  left: (identifier) @reference.write
)
```

### 3. Multiple Assignment
```scheme
; a, b = 1, 2
(assignment
  left: (pattern_list
    (identifier) @reference.write
  )
)
```

### 4. Tuple Assignment
```scheme
; (x, y) = (1, 2)
(assignment
  left: (tuple_pattern
    (identifier) @reference.write
  )
)
```

### 5. Attribute Assignment
```scheme
; self.value = 42
(assignment
  left: (attribute
    attribute: (identifier) @reference.write
  )
)
```

### 6. Subscript Assignment
```scheme
; arr[0] = value
(assignment
  left: (subscript
    (identifier) @reference.write
  )
)
```

## None Type Reference Patterns (3 total)

### 1. General Type Context
```scheme
; Catches: def foo() -> None:
;          def foo(x: None):
;          x: None = None
(type
  (none) @reference.type
)
```

### 2. Binary Union (Right)
```scheme
; int | None
(binary_operator
  right: (none) @reference.type
)
```

### 3. Binary Union (Left)
```scheme
; None | int
(binary_operator
  left: (none) @reference.type
)
```

## Handler Integration

These patterns integrate with existing handlers:

**Write References:**
- Capture name: `@reference.write`
- Category: `reference`
- Entity: `write`
- Handler: `ReferenceKind.VARIABLE_WRITE` → `ReferenceType.write`

**Type References:**
- Capture name: `@reference.type`
- Category: `reference`
- Entity: `type`
- Handler: `ReferenceKind.TYPE_REFERENCE` → `ReferenceType.type`

## Pattern Location

File: `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

Lines: ~502-564

## Verification

All patterns verified with 100% accuracy:
```bash
node verify_all_patterns.js
# Result: 12/12 patterns passing ✅
```

Integration tests:
```bash
npm test -- semantic_index.python.test.ts
# Result: 41/41 tests passing ✅
```

---

**Last Updated:** 2025-10-02  
**Verification Status:** ✅ Complete
