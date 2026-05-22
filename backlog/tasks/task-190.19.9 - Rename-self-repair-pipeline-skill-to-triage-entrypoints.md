---
id: TASK-190.19.9
title: Rename `self-repair-pipeline` skill to `triage-entrypoints`
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - triage-entrypoints
  - srp-redesign
  - rename
dependencies:
  - TASK-190.19.8
parent_task_id: TASK-190.19
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

"Self-healing pipeline" is the umbrella name for the three-skill chain (SRP → curator → fix-sequencer). The first skill's current name `self-repair-pipeline` collides with that umbrella term and obscures what the skill actually does — it triages entry-point candidates surfaced by the call-graph detector. Renaming to `triage-entrypoints` makes the intention-tree position explicit: the skill is the triage stage for unreachable-entry-point candidates. The macro-name "self-healing pipeline" stays as the chain-level concept.

## Scope

### Directory rename

- `git mv .claude/skills/self-repair-pipeline/ .claude/skills/triage-entrypoints/` — preserves history.

### Code sweep

Update every reference to the old slug. Use `git grep -l "self-repair-pipeline"` to enumerate; the touch surface is roughly:

- TypeScript imports across the repo: `from "../self-repair-pipeline/..."` → `from "../triage-entrypoints/..."`
- `package.json` scripts (root + skill-local) referencing the old path
- Sub-agent definitions in `.claude/agents/*.md` invoking `node --import tsx .claude/skills/self-repair-pipeline/scripts/...`
- Sub-agent tool allowlists (`Bash(node --import tsx .claude/skills/self-repair-pipeline/scripts/...:*)`)
- CI workflow files (`.github/workflows/*.yml`) referencing the path
- `scripts/check-commit-message.ts` / `setup-hooks.sh` / other repo-level tooling
- `pnpm` workspace config if it lists the skill

### Doc + rule sweep

- `.claude/rules/classifier-lifecycle.md` — every `.claude/skills/self-repair-pipeline/...` path reference
- `.claude/skills/triage-curator/README.md` cross-references
- `.claude/skills/triage-curator/SKILL.md` cross-references
- `backlog/tasks/task-190.18*.md` (umbrella + sub-tasks) — path references in scope/AC blocks
- `backlog/tasks/task-190.19*.md` — same
- `CLAUDE.md` (root) — any mention of `self-repair-pipeline`
- Bundled `permanent_data.ts` regeneration path if it hardcodes the skill folder

### Macro-name preserved

The chain-level term "self-healing pipeline" is intentionally retained:

- The `## Self-healing pipeline` section in the renamed README (was `.claude/skills/self-repair-pipeline/README.md`, now `.claude/skills/triage-entrypoints/README.md`) keeps its heading.
- Backlog labels (`self-repair`, `self-repair-pipeline-extension`) on existing tasks are NOT renamed in this task — they refer to the macro-concept and can be revisited separately if desired.

### Verification

- `git grep "self-repair-pipeline"` returns zero matches in code, agents, rules, CLAUDE.md, and current backlog tasks. (Archived task history and commit messages may still mention the old name; that is acceptable.)
- `pnpm test` passes (full suite).
- `pnpm check-permanent-rules` passes.
- `pnpm sync-permanent-rules` produces a byte-identical regeneration when run twice (the rename should not change generated content).

## Out of scope

- Renaming any sub-agent (`triage-investigator`, `triage-coordinator`, etc.) — those names are already scope-correct.
- Renaming the `known_issues/registry.json` path inside the skill folder — relative to the skill, the path is unchanged.
- Touching any v3-era references in archived backlog task history.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Directory renamed via `git mv` (history preserved on subsequent `git log --follow`)
- [ ] #2 `git grep "self-repair-pipeline"` returns zero matches in code, agents, rules, root CLAUDE.md, and current (non-archived) backlog tasks
- [ ] #3 `pnpm test` passes against the renamed paths
- [ ] #4 `pnpm check-permanent-rules` passes
- [ ] #5 Sub-agent tool allowlists reference the new `triage-entrypoints` paths
- [ ] #6 The macro-name "self-healing pipeline" is retained as the chain-level concept (the `## Self-healing pipeline` section heading in the renamed README is unchanged)
<!-- AC:END -->
