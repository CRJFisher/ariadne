---
id: TASK-382
title: "Audit the export captures no handler claims"
status: To Do
assignee: []
created_date: "2026-08-12 12:40"
labels:
  - syntactic_extraction
dependencies:
  - TASK-375
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

Across the four `.scm` files there are roughly 39 `@export.*` captures and no handler
registered for any of them. A capture with no handler is inert: the query matches, the capture
is emitted, and nothing reads it. Two of them were deleted in TASK-375 because that task needed
the node shapes they occupied; the rest are still there.

Each inert capture is one of three things, and the audit's job is to say which:

- A surface the index is silently missing, where the query author saw the shape correctly and
  the handler was never written. This is a capability gap.
- A duplicate of a surface some other capture already delivers, in which case it is dead weight
  that makes the query files read as though they cover more than they do.
- A shape that no longer exists in the grammar, in which case it never matches at all.

## Why this is its own task

TASK-375's work plan says explicitly to record this as a separate audit rather than revive the
captures speculatively, per YAGNI. Reviving one without a consumer would add surface nobody
reads; deleting one that names a real gap would lose the record of it. Neither is decidable
without going capture by capture.

TASK-364.11 already tracks two orphan captures; this audit covers the rest and should fold that
row in or hand it the ones that turn out to be real gaps.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Every `@export.*` capture with no registered handler is listed with its file, line and the node shape it matches.
- [ ] #2 Each is classified as a missing surface, a duplicate of an existing capture, or a shape the grammar no longer produces — with the evidence for the classification.
- [ ] #3 Captures classified as duplicate or non-matching are deleted.
- [ ] #4 Captures classified as a missing surface get a backlog row naming the capability they would add; none is revived without a consumer.

<!-- AC:END -->
