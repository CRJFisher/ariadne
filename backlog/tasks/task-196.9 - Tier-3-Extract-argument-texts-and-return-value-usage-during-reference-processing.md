---
id: TASK-196.9
title: >-
  Tier 3: Extract argument texts and return value usage during reference
  processing
status: To Do
assignee: []
created_date: "2026-03-26 11:27"
labels:
  - core
  - tier-3
dependencies:
  - TASK-196.8
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Extract argument source texts and detect return value usage from tree-sitter nodes during the reference processing pass (Pass 4 of index_single_file), when SyntaxNode objects are still available.

### MetadataExtractors Interface

Add two methods to `MetadataExtractors` (in `metadata_extractors/types.ts`):

```typescript
extract_argument_texts(node: SyntaxNode): readonly string[];
extract_return_value_usage(node: SyntaxNode, file_path: FilePath): ReturnValueUsage;
```

### Argument Text Extraction (per language)

For each call expression node, find the `arguments` field, iterate `namedChild(i)`, capture each arg's `.text` truncated to 80 chars.

- **JS/TS**: `call_expression.arguments` / `new_expression.arguments` → iterate named children
- **Python**: `call.arguments` (argument_list) → named children include `keyword_argument` (`"name=value"` text)
- **Rust**: `call_expression.arguments` → named children

Truncation: if text > 80 chars, slice to 79 + `"\u2026"`.

### Return Value Usage Detection

Inspect the parent chain of the call expression node:

- `variable_declarator` / `assignment_expression` parent → `{ kind: "assigned", variable_name }`
- `return_statement` parent → `{ kind: "returned" }`
- `if_statement`/`while_statement` condition → `{ kind: "condition" }`
- `member_expression` where call is the object → `{ kind: "chained" }`
- `arguments` parent of another call → `{ kind: "passed_as_argument", to_call_location, argument_index }`
- `expression_statement` parent → `{ kind: "discarded" }`

Language-specific parent node types (Python: `assignment`, `attribute`; Rust: `let_declaration`, `field_expression`, implicit return as last expression without semicolon).

### Reference Builder Integration

In `references.ts`, for FUNCTION_CALL, METHOD_CALL, CONSTRUCTOR_CALL, SUPER_CALL captures:

1. Call `extractors.extract_argument_texts(capture.node)`
2. Call `extractors.extract_return_value_usage(capture.node, file_path)`
3. Pass both to factory functions

Update factory functions in `factories.ts` to accept and store both optional fields.

### Call Resolution Propagation

In `call_resolver.ts`, `build_call_reference()` forwards `argument_texts` and `return_value_usage` from `SymbolReference` to `CallReference` using spread/conditional inclusion.

### Parameter-to-Argument Mapping

In `call_resolver.ts`, add `compute_argument_parameter_mappings()`:

- Takes `argument_texts` and resolved callee's `parameters`
- Positional mapping: arg[i] → param[i]
- Python self/cls offset: skip first param if name is "self"/"cls"
- Rust &self/&mut self: same offset
- Attach as `argument_parameter_mappings` on `CallReference`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 extract_argument_texts() produces correct text arrays for all call types across JS/TS, Python, Rust
- [ ] #2 Argument texts are truncated at 80 chars with ellipsis
- [ ] #3 extract_return_value_usage() detects all 6 usage kinds correctly
- [ ] #4 argument_texts and return_value_usage flow from SymbolReference through to CallReference
- [ ] #5 Parameter-to-argument mapping uses resolved callee definition parameters
- [ ] #6 Python self/cls and Rust &self parameter offset is handled correctly
- [ ] #7 No-argument calls produce empty array (not undefined)
- [ ] #8 Unresolved calls still carry argument_texts (mapping has undefined param info)
<!-- AC:END -->
