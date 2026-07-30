---
id: TASK-375.3
title: "Correct the Rust local module probe for 2018-style module directories and crate-root items"
status: To Do
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-375
priority: high
ordinal: 3000
plan_dedup_keys:
  - b31faeeb0a9dc71438646e0b3d849c1df11aa6d8aa1fae3c311c6b83580d58a0
plan_source_tasks:
  - pt-42fb648cfefee347
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`resolve_module_path_rust` is wrong in two ways for _local_ modules, and both wrong rows are on the hot path: rustc is 2018-style throughout, so most of the epic's 169 Rust rows route through them.

A module file `a/b.rs` that is neither `mod.rs` nor a crate root owns its children in `a/b/`. Measured today: `config` from `src/lib.rs` -> `src/config.rs` (correct); `crate::deep::inner` from `src/lib.rs` -> `src/deep/inner.rs` (correct); `super::config` from `src/deep/inner.rs` -> `src/deep/config.rs` (correct); **`inner` from `src/deep.rs` -> `inner`, an opaque fallback (wrong)**; **`self::inner` from `src/deep.rs` -> `src/inner.rs` (wrong)**.

A third defect sits in the same function: `use crate::S;` — an item imported directly from the crate root — sends an empty module path to `resolve_rust_module_path`, which returns `path.join(base_dir, '' + '.rs')` (`:129`), i.e. `src/.rs`. Minimal repro: `src/lib.rs` with `pub struct S`, `src/other.rs` with `use crate::S;` -> `resolve(module_scope, 'S')` is `null`, while the sibling `use crate::inner::T;` resolves.

## Ordering — this is half one of two

This task and sub-task 1.4 rewrite the same ten-line `else` arm of `resolve_module_path_rust`. **This one lands first**: the local-module probe must be correct before anything falls through to a crate index, or the crate branch silently absorbs local misses and the defect becomes untestable. Both gate sub-task 1.5, which adds a new caller of this function.

## Work plan

1. Teach `resolve_from_current` (`import_resolution/import_resolution.rust.ts:80`) and the bare-path branch (`:33-42`) 2018-style module directories: when the importing file is a module file that is neither `mod.rs` nor a crate root, its children live in the sibling directory named after it. This fixes `inner` from `src/deep.rs`, `self::inner` from `src/deep.rs`, and `use self::x::y` with them.
2. Handle the empty module path (`:27-28`, `:44-51`) so it stops producing `path.join(base_dir, '.rs')`: `use crate::S` resolves `S` against the crate root file's own exports rather than a fabricated `src/.rs`.
3. Keep the three currently-correct rows byte-for-byte: `config` from `src/lib.rs`, `crate::deep::inner` from `src/lib.rs`, `super::config` from `src/deep/inner.rs`.
4. Do not add the `crate_roots` branch here — it belongs to 1.4 and must sit _after_ this probe in the `else` arm.
5. Add unit tests in `import_resolution.rust.test.ts` asserting `resolve_module_path_rust` directly for **every** row of the measured table, not just the two wrong ones: `config` from `src/lib.rs`; `crate::deep::inner` from `src/lib.rs`; `super::config` from `src/deep/inner.rs`; `inner` from `src/deep.rs`; `self::inner` from `src/deep.rs`; and the `use crate::S` empty-module-path case.
6. Add `Project`-level integration tests in `resolve_references.rust.test.ts` (`setup_project` at `:19`) for the same evidence, each asserting the call reference resolves: `crate::a::b::f()` through a 2018-style `a.rs` plus `a/` directory; `self::x::f()` from a 2018-style module file; `super::x::f()`; `use crate::S;` + `S::assoc()`; and the sibling control `use crate::inner::T;` which must stay resolving. This is the hard precondition the `scope_construction` epic handed off — three rustc rows reaching `LoweringContext` through `use crate::{…}` at `path.rs:18-21` are gated on it and nothing else — so include a `use crate::{Item}` braced-group case.
7. Keep `import_resolution.{typescript,rust,python,javascript}.test.ts` green: the relative-path candidate probing is unchanged by this task.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `resolve_module_path_rust('inner')` from `src/deep.rs` resolves to `src/deep/inner.rs` instead of returning the opaque specifier.
- [ ] #2 `resolve_module_path_rust('self::inner')` from `src/deep.rs` resolves to `src/deep/inner.rs` instead of `src/inner.rs`.
- [ ] #3 `use crate::S;` in `src/other.rs` against `src/lib.rs` declaring `pub struct S` resolves `S`, and no path of the form `src/.rs` is ever produced.
- [ ] #4 The three already-correct rows still resolve unchanged: `config` from `src/lib.rs`, `crate::deep::inner` from `src/lib.rs`, `super::config` from `src/deep/inner.rs`.
- [ ] #5 `import_resolution.rust.test.ts` asserts all six rows of the measured module-path table plus the empty-module-path case as direct `resolve_module_path_rust` assertions.
- [ ] #6 Integration tests in `resolve_references.rust.test.ts` cover every evidence case in this task — 2018-style `crate::a::b::f()`, `self::x::f()`, `super::x::f()`, `use crate::S;` + `S::assoc()`, `use crate::{Item}` braced group, and the `use crate::inner::T;` control — each asserting the call reference resolves.
- [ ] #7 No `crate_roots` lookup is introduced in this task; the `else` arm still returns unmatched leading segments opaquely.
- [ ] #8 This task is merged before sub-task 1.4.

<!-- AC:END -->
