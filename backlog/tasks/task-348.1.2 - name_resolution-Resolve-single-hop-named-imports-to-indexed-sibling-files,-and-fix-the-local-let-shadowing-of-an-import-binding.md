---
id: TASK-348.1.2
title: "[name_resolution] Resolve single-hop named imports to indexed sibling files, and fix the local-let shadowing of an import binding"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-348.1
priority: high
ordinal: 2000
plan_dedup_key: 353297f2e4746b78d2f28b25eaf9000871464ddfc2cb520d15954a32559b8426
plan_source_task: pt-57521973c069ab2e
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

For `from .x import y`, `use crate::x::y`, and `import { y } from './x'` where both `./x` and `y` are indexed, `resolve_scope_recursive` resolves the import via `get_resolved_import_path` + `resolve_export_chain` (name_resolution.ts:151-172) yet the binding still does not reach the scope map for 43 members across Python/Rust/TS. One member (serde `has_flatten`, index 207) is an outright shadowing defect: the import binding is overwritten by the local `let has_flatten` being declared in the _same_ statement, because Step-2 local-definition layering (name_resolution.ts:191-196) clobbers the import before the reference is bound.

Repair the single-hop import binding so an indexed sibling's exported symbol lands in scope, and correct the Step-2 layering so a local definition does not shadow an import binding for references that precede the local declaration.

## Observations

- Observed count: **43**
- Projects: `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, `TypeScript`, `pandas`, `pytorch`, `sqlalchemy`, `sqlx`, `tokio`
- Source runs: `1d715bc-2026-06-22T15-11-13.691Z`, `3da582a-2026-06-22T15-54-41.005Z`, `66e2912-2026-06-22T15-23-50.566Z`, `7964e22-2026-06-18T18-10-41.763Z`, `897eeef-2026-06-22T11-45-34.787Z`, `942ac9c-2026-06-22T19-29-32.970Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-mysql/src/migrate.rs:338` — Calls query_scalar by bare name after importing it via `use crate::query_scalar::query_scalar` at line 14, but Ariadne left this call unresolved (resolution_count=0). (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/binder.ts:655` — setValueDeclaration is called here after being imported via named destructuring at line 280, confirming a real caller that Ariadne failed to resolve (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:123` — createModuleNotFoundChain is explicitly named in the destructured import at the top of checker.ts, proving a real caller exists and the resolution gap is in Ariadne's cross-file import linking. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:20356` — Direct unqualified function call to isValidESSymbolDeclaration with resolution_count=0, confirming Ariadne indexed but failed to resolve the reference to its definition in utilities.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:36727` — Direct call to flatten() with resolution_count=0 despite the function being a named export from core.ts, confirming the resolver fails to link cross-file named function calls. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:41498` — Direct call to isCommonJsExportedExpression(node) inside checkExpressionForMutableLocation confirms the function is reachable, but Ariadne shows resolution_count=0 for this call reference. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:45166` — Direct function call with resolution_count=0, confirming Ariadne indexed the call but failed to link it to the definition in utilities.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:4653` — Direct named function call to isPrototypePropertyAssignment with resolution_count=0, confirming resolver failed to link the call to the definition in utilities.ts despite a valid import. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:47036` — Direct function call after named destructured import at line 79; resolution_count=0 confirms resolver did not link it to the definition in utilities.ts (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:47296` — Direct call to hasOverrideModifier as a plain function; grep confirms the call exists but Ariadne's resolution_count=0 indicates import resolution failed despite the call being detected. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:4746` — Direct function call (no dynamic dispatch, method chain, or aliasing) that Ariadne detected but failed to resolve to its definition in utilities.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/emitter.ts:3559` — Direct function call to moveRangePastModifiers with resolution_count=0 despite it being a straightforwardly exported function in utilities.ts (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/executeCommandLine.ts:786` — Direct function call via named import at line 64 with resolution_count=0 — the resolver detected the call but failed to link it to the definition in commandLineParser.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/moduleSpecifiers.ts:241` — Direct named function call at line 241 with the function imported by name at line 45, but Ariadne shows resolution_count=0 indicating the resolver failed to follow the named import to its definition in utilities.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/program.ts:3353` — Direct named function call at this line is imported via destructured import at line 96, but Ariadne shows resolution_count=0 indicating the resolver failed to link the call to the utilities.ts definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/transformers/classFields.ts:693` — Direct function call with resolution_count=0 despite being a straightforward named import from utilities.ts, confirming cross-file function call resolution failure. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/transformers/classFields.ts:925` — Direct function call to findComputedPropertyNameCacheAssignment with resolution_count=0, confirming Ariadne found the call but failed to link it to the definition in utilities.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/transformers/declarations.ts:840` — Direct named function call after destructured import from barrel namespace; Ariadne indexed the call (resolution_count=0) but failed to resolve it to the definition in utilities.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/utilities.ts:9587` — Direct named function call to tryRemovePrefix with resolution_count=0 confirms the resolver failed to link the call to the definition in core.ts (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/services/callHierarchy.ts:445` — Direct function call to isCallOrNewExpressionTarget with resolution_count=0, confirming Ariadne indexed but did not resolve the reference to its definition in utilities.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/services/callHierarchy.ts:446` — Direct named function call to isTaggedTemplateTag exists in convertEntryToCallSite but Ariadne's resolver produced zero resolutions for this reference. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/services/completions.ts:4333` — Direct call by name to positionBelongsToNode confirms a real caller exists that Ariadne did not resolve. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/services/completions.ts:717` — Direct function call to isInString with resolution_count=0, confirming resolution failure despite indexed call reference (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/services/findAllReferences.ts:1907` — Direct function call `getMeaningFromLocation(referenceLocation)` with resolution_count=0 confirms the resolver failed to link this call to the definition in utilities.ts (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/services/formatting/formatting.ts:40` — getNonDecoratorTokenPosOfNode is destructured from the ts.js namespace barrel and called at lines 518 and 829, but resolution_count=0 for both call references because the barrel indirection is not followed. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/api/internals.py:58` — Direct call to `_make_block` after explicit named import from the definition module; Ariadne indexed the call but left it unresolved. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/_custom_ops.py:110` — Direct named import at line 4-5 followed by plain function call at line 110 confirms a real caller that Ariadne failed to resolve. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/_custom_ops.py:176` — Real caller imports `_find_custom_op` explicitly from the definition module and calls it directly, but Ariadne's resolution_count=0 shows the link was not made. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/_inductor/fx_passes/joint_graph.py:87` — Direct call to \_pad_mm_init after explicit relative import from .pad_mm; Ariadne indexed the call but resolution_count=0 indicates it failed to link the import binding to the definition. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/_inductor/fx_passes/joint_graph.py:88` — Direct call to `_sfdp_init(input_device)` after a relative import — Ariadne indexes the call but resolution_count=0 indicates the resolver did not follow the relative import to the definition. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/_inductor/fx_passes/overlap_scheduling.py:789` — Direct call to \_log_compute_estimations via a function-scoped named import; Ariadne shows resolution_count=0 despite the call being indexed. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/_inductor/fx_passes/post_grad.py:816` — Explicit relative import and direct call of \_register_woq_lowerings is present but Ariadne's call reference has resolution_count=0 indicating the resolver failed to link it to the definition. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/_inductor/sizevars.py:1125` — Direct call to \_optimization_hint_base via explicit named import from \_size_hinting, but Ariadne resolution_count=0 indicates the import-to-definition link was not followed. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/export/_trace.py:695` — Direct call to \_convert_to_export_graph_signature imported via relative import from .graph_signature; Ariadne indexed the call but resolution_count=0 despite an unambiguous relative import binding. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/export/_trace.py:701` — Direct named import of \_materialize_and_lift_constants from its defining module is detected by Ariadne but left unresolved (resolution_count=0) despite both files being indexed. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/export/experimental/__init__.py:443` — Direct call `_get_make_file(package_name, model_names, device_type=device_type)` at line 443 by `_compiled_and_package`, imported via explicit named import at line 12. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pytorch--pytorch/torch/export/experimental/__init__.py:450` — Direct named import at line 12 and explicit function call at line 450 confirm a real caller exists that Ariadne detected but failed to resolve to the definition. (project `pytorch`, run `1d715bc-2026-06-22T15-11-13.691Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_borrowck/src/root_cx.rs:22` — Explicit `use crate::borrowck_check_region_constraints` import at line 22 confirms the callee is the function in lib.rs, yet resolution_count=0 at both call sites. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/examples/generic_associations/discriminator_on_association.py:121` — Real call site using explicit from-import of association_proxy, but Ariadne shows resolution_count=0 for this reference. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/ext/asyncio/engine.py:523` — Real caller at engine.py:523 imports and calls \_ensure_sync_result directly after `from .result import _ensure_sync_result`, but Ariadne's call reference has resolution_count=0. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/orm/mapper.py:742` — Line 742 calls `_parse_mapper_argument(inherits)` as a plain identifier imported via `from .base import _parse_mapper_argument` at line 57, a real caller that the resolver failed to link. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/sql/dml.py:1596` — Direct call to \_entity_namespace_key_search_all after explicit `from .base import _entity_namespace_key_search_all` import; Ariadne detected the call but resolution_count=0. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/fs/read.rs:84` — Direct function call to read_uring after importing via `use crate::fs::read_uring`, confirming a real caller exists that Ariadne indexed but failed to resolve. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/name_resolution.ts` so the name_resolution pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
