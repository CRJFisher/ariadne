# Classifier Rule Lifecycle — Write-Boundary Contract

The classifier registry at `.claude/skills/triage/known_issues/registry.json` is the loop-closure surface for the self-healing pipeline. Lifecycle transitions are owned by exactly one writer; this doc names each owner so the surface stays auditable.

Neither pipeline skill writes the registry. `triage` reads it to filter classifier hits; `plan` neither reads nor writes it — its dedup signal is `backlog/tasks/*.md` frontmatter, not the registry. **The human is the registry's sole writer**: every status transition is a human edit, made by hand or by a human-invoked script, and always through `atomic_update_registry`.

## Writers

| Writer                  | Writes                                                                                                                                                                                                                                     | Trigger                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **triage**              | **never writes** the registry                                                                                                                                                                                                              | n/a                                                                                      |
| **plan**                | **never reads or writes** the registry (planning-only; emits proposals into the task-DB)                                                                                                                                                   | n/a                                                                                      |
| **Human (manual edit)** | every transition: `status: "wip"`, `classifier.kind`, `drift_detected`, `drift_evidence`, `observed_count`, `observed_projects`, `last_seen_run`, `backlog_task`; `status: "permanent"`; `status: "fixed"`                                  | acting on `plan`'s proposals, reviewing promotion candidates, and recording landed fixes |

`triage`'s sub-agent (`triage-investigator`) writes only its own per-entry verdict file (`results/<entry_index>.json` under `triage_state/<project>/runs/<run-id>/`); it never touches `registry.json`. Any code under `.claude/skills/triage/` or `.claude/skills/plan/` that calls `writeFile` against `registry.json` (or invokes `serialize_known_issues_registry_json` with the registry path) is a contract violation.

`triage` emits `fp-classifier-regression` verdicts that finalize rolls up into the published `classifier_regressions[]`; the human reads that slice when authoring `drift_evidence` rows.

## Atomic-write contract

Every registry write must go through `atomic_update_registry(path, mutator)` from the `@ariadnejs/skill-fs` workspace package (`packages/skill-fs/src/atomic_update_registry.ts`). The helper acquires a `.lock` sidecar (`fs.open(path + ".lock", "wx")`) over the full read-mutate-write cycle, then writes via `atomic_write_file` (temp + POSIX rename) and releases the lock on both success and failure paths.

The lock protects against concurrent writers computing independent mutations from a stale read and silently losing each other's work. Bare `atomic_write_file` is rename-atomic at the filesystem level but does NOT prevent that race, so direct calls to `atomic_write_file` against a registry-shaped path are a contract violation.

The structural enforcement lives in `packages/skill-fs/src/registry_writers.test.ts`: an AST walk over every `.ts` file under `.claude/skills/` and `packages/` (excluding `.test.ts` and `.d.ts`) flags any call to a raw write function (`atomic_write_file`, `writeFile`, `writeFileSync`, `appendFile`, `appendFileSync`) whose first argument resolves to a registry-shaped target. The only allowlisted site is `atomic_update_registry` itself; every other site reaches the registry through it.

`atomic_write_file` remains the contract for non-shared files (per-entry verdict files, analysis-output JSON) where there is exactly one writer per path.

### Stale-lock recovery

`atomic_update_registry` retries lock acquisition 100 times at 50ms (≈5s budget) before throwing `could not acquire <path>.lock after 5000ms — stale lock?`. Two recovery paths:

- **Honest contention**: a slow mutator legitimately exceeded the budget. Increase the budget at the call site, or split the mutation into smaller transactions. A read-mutate-write pass over a registry of several hundred rules runs sub-second, so a real bump would be evidence of a runaway loop.
- **Crashed writer**: a previous writer was killed (SIGKILL, OOM, kernel panic, `pkill -9`) after acquiring the lock and before `finally` ran. The sidecar persists indefinitely. Manual cleanup is `rm <registry-path>.lock`; verify no live writer process holds the file (`lsof <registry-path>.lock`) before deleting. We do not auto-break stale locks based on mtime because the cure is worse than the disease: a false positive (legitimate slow writer) would interleave two mutators on the same registry, which is exactly the race the lock exists to prevent.

## Lifecycle transitions

The human performs every transition below, grounding `wip` authoring in `plan`'s proposals:

```
                          (novel:* groups crossing PROMOTION_THRESHOLD
                              surfaced by plan's proposals)
                                          │
                                   human
                                          ▼
                            ┌─────────────────────────┐
                            │ wip, classifier.kind=none│
                            └─────────────────────────┘
                                          │ human (authors classifier)
                                          ▼
                            ┌─────────────────────────┐
                            │ wip, classifier.kind=    │
                            │   predicate or builtin   │
                            └─────────────────────────┘
                                          │
                          ┌───────────────┼────────────────┐
                          │               │                │
                  human            human review        human
                (drift flag)     (promotion           (records landed
                          │         review +            fix from git log)
                          ▼         hand-edit)           │
                  ┌─────────────┐         │              ▼
                  │ wip,        │         ▼        ┌───────────┐
                  │ drift_      │   ┌───────────┐  │   fixed   │
                  │ detected:   │   │ permanent │  └───────────┘
                  │   true      │   │ (bundles  │
                  └─────────────┘   │  to core) │
                                    └───────────┘
```

Every transition is a manual edit. The human flips `wip → permanent` after promotion review and regenerates the bundled core slice (`packages/core/src/classify_entry_points/permanent_data.ts`). The human flips `status` to `fixed` once a fix lands — confirmed by a Conventional-Commits scope in the target repo's git log matching a rule's `backlog_task`. The `KnownIssue` schema records no commit hash; the `backlog_task` link plus the git log are the audit trail.

A `fixed` row that resurfaces in a later run (the same `member_symbol` reappears in the published `triage_results` — the stable `(file_path, name, kind, start_line)` identity, not the positional `novel-<entry_index>` id) is surfaced for human review — there is no automatic re-flip back to `wip`.

## Cross-references

- The plan skill's role in the lifecycle: `.claude/skills/plan/SKILL.md`
- The pipeline's read-only relationship to the registry: `.claude/skills/triage/SKILL.md`
- Commit convention enforcing parseable task ids in fix commits: `.claude/rules/commit-convention.md`
