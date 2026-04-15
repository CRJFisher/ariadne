---
id: TASK-190.15.20
title: Run self-healing pipeline on launchbadge/sqlx (Rust)
status: To Do
assignee: []
created_date: '2026-04-15 21:57'
labels:
  - rust
  - integration-test
dependencies: []
parent_task_id: TASK-190.15
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Repo**: launchbadge/sqlx (~17k stars, ~99% Rust)

**Why**: Async-first SQL toolkit with compile-time query checking. Proc macros that query a live DB at compile time (`query!`, `query_as!`), complex lifetime management for borrowed query results, `Executor`/`Encode`/`Decode` trait abstraction, async streams (implementing `Stream`), unsafe FFI with native DB clients, multi-crate workspace.

**Run**: `/self-repair-pipeline launchbadge/sqlx`

Record any false positives, parse errors, or pipeline crashes.
<!-- SECTION:DESCRIPTION:END -->
