---
id: TASK-190.29
title: "Close the human-directed registry-write gap: sanctioned agent path + reconcile --fixed name-mode"
status: To Do
assignee: []
created_date: "2026-06-28 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - tooling
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

When an agent-driven flow (e.g. `build-and-review`) needs a classifier-registry
transition while acting under an explicit in-session human instruction, there is
no clean sanctioned path: the harness blocks the write, and the human-invoked
writer that _should_ perform it cannot detect the transition. TASK-348.2
surfaced both halves of this gap. This task closes it.

### What happened in TASK-348.2

The task retired two subsumed classifier rows (`higher-order-function-callback`,
`inline-callback`): flip `wip → fixed`, drop the `builtin` classifier to `none`,
delete the two builtin source files. The user explicitly authorized the registry
write in-session (an `AskUserQuestion` answer: "I edit via
`atomic_update_registry`"). Two blockers followed:

1. **The harness self-modification classifier blocked the agent's write — twice.**
   The agent ran a one-off script that used `atomic_update_registry` (the
   contract-sanctioned helper) to flip the rows. The auto-mode permission
   classifier denied the Bash call as `[Self-Modification]` against
   `.claude/skills/triage/known_issues/registry.json` — "the human-owned
   registry surface the user explicitly reserved for themselves" — and the
   in-session `AskUserQuestion` authorization did not clear it. The human had to
   run the command by hand.

2. **The sanctioned writer could not have done it automatically.** Registry
   writes are owned by the human via `reconcile-registry` →
   `reconcile_registry.ts` (`disable-model-invocation: true`). Its `wip → fixed`
   detector matches a rule's `backlog_task` scope against fix-bearing
   (`fix`/`feat`) commits in the git log. But these rows' `backlog_task` pointed
   at the original plan tasks (`TASK-204` / `TASK-187`) while the subsuming fix
   landed under `TASK-348` — a scope mismatch the detector skips. There is no
   manual "name these rules and flip them to `fixed`" mode (only `--promote`
   names rules directly via `--id`).

The net effect: a legitimate, human-authorized transition required the human to
hand-run an ad-hoc script, and the proper tool (`reconcile-registry`) offered no
route to express it.

### Scope

Resolve both halves while preserving the lifecycle contract's core invariant —
**the human is the registry's sole decider** (`.claude/rules/classifier-lifecycle.md`).

**A. Reconcile `--fixed` name-mode (the substantive fix).** Add a direct-name
mode to `reconcile_registry.ts` mirroring `--promote`: `--id <group_id> --fixed`
flips the named `wip` rules to `fixed` without relying on git-log `backlog_task`
scope matching. This covers every case where the fix lands under a different
task scope than the rule's `backlog_task` (plan-task vs the task that actually
landed the fix). Design considerations:

- Keep the auto-detected `--fixed` path unchanged; the name-mode is additive,
  selected only when `--id` accompanies `--fixed` with no detection match.
- Decide whether the name-mode should also null a `builtin` classifier whose
  implementation is being deleted (the `classifier → none` step TASK-348.2 did
  by hand), or leave classifier edits separate. A retired rule that still
  names a deleted builtin is a dangling reference; either reconcile drops it
  or the rules doc states the human must.
- The write still flows through the single `atomic_update_registry`
  transaction; `registry_writers.test.ts` stays green; add
  `reconcile_registry.test.ts` cases for the name-mode (named `wip` flips,
  non-`wip` named rule is a no-op, unknown id reported in `missing_ids`).

**B. Sanctioned hand-off, codified (the workflow fix).** Decide and document the
one canonical path for a human-directed registry transition initiated inside an
agent flow, and make agents follow it instead of attempting an ad-hoc
`atomic_update_registry` script:

- The agent performs the _code_ side (delete builtins, update the barrel) as
  normal work, then **stops and hands the human the exact single
  `reconcile-registry` command** to run (now expressible thanks to A), then
  continues. No agent ever writes `registry.json` directly.
- Codify this in the relevant skill(s) and in
  `.claude/rules/classifier-lifecycle.md`: when an agent needs a registry
  transition, route it through a printed `reconcile_registry.ts` command for
  the human, never a bespoke writer. Note the self-modification classifier
  interaction so future agents do not burn cycles retrying a blocked write.

**C. Permissions (decide explicitly, default to the safe option).** Evaluate
whether a narrowly-scoped Bash allow-rule for the exact `reconcile_registry.ts`
invocation is warranted so the human's approval is a single prompt rather than a
manual terminal run. Default recommendation: **do not** broadly allowlist
registry writes (it weakens the safeguard the classifier enforces); the
hand-off in (B) plus the name-mode in (A) make the manual run a one-liner, which
is an acceptable cost for keeping the human the literal writer. Record the
decision in the rules doc either way (`.claude/rules/hook-errors.md` governs not
weakening hook/permission validation by config edits).

### Recommendation

Land **A** (real capability gap) and **B** (codified hand-off) together; treat
**C** as a documented decision, defaulting to no broad permission grant. A + B
turn the TASK-348.2 experience into: agent deletes the builtins, prints
`node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts --id higher-order-function-callback --id inline-callback --fixed`,
the human runs it, the agent continues — contract-faithful, single command, no
ad-hoc writer.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `reconcile_registry.ts` supports `--id <group_id>... --fixed` direct-name mode that flips named `wip` rules to `fixed` independent of git-log `backlog_task` matching, through the single `atomic_update_registry` transaction.
- [ ] `reconcile_registry.test.ts` covers the name-mode: named `wip` flip applies, non-`wip` named rule is a no-op, unknown id reported in `missing_ids`; `registry_writers.test.ts` stays green.
- [ ] A documented decision on whether the name-mode also drops a deleted builtin's classifier to `none`, with the chosen behavior implemented or the human-step stated in the rules doc.
- [ ] `.claude/rules/classifier-lifecycle.md` (and the relevant skill docs) state the canonical hand-off: agents route human-directed registry transitions through a printed `reconcile-registry` command, never a bespoke registry writer, and note the self-modification classifier interaction.
- [ ] An explicit, recorded decision on the permission scope (default: no broad allow-rule for registry writes).

<!-- AC:END -->
