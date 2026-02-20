# Task Epic 11.154.7: Fix Rust Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days

---

## Objective

Refactor Rust query file to use complete captures (call_expression, not field_identifier), handling both `.` method calls and `::` associated functions.

---

## Scope

**File**: `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

**Current validation status**: 156 errors, 5 warnings (highest error count!)

**Rust-specific AST nodes:**

- Uses `field_expression` for method calls (`self.method()`)
- Uses `scoped_identifier` for associated functions (`Type::function()`)
- Trait methods need special handling

**Changes needed**:

### Error Categories

1. **Import fragments** - `@import.import` (26 occurrences!) - redundant/fragments
2. **Type system fragments** - `@type.type_reference` (24 occurrences) - fragments
3. **Export fragments** - `@export.variable.*` variants (15+ patterns) - fragments
4. **Reference fragments** - `@reference.macro.builtin/async` - may consolidate
5. **Type metadata** - `@type.function/method/module` - likely fragments to remove

**Expected outcome**: 156 errors → ~10-15 errors (Rust has most language-specific features)

### Before

```scheme
(call_expression
  function: (field_expression
    field: (field_identifier) @reference.call            ; DUPLICATE 1
  )
) @reference.call.method                                 ; DUPLICATE 2
```

### After

```scheme
; Method call (dot syntax)
(call_expression
  function: (field_expression
    value: (_) @reference.variable
    field: (field_identifier)
  )
) @reference.call

; Associated function (double-colon syntax)
(call_expression
  function: (scoped_identifier
    path: (_) @reference.type
    name: (identifier)
  )
) @reference.call
```

---

## Implementation Steps

1. Update `rust.scm` - remove duplicates, use complete `call_expression` captures
2. Verify `rust_metadata.ts` extractors handle both `.` and `::` syntax
3. Update `rust_builder.ts` if needed
4. Update test files
5. Run validation

---

## Acceptance Criteria

- [ ] `rust.scm` has no duplicate/fragment captures
- [ ] All captures on complete nodes (`call_expression`, not `field_identifier`)
- [ ] Extractors (`rust_metadata.ts`) work with complete captures
- [ ] All Rust semantic index tests pass
- [ ] Validation passes with 0 errors, 0 warnings
- [ ] Both `.` and `::` calls handled correctly
- [ ] Trait method resolution works

---

## Files Modified

- `queries/rust.scm`
- `language_configs/rust_metadata.ts` (verify/update)
- `language_configs/rust_builder.ts` (verify)
- `semantic_index.rust.test.ts`
- `rust_metadata.test.ts`

---

## Dependencies

- Task 11.154.2 (schema)
- Task 11.154.3 (validation)

---

## Time: 2 days
