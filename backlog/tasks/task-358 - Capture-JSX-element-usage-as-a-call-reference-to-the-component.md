---
id: TASK-358
title: Capture JSX element usage as a call reference to the component
status: Done
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - indexer
  - typescript
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A JSX element (`<Component/>`, `<Component>…</Component>`) is how a React/JSX component
is invoked, but the `@reference.call.jsx` capture for JSX elements is commented out in
`typescript.scm` (around line 695). So a component referenced only via JSX emits no
`@reference.call`, and a component used exclusively as a JSX element looks unreachable.

Surfaced by TASK-190.30.1's registry audit, which removed the `ts-jsx-component-call`
suppressor classifier as a fixable capture gap. This is the same class of gap as
TASK-351 (member/property reference capture) but covers the distinct JSX-element form.

### Origin (deleted classifier row this tracks)

`ts-jsx-component-call` (predicate; observed_count 0, but the gap is provable in
`typescript.scm` independent of a triage hit).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] A JSX element usage emits a `@reference.call` (or equivalent) resolving to the
      component definition, in both `.tsx` and `.jsx`.
- [x] A component used only as a JSX element is no longer an unreachable entry point.
- [x] Regression test covers JSX-only component usage.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

A JSX element is how a React/JSX component is invoked, so a component's tag name
captures as a call reference to the component definition. `<Panel>` and `<Icon/>`
emit an `@reference.call.jsx` that resolves through the ordinary function-call path,
so a component used only as a JSX element gains an incoming call edge and is no
longer flagged as an unreachable entry point.

### How it works

The TypeScript language maps to the `tsx` tree-sitter grammar (`parsers.ts`), a
superset of the plain-TypeScript grammar and the only one that yields
`jsx_opening_element` / `jsx_self_closing_element` nodes, so a single query serves
both `.ts` and `.tsx`. `.jsx` already parses with a JSX-capable grammar. The JSX
captures in `typescript.scm` (and the matching ones in `javascript.scm`) tag the
element's identifier as `@reference.call.jsx`; the reference builder routes the
`.jsx`-qualified capture through the same path as an ordinary function call, so it
resolves and participates in reachability with no JSX-specific handling downstream.

Only the component form is captured: a tag whose name starts with a lowercase
letter is an intrinsic host element (`<div>`) that names no definition, so the
capture excludes it via `(#not-match? @reference.call.jsx "^[a-z]")`. `<Panel>`,
`<_Private>`, and `<$Styled>` are components and capture; `<div>` does not.

### Acceptance criteria

- **A JSX usage emits a resolving call reference (`.tsx` and `.jsx`)** — the
  "JSX Component Usage" tests in `project.typescript.integration.test.ts` and
  `project.javascript.integration.test.ts` assert `<Icon/>` and `<Panel>` emit
  `function_call` references that `resolve()` to the component definitions.
- **A JSX-only component is no longer unreachable** — the same tests assert each
  component's symbol is in `get_all_referenced_symbols()`, the exact set the
  entry-point detector consults to skip reachable symbols.
- **Regression test** — the two single-file tests exercise components used
  exclusively via JSX, plus an intrinsic `<div>` that emits no component call
  reference.

### Boundaries

- Parsing every `.ts` file with the `tsx` grammar means an angle-bracket type
  assertion (`<T>x`) — legal in `.ts`, forbidden in `.tsx` — parses as a JSX
  element in an error region that drops the surrounding statement's captures.
  Casts must use the `as` form, which the query already relies on for its only
  type-assertion capture.
- JSX component references flow through the ordinary function-call resolver, so
  cross-file resolution of an imported component behaves identically to a
  cross-file `Foo()` call; there is no JSX-specific cross-file path.
- Member-expression tags (`<Foo.Bar/>`) are not captured, matching the existing
  `javascript.scm` behavior for the same form.

### Test-harness alignment

The grammar map is the single source of truth for grammar selection. Test parsers
read the grammar from `LANGUAGE_TO_TREESITTER_LANG.get("typescript")` rather than
naming a grammar directly, so a test's parse grammar always matches the grammar the
query is compiled against.

<!-- SECTION:NOTES:END -->
