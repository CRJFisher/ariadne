---
id: TASK-362.15
title: >-
  Thin the always-on context: CLAUDE.md trunk, classifier-lifecycle
  path-scoping, doc-style dedup
status: To Do
assignee: []
created_date: "2026-07-05 11:40"
labels:
  - information-architecture
  - claude-customisation
  - encourage
dependencies:
  - TASK-362.10
parent_task_id: TASK-362
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Source: the IA-enforcement strategy (2026-07-05 workflow over the `ia-review` drafts and task 362). This is the **net-negative context story** that pays for every addition in the other mechanism tasks: convert the always-on budget from ~240 lines of partially-duplicated prose to a ~40-line trunk plus on-demand path-scoped rules (roughly −200 always-on lines per turn).

### 1. CLAUDE.md (126 lines → ~40)

- KEEP verbatim: Goals, Project Layout / Intention Tree, Refactoring Ethos (one line), Processing Pipeline (3 stages + rules pointer).
- DELETE the Documentation Style section (near-verbatim duplicate of the always-on global `documentation-style.md`). Preserve its one project-specific "Note" by folding that sentence into the global rule at `/Users/chuck/workspace/claude-config/rules/documentation-style.md` (cross-repo — **confirm scope with the user**; if out of scope, instead add a 3-line path-scoped `.claude/rules/documentation-style.md` carrying only the Note plus a pointer).
- DELETE the "Naming Convention - pythonic" and "Testing Requirements" bodies: naming is owned by the enforced, path-scoped `file-naming.md` (this also removes the `test_utils.ts` contradiction — CLAUDE.md bans it while `file-naming.md` allowed it; one source of truth remains). Move the testing content (test structure, `toEqual`-over-`toMatchObject`, assertion requirements, helper placement, integration-test patterns) into a NEW path-scoped `.claude/rules/testing.md` (`paths: packages/*/src/**`).
- REPLACE the deleted blocks with a single terse "detailed rules auto-load by path" index naming the rules directory.

### 2. classifier-lifecycle.md (114 lines, currently unscoped = loads on every file-edit context)

- Add `paths:` frontmatter covering every registry-adjacent surface: `.claude/skills/triage/**`, `.claude/skills/plan/**`, `.claude/skills/reconcile-registry/**`, `packages/core/src/classify_entry_points/builtins/**`, `packages/skill-fs/src/**` (include the `known_issues` dir via the triage glob).
- Compress the opening contract prose to 4 bullets (who owns writes; registry = permanent-limitations catalog; every write via `atomic_update_registry`; agent hand-off prints a `reconcile_registry` command).
- Move the Stale-lock recovery runbook to `.claude/skills/reconcile-registry/RUNBOOK.md` and reference it. Keep the Writers table and Lifecycle diagram.
- Enforcement is unchanged — `registry_write_guard.ts` (PreToolUse ask) and `registry_writers.test.ts` (AST walk) are the real guards, and **per the standing rule the hook and permission surface must not be weakened**. The pipeline's force-injected system-reminder is independent of `paths:` scoping and unaffected.

NET: roughly −200 always-on lines per turn; testing and doc-style guidance become zero-cost until a matching file is touched.

**Sequencing:** the naming-body deletion depends on the file-naming hook hardening task (so the enforced rule + hook fully own naming before CLAUDE.md stops restating it). The global `documentation-style.md` edit is a cross-repo change to `/Users/chuck/workspace/claude-config` — confirm scope with the user; the path-scoped fallback needs no external change.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 CLAUDE.md is ~40 lines: intention tree + pipeline + rules-index pointer; naming/testing/doc-style bodies removed and re-homed to path-scoped rules
- [ ] #2 testing guidance lives in a new path-scoped .claude/rules/testing.md; the test_utils.ts contradiction is resolved to one source of truth
- [ ] #3 classifier-lifecycle.md carries paths: frontmatter, is compressed, and moves the stale-lock runbook out; registry_write_guard.ts and its permission surface are NOT weakened
- [ ] #4 net always-on reduction of roughly 200 lines per turn; global documentation-style.md edit confirmed with the user or replaced by the path-scoped fallback
<!-- AC:END -->
