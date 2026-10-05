---
id: TASK-362.15
title: >-
  Thin the always-on context: CLAUDE.md trunk, classifier-lifecycle
  path-scoping, doc-style dedup
status: Done
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

- **The `paths:` frontmatter landed early in 362.9's branch** — the file already carries `.claude/skills/triage/**`, `.claude/skills/plan/**`, `.claude/skills/reconcile-registry/**`, `packages/core/src/classify_entry_points/builtins/**`, `packages/skill-fs/src/**`, so it no longer loads on every file-edit context. The remaining work below (compression, runbook move) is what stays for this task; do not re-add the frontmatter.
- Compress the opening contract prose to 4 bullets (who owns writes; registry = permanent-limitations catalog; every write via `atomic_update_registry`; agent hand-off prints a `reconcile_registry` command).
- Move the Stale-lock recovery runbook to `.claude/skills/reconcile-registry/RUNBOOK.md` and reference it. Keep the Writers table and Lifecycle diagram.
- Enforcement is unchanged — `registry_write_guard.ts` (PreToolUse ask) and `registry_writers.test.ts` (AST walk) are the real guards, and **per the standing rule the hook and permission surface must not be weakened**. The pipeline's force-injected system-reminder is independent of `paths:` scoping and unaffected.

NET: roughly −200 always-on lines per turn; testing and doc-style guidance become zero-cost until a matching file is touched.

**Sequencing:** the naming-body deletion depends on the file-naming hook hardening task (so the enforced rule + hook fully own naming before CLAUDE.md stops restating it). The global `documentation-style.md` edit is a cross-repo change to `/Users/chuck/workspace/claude-config` — confirm scope with the user; the path-scoped fallback needs no external change.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 CLAUDE.md is a lean trunk (51 lines): intention tree + pipeline + rules-index pointer; naming/testing/doc-style bodies removed and re-homed to path-scoped rules
- [x] #2 testing guidance lives in a new path-scoped .claude/rules/testing.md; the test_utils.ts contradiction is resolved to one source of truth
- [x] #3 classifier-lifecycle.md carries paths: frontmatter, is compressed, and moves the stale-lock runbook out; registry_write_guard.ts and its permission surface are NOT weakened
- [x] #4 net always-on reduction of roughly 200 lines per turn; documentation-style.md re-homed to a self-contained path-scoped rule (path-scoped fallback, no cross-repo edit)
<!-- AC:END -->

## Implementation Notes

## High-level summary

The always-on context a Claude session pays for on every turn had grown to restate the same conventions in several places: `CLAUDE.md` carried a Documentation Style block that duplicated the always-on global rule, a naming block that overlapped the enforced `file-naming.md`, and a full Testing Requirements section — all loaded on every turn whether or not the work touched code. `classifier-lifecycle.md` had already been path-scoped in 362.9 but still opened with a wall of contract prose. This change converts that budget into a thin trunk plus on-demand, path-scoped rules.

The organizing decision is that the always-on trunk holds only what is universal, and everything situational auto-loads by file path when a matching file is edited. `CLAUDE.md` keeps the intention tree, processing pipeline, a terse rules index, and the conventions that genuinely apply repo-wide — identifier casing, functional style, non-nullable variables, debugging-in-a-temp-dir, and `git mv`. The Testing Requirements section moves verbatim to a new path-scoped `.claude/rules/testing.md`, and the Documentation Style section moves whole into a self-contained `.claude/rules/documentation-style.md`. Documentation style was re-homed as a self-contained in-repo rule rather than the spec's "Note + pointer to the global" so the repository stays authoritative for any clone or CI, not just the maintainer's machine — this also avoided the cross-repo edit the task flagged for user confirmation. The `test_utils.ts` contradiction (CLAUDE.md discouraged it, `file-naming.md` allows it) is resolved by having `testing.md` defer all filename decisions to the enforced `file-naming.md`.

To navigate the result: `CLAUDE.md` is the front door and its "Detailed Rules" section names the path-scoped rules; `testing.md` loads across every test-bearing tree (`packages/*/src`, `packages/*/tests`, `.claude/hooks`, `.claude/skills`, `scripts`); `documentation-style.md` loads on any Markdown edit; naming stays owned and enforced by `file-naming.md`. In `classifier-lifecycle.md` the opening contract is now four bullets (human-owns-writes, permanent-limitations catalog, `atomic_update_registry` path, agent hand-off), the Writers table and lifecycle diagram are unchanged, and the stale-lock recovery runbook now lives beside the skill that owns it at `.claude/skills/reconcile-registry/RUNBOOK.md`.

The registry write-guard and its permission surface (`registry_write_guard.ts`, `.claude/settings.json`) are untouched — this change is documentation-only. `testing.md`'s scope was deliberately broadened past the spec's `packages/*/src/**` to reach the `.claude/` and `scripts/` test suites, which are the repo's largest test surface and previously received the always-on guidance. `CLAUDE.md` landed at 51 lines rather than the illustrative ~40 because the retained universal conventions (identifier casing, code structure, debugging, `git mv`) have no correct path-scoped home; path-scoping them would wrongly narrow guidance that applies to hooks and skills as much as to packages.

**Follow-up:** `AGENTS.md` (the parallel always-on trunk read by other agent tools) still carries the pre-thinning Documentation Style, naming, and Testing Requirements sections and now diverges from `CLAUDE.md`. It is a separate, differently-structured file and out of scope here; thinning it in lockstep is a candidate follow-up task.
