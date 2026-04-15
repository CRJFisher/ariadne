---
id: TASK-190.15.16
title: Run self-healing pipeline on rust-lang/rust (Rust)
status: To Do
assignee: []
created_date: '2026-04-15 21:56'
labels:
  - rust
  - integration-test
dependencies: []
parent_task_id: TASK-190.15
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Repo**: rust-lang/rust (~110k stars, ~85% Rust)

**Why**: The Rust compiler itself. Proc macros (bootstrapped), complex trait hierarchies and generics, lifetimes everywhere, unsafe (LLVM bindings), pattern matching on deeply nested enums (AST/HIR/MIR), closures and iterators, modules at massive scale, trait objects for compiler passes.

**Run**: `/self-repair-pipeline rust-lang/rust`

Record any false positives, parse errors, or pipeline crashes.
<!-- SECTION:DESCRIPTION:END -->
