---
id: TASK-199.8.2
title: Fix receiver resolution not finding class scope for Rust impl blocks
status: Done
assignee: []
created_date: "2026-03-29 20:28"
labels:
  - bug
  - rust
  - receiver-resolution
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
parent_task_id: TASK-199.8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bug

`find_containing_class_scope()` in `receiver_resolution.ts` walked up the scope tree looking for `scope.type === "class"`, but Rust `impl` blocks create scopes of type `"block"`, not `"class"`. This meant `self.method()` calls inside Rust impl blocks could never resolve — the function would return `null` because it never found a class scope in the ancestry.

**Scope tree for `self.set_count()` inside `impl Counter`:**

```
function (increment body) → block (impl block) → module
```

The function skipped the `"block"` scope and walked to `"module"`, returning null.

## Root Cause

In Rust:

- `struct Counter { ... }` creates a scope of type `"class"`
- `impl Counter { ... }` creates a scope of type `"block"`

But methods live in the `impl` block scope, not the struct body scope. So walking up from a method's function scope, the first ancestor is the `"block"` (impl) scope, not the `"class"` (struct) scope.

## Fix

Extended `find_containing_class_scope()` to accept an optional `DefinitionRegistry` parameter. When a `"block"` scope is encountered, it calls `find_class_from_scope()` to check if the block contains methods with a parent class in the member_index. This distinguishes Rust impl blocks from regular block scopes (if/for/loop bodies) without false positives.

Updated `resolve_keyword_base()` to pass `context.definitions` to the function.

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed in task-199.8. Extended `find_containing_class_scope()` to detect Rust impl blocks by checking if block scopes contain methods via the member_index. All 67 receiver_resolution tests pass including 6 new Rust tests (up from 2). No regressions in existing TS/JS/Python receiver resolution tests.

<!-- SECTION:FINAL_SUMMARY:END -->
