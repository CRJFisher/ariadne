---
id: TASK-347.1
title: "Triage and resolve the Rust `eq_impl` receiver-resolution miss"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-347
priority: high
ordinal: 1000
plan_dedup_keys:
  - 3fc6b57f4c95e16940f0ee53519913dccf03bfcd78a7cea0bccf9aa9afbc4f51
plan_source_tasks:
  - pt-46c48757cf5ad6e9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. After the member-surface change (parent task) lands, triage the sqlx `eq_impl` row (`self.eq_impl(...)` within the same impl block) against the now-completed member index.

2. Verify whether the Rust impl method `eq_impl` is in the member index at all and whether the `self` receiver resolves to the impl's `Self` type.

3. If the method is indexed and the receiver resolves correctly, the miss is a Rust receiver-resolution / impl-member-population gap (not an alias). Open and implement the fix in the Rust receiver-resolution path with a Rust regression test.

4. If mechanism A's completed index already resolves it, close this sub-task as subsumed by the parent — do not commit standalone scope.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->
