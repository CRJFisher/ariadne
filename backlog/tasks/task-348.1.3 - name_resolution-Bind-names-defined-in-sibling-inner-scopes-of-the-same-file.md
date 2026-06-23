---
id: TASK-348.1.3
title: "[name_resolution] Bind names defined in sibling inner scopes of the same file"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-348.1
priority: high
ordinal: 3000
plan_dedup_key: a21fbd7311550458aaa9a5695b44828cfa762ee8fef7c903560d56cf5913b7c7
plan_source_task: pt-c009557cba419023
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A handful of members (nest `cleanup` nested in a constructor, Rust `adjust_arg_for_abi` unqualified same-module, serde `content_as_str` intra-file) call a name defined elsewhere in the same file that the lexical walk should already carry but does not — the binding is absent from the scope map for the calling scope. Ensure `resolve_scope_recursive` propagates sibling-inner-scope definitions to the scopes that lexically reach them so these same-file calls resolve.

## Observations

- Observed count: **4**
- Projects: `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, `nest`, `serde`
- Source runs: `5843d51-2026-06-18T17-43-39.783Z`, `942ac9c-2026-06-22T19-29-32.970Z`, `dd682c2-2026-06-22T15-32-43.992Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/platform-fastify/adapters/middie/fastify-middie.ts:149` — cleanup() is called at line 149 within this.done, a nested function in the same Holder constructor that defines cleanup at line 202, but this local call is absent from Ariadne's resolved call references. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_codegen_cranelift/src/abi/mod.rs:596` — Direct unqualified call to adjust_arg_for_abi in the same abi module, confirmed by grep and Ariadne call detection, but resolution_count=0 indicates the resolver could not link it to the definition in pass_mode.rs. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/serde-rs--serde/serde_derive/src/de/struct_.rs:67` — Real call to `has_flatten(fields)` exists via explicit `use crate::de::has_flatten` import, but Ariadne resolved it to the local variable being declared in the same `let` statement rather than the function in de.rs. (project `serde`, run `dd682c2-2026-06-22T15-32-43.992Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/serde-rs--serde/serde/src/private/de.rs:3439` — Direct intra-file call to content_as_str that Ariadne detected but failed to resolve, confirming a real caller that the call graph misses. (project `serde`, run `dd682c2-2026-06-22T15-32-43.992Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/name_resolution.ts` so the name_resolution pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
