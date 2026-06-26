---
name: prioritize
description: Review the plan engine's task-DB and promote selected PlanTask rows into the user's backlog/. Drives export_to_backlog.ts — the only writer of backlog/, run deliberately by the human when graduating planned work.
argument-hint: "[--status proposed|accepted] [--fault-area <area>] [--priority core|classifier] [--id <db-task-id>...] [--dry-run]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), AskUserQuestion, Read, Write, Bash(open:*), Task
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

```text
.claude/skills/plan/scripts/export_to_backlog.ts
```

That script is the **only writer of `backlog/tasks/`** in the pipeline. It is
never run on the autonomous sweep — graduation is always a human decision, which is
what this skill exists to make. The investigation is design-only: the
`refactor-investigator` reads `packages/core` but never writes it, and the
comprehension doc it stages graduates into `backlog/` only for the groups the
user funds.

## What the export does

The backlog card body is **always** the architect's authored imperative work plan
— `task_assignment.json`, produced by `refactor-task-architect` from the verified
`refactor_plan.md`. The export adapter renders the card verbatim from that authored
content; it never falls back to the plan engine's cheap, pre-investigation
`PlanTask.body`. So a real export **requires** `--assignments <file>`; without it
the script runs preview-only (`--dry-run`), listing the candidate rows whose ids
the architect has not yet authored.

A real (`--assignments`) run, for each authored backlog task:

1. resolves the architect's relative ids (`"1"`, `"1.1"`) to absolute backlog ids:
   a top-level task takes the next free id (`TASK-347`); a sub-task nests as
   `TASK-347.1`, carrying a `parent_task_id` link and an `ordinal`,
2. writes `backlog/tasks/<dotted-id> - <slug>.md`, rendered from the authored
   `title` / `description_md` / `acceptance_criteria`,
3. stamps the verbatim `dedup_key` of the task's lowest-tier (architectural) source
   row into `plan_dedup_key` — the idempotency link,
4. flips **every** claimed source row `→ exported` (recording
   `exported_backlog_task`) and logs one `export` `PlanSweepEvent` per row.

So a graduated change group lands as **one epic per group** (the fundamental
refactor) with the genuinely-separate downstream adaptations nested beneath it as
sub-tasks — the split the architect chose, not the plan tier tree. The collapsed
rows (fault-area node, merged leaves) write no file of their own; they fold into
the epic and are still flipped to `exported`.

Only `proposed` and `accepted` rows are exportable. A row already `exported`, or
whose `dedup_key` a backlog task already carries, is dropped from the selection —
so its authored task finds no still-exportable rows and a re-run with the same
arguments is a no-op. Every selected row must be claimed by some authored task's
`plan_task_ids`, or the export errors (the architect's map is incomplete).

## Workflow

Prioritization is a conversation, not a single command. You build the picture of
the candidate work, **deep-investigate each change group against the real
`packages/core` code** to turn the plan's cheap routing-and-sizing into a
concrete refactoring design, hand the user a comprehension doc per group to grasp
it, decide together which groups graduate, then promote exactly that set — each
funded group becoming backlog tasks authored from its verified design, with the
comprehension doc graduated alongside the epic.

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

Run with filters and `--dry-run`. This lists the candidate rows and writes
nothing — the raw prioritization view. Backlog ids are not yet known (the
architect authors them in step 6a), so the preview reports only the row ids.

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --status proposed --dry-run
```

The output lists each candidate as `{id, backlog_task: "", path: ""}`; read the
source rows (step 2) for the grouping signal.

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

For each investigated group, dispatch one sub-agent to render a self-contained
HTML comprehension doc from that group's `refactor_plan.md`, written to
`backlog/docs/<fault_area>.comprehension.html` (in the repo, so the user can open
it from their tree while deciding; the `*.comprehension.html` glob is gitignored,
so a staging never lands in a commit until graduation moves a funded group's doc
into `backlog/tasks/`). Pick a comprehension-doc specialist sub-agent if your
environment offers one; otherwise a general-purpose sub-agent following these
instructions produces the same artifact. Each doc presents:

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

Step 6a dispatches one architect per confirmed group, all in parallel, and waits
for all to finish. Steps 6b and 6c then run per confirmed group, one group at a
time.

**Step 6a — author the backlog tasks** (one `refactor-task-architect` per confirmed group):

Dispatch one `Task(refactor-task-architect)` per confirmed group. The agent reads
the full `~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md`, applies the
natural-split criterion — one top-level task for the fundamental refactor,
sub-tasks only for genuinely separate downstream adaptations — and **authors each
task as an imperative work plan** (title + body + acceptance criteria) transformed
from the verified design. It writes a `tasks[]` assignment file with relative ids
to `~/.ariadne/plan/prioritize/<fault_area>/task_assignment.json`. The plan
engine's tier labels are a routing concept, not the splitting axis; the cheap
`PlanTask.body` is never carried over. Dispatch prompt:

> Author the backlog tasks for change group `<fault_area>`. The refactor plan is
> at `~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md`. The plan task ids
> for this group are: `<row_id>`, `<row_id>`, … (architectural root, fault_area
> node, localized leaves — the ids from your step 2 grouping for this
> fault_area). Apply the natural-split criterion, author each task's imperative
> work plan from the refactor plan, and write the task_assignment.json (a
> `tasks[]` array, every row id claimed by exactly one task's `plan_task_ids`) to
> `~/.ariadne/plan/prioritize/<fault_area>/task_assignment.json`.

Run these architects in parallel (one message per group) and wait for all to
complete before proceeding to 6b.

**Step 6b — export the rows** (one run per confirmed group):

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --fault-area <area> \
  --assignments ~/.ariadne/plan/prioritize/<area>/task_assignment.json \
  > "$SCRATCH/export_summary_<area>.json"
```

`--assignments` is **required** for a write: it supplies the authored `tasks[]`
that become the backlog cards (without it the script only previews candidates).
The `--fault-area <area>` selector picks the architectural root, fault-area node,
and every localized leaf in one go — every one must be claimed by some authored
task, or the export errors. Redirect the summary into your scratchpad directory
(the sandbox blocks `/tmp`); use that path in 6c.

**Step 6c — graduate the comprehension doc** (reads the export summary, moves the
staged comprehension doc beside the epic for each funded group):

```bash
node --import tsx .claude/skills/plan/scripts/graduate_group_docs.ts \
  --export-summary "$SCRATCH/export_summary_<area>.json"
```

This **moves** `backlog/docs/<fault_area>.comprehension.html` to
`backlog/tasks/task-<id> - <slug>.overview.html` — sharing the epic's filename
prefix (derived from the epic's rendered `.md` path) so it sorts beside it in
folder views. The move consumes its staged source, so the funded group's
comprehension HTML leaves `backlog/docs/` entirely. The verified `refactor_plan.md`
is **not** copied into the repo — the epic's card is already its imperative
transformation, so an in-repo design doc would duplicate it; the plan stays in
`~/.ariadne` staging as the investigation record. Groups with no staged
comprehension doc (investigation did not run, or already graduated) are silently
skipped — the script is idempotent. An unfunded group's
`<fault_area>.comprehension.html` stays in `backlog/docs/` as a local-only file
(gitignored, never committed); delete it once the decision is made, or leave it as
a record of the investigation.

## Selectors

| Flag                          | Selects                                           |
| ----------------------------- | ------------------------------------------------- |
| `--status proposed\|accepted` | rows in that lifecycle state                      |
| `--fault-area <area>`         | rows in one `AriadneFaultArea`                    |
| `--priority core\|classifier` | core-fix rows, or classifier-authoring rows       |
| `--id <db-task-id>`           | one exact row (repeatable); overrides the filters |
| `--assignments <file>`        | authored `tasks[]`; **required to write**         |
| `--dry-run`                   | list the selection, write nothing                 |

With no selectors, every exportable (`proposed`/`accepted`) row is selected —
always preview that with `--dry-run` first. A write requires `--assignments`; a
run without it only previews the candidate rows.
