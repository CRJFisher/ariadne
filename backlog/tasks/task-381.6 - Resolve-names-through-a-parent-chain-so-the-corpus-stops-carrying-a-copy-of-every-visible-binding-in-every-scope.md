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
- [ ] #2 #2 Retained name-table bytes fall from 110.03 to <= 12 KB/file at n=180 and from 80.21 to <= 10 KB/file at n=737, measured by deletion on the same slices, each named by file set and corpus commit. RE-MEASURED on landed code over the same slices — microsoft/vscode@f3fa55c3, predicate `src`, path-ordered prefixes of 200/400/800 offered files — where the tree now indexes 187/377/766 against the prototype's 180/364/737, so both arms' baselines moved with it. Retained bytes by deletion under forced GC, interleaved control,candidate in one session on Darwin 24.6.0 / 6 cores / node v22.22.1, CV <= 0.01%: **171.86 -> 10.84 KB/file at the 200-file slice (15.9x)**, 112.03 -> 9.99 at 400 (11.2x) and **113.73 -> 10.02 at 800 (11.4x)**. The 12 KB/file bound at the small slice is met. The 10 KB/file bound at the large slice is missed by 0.2% — 10.02 against 10 — on a tree whose flattened arm retains 113.73 KB/file where the prototype's retained 80.21; the ratio the change buys is 11.4x either way, and the residue is per-`Map` fixed overhead over 21,916 links rather than duplicated bindings. Recorded in `RECORDED_NAME_TABLE_MEMORY`.
- [ ] #3 #3 The visible (scope, name) pair count is identical between arms at n=180, 737 and 1,847 — 438,954, 667,167 and 1,389,602 — and all four graph hashes match. The three n labels are a transcription error against the investigation, which measured 438,954 / 667,167 / 1,389,602 at n=180 / 364 / 737; no 1,847-file slice was ever run. RE-MEASURED on landed code over the same three file sets: the visible pair count is identical between arms at every slice — **819,226 / 1,064,644 / 2,153,280** — and not merely the four named hashes but all seven fingerprint components match (nodes, call edges, unresolved calls, raw entry points, indirect-reachability keys, dropped files, indirect-reachability evidence), with the 200-file row reproducing the value `RECORDED_RESOLUTION_EVICTION_COST` already holds for that slice.
- [ ] #4 #4 CPU over the same slices is within +/-5% of the flattened table (measured 0.96-0.99x): this is a memory change, and must be accepted neither as a speedup nor as a slowdown. RE-MEASURED on landed code, interleaved control,candidate in separate processes in one session: **1.001x at 200 files, 0.982x at 400 and 0.992x at 800**, with per-arm CV 0.06-0.67% — inside +/-5% at every slice, and inside the noise floor at two of the three.
- [ ] #5 #5 No interning of `SymbolName`, file paths or symbol ids is added, and the module records the conclusion and cites the harness row that measured it (5.42 KB/file freed against a 68 KB/file estimate) so it is not re-proposed.
- [ ] #6 #6 `variable_reference` records are retained and the `indirect_reachability` component of the fingerprint is unchanged.

<!-- AC:END -->
