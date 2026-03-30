---
id: TASK-199.12
title: "Fix: JavaScript resolver missing .jsx extension probing"
status: Done
assignee: []
created_date: "2026-03-29 12:55"
labels:
  - bugfix
  - import-resolution
  - javascript
dependencies: []
references:
  - >-
    packages/core/src/resolve_references/import_resolution/import_resolution.javascript.ts
  - >-
    packages/core/src/resolve_references/import_resolution/import_resolution.javascript.test.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bug

The JavaScript import resolver (`import_resolution.javascript.ts`) did not include `.jsx` in its extension probing candidates. When importing `./Component` where only `Component.jsx` exists, the resolver would fall back to `Component.js` instead of finding the `.jsx` file.

The TypeScript resolver already probed for `.jsx`, making this an inconsistency.

## Root Cause

The `candidates` array in `resolve_relative_javascript` only listed `.js`, `.mjs`, `.cjs` and their `index.*` variants. The fallback `valid_exts` array included `.jsx` (recognizing it as valid when already present), but the probing logic never tried `.jsx`.

## Fix

Added `${resolved_absolute}.jsx` and `path.join(resolved_absolute, "index.jsx")` to the candidates array, positioned after `.js` (matching priority order: `.js` > `.jsx` > `.mjs` > `.cjs`).

## Tests

4 tests lock in this fix:

- `resolves .jsx via extension probing`
- `prefers .js over .jsx`
- `prefers .jsx over .mjs`
- `resolves directory to index.jsx when index.js does not exist`
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed .jsx extension probing in JavaScript resolver. Added `.jsx` and `index.jsx` to the candidates array. 4 tests lock in the fix.

<!-- SECTION:FINAL_SUMMARY:END -->
