---
id: TASK-348.1
title: "Add runner-convention suppression gates to trace_call_graph (#[test], #[cfg(test)], ASV benchmarks)"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-348
priority: high
ordinal: 1000
plan_dedup_key: 8dde6aa93a69add16476be6283b6daf4a775a776d80f5edb407282b63c66b5d3
plan_source_task: pt-5543b3abe5ae33e6
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
