---
id: TASK-348.1
title: "Add runner-convention suppression gates to trace_call_graph (#[test], #[cfg(test)], ASV benchmarks)"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-348
priority: high
ordinal: 1000
plan_dedup_keys:
  - 8dde6aa93a69add16476be6283b6daf4a775a776d80f5edb407282b63c66b5d3
plan_source_tasks:
  - pt-5543b3abe5ae33e6
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. In `trace_call_graph.build_function_nodes` (`packages/core/src/trace_call_graph/trace_call_graph.ts:49-87`), extend the Rust path so `#[test]`/`#[cfg(test)]`-attributed definitions are treated as test callables even when the file is not under `tests/`/`benches/`. The bulk of the evidence is inline `#[cfg(test)] mod tests` inside `src/*.rs`, which `is_test_file_rust` (`detect_test_file.rust.ts:15-35`) does not match. Source the attribute from definition decorator/attribute metadata captured at index time (pass 1) — do not re-grep.

2. Do not broaden `is_test_file_rust` to whole files — `#[test]` recognition is definition-level because the offending defs live in non-test `src/` files; broadening would over-suppress production code colocated with `#[cfg(test)]` mods.

3. Add an ASV-benchmark gate: a method whose name matches `^(time|mem|peakmem)_` defined under an `asv_bench/benchmarks/` path is runner-invoked; suppress like a test callable.

4. Confirm the Rust definition metadata records `#[test]`/`#[cfg(test)]` attributes from pass 1; if only the file-level `is_test_file` signal exists, plumb the attribute onto the definition at index time (do not re-grep in trace_call_graph).

5. Tests in `trace_call_graph.test.ts` (`toEqual`, both excluded and retained cases): a `#[test]`/`#[cfg(test)]` fn inside a non-`tests/` `src/*.rs` file is excluded; an `asv_bench/benchmarks/x.py` `time_foo` method is excluded; a same-named non-benchmark `time_foo` outside `asv_bench/` is retained (over-suppression guard).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->

## Implementation Notes

## High-level summary

A callable invoked only by a language test or benchmark runner has no source-level call edge, yet it is not dead code. `trace_call_graph` already suppresses callables that live in a test file (`is_test_file`); it now also suppresses callables identified by a runner convention at the definition level, so a Rust `#[test]`/`#[cfg(test)]` function in an ordinary `src/` file and a pandas-style ASV benchmark method are both removed from the entry-point (dead-code) candidate set.

The signal is sourced at index time and read once during call-graph construction:

- **Rust attributes recorded as decorators.** `attach_rust_test_harness_attributes` (`index_single_file/query_code_tree/symbol_factories/symbol_factories.rust.ts`) walks the function's tree-sitter node and its `mod`/`impl` ancestors, recording a `test` decorator for a direct `#[test]` and a `cfg` decorator for any `cfg(test)` predicate — direct or inherited from an enclosing `#[cfg(test)]` module. The walk is invoked from the five Rust free-function handlers. A `cfg(test)` predicate is recognised structurally (`test`, `all(test, …)`, `any(test, …)`) while a `not(...)` wrapper is skipped, so `#[cfg(not(test))]` — which gates code into production-only builds — is correctly left alone, as is `#[cfg(feature = "test")]`.
- **Definition-level gate.** `trace_call_graph/runner_suppression.ts` (`is_runner_invoked_callable`) marks a Rust callable carrying a `test`/`cfg` decorator, and a Python method named `time_`/`mem_`/`peakmem_*` under an `asv_bench/benchmarks/` path, as a test callable. `build_function_nodes` ORs this with the existing file-path detector; the rest of the pipeline is unchanged because the entry-point set only shrinks upstream.

### What changed

- **`symbol_factories.rust.ts`**: `attach_rust_test_harness_attributes` plus the private `extract_rust_test_harness_attributes` / `classify_test_harness_attribute` / `cfg_predicate_requires_test` helpers.
- **`runner_suppression.ts`** (new): the `is_runner_invoked_callable` gate; wired into `trace_call_graph.ts`.
- **`functions.rust.ts`** (new): the five Rust free-function capture handlers moved out of `capture_handlers.rust.ts` — mirroring the existing `methods.rust.ts` split — to keep the file under the repo's 32KB pre-commit size gate. `capture_handlers.rust.ts` re-imports and re-exports them, so the handler registry is unchanged.
- **Tests & fixtures**: an AST-level decorator-attachment suite in `capture_handlers.rust.test.ts`; a `runner_suppression.test.ts` unit suite over the predicate; a `runner_suppression.integration.test.ts` full-pipeline suite that re-homes the fixtures under a temp root so their path does not contain `/tests/` (which the file-path detector would suppress wholesale). Fixtures: `rust/code/entry_points/test_harness_attributes.rs` and `python/code/asv_bench/benchmarks/frame_ctor.py` (+ a same-prefixed guard outside `asv_bench`).

### Evidence coverage

Every distinct shape across the 20 Rust `#[test]` and 14 ASV `time_*` evidence cases is captured: a bare top-level `#[test]`; `#[test]` inside `#[cfg(test)] mod tests`; a plain helper inheriting `cfg(test)` from its enclosing module; a feature-gated `#[cfg(feature = "…")] #[test]` (the sqlx `interval.rs` shape); and ASV `time_`/`mem_`/`peakmem_` methods. Functions in files literally named `tests.rs` are caught by the same `#[test]` attribute path. Over-suppression guards prove that production code, a non-test `cfg(unix)`, a `cfg(not(test))` function, and a `time_`-prefixed method outside `asv_bench/` all remain genuine entry points.

### Decisions and scope

- **No new `IndirectReachabilityReason` or schema change.** Suppression reuses the existing `is_test` channel on `CallableNode`; the runner conventions are a new source of that flag, not a new wire contract.
- **`is_test_file` not broadened (work-plan step 2).** Recognition is definition-level because the offending defs live in non-test `src/` files; broadening the file detector would over-suppress production code colocated with `#[cfg(test)]` mods.
- **The `cfg` decorator is only attached for `cfg(test)`.** Its predicate is discarded once classified, so a `cfg` decorator on a Rust definition unambiguously signals test-only compilation; this contract is documented at both producer and consumer.
- **Rust method suppression not plumbed.** All evidence cases are free functions (`#[test]` cannot apply to a `self`-method); attaching the decorator from the method handlers would be speculative.
