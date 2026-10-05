---
id: TASK-403
title: "Keep a Python function reachable when a registration decorator enrols it in a dispatch table"
status: To Do
assignee: []
created_date: "2026-10-04 12:00"
labels:
  - python
  - reference_resolution
  - indirect_reachability
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A Python function enrolled by a registration decorator (`@register_lowering(...)`, `@event.listens_for(...)`, `@control_command(...)`) is later invoked through a computed key (`lowerings[op](...)`). The only line bearing its name is the decorated definition, so no call edge exists and it is reported as an entry point (24 observed cases across pytorch, celery, sqlalchemy).

This is the fix for the `registration-decorator-dispatch` registry rule: while it is `wip`, the triage classifier hides the false positive instead of Ariadne removing it.

## Work plan

Decide, from the decorator's own definition rather than a curated name list, when a decorator stores its target in a collection, and record that collection read as indirect reachability for the decorated function. If no such decision can be made from source, record that the pattern is a permanent limitation and retire the `wip` status instead.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The three named examples are not entry points; an ordinary decorator (`@staticmethod`, `@lru_cache`, `@property`) enrols nothing; either the classifier has no remaining observed case or the rule is moved to `permanent` with the reason recorded.
- [ ] #2 The false-positive pattern is re-measured on the corpora the rule observed it on, and the resolved-call and entry-point changes are accounted for by literal set difference.

<!-- AC:END -->
