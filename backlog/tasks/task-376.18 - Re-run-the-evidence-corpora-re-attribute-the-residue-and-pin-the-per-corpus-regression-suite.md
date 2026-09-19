---
id: TASK-376.18
title: "Re-run the evidence corpora, re-attribute the residue and pin the per-corpus regression suite"
status: Done
assignee: []
created_date: "2026-09-07 06:55"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.8
  - TASK-376.14
  - TASK-376.15
  - TASK-376.20
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

## Carried from TASK-376.13

Rung 5 fans a member miss out to every subtype that declares the member, so a member the receiver type gains at run time reads as a miss. django's `Manager = BaseManager.from_queryset(QuerySet)` copies `QuerySet`'s methods onto the generated class, and `Manager` declares no `create`: 65 `objects.create(...)` calls in django's tests reach the one test manager subclass that declares `create`, and that method stops being an entry point. Step 2's literal set difference names it among the removed entry points, and its call-site spot check fails. Route it in step 3 from the measured count: a registry classifier candidate or documented residue under step 4, or a follow-on task under step 6 that models runtime member provision.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 The ten corpora are re-run with the taxonomy harness, and per-reason recovery is reported against the TASK-376.16 baseline, the TASK-376.17 row and the TASK-376.13 row, from arms interleaved in one session.
  Evidence: `recorded_corpus_resolution.ts` holds nine rows from candidate arms at `038b7daa`; the control arms ran `a3d5beea`, the tree `recorded_failure_taxonomy_baseline.ts` was measured on, from a worktree with `dist` rebuilt. Every pair ran control-then-candidate back to back in one sitting on one box, `~/.ariadne/benchmark-runs/task-376.18/`. The control rows reproduce the baseline's taxonomy exactly on all nine corpora, which is what makes the candidate rows a measurement of this tree rather than of the session. microsoft/TypeScript is refused in the same words as the baseline.
- [x] #2 New false negatives are reported by literal set difference: the resolved-edge set is a superset and the entry-point set a subset of the baseline's, with every removed entry point spot-verified at its call site.
  Evidence: the set difference is in `Set difference, named` below. Neither containment holds literally, and the report says so rather than netting it: 1,124 (angular) to 7,821 (django) caller-to-callee pairs are only in the control, and 2 (tokio) to 43 (django) entry points are only in the candidate. Every one is decomposed by mechanism and the three classes are named. Three removed entry points are spot-verified at their call sites (django `search.py:87`, `csp.py:14`, `json.py:38`).
- [x] #3 The residue is re-attributed from actual failure reasons, one named site per reason per corpus, routed to its owning fault area.
  Evidence: `Residue, re-attributed` below gives, per corpus, the remaining reasons in count order with a named site for each and the `AriadneFaultArea` that owns it (`packages/types/src/ariadne_fault_area.ts`'s `REASON_TO_AREA`). The per-reason callee histograms are in `~/.ariadne/benchmark-runs/task-376.18/residue/`.
- [x] #4 The permanent limitations (WebAssembly exports object, runtime-token DI containers, celery `canvas.py:736`, Rust `Drop`) are recorded as out of scope.
  Evidence: `RECORDED_CORPUS_RESOLUTION.permanent_limitations` holds all four as typed rows with the site, the construct, why no resolver change reaches it, and the registry group it would be classified under; `recorded_corpus_resolution.test.ts` pins them.
- [x] #5 A corpus-level regression suite pins the achieved per-corpus counts with one recorded row and one named end-to-end case per corpus.
  Evidence: one recorded row per corpus in `recorded_corpus_resolution.ts`, pinned by `recorded_corpus_resolution.test.ts`; twelve end-to-end cases over the ten corpora in `project/project.corpus_evidence.integration.test.ts`, of which ten fail on the `a3d5beea` control tree.
- [x] #6 The follow-ons (language-aware self-reference keywords, interprocedural cross-function carriers, Python loop-clause scopes) exist as backlog tasks.
  Evidence: TASK-376.25 (language-aware self-reference keywords), TASK-376.26 (cross-function class carriers) and TASK-376.27 (Python loop and match block scopes).

<!-- AC:END -->

## Notes from wave 1

The baseline (`recorded_failure_taxonomy_baseline.ts`) holds nine corpora; microsoft/TypeScript is recorded under `not_measured` because `repository-root-excluding:baselines` discovers 19,783 files and the harness refuses the 35,122 MB heap that count implies on a 32,768 MB box. Re-running it needs a narrower predicate or a larger box. `run_load_benchmark.ts --baseline` runs one arm and prints the taxonomy; `--interleave` prints control and candidate side by side.

## Implementation notes

### What the capability surface gained

Over the ten evidence corpora, a caller now reaches the function that actually runs in three shapes it could not before, and the epic's product — the list of functions nothing calls — shrank where it was wrong and grew where it was previously wrong in the other direction.

- **angular**: raw entry points **4,276 → 3,096** (−1,205, −28%). Resolved calls +11,850, call edges +17,039. Every interface reached through `import * as o` now answers its implementers, and `class_definition_not_found` clears entirely (1,726 → 0).
- **rust-lang/rust**: resolved calls **78,734 → 113,204** (+44%), call edges +51%. `no_enclosing_class_scope` collapses 27,173 → 2,567 (−91%) — a Rust `impl` block's `self` now names its type, and a submodule's `impl` blocks reach a crate-root type. The graph also grew by 9,951 nodes: methods declared in cross-file `impl` blocks are definitions the pipeline holds at all for the first time.
- **django**: raw entry points 2,494 → 2,289; `constructor_target_not_a_class` 15,021 → 63; `method_not_on_type` −4,469.
- **pandas**: raw entry points 2,298 → 2,085; `constructor_target_not_a_class` 21,420 → 0.
- **celery**: raw entry points 800 → 730; `constructor_target_not_a_class` 3,406 → 0.

### The two figures that are not comparable term by term

Both are properties of the change, not of the run, and a reader comparing the recorded rows against the baseline needs them before anything else.

- **Call references.** The Python heuristic constructor capture (deleted by TASK-376.2) recorded every argument-bearing call a second time. pandas falls by 93,143 call references and django by 53,468 for that reason alone, and `resolved` falls with them because half of each doubled pair had resolved. Nothing was lost: the second record was never a distinct call.
- **Raw entry points on Rust.** TASK-376.8 attaches a type's cross-file `impl` methods to the type, which makes those methods definitions the graph holds. A method nothing in the corpus calls is a raw entry point, so tokio gains 994 nodes and 782 entry points, sqlx 848 nodes and 600 entry points, rustc 9,951 nodes and 5,830 entry points — while each resolves strictly more of the calls it already held. Restricted to the nodes both trees hold, the new entry points are **two** on tokio, **one** on sqlx and **fifty-six** on rustc.

### Per-corpus rows

Control `a3d5beea` (the tree `recorded_failure_taxonomy_baseline.ts` was measured on, with `dist` rebuilt), candidate `038b7daa` (this tree). Each pair ran control-then-candidate back to back on one box; the rows are in `recorded_corpus_resolution.ts`.

| Corpus | Files | Call refs | Resolved | Nodes | Call edges | Raw entry points |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| angular/angular | 6345 | 376867 → 378862 | 148316 → **160166** | 70838 → 71428 | 141018 → **158057** | 4276 → **3096** |
| rust-lang/rust | 3516 | 329884 → 325188 | 78734 → **113204** | 55028 → 64979 | 63810 → **96180** | 16988 → 19732 |
| tokio-rs/tokio | 790 | 35573 → 34860 | 8114 → **8813** | 7847 → 8841 | 7067 → **7762** | 1797 → 2363 |
| launchbadge/sqlx | 459 | 18778 → 18564 | 3523 → **4033** | 3453 → 4301 | 2914 → **3597** | 1087 → 1524 |
| django/django | 3012 | 256358 → 202972 | 101669 → 85878 | 35611 → 36234 | 68673 → 67102 | 2494 → **2289** |
| pandas-dev/pandas | 1510 | 337503 → 244360 | 139826 → 117951 | 33288 → 33288 | 76324 → **84238** | 2298 → **2085** |
| celery/celery | 418 | 49805 → 35088 | 13140 → 11254 | 7943 → 7943 | 9276 → **9465** | 800 → **730** |
| expressjs/express | 141 | 14543 → 14543 | 5429 → **5436** | 3094 → 3132 | 5239 → **5250** | 21 → 21 |
| mochajs/mocha | 534 | 19965 → 19965 | 7431 → **7485** | 5446 → 5565 | 6884 → **6936** | 75 → **71** |

microsoft/TypeScript is refused again in the harness's own words: 19,783 files need a 35,122 MB heap on a 32,768 MB box. The refusal is byte-identical to the baseline's, so the corpus is absent for the same reason and not a new one.

### Per-reason movement

Only the reasons that moved. A reason rising is not automatically a regression: the ladder answers in order, so a receiver that stops failing at `receiver_type_unknown` fails later instead, at `method_not_on_type`, `member_type_unknown` or `class_definition_not_found`.

| Corpus | `name_not_in_scope` | `receiver_type_unknown` | `method_not_on_type` | `no_enclosing_class_scope` | `constructor_target_not_a_class` | `class_definition_not_found` | `no_parent_class` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| angular | −185 | **−10200** | −622 | +1140 | −5 | **−1726** | −17 |
| rustc | **−13110** | **−15162** | +9626 | **−24606** | −513 | +4715 | −649 |
| tokio | −295 | −153 | +176 | **−1458** | 0 | +868 | −214 |
| sqlx | −559 | +22 | +98 | −353 | −34 | +90 | −26 |
| django | **−19312** | +1779 | **−4469** | −33 | **−14958** | −297 | −381 |
| pandas | **−45305** | −1352 | −2786 | 0 | **−21420** | −20 | −390 |
| celery | **−9040** | +398 | −855 | 0 | **−3406** | −32 | −28 |
| express | −16 | +154 | −143 | −2 | 0 | 0 | 0 |
| mocha | −54 | +174 | −162 | −13 | 0 | −39 | +3 |

`polymorphic_no_implementations` moves +370 on angular (structural conformance hands the interface branch receivers it never had) and −242 on rustc; `collection_dispatch_miss`, `member_type_unknown`, `definition_has_no_body_scope`, `import_unresolved`, `reexport_chain_unresolved` and `dynamic_dispatch` move by less than 1,500 everywhere and by nothing on most corpora.

Against **TASK-376.17's row** (post-annotation) and **TASK-376.13's row** (post-rung-5): both were measured on angular, django, rustc and pandas alone and against a *different* control (the tree before TASK-376.6, and the TASK-376.11 merge). Their candidate rows are intermediate points on the same line these rows end: TASK-376.17 recorded angular at 147,963 call edges and 3,770 raw entry points, TASK-376.13 at 157,621 and 3,172; this tree reaches 158,057 and 3,096. On rustc, TASK-376.17 recorded 76,382 edges and 14,831 entry points and TASK-376.13 94,840 and 19,980; this tree reaches 96,180 and 19,732. Neither row is comparable to these column by column — they count a different call universe, before the Python capture deletion and before the Rust impl attach changed the node set — so they are quoted as waypoints and no delta is taken across them.

### Set difference, named

The literal difference over the complete member lists, per corpus. **Neither containment the criterion states holds**, and both directions are decomposed rather than netted.

| Corpus | Edge pairs only in control | …re-attributed to another caller | …callee reached by nothing | Edge pairs only in candidate | Entry points only in control | Entry points only in candidate | …on nodes both trees hold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| angular | 1124 | 896 | 228 | 18163 | 1205 | 25 | 25 |
| rustc | 6331 | 5631 | 700 | 38701 | 3086 | 5830 | **56** |
| tokio | 180 | 160 | 20 | 875 | 216 | 782 | **2** |
| sqlx | 313 | 272 | 41 | 996 | 163 | 600 | **1** |
| django | 7821 | 3902 | 3919 | 6250 | 248 | 43 | 43 |
| pandas | 898 | 664 | 234 | 8812 | 231 | 18 | 18 |
| celery | 613 | 61 | 552 | 802 | 80 | 10 | 10 |
| express | 16 | 16 | 0 | 27 | 0 | 0 | 0 |
| mocha | 71 | 57 | 14 | 123 | 6 | 2 | 2 |

**Every edge only the control holds falls into one of four mechanisms, and none of them is a call that lost its target.**

1. **The caller moved, the callee did not** (896 of angular's 1,124; all 16 of express's). The call is now enclosed by a real function node where it was attributed to the synthetic `module:<path>` owner. `module:lib/response.js->variable:lib/response.js:16:5:16:15:createError` becomes `function:lib/response.js:571:14:596:1:<anonymous>->…:createError`.
2. **A Python construction names the constructor that runs, not the class** (1,168 of django's lost callees are `class:` symbols; celery's `t/unit/app/test_loaders.py:39` `DummyLoader(app=self.app)` is the shape). `DummyLoader` declares no `__init__`, so the edge is now to the `__init__` it inherits.
3. **A `super().m()` call dispatches up the method resolution order instead of fanning down** (TASK-376.20). 2,555 of django's lost callees are `method:` symbols of this shape and 245 of the lost pairs are literal self-edges — a method recorded as calling itself. celery's `backends/cache.py:147:__reduce__ -> backends/filesystem.py:56:__reduce__` and `->` itself are both gone.
4. **A Rust `.name(...)` call at a call position names the method, not the same-named field** (478 of rustc's 700, and most of tokio's and sqlx's). `tokio/src/fs/dir_builder.rs:94` `builder.recursive(self.recursive)` resolved to the `recursive` **field** on the control and to the `recursive` **method** on this tree.

**Entry points only in the candidate** — the real false negatives — are 25 (angular), 56 (rustc), 43 (django), 18 (pandas), 10 (celery), 2 (tokio), 2 (mocha), 1 (sqlx), 0 (express). They split three ways:

- **Correctly unresolved, owned by the entry-point classifier.** 17 of django's 43 are `as_sqlite` overrides. `django/db/models/sql/compiler.py:575` reaches them through `getattr(node, "as_" + self.connection.vendor)`; the control reached them only through the `super().as_sql()` fan-out that TASK-376.20 removed. They are the registry's `string-keyed-dispatch` rule, not a resolution defect. pandas's 18 (`__hash__`, `_pad_or_backfill`, `_get_common_dtype`) and celery's 10 (`examples/stamping/visitors.py`'s `StampingVisitor` overrides, `schedules.py:178` `__eq__`) are the same shape.
- **A self type that a closure scope does not inherit.** `tokio/src/sync/oneshot.rs:820` `poll_closed` is reached only from `poll_fn(|cx| self.poll_closed(cx))` at `:734` and `:741`, inside `Sender::closed`. `self` inside the closure no longer names `Sender`. Owner: `scope_construction`.
- **A `Self::…` path that does not reach a submodule `impl`.** `tokio/src/runtime/task/mod.rs:681` `Self::from(Location::caller())` inside a file-scope `impl SpawnLocation` no longer reaches the `from` at `:665`, declared by `impl From<…> for SpawnLocation` inside `mod spawn_location`. This is TASK-376.8's fault area in the opposite direction from the one it fixed.

**Three removed entry points spot-verified at their call sites** (all django):

- `django/contrib/postgres/search.py:87:__init__` — reached from `tests/postgres_tests/test_search.py:175`, which constructs the class. Correct.
- `django/middleware/csp.py:14:process_response` — reached from `django/middleware/__init__.py:35`, `MiddlewareMixin.__call__`, which calls `self.process_response(...)` on a subclass receiver. Correct.
- `django/core/serializers/json.py:38:end_serialization` — reached from `django/core/serializers/base.py:84`, `Serializer.serialize`, the base template method. Correct.

### The carried django manager case

TASK-376.13 carried forward that `Manager = BaseManager.from_queryset(QuerySet)` copies methods onto a generated class at run time, so 65 `objects.create(...)` calls fanned to the one test manager subclass declaring `create`, and that method stopped being an entry point. On this tree `create` is among django's **removed** entry points and does not reappear among the added ones, so the fan-out still reaches it. The runtime-provided member remains invisible to the closure — `create` is django's second most frequent unresolved callee at 5,266 sites (4.5% of the residue) — and it is **TASK-376.26**'s shape: the class the manager provides is carried across a function boundary. It is not a permanent limitation and it is not classified; it stays open there.

### Residue, re-attributed

Not from the original leaf split — from the reasons the resolver actually recorded on this tree. Each row is a corpus's remaining reasons in count order, with one site read from `~/.ariadne/benchmark-runs/task-376.18/residue/<corpus>.txt` and the fault area `REASON_TO_AREA` (`packages/types/src/ariadne_fault_area.ts`) routes it to.

| Corpus | Reason | Count | A site | Owner |
| --- | --- | ---: | --- | --- |
| angular | `name_not_in_scope` | 147979 | `Error` @ `.github/actions/deploy-docs-site/main.js:14` | `name_resolution` |
| | `receiver_type_unknown` | 51249 | `.apply` @ `.github/actions/deploy-docs-site/main.js:13` | `receiver_type_inference` |
| | `member_type_unknown` | 8883 | `.isEmpty` @ `.github/actions/deploy-docs-site/main.js:8034` | `receiver_type_inference` |
| | `method_not_on_type` | 5509 | `.splice` @ `.github/actions/deploy-docs-site/main.js:87` | `receiver_type_inference` |
| | `constructor_target_not_a_class` | 2049 | `TunnelingAgent` @ `.github/actions/deploy-docs-site/main.js:52` | `method_lookup` |
| | `polymorphic_no_implementations` | 1311 | `.readdir` @ `adev/shared-docs/utils/filesystem.utils.ts:47` | `polymorphic_dispatch` |
| | `no_enclosing_class_scope` | 1247 | `super` @ `.github/actions/deploy-docs-site/main.js:353` | `scope_construction` |
| rustc | `receiver_type_unknown` | 85841 | `.as_deref` @ `compiler/rustc/build.rs:8` | `receiver_type_inference` |
| | `name_not_in_scope` | 77899 | `Ok` @ `compiler/rustc/build.rs:8` | `name_resolution` |
| | `member_type_unknown` | 20279 | `.data_layout` @ `compiler/rustc_abi/src/layout.rs:217` | `receiver_type_inference` |
| | `method_not_on_type` | 19320 | `.unwrap` @ `compiler/rustc/build.rs:32` | `receiver_type_inference` |
| | `class_definition_not_found` | 4953 | (Rust `Self` naming a type outside the file set) | `scope_construction` |
| | `no_enclosing_class_scope` | 2567 | (a `self` receiver with no enclosing `impl`) | `scope_construction` |
| django | `method_not_on_type` | 62496 | `.dirname` @ `django/apps/config.py:80` | `receiver_type_inference` |
| | `name_not_in_scope` | 30477 | `hasattr` @ `django/apps/config.py:33` | `name_resolution` |
| | `receiver_type_unknown` | 20899 | `.initConfig` @ `Gruntfile.js:6` | `receiver_type_inference` |
| | `member_type_unknown` | 2161 | `.isidentifier` @ `django/apps/config.py:35` | `receiver_type_inference` |
| pandas | `name_not_in_scope` | 61121 | `range` @ `asv_bench/benchmarks/algorithms.py:25` | `name_resolution` |
| | `method_not_on_type` | 38861 | `.arange` @ `asv_bench/benchmarks/algorithms.py:17` | `receiver_type_inference` |
| | `receiver_type_unknown` | 24809 | `.repeat` @ `asv_bench/benchmarks/algorithms.py:60` | `receiver_type_inference` |
| celery | `name_not_in_scope` | 11049 | `namedtuple` @ `celery/__init__.py:45` | `name_resolution` |
| | `receiver_type_unknown` | 7062 | (a `Mock()` receiver) | `receiver_type_inference` |
| | `method_not_on_type` | 4484 | `.s` / `.si` on a task signature | `receiver_type_inference` |
| tokio | `name_not_in_scope` | 13963 | `from_millis` @ `benches/copy.rs:23` | `name_resolution` |
| | `receiver_type_unknown` | 8251 | (a `std` receiver) | `receiver_type_inference` |
| | `member_type_unknown` | 1886 | | `receiver_type_inference` |
| sqlx | `name_not_in_scope` | 8320 | `.unwrap` @ `benches/sqlite/describe.rs:11` | `name_resolution` |
| | `receiver_type_unknown` | 4592 | `.describe` @ `benches/sqlite/describe.rs:11` | `receiver_type_inference` |
| express | `name_not_in_scope` | 5442 | `require` @ `examples/auth/index.js:7` | `name_resolution` |
| | `receiver_type_unknown` | 2979 | `.use` @ `examples/auth/index.js:21` | `receiver_type_inference` |
| mocha | `name_not_in_scope` | 8739 | `require` @ `.wallaby.cjs:41` | `name_resolution` |
| | `receiver_type_unknown` | 2045 | `.timeout` @ `.wallaby.cjs:39` | `receiver_type_inference` |

**The dominant share of the residue is a callee the corpus does not contain**, which no fault area owns because no change to annotation, self type, value, member set or subtype closure can reach a definition that is not in the indexed file set. The per-reason callee histograms say so directly:

- **angular** `name_not_in_scope` (147,979) — `expect` 27.1%, `it` 13.1%, `toEqual` 9.8%, `toBe` 9.7%, `toContain` 3.1%, `describe` 2.9%: **65.7%** is Jasmine. Its three next reasons all name sites inside one vendored 30,000-line bundle, `.github/actions/deploy-docs-site/main.js`, which the `repository-root` predicate does not exclude.
- **rustc** `name_not_in_scope` (77,899) — `Some` 14.1%, `Ok` 6.3%, `Err` 3.5%, `default` 2.5%, `Vec` 1.3%: **27.7%** is the Rust prelude. Its largest reason, `receiver_type_unknown` (85,841), is led by `push`, `iter`, `len`, `map`, `unwrap`, `is_empty` and `clone` — `std` collection methods on `std` receivers.
- **django** `method_not_on_type` (62,496) — `assertEqual` 30.1%, `assertIs` 2.9%, `assertIn` 2.6%, `assertSequenceEqual` 2.4%: **38%** is `unittest`, where the receiver IS typed (the test case) and the member is in the stdlib. `create` 7.7%, `get` 4.6%, `filter` 3.5% are the runtime-provided manager members — **15.8%**, and TASK-376.26's shape. `name_not_in_scope` (30,477) is 28% Python builtins (`len`, `str`, `isinstance`, `list`, `getattr`, `hasattr`).
- **pandas** `method_not_on_type` (38,861) — `parametrize` 17.4%, `raises` 15.7%, `importorskip` 1.7% is pytest; `array` 13.3%, `default_rng` 5.6%, `arange` 5.2%, `asarray` 1.5% is numpy: **60%** between them. `name_not_in_scope` (61,121) is 38% builtins and stdlib.
- **celery** `name_not_in_scope` (11,049) — `Mock` 15.3%, `isinstance` 5.8%, `patch` 5.5%, `len` 3.7%, `range` 3.2%: **34%** is `unittest.mock` and Python builtins.
- **tokio** `name_not_in_scope` (13,963) — `unwrap` 10.2%, `Ok` 6.6%, `drop` 4.3%, `Some` 3.8%, `Ready` 3.4%: **28%** is `std`.
- **sqlx** `name_not_in_scope` (8,320) — `Ok` 17.1%, `Some` 5.4%, `Err` 3.7%: **26%** is the prelude.
- **express** `name_not_in_scope` (5,442) — `expect` 23.5%, `it` 20.8%, `describe` 10.2%, `require` 7.4%: **62%** is the test DSL and the CommonJS host global.
- **mocha** `name_not_in_scope` (8,739) — `it` 19.9%, `expect` 19.3%, `describe` 14.5%, `require` 6.0%: **60%**.

Two consequences for whoever sets the next success criterion. Reducing a residue count is not the same as improving the answer: the largest single lever on these numbers is the **corpus predicate**, not the resolver. And the reasons that *are* the resolver's — `polymorphic_no_implementations` (1,311 on angular), `no_enclosing_class_scope` (2,567 on rustc), `class_definition_not_found` (4,953 on rustc) — are now three orders of magnitude smaller than the totals they sit inside.

### Permanent limitations

Recorded as typed rows on `RECORDED_CORPUS_RESOLUTION.permanent_limitations` and pinned by `recorded_corpus_resolution.test.ts`. Each names a construct whose callee is not in the source at all, so no resolver change reaches it and no success criterion may target it.

| Corpus | Site | Construct | Registry group it would be filed under |
| --- | --- | --- | --- |
| webpack | `lib/util/hash/wasm-hash.js:141` | `exports.update(l)` on a `WebAssembly.Instance` exports object | `wasm-export-invocation` (new) |
| nestjs | `packages/core/injector/module.ts:111` | `Map<InjectionToken, InstanceWrapper>` keyed by a computed runtime token | `dynamic-property-keyed-callback` (exists, `permanent`) |
| celery | `celery/canvas.py:736` | `.on_error(...)` off an unannotated Python factory | `untyped-attribute-receiver` (exists, `permanent`) |
| tokio | `tokio/src/net/tcp/split_owned.rs:452` | `impl Drop for OwnedWriteHalf` — the compiler-injected destructor | `rust-compiler-injected-drop` (new) |

Two of the four already have a `permanent` rule in `.claude/skills/triage/known_issues/registry.json` and need no new classifier. The other two are classifier candidates: a WASM export invocation has a syntactic tell (`instance.exports`), and a Rust `impl Drop for T` block declares a `drop` with no call site anywhere by construction. Neither is written here — `registry.json` is applied by a human through `reconcile-registry --stage`, and this step files no registry change.

### The regression suite

Two tiers, because a count cannot say which shape moved and a shape cannot say how much of a corpus it covers.

- **`benchmark_corpus_load/recorded_corpus_resolution.ts`** — one row per corpus with the file set, the fingerprint and the taxonomy, plus the refused corpus and the permanent limitations. `recorded_corpus_resolution.test.ts` pins the call-edge and raw-entry-point counts by name, checks each taxonomy closes over its own call references and agrees with its fingerprint, and checks each row measures exactly the file set the baseline measured. `scripts/recorded_measurement_report.ts` now prints the baseline and this record side by side with a delta column under every arm, so a later run sees both records and cannot read the epic's change as a change of the run.
- **`project/project.corpus_evidence.integration.test.ts`** — twelve `Project`-tier cases over the ten corpora, each named for its corpus and the file the shape was read from, over the committed fixture directories where the shape needs more than one file. **Ten of the twelve fail on the `a3d5beea` control tree.** The two that pass there — the tokio/sqlx `self.header().encoded_size()` hop and the celery constructor-only class — already answered on the baseline and are pinned as guards rather than claimed as recoveries.

### Follow-ons filed

- **TASK-376.25** — `SELF_REFERENCE_KEYWORDS` (`call_resolution/receiver_resolution.ts:123`) is one word list for four languages, consulted ahead of every binding. Rust `this` and JavaScript `self` are ordinary identifiers; key the set by language and prefer an in-scope binding.
- **TASK-376.26** — a class carried into its construction site through a parameter or a callee's return is invisible to the value channel, which is entirely intraprocedural. Django's `form_class = self.get_form_class(); form_class(**defaults)` and the django manager case above are the shapes.
- **TASK-376.27** — `queries/python.scm` opens a block scope for `for_statement`, `while_statement`, `match_statement` and `case_clause`, none of which confines anything Python confines. TASK-376.12 justified the branch clauses and left these four unmeasured.

### What this step did not change

No production code beyond the record, the report that prints it, and `scripts/sample_failure_sites.ts` — a one-command reader that loads a corpus through the same loader an arm uses and prints, per failure reason, the count, three named sites and the top callee names. It exists because re-attributing a residue from counts alone is guesswork, and the next step to state a success criterion over these corpora needs the same instrument.
