---
id: TASK-398
title: >-
  Size an arm's heap from the bytes of source it will hold, not from how many
  files there are
status: Done
assignee: []
labels:
  - benchmark
  - measurement
dependencies:
  - TASK-376.18
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A corpus the harness refuses is a corpus nobody measures. `required_heap_mb` decides that refusal from the file count alone, and the file count does not predict what a load holds — so the guard refuses corpora that fit and over-provisions the ones it admits.

microsoft/TypeScript is the proof. Under the previous fit it needed 28,096 MB, which the parent refused on a 32,768 MB box, and it sat in `not_measured` through the whole of TASK-376 — the only one of the ten evidence corpora with no row on either side of the epic. Measured, it peaks at **3,623 MB**: less than angular, which holds 6,345 files to TypeScript's 19,763. The guard was wrong by a factor of eight, in the direction that costs a measurement.

## Root cause

Peak memory tracks how much source a load holds. File count is a proxy for that only when files are of similar size, and across the ten corpora they are not:

| Corpus | Files | Peak RSS | MB per file |
| --- | ---: | ---: | ---: |
| microsoft/TypeScript | 19763 | 3623 | 0.18 |
| angular/angular | 6345 | 4447 | 0.70 |
| rust-lang/rust | 3516 | 3011 | 0.86 |
| django/django | 3012 | 1749 | 0.58 |
| pandas-dev/pandas | 1510 | 2183 | 1.45 |
| tokio-rs/tokio | 790 | 465 | 0.59 |
| mochajs/mocha | 534 | 271 | 0.51 |
| launchbadge/sqlx | 459 | 413 | 0.90 |
| expressjs/express | 141 | 250 | 1.78 |

An order of magnitude between TypeScript's 0.18 MB/file and express's 1.78. TypeScript's bulk is small conformance fixtures under `tests/cases/`; pandas at 1,510 files costs more than django at 3,012 because its modules are large. No line through the file count can be both safe and tight over that spread, so `heap_requirement.ts` currently ships the safe one and over-provisions by 3.1x on TypeScript and 1.05x on pandas.

## Work plan

1. Establish the relationship against bytes rather than files: sum the byte size of the discovered set and plot it against the recorded peak RSS for all ten corpora. `measure_file_sizes` (`benchmark_corpus_load.ts`) already stats a file list for the `descending_size` ingest order, and the parent already walks the corpus once in `discover_corpus`, so the sum is available at the point the sizing decision is made.
2. Re-fit `required_heap_mb` on bytes, keeping it a ceiling over every measured arm. Take the residual spread seriously before tightening: if bytes explain peak RSS no better than files do, record that and keep the generous ceiling rather than shipping a tighter guess.
3. Keep the parent and the child reading one function, which is what `heap_requirement.ts` exists for.
4. Decide what the arm's cap should be once the requirement is honest. A 14,288 MB cap over a load that peaks at 3,623 MB delays collection and inflates RSS; `RECORDED_MEMORY_CONTRACT` states the contract a user without a flag gets, and it should be restated from whatever this step measures.
5. Re-record the affected rows. Changing a cap changes `heap_cap_mb` and `peak_rss_mb` on every future row; it cannot change a fingerprint or a taxonomy, and the re-run must show that it does not.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 The byte size of the discovered set is measured for all ten evidence corpora and reported against the recorded peak RSS, with the residual spread stated.
  Evidence: bytes summed from `fs.stat` over each predicate's discovery walk, in MiB against the recorded peak RSS in MB — express 0.52 / 250, mocha 1.34 / 271, sqlx 2.52 / 413, tokio 5.35 / 465, django 19.51 / 1,749, pandas 22.23 / 2,183, angular 36.68 / 4,447, TypeScript 38.54 / 3,623, rust 50.40 / 3,011; celery (3.39 MiB) had no recorded peak and measures 540 MB in this step's control arm. Over those nine arms plus vscode's `src/` (104.85 MiB / 5,803) and repository root (148.70 MiB / 8,540), peak RSS correlates **0.96 with bytes and 0.70 with file count**. The residual spread is real: peak RSS per MiB is 55 (vscode `src/`), 60 (rust), 90 to 98 (django, TypeScript, pandas) and 121 (angular), and 87 to 479 on the five small corpora where a fixed cost of a few hundred MB dominates, so bytes predict peak memory far better than files without predicting it exactly. Recorded in `RECORDED_HEAP_REQUIREMENT.rows` and the doc comments of `heap_requirement.ts` and `recorded_heap_requirement.ts`.
- [x] #2 `required_heap_mb` takes the quantity that predicts peak memory, and sits above every measured arm including microsoft/TypeScript at 3,623 MB and pandas at 2,183 MB.
  Evidence: `required_heap_mb(offered_bytes)` is `ceil(320 + 115 * MiB)`, the tightest line 2% above all eleven measured arms. It gives TypeScript 4,753 MB (1.31x its 3,623 MB peak), pandas 2,876 MB (1.32x), angular 4,539 MB (1.02x, where it binds), vscode `src/` 12,379 MB (2.13x). Over-provision spans 1.02x to 2.13x across the eleven arms; the file-count fit spanned 0.92x to 6.53x and sat under vscode's repository root. Per the work plan the spread was taken seriously rather than tightened past it: because angular's 121 MB/MiB binds the line, the harness over-provisions vscode's `src/` by 2.0x its 6,144 MB floor, and that is stated in the function's comment and in the contract. `heap_requirement.test.ts` pins the requirement above every recorded arm and over-provision per arm.
- [x] #3 The parent's sizing and the child's refusal read one function, and a test pins them as the same value for every recorded file set.
  Evidence: the parent (`spawn_sized_arm` in `run_load_benchmark.ts`) and the child (`assert_heap_is_large_enough` in `benchmark_corpus_load.ts`) both take `select_offered_files` -> `measure_file_sizes` -> `total_bytes`, and read `required_heap_mb` (the child through `heap_holds`). `heap_requirement.test.ts` › "never grants a cap its own child refuses, for every recorded file set" asserts `heap_holds(bytes, heap_mb_for(bytes))` for all eleven recorded sets, and a temp-directory test pins the byte sum for a whole set and a prefix slice.
- [x] #4 The cap an arm is given is re-derived from the measured requirement, and `RECORDED_MEMORY_CONTRACT` is restated from it.
  Evidence: the cap is `max(2048, 1.25 * required_heap_mb(bytes))`, so TypeScript's falls from 14,288 to 5,942 MB, angular's from 11,652 to 5,674 MB and django's from 5,820 to 3,205 MB; rust's (6,702 to 7,645) and pandas's (3,191 to 3,595) rise because they hold more bytes than their file counts implied. The 1.25 headroom is kept: the requirement is already a ceiling over RSS, so the cap is 1.25x over it, and every re-run completed under it. Measured effect of a cap far above the load: on one tree, TypeScript's peak RSS falls 24% (3,246 to 2,455 MB) as its cap falls from 14,336 to 5,990 MB and angular's 9%, while rust's rises 13% as its cap rises, so the cap inflates RSS but does not alone decide it. `RECORDED_MEMORY_CONTRACT.harness_sizing` states what the harness gives vscode's `src/` (109,947,285 bytes: 12,379 MB required, 15,474 MB cap) beside its unchanged 6,144 MB floor, and the harness's sizing basis in `no_heap_flag_in_ariadne`; `recorded_memory_contract.test.ts` derives both figures from `heap_requirement.ts`. The README's "Running it" paragraph is restated to match. vscode itself was not re-run.
- [x] #5 The ten corpora are re-run: every call-edge and raw-entry-point fingerprint is byte-identical to `RECORDED_CORPUS_RESOLUTION`, and only the memory columns move.
  Evidence: re-run with `--baseline` on `13c237d9`, each corpus beside a control arm of the same tree under the previous fit's cap as its flag. All ten controls match their re-run on every one of the seven fingerprint components and the file counts; only `heap_cap_mb` and `peak_rss_mb` (and CPU, which varies run to run) differ — `RECORDED_HEAP_REQUIREMENT.rerun`, pinned by `recorded_heap_requirement.test.ts`. **The literal comparison against `RECORDED_CORPUS_RESOLUTION` does not hold, and is not a sizing effect**: only express matches it; the other nine differ in call edges and unresolved calls (and eight in raw entry points) because TASK-376.25, .26, .28, .29, .30 and .23 landed after that record was taken at `038b7daa`; the control arms, on the same tree under the previous cap, report the same fingerprints as the re-run, which is what isolates the cap. That record was not rewritten. Peak RSS under the new caps: angular 2,803, rust 3,295, TypeScript 2,455, django 1,586, pandas 1,890, tokio 494, celery 498, sqlx 410, mocha 290, express 267 MB, each below `required_heap_mb` for its file set.

<!-- AC:END -->

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Final Summary

**What a user can now do.** Measure a corpus the previous guard refused. An arm's required heap is `ceil(320 + 115 * MiB of discovered source)` and its cap is `max(2048, 1.25 * required)`, so microsoft/TypeScript needs 4,753 MB (peak 3,623 MB) instead of the 28,096 MB the file-count fit demanded, and sits above every one of the eleven measured arms. Parent and child read one function, `required_heap_mb`, and a test pins them to the same value for every recorded file set. `RECORDED_MEMORY_CONTRACT` and the README state what a user without a heap flag is given, vscode's `src/` included.

**What did not change.** Any fingerprint or taxonomy. Each corpus re-ran beside a control of the same tree under the previous cap: all seven fingerprint components and the file counts match on all ten; only `heap_cap_mb` and `peak_rss_mb` moved.

**Known limit.** Criterion #5's literal comparison against `RECORDED_CORPUS_RESOLUTION` does not hold, and the criterion's evidence says so: nine corpora differ from that record because TASK-376.23, .25, .26, .28, .29 and .30 landed after it was taken. The same-tree control arms isolate the cap, which is what the criterion exists to show.

**Landed in:** `13c237d9` (bytes-fitted sizing), `bc4bfc5d` (the ten re-runs and the restated contract), `aa4ae19a` (the ticked criteria); merged by `0dceea99`.

<!-- SECTION:FINAL_SUMMARY:END -->
