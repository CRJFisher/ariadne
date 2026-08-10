---
id: TASK-380
title: "Give reference sites symbol identity so the syntax route carries no judgement"
status: To Do
assignee: []
created_date: "2026-08-10 16:20"
labels:
  - entry_point_classification
dependencies:
  - TASK-373.3
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`references-without-call-syntax` is the diagnosis for a callable whose only mentions are non-call references — a getter read, a callback handed to an invoker, a dispatch-table value. It routes to `entry_point_classification`, which is the right area, but it carries `needs_judgement: true` and so costs a strategist adjudication on every member that lands there.

The judgement is not pessimism. `build_reference_index` keys each site on the final dotted segment of the reference's name, filtered to a bare identifier. A member named `load` collects every `x.load` in the corpus, whichever type `x` has. The area is certain because the evidence shape is certain; whether these particular sites reach *this* member is not, so a human still has to look.

The reference registry already holds enough to answer it: `SymbolReference` carries `scope_id` and, where the resolver succeeded, type information about the receiver. Keying reference sites on the resolved symbol rather than the name's last segment turns the evidence from "something called `load` is mentioned here" into "this member is mentioned here", which is what the classifier author needs and what removes the adjudication.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `ReferenceSiteDiagnostic` carries the resolved symbol the site reaches, and `reference_sites` for a member holds only sites that reach that member.
- [ ] #2 A same-named member on an unrelated type no longer contributes reference sites to the entry — pinned by a two-class fixture where both declare the same member name and only one is referenced.
- [ ] #3 `derive_fault_area` maps `references-without-call-syntax` to `{ area: "entry_point_classification", needs_judgement: false }`, and `.claude/skills/triage/reference/diagnosis_routes.md` says so.
- [ ] #4 Sites whose receiver the resolver could not type are still carried, marked as unresolved, and still route with judgement — the fallback is narrowed, not deleted.
- [ ] #5 Integration tests against the real pipeline cover the evidence cases TASK-373.3 AC #4 named: celery `registry.register(s.deserialize)` and `{'*': dumper.on_event}`, express `user.load` / `user.view` / `user.update`, celery `consumer._limit_post_eta`, django `adapt_unknown_value`.

<!-- AC:END -->
