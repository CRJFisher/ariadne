---
id: TASK-190.36.1
title: "Unblock the pipeline and land the quick run-cost wins"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
parent_task_id: TASK-190.36
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Eight small items, one sitting each. The first four are live blockers — the
pipeline currently cannot complete a prioritize run without manual
workarounds. The last four are run-cost wins verified to need no design work.

### Blockers

1. **Quote `refactor-investigator.md:3`'s YAML description.** The unquoted
   description contains a colon-space at ~col 472 (`` `packages/core` code:
validates ``); a YAML parser raises `ScannerError`, which breaks loading of
   prioritize's step-3 workhorse agent. One-line fix: wrap the value in double
   quotes. Add an agent-frontmatter parse-lint test asserting every
   `.claude/agents/*.md` frontmatter parses, so this class of break cannot
   recur.
2. **Wipe the stale task-DB.** All 61 rows in `~/.ariadne/plan/tasks/` are
   pre-190.35 (missing `is_permanent_limitation`); the strict parse at
   `plan_task_record.ts:84-89` aborts even `--dry-run` export because the
   full-DB read at `export_to_backlog.ts:188` precedes the write gate at
   `:198`. Delete the rows (spot-check `status` fields first); do NOT re-mint —
   the field was never computed for them and any default would be fabricated.
   Verify with a clean `export_to_backlog.ts --dry-run` afterward.
3. **Bind `$SCRATCH`.** `prioritize/SKILL.md:397,415` use
   `$SCRATCH/export_summary_<slug>.json` in copy-paste commands but nothing
   binds the variable; a literal paste writes to filesystem root (sandbox
   blocks it) and step 7c graduates nothing. Replace with
   `<root>/export_summary_<slug>.json` (`<root>` is the resolved run dir used
   throughout steps 3–7).
4. **Add `AskUserQuestion` to triage's `allowed-tools`.** `triage/SKILL.md:64`
   invokes it for the folder-exclusion gate; `:6` does not declare it. All
   three sibling skills declare it.

### Run-cost wins

5. **Move triage's `## Current State` off the cache-critical prefix.** The
   `!`-injected `get_triage_summary.ts` output at `triage/SKILL.md:80`
   (run-id + live counts) invalidates prompt-cache reuse of ~308 of 388 lines
   on every invocation. Move the section to the end of the doc or convert it
   to an on-demand instruction with no `!` injection.
6. **Create the named `refactor-comprehension-author` agent.**
   `prioritize/SKILL.md:323-343` dispatches an unnamed "comprehension-doc
   specialist … if your environment offers one" that does not exist — the only
   dispatch with no named agent, no `Task()` form, and no return-format
   constraint (a ~26KB HTML doc can echo into `<result>`). Create
   `.claude/agents/refactor-comprehension-author.md` with
   `disable-model-invocation: true`, tools `Read, Write(backlog/docs/**)`, the
   ~1.9K-char authoring spec moved out of the SKILL into the agent body, and a
   one-line return contract (`wrote <slug>.comprehension.html`). The SKILL
   dispatch passes the exact `backlog/docs/<slug>.comprehension.html` target,
   satisfying `graduate_group_docs.ts:144`'s filename contract, whose mismatch
   today is a silent `skipped_no_src`.
7. **Add `disable-model-invocation: true` to the four by-name specialists**
   (`refactor-investigator.md`, `refactor-consolidator.md`,
   `refactor-task-architect.md`, `classifier-author.md`) — 2,766 chars of dead
   auto-trigger routing surface loaded every session. Unblocks scoping
   prioritize's bare `Task` grant (TASK-190.36.2).
8. **Converge `/tmp` grants on `$TMPDIR`.** Four agents grant `Write(/tmp/**)`
   and their bodies instruct writing to `/tmp/` (`triage-investigator.md:98`,
   `classifier-author.md:236`, `refactor-investigator.md:58`,
   `refactor-consolidator.md:79`), while `prioritize/SKILL.md:406` says the
   sandbox blocks `/tmp` and the sandbox allows only `/tmp/claude`/`$TMPDIR`.
   The pipeline works today only because this machine re-adds `/tmp` as an
   `additionalDirectory` — a portability gap. Update the four grants and body
   prose.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] All `.claude/agents/*.md` frontmatter parses under a strict YAML loader,
      pinned by a test.
- [ ] `export_to_backlog.ts --dry-run` enumerates cleanly (no stale-row
      throw); `~/.ariadne/plan/tasks/` holds only post-190.35 rows.
- [ ] No `$SCRATCH` reference remains in `prioritize/SKILL.md`; the 7b/7c
      commands paste-and-run against `<root>`.
- [ ] `triage/SKILL.md` declares `AskUserQuestion` and has no `!`-injected
      content before its reference sections.
- [ ] `refactor-comprehension-author.md` exists, owns the authoring spec, and
      the step-5 dispatch names it with the exact staging filename.
- [ ] All five prioritize-family agents carry `disable-model-invocation: true`.
- [ ] No agent grant or body prose references bare `/tmp`.

<!-- AC:END -->
