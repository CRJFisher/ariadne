# Classifier Rule Lifecycle — Write-Boundary Contract

The classifier registry at `.claude/skills/triage/known_issues/registry.json` is the loop-closure surface for the self-healing pipeline. Lifecycle transitions are owned by exactly one writer; this doc names each owner so the surface stays auditable.

Neither pipeline skill writes the registry. `triage` reads it to filter classifier hits; `plan` neither reads nor writes it — its dedup signal is `backlog/tasks/*.md` frontmatter, not the registry. **The human owns every registry decision**: every status transition is a human decision, written by hand or through the `reconcile-registry` skill (`.claude/skills/reconcile-registry/SKILL.md`) over `reconcile_registry.ts`, and always through `atomic_update_registry`. The script is the _mechanism_, never the decider: it is `disable-model-invocation: true`, detects the mechanical transitions (landed fixes, published drift), and proposes every write for human confirmation behind a `--dry-run` preview. No agent writes the registry _unattended_ through the file-editing tools: an in-repo `PreToolUse` hook (`.claude/hooks/registry_write_guard.ts`, wired in `.claude/settings.json`) routes every agent `Write`/`Edit` targeting `registry.json` to a per-edit human `ask` — an interactive human approves at the prompt, while an unattended or auto-accept agent has no one to answer, so the write is stopped. A shell-based registry write (a redirect, an in-place edit, or a write-mode `reconcile_registry.ts` run via the Bash tool) is outside the hook's matcher and falls to the harness `[Self-Modification]` classifier, which gates writes under `.claude/` (see **Agent-initiated transitions** below). A pipeline agent that needs a transition therefore routes it back to the human — the `classifier-author` agent stages a draft for `--stage` (creation), and other flows print a `reconcile_registry.ts` command (see **Agent-initiated transitions** below). A human directing an interactive session may approve a direct registry edit — a reviewed human action, e.g. a refactor that converts or retires rules — which is distinct from the pipeline mutating the loop-closure surface on its own.

The registry is the **permanent-limitations catalog**: each entry names a call relationship that is fundamentally unknowable to static analysis — dynamic dispatch through computed keys, runtime invocation via interpreter or framework protocols, bundler module substitution, macro expansion invisible to the pre-expansion AST, or callers in unindexed external modules. Every entry carries a real classifier — a flat `{ function_name, min_confidence }` naming a bespoke `BuiltinCheckFn` at `packages/core/src/classify_entry_points/builtins/check_<group_id>.ts`, the only match mechanism — that fires during triage. A pattern that represents a fixable Ariadne resolution bug is tracked in `backlog/tasks/`, never here — when its fix lands, the resolver resolves the call directly and no catalog entry is needed.

## Writers

| Writer                                                                     | Writes                                                                                                                                                                                                              | Trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **triage**                                                                 | **never writes** the registry                                                                                                                                                                                       | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **plan**                                                                   | **never reads or writes** the registry (planning-only; emits proposals into the task-DB)                                                                                                                            | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Human (by hand, or via `reconcile-registry` → `reconcile_registry.ts`)** | every transition: `status: "wip"`, `classifier`, `drift_detected`, `drift_evidence`, `observed_count`, `observed_projects`, `last_seen_run`, `backlog_task`; `status: "permanent"`; `status: "fixed"`; row deletion | inserting a reviewed `classifier-author` draft (a real classifier for a permanent-limitation group), reviewing promotion candidates, recording landed fixes, and retiring a rule by name when the subsuming fix landed under a different task (`--id ... --fixed --reason`, which deletes the row and its `check_*.ts`) — a directed deletion, not detection. `reconcile-registry` detects the git-log scope matches and the published `classifier_regressions[]` and proposes those flips; the human confirms each |

`triage`'s sub-agent (`triage-investigator`) writes only its own per-entry verdict file (`results/<entry_index>.json` under `triage_state/<project>/runs/<run-id>/`); it never touches `registry.json`. Any code under `.claude/skills/triage/` or `.claude/skills/plan/` that calls `writeFile` against `registry.json` — or invokes `serialize_known_issues_registry_json` anywhere other than `reconcile_registry.ts`'s `atomic_update_registry` mutator closure — is a contract violation.

`triage` emits `fp-classifier-regression` verdicts that finalize rolls up into the published `classifier_regressions[]`; the human reads that slice when authoring `drift_evidence` rows. Each `drift_evidence` row carries `{project, run_id, entry_index, evidence_excerpt}` — deduped by `(project, entry_index)` — so a drift case resolves back to its full `EnrichedEntryPoint` via `get_entry_context.ts`.

After a human-confirmed `--drift` apply, the `reconcile-registry` skill dispatches one **`classifier-fixer`** agent (`.claude/agents/classifier-fixer.md`) per drift-flagged rule. The fixer edits only that rule's `check_<group_id>.ts` and its test — ordinary source edits, never the registry — and terminates each adjudicated evidence case in exactly one state behind a fixability-first triage: **captured** (the case is this rule's permanent limitation; the predicate broadens under a positive-fixture + negative-true-positive test guard), **fixable-in-Ariadne** (the case is a fixable resolution bug; the fixer records a backlog-task proposal for the human — it never enters a classifier, keeping the catalog permanent-only), or **mis-classified** (a different permanent limitation; the fixer records the case's `member_symbol` for the human to route into the `classifier-author` flow). The skill runs one gated core rebuild plus builtins test pass after the fixer wave and surfaces every proposal and hand-off to the human, who makes every resulting decision — filing the backlog task, dispatching `classifier-author`, committing the check edits.

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

The human performs every transition below. An entry enters the registry only with a real builtin classifier for a permanent-limitation group: the `classifier-author` agent (`.claude/agents/classifier-author.md`) drafts the `KnownIssue` plus its `check_<group_id>.ts` into a staging directory, and the human reviews it and inserts it through `reconcile-registry --stage --apply` (detailed in the Creation paragraph below and in `.claude/skills/reconcile-registry/SKILL.md`). `reconcile-registry` detects the drift-flag and landed-fix arrows and proposes them — it never decides them:

```
                  (novel:* permanent-limitation groups
                   surfaced by plan's proposals, or
                   reclassified during prioritize's
                   investigation)
                                          │
                        classifier-author agent drafts a
                        builtin into a staging directory
                                          │
                    human reviews, then inserts via
                    reconcile-registry --stage --apply
                                          ▼
                            ┌─────────────────────────┐
                            │ wip (carries a builtin   │
                            │  check via function_name)│
                            └─────────────────────────┘
                                          │
                          ┌───────────────┼────────────────┐
                          │               │                │
                  human            human review        human: records a landed
                (drift flag)     (promotion           fix from git log, OR
                          │         review +            deletes by name
                          ▼         hand-edit)          (--fixed --reason)
                  ┌─────────────┐         │                │
                  │ wip,        │         ▼                ▼
                  │ drift_      │   ┌───────────┐   ┌────────────────────┐
                  │ detected:   │   │ permanent │   │ fixed (auto stamp) │
                  │   true      │   │ (bundles  │   │ OR row deleted     │
                  └─────────────┘   │  to core) │   │ (name-mode)        │
                                    └───────────┘   └────────────────────┘
```

Every transition is a human decision, written through `atomic_update_registry`. **Creation (`→ wip`)** is the `--stage` insertion path: the `classifier-author` agent writes a `draft_entry.json` plus a `check_<group_id>.ts` to `~/.ariadne/prioritize/<run>/classifier-author/<group_id>/`, never to the registry; the human places the builtin under `packages/core/src/classify_entry_points/builtins/`, rebuilds core, and runs `reconcile_registry.ts --stage <draft> --apply`, which validates the draft against the `KnownIssue` schema (enforcing the `observed_count >= 1` evidence gate), rejects a duplicate `group_id`, rejects a `function_name` absent from core's `BUILTIN_CHECKS`, and executes the drafted check against the `EnrichedEntryPoint` samples the agent persisted beside the draft (`samples/*.json`) — printing the per-sample result in the dry-run preview and refusing `--apply` on any miss, so a check keyed on a field the author only validated against the narrower `TriageEntry` cannot enter the registry. The human flips `wip → permanent` after promotion review (`reconcile_registry.ts --id <group_id> --promote`), which regenerates the bundled core slice (`packages/core/src/classify_entry_points/permanent_data.ts`) via `generate_permanent_data.ts`; `permanent_data.sync.test.ts` asserts the committed slice byte-equals a fresh render of the registry, so neither file can silently drift. The human flips `status` to `fixed` once a fix lands — confirmed by a fix-bearing Conventional-Commits scope (`fix`/`feat`) in this repo's git log matching a rule's `backlog_task`, which `reconcile-registry` detects and proposes. The `KnownIssue` schema records no commit hash; the `backlog_task` link plus the git log are the audit trail.

A rule leaves the active set two ways. The **auto-detected** path above is a fix-stamp, not a retirement: the rule flips to `fixed` and its classifier is left intact. The **name-mode** path (`reconcile_registry.ts --id <group_id>... --fixed --reason "<text>"`) is the deliberate retirement, for the case the auto detector cannot see — where the subsuming fix landed under a task other than the rule's `backlog_task`, so no git-log scope matches. It deletes the named rows and unlinks their `check_<group_id>.ts`, guarded so the code-side deletion (barrel entry removed, core rebuilt) must land first. `.claude/skills/reconcile-registry/SKILL.md` step 5 is the canonical walkthrough of name-mode's mechanics, guard, and crash recovery.

A `fixed` row's regression is **not auto-detected**, and no producer emits a resurfacing signal. A `KnownIssue` retains only `examples: { file, line, snippet }` — call-site snippets, never the `(file_path, name, kind, start_line)` member identity — so a fixed row carries nothing to cross-reference a resurfaced `member_symbol` against. The triage-investigator's active slice is `wip` + `permanent` (auto-classify matches only those), so a `fp-classifier-regression` verdict can never cite a `fixed` rule either. When the underlying pattern regresses, its entries reappear in the published `triage_results` as ordinary re-investigated entries and surface through `diff_runs` (as `appearing`/`flipped`), where the human recognizes the regression against their own memory and git history and decides whether to re-open the rule. There is no automatic re-flip back to `wip`.

## Agent-initiated transitions: the sanctioned hand-off

A pipeline agent flow (`build-and-review`, the `classifier-author` drafting agent, any future pipeline agent) does not self-apply a `registry.json` transition as part of its unattended flow. The registry is the human-owned self-modification surface: the in-repo `registry_write_guard.ts` `PreToolUse` hook intercepts any agent `Write`/`Edit` targeting `.claude/skills/triage/known_issues/registry.json` and demands a per-edit human `ask`. Shell-based writes — a redirect or in-place edit against the registry, or a write-mode `reconcile_registry.ts` invocation (one without `--dry-run`) — are outside the hook's `Write`/`Edit` matcher and fall to the harness permission classifier, which flags writes under `.claude/` as `[Self-Modification]`; that classifier is the defense-in-depth layer for the Bash surface and for the window where a crashed hook fails open.

The two paths are delimited by who is watching each write. A **pipeline-originated transition** — a flow producing many changes where the human is not adjudicating each registry write — routes back to the human rather than self-applying: the `classifier-author` agent stages a draft for `--stage`, and other flows print a `reconcile_registry.ts` command. A human **interactively directing** a one-off registry edit (a refactor that converts or retires rules, as in a `build-and-review` session) instead approves the agent's edit at the permission prompt; the printed-command hand-off is not required there, because the per-edit human checkpoint is already satisfied by the interactive approval. For the pipeline-originated case, the sanctioned path is a single named command:

1. **Code side (agent does this).** Make every source change the transition implies. For a retirement: delete the builtin's source file under `packages/core/src/classify_entry_points/builtins/`, remove its `import` line and `BUILTIN_CHECKS` entry from that directory's `index.ts` barrel, and rebuild core. These are ordinary repository edits the agent may make, and name-mode requires them first — it refuses to delete a row whose `function_name` is still registered in `BUILTIN_CHECKS`.

2. **Hand-off (agent prints, human runs).** Print the single name-mode `reconcile_registry.ts` command that records the registry transition, then stop and wait for the human to run it — never a bespoke `atomic_update_registry` script:

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
     --id <group_id>... --fixed --reason "<why the rows retire>"
   ```

3. **Continue (agent resumes).** Once the human confirms the command ran, the agent continues its flow.

The human runs the printed command in their own terminal, outside the harness's tool surface, so no hook is involved. An agent that instead runs a write-mode `reconcile_registry.ts` command through its Bash tool is not gated by the hook (which matches only `Write`/`Edit`); that route is subject to the harness `[Self-Modification]` classifier, so a directing human still sees a per-edit approval, and the sanctioned path remains the printed-command hand-off.

The `--id ... --fixed --reason` name-mode exists for exactly this hand-off: it deletes the named rows without the auto `--fixed` detector's git-log `backlog_task` match, which misses the common case where the subsuming fix lands under a different task than the rows' original plan task. See `.claude/skills/reconcile-registry/SKILL.md` for the name-mode.

## Permissions: no broad allowlist for registry writes

The repository grants no Bash allow-rule that lets an agent write the registry unattended, and none should be added. The `registry_write_guard.ts` hook holds `Write`/`Edit` calls to `registry.json` behind a per-edit human `ask` that takes precedence over a matching `allow` rule. Shell writes are not hook-gated — they face only the harness `[Self-Modification]` classifier — so a Bash `allow`-rule reaching the registry is especially dangerous and none should be added. A human directing an interactive session still approves each such edit at the prompt — that reviewed, per-edit approval is the safeguard working, not a bypass. Widening the permission surface into a standing allow-rule would remove that per-edit human checkpoint and let an unattended pipeline write the registry, which is exactly what the guard exists to prevent.

The cost of keeping the guard is one human-approved write per pipeline transition, and the name-mode plus the printed-command hand-off reduce that cost to a single copy-paste line. That is the accepted trade. Config edits to `.claude/settings.json` (or `settings.local.json`) must neither broaden the permission surface into a standing allow-rule nor remove or weaken the `registry_write_guard.ts` `PreToolUse` hook that enforces the per-edit self-modification checkpoint for `Write`/`Edit` calls to `registry.json`.

## Cross-references

- The per-edit write-guard hook and its decision logic: `.claude/hooks/registry_write_guard.ts` over `.claude/skills/triage/src/registry_write_guard.ts`, wired in `.claude/settings.json`
- The human-invoked registry write path: `.claude/skills/reconcile-registry/SKILL.md`
- The retirement / name-mode hand-off command and selectors: `.claude/skills/reconcile-registry/SKILL.md`
- The plan skill's role in the lifecycle: `.claude/skills/plan/SKILL.md`
- The pipeline's read-only relationship to the registry: `.claude/skills/triage/SKILL.md`
- Commit convention enforcing parseable task ids in fix commits: `.claude/rules/commit-convention.md`
