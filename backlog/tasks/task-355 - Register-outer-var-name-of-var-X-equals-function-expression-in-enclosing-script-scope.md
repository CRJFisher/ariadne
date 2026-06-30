---
id: TASK-355
title: Register the outer var name of `var X = function X(){}` in the enclosing script scope
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - scope-resolution
  - javascript
dependencies: []
references:
  - packages/core/src/index_single_file/scopes
  - packages/core/src/resolve_references
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A var-bound named function expression — `var X = function X(){}` — registers the inner
function-expression name in its own scope but does not add the outer `var` name to the enclosing
script scope's symbol table. So intra-file references to `X` fail name resolution: a bare-name call
`X()` and a constructor call `new X()` (for a PascalCase binding) both fail with `name_not_in_scope`.

Surfaced by TASK-190.30.1's registry audit, which deleted two suppressor classifiers for the call
and `new` paths of this pattern. Confirmed still-broken in current `packages/core` via a live repro.
(Five sibling classifiers describing the older zero-CallReference shape were deleted as already-fixed
— the resolver now registers the call site; only the var-name scope-registration gap remains.)

### Origin (deleted classifier rows this tracks)

`same-file-var-function-resolution` (bare-name call path), `constructor-call-resolution` (`new X()` path).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `var X = function X(){}` registers the outer `X` name in the enclosing script scope.
- [ ] An intra-file `X()` call resolves to the function.
- [ ] An intra-file `new X()` (PascalCase var-bound named function expression) resolves to the
      function as a constructor.
- [ ] Regression tests cover both the call and `new` paths.

<!-- AC:END -->
