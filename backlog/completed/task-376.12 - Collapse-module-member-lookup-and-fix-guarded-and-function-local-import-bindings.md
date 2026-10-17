---
id: TASK-376.12
title: >-
  Collapse module-member lookup and fix guarded and function-local import
  bindings
status: Done
assignee: []
created_date: '2026-07-29 09:38'
updated_date: '2026-09-17 20:29'
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
§7 step 13. Wave 1; no dependencies — the star / `pub use` / wildcard export edge this step consumes landed with TASK-375 (`ExportRegistry.wildcard_reexports`, `registries/export.ts:178-184`, and `resolve_all_exports`). Shares `queries/python.scm` with TASK-376.2 and `python_scope_boundary_extractor.ts` with TASK-376.3, in different regions.

## Root cause

`resolve_namespace_export` (`resolve_references/module_member_lookup.ts:14-28`) and `resolve_named_import` (`:40-58`) are two lookups for one question, the latter strictly weaker: it skips re-exports at `:47-50` and gates on `is_exported`. `method_lookup.ts` reaches them from two import-shaped branches — namespace import (`:30-57`) and named/default import (`:79-132`) — and again from the latter's submodule hop; the namespace-definition branch (`:61-75`, TASK-375.2) reads a `namespace` body scope and consults neither. Separately, `queries/python.scm:73-83` emits `@scope.block` for `if_statement`, `elif_clause`, `else_clause`, `try_statement`, `except_clause`, `finally_clause`, `with_statement`, `for_statement`, `while_statement`, `match_statement` and `case_clause`, and a guarded module-level `if STATIC: from pkg.base import Celery` therefore binds `Celery` into `block:…` and fails `name_not_in_scope` while the unguarded form resolves — reproduced independently by three investigations. Python has no block scoping for the *binding*, but the block scope is load-bearing for everything else it holds: two branches' same-named locals, a guarded `def`'s body, and the `except … as e` alias Python deletes at the end of the clause.

## Work plan

1. Collapse `resolve_namespace_export` and `resolve_named_import` into one `resolve_module_member(source_file, name, import_kind, exports, definitions, languages, modules) -> SymbolId | null` in `module_member_lookup.ts`, with a module-scope-definition fallback, and call it from both import-shaped branches of `method_lookup.ts` and its submodule hop, and from `receiver_resolution.ts`'s namespace hop (`:320-434`), which imports the same helpers.
2. Layer a guard clause's **import** bindings into the enclosing module or function scope in `name_resolution.ts`, beside the function hoist that already does this for JavaScript/Rust function declarations, so guarded and function-local import bindings resolve where their unguarded form would. The guard clause keeps its `@scope.block`: it is the only thing holding two branches' same-named locals apart, confining a guarded `def`'s body, and confining the `except … as e` alias. Check the interaction with `DefinitionRegistry.capture_member_aliases` (`registries/definition.ts:401-424`, delegating to `bind_member_alias` at `:60-73`), which depends on class-body conditional lifting.
3. Re-measure the module-receiver rows (`pt-4f14b0f5b4f8ee68`) with TASK-376.16's taxonomy harness now that the wildcard edge exists; the Rust associated-function call sites (`TestRequest::patch()` and `TestRequest::delete()`, `pt-7aac804b8f296196`) are resolved by TASK-375.5-6's single `::` path resolver and are confirmed closed here rather than carried.
4. Add integration tests (fixtures under `tests/fixtures/{python,javascript,rust}/code/integration/`) covering every evidence case for this step: a two-hop re-export chain where `resolve_named_import` previously failed and `resolve_namespace_export` succeeded, resolving identically through `resolve_module_member`; a non-exported module-scope definition resolving through the fallback; Python `if STATIC: from pkg.base import Celery` followed by `Celery(...)` resolving (and the unguarded form staying green); a `try:`/`except ImportError:` guarded import; a function-local import; and express's cross-file `var proto = require('./application'); mixin(app, proto, false)` leaving `engine` reachable across the module boundary via `mark_collection_as_consumed` (`indirect_reachability.ts:159-220`). The celery `orig = BaseTask.__call__` case is TASK-376.11's.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One `resolve_module_member` replaces `resolve_namespace_export` and `resolve_named_import`, with a module-scope-definition fallback, called from every `method_lookup.ts` import-shaped branch and the `receiver_resolution.ts` namespace hop.
  Evidence: `module_member_lookup.ts` exports only `resolve_module_member(source_file, name, import_kind, exports, definitions, languages, modules)`: the export chain first, then a module-scope definition — an exported one in a language with export markers, any one in Python. `method_lookup.ts` calls it from the namespace-import branch, the named/default-import branch and its submodule hop; the namespace-definition branch reads a `namespace` body scope and never consulted the export lookups. `receiver_resolution.ts`, `constructor.ts` and `registries/type.ts` STEP 1b call it too, because the two functions are deleted and every caller moves. `method_lookup.test.ts` › "Named import method lookup" stays green through the definition tier.
- [x] #2 Python guarded (`if` / `elif` / `else` / `try` / `except` / `finally` / `with`) and function-local imports bind in the enclosing scope and resolve, without collapsing what the guard's scope legitimately holds; `capture_member_aliases`'s class-body conditional lifting still works.
  Evidence: `name_resolution.ts`'s `collect_hoisted_imports` layers a descendant block scope's imports into the enclosing module or function scope, where they shadow whatever the scope chain inherits — as the unguarded form would — and lose only to an import that scope writes itself and to its local definitions; `collect_hoisted_functions` beside it does the same for JavaScript/Rust function declarations. `queries/python.scm` is unchanged, so every guard clause keeps its block scope. `resolve_references.python.test.ts` › "Python guarded and function-local imports" pins, over `tests/fixtures/python/code/integration/{guarded_base,guarded_imports}.py`, that the guards still open seven block scopes and that `Celery()` under `if`/`elif`/`else`, `make_app()` under `try` and its `except`, `shutdown()` under `finally`, `_bootstrap()` under `with` and `LocalCelery()` inside `build` all resolve into `guarded_base.py`; on the base sources the same test fails. Seven sibling cases pin the precedence around it: two branches importing one name from different modules keep each call on its own import and leave neither module's `dumps` an entry point; a function-local guarded import shadows a same-named module-level import; a guarded import shadows a wildcard import of the same name; a scope's own import stays ahead of a hoisted one; a nested branch's import does not answer a call in a sibling branch; two guarded star imports whose module paths end in the same segment each keep their whole surface; and an `except … as e` alias does not clobber a same-named typed local. `capture_member_aliases` is untouched and its test ("keeps both indices consistent through a class-body member alias") stays green: the conditional lift is an AST-shape capture in the indexer, not scope reasoning.
- [x] #3 Express's cross-file `require` + `mixin` leaves the mixed-in members reachable.
  Evidence: `resolve_references.javascript.test.ts` › "Cross-file require and mixin" over `tests/fixtures/javascript/code/integration/{mixin_application,mixin_express}.js`: `engine` carries `collection_read` reachability and neither `engine` nor `set` is an entry point. This holds on the base tree as well; the case pins the boundary crossing rather than repairing it.
- [x] #4 Integration tests cover all of this step's evidence cases: the two-hop re-export chain, the module-scope fallback, guarded and function-local Python imports, and the express two-file mixin.
  Evidence: `project.typescript.integration.test.ts` › "Module members through a two-hop re-export chain" over `tests/fixtures/typescript/code/integration/reexport_{engine,barrel,consumer}.ts` pins a named import, a namespace member and an imported value all resolving through the barrel to the engine file (a pin: `name_resolution.ts` binds each named import to its terminal definition through the export chain before method lookup runs, so the base tree already resolves these shapes). The fallback's regression test is `resolve_references.python.test.ts` › "resolves an underscore-private member accessed through a namespace import to the module-scope definition", which fails on the base sources; `gb._bootstrap()` in the guarded-imports fixture is the same path. The Python and express cases are #2 and #3.
- [x] #5 The module-receiver rows and the Rust `TestRequest` associated-function rows are re-measured with the taxonomy harness and their recovery recorded.
  Evidence: this step's contribution is isolated by two trees that differ by the step alone — control `f0f3d7f9` (wave 1 merged through TASK-376.4) and candidate `fc26d312` (the TASK-376.12 merge) — measured over each evidence corpus at the commit its triage run indexed, under the triage config's file set. microsoft/TypeScript is measured as `folder:src` (601 files), a narrower file set than its triage config's `repository-root-excluding:baselines`, which the harness refuses on this box; every TypeScript row's caller and target lie under `src/`. Each corpus is one `--interleave` session, four serial arms, loadavg 3.6–24 at start:

      node --import tsx packages/core/scripts/run_load_benchmark.ts --interleave \
        --corpus-root ~/.ariadne/triage-entrypoints/repos/<owner>--<repo> \
        --corpus-name <corpus> --corpus-commit <corpus_commit> --predicate <predicate> \
        --control-repo <checkout of f0f3d7f9> --candidate-repo <checkout of fc26d312>

  Both arms of each tree agree, and the interleave exits 1 on the corpora where the fingerprint moves. Per corpus, control → candidate:

  | corpus (commit, predicate) | files | call refs | resolved | reason deltas | raw entry points | call edges |
  | --- | ---: | ---: | ---: | --- | ---: | --- |
  | django (`957d0cee`, `repository-root-excluding:js_tests,scripts,docs`) | 3,012 | 202,697 → 202,710 | 81,418 → 82,182 (+764) | `name_not_in_scope` 31,247 → 30,597; `receiver_type_unknown` 20,298 → 20,133; `method_not_on_type` 65,911 → 65,975 | 2,473 → 2,422 (−51, +0) | +654, −8 |
  | pandas (`7986b425`, `repository-root`) | 1,510 | 240,440 → 240,516 | 110,600 → 111,065 (+465) | `name_not_in_scope` 62,238 → 61,550; `receiver_type_unknown` 25,940 → 25,675; `method_not_on_type` 39,566 → 40,297; `member_type_unknown` 1,544 → 1,377 | 2,293 → 2,280 (−13, +0) | +573, −4 |
  | sqlalchemy (`aa1a5575`, `repository-root-excluding:examples,tools`) | 583 | 188,488 → 188,523 | 31,463 → 31,892 (+429) | `name_not_in_scope` 107,250 → 107,110; `receiver_type_unknown` 31,806 → 31,631; `method_not_on_type` 15,658 → 15,656; `polymorphic_no_implementations` 37 → 58; `member_type_unknown` 1,662 → 1,564 | 4,835 → 4,684 (−151, +0) | +478, −0 |
  | celery (`7c5d9a62`, `repository-root`) | 418 | 35,077 → 35,077 | 10,834 → 10,911 (+77) | `name_not_in_scope` 11,121 → 11,055; `receiver_type_unknown` 7,146 → 7,096; `method_not_on_type` 4,801 → 4,815; `member_type_unknown` 948 → 973 | 797 → 790 (−7, +0) | +84, −0 |
  | microsoft/TypeScript (`cc5c6e2d`, `folder:src`) | 601 | 107,550 → 107,550 | 78,128 → 78,128 | none | 1,198 → 1,198 | identical |
  | actix/actix-web (`6e09fdf3`, `repository-root`) | 313 | 27,547 → 27,547 | 7,786 → 7,786 | none | 1,109 → 1,109 | identical |

  No corpus gains an entry point. The twelve call edges only control holds are named: pandas's four are one callee reached from a second site (`merge#1` → `merge#2` in `test_join.py:745` and `test_multi.py:414`, `pivot_table#1` → `#2` in `test_pivot.py:1046`, `_reindex_with_indexers#1` → `#2` in `generic.py:10069`); django's eight are calls control linked to a local node the call does not run — `validator(...)` to the `validator` variable in `test_hstore.py` and `test_ranges.py`, `SomeFunc(...)` to the class in `test_aggregates.py:673` — which the candidate links to `KeysValidator.__init__`/`__call__`, the `BaseValidator.__init__`/`__call__` that `RangeMaxValueValidator` inherits, and the `StatAggregate.__init__` that `SomeFunc` inherits. A guarded import that binds moves its call from `name_not_in_scope` to member lookup, which is why django's, pandas's and celery's `method_not_on_type` rise while the call's first stage clears. The call references a corpus gains are attribute reads, not call sites: on sqlalchemy, all 35 are resolved `method` references at `@property` reads (`connection.connection`, `orm_context.is_select`) whose receiver now has a type, recorded through the getter probe; another 165 sites keep their location and change `call_type` from `method` to `function`, the `mod._private()` calls the module-member lookup now resolves.

  Per row, a probe over the same load reads each evidence caller site's `CallReference`s and the target's entry-point status, on control, candidate and the epic's starting tree `279221d4`:

  | row | caller → target | `279221d4` | control | candidate |
  | --- | --- | --- | --- | --- |
  | sqlalchemy #12–16 | `crud._get_crud_params`, `collections._prepare_instrumentation`, `loading._load_scalar_attributes`, `orm_util._validator_events`, `clsregistry._add_class` (`from . import mod`) | `method_not_on_type`, entry point | `method_not_on_type`, entry point | resolved, not an entry point |
  | django #27 | `signing._unsign_cookie` at `http/request.py:253` | `method_not_on_type`, entry point | `method_not_on_type`, entry point | resolved, not an entry point |
  | django #29 | `SearchRank(...)` at `tests/postgres_tests/test_search.py:504` → `SearchRank.__init__` (`contrib/postgres/search.py:289`) | `name_not_in_scope`, entry point | `name_not_in_scope`, entry point | resolved, not an entry point |
  | pandas #18 | `statawriter(...)` at `core/frame.py:2635` → `StataWriterUTF8.__init__` (`io/stata.py:3864`) | `name_not_in_scope` | `name_not_in_scope` | resolved to `StataWriter.__init__` only |
  | sqlalchemy #17 | `mysql.FLOAT()` at `test/dialect/mysql/test_types.py:469` → `mysql/types.py:284 __init__` | `name_not_in_scope`, entry point | `name_not_in_scope`, entry point | `name_not_in_scope`, entry point |
  | TypeScript #0–11 | `ts.*`, `vfs.*`, `moduleSpecifiers.*`, `FourSlash.*` through `export *` barrels | resolved | resolved | resolved |
  | pandas #19–21, celery #22, django #23–26, #28 | `SAS7BDATReader`, `XportReader`, `missing.dispatch_fill_zeros`, `worker_state.reset_state`, `forms.RegexField`, `debug.technical_404_response`, `GenericIPAddressField`, `HttpRequest`, `debug.technical_500_response` | resolved | resolved | resolved |
  | actix #0–1 | `TestRequest::patch()` and `TestRequest::delete()` at `actix-web/src/guard/mod.rs:542`/`:546` | resolved | resolved | resolved |

  This step recovers seven of the thirty-two rows, and each of the seven stops being a false entry point. Twenty-two resolve on the epic's starting tree, closed before this epic by TASK-375's wildcard export edge and `::` path resolver, the actix pair among them. Two rows remain, both still present at `fac09ef3`, and each is filed as its own task rather than carried as epic residue:
  - pandas #18 resolves to one of its three constructors. `to_stata` binds `statawriter` under `if version == 114` (`StataWriter`), `elif version == 117` (`StataWriter117`) and `else` (`StataWriterUTF8`), and calls it after the chain; `collect_hoisted_imports` keeps the first branch's binding for a name, so the call reaches `StataWriter.__init__` and not the other two. `StataWriterUTF8.__init__` is not an entry point on any of the three trees: other callers reach it. Filed as TASK-376.21.
  - sqlalchemy #17 fails before member lookup. sqlalchemy's package lives at `lib/sqlalchemy`, and `resolve_absolute_python` searches the importing file's ancestors and its topmost package's parent, never `lib/`, so every `from sqlalchemy import …` in `test/` is unbound — `mysql.FLOAT()`, `sqltypes.Float()`, `eq_()` and `Column()` in that file all fail `name_not_in_scope`. This is Python import-root resolution, outside this step's lookup and binding. Filed as TASK-376.22.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

A Python call reached only through an import written under `if`, `try`/`except` or `with` now resolves instead of failing `name_not_in_scope`, so its target stops being reported as an unreached entry point. Separately, a call through a module member resolves the same way whichever import form named it.

A guarded import binds where its unguarded form would because `name_resolution.ts` layers a descendant block scope's imports into the enclosing module or function scope, where it shadows whatever the chain inherits, exactly as the unguarded form would, and loses only to an import that scope writes itself and to its local definitions — the shape `collect_hoisted_functions` beside it already applies to JavaScript and Rust function declarations. The guard clause keeps its own scope: it is what holds two branches' same-named locals apart, what confines a guarded `def`'s body, and what confines the `except … as e` alias Python deletes at the end of the clause.

`resolve_module_member` is the one module-member lookup: the export chain through re-exports and wildcard edges, then the module's own top-level definition — exported, or any at all in Python, which has no export marker, so `ns._private()` is the real edge it is. Every former caller of the two lookups moves onto it. The definition tier takes the *last* matching module-scope definition, the rule `DefinitionRegistry.by_scope` and `ExportRegistry` both follow for a Python name bound twice, and it declines a definition the module offers only under a different export name or only as its default, which the module does not provide under the name asked for.

Start at `name_resolution.ts`'s `collect_hoisted_imports` for the binding, `module_member_lookup.ts` for the lookup's two tiers, `method_lookup.ts`'s import branches for its callers, and the three fixture sets under `tests/fixtures/{python,typescript,javascript}/code/integration/` for the evidence shapes at the Project tier.

The fallback's definition tier keeps a contract two unit tests pin: an exported top-level definition answers for every language even when the export registry holds no record of it, and a non-exported one answers only in Python. The line is drawn here and not at the project tier: `name_resolution.ts`'s explicit-named-import fallback deliberately binds a non-exported module-scope definition in *any* language, because naming a target explicitly is different from reading a member off a module object. A receiver typed through this lookup has no such explicit naming to rest on, so `method_lookup.test.ts` › "fails with reexport_chain_unresolved for a non-exported class in the source file" holds the narrower line.

`export_chain_lookup.ts` is `module_member_lookup.ts`: its sole export is `resolve_module_member`, and only one of its two tiers is an export chain, so the old name was true of half the file. The rename moves four import lines — `method_lookup.ts`, `receiver_resolution.ts`, `constructor.ts` and `registries/type.ts` — and TASK-376.6's work plan, which named the deleted `resolve_namespace_export`, now names `resolve_module_member` and its seven-argument shape.

`registries/type.ts` is touched at two lines (its import and its STEP 1b call), because `resolve_namespace_export` no longer exists; TASK-376.2 owns the file and edits other regions, so the merge is two disjoint hunks.

`queries/python.scm` is untouched, so `scopes.test.ts` and `index_single_file.python.test.ts` keep their scope pins as they stand and the merge with TASK-376.2 over that file is empty. `python_scope_boundary_extractor.ts` needs no change either: it dispatches on `ScopeType`, never on node type, so the shared-file overlap with TASK-376.3 is empty too. `resolve_references.python.test.ts` › "underscore-private explicit named imports" inverts its namespace case, because reaching `ns._make_block` is this step's stated behaviour.

Each construction in the guarded-imports fixture is recorded twice on this tree; TASK-376.2 removes the second record, so that literal moves at merge. The wave-1 merge is simpler than planned: `queries/python.scm` is untouched here, so the only file shared with TASK-376.2 is `registries/type.ts`, at one line.

### Open, for the epic

Two coverage gaps this step does not close, both about the same thing — where the module-member lookup is reached from:

- `method_lookup.ts`'s named/default-import branch never runs its export-chain tier under test. `method_lookup.test.ts` builds its registries by hand and never populates the `ExportRegistry` for the named import's source file, so every case there is answered by the definition tier. At the Project tier the branch is largely unreachable: `name_resolution.ts` binds a named import to its terminal definition before receiver resolution runs, which is why `project.typescript.integration.test.ts` › "Module members through a two-hop re-export chain" passes on the base sources. The barrel shape is pinned end to end; the branch's own tier is not.
- `receiver_resolution.ts`'s `dereference_named_import` still calls `exports.resolve_export_chain` directly, so a member reached mid-chain gets the export chain alone while the same member reached as a terminal receiver also gets the definition tier. Folding that hop onto `resolve_module_member` is the remaining half of "one lookup".

Final assertion on this worktree: `tsc --noEmit` clean, 194 test files and 4,440 tests green, `pnpm lint` clean.
<!-- SECTION:NOTES:END -->
