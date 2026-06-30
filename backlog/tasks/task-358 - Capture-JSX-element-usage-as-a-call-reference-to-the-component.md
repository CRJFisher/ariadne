---
id: TASK-358
title: Capture JSX element usage as a call reference to the component
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - indexer
  - typescript
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A JSX element (`<Component/>`, `<Component>…</Component>`) is how a React/JSX component
is invoked, but the `@reference.call.jsx` capture for JSX elements is commented out in
`typescript.scm` (around line 695). So a component referenced only via JSX emits no
`@reference.call`, and a component used exclusively as a JSX element looks unreachable.

Surfaced by TASK-190.30.1's registry audit, which removed the `ts-jsx-component-call`
suppressor classifier as a fixable capture gap. This is the same class of gap as
TASK-351 (member/property reference capture) but covers the distinct JSX-element form.

### Origin (deleted classifier row this tracks)

`ts-jsx-component-call` (predicate; observed_count 0, but the gap is provable in
`typescript.scm` independent of a triage hit).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A JSX element usage emits a `@reference.call` (or equivalent) resolving to the
      component definition, in both `.tsx` and `.jsx`.
- [ ] A component used only as a JSX element is no longer an unreachable entry point.
- [ ] Regression test covers JSX-only component usage.

<!-- AC:END -->
