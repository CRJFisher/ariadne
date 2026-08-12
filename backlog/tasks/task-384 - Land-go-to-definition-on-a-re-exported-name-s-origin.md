---
id: TASK-384
title: "Land go-to-definition on a re-exported name's origin"
status: To Do
assignee: []
created_date: "2026-08-12 12:40"
labels:
  - import_resolution
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`fix_import_locations` matches names over `get_exports`, which since TASK-375 contains
import-backed symbols as well as locally-defined ones. When a name arrives through a barrel,
the match can land on the re-export record rather than the definition that ultimately backs it,
so a reader following the import reaches the barrel and has to hop again by hand.

The registry already knows how to walk from a re-export to its origin —
`ExportRegistry.resolve_export_chain` is the function that does it, and call resolution uses it.
Following the chain here would put the same answer on both surfaces.

## An unproven hypothesis worth checking first

A review of `receiver_resolution.ts` raised a related concern: in `resolve_namespace_member`,
the namespace-import branch asks `get_resolved_import_path` for the _original_ symbol rather
than the dereferenced one, which would look members up in the barrel instead of the module the
namespace import points at.

That concern does not reproduce on the shape it names. The three-hop
`import { JsTyping } from "./_namespaces/ts"` case — where the barrel does
`import * as JsTyping …; export { JsTyping }` and the caller writes
`JsTyping.discoverTypings(…)` — resolves to the leaf definition by exact `SymbolId`, pinned in
`resolve_references.typescript.test.ts`. Either the branch is not reached for that shape or the
two paths agree there. Establish whether a shape exists that does reproduce it before changing
the line; if none does, delete the concern rather than the code.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A name imported through one or more re-export hops reports the location of the definition that backs it, not the location of a re-export record.
- [ ] #2 A locally-defined export keeps reporting its own location.
- [ ] #3 The `resolve_namespace_member` concern is settled: either a reproducing shape is pinned as a failing-then-passing test, or the concern is recorded as not reproducible and closed.

<!-- AC:END -->
