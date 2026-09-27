---
id: TASK-376.30
title: Give a binding declared without a value the value its assignments agree on
status: To Do
assignee: []
created_date: '2026-09-27 18:55'
labels:
  - receiver_type_inference
dependencies:
  - TASK-376.25
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

The indexer reads what a binding holds from its declarator's initialiser: the name it reads (`name_source`), the member it reads (`member_source`), the call or construction it is initialised from, and the collection it indexes. A binding declared first and assigned later has no initialiser, so all of those are absent:

- JavaScript/TypeScript `var self; … self = this;`, `let parser; parser = new Parser()`, and `let x; if (a) x = make(); else x = make();`
- Rust `let this; this = Foo::new();`

The assignment is captured as an `AssignmentReference`, but no resolver reads its right-hand side. So the binding holds nothing, and every call through it ends `receiver_type_unknown`, even where every write puts the same value in it. Python needs nothing here: each assignment is itself a definition, and the value channel already takes the one binding that reaches a read.

## Work plan

1. Give each language's initialiser reader one notion of the value a declared binding holds. That is its initialiser when it has one. When it has none, it is the right-hand side of the plain assignments to the same name within the declaring scope, excluding nested scopes that declare the name again, provided all of those assignments record identical sources.
2. When two assignments disagree, record nothing. A union is never one class, and a missing edge is never replaced by a wrong one. This is the rule `returned_name_chain` applies to a body's returns.
3. Every source the reader records (`name_source`, `member_source`, the call chain and its arguments, the collection source) then follows the value for free, and so does the value channel's construction reading (`initialized_from_call` for `new T()`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A JavaScript/TypeScript `var`/`let` declared without a value, and a Rust `let` declared without one, records the sources of the one value every assignment to it in its scope agrees on.
- [ ] #2 Two assignments that disagree record no source, and an assignment to a same-named binding redeclared in a nested scope is not counted.
- [ ] #3 `Project`-tier integration tests cover `var self; self = this; self.m()` inside a class, `let p; p = new Parser(); p.parse()`, the disagreeing `if`/`else` negative, and Rust `let this; this = Foo::new();`.
<!-- AC:END -->
