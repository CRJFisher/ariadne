---
id: TASK-383
title: "Complete the star surface for the two shapes it still misses"
status: To Do
assignee: []
created_date: "2026-08-12 12:40"
labels:
  - import_resolution
  - name_resolution
dependencies:
  - TASK-375
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

A wholesale module edge now carries a module's whole surface to its consumers. Two shapes still
put the wrong surface on that edge.

**Python `__all__` is not read.** A star surface binds every public module-level name, so a
module that narrows its own star surface with `__all__` still hands out everything else it
happens to define. Every name outside `__all__` that a consumer never imports becomes a
resolvable name it should not have, and the over-approximation runs toward reachability — a
definition looks called when nothing could call it. django uses `__all__` heavily, so this is
not a corner case.

**A Rust glob nested in a braced use-tree is not extracted at all.** `use crate::{a::*, b::*};`
yields no wildcard edge, where `use crate::a::*;` on its own does. The gap is in
`extract_imports_from_use_declaration`, which never handled a glob inside a tree. It predates
TASK-375 and was invisible while nothing consumed wildcard edges; now that the export fan-out
crosses them, the braced form silently supplies nothing and its consumers resolve to nothing.

## Shape of the work

The two are independent and can land separately. Both are extraction-side: the resolver
consuming the edges is correct and needs no change.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A Python module declaring `__all__` publishes exactly the names it lists on its star surface, and a name it defines but omits does not resolve through `from m import *`.
- [ ] #2 A module with no `__all__` keeps binding every public module-level name.
- [ ] #3 `use crate::{a::*, b::*};` yields one wildcard edge per glob, asserted as the exact `ImportDefinition` literals.
- [ ] #4 A call reaching a name through a braced-tree glob resolves to exactly one target, asserted as a `Project` integration test.

<!-- AC:END -->
