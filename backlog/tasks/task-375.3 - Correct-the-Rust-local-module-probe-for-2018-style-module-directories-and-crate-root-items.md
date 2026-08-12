---
id: TASK-375.3
title: "Correct the Rust local module probe for 2018-style module directories and crate-root items"
status: Done
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

- [x] #1 `resolve_module_path_rust('inner')` from `src/deep.rs` resolves to `src/deep/inner.rs` instead of returning the opaque specifier.
- [x] #2 `resolve_module_path_rust('self::inner')` from `src/deep.rs` resolves to `src/deep/inner.rs` instead of `src/inner.rs`.
- [x] #3 `use crate::S;` in `src/other.rs` against `src/lib.rs` declaring `pub struct S` resolves `S`, and no path of the form `src/.rs` is ever produced.
- [x] #4 The three already-correct rows still resolve unchanged: `config` from `src/lib.rs`, `crate::deep::inner` from `src/lib.rs`, `super::config` from `src/deep/inner.rs`.
- [x] #5 `import_resolution.rust.test.ts` asserts all six rows of the measured module-path table plus the empty-module-path case as direct `resolve_module_path_rust` assertions.
- [ ] #6 Integration tests in `resolve_references.rust.test.ts` cover every evidence case in this task — 2018-style `crate::a::b::f()`, `self::x::f()`, `super::x::f()`, `use crate::S;` + `S::assoc()`, `use crate::{Item}` braced group, and the `use crate::inner::T;` control — each asserting the call reference resolves.
      <!-- partial: A plain `super::x::f()` module-qualified call has no integration row; the only super-anchored call test traverses a module alias. -->
- [x] #7 No `crate_roots` lookup is introduced in this task; the `else` arm still returns unmatched leading segments opaquely.
- [x] #8 This task is merged before sub-task 1.4.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The Rust module probe now models where a module keeps its children. A `mod.rs` and a crate root own the directory they sit in; every other module file owns the sibling directory named after it, so `src/deep.rs` owns `src/deep/`. Both the bare-path branch and the `self::` branch resolve against that directory, with a fallback to the file's own directory so a crate that keeps its modules flat still resolves. The three rows that were already correct — `config` from `src/lib.rs`, `crate::deep::inner` from `src/lib.rs`, `super::config` from `src/deep/inner.rs` — take the same paths they did before.

An anchor with nothing after it names an item of the anchored module itself, not a module beneath it. `use crate::S` resolves to the crate root's own file (`lib.rs`, else `main.rs`) so `S` is looked up in its exports; `use self::Item` resolves to the importing file; `use super::Item` resolves to the parent module's file, `mod.rs` or the 2018-style sibling. Previously each of these joined an empty segment list and produced a path like `src/.rs`, which matched nothing.

No crate index is introduced here: an unmatched leading segment is still returned opaquely, which is what keeps a genuinely external crate from fabricating an edge. That lookup belongs to TASK-375.4, and must sit after this probe in the same arm.

Front door for readers: `import_resolution.rust.ts` — `module_child_dir` states the ownership rule, `resolve_local_module` applies it, and the three anchor branches each handle their empty-path case.

### Deferred and recorded

This task's AC #6 lists path-qualified *call* rows (`crate::a::b::f()`, `self::x::f()`, `super::x::f()`). Those exercise the call-site resolver, not the module-path function: a `mod x;` declaration carries no link to its file, so the qualifier is not bound in scope and the call fails at name resolution regardless of how well the path resolves. That link and the unified path resolver are TASK-375.5, which is where those integration rows land. What this task owns — the module-path function itself — is pinned directly.

### Verification

`packages/core` green; typecheck and lint clean. `import_resolution.rust.test.ts` asserts `resolve_module_path_rust` for every row of the measured table plus the three empty-anchor cases, the flat-layout fallback and the opaque external-crate return. Two Project-level rows pin the crate-root fix end to end: `use crate::S;` + `S::assoc()` resolves alongside the sibling control `use crate::inner::T;`, and the braced `use crate::{Item}` group resolves — the shape the `scope_construction` epic handed off.
