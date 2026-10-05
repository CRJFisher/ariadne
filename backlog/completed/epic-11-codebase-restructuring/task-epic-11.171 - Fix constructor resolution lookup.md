---
id: task-epic-11.171
title: Fix constructor resolution lookup
status: Done
assignee: []
created_date: '2026-01-20'
updated_date: '2026-01-20 13:37'
labels:
  - bug
  - call-graph
  - epic-11
dependencies: []
---

## Description

Constructor calls fail to resolve because `resolve_constructor_call` searches `class_def.methods` for a method named "constructor" when constructors are actually stored in the separate `class_def.constructor` array.

This was identified during the entrypoint self-analysis pipeline as the **constructor-resolution-bug** false positive group (2 entries).
## Problem

### Storage (Correct)

In `packages/core/src/index_single_file/definitions/definitions.ts`:

```typescript
// Lines 934-946 (build_class method)
const constructors =
  state.constructors.size > 0
    ? Array.from(state.constructors.values()).map((c) =>
        this.build_constructor(c)
      )
    : undefined;

return {
  // ...
  constructor: constructors,  // Stored in class_def.constructor array
};
```

The type definition confirms this at `packages/types/src/symbol_definitions.ts:76`:

```typescript
readonly constructor?: readonly ConstructorDefinition[];
```

### Lookup (INCORRECT)

In `packages/core/src/resolve_references/call_resolution/constructor.ts:80-82`:

```typescript
const constructor_symbol = class_def.methods.find(
  (method) => method.name === "constructor"
)?.symbol_id;
```

**The Bug**: The code searches `class_def.methods` for a method named "constructor" but constructors are stored in the separate `class_def.constructor` array.

## Affected False Positives

1. `constructor` in `definitions.ts:188` - DefinitionBuilder constructor
2. `constructor` in `references.ts:269` - ReferenceBuilder constructor

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Constructor lookup uses `class_def.constructor` array instead of searching methods
- [ ] #2 Both false positive entries are eliminated from entrypoint detection
- [ ] #3 Constructor calls resolve to `ConstructorDefinition.symbol_id` (not class fallback)
- [ ] #4 Integration tests verify constructor resolution works correctly
- [ ] #5 All existing tests pass
<!-- AC:END -->


## Proposed Solution

Change the constructor lookup to use the correct field:

**Current (broken):**

```typescript
const constructor_symbol = class_def.methods.find(
  (method) => method.name === "constructor"
)?.symbol_id;
```

**Fixed:**

```typescript
const constructor_symbol = class_def.constructor?.[0]?.symbol_id;
```

## Files to Modify

- `packages/core/src/resolve_references/call_resolution/constructor.ts` (lines 80-82)

## Test Cases

1. Constructor calls resolve to the constructor symbol (not the class symbol)
2. Constructor calls in `new ClassName()` expressions are tracked correctly
3. Classes without explicit constructors fall back to class symbol correctly

## Related

- Part of epic-11 codebase restructuring
- task-152.8: Updated constructor tracking (focused on type safety, didn't fix lookup bug)
