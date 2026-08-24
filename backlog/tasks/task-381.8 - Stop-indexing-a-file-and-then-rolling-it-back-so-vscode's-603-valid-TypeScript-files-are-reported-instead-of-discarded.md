---
id: TASK-381.8
title: "Stop indexing a file and then rolling it back, so vscode's 603 valid TypeScript files are reported instead of discarded"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - import_resolution
  - bug
  - call-graph
  - performance
dependencies:
  - TASK-381.7
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`ExportRegistry.update_file` keys its metadata map on the export name alone and throws `Duplicate export name` when one name arrives twice (`packages/core/src/resolve_references/registries/export.ts:164-169`), asserting in the message that this "indicates a bug in is_exported logic or malformed source code" about source that compiles. `load_project` catches it, adds the file to `dropped_files` and calls `project.remove_file` (`packages/core/src/project/load_project.ts:263-265`), which re-resolves every dependent of the dropped file. The file has already been parsed, indexed and registered by the time the throw fires, so each drop costs a full index plus a project-wide re-resolution cascade, and then the file vanishes from the report.

This is the single largest cost in the pipeline. Measured at full corpus on the built stack with both arms instrumented identically: 833.3 s of CPU and 7,795.5 MB of peak RSS with the gate active, against 423.4 s and 4,246.9 MB with the 603 gate-dropping files never offered — for the same 7,891 files indexed, the same 183,018 nodes and the same 19,917 entry points. That is 409.9 s removed, 49.2% of the load, 1.97x on CPU and 1.84x on peak RSS. Timing `Project.remove_file` directly accounts for 370.9 s of it (44.5% of the load; 603 calls at 615.1 ms each, re-resolving 16,931 dependent files, 28.1 per drop), and the 38.9 s residual over 603 files is 64.6 ms/file — exactly the measured per-file index cost, which is to say work done and thrown away. The term accelerates rather than merely growing: 0.87% of the load at n=200, 6.4-6.7% at n=2,000, 44.5% at full corpus.

The population is not declaration merging and the throw is simply wrong about it. 633 of the duplicate pairs are `export const IFoo = createDecorator<IFoo>()` beside `export interface IFoo` — vscode's dependency-injection idiom, a value binding and a type binding in two different TypeScript declaration spaces — and all 633 names match `/^I[A-Z]/`. Keying the metadata map on (declaration space, name) covers that plus `interface + namespace`, `namespace + type`, `enum + namespace` and `class + namespace` with one rule, in the same shape `ExportRegistry` already uses for its per-language escape hatches around this throw — arrow-function exports (`export.ts:98-115`), Python rebinding (`:117-143`), re-export precedence (`:145-162`) — each of which must now be either subsumed by the new key and deleted, or retained with a stated reason. If the declaration-space work has to be deferred, the strictly smaller first step is to record a diagnostic and keep the first binding rather than discard the file; that is a smaller replacement, not a flag beside the new path. And an export ambiguity must stop deleting the file's definitions and references: exports feed cross-file import resolution, while definitions and references are what the call graph reads.

The coverage effect is why this belongs in a scale epic rather than a correctness one. 34,085 of 93,409 internal import edges (36.5%) point at a dropped file and 5,979 files (70.8%) import at least one. Disabling the gate on a 100-file slice took nodes from 561 to 683 and call edges from 1,608 to 1,828, and removed 6 of 209 reported entry points that the gate itself had manufactured, with the node set a strict superset — the graph gets better, not merely bigger. It also lifts the cache's hard ceiling, since a dropped file is never written to the cache and is therefore re-parsed on every warm run forever: miss count equals drop count exactly at n=50/200/400/800, capping a fully warm run at 92.9% hits and costing 13.9-20.1% of it.

Two caveats belong on the record. The 409.9 s was measured by withholding the files, not by repairing the gate, so the budget below adds those 603 files back at the measured marginal AND carries the only figure ever measured for the repair logic itself: phase 1 priced it at +7.2% CPU on a cold load. And the pre-figures above are composed-patch measurements taken with instrumentation that runs ~7% above the clean run; the criteria are judged against the in-checkout rows TASK-381.7 AC #7 records.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 `ExportRegistry`'s metadata map is keyed on (declaration space, name), the `Duplicate export name` throw fires on no vscode file, and the "indicates a bug in is_exported logic or malformed source code" sentence is gone.
- [ ] #2 #2 `dropped_files` is empty over every discovered file, and an export ambiguity never deletes the file's definitions or references.
- [ ] #3 #3 Full-corpus cold CPU is <= 520 s for every discovered file, judged against the in-checkout baseline TASK-381.7 AC #7 records. The budget is 423.4 s measured with the gate files withheld, plus 603 files at the measured 64.6 ms/file marginal (39 s), plus an allowance of up to 7.2% of cold load for the declaration-space keying itself — 495 s central, 520 s ceiling.
- [ ] #4 #4 Full-corpus peak RSS is <= 5 GB, against 7,795.5 MB with the gate active and 4,246.9 MB with the gate files withheld.
- [ ] #5 #5 `Project.remove_file` is called zero times during `load_project` — asserted by a counter, not inferred — against 603 calls costing 370.9 s and 16,931 dependent-file re-resolutions today.
- [ ] #6 #6 On the 100-file slice used for the gate-off A/B the node set is a strict superset of today's (A-not-B = 0, +122 nodes) and the 6 false entry points the gate manufactures there are gone.
- [ ] #7 #7 A targeted test on one `createDecorator` file proves a type-position reference to `IFoo` resolves to the interface and a value-position reference to the const, and that `import type { IFoo }` and a value import of the same name select different bindings.
- [ ] #8 #8 Each existing per-language escape hatch in `ExportRegistry` — arrow-function exports (`export.ts:98-115`), Python rebinding (`:117-143`), re-export precedence (`:145-162`) — is either subsumed by the declaration-space key and deleted, or retained with a stated reason recorded in the module; none survives by accident.
- [ ] #9 #9 The drop gate in `.claude/skills/triage/scripts/detect_entrypoints.ts` fails above 1% of discovered files and prints the count and the error taxonomy rather than the first ten of 603 paths.
- [ ] #10 #9a The indexed-over-discovered ratio gate in the same file (`:400-407`) is RETAINED and re-thresholded from 0.50 to a value derived from the post-repair measured ratio; its distinct purpose — catching files never offered to the loader at all, which the drop gate cannot see because it counts only files the loader attempted and rolled back — is recorded beside it. It is not deleted.
- [ ] #11 #10 The six-number fingerprint over every discovered file is recorded in the harness as this epic's final re-baseline, with its input predicate and Ariadne commit named.

<!-- AC:END -->
