---
id: TASK-190.36.2
title: "Close the registry-guard bypass routes and test the enforcement seam"
status: Done
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

- [x] Guard tests assert `ask` on `node -e` cpSync/renameSync/rmSync/
      createWriteStream, python write-mode `open`, and perl `>` open against
      the registry path — and `pass` on read-mode equivalents.
- [x] Guard tests assert `ask` on `bun reconcile_registry.ts …` and
      `./reconcile_registry.ts …`, and `pass` on `cat`/`grep` of the script.
- [x] The seam test pipes real stdin through the actual hook file and asserts
      the ask/pass/fail-open triple; a second assertion pins the
      `Write|Edit|Bash` matcher in `.claude/settings.json`.
- [ ] `settings.local.json` no longer contains `Bash(xargs sed:*)` or the four
      dead/stale rules. _Human-run (machine-local, ships no code): the harness
      self-modification classifier blocks agent edits to settings files; the
      five rules to delete are listed under Implementation Notes._
- [x] The backlog-boundary wording (two named writers) is recorded for
      TASK-190.36.7; no backlog AST test is added.

<!-- AC:END -->

## Implementation Notes

### High-level summary

The registry write-guard's Bash detection covers the interpreter-write
surface that the machine-local `Bash(python3:*)`/`Bash(node:*)` allow-rules
would otherwise auto-accept. `BASH_WRITE_PATTERNS`
(`.claude/skills/triage/src/registry_write_guard.ts`) matches five construct
families bound to the registry path within a single pipeline segment: shell
redirects/tee/sed -i/mv-cp-rm/git checkout-restore (pre-existing), node fs
sync tokens (writeFileSync family plus cpSync, copyFileSync, renameSync,
rmSync, createWriteStream), call-shaped move/copy/delete verbs shared by
node's async fs API and python's shutil/os modules (catching the
temp-file + `os.replace` atomic-write idiom), pathlib
`write_text`/`write_bytes`, and python/perl `open` with a write mode
(`'w'`/`'a'`/`'x'`/`'r+'` for python, `>`/`>>` for perl). Read shapes pass by
construction: the interpreter patterns exclude `)` from their spanning
classes so a mode or verb cannot pair with a registry path from an earlier,
already-closed call — a pure read followed by an unrelated quoted `'w'`, or a
multiline read-registry-then-write-elsewhere one-liner, stays silent.
`RECONCILE_EXECUTION` recognizes write-mode `reconcile_registry.ts` runs
under node/npx/tsx/pnpm/bun/deno/yarn and as a command-position bare-path
exec (`./reconcile_registry.ts`, absolute path), while `cat`/`grep` of the
script pass.

The enforcement seam has its own integration test
(`registry_write_guard_seam.test.ts`): it spawns the actual hook file
(`.claude/hooks/registry_write_guard.ts`) over real stdin and asserts the
ask/pass/fail-open triple, and it pins the `Write|Edit|Bash` PreToolUse
matcher in `.claude/settings.json` — dropping `Bash` from the matcher now
fails a test instead of silently disabling the checkpoint.

### Review round

A six-lens review (behavioral, bypass-hunt, contracts, test-quality,
completeness, cold-read) confirmed nine verified gaps that the initial
implementation missed, all fixed and pinned by tests: pathlib
`write_text`, node async twins (`fs.rm`/`rename`/`copyFile`), python
`shutil.move`/`os.replace`/`os.remove`, the `deno` runner, python
`'x'` create mode, and two false-asks on reads (a closed `open()` call
followed by an unrelated quoted `'w'`; a multiline read-then-write-other).
The fix-diff re-review then caught one bug in the fixes themselves: the
call-verb pattern's `)` exclusion defeated the nested-source atomic-replace
shape (`os.replace(os.path.join(...), <registry>)`); the call-verb span
keeps `)` allowed — the registry is the destination argument there — while
the python/perl `open` patterns keep the exclusion. A proposed `yarn`
runner alternative was dropped as dead weight: yarn always delegates
through a runner token (`node`/`tsx`) the alternation already matches.
The seam test's fail-open case exercises `parse_stdin`'s null return — the
input-facing layer; the wrapper's outer try/catch guards environmental
crashes (EPIPE, unwritable log) no stdin payload can trigger, documented in
the test.

Noted, not actioned (accepted lexical-guard trade-offs): `cpSync`/`shutil.copy`
FROM the registry (a read-side backup) asks — consistent with the
pre-existing shell `cp` behavior; backtick-wrapped bare-path exec and
mode-first kwarg `open(mode='w', file=…)` are adversarial-tail shapes the
harness permission classifier covers.

### Outstanding human-run step (AC4)

Delete these five rules from `.claude/settings.local.json` `permissions.allow`
(coordinate with TASK-190.36.6 so the file is touched once):

- `"Bash(xargs sed:*)"`
- `"Bash(for f in types.ts triage_state_types.ts … build_finalization_output.test.ts)"`
- `"Bash(do git mv \"entrypoint-analysis/src/$f\" \".claude/skills/self-repair-pipeline/src/$f\")"`
- `"Bash(/tmp/advance_state.ts:*)"`
- `"Write(//Users/chuck/.ariadne/self-repair-pipeline/**)"`

The broad `python3`/`node` runner allows stay, defensible because the guard
now catches what they would let through.
