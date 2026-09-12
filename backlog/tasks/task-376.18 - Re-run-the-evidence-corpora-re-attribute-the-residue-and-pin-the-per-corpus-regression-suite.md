---
id: TASK-376.18
title: "Re-run the evidence corpora, re-attribute the residue and pin the per-corpus regression suite"
status: To Do
assignee: []
created_date: "2026-09-07 06:55"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.8
  - TASK-376.14
  - TASK-376.15
parent_task_id: TASK-376
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 17. Wave 7, last. Requires every other sub-task. No production code beyond the regression suite and the backlog rows it files.

## Work plan

1. Re-run the full pipeline over angular, rustc, tokio, sqlx, TypeScript, django, pandas, celery, express and mocha with TASK-376.16's taxonomy harness, control arm the tree TASK-376.16 recorded its baseline on, candidate arm this tree, interleaved in one session on one box. Report recovery per failure reason against that baseline and against TASK-376.17's post-annotation row and TASK-376.13's post-rung-5 row.
2. Report new false negatives by literal set difference over the complete member lists, the way TASK-381.11 did: the resolved caller-to-callee edge set must be a superset and the raw entry-point set a subset of the baseline's, and every removed entry point is spot-verified at its call site in the corpus source. Any edge lost or entry point gained is named, not netted.
3. Re-attribute the residue from the actual failure reasons rather than the original leaf split: for each corpus, the top remaining reasons with one named site each, routed to the fault area that owns them.
4. Record the permanent limitations that success criteria must not target — `wasm-hash.js:141` calling `exports.update()` on a `WebAssembly.Instance` exports object; DI containers keyed by computed runtime tokens in `Map<InjectionToken, InstanceWrapper>`; celery `canvas.py:736` (`.on_error(...)` off an unannotated Python factory); the Rust `Drop` rows, whose destructor call is compiler-injected with no call expression in source — as registry classifier candidates where they are classifiable and as documented residue otherwise.
5. Pin the achieved per-corpus counts in a corpus-level regression suite: one recorded-measurement row per corpus in `benchmark_corpus_load` and one named end-to-end case per corpus at the `Project` tier — angular `o.TypeVisitor` implementers and `inject(Router)`; rustc `LoweringContext` cross-file impl and trait default-body dispatch; tokio and sqlx `PgCube`; TypeScript `vfs.FileSystem`; django constructor rows; pandas `_parser_dispatch`; celery `certificate.py:100` and `loops.synloop`; express `lib/application.js:294` and the `require` + `mixin` pair; mocha `suites[0].afterEach()`; webpack `lib/Module.js:304`/`:317` and `this.#tm.getTransaction()`.
6. File the follow-ons this epic deliberately does not close as backlog tasks: making `SELF_REFERENCE_KEYWORDS` (`call_resolution/receiver_resolution.ts:83`) language-aware or preferring an in-scope binding (Rust `this` is an ordinary identifier; JavaScript `self` is a real global, used heavily by webpack); interprocedural dataflow for cross-function class carriers (Django's `form_class(**defaults)`); and whether Python `for` / `while` / `match` clauses should stop opening block scopes, from the measurement TASK-376.12 left open.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The ten corpora are re-run with the taxonomy harness, and per-reason recovery is reported against the TASK-376.16 baseline, the TASK-376.17 row and the TASK-376.13 row, from arms interleaved in one session.
- [ ] #2 New false negatives are reported by literal set difference: the resolved-edge set is a superset and the entry-point set a subset of the baseline's, with every removed entry point spot-verified at its call site.
- [ ] #3 The residue is re-attributed from actual failure reasons, one named site per reason per corpus, routed to its owning fault area.
- [ ] #4 The permanent limitations (WebAssembly exports object, runtime-token DI containers, celery `canvas.py:736`, Rust `Drop`) are recorded as out of scope.
- [ ] #5 A corpus-level regression suite pins the achieved per-corpus counts with one recorded row and one named end-to-end case per corpus.
- [ ] #6 The follow-ons (language-aware self-reference keywords, interprocedural cross-function carriers, Python loop-clause scopes) exist as backlog tasks.

<!-- AC:END -->

## Notes from wave 1

The baseline (`recorded_failure_taxonomy_baseline.ts`) holds nine corpora; microsoft/TypeScript is recorded under `not_measured` because `repository-root-excluding:baselines` discovers 19,783 files and the harness refuses the 35,122 MB heap that count implies on a 32,768 MB box. Re-running it needs a narrower predicate or a larger box. `run_load_benchmark.ts --baseline` runs one arm and prints the taxonomy; `--interleave` prints control and candidate side by side.
