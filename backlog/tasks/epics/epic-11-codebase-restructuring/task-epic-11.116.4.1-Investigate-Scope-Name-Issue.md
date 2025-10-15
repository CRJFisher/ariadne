# Task epic-11.116.4.1: Investigate and Fix Scope Name Issue

**Status:** Completed
**Parent:** task-epic-11.116.4
**Priority:** Medium (Quality issue - fixtures functional but scope names incorrect)
**Created:** 2025-10-15
**Completed:** 2025-10-15

## Overview

During manual review of generated JSON fixtures, discovered that scope `name` fields contain full source code text instead of just the scope identifier. This is a quality issue in the semantic indexer that needs investigation and fixing.

## Problem Description

**Observed behavior:**

```json
{
  "id": "class:/path/to/file.ts:5:19:14:1",
  "name": "{\n  constructor(\n    public name: string,\n    public email: string\n  ) {}\n\n  greet(): string {\n    return `Hello, ${this.name}`;\n  }\n}",
  "type": "class"
}
```

**Expected behavior:**

The `name` field should contain just the scope identifier or be `null` for anonymous scopes:
- For class scope: `name` should probably be `null` (the class body is a scope, not the class name)
- The class definition itself has name "User" which is captured correctly in the classes map

**Impact:**

- Fixtures are functionally correct (all symbols captured, relationships correct)
- But scope names are confusing and contain multiline source text
- This makes fixtures harder to read and debug
- May indicate underlying issue in scope name extraction logic

## Investigation Steps

### 1. Understand Current Scope Name Extraction (1 hour)

**Questions to answer:**

1. Where is scope `name` field set in the codebase?
2. What is the intended semantics of scope `name`?
3. Is this a bug or by design?
4. Does it affect all languages or just TypeScript?

**Files to review:**

```bash
# Find where scope names are extracted
grep -r "name.*scope" packages/core/src/index_single_file/scopes/
grep -r "LexicalScope" packages/core/src/index_single_file/
```

**Look at:**
- `packages/core/src/index_single_file/scopes/scope_processor.ts`
- `packages/core/src/index_single_file/scopes/scope_builder.ts`
- Language-specific extractors: `*_scope_boundary_extractor.ts`

### 2. Review Scope Semantics (0.5 hours)

**Review types:**

```typescript
// From @ariadnejs/types
interface LexicalScope {
  id: ScopeId;
  parent_id: ScopeId | null;
  name: string | null;  // ← What should this be?
  type: ScopeType;
  location: Location;
  child_ids: ScopeId[];
}
```

**Questions:**
- What is `name` supposed to represent?
- For a class body scope, what should `name` be?
- For a function scope, should `name` be the function name or null?

### 3. Check Other Fixtures (0.5 hours)

Check if this is widespread:

```bash
# Check Python fixtures
jq '.scopes[] | select(.type == "class") | .name' \
  tests/fixtures/python/semantic_index/classes/basic_class.json | head -20

# Check Rust fixtures
jq '.scopes[] | select(.type == "struct") | .name' \
  tests/fixtures/rust/semantic_index/structs/basic_struct.json | head -20

# Check function scopes
jq '.scopes[] | select(.type == "function") | .name' \
  tests/fixtures/typescript/semantic_index/functions/call_chains.json | head -20
```

### 4. Identify Root Cause (1 hour)

Likely locations:
1. **Tree-sitter query captures** - Might be capturing wrong node for scope name
2. **Scope boundary extractors** - Might be extracting wrong text span
3. **Scope processor** - Might be using wrong node text

Example hypothesis:
```typescript
// scope_processor.ts might be doing something like:
const scope_name = node.text;  // ← This would capture full body text

// Should probably be:
const scope_name = null;  // For anonymous scopes like class bodies
// OR
const scope_name = identifier_node.text;  // For named scopes
```

## Proposed Fix

**Once root cause identified, likely fix is one of:**

1. **Set scope names to null for body scopes:**
   - Class bodies, function bodies are scopes but shouldn't have names
   - The name belongs to the definition (ClassDefinition, FunctionDefinition)

2. **Extract name from identifier node instead of body node:**
   - If scope names should be populated, extract from correct node
   - Use tree-sitter queries to capture scope identifier separately from scope body

3. **Update scope semantics documentation:**
   - Clarify what scope `name` field means
   - Document when it should be null vs. populated

## Testing

### Before Fix

```bash
# Document current behavior
npm run generate-fixtures:ts
jq '.scopes[].name' tests/fixtures/typescript/semantic_index/classes/basic_class.json \
  > /tmp/before.txt
```

### After Fix

```bash
# Regenerate fixtures
npm run generate-fixtures:ts

# Compare
jq '.scopes[].name' tests/fixtures/typescript/semantic_index/classes/basic_class.json \
  > /tmp/after.txt

diff /tmp/before.txt /tmp/after.txt
```

### Verify Fix

```bash
# Check scope names are reasonable
jq '[.scopes[] | {type: .type, name: .name}]' \
  tests/fixtures/typescript/semantic_index/classes/basic_class.json

# Should see:
# - module scope: name = null (or file name?)
# - class scope: name = null (body is anonymous)
# - method scopes: name = null or method name?
# - constructor scope: name = null or "constructor"?
```

## Deliverables

- [ ] Root cause identified and documented
- [ ] Fix implemented in scope extraction code
- [ ] All affected tests passing
- [ ] Fixtures regenerated with corrected scope names
- [ ] Documentation updated if scope semantics changed
- [ ] Test cases added to prevent regression

## Success Criteria

- ✅ Scope `name` fields contain appropriate values (not full source text)
- ✅ Scope semantics clearly documented
- ✅ All existing tests still pass
- ✅ Fixtures pass verification
- ✅ Manual review confirms scope names are sensible

## Estimated Effort

**3-4 hours**

- 1 hour: Investigation and root cause analysis
- 1 hour: Implement fix
- 0.5 hours: Regenerate fixtures and test
- 0.5-1 hour: Documentation and review

## Notes

- This is a quality issue, not a blocking bug
- Fixtures are functionally correct (symbols, references, relationships all captured)
- Fix will make fixtures more readable and maintainable
- Good opportunity to clarify scope semantics in codebase
- Consider whether scope `name` field is even necessary or if it should always be null

## Related Issues

Example from generated fixture:

**File:** `tests/fixtures/typescript/code/classes/basic_class.ts`

```typescript
export class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  greet(): string {
    return `Hello, ${this.name}`;
  }
}
```

**Generated scope name (incorrect):**

```json
{
  "name": "{\n  constructor(\n    public name: string,\n    public email: string\n  ) {}\n\n  greet(): string {\n    return `Hello, ${this.name}`;\n  }\n}",
  "type": "class"
}
```

**Expected:** Probably `name: null` since the class body scope is anonymous.

## Implementation Notes

**Completed:** 2025-10-15

### Root Cause

The issue was in [scope_processor.ts](../../../packages/core/src/index_single_file/scopes/scope_processor.ts) at line 118:

```typescript
const symbol_name = capture.text || (scope_type === "block" ? "" : undefined);
```

This code was using `capture.text` which contained the full text of the captured tree-sitter node. For class scopes, the tree-sitter query captures `(class_body)`, so `capture.text` contained the entire class body including all methods and properties.

### Solution Implemented

1. **Added `extract_scope_name()` helper function** that properly extracts identifier names from tree-sitter nodes:
   - For class scopes: Checks if we captured a body node, then looks at parent's `name` field
   - For function/method/constructor scopes: Extracts the `name` field from the node
   - For anonymous scopes (blocks, arrow functions): Returns `null`
   - Handles cases where nodes don't have names gracefully

2. **Updated scope_processor.ts** to use `extract_scope_name()` instead of `capture.text`

3. **Fixed test mocks** in `scope_processor.test.ts`:
   - Added proper node type mapping (e.g., "class" → "class_declaration")
   - Mock `childForFieldName` now returns proper name, body, and parameters nodes
   - All 25 tests passing

### Results

**Before fix:**
```json
{
  "name": "{\n  constructor(\n    public name: string,\n    public email: string\n  ) {}\n\n  greet(): string {\n    return `Hello, ${this.name}`;\n  }\n}",
  "type": "class"
}
```

**After fix:**
```json
{
  "name": "User",
  "type": "class"
}
```

### All Fixtures Regenerated

Successfully regenerated all 27 fixtures:
- TypeScript: 19 fixtures
- Python: 4 fixtures
- Rust: 2 fixtures
- JavaScript: 2 fixtures

All fixtures verified with `npm run verify-fixtures` - 100% pass rate.

### Examples of Corrected Scope Names

**Classes:**
```json
{"name": "User", "type": "class"}
{"name": "Animal", "type": "class"}
{"name": "Dog", "type": "class"}
```

**Functions:**
```json
{"name": "main", "type": "function"}
{"name": "processData", "type": "function"}
{"name": "fetchData", "type": "function"}
```

**Anonymous functions:**
```json
{"name": null, "type": "function"}
```

**Methods:**
```json
{"name": "constructor", "type": "constructor"}
{"name": "greet", "type": "method"}
{"name": "getInfo", "type": "method"}
```

### Deliverables Status

- ✅ Root cause identified and documented
- ✅ Fix implemented in scope extraction code ([scope_processor.ts](../../../packages/core/src/index_single_file/scopes/scope_processor.ts))
- ✅ All affected tests passing (25/25)
- ✅ Fixtures regenerated with corrected scope names
- ✅ Test cases updated to prevent regression
- ✅ Fixtures verified successfully (27/27)

### Commit

Fixed in commit: `5d1e312` - "fix: extract proper identifier names for scope names"
