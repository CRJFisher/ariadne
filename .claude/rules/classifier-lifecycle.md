# Classifier Rule Lifecycle — Write-Boundary Contract

The classifier registry at `.claude/skills/triage-entrypoints/known_issues/registry.json` is the loop-closure surface between the three self-healing skills. Lifecycle transitions are owned by exactly one writer; this doc names each owner so the surface stays auditable.

## Writers

| Writer                                       | Writes                                                                                                                       | Trigger                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **triage-entrypoints**                     | **never writes** the registry                                                                                                | n/a                                                                                                 |
| **triage-curator**                           | `status: "wip"`, `classifier.kind`, `drift_detected`, `drift_evidence`, `observed_count`, `observed_projects`, `last_seen_run`, `backlog_task` | autonomous, every curator sweep                                                                     |
| **fix-sequencer reconciler** (TASK-190.18.3) | `status: "fixed"`, `fixed_commit`, `fixed_in_run`                                                                            | autonomous; `done` event in `state.jsonl` OR Conventional-Commits scope in target project's git log |
| **Human (manual edit)**                      | `status: "permanent"`                                                                                                        | reviewing `pnpm find-promotion-candidates` output                                                   |

triage-entrypoints reads the registry to filter classifier hits but never mutates it. Its sub-agent (`triage-investigator`) writes only its own per-entry verdict file (`results/<entry_index>.json` under `triage_state/<project>/runs/<run-id>/`); it never touches `registry.json`. Any new code under `.claude/skills/triage-entrypoints/` that calls `writeFile` against `registry.json` (or invokes `serialize_known_issues_registry_json` with the registry path) is a contract violation.

`drift_evidence` rows are curator-owned writes. triage-entrypoints emits `fp-classifier-regression` verdicts that finalize rolls up into the published `classifier_regressions[]`; the curator converts that slice to evidence rows on its next sweep.

## Atomic-write contract

Every writer must reach `registry.json` through `atomic_update_registry(path, mutator)` from the `@ariadnejs/skill-fs` workspace package (`packages/skill-fs/src/atomic_update_registry.ts`). The helper acquires a `.lock` sidecar (`fs.open(path + ".lock", "wx")`) over the full read-mutate-write cycle, then writes via `atomic_write_file` (temp + POSIX rename) and releases the lock on both success and failure paths.

The lock is what protects against concurrent writers (curator sweep + fix-sequencer reconciler on the same machine) computing independent mutations from a stale read and silently losing each other's work. Bare `atomic_write_file` is rename-atomic at the filesystem level but does NOT prevent that race, so direct calls to `atomic_write_file` against a registry-shaped path are a contract violation.

The structural enforcement lives in `packages/skill-fs/src/registry_writers.test.ts`: an AST walk over every `.ts` file under `.claude/skills/**/src`, `.claude/skills/**/scripts`, and `packages/**/src` flags any call to a raw write function (`atomic_write_file`, `writeFile`, `writeFileSync`, `appendFile`, `appendFileSync`) whose first argument resolves to a registry-shaped target. Only sites in that test's `ALLOWED_REGISTRY_WRITERS` set are permitted; the curator's `apply_proposals.ts` and `link_ariadne_bug_tasks` both reach the registry through `atomic_update_registry` and therefore do not appear in the allowlist.

`atomic_write_file` remains the contract for non-shared files (per-entry verdict files, curated-run sentinels, analysis-output JSON) where there is exactly one writer per path.

### Stale-lock recovery

`atomic_update_registry` retries lock acquisition 100 times at 50ms (≈5s budget) before throwing `could not acquire <path>.lock after 5000ms — stale lock?`. Two recovery paths:

- **Honest contention**: a slow mutator legitimately exceeded the budget. Increase the budget at the call site, or split the mutation into smaller transactions. The curator's serialize + drift + upsert + observed-bump pass runs sub-second on registries up to several hundred rules, so a real bump would be evidence of a runaway loop.
- **Crashed writer**: a previous writer was killed (SIGKILL, OOM, kernel panic, `pkill -9`) after acquiring the lock and before `finally` ran. The sidecar persists indefinitely. Manual cleanup is `rm <registry-path>.lock`; verify no live writer process holds the file (`lsof <registry-path>.lock`) before deleting. We do not auto-break stale locks based on mtime because the cure is worse than the disease: a false positive (legitimate slow writer) would interleave two mutators on the same registry, which is exactly the race the lock exists to prevent.

## Lifecycle transitions

```
                          (novel:* groups crossing PROMOTION_THRESHOLD)
                                          │
                                   triage-curator
                                          ▼
                            ┌─────────────────────────┐
                            │ wip, classifier.kind=none│
                            └─────────────────────────┘
                                          │ triage-curator (investigator authors)
                                          ▼
                            ┌─────────────────────────┐
                            │ wip, classifier.kind=    │
                            │   predicate or builtin   │
                            └─────────────────────────┘
                                          │
                          ┌───────────────┼────────────────┐
                          │               │                │
                triage-curator     human review        fix-sequencer
                (drift absorb)     (find-promotion-     (reconciler:
                          │         candidates +         done event /
                          ▼         hand-edit)           git-log scan)
                  ┌─────────────┐         │                │
                  │ wip,        │         ▼                ▼
                  │ drift_      │   ┌───────────┐    ┌───────────┐
                  │ detected:   │   │ permanent │    │   fixed   │
                  │   true      │   │ (bundles  │    │ (fixed_   │
                  └─────────────┘   │  to core) │    │  commit,  │
                                    └───────────┘    │  fixed_in │
                                                     │   _run)   │
                                                     └───────────┘
```

`wip → permanent` is the only manual transition. The candidate-analysis script (`pnpm find-promotion-candidates`) surfaces qualifying rules; the human flips `status` and runs `pnpm sync-permanent-rules` to rebuild the bundled core slice. The transition stays manual until the script produces non-zero output for ≥2 consecutive sweeps; see `let-s-make-a-plan-radiant-dragon.md` for the auto-flip escalation criteria.

A `fixed` row that resurfaces in a later run (its `novel_issue.id` appears again in v4 `triage_results`) is surfaced by the curator for human review — there is no automatic re-flip back to `wip`, because the reconciler is the only authorized writer of `fixed`-row status.

## Cross-references

- The curator's role in the lifecycle: `.claude/skills/triage-curator/SKILL.md`
- The pipeline's read-only relationship to the registry: `.claude/skills/triage-entrypoints/SKILL.md`
- The reconciler's role + out-of-band detector: `backlog/tasks/task-190.18.3 - Add-registry-fix-tracking-fields-*.md`
- Commit convention enforcing reconciler-parseable task ids: `.claude/rules/commit-convention.md`
