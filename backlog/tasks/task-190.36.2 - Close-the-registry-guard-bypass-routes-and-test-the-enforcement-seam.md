---
id: TASK-190.36.2
title: "Close the registry-guard bypass routes and test the enforcement seam"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
  - classifier-lifecycle
parent_task_id: TASK-190.36
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Resolves the review's one CRITICAL. The registry write-guard's Bash detection
matches only four JS write tokens
(`writeFileSync|appendFileSync|writeFile|appendFile`,
`.claude/skills/triage/src/registry_write_guard.ts:53`), while
`settings.local.json` carries standing `Bash(python3:*)`, `Bash(node:*)`,
`Bash(node -e:*)`, `Bash(.venv/bin/python:*)` allow-rules under
`defaultMode: acceptEdits`. A `python3 -c "open('<registry>','w')"` or
`node -e "require('fs').cpSync(...)"` therefore auto-accepts today — an
unattended agent can silently overwrite the permanent-limitations catalog,
which mis-classifies every future triage run. The guard's enforcement seam
(hook wrapper `main()` with its fail-open catch, and the `settings.json:19`
`Write|Edit|Bash` matcher) has zero test coverage: dropping `Bash` from the
matcher would disable the checkpoint with every test green.

Land this before the next unattended pipeline run.

### Work

1. **Extend the write-construct detection** in
   `registry_write_guard.ts` (`BASH_WRITE_PATTERNS`):
   - JS tokens: add `cpSync|copyFileSync|renameSync|rmSync|createWriteStream`.
   - Python open-modes: `open(...)`/`io.open(...)` in the same pipeline
     segment as `registry.json` with a write mode (`'w'`, `'a'`, `'r+'`);
     a read-mode or modeless `open` stays `pass`.
   - Perl: `open` with `>`/`>>` redirection targeting `registry.json`.
   - Keep the existing `[^|;&]*` single-segment anchor.
2. **Extend the reconcile runner alternation** (`:77`): add `bun` to the
   explicit runner list and a command-position bare-path clause matching
   `./reconcile_registry.ts` / absolute-path exec, without firing on
   `cat`/`grep` of the same file.
3. **Seam integration test** (new
   `.claude/skills/triage/src/registry_write_guard_seam.test.ts`; triage is a
   vitest workspace and the hook is reachable by relative path):
   - Spawn the actual hook (`node --import tsx
.claude/hooks/registry_write_guard.ts`) with synthetic stdin; assert
     `hookSpecificOutput.permissionDecision === "ask"` for a registry `Write`,
     empty stdout for an ordinary file, and exit 0 + empty stdout on malformed
     stdin (the deliberate fail-open contract).
   - Parse `.claude/settings.json` and assert the `PreToolUse` entry wiring
     `registry_write_guard.ts` has a matcher containing `Write`, `Edit`, and
     `Bash`.
4. **Narrow `settings.local.json`** (human-run, machine-local; ships no code):
   drop `Bash(xargs sed:*)` — the one bypass the guard structurally cannot see
   (filenames pass via stdin) — plus the dead rules (`:102-103` loop
   fragments, `:106 Bash(/tmp/advance_state.ts:*)`, `:135` malformed
   `Write(//…self-repair-pipeline/**)`). The broad `python3`/`node` runner
   allows stay, defensible only because steps 1–2 make the guard catch what
   they would let through. Coordinate this edit with TASK-190.36.6 so
   `settings.local.json` is touched once.
5. **Decide the backlog boundary by narrowing the prose** (no AST test).
   `export_to_backlog.ts` writes distinct per-task files and
   `graduate_group_docs.ts` renames distinct files — there is no shared-file
   race for structural enforcement to protect, so an AST-walk for backlog
   paths would guard a non-hazard (surplus code). The truthful claim:
   "`export_to_backlog.ts` is the only writer of `backlog/tasks/*.md` cards;
   `graduate_group_docs.ts` moves graduated comprehension docs alongside
   them." Hand this exact wording to TASK-190.36.7, which owns the final
   prose (currently false at `plan/SKILL.md:213`,
   `prioritize/SKILL.md:3,29,128`, `export_to_backlog.ts:46`).

Constraint (from `classifier-lifecycle.md`, Permissions): this task narrows
and tests; it must not broaden the permission surface into any standing
allow-rule for registry writes, nor weaken the hook.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] Guard tests assert `ask` on `node -e` cpSync/renameSync/rmSync/
      createWriteStream, python write-mode `open`, and perl `>` open against
      the registry path — and `pass` on read-mode equivalents.
- [ ] Guard tests assert `ask` on `bun reconcile_registry.ts …` and
      `./reconcile_registry.ts …`, and `pass` on `cat`/`grep` of the script.
- [ ] The seam test pipes real stdin through the actual hook file and asserts
      the ask/pass/fail-open triple; a second assertion pins the
      `Write|Edit|Bash` matcher in `.claude/settings.json`.
- [ ] `settings.local.json` no longer contains `Bash(xargs sed:*)` or the four
      dead/stale rules.
- [ ] The backlog-boundary wording (two named writers) is recorded for
      TASK-190.36.7; no backlog AST test is added.

<!-- AC:END -->
