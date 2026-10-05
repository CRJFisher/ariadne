---
id: TASK-401
title: "Resolve a function registered by path in a Rust macro-expander table to its definition"
status: To Do
assignee: []
created_date: "2026-10-04 12:00"
labels:
  - rust
  - syntactic_extraction
  - reference_resolution
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

rustc registers builtin expanders as function-pointer values inside `register_bang! { bench: test::expand_bench, }`-style tables (`compiler/rustc_builtin_macros/src/lib.rs:86`, `:95`). The compiler dispatches through the stored pointer; the macro body is a token tree, so the indexer sees no reference to the function and reports each registered expander as an entry point.

This is the fix for the `rust-macro-registration-table` registry rule: while it is `wip`, the triage classifier hides the false positive instead of Ariadne removing it.

## Work plan

Index a path in value position of a macro-invocation table as a reference to the function it names, recorded as a callable-value (weak) edge like TASK-374.3's argument-position form, without parsing macro bodies as items (that decision belongs to TASK-400).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The six `rust-lang/rust` examples of the rule (`bench`, `naked_asm`, and siblings) are not entry points; a path in a macro table that names no function creates no edge; the `rust-macro-registration-table` classifier has no remaining observed case on a re-run.
- [ ] #2 The false-positive pattern is re-measured on the corpora the rule observed it on, and the resolved-call and entry-point changes are accounted for by literal set difference.

<!-- AC:END -->
