---
id: TASK-376.25
title: >-
  Resolve a self-reference keyword against the language and the scope, not a
  fixed word list
status: Done
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
- [x] #1 The self-reference keyword set is a function of the file's language, and Rust `this` and JavaScript `self` are no longer keywords.
  Evidence: `self_reference_keyword(language, name)` in `@ariadnejs/types` (`symbol_references.ts`) holds the one table — TypeScript/JavaScript `this`/`super`, Python `self`/`cls`/`super`, Rust `self`. Every consumer reads it: `receiver_resolution.ts` (`read_self_reference`), the JavaScript/Python/Rust metadata extractors, `call_site_syntax.python.ts`, and the entry-point diagnostics' `receiver_kind_of`. The TS/JS call-site leaf keys `self_keyword` on the `this`/`super` grammar nodes alone. `symbol_references.test.ts` pins the table per language; `receiver_resolution.test.ts` pins Rust `this` and JavaScript `self` as identifier bases.
- [x] #2 A head name the enclosing scope binds resolves through the value channel, and the keyword reading answers only when the scope binds nothing.
  Evidence: `read_self_reference` decides every receiver head, `self_reference_call` included. A reserved keyword (JS/TS `this`/`super`, Rust `self`) cannot be rebound, so it is the receiver wherever it appears; Python's words are conventions (`self_reference_is_bindable`), so a Python head reads as the receiver only where the scope binds nothing or binds the first parameter of a method declared in a class body — any other binding (`cls = Parser`, a free function's `self`, the `cls` of `def register(self, cls)`) resolves through the value channel. A binding initialised by a bare keyword records it as `name_source` (`var self = this`, `this as any`, `(this)`, `this!`, Rust `let this = self`), and `value_source.ts` reads a lone keyword through the same rule. Unit cases in `receiver_resolution.test.ts`; value-channel cases in the integration tests below.
- [x] #3 Integration tests at the `Project` tier cover Rust `let this = Foo::new(); this.run()`, JavaScript `var self = this; self.m()` inside a class, and a module-level JavaScript `self.m()` with no enclosing class.
  Evidence: "Self-reference keywords" blocks in `project.rust.integration.test.ts` (`let this = Foo::new()` at module level and inside another `impl`; `this: Self`, `-> &mut Self` and `let this = self`), `project.javascript.integration.test.ts` (`var self = this` beside a `self` holding another class; module-level `self.postMessage()` ending `name_not_in_scope`), `project.typescript.integration.test.ts` (`this as any`, `this!`), and `project.python.integration.test.ts` (`me = self`, module-level `cls = Parser`, `def register(self, cls: Plugin)`).
- [x] #4 Per-reason recovery is measured on webpack, tokio and rustc against TASK-376.18's achieved row.
  Evidence: `Measured recovery` below — interleaved control/candidate arms, both with `dist` rebuilt, plus celery and express as regression guards.
<!-- AC:END -->

## Implementation notes

### What the capability surface gained

A receiver spelled with a word that is a keyword in some other language is now resolved as what it is in its own file, so the calls through it reach the right method — or honestly none — instead of the enclosing class by coincidence.

- **Rust `this` is a local.** `let this = Foo::new(); this.run()` reaches `Foo::run`, inside another `impl` as well as at module level, where it used to dispatch against the enclosing `impl` or end `no_enclosing_class_scope`.
- **JavaScript `self` is a name.** `var self = this` resolves through the binding, so a `self` holding another class's instance reaches that class; a module-level `self.postMessage()` ends `name_not_in_scope` (it is the worker/window global) rather than `no_enclosing_class_scope`.
- **A binding that holds the receiver is typed as the receiver.** `const dep = this; dep.getIds()`, `amqp = self; amqp.default_queue`, `let this = self; this.m()`, and a body that `return this`s now carry the enclosing type through the value channel.
- **Rust `Self` in type position names the impl type.** `fn map(this: Self)`, `-> Self` and `-> &mut Self` resolve through the Rust path resolver, so builder chains (`g.arm().fire()`), `clone()`, and the guard `map(this: Self)` idiom resolve. This was a latent gap the keyword coincidence had been hiding: without it, making Rust `this` an identifier lost 26 tokio edges.

### Measured recovery

Interleaved A,B,A,B arms, one box, one session. Control is `ariadne@81769770` (the tree this branch starts from, in its own worktree with `dist` rebuilt); candidate is this tree with `dist` rebuilt. Pass A indexes on worker threads that load the built `dist`, so an arm whose `dist` is stale measures its resolver against another tree's indexer — both were rebuilt for these rows.

| Corpus (predicate, files) | Resolved | Call edges | Raw entry points |
| --- | ---: | ---: | ---: |
| tokio (`repository-root`, 790) | 8813 → **8933** (+120) | 7762 → 7856 | 2363 → 2345 |
| rustc (376.18's predicate, 3516) | 112744 → **113067** (+323) | 95915 → 95953 | 19770 → 19735 |
| webpack (`folder:lib`, 635) | 15198 → 15201 (+3) | 12178 → 12180 | unchanged |
| webpack (`folder:test/configCases/worker`, 233) | unchanged | unchanged | unchanged |
| celery (`repository-root`, 418) — guard | 11355 → 11356 (+1) | 9547 → 9548 | unchanged |
| express (`repository-root`, 141) — guard | identical fingerprint | | |

Per reason (control → candidate):

| Reason | tokio | rustc | webpack lib | webpack worker | celery |
| --- | ---: | ---: | ---: | ---: | ---: |
| `receiver_type_unknown` | +44 | +760 | −2 | 0 | +30 |
| `member_type_unknown` | −122 | −1226 | +1 | 0 | 0 |
| `method_not_on_type` | +22 | +139 | 0 | 0 | +3 |
| `class_definition_not_found` | −63 | −13 | 0 | 0 | 0 |
| `no_enclosing_class_scope` | −1 | −43 | 0 | −4 | −33 |
| `name_not_in_scope` | +4 | +63 | 0 | +4 | 0 |
| `no_parent_class` | −4 | 0 | 0 | 0 | 0 |

Against TASK-376.18's achieved row (`038b7daa`): the control reproduces it on tokio exactly (8,813 resolved); on rustc the control reads 112,744 against the row's 113,204, a gap that lies between `038b7daa` and this branch's base and that these arms do not attribute. The deltas above compare this change against its own base, so they are this change alone.

What the numbers are made of:

- **tokio +120.** Builder chains through `-> Self` / `-> &mut Self` and `clone()`, and the `map(this: Self)` guards. Five sites are lost, all Pin re-borrows whose value comes from `std` (`let this = self.get_mut()`, `Pin::into_inner(self)`), which the keyword reading had answered by coincidence.
- **rustc +323, with churn.** 896 edges gained and 858 lost. Of the 795 calls newly unresolved, 767 are `this` bound as a **closure parameter** — `self.with_res(r, |this| this.parse_expr(…))`, rustc's dominant idiom — where the closure receives `&mut Self` from the callee's `F: FnOnce(&mut Self)` bound. Nothing types a closure parameter from its callee's signature, so the honest identifier reading ends `receiver_type_unknown` where the keyword reading reached the enclosing type by coincidence. The rest are a dozen `let this = ManuallyDrop::new(self)`-style wrappers and a handful of shapes under 5 sites each.
- **webpack: the premise does not hold at `db98306a`.** `lib/` contains no `self.` call and no `var self = this`; `self` appears only in 9 worker test cases as the global. The capture idiom it does use is `const x = this`, which now resolves (2 edges). The worker cases move 4 calls from `no_enclosing_class_scope` to `name_not_in_scope`, which is what they are.
- **celery +1, and 33 honest re-attributions.** `amqp = self` reaches the `default_queue` property; 33 `self` receivers in free functions and nested defs move from `no_enclosing_class_scope` to `receiver_type_unknown` (they are parameters nothing types).

### Decisions

- **Reserved versus bindable, not "any binding wins".** A literal reading of the work plan's step 2 would make every Python method's `self` — a parameter — resolve through the value channel, which types nothing. The rule is split by whether the language lets a scope rebind the word: reserved keywords (JS/TS `this`/`super`, Rust `self`) are the receiver wherever they appear; Python's conventions yield to any binding except the method's first parameter.
- **Rust `Self` is not a receiver keyword.** The work plan listed it beside `self`; no receiver chain is headed by `Self`. It is a type-position word, so it is `RUST_SELF_TYPE_NAME` in `@ariadnejs/types`, read by the annotation lookup and the Rust path resolver.
- **`SelfReferenceCall.keyword` and `ReceiverInfo.self_keyword` are removed.** The chain head carries the word, and whether it still denotes the receiver is the resolver's question.

### Follow-ons

- Type a closure parameter from the callee's `Fn*` bound (`fn with_res<T>(&mut self, f: impl FnOnce(&mut Self) -> T)`): rustc's `|this|` idiom, 767 sites.
- Model the `std` re-borrows of `self` (`Pin::get_mut`, `Pin::into_inner`, `ManuallyDrop::new`) as holding the receiver: tokio 5 sites, rustc ~12.
- A binding assigned after its declaration (`var self; self = this`) records no `name_source`; that holds for every name source, not only keywords.

