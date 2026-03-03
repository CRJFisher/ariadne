---
id: task-193
title: Fix self-repair pipeline data writes blocked by sandbox
status: To Do
assignee: []
created_date: '2026-03-03'
labels:
  - bug
  - sandbox
  - self-repair-pipeline
dependencies: []
---

## Description

When spinoff worktrees run the pre-commit hook (`scripts/run_all_tests.sh`), tests in
`.claude/skills/self-repair-pipeline/src/known_entrypoints.test.ts` fail with `EPERM`.
The test writes a temp JSON file into `.claude/skills/self-repair-pipeline/known_entrypoints/`
which is in the sandbox `denyWithinAllow` list — correctly protecting skill *code* from agent
modification, but inadvertently blocking all data *writes* from the skill.

The root cause is architectural: mutable runtime data (registry, analysis output, triage state,
patterns) is co-located with skill code in `.claude/skills/`. Moving it to a dedicated state
directory outside `.claude/skills/` fixes the test failure and also fixes production writes in
any sandboxed context.

## Acceptance Criteria

- [ ] `known_entrypoints.test.ts` passes in a sandboxed spinoff worktree (no EPERM)
- [ ] All data writes go to `.claude/self-repair-pipeline-state/` instead of `.claude/skills/self-repair-pipeline/`
- [ ] Existing `known_entrypoints/core.json` data is migrated to the new location via `git mv`
- [ ] Ephemeral state dirs (`analysis_output/`, `triage_state/`) are gitignored at the new location
- [ ] All existing tests pass

## Implementation Plan

### Step 1 — Create shared paths module

Create `.claude/skills/self-repair-pipeline/src/paths.ts`:

```typescript
import path from "path";
import { fileURLToPath } from "url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const STATE_DIR = path.resolve(SKILL_DIR, "../../self-repair-pipeline-state");

export const REGISTRY_DIR         = path.join(STATE_DIR, "known_entrypoints");
export const ANALYSIS_OUTPUT_DIR  = path.join(STATE_DIR, "analysis_output");
export const TRIAGE_STATE_DIR     = path.join(STATE_DIR, "triage_state");
export const TRIAGE_PATTERNS_FILE = path.join(STATE_DIR, "triage_patterns.json");
```

Path: `src/paths.ts` → `..` = skill root → `../..` = `.claude/` → `../../self-repair-pipeline-state` = `.claude/self-repair-pipeline-state/` (writable, outside denyWithinAllow)

### Step 2 — Update each file to import from paths module

Five files write into `.claude/skills/self-repair-pipeline/` and need updating:

| File | Import path | Constants to replace |
|------|-------------|----------------------|
| `src/known_entrypoints.ts` | `./paths` | local `REGISTRY_DIR` |
| `src/analysis_io.ts` | `./paths` | local analysis output path |
| `scripts/prepare_triage.ts` | `../src/paths` | `TRIAGE_STATE_DIR` |
| `scripts/finalize_triage.ts` | `../src/paths` | `TRIAGE_STATE_DIR`, `TRIAGE_PATTERNS_FILE` |
| `scripts/triage_loop_stop.ts` | `../src/paths` | `TRIAGE_STATE_DIR` |

### Step 3 — Migrate committed data

`known_entrypoints/core.json` is tracked in git. Move with `git mv`:

```bash
mkdir -p .claude/self-repair-pipeline-state/known_entrypoints
git mv ".claude/skills/self-repair-pipeline/known_entrypoints/core.json" \
       ".claude/self-repair-pipeline-state/known_entrypoints/core.json"
```

### Step 4 — Update .gitignore

Add to `.gitignore`:

```
.claude/self-repair-pipeline-state/analysis_output/
.claude/self-repair-pipeline-state/triage_state/
```

`known_entrypoints/` stays tracked (intentional committed data).

## Files to Create/Modify

1. `.claude/skills/self-repair-pipeline/src/paths.ts` — **new**
2. `.claude/skills/self-repair-pipeline/src/known_entrypoints.ts`
3. `.claude/skills/self-repair-pipeline/src/analysis_io.ts`
4. `.claude/skills/self-repair-pipeline/scripts/prepare_triage.ts`
5. `.claude/skills/self-repair-pipeline/scripts/finalize_triage.ts`
6. `.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts`
7. `.gitignore`
8. `.claude/self-repair-pipeline-state/known_entrypoints/core.json` (moved from old location)
