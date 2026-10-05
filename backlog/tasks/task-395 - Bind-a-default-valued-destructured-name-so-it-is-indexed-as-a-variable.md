---
id: TASK-395
title: "Bind a default-valued destructured name so it is indexed as a variable"
status: To Do
assignee: []
labels:
  - semantic-indexing
  - bug
dependencies:
  - TASK-389
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A destructured binding that carries a default value is not indexed as a
variable at all, so nothing downstream can resolve it, type it, or reach a
method called on it. `const { storage = fallback } = options;` and
`const { storage: s = fallback } = options;` each bind a name a reader can
call, but the call graph holds no definition for it.

## Why it happens

A defaulted binding parses as `object_assignment_pattern`, whose bound name sits
under `left:` rather than as a direct named child of `object_pattern`. The
`@definition.variable` query in `typescript.scm` and `javascript.scm` matches
`(object_pattern (shorthand_property_identifier_pattern))` and
`(object_pattern (pair_pattern value:))`, neither of which matches through the
`object_assignment_pattern` wrapper, so the name is never captured. TASK-389
pinned this as a capture gap with the test _"binds no name at all for a
default-valued destructured binding"_.

The fix is a query change (add the `object_assignment_pattern` shape to the
destructuring captures), after which TASK-389's `extract_destructured_binding`
provenance walk extends to it, so a defaulted binding types the same way a plain
one does.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `const { storage = fallback } = options;` and `const { storage: s = fallback } = options;` each index a variable definition named for the binding, in both TypeScript and JavaScript.
- [ ] #2 A method called on a default-valued destructured binding of a typed source resolves the same way a plain destructured binding does (extends TASK-389's provenance to the `object_assignment_pattern` shape).

<!-- AC:END -->
