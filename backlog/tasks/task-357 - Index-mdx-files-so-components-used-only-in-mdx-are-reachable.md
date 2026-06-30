---
id: TASK-357
title: Index `.mdx` files so components used only in MDX are reachable
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - indexer
  - coverage
dependencies: []
references:
  - packages/core/src/project/file_loading.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`SUPPORTED_EXTENSIONS` in `file_loading.ts` includes `.ts/.tsx/.js/.jsx` but not
`.mdx`, so MDX files are neither greped nor parsed. A component whose only callers
live in `.mdx` files is therefore mislabeled as having no textual callers and
surfaces as an unreachable entry point.

Surfaced by TASK-190.30.1's registry audit, which removed the
`jsx-mdx-component-usage` suppressor classifier as a fixable coverage gap rather
than a permanent limitation. Closing this requires extending extension coverage so
MDX component usages register as references.

### Origin (deleted classifier row this tracks)

`jsx-mdx-component-usage` (builtin, observed in typeorm).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `.mdx` files are indexed (component usages in MDX register as references), so a
      component referenced only from MDX is not flagged as an unreachable entry point.
- [ ] Regression test covers an MDX-only component usage.

<!-- AC:END -->
