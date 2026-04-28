---
id: TASK-190.17.14
title: "triage-curator: cross-package writes, paths helper, agent prompt path update"
status: To Do
assignee: []
created_date: "2026-04-28 19:19"
labels:
  - triage-curator
  - skill-retarget
dependencies:
  - TASK-190.17.11
  - TASK-190.17.13
parent_task_id: TASK-190.17
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

The triage-curator's `finalize_run.ts` script writes generated classifier source + barrel into `packages/core/src/classify_entry_points/builtins/` post-move. This is a **cross-package write from a skill into a versioned package** — semantically different from before. Document this and harden the path resolution.

## Changes

- `.claude/skills/triage-curator/scripts/finalize_run.ts:298-308` — the orphan-cleanup block (`fs.unlink`) now operates on core paths. Update path resolution to use the new `get_permanent_slice_path()` helper from `.13` (or a sibling `get_core_builtins_dir()`) — do not hardcode the relative path.
- `.claude/skills/triage-curator/scripts/finalize_run.ts:321-329` — replace the hardcoded barrel path:
  ```ts
  // before
  const barrel_path = path.resolve(
    path.dirname(get_registry_file_path()),
    "..",
    "src",
    "auto_classify",
    "builtins",
    "index.ts"
  );
  // after
  const barrel_path = get_core_builtins_barrel_path(); // resolves to packages/core/src/classify_entry_points/builtins/index.ts
  ```
- ADD: `get_core_builtins_barrel_path()` and `get_core_builtins_dir()` helpers in `.claude/skills/triage-curator/src/paths.ts` (or wherever curator path helpers live).
- `.claude/agents/triage-curator-investigator.md:205` — update path string from `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/check_<group_id>.ts` to `packages/core/src/classify_entry_points/builtins/check_<group_id>.ts`.
- Update bug-task body templates in `render_ariadne_bug_body.ts:108-110` and `propose_backlog_tasks.ts:144` — AC checklists should now reference `registry.permanent.json` (the regenerated slice) alongside the canonical registry, not just the skill-local registry.
- Add a SKILL.md section to `.claude/skills/triage-curator/SKILL.md` documenting that curator's `finalize_run` writes core source on every run; the commit story now spans both skill and package.

## Verification

- `pnpm test` passes in `.claude/skills/triage-curator/`.
- A dry-run of `finalize_run.ts` against a representative run produces `packages/core/src/classify_entry_points/builtins/check_*.ts` and the barrel; `git diff` looks clean against the expected output.
- The investigator prompt's path reference compiles when an agent follows it (i.e., the path actually exists post-move).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 finalize_run.ts:298-308 + 321-329 use new path helpers (no hardcoded paths)
- [ ] #2 paths.ts gains get_core_builtins_barrel_path() and get_core_builtins_dir() helpers
- [ ] #3 triage-curator-investigator.md:205 path string updated to core location
- [ ] #4 render_ariadne_bug_body.ts:108-110 + propose_backlog_tasks.ts:144 reference registry.permanent.json
- [ ] #5 SKILL.md documents the cross-package write contract
- [ ] #6 Dry-run finalize_run produces expected core-side output cleanly
- [ ] #7 pnpm test passes in .claude/skills/triage-curator/
<!-- AC:END -->
