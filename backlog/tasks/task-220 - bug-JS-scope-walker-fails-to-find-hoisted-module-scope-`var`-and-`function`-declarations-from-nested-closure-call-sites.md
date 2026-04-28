---
id: TASK-220
title: >-
  [bug] JS scope walker fails to find hoisted module-scope `var` and `function`
  declarations from nested-closure call sites
status: To Do
assignee: []
created_date: '2026-04-28 09:39'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - intra-file-call-not-resolved
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `other`
**Target registry entry:** `intra-file-call-not-resolved`
**Observed count:** 16

Nested closures in JS reference module-scope `var x = function() {}` and `function x() {}` declarations, but the scope walker does not find them. Particularly common in legacy IIFE-wrapped code.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
