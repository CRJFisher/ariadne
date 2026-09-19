---
id: TASK-398
title: >-
  Size an arm's heap from the bytes of source it will hold, not from how many
  files there are
status: To Do
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

- [ ] #1 The byte size of the discovered set is measured for all ten evidence corpora and reported against the recorded peak RSS, with the residual spread stated.
- [ ] #2 `required_heap_mb` takes the quantity that predicts peak memory, and sits above every measured arm including microsoft/TypeScript at 3,623 MB and pandas at 2,183 MB.
- [ ] #3 The parent's sizing and the child's refusal read one function, and a test pins them as the same value for every recorded file set.
- [ ] #4 The cap an arm is given is re-derived from the measured requirement, and `RECORDED_MEMORY_CONTRACT` is restated from it.
- [ ] #5 The ten corpora are re-run: every call-edge and raw-entry-point fingerprint is byte-identical to `RECORDED_CORPUS_RESOLUTION`, and only the memory columns move.

<!-- AC:END -->
