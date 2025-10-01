# Task 11.106.1: Audit type_flow Usage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 30 minutes
**Parent:** task-epic-11.106
**Dependencies:** None

## Objective

Comprehensively audit the codebase for **production code** usages of `type_flow` and its sub-fields to ensure safe removal of unused fields.

**IMPORTANT:** Test file assertions do NOT count as "usage". Tests asserting on these fields should be deleted along with the fields.

## Fields to Audit

1. `type_flow.source_type` - Expected: always undefined
2. `type_flow.target_type` - Expected: sometimes populated
3. `type_flow.is_narrowing` - Expected: always false
4. `type_flow.is_widening` - Expected: always false

## Search Patterns

```bash
# Find all type_flow references (EXCLUDE tests)
rg "type_flow" --type ts -g "!*test.ts"

# Find specific field accesses (EXCLUDE tests)
rg "\.source_type" --type ts -g "!*test.ts"
rg "\.target_type" --type ts -g "!*test.ts"
rg "\.is_narrowing" --type ts -g "!*test.ts"
rg "\.is_widening" --type ts -g "!*test.ts"

# Separately find test usages (these will be DELETED)
rg "type_flow" --type ts --glob "*test.ts" -l
```

## Documentation Required

Create a summary document with:

1. **Production Read References:** Where production code reads from type_flow fields (EXCLUDES tests)
2. **Write References:** Where code sets type_flow fields
3. **Test References:** Test assertions on type_flow (will be DELETED)
4. **Impact Analysis:** What breaks if we remove each field (should be nothing)

## Expected Results

| Field | Expected Usage | Action |
|-------|---------------|---------|
| `source_type` | Only set to `undefined` | Safe to delete |
| `target_type` | Set from extractors | Needs migration to `assignment_type` |
| `is_narrowing` | Only set to `false` | Safe to delete |
| `is_widening` | Only set to `false` | Safe to delete |

## Files to Check

Priority files:
- `packages/types/src/semantic_index.ts` - Interface definition
- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts` - Field assignments
- `packages/core/src/**/*.test.ts` - Test assertions
- Any method resolution or type analysis code

## Success Criteria

- ✅ Complete list of all `type_flow` usages documented
- ✅ Confirmation that `source_type`, `is_narrowing`, `is_widening` are never read
- ✅ List of all places that read `target_type` (for migration)
- ✅ List of all tests that assert on `type_flow` fields

## Deliverable

Create audit summary in task notes:

```markdown
## type_flow Audit Results

### source_type
- Write locations: [list]
- Read locations: [list]
- Safe to delete: YES/NO

### target_type
- Write locations: [list]
- Read locations: [list]
- Migration needed: YES/NO

### is_narrowing
- Write locations: [list]
- Read locations: [list]
- Safe to delete: YES/NO

### is_widening
- Write locations: [list]
- Read locations: [list]
- Safe to delete: YES/NO
```

## Notes

This audit is critical for ensuring we don't break any downstream code. Be thorough in searching for:
- Direct property access (`.type_flow.source_type`)
- Destructuring (`const { source_type } = ref.type_flow`)
- Optional chaining (`ref.type_flow?.source_type`)
- Spread operators (`...ref.type_flow`)

**Remember:** Only search PRODUCTION code (exclude `*test.ts` files). Test assertions will be deleted separately in task 11.106.8.

### What Counts as Usage?

**COUNTS as usage (prevents deletion):**
```typescript
// Production code reading the field
if (reference.type_flow?.is_narrowing) {
  handleNarrowing(reference);
}
```

**DOES NOT count (will be deleted):**
```typescript
// Test assertion
expect(reference.type_flow?.is_narrowing).toBe(false);
```
