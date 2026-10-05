---
id: TASK-364.6
title: "Fix two Rust import-form gaps: super::super climb and self as a group member"
status: Done
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

- [x] `super::super::x` and deeper climbs resolve to the correct ancestor module;
      `super::x` behaviour unchanged. Regression tests assert exact resolved
      paths.
- [x] `use a::b::{self, C}` produces an import symbol for both `b` (via `self`)
      and `C`. Regression test asserts both symbols.
- [x] Both fixes verified through the real factory→resolver path; full core
      suite green.

<!-- AC:END -->

## Implementation Notes

## High-level summary

Two Rust `use` forms broke cross-file call resolution: a second leading `super`
was walked as an ordinary module segment named "super", and a `self` group
member produced no import symbol at all, so the module it binds never entered
the consumer's scope.

Each fix lives in the single function that owns the behavior. In
`resolve_references/import_resolution/import_resolution.rust.ts`,
`resolve_from_parent` keeps its mod.rs-aware first hop — the hop that crosses
from file space into module-directory space — and consumes each additional
leading `super` as one plain directory climb, then walks the remaining segments
as before. There is deliberately no crate-root clamp on the climb: crate-root
detection falls back to the importing file's own directory in marker-less
projects, so clamping there would break legitimate climbs; an over-deep chain
(invalid Rust) saturates at the filesystem root and lands in the existing
inferred-path fallback.

In `index_single_file/query_code_tree/symbol_factories/imports.rust.ts`, a
`self` group member emits the identical `ImportInfo` that the equivalent
`use <prefix>` statement produces — `{name: last prefix segment, module_path:
the rest}` via `split_group_prefix` — so the import graph, name resolution, and
export lookup consume it with no new capability. The same root cause (the
tree-sitter `self` node matches no branch) also made `use a::b::{self as c}`
mis-parse the alias as the original name; the group `use_as_clause` branch now
recognizes a `self` original and emits the `use a::b as c` shape. Nested groups
work through the existing recursion.

Coverage: exact-path climb tests in `import_resolution.rust.test.ts`, exact
`ImportInfo` literals in `imports.rust.test.ts`, and two `Project`-level
temp-dir tests in `resolve_references.rust.test.ts` (a `super::super` import
driving a resolved cross-file call; a `self` member binding the module in the
consumer's scope alongside a resolved sibling-item call). All new tests fail
with the fixes reverted.

Known boundary: resolving a module-qualified call *through* a `self`-bound
module (`utils::helper()` where `utils` exists only via `use a::utils::{self}`)
is a separate resolver capability in `call_resolution/function_call.rust.ts`
that does not exist for any module import; Gap B is therefore proven at the
name-binding layer. Multi-super wildcards (`use super::super::*`) resolve to an
inert synthetic path, the pre-existing behavior for all prefix-only glob
imports.
