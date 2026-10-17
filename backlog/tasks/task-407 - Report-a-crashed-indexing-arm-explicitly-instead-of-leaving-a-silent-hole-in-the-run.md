---
id: TASK-407
title: >-
  Report a crashed indexing arm explicitly instead of leaving a silent hole in
  the run
status: To Do
assignee: []
created_date: "2026-10-17 21:01"
labels:
  - indexing
  - triage
  - crash
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A triage or benchmark run that indexes a file which kills the process — a native crash such as the SIGSEGV TASK-406 removed — loses the whole arm. Indexing runs on worker threads, and a native fault in any thread takes the process down with it, so neither `load_project`'s `try/catch` nor the dispatcher's worker-restart path ever sees it. The arm leaves no measurement row and no message naming the file; the run reads as an arm that "did not finish", and finding the culprit means bisecting the corpus by hand, as TASK-406's investigation did.

After this task a crashed arm is reported as crashed, naming the project and the file whose indexing was in flight, and the rest of the run carries on.

## Findings

- `dispatch_to_workers.ts` already tracks each worker's in-flight inputs (`PoolWorker.in_flight`), but that state lives in the dying process.
- `arm_result_file.ts` treats a result file without a row as an arm that did not finish; it cannot tell a crash from an interrupted run.
- A durable record of the in-flight file, written before each file is indexed and cleared after, is what lets whatever survives the process (the arm runner, or the next run) name the file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A native crash while indexing a file is reported with the project and the in-flight file named, rather than as an unfinished arm
- [ ] #2 The other arms of the run complete and report normally
- [ ] #3 A regression test simulates a worker that dies mid-file and asserts the report names that file
<!-- AC:END -->
