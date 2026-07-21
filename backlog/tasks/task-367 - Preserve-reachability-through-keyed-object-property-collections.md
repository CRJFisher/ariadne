---
id: TASK-367
title: Preserve reachability through keyed object-property collections
status: To Do
assignee: []
created_date: '2026-07-21 11:20'
labels:
  - call-resolution
  - follow-up
dependencies:
  - TASK-356
references:
  - packages/core/src/resolve_references/call_resolution/collection_dispatch.ts
  - packages/core/src/resolve_references/indirect_reachability.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two reachability gaps left open by TASK-356's keyed object-literal dispatch:

1. Uncapturable alias key. `extract_collection_source_key` sets `collection_source_key` for any plain member-access initializer, so `var A = Ns.b` where `b` is spread-contributed (`{ ...base }`), computed (`{ [k]: fn }`), or where Ns is a Map/Set/Array now diverts to the keyed path and returns a MISS on the absent key — where before the change it fell through to the over-approximate union (`get_collection_functions`). This can turn a formerly-reachable (if imprecise) target into a false unreachable. A correct fix must distinguish 'key provably absent' (keyed_members complete, no spread) → precise miss, from 'key uncapturable' (spread present / non-Object collection) → fall back to union. This requires tracking spread-contributed references distinctly from identifier-valued members (currently both land in stored_references). Note: naive union-fallback-on-miss breaks the TASK-356 firewall test (`const s = container.svc; s.run()` must NOT fan out), so the distinction is essential.

2. Nested keyed members and indirect reachability. `indirect_reachability.mark_collection_as_consumed` walks only the flat `stored_functions`/`stored_references`, never `keyed_members[].nested`. A function living only inside a nested object literal is not marked reachable when the whole collection is read (`return Ns`). Not a TASK-356 regression (nested object values were not captured at all before, and such values are anonymous → never entry points), but worth closing for completeness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A spread/computed/Map-backed alias key that cannot be statically decided falls back to the union rather than producing a false unreachable
- [ ] #2 A provably-absent key (complete keyed_members, no spread) still returns a precise miss with no sibling fan-out (TASK-356 firewall preserved)
- [ ] #3 indirect reachability marks functions held only in keyed_members[].nested reachable when the whole collection is consumed
- [ ] #4 Regression tests cover the spread-alias, computed-alias, and nested-consumed cases
<!-- AC:END -->
