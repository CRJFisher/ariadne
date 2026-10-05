---
id: TASK-404
title: "Record a bound method passed by reference to a higher-order function as a callable value"
status: To Do
assignee: []
created_date: "2026-10-04 12:00"
labels:
  - python
  - javascript
  - typescript
  - reference_resolution
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A method handed by reference to an invoker — `maybe_call(self.on_node_status, node, retcode)` in Python, `this.socket.on('data', this.onData.bind(this))` in JavaScript — has no call site, so it is reported as an entry point (five observed cases across celery, sqlalchemy, angular). TASK-374.3's callable-value capture covers JavaScript and TypeScript argument position only; Python has no counterpart, and the `.bind(this)` wrapper is not looked through.

This is the fix for the `callback-passed-to-invoker` registry rule: while it is `wip`, the triage classifier hides the false positive instead of Ariadne removing it.

## Work plan

Extend the callable-value reference to Python argument-position `self.method` / `obj.method`, and look through `.bind(...)` in JavaScript and TypeScript, recording a weak edge to the method. A bare-name argument stays unmatched unless the name resolves to a callable.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The five observed examples are not entry points; a non-callable attribute passed as an argument creates no edge; the classifier has no remaining observed case on a re-run.
- [ ] #2 The false-positive pattern is re-measured on the corpora the rule observed it on, and the resolved-call and entry-point changes are accounted for by literal set difference.

<!-- AC:END -->
