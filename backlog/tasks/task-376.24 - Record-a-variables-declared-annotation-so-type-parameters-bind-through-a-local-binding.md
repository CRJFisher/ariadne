---
id: TASK-376.24
title: >-
  Record a variable's declared annotation so type parameters bind through a
  local binding
status: To Do
assignee: []
created_date: "2026-09-19 11:36"
labels:
  - receiver_type_inference
dependencies:
  - TASK-376.15
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`declared_annotation` (`resolve_references/type_parameter_environment.ts`) accepts four definition kinds — `parameter`, `variable`, `constant`, `property` — and reads the annotation text off `def.type`. The indexer records no `type` on a variable or a constant: `const routers: Array<Router> = []` and `let single: Router = new Router()` both index into the `variables` bucket (kinds `constant` and `variable`) with `type: undefined`, while a parameter carrying the same annotation records it. So two of the four branches never answer, and every caller reading an annotation off a local binding is in fact reading parameters and properties alone.

What it costs on the capability surface: type-parameter binding cannot see through a local variable, so the same code resolves or not depending only on whether the binding is a parameter or a `const`.

- `concrete_argument_type` reads a value argument's type from its declaration, so `const routers: Array<Router> = []; first_of(routers).navigate()` binds nothing, where `function call_site(routers: Array<Router>)` binds `T = Router` today.
- `bind_from_declared_instantiation` (`call_resolution/type_parameter_resolution.ts`) reads the receiver's own instantiation the same way: `const p: Provider<Foo>` cannot bind `Provider`'s `T`, though a parameter `p: Provider<Foo>` does — the case `type_parameter_resolution.test.ts` › "resolves a method returning the type argument its receiver was declared with" pins in parameter form only.
- `resolve_type_parameter_annotation` cannot type a local annotated with a type parameter (`let v: V = …` inside `fn walk<V: Visitor>`), the binding-shaped half of the receiver TASK-376.15 built for parameters.

Each miss leaves the call unresolved and its target looking unreachable — the false-positive entry point the TASK-376 line exists to remove.

The fix is in the indexer, not in this module: a variable's or constant's declared annotation has to reach the definition's `type` field, recorded by the symbol factories where a parameter's already is. The `type_preprocessing` parse-and-unify path needs no change — it is shared, and answers as soon as the text arrives.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 A variable or constant declaring an annotation records it on the definition's `type`: `const routers: Array<Router> = []` indexes as `type: "Array<Router>"`, asserted for TypeScript, Rust (`let r: Vec<Router>`) and Python (`routers: list[Router]`) in the owning `symbol_factories.*.test.ts`.
  Evidence: `symbol_factories.typescript.test.ts` › "a local binding's declared annotation (TypeScript)" asserts `Array<Router>` on a constant and `Router` on a `let`, `symbol_factories.rust.test.ts` asserts `Vec<Router>` on a `let` and `u32` on a `const`, `symbol_factories.python.test.ts` asserts `list[Router]` and `Router` on annotated assignments. Each also pins `type: undefined` for a binding that writes no annotation. All through `index_source` and `toEqual`. The TypeScript cases fail on the control tree (below), where the variable declarator's `type` was read off the name node and so always came back `undefined`; Rust and Python already recorded it, so their cases are guards on a fact the step keeps rather than a recovery.
- [x] #2 `declared_annotation` is reached for all four kinds its guard accepts — a unit case per kind in `type_parameter_environment.test.ts` — or any kind that remains unreachable is deleted from the guard rather than left dead.
  Evidence: `type_parameter_environment.test.ts` › "the annotation a value binding declares" has one case per kind: a parameter, a constant (`held`), a mutable variable (`mutable`) and a property (`owned`), plus the null answer for a class. All four kinds are reachable, so the guard is unchanged. The constant and variable cases fail on the control tree.
- [x] #3 `type_parameter_resolution.test.ts` gains the local-binding counterpart of each parameter-form case passing today: a factory argument held in a `const`, a receiver `const p: Provider<Foo>` binding `Provider`'s `T`, and a Rust local annotated with a bounded parameter.
  Evidence: "reads the element of a sequence a local constant declares" (factory argument held in a `const`), "resolves a method returning the type argument a local constant was declared with" (receiver `const p: Provider<Foo>`), and "reaches the bound's members from a Rust local annotated with the parameter". The first two fail on the control tree; the Rust case passes on both, since Rust locals recorded their annotation before this step.
- [x] #4 The per-corpus failure ledger is re-run and the `member_type_unknown` count restated against TASK-376.18's baseline, showing the recovery and no new false edges.
  Evidence: ten corpora, `--interleave` (control, candidate, control, candidate) in one session on one box, run dir `~/.ariadne/benchmark-runs/task-376.24/`; figures below.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What the capability surface gained

A TypeScript `const` or `let` that writes an annotation (`const routers: Array<Router> = []`, `let single: Router = new Router()`) records it as the definition's `type`, as a parameter, a property and a Rust or Python local already did. Type-parameter binding therefore sees through a local binding: a factory argument held in a `const` binds the factory's `T`, a receiver `const p: Provider<Foo>` binds `Provider`'s `T`, and a local annotated with a type parameter resolves through the parameter's bound. The same code resolves whether the binding is a parameter or a local.

The same fact types the plain `let x: T;` receiver, which is where almost all of the measured recovery sits: the idiom of a test file declaring `let pipe: DatePipe;` in a `describe` and assigning it in `beforeEach`.

## Mechanism

`capture_handlers.typescript.ts` records `type: extract_declared_type(capture.node)` on the variable handler. `extract_declared_type` (`symbol_factories.typescript.ts`) is the one reader of the annotation a TypeScript declaration writes after its name, shared by variables, class properties, interface property signatures and parameters. `type_parameter_environment.ts` is unchanged: `declared_annotation` answers as soon as the text arrives.

## Measured

Control: this tree with the TypeScript variable handler recording `type: undefined`. Candidate: this tree. Both `ariadne@5de273e3`, builds guarded by `assert_builds_current`, nine corpora at TASK-376.18's commits and predicates, plus express. Each pair ran control, candidate, control, candidate. Each arm's two runs agree on every fingerprint component and on the taxonomy, on all ten corpora.

`member_type_unknown` against TASK-376.18's recorded row (`ariadne@038b7daa`), then the control and candidate arms of this session:

| Corpus | 376.18 | control | candidate |
| --- | ---: | ---: | ---: |
| angular | 8883 | 8917 | 9750 (+833) |
| microsoft/TypeScript | 1429 | 1434 | 1546 (+112) |
| rustc, tokio, sqlx, django, pandas, celery, express, mocha | 20279, 1886, 912, 2161, 1480, 1072, 0, 69 | 19084, 1800, 855, 2038, 1479, 1113, 0, 69 | identical to control |

`member_type_unknown` rises on the two TypeScript corpora. A receiver that was untyped now has a type and fails one rung later, on a member the type does not declare. The recovery is in `receiver_type_unknown` and `resolved`:

| Corpus | Resolved | `receiver_type_unknown` | Other reasons that moved |
| --- | ---: | ---: | --- |
| angular | 160471 → 171504 (+11033) | 50935 → 39029 (−11906) | `polymorphic_no_implementations` +588, `method_not_on_type` +34, `collection_dispatch_miss` +2; 584 more call references |
| microsoft/TypeScript | 93574 → 93835 (+261) | 15306 → 14333 (−973) | `polymorphic_no_implementations` +614, `method_not_on_type` +36; 50 more call references |

The other eight corpora produce an identical fingerprint and taxonomy in both arms: Rust, Python and JavaScript locals did not depend on this recording.

New false edges, by literal set difference over the complete member lists:

- Resolved caller-to-callee pairs lost: 0 on all ten corpora. angular's `call_edges` shows 15 control-only entries and TypeScript's 26; every one is a pair the candidate also holds, with a larger call-site count (`callFn#3 → #4`), so none is a lost edge.
- Raw entry points gained: 0 on all ten. angular loses 196 entry points and TypeScript 22.
- Pairs gained: 10,337 on angular, 324 on TypeScript.

Spot-verified at the call site in the corpus source. Gained angular edges: `date_pipe_spec.ts:42` `pipe.transform(...)` on `let pipe: DatePipe`, `example-viewer.component.spec.ts:223` `component.toggleExampleVisibility()` on `let component: ExampleViewer`, `xi18n_spec.ts:52` `env.driveXi18n(...)` on `let env!: NgtscTestEnvironment`, `size_validator_spec.ts:25` `validator.validate(...)`. Gained TypeScript edges: `checker.ts:41820` `cancellationToken.throwIfCancellationRequested()` on `var cancellationToken: CancellationToken | undefined`. Removed angular entry points: `HttpContext.has` (called as `context.has(...)` on `let context: HttpContext`), `buffer.ts` `getInlayHints` (`appFile.getInlayHints()` in `inlay_hints_spec.ts`). Removed TypeScript entry points: `CompilerTest.verifyDiagnostics`, `verifySourceMapRecord` and `verifyTypesAndSymbols` (called at `compilerRunner.ts:99-104`), `NodeTypingsInstaller.handleRequest` (`installer.handleRequest(req)` at `nodeTypingsInstaller.ts:211`, `let installer: NodeTypingsInstaller | undefined`). Every sampled gained edge and every sampled removed entry point is a real call.

The harness cannot establish ground truth for the 10,337 gained angular pairs; the sample is the check.
<!-- SECTION:NOTES:END -->
