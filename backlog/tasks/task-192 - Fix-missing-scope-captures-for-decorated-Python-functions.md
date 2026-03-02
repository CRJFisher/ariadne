---
id: task-192
title: Fix missing scope captures for decorated Python functions
status: To Do
assignee: []
created_date: '2026-03-02'
labels:
  - bug
  - python
  - indexing
dependencies: []
---

## Description

Profiling Ariadne against the Django repo surfaces hundreds of warnings:
`Could not find body scope for function <name>: Error: No body scope found for <name> at <file>:<line>`

Every decorated Python function at module level (or nested inside another function) has no body
scope in the semantic index. This breaks reference attribution and call graph analysis — which
affects the vast majority of "interesting" functions in real Python projects (Django views, Flask
routes, pytest fixtures, FastAPI endpoints, etc.).

### Root Cause: Two bugs in `python.scm`

**Bug 1 (critical) — Missing @scope.function for decorated functions**

python.scm captures decorated function *definitions* but never creates *scopes* for them.
The function scope patterns are anchored to direct children of `module`:

    (module
      (function_definition) @scope.function   ; only matches direct child — not decorated!
    )

When a function is decorated, the tree-sitter AST becomes:
  module > decorated_definition > function_definition

The scope pattern does not fire because `function_definition` is no longer a direct child of
`module`. So find_body_scope_for_definition() in scopes/utils.ts finds zero callable scopes and
throws — caught as a console warning.

By contrast, decorated class *methods* already work correctly (lines 40-47 of python.scm, with
explicit decorated_definition scope patterns). And decorated Python *classes* also work because
their scope pattern is bare/un-anchored: `(class_definition body: (block) @scope.class)` matches
at any nesting depth.

Fix: add the two missing scope patterns to python.scm (after the existing function scope patterns,
before the `(lambda)` pattern):

    ; Module-level decorated function scopes
    (module
      (decorated_definition
        definition: (function_definition) @scope.function
      )
    )

    ; Nested decorated function scopes
    (function_definition
      body: (block
        (decorated_definition
          definition: (function_definition) @scope.function
        )
      )
    )

No changes needed to PythonScopeBoundaryExtractor — it already handles `function_definition`
nodes correctly via extract_regular_function_boundaries().

**Bug 2 (secondary) — Async functions fire duplicate definition captures**

For async functions (both decorated and undecorated), two query patterns both match:

1. (module (function_definition name: (identifier) @definition.function))
2. (module (function_definition "async" name: (identifier) @definition.function.async))

Both handlers (handle_definition_function and handle_definition_function_async) are *identical* —
both call builder.add_function() with the same parameters, neither sets any async flag. This causes:

- Undecorated async functions: two duplicate symbols created silently
- Decorated async functions: double warnings (no scope fires twice = 2x the warning)

The @definition.function.async patterns add no semantic information. Remove all 4 (module-level,
module-level decorated, nested, nested decorated) and remove handle_definition_function_async
from the capture handler registry.

### Cross-Language Analysis

TypeScript: Decorators are direct children of the decorated node (not wrappers), so scope
patterns like (function_declaration) @scope.function fire regardless. No gap.

Rust: Attributes (#[test], #[derive(Debug)]) are preceding siblings, not wrapper nodes.
Scope patterns fire on function_item directly. No gap.

JavaScript: No decorator syntax.

**The bug is Python-specific and affects only decorated functions, not classes.**

### Existing Test Gap

index_single_file.python.test.ts:794-826 ("should handle decorators with arguments") only
checks that the function appears in index.functions and that the decorator call is in references.
It does NOT verify a body scope exists. The bug passes undetected.

## Acceptance Criteria

- [ ] Decorated module-level Python functions have a body scope in the semantic index
- [ ] Decorated nested Python functions have a body scope
- [ ] No "Could not find body scope for function" warnings when indexing the Django repo:
      `ARIADNE_PROFILE=1 pnpm exec tsx scripts/profile_load.ts --project-path /tmp/django --batch 2>&1 | grep "Could not find body scope"`
      should produce no output
- [ ] Async function definitions are not duplicated (one symbol per function, not two)
- [ ] Existing tests continue to pass
- [ ] New test: decorated module-level function produces a "function" scope with the correct name
- [ ] New test: decorated nested function produces a "function" scope with the correct name
- [ ] New test: decorated async function produces exactly one entry in index.functions

## Implementation Plan

### Step 1: Fix python.scm

File: `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

**Change A** — Add 2 missing scope patterns after line 22 (before the `(lambda)` pattern):

    ; Module-level decorated function scopes
    (module
      (decorated_definition
        definition: (function_definition) @scope.function
      )
    )

    ; Nested decorated function scopes
    (function_definition
      body: (block
        (decorated_definition
          definition: (function_definition) @scope.function
        )
      )
    )

**Change B** — Remove 4 redundant @definition.function.async patterns (current lines 109-147):

- `(module (function_definition "async" ... @definition.function.async))`
- `(module (decorated_definition definition: (function_definition "async" ... @definition.function.async)))`
- `(function_definition body: (block (function_definition "async" ... @definition.function.async)))`
- `(function_definition body: (block (decorated_definition definition: (function_definition "async" ... @definition.function.async))))`

Also remove the paired `@modifier.visibility "async"` captures within each pattern.

### Step 2: Remove dead handler

File: `packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.ts`

Remove `handle_definition_function_async()` (lines 362-387) and its registry entry at line 1034.

File: `packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.test.ts`

Remove `"definition.function.async"` from the function_mappings array (line 170).
Remove "should handle async functions" test (lines 312-323).
Remove "should have is_exported=true for module-level async functions" test (lines 1040-1059).

### Step 3: Add tests

File: `packages/core/src/index_single_file/index_single_file.python.test.ts`

In the "Decorator handling" describe block (line 752), add 3 tests:

1. Decorated module-level function → scope with name "my_view" and type "function" exists in index.scopes
2. Decorated nested function → scope with name "inner" and type "function" exists in index.scopes
3. Decorated async function → exactly one entry in index.functions for that name

## Files to Modify

1. `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
2. `packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.ts`
3. `packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.test.ts`
4. `packages/core/src/index_single_file/index_single_file.python.test.ts`
