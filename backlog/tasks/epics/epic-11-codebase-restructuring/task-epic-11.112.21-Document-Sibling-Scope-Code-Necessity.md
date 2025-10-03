# Task epic-11.112.21: Document Sibling Scope Code Necessity

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2 hours
**Files:** 1 file modified, 1 file created
**Dependencies:** task-epic-11.112.2, 11.112.20

## Objective

Based on empirical testing from task-epic-11.112.2, document whether the sibling scope handling code (lines 213-235 in scope_resolver_index.ts) is necessary. Create decision document with evidence and rationale.

## Files

### MODIFIED
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`

### CREATED
- `docs/architecture/sibling-scope-resolution-decision.md`

## Implementation Steps

### 1. Review Empirical Testing Results (20 min)

Review test results from task-epic-11.112.2:
- Did sibling scope code ever execute?
- Were there any test failures when code was disabled?
- What languages triggered sibling scope handling?
- What code patterns required it?

### 2. Analyze .scm File Evidence (20 min)

Confirm findings from .scm files:
```bash
# Search for multiple scope definitions per construct
grep -A 5 "@scope" packages/core/src/index_single_file/query_code_tree/queries/*.scm
```

Expected finding: No constructs create sibling scopes (e.g., no separate function name/body scopes).

### 3. Check Language Specifications (30 min)

Review language specs for sibling scope requirements:
- **JavaScript/TypeScript**: Function parameters in same scope as body
- **Python**: Function parameters in same scope as body
- **Rust**: Function parameters in same scope as body
- **Block scopes**: Never need to see sibling block variables

Document findings in decision doc.

### 4. Create Decision Document (40 min)

Create `docs/architecture/sibling-scope-resolution-decision.md`:

```markdown
# Sibling Scope Resolution Decision

## Context

The `scope_resolver_index.ts` file (lines 213-235) contains code to handle sibling scopes, claiming to support "function name and body" as separate scopes.

## Investigation

### Code Analysis
- No evidence in `scope_processor.ts` that sibling scopes are created
- `.scm` files create ONE scope per function: `(function_declaration) @scope.function`
- No separate name/body scope patterns found

### Empirical Testing
[Insert results from task-epic-11.112.2]
- Tests run with sibling code enabled: [RESULTS]
- Tests run with sibling code disabled: [RESULTS]
- Sibling code execution count: [NUMBER]

### Language Specifications
- **All supported languages**: Function parameters share scope with function body
- **Block scopes**: Variables in sibling blocks are not visible to each other (correct)

## Decision

**[KEEP | REMOVE]** sibling scope handling code

### Rationale

[If KEEP:]
- Found evidence that [LANGUAGE] requires sibling scope handling in [SCENARIO]
- Test failures when disabled: [LIST]
- Keep code with improved documentation

[If REMOVE:]
- No evidence sibling scopes exist in any language
- All tests pass with code disabled
- Simplifies codebase by removing unused complexity
- Can be re-added if future language support requires it

## Implementation

[If KEEP:]
- Add comprehensive tests demonstrating necessity
- Document which languages/scenarios require it
- Add inline comments explaining the logic

[If REMOVE:]
- Remove lines 213-235 in scope_resolver_index.ts
- Add comment explaining scope resolution only traverses parent/child
- Update tests if needed
```

### 5. Implement Decision (20 min)

**If REMOVE decision:**
```typescript
// In scope_resolver_index.ts, replace lines 213-235 with:

// NOTE: We only traverse parent→child scope relationships.
// Sibling scopes (same parent, different children) never need to see each other's variables.
// This is correct for all supported languages:
// - Function parameters are in the same scope as the function body (not siblings)
// - Block scope variables are not visible across sibling blocks
// - Class members are resolved through the class scope, not as siblings
```

**If KEEP decision:**
Add comprehensive documentation and tests.

### 6. Run Full Test Suite (10 min)

```bash
npm test
```

Verify decision doesn't break any tests.

## Success Criteria

- ✅ Decision document created with evidence
- ✅ Rationale clearly documented
- ✅ Code updated or documented based on decision
- ✅ All tests pass

## Outputs

- Decision document: `sibling-scope-resolution-decision.md`
- Updated code or documentation in `scope_resolver_index.ts`

## Next Task

**task-epic-11.112.22** - Remove or document sibling scope code
