---
name: prioritize
description: Review the plan engine's task-DB and promote selected PlanTask rows into the user's backlog/. Drives export_to_backlog.ts — the only writer of backlog/, run deliberately by the human when graduating planned work.
argument-hint: "[--status proposed|accepted] [--fault-area <area>] [--priority core|classifier] [--id <db-task-id>...] [--dry-run]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read, Write, Bash(open:*), Task(refactor-investigator), Task(refactor-task-architect), Task(comprehension-doc-architect)
---

# Prioritize

Graduate planned work into the user's `backlog/`. The `plan` skill leaves
proposed fixes as `PlanTask` rows in its task-DB at `~/.ariadne/plan/tasks/`;
this skill is the deliberate, human-invoked step that turns the cheap plan into a
verified refactoring design and picks which of those rows become real backlog
tasks.

It does two things the `plan` engine deliberately does not: it **deep-investigates
each change group against the real `packages/core` code** (via the
`refactor-investigator` sub-agent) to produce a concrete refactoring plan, and it
**graduates** the selected rows into `backlog/`. Graduation runs through one
script:

```
.claude/skills/plan/scripts/export_to_backlog.ts
```

That script is the **only writer of `backlog/tasks/`** in the pipeline. It is
never run on the autonomous sweep — graduation is always a human decision, which is
what this skill exists to make. The investigation is design-only: the
`refactor-investigator` reads `packages/core` but never writes it, and the
plan/comprehension artifacts it stages graduate into `backlog/` only for the
groups the user funds.

## What the export does

A real run mints **nested** backlog ids that mirror the plan tier tree, then for
each selected exportable row:

1. assigns its backlog id from the plan tree (`assign_backlog_ids`): an
   `architectural` root takes the next free top-level id (`TASK-347`); its
   `fault_area` child nests as `TASK-347.1`; each `localized` leaf nests as
   `TASK-347.1.<n>`, carrying a `parent_task_id` link and an `ordinal`,
2. writes `backlog/tasks/<dotted-id> - <slug>.md` (rendered from the
   `PlanTask`'s title/body),
3. stamps the row's verbatim `dedup_key` into the task's `plan_dedup_key`
   frontmatter — the idempotency link,
4. flips the DB row `→ exported` (recording `exported_backlog_task`) and logs
   one `export` `PlanSweepEvent`.

So a graduated change group lands as **one epic per group** (the architectural
root) with the fault-area node and the concrete fixes nested beneath it. Within
a sibling level the order is core fixes first (by descending impact), then the
interim classifier work last (`medium` priority) — the `ordinal` field fixes
that order in the tracker. A row whose plan-tree parent is not part of the same
selection becomes its own top-level root, so a partial selection stays
well-formed.

Only `proposed` and `accepted` rows are exportable. A row already `exported`,
or whose `dedup_key` a backlog task already carries, is skipped — so a re-run
with the same arguments is a no-op.

Promote whole change groups together (root + fault-area node + leaves) so the
backlog tree is complete; that is what the workflow below builds toward.

## Workflow

Prioritization is a conversation, not a single command. You build the picture of
the candidate work, **deep-investigate each change group against the real
`packages/core` code** to turn the plan's cheap routing-and-sizing into a
concrete refactoring design, hand the user a comprehension doc per group to grasp
it, decide together which groups graduate, then promote exactly that set — and
graduate each funded group's refactor plan and comprehension doc into `backlog/`
alongside its epic.

The deep investigation runs on **every** candidate group, before the funding
decision, so the user decides with full designs in hand. This is a deliberate
cost: a group the user does not fund is still investigated. The fault-area count
per sweep bounds the fan-out (a handful of groups), and the plan's
`core_fix_effort` estimate already pre-filters the trivially cheap fixes, so the
spend buys decision quality on the changes that actually carry blast radius.

The division of labour stays clean. The `plan` engine remains the cheap,
planning-only router-and-estimator — its strategist gains nothing here. All deep
design lives in `prioritize`, which is already the write-capable, human-invoked
side of the boundary (it owns `export_to_backlog.ts`, the only writer of
`backlog/`).

Always invoke with `node --import tsx`. Never `pnpm exec tsx` or `npx tsx`
(those open IPC sockets the sandbox blocks).

### 1. Preview the candidates

Run with filters and `--dry-run`. This lists the would-be backlog tasks and
writes nothing — it is the raw prioritization view.

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --status proposed --dry-run
```

The output lists each candidate as `{id, backlog_task, path}`.

### 2. Gather the change groups

Read each candidate's source row at `~/.ariadne/plan/tasks/<id>.json` and group
them by `fault_area` — a **change group** is the set of candidate rows that fix
one fault area. For each group, pull from the rows the signal the user weighs:

- **What changes** — the group's `title`s and `body` prose: the concrete fix
  and the part of Ariadne it touches.
- **Impact (benefit)** — `observed_count` (how many false-positives the fix
  eliminates), `projects` and `source_runs` (how broadly the issue spans). A
  group seen across many projects and runs is high-impact.
- **Cost (blast radius)** — `core_fix_effort` and `core_fix_effort_rationale`:
  the strategist's estimate of how much complexity the core fix adds to Ariadne
  (1 = single-file edit, 3 = new resolver path, 5 = cross-folder pass). `0` on
  classifier-work and taxonomy-extension rows, where blast radius is not
  meaningful.
- **Kind** — `is_classifier_work` marks an interim classifier workaround,
  explicitly lower-priority than the core fix it routes around.

### 3. Deep-investigate each change group

The plan engine produced each group cheaply — its strategist trusts the triage
evidence rollup and never reads the cited files front to back, so the architectural
node's body is a _hypothesis about the fix_, not a verified design. Turn it into a
real design before the user decides.

Dispatch one `Task(refactor-investigator)` per change group, all groups in one
message so they run in parallel (cap at ~5 concurrent; drain in waves if there are
more). Each sub-agent reads its group's rows, gets to grips with the real
`packages/core` code, and writes a Markdown refactoring plan to
`~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md`. Dispatch prompt:

> Investigate change group `<fault_area>` and write its refactoring plan. The
> group's rows are at `<row_path>`, `<row_path>`, … (the architectural root, its
> fault_area node, and the localized leaves). Read every row and its evidence,
> investigate the owning `ARIADNE_FAULT_AREA_FOLDER[<fault_area>]` code, trace each
> false-positive to its root cause, and design the single coherent change that
> resolves the whole group at the right altitude — validating or collapsing the
> plan's decomposition (catch over-decomposition, dead code, duplicate builders).
> Write the plan to `~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md` and
> return your one-line root cause + decomposition verdict.

Wait for every `Task()` in a wave to return before starting the next wave.
**All step-3 waves must complete before any step-4 task is dispatched.** The
plans on disk are the verified input step 4 reads; dispatching a comprehension
doc before its `refactor_plan.md` is written produces an empty doc.

### 4. Render a comprehension doc per change group

For each investigated group, dispatch one `Task(comprehension-doc-architect)` to
render a self-contained HTML comprehension doc from that group's
`refactor_plan.md`, written to
`~/.ariadne/plan/prioritize/<fault_area>/comprehension.html`. Each doc presents:

- a before/after pair of diagrams showing the change in functionality, grounded in
  the refactor plan's chosen mechanism,
- the impact — the false-positives it removes and how broadly, stated concretely
  (e.g. "eliminates 14 false unreachable-function flags across 6 projects"),
- the cost/blast-radius and whether it is a core fix or interim classifier work,
- a clear benefit-vs-cost framing so the user can rank groups against each other.

Then author one **index** comprehension doc (written to a temp path and opened)
that links every group's doc and leads with the highest impact-to-cost ratio.
Keep it scannable: a decision aid, not a transcript of the rows.

### 5. Decide together

Walk the user through the comprehension docs — now backed by verified refactor
designs, not just the plan's hypothesis — and use `AskUserQuestion` to settle which
change groups graduate this run. Offer the groups as options (and let the user pick
multiple), surfacing the impact-vs-cost tradeoff in each option so the choice is
informed. If the user wants to inspect or re-cut the set, narrow with the selectors
below and re-run `--dry-run`. Do not promote until the user has confirmed the set.

### 6. Promote

For each confirmed group, run steps 6a → 6b → 6c in sequence. Repeat for every
funded group.

**Step 6a — assign backlog ids** (one `refactor-task-architect` per confirmed group):

Dispatch one `Task(refactor-task-architect)` per confirmed group. The agent reads
`~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md` (sections 6 and 7),
applies the natural-split criterion — one top-level task for the fundamental
refactor, sub-tasks only for genuinely separate downstream adaptations — and
writes a `BacklogIdAssignment` map with relative ids to
`~/.ariadne/plan/prioritize/<fault_area>/task_assignment.json`. The plan engine's
tier labels are a routing concept, not the splitting axis. Dispatch prompt:

> Assign backlog ids for change group `<fault_area>`. The refactor plan is at
> `~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md`. The plan task ids
> for this group are: `<row_id>`, `<row_id>`, … (architectural root, fault_area
> node, localized leaves). Apply the natural-split criterion and write the
> BacklogIdAssignment map to
> `~/.ariadne/plan/prioritize/<fault_area>/task_assignment.json`.

Run these architects in parallel (one message per group) and wait for all to
complete before proceeding to 6b.

**Step 6b — export the rows** (one run per confirmed group):

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --fault-area <area> \
  --assignments ~/.ariadne/plan/prioritize/<area>/task_assignment.json \
  > /tmp/export_summary_<area>.json
```

The `--assignments` flag accepts the `task_assignment.json` produced in 6a and
uses its `BacklogIdAssignment` map instead of computing ids from
`assign_backlog_ids`. Without the flag the script behaves as before (tier-based
id assignment). The `--fault-area <area>` selector picks the architectural root,
fault-area node, and every localized leaf in one go.

**Step 6c — graduate the investigation docs** (reads the export summary, copies
staged docs to `backlog/` for each funded architectural root):

```bash
node --import tsx .claude/skills/plan/scripts/graduate_group_docs.ts \
  --export-summary /tmp/export_summary_<area>.json
```

This copies `~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md` to
`backlog/docs/TASK-<id>-<slug>-refactor.md` and `comprehension.html` to
`backlog/tasks/task-<id>.overview.html`, using the backlog ids just minted by
step 6b. Groups with no staged docs (investigation did not run, or already
graduated) are silently skipped — the script is idempotent. Only funded groups'
docs land in `backlog/`; unfunded groups' investigation stays in the
`~/.ariadne/plan/prioritize/` staging area.

## Selectors

| Flag                          | Selects                                           |
| ----------------------------- | ------------------------------------------------- |
| `--status proposed\|accepted` | rows in that lifecycle state                      |
| `--fault-area <area>`         | rows in one `AriadneFaultArea`                    |
| `--priority core\|classifier` | core-fix rows, or classifier-authoring rows       |
| `--id <db-task-id>`           | one exact row (repeatable); overrides the filters |
| `--dry-run`                   | list the selection, write nothing                 |

With no selectors, every exportable (`proposed`/`accepted`) row is selected —
always preview that with `--dry-run` first.
