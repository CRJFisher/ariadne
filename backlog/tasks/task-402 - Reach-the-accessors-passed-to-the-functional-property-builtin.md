---
id: TASK-402
title: "Reach the accessors passed to the functional property(...) builtin"
status: To Do
assignee: []
created_date: "2026-10-04 12:00"
labels:
  - python
  - reference_resolution
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A Python accessor passed as `fget`/`fset`/`fdel` to `property(...)` — `POST = property(_get_post, _set_post)` (`django/http/request.py`), `srs = property(_get_srs, _set_srs)` — is invoked by the descriptor on attribute access, never by name. Nothing links a caller, so each accessor is reported as an entry point. The decorator form is already covered; this is its functional sibling.

This is the fix for the `py-functional-property-accessor` registry rule: while it is `wip`, the triage classifier hides the false positive instead of Ariadne removing it.

## Work plan

Treat the function arguments of a `property(...)` call as callable-value references to those accessors, and make an attribute read (and, with TASK-374.8, a write) on the property reach the matching accessor.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Django's eight observed accessors are not entry points; a `property(...)` argument that is not a function creates no edge; the decorator-form behaviour is unchanged; the classifier has no remaining observed case on a re-run.
- [ ] #2 The false-positive pattern is re-measured on the corpora the rule observed it on, and the resolved-call and entry-point changes are accounted for by literal set difference.

<!-- AC:END -->
