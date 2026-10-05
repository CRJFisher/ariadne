---
id: TASK-388
title: "Resolve an import against the declaration space it asks from so a type-only import cannot bind a value"
status: To Do
assignee: []
created_date: "2026-08-27 22:30"
labels:
  - import_resolution
  - call-graph
dependencies:
  - TASK-381.8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

When one module binds a name in both TypeScript declaration spaces —
`export const IFoo = createDecorator<IFoo>()` beside `export interface IFoo` —
every consumer of that name receives the same binding, whichever space the
consumer asked from. A `import type { IFoo }` and a plain `import { IFoo }`
resolve identically.

The bound on the damage is exact and small, which is why this is a follow-up
rather than part of TASK-381.8: a type-only import can never be a call target,
so it cannot move the entry-point set. What it can do is point the subtype
registry at a value. A file that writes `import type { IFoo } from './foo'` and
then `class Bar implements IFoo` records `Bar`'s implemented interface as
whatever `get_export` handed back, which on this shape is decided by
member-declaration rather than by the space the reference sits in.

## The mechanism

`ExportRegistry` holds `value_exports` and `type_exports` and `get_export`
picks between them: the member-declaring binding — class, interface, enum,
namespace — over one that declares no members, and the value space otherwise.
That rule is a good default precisely because the requester's space is not
available to it. `resolve_export_chain` takes `import_kind`
(`"named" | "default" | "namespace"`) but not the requesting declaration space,
so there is nowhere to thread the answer from.

`ImportDefinition` already carries `is_type_only`, and an inline
`import { type X }` is the same fact per specifier. Threading a requested space
through `resolve_export_chain` to `get_export` makes the choice exact instead of
heuristic, and leaves the member-declaring preference as the fallback for a
requester whose space is genuinely unknown (a JavaScript consumer, a wildcard
fan-out).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `resolve_export_chain` takes the requesting declaration space and threads it to `get_export`; a type-only import of a name bound in both spaces receives the type binding and a value import receives the value binding, both asserted over the `export const IFoo` / `export interface IFoo` shape.
- [ ] #2 A requester whose space is unknown — a JavaScript consumer, a wildcard fan-out, a re-export hop with no `is_type_only` on it — still gets the member-declaring-then-value rule, with the fallback stated in the module.
- [ ] #3 The subtype registry records the interface, not the decorator constant, for `class Bar implements IFoo` behind a type-only import.
- [ ] #4 Over vscode's `src/` at `f3fa55c3` the entry-point component of the seven-number fingerprint is unchanged, because a type-only import can never be a call target. Any move in it is a defect in this change, not a result of it.

<!-- AC:END -->
