---
id: TASK-196.8
title: "Tier 3: Add argument_texts and return_value_usage to reference and call types"
status: To Do
assignee: []
created_date: "2026-03-26 11:27"
labels:
  - types
  - tier-3
dependencies: []
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add the type definitions for data flow annotations. This is independent of Tier 1/2 and can be implemented in parallel.

### Type Changes

**`packages/types/src/call_chains.ts`** — Add new types:

```typescript
type ReturnValueUsage =
  | { readonly kind: "assigned"; readonly variable_name: SymbolName }
  | {
      readonly kind: "passed_as_argument";
      readonly to_call_location: Location;
      readonly argument_index: number;
    }
  | { readonly kind: "returned" }
  | { readonly kind: "condition" }
  | { readonly kind: "chained" }
  | { readonly kind: "discarded" };

interface ArgumentParameterMapping {
  readonly argument_index: number;
  readonly argument_text: string;
  readonly parameter_name?: SymbolName;
  readonly parameter_type?: SymbolName;
}
```

**`packages/types/src/call_chains.ts`** — Extend `CallReference`:

```typescript
readonly argument_texts?: readonly string[];
readonly return_value_usage?: ReturnValueUsage;
readonly argument_parameter_mappings?: readonly ArgumentParameterMapping[];
```

**`packages/types/src/symbol_references.ts`** — Add to all call variants (`FunctionCallReference`, `MethodCallReference`, `ConstructorCallReference`, `SelfReferenceCall`):

```typescript
readonly argument_texts?: readonly string[];
readonly return_value_usage?: ReturnValueUsage;
```

### Design Notes

- All fields are optional (`?`) — zero impact on existing code
- `argument_texts` truncated to 80 chars per argument (truncation happens in extraction, not in the type)
- `ReturnValueUsage` is a discriminated union — easy to pattern-match in consumers
- `ArgumentParameterMapping` is computed at resolution time, not extraction time
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 ReturnValueUsage, ArgumentParameterMapping types exported from @ariadnejs/types
- [ ] #2 CallReference has optional argument_texts, return_value_usage, argument_parameter_mappings
- [ ] #3 All four call SymbolReference variants have optional argument_texts and return_value_usage
- [ ] #4 TypeScript compiles with no errors
- [ ] #5 All existing tests pass without modification
<!-- AC:END -->
