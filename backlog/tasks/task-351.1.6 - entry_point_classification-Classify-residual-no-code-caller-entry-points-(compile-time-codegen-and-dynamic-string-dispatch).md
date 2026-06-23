---
id: TASK-351.1.6
title: "[entry_point_classification] Classify residual no-code-caller entry points (compile-time codegen and dynamic string dispatch)"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-351.1
priority: high
ordinal: 6000
plan_dedup_key: 8527534468fe12ac6ae5a5ae39eb67b85a339098ed82637a3d3176a25502edf8
plan_source_task: pt-dceb4774fbcd1fe3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

11 residual genuine entry points have no in-repo code caller: compile-time codegen (Askama/`quote!` macros emit calls at build time), dynamic string-to-callable dispatch (Django `get_callable(settings.CSRF_FAILURE_VIEW)`, celery `symbol_by_name('...:fixup')`, SQLAlchemy `__getattribute__` `_sa_`-prefix delegation), a DOM event-handler assignment, and a public library API whose only callers live in downstream crates. **Core fix:** these are heterogeneous; add discrete narrow classification predicates in `classify_entry_points` for the codegen-template and dynamic-string-dispatch fingerprints, and treat the downstream-only public-API case as a known-issue (no automated detection). Lowest-volume group; group its predicates behind the same registration as the other paths.

## Observations

- Observed count: **11**
- Projects: `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, `actix-web`, `celery`, `django`, `serde`, `sqlalchemy`
- Source runs: `942ac9c-2026-06-22T19-29-32.970Z`, `a945e09-2026-06-22T15-20-50.957Z`, `aa0efc9-2026-06-18T18-25-42.253Z`, `aef7f13-2026-06-22T10-38-14.644Z`, `dd682c2-2026-06-22T15-32-43.992Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-web/src/server.rs:587` — pub method on a library's public struct with no in-repo call sites; callers exist only in downstream user crates outside Ariadne's index scope (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/celery/app/base.py:413` — The fixup function is called via symbol_by_name with the string 'celery.fixups.django:fixup', a dynamic string-to-callable resolution pattern that Ariadne cannot statically trace. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/utils/test_term.py:31` — Parametrized test calls `colored().names[name]('foo')` with name='white', dynamically invoking the white method via the names dict. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/django/contrib/gis/geos/mutable_list.py:68` — Line 68 assigns \_set_single_rebuild to self.\_set_single conditionally in **init**; lines 110 and 298 call self.\_set_single(), which Ariadne cannot trace back to the method definition. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/django/middleware/csrf.py:52` — Production caller invokes `get_callable(settings.CSRF_FAILURE_VIEW)` to dynamically resolve the dotted-path string to the `csrf_failure` function at runtime. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_pattern_analysis/src/rustc.rs:1070` — Entry point candidate: analyze_match at line 1070 in rustc.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/src/bootstrap/src/utils/render_tests.rs:22` — Entry point candidate: add_flags_and_try_run_tests at line 22 in render_tests.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/src/librustdoc/html/templates/item_union.html:15` — Askama template calls self.print_ty(ty) on the ItemUnion struct, generating a Rust method call at compile time that is not present in any indexed .rs source file. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/serde-rs--serde/serde_derive/src/ser.rs:1296` — The `quote!` macro in the proc-macro crate generates Rust code that calls `constrain`, making it invisible to Ariadne's pre-expansion AST analysis. (project `serde`, run `dd682c2-2026-06-22T15-32-43.992Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/engine/default.py:2511` — The call `fallback(c)` at line 2511 invokes `get_update_default` indirectly via a destructured tuple element assigned from `self.get_update_default` at line 2486. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/sql/lambdas.py:1383` — `__getattribute__` strips the `_sa_` prefix from the key and delegates to the real method name, so `self._sa__add_getter(...)` at lines 1400 and 1417 resolves to `_add_getter` at runtime. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/classify_entry_points` so the entry_point_classification pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
