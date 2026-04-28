---
id: TASK-311
title: '[bug] Resolve bundler-substituted module imports to filler file targets'
status: To Do
assignee: []
created_date: '2026-04-28 12:13'
labels:
  - ariadne-core
  - false-positive-root-cause
  - root-cause-import_resolution
  - bundler-module-path-substitution
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Root cause:** `import_resolution`. **Target:** `bundler-module-path-substitution`. **Observed:** 1

esbuild onResolve / webpack alias substitution rewrites import paths at build time. Resolver should follow these substitutions.

Source: triage-curator sweep.
<!-- SECTION:DESCRIPTION:END -->
