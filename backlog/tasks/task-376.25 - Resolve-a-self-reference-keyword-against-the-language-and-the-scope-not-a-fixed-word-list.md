---
id: TASK-376.25
title: >-
  Resolve a self-reference keyword against the language and the scope, not a
  fixed word list
status: To Do
assignee: []
created_date: '2026-09-19 13:40'
labels:
  - receiver_type_inference
dependencies:
  - TASK-376.5
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

`SELF_REFERENCE_KEYWORDS` (`call_resolution/receiver_resolution.ts:83`) is one set of four words — `this`, `self`, `super`, `cls` — consulted for every language and ahead of every binding. `extract_receiver` reads the head of a property chain, finds the word in that set, and returns a keyword base; nothing asks which language the file is in, and nothing asks whether the enclosing scope binds that name to something.

Two of the four words are ordinary identifiers in two of the four supported languages:

- **Rust has no `this`.** `let this = Foo::new(); this.run()` is ordinary Rust, and the head is a local binding whose type the value channel knows. Read as a keyword, it resolves through `find_self_type` against the enclosing `impl` — a different type, or none — so the call is mis-targeted or ends `no_enclosing_class_scope`.
- **JavaScript's `self` is a real global.** `self` is the worker and window global, and the `var self = this` capture idiom rebinds it as a plain local. webpack uses both heavily. Read as a keyword, `self.method()` in a module-level function with no enclosing class ends `no_enclosing_class_scope`, and inside a class the capture idiom accidentally resolves to the right type for the wrong reason — so the shape cannot be told from the defect.

A word that is a keyword in one language and a binding in another cannot be decided by a word list. It is decided by the language, and then by whether the scope binds the name.

## Work plan

1. Key the keyword set by `Language`: TypeScript and JavaScript take `this` and `super`; Python takes `self`, `cls` and `super`; Rust takes `self` and `Self`. The file's language is on the `SemanticIndex` the resolution context already carries.
2. Prefer an in-scope binding over the keyword reading: if the enclosing scope chain binds the head name, resolve it as an identifier base through the value channel, and fall back to the keyword reading only when it binds nothing. This is what makes `var self = this` resolve through the binding it actually names rather than through the enclosing class by coincidence.
3. Measure the recovery on webpack (`db98306a`), tokio and rustc against TASK-376.18's achieved row, per failure reason. `no_enclosing_class_scope` is the reason both defects land in.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 The self-reference keyword set is a function of the file's language, and Rust `this` and JavaScript `self` are no longer keywords.
- [ ] #2 A head name the enclosing scope binds resolves through the value channel, and the keyword reading answers only when the scope binds nothing.
- [ ] #3 Integration tests at the `Project` tier cover Rust `let this = Foo::new(); this.run()`, JavaScript `var self = this; self.m()` inside a class, and a module-level JavaScript `self.m()` with no enclosing class.
- [ ] #4 Per-reason recovery is measured on webpack, tokio and rustc against TASK-376.18's achieved row.
<!-- AC:END -->
