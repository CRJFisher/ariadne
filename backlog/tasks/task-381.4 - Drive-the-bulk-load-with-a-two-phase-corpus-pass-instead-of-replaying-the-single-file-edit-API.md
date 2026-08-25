---
id: TASK-381.4
title: "Drive the bulk load with a two-phase corpus pass instead of replaying the single-file-edit API"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - architecture
  - performance
  - call-graph
dependencies:
  - TASK-381.1
  - TASK-381.2
  - TASK-381.3
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`load_project` calls `Project.update_file` once per file, and `update_file` is the file watcher's incremental API. It reads `imports.get_dependents(file_id)` (`packages/core/src/project/project.ts:140`), unions the file with its dependents, and re-runs registry eviction and Phases 3-5 for the whole set. A matched-prefix experiment — the same 25 probe files indexed into projects already holding K others, three interleaved reps — measured 34.1, 38.7, 47.1, 76.1, 191.0 and 463.8 ms of CPU per file across K=0 to 1,600. Cascade width grew 3.96x over that range while cost per pass grew 16.06x, so the cascade is not the whole story; what it multiplies is.

Split `apply_index_and_resolve` into `populate_registries`, `fix_import_locations_for_file` and `resolve_files`, then expose two bulk entry points: `ingest_file` (parse, index, registry population only) and `resolve_corpus` (Phase 2.5 for every file, then Phases 3-5 once). `load_project` becomes pass A followed by one `resolve_corpus()`. `update_file` and `restore_file` (`project.ts:173`) remain the watcher's path, recomposed from the same steps — no flag, no second copy of any phase. Measured, this collapses `resolve_names` from 1,153 calls to 43 at n=1,200 and from 185 to 6 at n=200, and takes peak heap over the n=200 slice from 427.2 MB to 185.3 MB.

Do not sell it as a speedup. Re-measured with interleaved arms on a quiet box, the driver's own CPU value is 1.011x at n=600 and 1.149x at n=1,200 — not the 1.17x and 1.24x first claimed. Its worth is that it makes TASK-381.3's and TASK-381.5's fixes tractable at all, and that it halves peak heap, which is what killed the eleven-hour run. This task also carries the ratio assertion for TASK-381.3's reverse indices, because the 1.981x at n=1,200 and 1.472x at n=600 were measured between two arms that both carry this driver.

Two capability fixes ride along: the eager cascade re-runs Phases 3-5 for dependents but never Phase 2.5, so under path order an import naming an alphabetically-later file points at the import statement forever (669 of 1,865 `ImportDefinition`s at n=200, every one of which "go to definition" gets wrong), and because the cascade is import-graph-shaped it misses resolution dependencies that are not import edges, reporting `Toggle.focus` and `Toggle.blur` as unreachable at n=100 having never seen `Menu` call them.

It does change resolution behaviour, and the acceptance rule has to be honest about that rather than assert a strict superset. At n>=927 under forward ingest the driver loses one call edge the baseline resolves — a plain getter read, `IME.enabled`. Three-order testing showed this is an instance of pre-existing resolver order-dependence rather than a defect the driver owns: under reversed ingest the two builds produce byte-identical edge sets, and the unpatched build itself moves by two entry points between forward and reversed order at n=1,000. So the rule is that any edge lost here is reproduced as order-dependent on the unpatched build too, over the three named orders, and TASK-381.11 is where the underlying defect is actually closed.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `Project` exposes `ingest_file` and `resolve_corpus`; `load_project` calls `update_file` nowhere; `update_file` and `restore_file` remain the watcher path, recomposed from the same steps with no phase implemented twice.
- [ ] #2 #2 `resolve_names` is called <= 10 times for a 1,200-file load against 1,153 today, and <= 6 times for a 200-file load against 185; the exact count and the reason for any count above one are recorded in the harness.
- [ ] #3 #3 Peak heap over the n=200 slice is <= 200 MB, against 427.2 MB today.
- [ ] #4 #4 Any call edge the unpatched build resolves and this one does not is reproduced as order-dependent on the unpatched build, recorded edge by edge; the reversed-order run gives byte-identical edge sets between the two builds; and no edge is lost that the unpatched build resolves under ALL THREE named orders (forward, reversed, and the seeded shuffle whose seed the harness records). Edges lost under one or two of the three are recorded individually as instances of the order-dependence TASK-381.11 owns.
- [ ] #5 #5 Every import whose target is in the corpus has its `ImportDefinition` location on the declaration rather than the import statement — 0 of 1,865 wrong at n=200 against 669 today — and `fix_import_locations.test.ts` stays green.
- [ ] #6 #6 The false entry points the eager driver reports at n=100 are gone, each named in the task by fully-qualified symbol and repo-relative `path:line` (`src/vs/base/browser/ui/toggle/toggle.ts` `focus` at :106 and `blur` at :111, plus the third site at :516 identified by symbol before work starts — an unnamed line number is not a checkable criterion).
- [ ] #7 #7 With TASK-381.3's reverse indices and this driver both present, whole-load CPU improves by >= 1.8x at n=1,200 (measured 1.981x) and >= 1.4x at n=600 (measured 1.472x) against the driver-without-indices arm, interleaved in separate processes, reported as cpu_user with cpu/wall and loadavg.
- [ ] #8 #8 `packages/core` shows no new test failures against a stashed baseline taken in the same checkout with `node_modules` symlinked per TASK-381.1, so grammar-version failures are diffed rather than attributed to this change.

<!-- AC:END -->
