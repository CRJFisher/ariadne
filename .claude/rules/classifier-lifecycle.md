# Classifier Rule Lifecycle — Write-Boundary Contract

The classifier registry at `.claude/skills/triage-entrypoints/known_issues/registry.json` is the loop-closure surface between the three self-healing skills. Lifecycle transitions are owned by exactly one writer; this doc names each owner so the surface stays auditable.

## Writers

| Writer                                       | Writes                                                                                                                       | Trigger                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **triage-entrypoints**                     | **never writes** the registry                                                                                                | n/a                                                                                                 |
| **triage-curator**                           | `status: "wip"`, `classifier.kind`, `drift_detected`, `drift_evidence`, `observed_count`, `observed_projects`, `last_seen_run`, `backlog_task` | autonomous, every curator sweep                                                                     |
| **fix-sequencer reconciler** (TASK-190.18.3) | `status: "fixed"`, `fixed_commit`, `fixed_in_run`                                                                            | autonomous; `done` event in `state.jsonl` OR Conventional-Commits scope in target project's git log |
| **Human (manual edit)**                      | `status: "permanent"`                                                                                                        | reviewing `pnpm find-promotion-candidates` output                                                   |

triage-entrypoints reads the registry to filter classifier hits but never mutates it. Any new code under `.claude/skills/triage-entrypoints/` that calls `writeFile` against `registry.json` (or invokes `serialize_known_issues_registry_json` with the registry path) is a contract violation.

`drift_evidence` is the shared ledger for both drift signals: the curator's QA sample-rate path writes rows with `source: "qa-sample"`; the in-flight `fp-classifier-regression` absorb writes rows with `source: "in-flight"`. Both signals are curator-owned writes; triage-entrypoints only emits per-entry verdicts that the curator converts to evidence rows at finalize time.

## Atomic-write contract

Every writer must use temp+rename (POSIX-atomic) to write the registry file. The curator uses the shared `atomic_write_file` helper at `.claude/skills/triage-curator/src/atomic_write.ts`. The reconciler must use the same helper when it lands.

This protects against concurrent writers (curator + reconciler running on the same machine) racing the read-mutate-write cycle and silently losing data.

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
                (drift QA)         (find-promotion-     (reconciler:
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

`wip → permanent` is the only manual transition. The candidate-analysis script (`pnpm find-promotion-candidates`) surfaces qualifying rules; the human flips `status` and runs `pnpm sync-permanent-rules` to rebuild the bundled core slice. Auto-flip is deferred until the script demonstrates non-zero output for ≥2 consecutive sweeps (see `let-s-make-a-plan-radiant-dragon.md` for the escalation criteria).

## Cross-references

- The curator's role in the lifecycle: `.claude/skills/triage-curator/SKILL.md`
- The pipeline's read-only relationship to the registry: `.claude/skills/triage-entrypoints/SKILL.md`
- The reconciler's role + out-of-band detector: `backlog/tasks/task-190.18.3 - Add-registry-fix-tracking-fields-*.md`
- Commit convention enforcing reconciler-parseable task ids: `.claude/rules/commit-convention.md`
