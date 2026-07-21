---
id: TASK-370
title: Enforce non-vacuous entry-point reachability assertions in tests
status: To Do
assignee: []
created_date: "2026-07-21 00:00"
labels:
  - test-infra
  - enforcement
  - trace-call-graph
dependencies: []
references:
  - packages/core/src/trace_call_graph/trace_call_graph.ts
  - packages/core/src/project/project.typescript.integration.test.ts
  - .claude/hooks/stage_boundary_stop.ts
  - .claude/rules/testing.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A test that proves reachability by asserting a function is **absent** from the call
graph's entry points — `expect(entry_points.has(fn_id)).toBe(false)` — is silently
vacuous on any fixture whose path is under `tests/`.

`trace_call_graph` marks every node from a `tests/`-path file `is_test = true`, and
`detect_entry_points` drops all `is_test` nodes from `entry_points` unless the graph is
built with `include_tests: true` (the default is `false`). Every integration fixture in
`packages/core` lives under such a path, so `entry_points` is effectively empty for them
and the `.toBe(false)` assertion passes no matter what — even when the inbound edge the
test claims to verify never formed. The assertion reads as a reachability guard but guards
nothing.

A correct entry-point-absence assertion needs two things together:

1. **`get_call_graph({ include_tests: true })`** — so the fixture's nodes stay in
   `entry_points` and the graph is non-trivial; and
2. **A never-called control function in the same fixture**, asserted to BE an entry point
   (`toBe(true)`) alongside the subject's absence (`toBe(false)`). The control proves
   entry-point detection is actually live at this call site; without it, an empty
   `entry_points` still satisfies the subject assertion.

The landed TASK-351 getter tests already use exactly this shape (a `value` getter asserted
reachable while an uncalled `compute` method is asserted to remain an entry point), and
TASK-359's decorator-factory tests were reworked to it after review. Many older absence
assertions across the TypeScript, JavaScript, Python, and Rust integration suites still use
the raw, unguarded form.

### Enforcement design

- **Single owner of the pattern.** Add a shared test helper that encapsulates the correct
  shape — it builds the graph with `include_tests: true` and asserts, in one call, that a
  control symbol is an entry point and the subject symbol is not (e.g.
  `expect_not_entry_point(project, { subject, control })`). Place it per the
  `testing.md` first-common-ancestor rule so every call-graph suite can import it.
- **Migrate the instances.** Route every existing `entry_points` absence assertion
  (`.has(id).toBe(false)` and `.includes(id) … false`) through the helper, adding a control
  where a suite lacks one. This is a cross-language sweep: TS, JS, Python, and Rust
  integration suites all carry the raw form today.
- **Guard against recurrence with a hook + a focused rule.**
  - A content-scanning Stop hook (in the shape of `stage_boundary_stop.ts` /
    `capture_receiver_consistency_stop.ts`: read git-modified `*.test.ts`, block with a
    pointed message) rejects a raw entry-point-absence assertion — an `expect(...)` whose
    argument reads `entry_points` membership and whose matcher is `toBe(false)` — that does
    not go through the helper. The message names the helper and the `include_tests` +
    control requirement. It fires only on test files and never on the helper's own module.
  - A focused, path-scoped rule file (`.claude/rules/*.md` with `paths:` frontmatter
    covering the call-graph test trees, e.g. `packages/core/src/**/*.integration.test.ts`
    and `packages/core/src/trace_call_graph/**`) states the convention in a few lines so it
    is injected as context whenever one of those tests is edited — the encourage path that
    complements the hook's block path.

### Origin

Surfaced by TASK-359: a review caught the decorator-factory reachability assertion as
vacuous for this exact reason. The instance is fixed and TASK-351's tests already model the
correct shape; this task lifts that shape into a single owner, sweeps the remaining raw
assertions, and prevents the trap from being reintroduced by copy-paste.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A shared test helper is the single owner of the correct pattern: it builds the call
      graph with `include_tests: true` and asserts, in one call, that a control symbol is an
      entry point while the subject symbol is not.
- [ ] Every existing `entry_points`-absence assertion in the `packages/core` TypeScript,
      JavaScript, Python, and Rust suites routes through the helper (with a live control),
      and each migrated suite still passes.
- [ ] A write-time check (Stop hook or equivalent) blocks a raw entry-point-absence
      assertion in a `*.test.ts` file that does not go through the helper, names the helper
      in its message, and does not fire on the helper's own module or on non-test code.
- [ ] A focused, path-scoped rule file states the convention and is injected as context
      when a call-graph test file is edited.
- [ ] The hook has a colocated `*.test.ts` covering a vacuous assertion (blocked) and a
      helper-routed assertion (allowed).

<!-- AC:END -->
