---
id: TASK-355
title: >-
  Register the outer var name of `var X = function X(){}` in the enclosing
  script scope
status: Done
assignee: []
created_date: '2026-06-30 00:00'
updated_date: '2026-07-20 23:42'
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
- [x] #1 `var X = function X(){}` registers the outer `X` name in the enclosing script scope.
- [x] #2 An intra-file `X()` call resolves to the function.
- [x] #3 An intra-file `new X()` (PascalCase var-bound named function expression) resolves to the
      function as a constructor.
- [x] #4 Regression tests cover both the call and `new` paths.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

A var-bound named function expression — `var X = function X(){}` — registers the outer `X`
name in the enclosing scope, so intra-file `X()` and `new X()` reach the function and `X` is
not surfaced as a false-positive unreachable entry point. The outer binding is the single
canonical function symbol: it owns the function's body scope and its call-graph node,
mirroring how `var X = () => {}` arrow bindings are already handled. The inner expression name
remains visible for self-reference inside the body, but is neither a second call-graph node
nor a module export.

The fix lives entirely in per-file indexing (stage 1). A tree-sitter query pattern — added
beside the existing arrow pattern in both `javascript.scm` and `typescript.scm` — captures the
outer `variable_declarator` name of a `function_expression` value as a function definition,
placing it in the enclosing scope. The capture handlers (`capture_handlers.javascript.ts`,
`capture_handlers.typescript.ts`) register the inner expression name for self-reference
resolution only: without a body scope (so it is not a duplicate node or spurious entry point)
and never as an export (so it does not collide with the outer name in the export registry).
`scopes.ts` names a var-bound function-expression's body scope after its outer variable, so the
single outer symbol matches its body even when the inner and outer names differ
(`const f = function g(){}`).

Downstream stages need no changes: name resolution finds the outer name in the enclosing scope,
and the `new X()` site's name-resolved read marks the function reachable through indirect
reachability — exactly as a plain function declaration used via `new` already is.

Front door: the `.scm` query files own the capture; the capture handlers own definition/scope
routing and export suppression; `scopes.ts` owns body-scope naming. Name resolution, call
resolution, and reachability are unchanged and benefit automatically.

### What changed

- `queries/javascript.scm` + `queries/typescript.scm`: a `(variable_declarator name: (identifier)
  @definition.function ... value: (function_expression))` pattern registers the outer var name as
  a function in the enclosing scope, mirroring the sibling arrow pattern.
- `capture_handlers.javascript.ts` / `capture_handlers.typescript.ts`: the inner expression name
  of a var-bound named function expression is registered as a self-reference-only definition — no
  body scope, `is_exported = false` — so it neither duplicates the call-graph node, surfaces as a
  spurious entry point, nor collides with the outer name in the export registry.
- `scopes.ts` (`extract_scope_name`): a var-bound function-expression body scope is named after
  its outer variable so the outer symbol matches its body even when inner ≠ outer name.
- Regression tests at the index level (outer/inner scope placement) and the resolve level (bare
  call, `new`-only reachability, distinct inner/outer name with self-reference, and exported forms)
  in both JavaScript and TypeScript.

### Acceptance criteria

All met. `new X()` is satisfied in the call-graph sense that matters: the function is reachable
and no longer a spurious entry point. Note that `new fn()` on any function (var-bound expression,
arrow, or plain declaration alike) reports `constructor_target_not_a_class` at the call-resolution
layer — a pre-existing, system-wide trait of functions-as-constructors — which does not affect
reachability.

### Known adjacent gaps (pre-existing, out of scope — follow-up candidates)

- Generator named function expressions (`var X = function* X(){}`, node type `generator_function`)
  register no function definition; the outer name is not captured.
- The inner name of an object-property named function expression (`const obj = { m: function m(){} }`)
  is still registered as an export and falsely resolves to a cross-file `import { m }`. Same defect
  class as this task, different syntactic position (`pair`, not `variable_declarator`).
<!-- SECTION:NOTES:END -->
