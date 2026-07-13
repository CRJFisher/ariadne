---
id: TASK-364.6
title: "Fix two Rust import-form gaps: super::super climb and self as a group member"
status: To Do
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - correctness
  - rust
  - language-axis
parent_task_id: TASK-364
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two Rust import forms are handled incorrectly. Both surfaced during hygiene
passes and were left unchanged because a hygiene pass must not silently alter
product behaviour or enshrine a passing test around a wrong result.

**Gap A — `super::super::` does not climb two levels.**
`packages/core/src/resolve_references/import_resolution/import_resolution.rust.ts`
special-cases only `parts[0]` when resolving relative module prefixes, so a
nested `super::super::x` treats the second `super` as an ordinary module segment
and falls through to the inferred-path fallback rather than climbing a second
parent. Single `super::x` resolves correctly; two-or-more-level climbs do not.

**Gap B — `self` as a group member is dropped.**
`packages/core/src/index_single_file/query_code_tree/symbol_factories/imports.rust.ts`
normalizes `use` forms into import symbols. In a grouped import
`use std::io::{self, Write}`, the `self` member (which imports `std::io` itself)
is silently dropped — only `Write` yields a symbol. `Write` and the group
mechanics are covered; the `self`-in-group member is not.

### Work

1. **Gap A:** in the Rust import resolver, count and climb one parent per leading
   `super` segment (`super::super::x` climbs two), not just the first. Add
   regression tests for `super::x`, `super::super::x`, and
   `super::super::super::x`.
2. **Gap B:** in the Rust import factory, emit an import symbol for a `self`
   group member that binds the group's module path (`use std::io::{self, Write}`
   yields both an `io` import and a `Write` import). Add a regression test; keep
   the existing group/glob/alias coverage green.
3. Verify end-to-end that both fixes flow through to call/reference resolution
   (the factory feeds the resolver), not just the unit under test.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `super::super::x` and deeper climbs resolve to the correct ancestor module;
      `super::x` behaviour unchanged. Regression tests assert exact resolved
      paths.
- [ ] `use a::b::{self, C}` produces an import symbol for both `b` (via `self`)
      and `C`. Regression test asserts both symbols.
- [ ] Both fixes verified through the real factory→resolver path; full core
      suite green.

<!-- AC:END -->
