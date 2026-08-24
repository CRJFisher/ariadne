---
id: TASK-381.6
title: "Resolve names through a parent chain so the corpus stops carrying a copy of every visible binding in every scope"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - memory
  - name_resolution
  - performance
dependencies:
  - TASK-381.4
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`resolve_scope_recursive` opens each scope with `const scope_resolutions = new Map(parent_resolutions)` (`packages/core/src/resolve_references/name_resolution.ts:108`), copying every binding visible in an ancestor into every descendant scope, and the result is retained for the life of the project as the per-scope name table. Walking the real scope tree, 288,604 of 296,061 entries (97.48%) are byte-identical to a binding already resolved in an ancestor, 7,457 are unique and 718 legitimately shadow; a second measurement on a different slice found 97.85% of 912,717. At 665 KB/file of live retention this is what put the corpus over the heap ceiling.

Replace it with a `ScopeResolutions` holding only the bindings the scope itself introduces plus a link to its parent, and make `resolve(scope_id, name)` walk the chain on a miss. The scope's own map wins, which is exactly the precedence the flattened table encodes, so the 718 genuine shadowings survive by construction; a scope that introduces nothing shares its parent's link, which collapsed 8,388 scopes to 4,755 links at mean depth 3.19. Measured: name table 110.03 to 9.51 KB/file at n=180 and 80.21 to 7.91 KB/file at n=737 (10-12x), total retained heap 0.84-0.87x, peak RSS 0.93-0.96x, and CPU 0.96-0.99x — the copying removed pays for the walking added, which answers the cost gate the earlier plan demanded before writing any of this. Equivalence is structural rather than sampled: the visible (scope, name) pair count is byte-identical between arms at all three scales (438,954 / 667,167 / 1,389,602) and all four graph hashes match.

## Explicitly not in scope

Interning `SymbolName` strings, file paths and symbol ids, estimated at 68 KB/file: rewriting 1,455,167 string slots to canonical instances actually freed 5.42 KB/file in total, 12x less, because V8 already shares those strings and the estimate counted pointer slots as copies. And memory must not be saved by dropping `variable_reference` records: they are 63% of all references and they feed `indirect_reachability`, which is precisely what stops a function passed only as a value from being reported as an entry point. The path interning that does pay is inside cache blobs and belongs to TASK-381.9, where it was measured at 2.32x — a different mechanism with a different result.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 The per-scope name table holds only the bindings each scope introduces plus a parent link, `resolve` walks the chain on a miss, and a scope that introduces no binding allocates no map of its own.
- [ ] #2 #2 Retained name-table bytes fall from 110.03 to <= 12 KB/file at n=180 and from 80.21 to <= 10 KB/file at n=737, measured by deletion on the same slices, each named by file set and corpus commit.
- [ ] #3 #3 The visible (scope, name) pair count is identical between arms at n=180, 737 and 1,847 — 438,954, 667,167 and 1,389,602 — and all four graph hashes match.
- [ ] #4 #4 CPU over the same slices is within +/-5% of the flattened table (measured 0.96-0.99x): this is a memory change, and must be accepted neither as a speedup nor as a slowdown.
- [ ] #5 #5 No interning of `SymbolName`, file paths or symbol ids is added, and the module records the conclusion and cites the harness row that measured it (5.42 KB/file freed against a 68 KB/file estimate) so it is not re-proposed.
- [ ] #6 #6 `variable_reference` records are retained and the `indirect_reachability` component of the fingerprint is unchanged.

<!-- AC:END -->
