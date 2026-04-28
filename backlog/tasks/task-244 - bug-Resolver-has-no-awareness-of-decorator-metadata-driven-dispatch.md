---
id: TASK-244
title: '[bug] Resolver has no awareness of decorator-metadata-driven dispatch'
status: To Do
assignee: []
created_date: '2026-04-28 12:04'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-other
  - framework-lifecycle-dispatch
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause category:** `other`
**Target registry entry:** `framework-lifecycle-dispatch`
**Observed count:** 6

NestJS / Angular / Nest microservices use decorators (`@Get`, `@Post`, `@MessagePattern`, etc.) to register methods for runtime dispatch. The resolver does not synthesize call edges for decorator-metadata patterns.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
