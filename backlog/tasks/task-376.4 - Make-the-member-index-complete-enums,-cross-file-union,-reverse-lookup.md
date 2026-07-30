---
id: TASK-376.4
title: "Make the member index complete: enums, cross-file union, reverse lookup"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - scope_construction
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 4000
plan_dedup_keys:
  - f11c468b3713e6171731cc6ebc6bf5f9223e4dd50c7cf58d52c1112d2ceace57
plan_source_tasks:
  - pt-aeaaf3ea39073708
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 4.

## Root cause

`DefinitionRegistry.update_file` (`resolve_references/registries/definition.ts:123-164`) builds the member index only for `class` and `interface` definitions and does `this.member_index.set(def.symbol_id, flat_members)` per file. So sqlx's `PgCube` enum — which carries all 11 `impl` methods on its `EnumDefinition` — has no member-index entry at all, and a Rust type whose `impl` blocks are spread over files keeps only the last-ingested file's members. There is also no reverse `name → types` index, which the structural matcher in §7 step 15 needs.

## Work plan

1. In `update_file` (`:123-164`), index `def.kind === "enum"` beside `class` and `interface`.
2. Make the member-index write a **merge** with per-file provenance, so a type's members are the union across every contributing file, and make `remove_file` (`:330`) remove only the evicted file's contributions.
3. Maintain a new `members_by_name: Map<SymbolName, Set<SymbolId>>` beside `member_index` in `update_file` and tear it down in `remove_file`.
4. Add `get_members_by_name(name)` and `get_member_closure(type_id)` (own members plus the `extends` chain). The closure walks only `extends`, never implemented interfaces, or it over-approximates, and terminates on cycles the way `walk_inheritance_chain` already does (`registries/type.ts:351-354`).
5. Keep `set_member_symbol` (`type_preprocessing/member.ts:27-37`) as the getter-over-setter policy for forward lookup — its consumer at `registries/definition.ts:128` is live.
6. Add registry unit tests: `get_member_closure` returns own members plus the `extends` chain and survives `remove_file`; `members_by_name` is torn down per file; an incremental-update test that calls `update_file` twice on the same impl file and asserts no duplication or loss.
7. Add integration tests (with fixtures under `tests/fixtures/rust/code/integration/`) covering every evidence case for this step: sqlx's `PgCube` — a Rust `enum` with two `impl` blocks — exposing all its methods including `self.header().encoded_size()`; a Rust struct whose `impl` blocks are split across two files, asserting the union of members and that evicting one file removes only that file's members; and a Rust struct with a field and a method sharing a name plus a second `impl` block.

Independent of §7 step 3; verifiable with a Rust `impl` on an `enum`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Enum definitions have a member index; sqlx's `PgCube` exposes all 11 impl methods.
- [ ] #2 A type's member index is the union across every contributing file, and `remove_file` removes only that file's contributions (verified by an incremental `update_file`-twice test).
- [ ] #3 `members_by_name`, `get_members_by_name` and `get_member_closure` exist, and the closure walks only `extends` and terminates on cycles.
- [ ] #4 Integration tests with Rust fixtures cover all of this step's evidence cases: the enum with two impl blocks, the cross-file split impl, the field/method name collision, and per-file eviction.
- [ ] #5 `definition.test.ts` stays green (behavioural assertions intact under the new shapes).

<!-- AC:END -->
