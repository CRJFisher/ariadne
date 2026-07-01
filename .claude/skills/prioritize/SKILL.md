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

It does three things the `plan` engine deliberately does not: it
**deep-investigates each change group against the real `packages/core` code** (via
the `refactor-investigator` sub-agent) to produce a concrete refactoring plan, it
**consolidates across those investigations** (via the `refactor-consolidator`
sub-agent) to decide which groups are linked and must graduate as one epic, and it
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

**Two graduation destinations.** Most groups graduate into `backlog/` as
refactoring work (the pipeline below). A group the human tags as a **permanent
limitation** — a call relationship fundamentally unknowable to static analysis,
not a fixable Ariadne bug — does not become a backlog card at all. It becomes a
**classifier registry entry**: for these groups, dispatch the `classifier-author`
agent in place of `refactor-investigator`, producing a staged draft the human
reviews and applies via `reconcile-registry --stage` (see
"Permanent-limitation groups" below).

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
3. stamps the verbatim `dedup_key` of each source group's architectural row into
   the `plan_dedup_keys` list — the idempotency link (one entry per group, so a
   consolidated epic records every group it graduated),
4. flips **every** claimed source row `→ exported` (recording
   `exported_backlog_task`) and logs one `export` `PlanSweepEvent` per row.

So a graduated cluster lands as **one epic** (the fundamental refactor) with the
genuinely-separate downstream adaptations — and, for a consolidated cluster, each
linked group — nested beneath it as ordered sub-tasks, the split the architect
chose, not the plan tier tree. The collapsed rows (fault-area node, merged leaves)
write no file of their own; they fold into the epic and are still flipped to
`exported`.

Only `proposed` and `accepted` rows are exportable. A row already `exported`, or
whose `dedup_key` a backlog task already carries, is dropped from the selection —
so its authored task finds no still-exportable rows and a re-run with the same
arguments is a no-op. Every selected row must be claimed by some authored task's
`plan_task_ids`, or the export errors (the architect's map is incomplete).

## Workflow

Prioritization is a conversation, not a single command. You build the picture of
the candidate work, **deep-investigate each change group against the real
`packages/core` code** to turn the plan's cheap routing-and-sizing into a
concrete refactoring design, **consolidate across those designs** to decide which
groups are linked and become one epic, hand the user a comprehension doc per
cluster to grasp it, decide together which clusters graduate, then promote exactly
that set — each funded cluster becoming backlog tasks authored from its verified
design, with the comprehension doc graduated alongside the epic.

The deep investigation runs on **every** candidate group, before the funding
decision, so the user decides with full designs in hand. This is a deliberate
cost: a group the user does not fund is still investigated. The fault-area count
per sweep bounds the fan-out (a handful of groups), and the plan's
`core_fix_effort` estimate already pre-filters the trivially cheap fixes, so the
spend buys decision quality on the changes that actually carry blast radius.

Consolidation runs **after** the per-group investigations, because the signal for
linkage — a shared core surface, a feeder→consumer dependency, a deeper root cause
spanning two areas — only becomes visible once each group has been designed
against the real code. It is the one stage that reasons across groups: the
investigators run in parallel, each blind to the others, so without it two linked
groups would graduate as two unordered epics with their dependency lost and any
shared refactor authored twice.

### Staging root

Mint one staging root per invocation so runs never collide and each leaves an
audit trail. At the start, take a UTC timestamp (`date -u +%Y%m%dT%H%M%SZ`) and use

```text
~/.ariadne/prioritize/<timestamp>/
```

as the run's root for everything below. Each investigated group writes under
`<root>/<fault_area>/`; the consolidator writes `<root>/consolidation.json` and a
`<root>/clusters/<slug>/` folder per merged cluster. Use this concrete path
(timestamp resolved) wherever the steps below write `<root>`.

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
`<root>/<fault_area>/refactor_plan.md`. Dispatch prompt:

> Investigate change group `<fault_area>` and write its refactoring plan. The
> group's rows are at `<row_path>`, `<row_path>`, … (the architectural root, its
> fault_area node, and the localized leaves). Read every row and its evidence,
> investigate the owning `ARIADNE_FAULT_AREA_FOLDER[<fault_area>]` code, trace each
> false-positive to its root cause, and design the single coherent change that
> resolves the whole group at the right altitude — validating or collapsing the
> plan's decomposition (catch over-decomposition, dead code, duplicate builders).
> Write the plan to `<root>/<fault_area>/refactor_plan.md` and return your
> one-line root cause + decomposition verdict.

Wait for every `Task()` in a wave to return before starting the next wave.
**All step-3 waves must complete before consolidation (step 4) is dispatched.**
The consolidator reads every group's plan front to back to judge linkage, so all
plans must be on disk first.

### 3a. Permanent-limitation groups (`classifier-author`)

A change group the human identifies as a **permanent limitation** (see
`.claude/rules/classifier-lifecycle.md`) routes differently: it never graduates
to `backlog/`. Instead of a `Task(refactor-investigator)`, dispatch one
`Task(classifier-author)` per such group. The agent reads `packages/core` and
the group's triage entry context (`get_entry_context.ts`) and writes a **staged
draft** — never the registry — to:

```text
~/.ariadne/prioritize/<run>/classifier-author/<group_id>/
```

containing `draft_entry.json` (a complete `KnownIssue` with a `builtin`
classifier), `check_<group_id>.ts` (the `BuiltinCheckFn` to place under
`packages/core/src/classify_entry_points/builtins/`), and `REVIEW.md` (why the
pattern is a permanent limitation, which entries it matched, a review checklist).

The human then reviews the draft, places the builtin and rebuilds core
(`pnpm build --filter core`), and applies the entry with
`reconcile-registry --stage` (see `.claude/skills/reconcile-registry/SKILL.md`).
These groups do **not** flow into steps 4–7 (consolidation, comprehension docs,
export) — those operate only on backlog-bound groups.

### 4. Consolidate into epics

The investigators ran in parallel, each blind to the others. This is the one stage
that reads **across** them, to decide the epic boundaries: which groups are
independent (each its own epic) and which are **linked** and must graduate as
**one epic with ordered sub-tasks**. Top-level backlog ids carry only creation
order; order is meaningful _within_ an epic, where sub-task ordinals are the work
sequence. So linked work — groups that share a core surface, or whose fixes have a
feeder→consumer dependency, or that a deeper root cause unifies — belongs under one
epic; independent work stays separate, and a loose preference to do one epic before
another is left unstated (it carries no obligation).

With only one investigated group there is nothing to consolidate — skip to step 5.
Otherwise dispatch one `Task(refactor-consolidator)` over the whole set:

> Consolidate the investigated change groups for this prioritize run. The staging
> root is `<root>`. The groups are: `<fault_area>` (plan `<root>/<fault_area>/refactor_plan.md`,
> rows `<row_id>`…), `<fault_area>` (plan …, rows …), … — one entry per
> investigated group with its plan path and row ids. Read every plan, decide the
> epic boundaries (merge only on a code-cited shared surface or load-bearing
> dependency; default to independent), write a `consolidated_plan.md` for each
> merged cluster, and write the cluster map to `<root>/consolidation.json`. Return
> how many groups in, how many epics out, and one line per merge.

The consolidator merges conservatively — over-consolidation is as harmful as
over-decomposition. Its `<root>/consolidation.json` is the spine of the rest of
the run: each `clusters[]` entry is one epic, carrying its `member_fault_areas`,
the union `member_row_ids`, the `plan_path` (a merged `consolidated_plan.md` or a
singleton's own `refactor_plan.md`), a `rationale`, and a suggested cross-cluster
`ordering`. Steps 5–7 iterate clusters, not raw groups.

### 5. Render a comprehension doc per cluster

For each cluster in `consolidation.json`, dispatch one sub-agent to render a
self-contained HTML comprehension doc from that cluster's `plan_path` (a merged
`consolidated_plan.md` or a singleton's `refactor_plan.md`), written to
`backlog/docs/<slug>.comprehension.html` (in the repo, so the user can open it
from their tree while deciding; the `*.comprehension.html` glob is gitignored, so a
staging never lands in a commit until graduation moves a funded cluster's doc into
`backlog/tasks/`). Pick a comprehension-doc specialist sub-agent if your
environment offers one; otherwise a general-purpose sub-agent following these
instructions produces the same artifact. Each doc presents:

- a before/after pair of diagrams showing the change in functionality, grounded in
  the plan's chosen mechanism,
- the impact — the false-positives it removes and how broadly, stated concretely
  (e.g. "eliminates 14 false unreachable-function flags across 6 projects"),
- the cost/blast-radius and whether it is a core fix or interim classifier work,
- for a merged cluster, **why its groups are linked** (the shared surface or
  dependency) and the sub-task work order,
- a clear benefit-vs-cost framing so the user can rank clusters against each other.

Then author one **index** comprehension doc (written to a temp path and opened)
that links every cluster's doc and presents the clusters in `consolidation.json`'s
suggested `ordering` — upstream work first — with impact-to-cost as the secondary
sort. Keep it scannable: a decision aid, not a transcript of the rows.

### 6. Decide together

Walk the user through the comprehension docs — now backed by verified refactor
designs and the consolidation's epic boundaries — and use `AskUserQuestion` to
settle which clusters graduate this run. Offer the clusters as options (and let
the user pick multiple), surfacing the impact-vs-cost tradeoff and, for merged
clusters, the linkage in each option so the choice is informed. The suggested
`ordering` is a recommendation the user may override; it shapes how you present the
options, never a gate. If the user wants to inspect or re-cut the set, narrow with
the selectors below and re-run `--dry-run`. Do not promote until the user has
confirmed the set.

### 7. Promote

Step 7a dispatches one architect per confirmed cluster, all in parallel, and waits
for all to finish. Steps 7b and 7c then run per confirmed cluster, one at a time.

**Step 7a — author the backlog tasks** (one `refactor-task-architect` per confirmed cluster):

Dispatch one `Task(refactor-task-architect)` per confirmed cluster. The agent
reads the full plan at the cluster's `plan_path`, applies the natural-split
criterion — one top-level task for the fundamental refactor, sub-tasks only for
genuinely separate downstream adaptations (for a merged cluster, the linked groups
become the epic's ordered sub-tasks) — and **authors each task as an imperative
work plan** (title + body + acceptance criteria) transformed from the verified
design. It writes a `tasks[]` assignment file with relative ids to
`task_assignment.json` beside the plan. The plan engine's tier labels are a routing
concept, not the splitting axis; the cheap `PlanTask.body` is never carried over.
Dispatch prompt:

> Author the backlog tasks for cluster `<slug>`. The plan is at `<plan_path>`. The
> plan task ids for this cluster are: `<row_id>`, `<row_id>`, … (its
> `member_row_ids` from `consolidation.json`). Apply the natural-split criterion,
> author each task's imperative work plan from the plan — each work plan must
> include an explicit step to add integration tests (and any supporting fixture
> updates) demonstrating the fix handles every case in the group's triage
> evidence — and write the task_assignment.json (a `tasks[]` array, every row id
> claimed by exactly one task's `plan_task_ids`) beside the plan.

Run these architects in parallel (one message per cluster) and wait for all to
complete before proceeding to 7b.

**Step 7b — export the rows** (one run per confirmed cluster):

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --id <row_id> --id <row_id> … \
  --assignments <root>/clusters/<slug>/task_assignment.json \
  > "$SCRATCH/export_summary_<slug>.json"
```

`--assignments` is **required** for a write: it supplies the authored `tasks[]`
that become the backlog cards (without it the script only previews candidates).
Select the cluster's rows by repeating `--id` for every id in the cluster's
`member_row_ids` — this spans a merged cluster's multiple fault areas in one run,
and every selected id must be claimed by some authored task or the export errors.
(For a singleton cluster `--fault-area <area>` selects the same rows.) Redirect the
summary into your scratchpad directory (the sandbox blocks `/tmp`); use that path
in 7c.

**Step 7c — graduate the comprehension doc** (reads the export summary, moves the
staged comprehension doc beside the epic for each funded cluster):

```bash
node --import tsx .claude/skills/plan/scripts/graduate_group_docs.ts \
  --slug <slug> \
  --export-summary "$SCRATCH/export_summary_<slug>.json"
```

`--slug` is the cluster's slug (its `consolidation.json` `slug`; a singleton's is
its `fault_area`) — the stable key the comprehension doc was staged under. The
script **moves** `backlog/docs/<slug>.comprehension.html` to
`backlog/tasks/task-<id> - <title-slug>.overview.html` — sharing the epic's
filename prefix (derived from the epic's rendered `.md` path, found as the
cluster's one top-level `TASK-<n>`) so it sorts beside it in folder views. The
move consumes its staged source, so the funded cluster's comprehension HTML leaves
`backlog/docs/` entirely. The verified plan is **not** copied into the repo — the
epic's card is already its imperative transformation, so an in-repo design doc
would duplicate it; the plan stays in `~/.ariadne` staging as the investigation
record. A cluster with no staged comprehension doc (already graduated) is silently
skipped — the script is idempotent. An unfunded cluster's
`<slug>.comprehension.html` stays in `backlog/docs/` as a local-only file
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
