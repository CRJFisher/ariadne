---
id: TASK-190.33
title: "Enforce human-owns-registry in-repo, not just via the harness classifier"
status: Done
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

- [x] A `PreToolUse` hook (configured in settings) intercepts every agent
      `Write`/`Edit`/`Bash` targeting `registry.json` and routes it to a per-edit
      human `ask`, so an unattended agent cannot silently write the registry.
- [x] The hook does not block a human-approved interactive edit (the per-edit
      checkpoint), consistent with the classifier-lifecycle reframe.
- [x] `classifier-lifecycle.md` describes the in-repo enforcement accurately (no
      claim that rests solely on the out-of-repo harness classifier).
- [x] `--promote` re-checks `BUILTIN_CHECKS` membership like `--stage`, with a test.

<!-- AC:END -->

## Implementation Notes

### High-level summary

The per-edit human checkpoint over `registry.json` is enforced in-repo by a
`PreToolUse` hook. `.claude/settings.json` wires a `Write|Edit|Bash` matcher to
`.claude/hooks/registry_write_guard.ts`, a thin fail-open wrapper that emits
`hookSpecificOutput.permissionDecision: "ask"` — the only permission outcome
that both re-raises a prompt under `defaultMode: "acceptEdits"` and lets an
interactive human approve. An unattended agent has no one to answer the prompt,
so the write stops; the harness `[Self-Modification]` classifier is
defense-in-depth for obfuscated writes and the window where a crashed hook
fails open. The decision logic and its 26 tests live in the triage package
(`.claude/skills/triage/src/registry_write_guard.ts`), beside the registry
domain code and inside the repo's test/lint/typecheck nets — `.claude/hooks/`
is outside all three.

The guard's Bash arm is a lexical accident-catcher, not a sandbox. It asks only
when a write construct is bound to the registry path within one pipeline
segment (redirect into it, `tee`/`sed -i`, command-position-anchored
`mv`/`cp`/`rm`, `git checkout`/`restore`, `writeFileSync`-family), or when a
command *executes* `reconcile_registry.ts` in write-mode — a runner token is
required, mere mentions pass, and read-only flags are token-matched with quoted
segments stripped so a `--reason "see --dry-run docs"` cannot spoof read-only
mode. Pure reads never prompt: the first version asked on reads and produced
43 spurious prompts in one session, which both proved the mechanism (an `ask`
really does override auto-accept and allow rules) and taught the design rule
the module now documents — a guard that prompts on reads is a guard the human
disables.

`--promote` re-checks `BUILTIN_CHECKS` membership exactly as `--stage` does: a
builtin whose `check_*.ts` was deleted after staging is diverted to a
`rejected_promotions` row (batch-safe, ahead of the benign `already permanent`
reason) instead of bundling a dangling `function_name` into the permanent
slice. `classifier-lifecycle.md` now names the hook as the checkpoint, states
the ask-over-allow precedence, indexes the guard in its Cross-references, and
records the hand-off truth: the human runs the printed reconcile command in
their own terminal (outside the harness, no hook), while an agent running it
write-mode via Bash trips the same per-edit `ask`. CI runs the triage suite so
the guard's tests gate merges.

### Details

- Commits: `154cf6c8` (hook, gate, docs), `3df69176` (review hardening:
  token-bound flags, path-bound patterns, git-restore coverage, emit-before-log,
  mixed-batch promote test, CI step).
- Review: 10-lens fan-out; fix-now findings were the reconcile
  mention-vs-execution false positive, unbound write-token false positives, the
  quoted-flag spoof (fail-open), log-before-emit, the missing Cross-references
  row, the ask-over-allow wording, and the CI gap. Noted-not-actioned: shared
  remediation-string helper (promote/stage), `node --import tsx` vs
  `pnpm exec tsx` launcher divergence (verified safe), MultiEdit matcher
  (tool absent from the current harness), SKILL.md soft-link to the guard.
