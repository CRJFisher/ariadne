---
id: TASK-190.19.9
title: Rename `self-repair-pipeline` skill to `triage-entrypoints`
status: Done
assignee: []
created_date: "2026-05-20 10:00"
updated_date: "2026-05-24 13:55"
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

"Self-healing pipeline" is the umbrella name for the three-skill chain (sense → curator → fix-sequencer). The first skill's prior name `self-repair-pipeline` collided with that umbrella term and obscured what the skill actually does — it triages entry-point candidates surfaced by the call-graph detector. The name `triage-entrypoints` makes the intention-tree position explicit: the skill is the triage stage for unreachable-entry-point candidates. The macro-name "self-healing pipeline" remains as the chain-level concept.

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

- `git grep "self-repair-pipeline"` returns zero matches in code, agents, rules, CLAUDE.md, and current backlog tasks. (Archived task history, commit messages, and the preserved `self-repair-pipeline-extension` labels on TASK-190.18.3 / TASK-190.18.5 still mention the old name; that is acceptable.)
- `pnpm test` passes (full suite).
- `pnpm check-permanent-rules` passes.
- `pnpm sync-permanent-rules` produces a byte-identical regeneration when run twice (the rename should not change generated content after the source-of-truth comment is regenerated once).

## Out of scope

- Renaming any sub-agent (`triage-investigator`, `triage-coordinator`, etc.) — those names are already scope-correct.
- Renaming the `known_issues/registry.json` path inside the skill folder — relative to the skill, the path is unchanged.
- Touching any v3-era references in archived backlog task history.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Directory renamed via `git mv` (history preserved on subsequent `git log --follow`)
- [x] #2 `git grep "self-repair-pipeline"` returns zero matches in code, agents, rules, root CLAUDE.md, and current (non-archived) backlog tasks
- [x] #3 `pnpm test` passes against the renamed paths
- [x] #4 `pnpm check-permanent-rules` passes
- [x] #5 Sub-agent tool allowlists reference the new `triage-entrypoints` paths
- [x] #6 The macro-name "self-healing pipeline" is retained as the chain-level concept (the `## Self-healing pipeline` section heading in the renamed README is unchanged)
<!-- AC:END -->

## Implementation Notes

### Mechanics

- `git mv .claude/skills/self-repair-pipeline .claude/skills/triage-entrypoints` (history preserved; verifiable via `git log --follow`).
- Bulk slug replacement across in-scope files: `perl -i -pe 's/self-repair-pipeline(?!-extension)/triage-entrypoints/g'`. The negative lookahead protects the preserved `self-repair-pipeline-extension` backlog labels on TASK-190.18.3 and TASK-190.18.5.
- Bulk prose replacement: `Self-Repair Pipeline` → `Triage Entrypoints`, `Self-repair pipeline` → `Triage-entrypoints`, `self-repair pipeline` → `triage-entrypoints`.
- Auto-regenerated `packages/core/src/classify_entry_points/permanent_data.ts` via `pnpm sync-permanent-rules` (only delta is the source-of-truth path comment).
- Updated the SKILL.md frontmatter `description` and the skill-package `description` to "Triage stage for entry-point candidates" rather than reusing the skill slug as a noun.

### Hand fixes post-bulk-replace

- Two user-visible curator templated strings (`propose_backlog_tasks.ts:152`, `render_ariadne_bug_body.ts:113`) re-templated to use the macro-name "self-healing pipeline" — both describe re-running the end-to-end chain on affected corpora, not the SRP skill alone.
- `triage-curator/SKILL.md` lines that had read awkwardly after the slug replace (`"the triage-entrypoints' v4..."`, `"the same identifier the triage-entrypoints emits"`) tightened to `"the triage-entrypoints skill's"` / `"the triage-entrypoints skill emits"`.
- `triage-entrypoints/SKILL.md` Dead-code guardrail section: "Orthogonal to the triage-entrypoints" → "Orthogonal to this skill"; "The triage-entrypoints does not read or write" → "This skill does not read or write".
- `propose_backlog_tasks.ts:152` checklist string also re-grammared per the macro-name fix above.
- 4 backlog/tasks bodies (190.16, 190.16.6, 206, 209) where "Running the Self-Repair Pipeline does NOT" / "Self-Repair Pipeline re-run" became awkward: tidied to "Running this skill does NOT" / "Triage-entrypoints re-run" with `skill` injected or sentence-restructured.
- `SRP` acronym occurrences (5 files in curator + entrypoints docs and types/known_issues.ts) expanded to `triage-entrypoints` in prose; Mermaid graph node ids `SRP(...)` left intact (the visible label inside the node already reads `triage-entrypoints`).

### Review pass

Reviewed via 5 opus agents (architecture, refactor, audit-explore, code, test-coverage). Two reviewers (refactor + code) failed with Cloudflare 1034 edge errors. Of the 3 successful reviews, applied fixes: restored the self-mutilated task-spec body (the bulk-replace had clobbered every rename-arrow), expanded the orphan `SRP` acronym in prose, hand-edited the 4 awkward backlog-task prose constructions, and tightened the curator SKILL.md possessives.

`pnpm test` reports 221/221 in `triage-curator`, plus the full `packages/{types,core,mcp}` suites passing. `pnpm typecheck` clean across all four projects. `pnpm sync-permanent-rules` produces a byte-identical regeneration on the second run (md5 matches before/after).
