# Task Epic 11.154.6: Fix Python Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Medium
**Time Estimate**: 2 days

---

## Objective

Refactor Python query file to use complete captures (call node, not identifier), accounting for Python-specific AST nodes (`attribute` vs `member_expression`, `call` vs `call_expression`).

---

## Scope

**File**: `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

**Current validation status**: 60 errors, 10 warnings

**Python-specific AST nodes:**

- Uses `attribute` instead of `member_expression`
- Uses `call` instead of `call_expression`
- Uses `identifier` for attribute names (not `property_identifier`)

**Changes needed**:

### Error Categories

1. **Type system fragments** - `@type.type_reference` (16 occurrences!) - fragments on child nodes
2. **Duplicate method calls** - `.chained`, `.deep`, `.full` (remove)
3. **Property/variable fragments** - `.chain`, `.prop` (remove)
4. **Definition fragments** - `@definition.variable.multiple`, `@definition.property.interface`, `@definition.parameter.typed` (evaluate)

**Expected outcome**: 60 errors → ~5-8 errors (some Python-specific may need schema addition)

### Before

```scheme
(call
  function: (attribute
    attribute: (identifier) @reference.call              ; DUPLICATE 1
  )
) @reference.call.full                                   ; DUPLICATE 2
```

### After

```scheme
(call
  function: (attribute
    object: (_) @reference.variable
    attribute: (identifier)
  )
) @reference.call
```

---

## Implementation Steps

1. Update `python.scm` - remove duplicates, use complete `call` captures
2. Verify `python_metadata.ts` extractors handle `call` nodes (not `identifier`)
3. Update `python_builder_config.ts` if needed
4. Update test files
5. Run validation

---

## Acceptance Criteria

- [ ] `python.scm` has no duplicate/fragment captures
- [ ] All captures on complete nodes (`call`, not `identifier` in attribute)
- [ ] Extractors (`python_metadata.ts`) work with complete captures
- [ ] All Python semantic index tests pass
- [ ] Validation passes with 0 errors, 0 warnings
- [ ] Method calls resolved correctly
- [ ] Class/instance method differentiation works

---

## Files Modified

- `queries/python.scm`
- `language_configs/python_metadata.ts` (verify/update)
- `language_configs/python_builder_config.ts` (verify)
- `semantic_index.python.test.ts`
- `python_metadata.test.ts`

---

## Dependencies

- Task 11.154.2 (schema)
- Task 11.154.3 (validation)

---

## Time: 2 days
