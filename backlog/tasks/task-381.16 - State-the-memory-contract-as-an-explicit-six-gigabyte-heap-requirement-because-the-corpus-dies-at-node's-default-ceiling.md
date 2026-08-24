---
id: TASK-381.16
title: "State the memory contract as an explicit six-gigabyte heap requirement, because the corpus dies at node's default ceiling"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - memory
  - performance
  - docs
dependencies:
  - TASK-381.8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Every full-corpus run in this investigation used `--max-old-space-size=12288`, and nobody had run the corpus without the flag. A user who types `ariadne` on a 16 GB laptop either gets an entry-point report or gets `Ineffective mark-compacts near heap limit`, and which one they get depended on a flag they have no reason to know exists. That question is now answered by measurement, and the answer is that the default does not suffice.

At node's default old-space ceiling on this machine — 4,144 MB on a 16 GiB Darwin 21.6.0 box running node v22.23.2 — the repaired load OOMs after 666 s of CPU with `FATAL ERROR: Ineffective mark-compacts near heap limit`, its last GC at 4,047.7 of 4,133.9 MB, a single mark-compact of 6,178 ms recovering 0.4 MB, mutator utilisation 0.005. The live heap settles at 3,563.8 MB, so V8 is left with no mark-compact working set at all. `--max-old-space-size=6144` completes: 8,494 of 8,494 files, 474,838.4 ms of CPU (+2.6% against the 12 GB runs), peak RSS 4,172.0 MB, and fingerprints byte-identical to the 12 GB runs. Independently, the stack composed with TASK-381.11 also completes at 6144 — 507.0 s, peak RSS 5,367.4 MB, all five fingerprint hashes byte-identical to its 10 GB runs. So the contract is a floor of 6 GB, and it is a hair rather than a chasm: the shortfall is between the 4,144 MB default and the 6,144 MB that works, and it is GC working set rather than retained data.

The resolution must not be a flag Ariadne sets for itself. Setting `--max-old-space-size` from inside the CLI requires a re-exec or a `NODE_OPTIONS` hand-off — a second execution path, which the constitution forbids — and it would cover only the CLI, leaving the MCP server and the library consumer with neither the flag nor the guarantee. So the outcome of this task is a documented requirement plus a follow-up task against the measured shortfall, not a runtime workaround. Two figures belong in that documentation because they are what future memory reasoning will get wrong otherwise. The RSS-to-settled-heap ratio is not a constant: it was 2.3x before the export-gate repair (7.83 GB resident against 3.32 GB settled) and 1.17x after (4,172.0 against 3,563.8 MB), because the native tree-sitter arenas that inflated it were being fed by files that got indexed and thrown away. And peak RSS varies up to 26% run to run on identical inputs while settled heap is stable to 0.01%, so any RSS number stated as a single run's figure will flap.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A full-corpus cold load of every discovered file under vscode `src/` is run with NO `--max-old-space-size` flag and recorded as completing or not completing. MEASURED: does NOT complete. Dies after 666 s of CPU with `FATAL ERROR: Ineffective mark-compacts near heap limit` at a 4,144 MB default ceiling, last GC 4,047.7 of 4,133.9 MB, mark-compact 6,178 ms, mu 0.005.
- [ ] #2 The shortfall is recorded as a bracket rather than a guess, and the flag that closes it is measured. MEASURED: 4,144 MB fails and 6,144 MB completes — 8,494/8,494, 474,838.4 ms CPU (+2.6% vs 12,288 MB), peak RSS 4,172.0 MB, settled heap 3,563.8 MB, fingerprints byte-identical to the 12 GB runs. The composed stack with TASK-381.11 also completes at 6,144 MB: 507.0 s, peak RSS 5,367.4 MB, all five hashes byte-identical to its 10 GB runs.
- [ ] #3 NO heap flag is added anywhere in Ariadne — no re-exec, no `NODE_OPTIONS` hand-off, no CLI-only path — and the requirement is documented instead, naming the machine it was measured on (Darwin 21.6.0, 4 cores, 16 GiB, node v22.23.2), the corpus (microsoft/vscode f3fa55c3, `src/`, 8,494 discovered files) and the Ariadne commit. A follow-up task is opened against the measured shortfall: get the live heap far enough below 4,144 MB that the default ceiling has a mark-compact working set, from a measured 3,563.8 MB today.
- [ ] #4 REFUTES this epic's `<= 5 GB peak RSS at node's default heap` commitment in both halves. Peak RSS for the composed stack is 5,367.4 / 5,410.5 / 5,583.6 / 5,930.8 / 6,510.6 MB (mean 5,760.6 over 5 runs at a 10,240 MB cap), and the default heap does not run at all. The replacement contract is: explicit `--max-old-space-size >= 6144`, peak RSS <= 6.6 GB stated as a mean of >= 2 runs.
- [ ] #5 The RSS-to-settled-heap ratio is recorded as a MEASURED PAIR and not as a constant, so no future memory projection in this codebase is made from heap alone: 2.3x before the export-gate repair (7.83 GB resident / 3.32 GB settled) and 1.17x after (4,172.0 / 3,563.8 MB). The reason for the change is stated — the native tree-sitter arenas that inflated the ratio were being fed by 603 files that were indexed and then discarded.
- [ ] #6 Any RSS criterion anywhere in this epic is a mean over >= 2 independent runs, because peak RSS varies up to 26% run to run on the same arm and inputs (4,430.4 vs 5,952.5 MB on one control arm; 4,194.1 vs 5,040.5 on the repair) while the settled post-GC heap is stable to 0.01%.
- [ ] #7 The 6 GB floor is stated for the `src/` corpus only, with the repo-root figure recorded beside it: pointed at the repository root (12,654 discovered files) the same stack peaks at 7,492.8 MB with a 12,288 MB cap, so 6,144 MB is NOT known to be sufficient there and the documented requirement must say which corpus it holds for.

<!-- AC:END -->
