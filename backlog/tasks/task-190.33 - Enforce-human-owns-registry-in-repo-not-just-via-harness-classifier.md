---
id: TASK-190.33
title: "Enforce human-owns-registry in-repo, not just via the harness classifier"
status: To Do
assignee: []
created_date: "2026-07-02 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - enforcement
  - hooks
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`.claude/rules/classifier-lifecycle.md` asserts, in three load-bearing places,
that a mechanical guard prevents an agent from writing `registry.json`:

- "the harness self-modification guard blocks agent writes in auto-accept mode"
- "the harness permission classifier denies an agent Bash or Write call targeting
  `…/registry.json` as `[Self-Modification]`"
- (classifier-author) "The harness denies any agent Bash/Write against
  `registry.json` as [Self-Modification]"

A regime audit found this guard is **not enforced by anything in the repository**:

- `.claude/settings.json` and `.claude/settings.local.json` have empty `deny`
  (and `ask`) lists; there is no `permissions.deny` for the registry path.
- No `PreToolUse` hook targets `registry.json` (the only `PreToolUse` hook is the
  file-naming validator).
- The `registry_writers.test.ts` AST-walk catches lock-**bypassing code** (raw
  writes / non-allowlisted serializer calls at build/test time) — it does **not**
  stop an agent from hand-editing the JSON via `Write`/`Edit` at write time.

So "the human mechanically owns the registry" rests entirely on an out-of-repo,
version/config-dependent harness classifier that is probabilistic in practice
(observed: during TASK-190.30.2 the first several `Edit`s to `registry.json`
succeeded before the classifier flagged a later one). If that harness feature is
off or changed, an agent in auto-accept mode can write the registry and nothing
in the repo stops it.

### The fix

Add an **in-repo `PreToolUse` hook** on `Write`/`Edit`/`Bash` whose target
resolves to `.claude/skills/triage/known_issues/registry.json`. Given the
lifecycle doc's reframed **per-edit human checkpoint** (interactive human-directed
edits are allowed; unattended pipeline writes are not), the hook should **`ask`**
(prompt for confirmation) rather than hard-`deny` — that makes the "per-edit human
approval" contract real and in-repo, while still permitting a human interactively
directing a refactor to approve each write. An unattended/auto-accept agent gets
no silent write.

Alternatively (weaker), soften the doc to state plainly that the guard is a
harness-level feature outside repo config and that in-repo enforcement covers only
lock-bypass — but the hook is the stronger close and the one this task targets.

### Secondary: `--promote` lacks the `BUILTIN_CHECKS` membership gate `--stage` has

`reconcile_registry.ts` `run_stage` verifies `function_name ∈ BUILTIN_CHECKS`, but
the `--promote` path does not — a builtin whose `check_*.ts` was deleted after
staging could be promoted, and the slice would reference a dangling `function_name`
until core fails to build. (The 190.30.2 barrel↔registry bijection test catches it
at test-time, but promote itself won't reject it.) Add the same membership check
to the promote path.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A `PreToolUse` hook (configured in settings) intercepts every agent
      `Write`/`Edit`/`Bash` targeting `registry.json` and routes it to a per-edit
      human `ask`, so an unattended agent cannot silently write the registry.
- [ ] The hook does not block a human-approved interactive edit (the per-edit
      checkpoint), consistent with the classifier-lifecycle reframe.
- [ ] `classifier-lifecycle.md` describes the in-repo enforcement accurately (no
      claim that rests solely on the out-of-repo harness classifier).
- [ ] `--promote` re-checks `BUILTIN_CHECKS` membership like `--stage`, with a test.

<!-- AC:END -->
