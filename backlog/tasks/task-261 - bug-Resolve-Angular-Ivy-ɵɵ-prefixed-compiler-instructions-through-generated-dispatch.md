---
id: TASK-261
title: >-
  [bug] Resolve Angular Ivy ɵɵ-prefixed compiler instructions through generated
  dispatch
status: To Do
assignee: []
created_date: '2026-04-28 12:06'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - angular-generated-instruction-call
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `other`. **Target:** `angular-generated-instruction-call`. **Observed:** 3

Angular Ivy compiler instructions (`ɵɵ`-prefixed) are dispatched through R3 identifier registry + JIT string-keyed dispatch — invisible to Ariadne.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
