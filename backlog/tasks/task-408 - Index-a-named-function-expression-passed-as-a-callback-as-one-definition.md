---
id: TASK-408
title: Index a named function expression passed as a callback as one definition
status: To Do
assignee: []
created_date: "2026-10-17 21:01"
labels:
  - indexing
  - javascript
  - typescript
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A named function expression passed as a call argument or object property value — `register(target, function wrapper() { helper(); })`, `{ onClick: function handle() {} }` — is indexed as two functions: `wrapper`, which owns the body scope and the calls inside it, and a spurious `<anonymous>` at the same span with no body scope ("Could not find body scope for anonymous function" on every such site). The callback context, which tells the call graph that the function is invoked by the callee it is passed to, sits only on the spurious definition. lodash's `test/test.js` has three such sites; the shape is common in JavaScript and TypeScript test suites and event-handler code.

After this task such a function is one definition, named `wrapper`, that owns its body and carries its callback context.

## Root cause

`queries/javascript.scm` and `queries/typescript.scm` capture argument-position and property-value function expressions as `@definition.anonymous_function` without the `!name` constraint that every other anonymous-function pattern carries, while `(function_expression name: (identifier) @definition.function)` captures the same node by name. Only the anonymous-function handler calls `detect_callback_context`, so constraining the patterns with `!name` alone would drop the callback context of named callbacks.

## Approach

Add `!name` to the two patterns in each query, and have the named-function handler record callback context for a function expression in argument or property position, so the one remaining definition carries it. Check the call-graph effect on the triage corpus: named callbacks must stay reachable through their callee.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A named function expression in argument or property-value position yields exactly one function definition, named, with its body scope and callback context
- [ ] #2 No 'Could not find body scope' warning is logged for that shape
- [ ] #3 Named callbacks stay reachable in the call graph; the lodash and express triage entry-point lists do not grow
<!-- AC:END -->
