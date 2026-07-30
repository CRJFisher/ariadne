---
id: TASK-376.12
title: "Collapse module-member lookup and fix guarded and function-local import bindings"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 12000
plan_dedup_keys:
  - 83db146895ec3bac3f7c0daf311434fe645760606ba038c87f88a480745b9eee
plan_source_tasks:
  - pt-4f14b0f5b4f8ee68
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 13.

## Root cause

`resolve_namespace_export` (`call_resolution/export_chain_lookup.ts:14-28`) and `resolve_named_import` (`:40-58`) are two lookups for one question, the latter strictly weaker: it skips re-exports at `:47-50` and gates on `is_exported`. Separately, `queries/python.scm:69-78` emits `@scope.block` for `if_statement` / `try_statement` / `with_statement`, but Python has no block scoping, so a guarded module-level `if STATIC: from pkg.base import Celery` binds `Celery` into `block:…` and fails `name_not_in_scope` while the unguarded form resolves — reproduced independently by three investigations.

## Work plan

1. Collapse `resolve_namespace_export` and `resolve_named_import` into one `resolve_module_member(source_file, name) -> SymbolId | null` in `export_chain_lookup.ts`, with a module-scope-definition fallback, and call it from both import branches of `method_lookup.ts` (`:29-56`, `:60-113`).
2. Stop emitting `@scope.block` for `if_statement` / `try_statement` / `with_statement` in `queries/python.scm:69-78` and adjust `python_scope_boundary_extractor.ts` accordingly, so guarded and function-local import bindings land in the enclosing module/function scope. Check the interaction with `DefinitionRegistry.capture_member_aliases` (`registries/definition.ts:267-281`), which depends on class-body conditional lifting.
3. Consume the star / `pub use` / wildcard export edge published by the `module-surface-resolution` epic — the seam `resolve_module_member(source_file, name) -> SymbolId | null` is stable under both designs, so this step lands independently and the module-receiver rows close once that epic's edge exists.
4. Note the rows re-routed out of this epic: the Rust associated-function call sites (`TestRequest::new`) fail `name_not_in_scope` on the bare name and are closed by `module-surface-resolution`'s Rust path work, not by member lookup here.
5. Add integration tests (fixtures under `tests/fixtures/{python,javascript,rust}/code/integration/`) covering every evidence case for this step: a two-hop re-export chain where `resolve_named_import` previously failed and `resolve_namespace_export` succeeded, resolving identically through `resolve_module_member`; a non-exported module-scope definition resolving through the fallback; Python `if STATIC: from pkg.base import Celery` followed by `Celery(...)` resolving (and the unguarded form staying green); a `try:`/`except ImportError:` guarded import; a function-local import; celery `orig = BaseTask.__call__` + `orig(self, *args)` producing a real edge to `celery/app/task.py:495` instead of the self-edge `orig -> [orig]`; and express's cross-file `var proto = require('./application'); mixin(app, proto, false)` leaving `engine` reachable across the module boundary via `mark_collection_as_consumed` (`indirect_reachability.ts:95-156`).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 One `resolve_module_member` replaces `resolve_namespace_export` and `resolve_named_import`, with a module-scope-definition fallback, called from both `method_lookup.ts` import branches.
- [ ] #2 Python guarded (`if` / `try` / `with`) and function-local imports bind in the enclosing scope and resolve; `capture_member_aliases`'s class-body conditional lifting still works.
- [ ] #3 `orig = BaseTask.__call__` + `orig(self, *args)` resolves to the real target, not a self-edge.
- [ ] #4 Express's cross-file `require` + `mixin` leaves the mixed-in members reachable.
- [ ] #5 Integration tests cover all of this step's evidence cases: the two-hop re-export chain, the module-scope fallback, guarded and function-local Python imports, celery `orig = BaseTask.__call__`, and the express two-file mixin.
- [ ] #6 The dependency on `module-surface-resolution`'s star/wildcard export edge is recorded, and the module-receiver rows are re-measured once that edge lands.

<!-- AC:END -->
