# Classifier Rule Lifecycle — Write-Boundary Contract

The classifier registry at `.claude/skills/triage/known_issues/registry.json` is the loop-closure surface for the self-healing pipeline. Lifecycle transitions are owned by exactly one writer; this doc names each owner so the surface stays auditable.

Neither pipeline skill writes the registry. `triage` reads it to filter classifier hits; `plan` neither reads nor writes it — its dedup signal is `backlog/tasks/*.md` frontmatter, not the registry. **The human is the registry's sole writer**: every status transition is a human decision, written by hand or through the `reconcile-registry` skill (`.claude/skills/reconcile-registry/SKILL.md`) over `reconcile_registry.ts`, and always through `atomic_update_registry`. The script is the _mechanism_, never the decider: it is `disable-model-invocation: true`, detects the mechanical transitions (landed fixes, published drift), and proposes every write for human confirmation behind a `--dry-run` preview. No agent ever writes the registry: an agent flow that needs a transition routes it back to the human as a printed `reconcile_registry.ts` command (see **Agent-initiated transitions** below), never an ad-hoc writer.

The registry is the **permanent-limitations catalog**: each entry names a call relationship that is fundamentally unknowable to static analysis — dynamic dispatch through computed keys, runtime invocation via interpreter or framework protocols, bundler module substitution, macro expansion invisible to the pre-expansion AST, or callers in unindexed external modules. Every entry carries a real classifier (`classifier.kind` of `"predicate"` or `"builtin"`) that fires during triage. A pattern that represents a fixable Ariadne resolution bug is tracked in `backlog/tasks/`, never here — when its fix lands, the resolver resolves the call directly and no catalog entry is needed.

## Writers

| Writer                                                                     | Writes                                                                                                                                                                                                     | Trigger                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **triage**                                                                 | **never writes** the registry                                                                                                                                                                              | n/a                                                                                                                                                                                                                                                                                                                   |
| **plan**                                                                   | **never reads or writes** the registry (planning-only; emits proposals into the task-DB)                                                                                                                   | n/a                                                                                                                                                                                                                                                                                                                   |
| **Human (by hand, or via `reconcile-registry` → `reconcile_registry.ts`)** | every transition: `status: "wip"`, `classifier.kind` (incl. `"retired"`), `drift_detected`, `drift_evidence`, `observed_count`, `observed_projects`, `last_seen_run`, `backlog_task`; `status: "permanent"`; `status: "fixed"` | inserting a reviewed `classifier-author` draft (a real classifier for a permanent-limitation group), reviewing promotion candidates, recording landed fixes, and retiring a rule by name when the subsuming fix landed under a different task (`--id ... --fixed --reason`, classifier → `retired`) — a directed flip, not detection. `reconcile-registry` detects the git-log scope matches and the published `classifier_regressions[]` and proposes those flips; the human confirms each |

`triage`'s sub-agent (`triage-investigator`) writes only its own per-entry verdict file (`results/<entry_index>.json` under `triage_state/<project>/runs/<run-id>/`); it never touches `registry.json`. Any code under `.claude/skills/triage/` or `.claude/skills/plan/` that calls `writeFile` against `registry.json` — or invokes `serialize_known_issues_registry_json` anywhere other than `reconcile_registry.ts`'s `atomic_update_registry` mutator closure — is a contract violation.

`triage` emits `fp-classifier-regression` verdicts that finalize rolls up into the published `classifier_regressions[]`; the human reads that slice when authoring `drift_evidence` rows.

## Atomic-write contract

Every registry write must go through `atomic_update_registry(path, mutator)` from the `@ariadnejs/skill-fs` workspace package (`packages/skill-fs/src/atomic_update_registry.ts`). The helper acquires a `.lock` sidecar (`fs.open(path + ".lock", "wx")`) over the full read-mutate-write cycle, then writes via `atomic_write_file` (temp + POSIX rename) and releases the lock on both success and failure paths.

The lock protects against concurrent writers computing independent mutations from a stale read and silently losing each other's work. Bare `atomic_write_file` is rename-atomic at the filesystem level but does NOT prevent that race, so direct calls to `atomic_write_file` against a registry-shaped path are a contract violation.

The structural enforcement lives in `packages/skill-fs/src/registry_writers.test.ts`: an AST walk over every `.ts` file under `.claude/skills/` and `packages/` (excluding `.test.ts` and `.d.ts`) flags any call to a raw write function (`atomic_write_file`, `writeFile`, `writeFileSync`, `appendFile`, `appendFileSync`) whose first argument resolves to a registry-shaped target, and any call to `serialize_known_issues_registry_json` outside its caller allowlist. The only allowlisted raw-write site is `atomic_update_registry` itself, and the only allowlisted serializer caller is `reconcile_registry.ts`, which serializes strictly inside its `atomic_update_registry` mutator closure; every other site reaches the registry through the helper.

`atomic_write_file` remains the contract for non-shared files (per-entry verdict files, analysis-output JSON) where there is exactly one writer per path.

### Stale-lock recovery

`atomic_update_registry` retries lock acquisition 100 times at 50ms (≈5s budget) before throwing `could not acquire <path>.lock after 5000ms — stale lock?`. Two recovery paths:

- **Honest contention**: a slow mutator legitimately exceeded the budget. Increase the budget at the call site, or split the mutation into smaller transactions. A read-mutate-write pass over a registry of several hundred rules runs sub-second, so a real bump would be evidence of a runaway loop.
- **Crashed writer**: a previous writer was killed (SIGKILL, OOM, kernel panic, `pkill -9`) after acquiring the lock and before `finally` ran. The sidecar persists indefinitely. Manual cleanup is `rm <registry-path>.lock`; verify no live writer process holds the file (`lsof <registry-path>.lock`) before deleting. We do not auto-break stale locks based on mtime because the cure is worse than the disease: a false positive (legitimate slow writer) would interleave two mutators on the same registry, which is exactly the race the lock exists to prevent.

## Lifecycle transitions

The human performs every transition below. An entry enters the registry only with a real classifier (`predicate` or `builtin`) for a permanent-limitation group: the human authors it and inserts it through `reconcile-registry` (the `classifier-author` drafting agent that produces the candidate is TASK-190.30.2). `reconcile-registry` detects the drift-flag and landed-fix arrows and proposes them — it never decides them:

```
                  (novel:* permanent-limitation groups
                   surfaced by plan's proposals)
                                          │
                          human authors a real classifier
                        (classifier-author agent: TASK-190.30.2)
                                          │
                                 inserts via reconcile-registry
                                          ▼
                            ┌─────────────────────────┐
                            │ wip, classifier.kind=    │
                            │   predicate or builtin   │
                            └─────────────────────────┘
                                          │
                          ┌───────────────┼────────────────┐
                          │               │                │
                  human            human review        human: records a landed
                (drift flag)     (promotion           fix from git log, OR
                          │         review +            retires by name
                          ▼         hand-edit)          (--fixed --reason)
                  ┌─────────────┐         │                │
                  │ wip,        │         ▼                ▼
                  │ drift_      │   ┌───────────┐   ┌────────────────────┐
                  │ detected:   │   │ permanent │   │ fixed              │
                  │   true      │   │ (bundles  │   │ (name-mode also    │
                  └─────────────┘   │  to core) │   │  sets classifier   │
                                    └───────────┘   │  → retired)        │
                                                    └────────────────────┘
```

Every transition is a human decision, written through `atomic_update_registry`. The human flips `wip → permanent` after promotion review (`reconcile_registry.ts --id <group_id> --promote`), which regenerates the bundled core slice (`packages/core/src/classify_entry_points/permanent_data.ts`) via `generate_permanent_data.ts`; `permanent_data.sync.test.ts` asserts the committed slice byte-equals a fresh render of the registry, so neither file can silently drift. The human flips `status` to `fixed` once a fix lands — confirmed by a fix-bearing Conventional-Commits scope (`fix`/`feat`) in this repo's git log matching a rule's `backlog_task`, which `reconcile-registry` detects and proposes. The `KnownIssue` schema records no commit hash; the `backlog_task` link plus the git log are the audit trail.

A rule reaches `fixed` two ways. The **auto-detected** path above is a status-only stamp: the classifier is left intact. The **name-mode** path (`reconcile_registry.ts --id <group_id>... --fixed --reason "<text>"`) is a deliberate retirement for the case the auto detector cannot see — where the subsuming fix landed under a task other than the rule's `backlog_task`, so no git-log scope matches. Name-mode flips the named `wip` rules to `fixed` directly and converts a real (`predicate`/`builtin`) classifier into the structured `retired` kind: `classifier: { kind: "retired", from: <former spec>, reason: <the --reason text> }`. The `retired` kind is the registry's representation of a removed classifier — it preserves the former predicate/builtin verbatim in `from` and records why in `reason`, so the retirement is lossless rather than collapsed to the `none` stub. A retired rule never fires (it is `fixed`, excluded from the active set and the permanent slice), so its `from.function_name` may safely name a builtin source file that the retirement deleted. (Retirements predating this mechanism remain `fixed`/`none`; `retired` is the go-forward shape.)

A `fixed` row that resurfaces in a later run (the same `member_symbol` reappears in the published `triage_results` — the stable `(file_path, name, kind, start_line)` identity, not the positional `novel-<entry_index>` id) is surfaced for human review — there is no automatic re-flip back to `wip`.

## Agent-initiated transitions: the sanctioned hand-off

An agent flow (`build-and-review`, the `classifier-author` drafting agent, any future pipeline agent) never writes `registry.json`, even when a human has authorized a registry transition in-session. The registry is the human-owned self-modification surface: the harness permission classifier denies any agent Bash or Write call targeting `.claude/skills/triage/known_issues/registry.json` as `[Self-Modification]`, and an in-session `AskUserQuestion` authorization does not clear that denial. An agent that retries the blocked write — directly or through an ad-hoc `atomic_update_registry` script — only burns cycles against a guard that will not yield. The sanctioned path routes the write back to the human as a single named command:

1. **Code side (agent does this).** Make every source change the transition implies. For a retired builtin classifier: delete the builtin's source file under `packages/core/src/classify_entry_points/builtins/`, and remove its `import` line and `BUILTIN_CHECKS` entry from that directory's `index.ts` barrel. These are ordinary repository edits the agent may make.

2. **Hand-off (agent prints, human runs).** Print the single name-mode `reconcile_registry.ts` command that records the registry transition, then stop and wait for the human to run it — never a bespoke `atomic_update_registry` script:

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
     --id <group_id>... --fixed --reason "<why the rows retire>"
   ```

3. **Continue (agent resumes).** Once the human confirms the command ran, the agent continues its flow.

The `--id ... --fixed --reason` name-mode exists for exactly this hand-off: it flips named `wip` rows to `fixed` without the auto `--fixed` detector's git-log `backlog_task` match, which misses the common case where the subsuming fix lands under a different task than the rows' original plan task. See `.claude/skills/reconcile-registry/SKILL.md` for the name-mode.

## Permissions: no broad allowlist for registry writes

The repository grants no Bash allow-rule for `reconcile_registry.ts` registry writes, and none should be added. A broad allow-rule would weaken the self-modification safeguard that keeps the human the registry's literal writer: the harness permission classifier reserves `registry.json` for the human precisely so no agent — under any in-session authorization — can mutate the loop-closure surface unattended. Widening the permission surface to make an agent's write pass would defeat that guard.

The cost of keeping the guard is one human-run command per transition, and the name-mode plus the printed-command hand-off reduce that cost to a single copy-paste line. That is the accepted trade. Config edits to `.claude/settings.json` (or `settings.local.json`) must not broaden the permission surface in a way that lets an agent bypass the self-modification classifier for `registry.json`.

## Cross-references

- The human-invoked registry write path: `.claude/skills/reconcile-registry/SKILL.md`
- The retirement / name-mode hand-off command and selectors: `.claude/skills/reconcile-registry/SKILL.md`
- The plan skill's role in the lifecycle: `.claude/skills/plan/SKILL.md`
- The pipeline's read-only relationship to the registry: `.claude/skills/triage/SKILL.md`
- Commit convention enforcing parseable task ids in fix commits: `.claude/rules/commit-convention.md`
