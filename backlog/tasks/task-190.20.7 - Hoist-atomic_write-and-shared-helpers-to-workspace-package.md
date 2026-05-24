---
id: TASK-190.20.7
title: >-
  Hoist atomic_write + tsx-invocation guard + errors.ts into a shared
  workspace package; drop the cross-skill deep import in finalize_run.ts
status: To Do
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - triage-entrypoints
  - architecture
  - shared-package
dependencies: []
parent_task_id: TASK-190.20
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Two adjacent skills (`triage-curator` and `triage-entrypoints`) each
maintain their own copy of several tiny helpers, and one skill reaches
across the boundary with deep relative imports:

1. **`src/atomic_write.ts`** exists in both skills. The curator's copy
   carries a comment that explicitly labels itself a "Mirror" of the
   triage-entrypoints copy and instructs future editors to keep them in
   sync. This is precisely the kind of compatibility shim the project
   constitution forbids. The classifier-lifecycle contract requires both
   writers (curator + reconciler) to use the _same_ helper; duplicated
   "mirrors" defeat the guarantee.

2. **tsx-invocation guard** (`src/require_node_import_tsx.ts`,
   imported by every CLI script in both skills) is duplicated under the
   same name.

3. **`src/errors.ts`** — a 7-line `error_code(err)` helper duplicated
   identically.

4. **Cross-skill deep imports.** `scripts/finalize_run.ts:30-31` reaches
   into `../../triage-entrypoints/scripts/render_unsupported_features.js`
   and `.../sync_permanent_rules.js`. Paths were updated post-rename in
   190.19.9 but the import shape remains a sibling-skill leak: if
   triage-entrypoints renames or moves these scripts, the curator
   silently breaks.

## Scope

Create a small shared package (or top-level shared directory) for the
helpers used by multiple skills:

- Choose a location: `packages/skill-shared/` (or
  `.claude/skills/_shared/`, or fold into `@ariadnejs/types` as a
  utilities sub-export). The first option matches the workspace pattern;
  the last avoids a new package entirely. Decide and document in the
  Implementation Notes.

- Move and import-update:

  - `atomic_write.ts` (with its `atomic_write_file` export)
  - `require_node_import_tsx.ts` (or rename to `enforce_node_runtime.ts`
    per the IA review's earlier recommendation — optional)
  - `errors.ts` (the `error_code` helper)

- Delete the mirrored copies in both `.claude/skills/triage-curator/src/`
  and `.claude/skills/triage-entrypoints/src/`.

For the cross-skill deep imports in `finalize_run.ts`:

- Either promote `render_unsupported_features` and `sync_permanent_rules`
  into a documented shared library that both skills consume, **or**
  expose them as a small public API surface from triage-entrypoints
  (e.g. `index.ts` exports) and import via that. The deep
  `../../triage-entrypoints/scripts/...` path must not survive.

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 No file in `.claude/skills/triage-curator/src/` or
      `.claude/skills/triage-entrypoints/src/` carries a `// Mirror of` (or
      equivalent) comment on a duplicated helper
- [ ] #2 `atomic_write_file`, `error_code`, and the tsx-invocation guard
      each have one source-of-truth file in the repo; both skills import
      from that location
- [ ] #3 `grep -rn "from \"\\.\\./\\.\\./triage-entrypoints/" .claude/skills/triage-curator/` returns no hits
- [ ] #4 `pnpm test` is green in both skills
- [ ] #5 `pnpm test` is green at the workspace root (if a new package
    was added)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

Touches both skills' source trees. Coordinate with any in-flight branches
in `triage-entrypoints`. Smaller than the full IA sub-folder reorg
deferred from 190.19 — this is just the three helpers + the two
cross-skill imports.

If a separate package adds CI / dependency-graph overhead, the
`@ariadnejs/types` sub-export route is acceptable; `error_code` and
`atomic_write_file` are not type definitions but adding them under a
`@ariadnejs/types/util` entry-point is a cheap shortcut.
