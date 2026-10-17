---
id: TASK-376.30
title: Give a binding declared without a value the value its assignments agree on
status: Done
assignee: []
created_date: '2026-09-27 18:55'
updated_date: '2026-09-27 21:15'
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
- [x] #1 A JavaScript/TypeScript `var`/`let` declared without a value, and a Rust `let` declared without one, records the sources of the one value every assignment to it in its scope agrees on.
- [x] #2 Two assignments that disagree record no source, and an assignment to a same-named binding redeclared in a nested scope is not counted.
- [x] #3 `Project`-tier integration tests cover `var self; self = this; self.m()` inside a class, `let p; p = new Parser(); p.parse()`, the disagreeing `if`/`else` negative, and Rust `let this; this = Foo::new();`.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What the capability surface gained

- **A binding declared first and assigned later holds what its writes agree on.** `var self; self = this; self.n()` reaches the enclosing class. `let p; p = new Parser(); p.parse()` reaches `Parser.parse`. Rust `let this; if c { this = Foo::new(); } else { this = Foo::new(); } this.run()` reaches `Foo::run`, and `let other; other = self;` holds the receiver.
- **Disagreement holds nothing.** Branches constructing `Parser` and `Lexer`, or `Foo` and `Bar`, leave the call `receiver_type_unknown`. A write from a nested function or closure, a compound write, an increment or a loop target does the same, because its value cannot be read in the declaring scope.
- **A JavaScript collection lookup is only `get(k)` or `c[k]`.** `const args = A.children(n)` used to record `A` as the collection `args` was read from, so every call on `args` fanned out over `A`'s members. The fault predates this task; reading more writes exposed it. Python and Rust already required `get`.

## Mechanism

- `binding_writes.{javascript,rust}.ts` find the values written into a declarator: its initialiser, or the plain assignments in its own function (`var`), block (`let`), or following stretch of block (Rust `let`), skipping scopes that bind the name again.
- `agreed_fact.ts` keeps a fact only when every write states it identically. Each source extractor (`name_source`, `member_source`, call chain and arguments, collection source) reads through it, so agreement is per fact: branches constructing the same class with different arguments keep the class and drop the arguments.
- Rust constructions type a binding through `construct_target` rather than the value channel, so `metadata_extractors.rust.ts` redirects an assignment's construct target to the `let` it writes (`declaration_written_by`) when every write constructs through the same callee.

## Measured

Interleaved arms, control `2db9442e`, both builds checked current by TASK-399's guard.

| Corpus | Resolved | Notes |
| --- | ---: | --- |
| webpack `folder:lib` | 15201 → 15199 | +1 from a later write; 3 false fan-outs over `A` removed (56 false edges gone) |
| vscode `folder-ts:src/vs/base` | 32648 → 32632 | 16 false fan-outs removed, e.g. `toOrig.slice()` reached 10 `win32` members in the control; `event.test.ts` edges move from a variable to `Emitter.event` |
| rustc (376.18's predicate) | 113067 → 113074 | +7, no edge lost: the three `only_control` edges are ordinals renumbered in `run_test`, which gained `output`/`status` |

The declared-without-value bindings these corpora hold (574 in webpack `lib/`, 388 in vscode `vs/base`) are mostly JSDoc- or annotation-typed already, or written from calls whose return type nothing states, so the new reading adds little on its own. The `get` restriction is the larger effect, and it removes false edges.
<!-- SECTION:NOTES:END -->
