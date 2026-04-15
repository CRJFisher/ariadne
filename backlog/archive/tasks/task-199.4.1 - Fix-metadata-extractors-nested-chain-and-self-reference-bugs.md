---
id: TASK-199.4.1
title: Fix metadata extractors nested chain and self-reference bugs
status: Done
assignee: []
created_date: "2026-03-29 21:00"
updated_date: "2026-03-29 21:00"
labels:
  - bug-fix
  - metadata-extractors
dependencies: []
parent_task_id: TASK-199.4
priority: medium
---

## Description

Three production bugs discovered and fixed during task-199.4 (improving metadata_extractors integration tests).

### Bug 1: JS `extract_property_chain` missing `call_expression` traversal

In `metadata_extractors.javascript.ts`, the `extract_property_chain` traverse function only recursed into `member_expression`, `optional_chain`, and `subscript_expression` object types. When the object of a `member_expression` was a `call_expression` (e.g., `obj?.method()?.prop?.another()`), it was skipped, causing the chain to return `["prop", "another"]` instead of `["obj", "method", "prop", "another"]`.

**Fix**: Added `call_expression` to the recursion checks in both the `member_expression` and `subscript_expression` handlers.

### Bug 2: JS `extract_receiver_info` missed `this`/`super` in nested chains

When `this.data.items.push(1)` was processed, the `extract_receiver_info` function correctly built the chain `["this", "data", "items", "push"]` via `extract_property_chain`, but then returned `is_self_reference: false` because it only detected `this`/`super` as the direct `object_node` of the outer member_expression (which was `this.data.items`, a nested member_expression).

**Fix**: After building the chain, check if the first element is `this` or `super` and set `is_self_reference` and `self_keyword` accordingly.

### Bug 3: Rust `extract_receiver_info` didn't use `extract_property_chain`

The Rust version of `extract_receiver_info` used `value_node.text` directly instead of calling `extract_property_chain`, causing `self.data.process()` to return `["self.data", "process"]` instead of `["self", "data", "process"]`. It also missed self-reference detection for nested `self` chains.

**Fix**: Added `extract_property_chain` call for nested receivers (matching JS and Python implementations) and added `self` detection at the root of the chain.

## Tests

All three bugs are locked in by new tests that fail if the fixes are reverted:

- JS: `extract_receiver_info > should handle this with nested chain`
- JS: `edge cases > should handle nested optional chaining with method calls`
- Rust: `extract_receiver_info > should handle nested self field access`
