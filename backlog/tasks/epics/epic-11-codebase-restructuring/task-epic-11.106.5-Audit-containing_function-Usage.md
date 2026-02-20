# Task 11.106.5: Audit containing_function Usage

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 15 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.4 (assignment_type migration complete)

## Objective

Determine whether `context.containing_function` is used anywhere in the codebase. Make a decision: DELETE if unused, or KEEP and create follow-up task to implement.

## Background

The `containing_function` field in `ReferenceContext` has never been populated by any metadata extractor. It's defined in the interface but:
- Never written to
- Possibly never read from
- Requires scope tree traversal (not AST-local)

## Search Patterns

```bash
# Find all containing_function references in PRODUCTION code
rg "containing_function" --type ts -g "!*test.ts"

# Find in reference contexts (production only)
rg "containing_function" --type ts -g "!*test.ts" -C 3

# Check for usage in resolution code
rg "containing_function" packages/core/src --type ts -g "!*test.ts"

# Separately check test usage (will be deleted if we remove the field)
rg "containing_function" --type ts --glob "*test.ts" -l
```

## Analysis Required

For each usage found in PRODUCTION code (not tests), document:

1. **Location:** File and line number
2. **Type:** Read or write operation
3. **Purpose:** What is it trying to do?
4. **Impact:** What breaks if we remove it?

**Ignore test file usages** - those will be deleted along with the field if we decide to remove it.

## Decision Criteria

### DELETE if:
- ✅ No read operations found
- ✅ Only present in interface definition
- ✅ No documented use case

### KEEP if:
- ❌ Any code reads the field
- ❌ Planned feature depends on it
- ❌ Method resolution needs it

## Expected Outcome

Most likely: **DELETE**

Reasoning:
- Task 11.104 implemented comprehensive metadata extraction
- 247 tests passed without populating this field
- No extractors reference it
- Likely speculative API that was never used

## Deliverable

Add decision to task notes:

```markdown
## containing_function Decision

**Search Results:**
[paste grep output]

**Analysis:**
- Read locations: [list or "none"]
- Write locations: [list or "none"]
- Planned usage: [yes/no with details]

**Decision:** DELETE | KEEP

**Rationale:**
[explanation]

**Action:**
- If DELETE: Proceed to task 11.106.6
- If KEEP: Create follow-up task for ScopeBuilder integration
```

## Success Criteria

- ✅ Comprehensive search completed
- ✅ All usages documented
- ✅ Clear decision made (DELETE or KEEP)
- ✅ Rationale documented

## Follow-Up Actions

### If DELETE:
- Proceed to task 11.106.6
- Remove field in that task

### If KEEP:
- Skip task 11.106.6
- Create new task: "Implement containing_function via ScopeBuilder"
- Document the use case
- Add to epic 11 backlog

## Notes

### What containing_function Was Meant For

The field was likely intended to help with:
- Return type inference (knowing which function a return belongs to)
- Closure variable resolution
- Nested function analysis

However, this information is already available through `scope_id` and the scope tree, so the field may be redundant.

### ScopeBuilder Integration

If we decide to KEEP the field, implementation would involve:
1. Add method to ScopeBuilder: `get_containing_function(scope_id)`
2. Walk up scope tree until finding a function scope
3. Return that function's SymbolId
4. Populate during reference_builder processing

Estimated effort: 1-2 hours if needed.
