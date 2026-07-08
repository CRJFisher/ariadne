---
name: prioritize
description: Review the plan engine's task-DB and promote selected PlanTask rows into the user's backlog/. Drives export_to_backlog.ts — the only writer of backlog/, run deliberately by the human when graduating planned work.
argument-hint: "[--status proposed|accepted] [--fault-area <area>] [--id <db-task-id>...] [--dry-run]"
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
refactoring work (the pipeline below). A **permanent-limitation** group — a call
relationship fundamentally unknowable to static analysis, not a fixable Ariadne
bug, marked `is_permanent_limitation` by the plan engine and confirmed by the
human — does not become a backlog card at all. It becomes a **classifier
registry entry**: for these groups, dispatch the `classifier-author` agent in
place of `refactor-investigator`, producing a staged draft the human reviews and
applies via `reconcile-registry --stage` (see "Permanent-limitation groups"
below).

## What the export does

The backlog card body is **always** the architect's authored imperative work plan
— `task_assignment.json`, produced by `refactor-task-architect` from the verified
`refactor_plan.md`. The export adapter renders the card verbatim from that authored
content; it never falls back to the plan engine's cheap, pre-investigation
`PlanTask.body`. So a real export **requires** `--assignments <file>` and the
explicit `--write` opt-in. Without `--assignments`, `--dry-run` lists the candidate
rows whose ids the architect has not yet authored; with `--assignments` but without
`--write`, the script renders the would-be card bodies (title + acceptance
criteria) for the per-cluster human read (step 7a.5) and writes nothing.

A real (`--assignments --write`) run, for each authored backlog task:

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
(timestamp resolved) wherever the steps below write `<root>`. The timestamp
segment is the invocation's `<run>` id — `<root>` equals
`~/.ariadne/prioritize/<run>/` — so a step that writes `<run>` (step 3a's
dispatch) resolves by the same substitution.

The division of labour stays clean. The `plan` engine remains the cheap,
planning-only router-and-estimator — its strategist gains nothing here. All deep
design lives in `prioritize`, which is already the write-capable, human-invoked
side of the boundary (it owns `export_to_backlog.ts`, the only writer of
`backlog/`).

Always invoke with `node --import tsx`. Never `pnpm exec tsx` or `npx tsx`
(those open IPC sockets the sandbox blocks).

### Resuming a crashed run

A prioritize run fans out expensive opus/200-turn sub-agents (an investigator or
classifier-author per group in step 3/3a, an architect per cluster in step 7a).
A session death mid-fan-out must not re-spend the investigations that already
finished. Resume is idempotent by construction:

- **Find the crashed run's root, don't mint a new timestamp.** To resume, list
  `~/.ariadne/prioritize/` and take the most recent timestamp dir whose
  `run.json` shows unfinished waves (a `dispatched` area with no matching
  `completed`); reuse that path as `<root>` instead of taking a fresh `date -u`
  stamp. A fresh root re-does everything; the prior root already holds the
  finished outputs.
- **Skip a dispatch whose output already exists.** Before dispatching any agent
  in steps 3, 3a, and 7a, check for its output file and **skip the dispatch when
  the file exists and looks complete** (per-step predicates below). These outputs
  are single-writer, whole-file writes by one sub-agent via the harness `Write`
  tool — not atomic temp+rename — so a crash mid-write can leave a partial file.
  Non-emptiness is therefore a completion _heuristic_, not a guarantee: skip on a
  non-empty, well-formed file, but re-dispatch a zero-byte or visibly truncated
  one. The cross-group `consolidation.json` (step 4) is NOT trusted blindly on
  resume — re-run step 4.5's `validate_consolidation` over it (and re-dispatch the
  consolidator if it fails) rather than accept a possibly partial map.
- **`run.json` is the resume lookup.** Maintain a `<root>/run.json` manifest so
  resume is a lookup, not a filesystem scan. After each wave in steps 3/3a/7a
  completes, stamp the manifest with what was dispatched and what completed:

  ```json
  {
    "run": "<timestamp>",
    "investigate": { "dispatched": ["<fault_area>", …], "completed": ["<fault_area>", …] },
    "classifier_author": { "dispatched": ["<group_id>", …], "completed": ["<group_id>", …] },
    "architect": { "dispatched": ["<slug>", …], "completed": ["<slug>", …] }
  }
  ```

  On resume, read `run.json` first: an area in `completed` needs no dispatch. The
  on-disk output check above is the backstop when `run.json` itself is stale (it
  is written after a wave, so a crash mid-wave leaves finished outputs a later
  scan still finds). Write it with the `Write` tool (a plain per-run scratch
  file; it is not the classifier registry and no lock applies).

### 1. Preview the candidates

Run with filters and `--dry-run`. This lists the candidate rows and writes
nothing — the raw prioritization view. Backlog ids are not yet known (the
architect authors them in step 6a), so the preview reports only the row ids.

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --status proposed --dry-run
```

The output lists each candidate as `{id, backlog_task: "", path: ""}`; read the
source rows (step 2) for the grouping signal. The summary also carries a
`skipped_permanent_limitation` array — the ids of rows the plan engine marked
`is_permanent_limitation`. These never appear in the candidate list (they are
never exportable) and route through step 3a instead of the backlog pipeline;
read their ids here to build the permanent-limitation worklist.

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
  permanent-limitation and taxonomy-extension rows, where blast radius is not
  meaningful.
- **Kind** — `is_permanent_limitation` marks a group whose call relationship is
  fundamentally unknowable to static analysis: no core fix is possible, the
  registry classifier is the durable deliverable, and the group routes to
  step 3a instead of the backlog pipeline. Such rows arrive via the step-1
  `skipped_permanent_limitation` array, not the candidate list — fetch them
  directly at `~/.ariadne/plan/tasks/<id>.json` and group them by `fault_area`
  the same way.

### 3. Deep-investigate each change group

The plan engine produced each group cheaply — its strategist trusts the triage
evidence rollup and never reads the cited files front to back, so the architectural
node's body is a _hypothesis about the fix_, not a verified design. Turn it into a
real design before the user decides.

Dispatch one `Task(refactor-investigator)` per change group whose rows carry
`is_permanent_limitation: false` (a `true` group routes to step 3a instead), all
groups in one message so they run in parallel (cap at ~5 concurrent; drain in
waves if there are more). **Resume skip:** before dispatching a group, if
`<root>/<fault_area>/refactor_plan.md` already exists and is non-empty, the
investigation finished on a prior run — skip the dispatch and reuse it (the agent
overwrites unconditionally when dispatched, so the skip must happen here, in the
orchestrator). Each sub-agent reads its group's rows, gets to grips with the real
`packages/core` code, and writes a Markdown refactoring plan to
`<root>/<fault_area>/refactor_plan.md`. Dispatch prompt:

> Investigate change group `<fault_area>` and write its refactoring plan. The
> group's rows are at `<row_path>`, `<row_path>`, … (the architectural root, its
> fault_area node, and the localized leaves). Read every row and its evidence,
> investigate the owning `ARIADNE_FAULT_AREA_FOLDER[<fault_area>]` code, trace each
> false-positive to its root cause, and design the single coherent change that
> resolves the whole group at the right altitude — validating or collapsing the
> plan's decomposition (catch over-decomposition, dead code, duplicate builders).
> Write the plan to `<root>/<fault_area>/refactor_plan.md`, write a strict-parsed
> `verdict.json` beside it (`{outcome: "fixable" | "permanent_limitation",
> boundary, row_ids}` — every row id in the group), and return your one-line root
> cause + decomposition verdict. If the whole group turns out to be a permanent
> limitation — no realistic resolver change would let Ariadne resolve these
> callers — do not design a refactor: write `refactor_plan.md` as a single
> permanent-limitation verdict naming the static boundary, and set
> `verdict.json`'s `outcome` to `"permanent_limitation"` so the group reroutes to
> `classifier-author` (step 3a) instead of graduating.

The **`verdict.json` file** — not the returned prose line — drives routing. A
group whose verdict is `permanent_limitation` leaves the backlog pipeline: it does
not proceed to consolidation or export; the human redispatches it through step
3a's `classifier-author` flow, using the same group's `PlanTaskEvidence` rows as
the samples. This is the symmetric backstop to that agent's "if fixable, stop"
gate — a fixable bug misrouted to `classifier-author` is caught there, and a true
limitation misrouted here is caught by the investigator's verdict, so neither
routing error silently produces the wrong artifact.

Wait for every `Task()` in a wave to return before starting the next wave.
**All step-3 waves must complete before step 3.5.**

### 3.5. Reconcile verdicts against the mint-time flags

The investigation is now authoritative; the plan-engine mint-time
`is_permanent_limitation` flag on each row may disagree with it (a group minted
`fixable` that investigates as a permanent limitation, or the reverse). Reconcile
them so the export gate (`select_exportable_tasks`, which keys on the flag) agrees
with the investigation:

```bash
node --import tsx .claude/skills/plan/scripts/apply_investigation_verdicts.ts \
  --verdict <root>/<fault_area>/verdict.json <root>/<other_fault_area>/verdict.json … \
  --reroutes <root>/reroutes.json
```

It flips each disagreeing row's flag through the task-DB writer and records the
disagreement in `<root>/reroutes.json`. A row flipped **to** permanent-limitation
now routes to step 3a, not consolidation; `validate_consolidation` (step 4.5)
reads `reroutes.json` to keep such a row out of every cluster. Run `--dry-run`
first to preview the flips. **All step-3 waves must complete before consolidation
(step 4) is dispatched.** The consolidator reads every group's plan front to back
to judge linkage, so all plans must be on disk first.

### 3a. Permanent-limitation groups (`classifier-author`)

**The routing signal.** The plan engine marks each group's rows with
`is_permanent_limitation` — `true` when the call relationship is fundamentally
unknowable to static analysis (no realistic resolver fix is possible; see
`.claude/rules/classifier-lifecycle.md`), `false` for ordinary core-fix work.
The flag is the **routing default**: a `true` group defaults here (its durable
deliverable is a registry classifier, and it never graduates to `backlog/`), a
`false` group defaults to `refactor-investigator` (step 3). The `true` groups
surface in the step-1 dry run's `skipped_permanent_limitation` array — fetch
those rows directly at `~/.ariadne/plan/tasks/<id>.json` (step 2's Kind bullet);
they are never in the candidate list.

**The human is the final adjudicator, not the flag.** The default is a starting
point, not an automatism: before dispatch, confirm each `true` group really is
out of static reach, and re-route a mis-marked group in either direction. The
agent gates then backstop the call: a fixable bug misrouted here is caught by
`classifier-author`'s "if fixable, stop — emit no draft" gate, and a true
permanent limitation misrouted to step 3 is caught by the investigator's
`verdict.json` (`outcome: "permanent_limitation"`), which step 3.5 reconciles —
flipping the row's flag and rerouting the group here. Neither routing error
survives to the wrong artifact, but each costs a wasted dispatch — make the call
deliberately.

Such a group never graduates to `backlog/`. Dispatch one
`Task(classifier-author)` per confirmed permanent-limitation group. **Resume
skip:** before dispatching a group, if
`~/.ariadne/prioritize/<run>/classifier-author/<group_id>/REVIEW.md` already
exists and is non-empty, the agent finished on a prior run (it writes `REVIEW.md`
on both the `drafted` and `no-draft` outcomes) — skip the dispatch and reuse the
staged outputs (`draft_entry.json` + `check_<group_id>.ts` when drafted, or the
`no-draft` `REVIEW.md` verdict otherwise). The samples
come from the group's rows' `PlanTaskEvidence`: each evidence row carries its
own `project`, `run_id`, and stable `member_symbol` (`file_path`, `name`,
`kind`, `start_line`), so one group's samples may span several projects and
triage runs. Dedup the rows by `member_symbol` and cap at ~5 representative
samples for a large group. Mint the `<group_id>` yourself — a fresh kebab-case
id naming the limitation pattern (it names the staging directory and the future
registry rule; it is authored here, not looked up). `<run>` is this
invocation's staging timestamp (the Staging root above); each sample's
`<run_id>` is its own evidence row's triage run. Triage runs are pruned, so a
sample's run may no longer resolve — the agent discovers that at fetch time,
skips the sample, and notes it in `REVIEW.md`; a group whose samples all fail
to resolve comes back `no-draft`. Report such a group in the run summary and
re-run triage to mint fresh samples before retrying it. Dispatch prompt:

> Author a builtin classifier for permanent-limitation group `<group_id>`.
> Write your three staging artifacts to
> `~/.ariadne/prioritize/<run>/classifier-author/<group_id>/`. The group's
> sample members are listed below — fetch each one's context with
> `node --import tsx .claude/skills/triage/scripts/get_entry_context.ts --project <project> --run-id <run_id> --file <file_path> --name <name> --kind <kind> --line <start_line>`:
>
> - project `<project>`, run `<run_id>`, member `<file_path>` `<name>` `<kind>` `<start_line>`
> - … (one line per sample, from the evidence rows' `member_symbol`)
>
> Study the shared false-positive pattern across every sample and confirm it is
> a permanent limitation (out of static reach — no realistic resolver fix). If
> it is actually a fixable bug, write only `REVIEW.md` saying so and draft
> nothing else. Return your one-line `done <group_id>: drafted` / `no-draft`
> verdict.

The agent reads `packages/core` and each sample's triage entry context and
writes a **staged draft** — never the registry — to:

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

Before dispatching, **persist the investigated groups** the consolidator (and the
step-4.5 validator) partition against — write `<root>/groups.json`, one entry per
investigated group: `[{ fault_area, plan_path, row_ids }]` (the same `row_ids` you
list in the dispatch prompt below). This is the authoritative investigated-row-id
universe: `validate_consolidation` checks the clusters partition it exactly.

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

### 4.5. Validate the consolidation

`consolidation.json`'s ids reach export only via human copy-paste into `--id`
flags, so a row dropped from every cluster silently never exports and a
double-assigned row exports twice. Validate the map before trusting it:

```bash
node --import tsx .claude/skills/plan/scripts/validate_consolidation.ts \
  --consolidation <root>/consolidation.json \
  --groups <root>/groups.json \
  --reroutes <root>/reroutes.json
```

It fails (exit 1, `issues[]` on stdout) on a dropped row, a double-assigned row,
an unknown id, a missing `plan_path`, a bad or duplicate `slug`, or a
permanent-rerouted id that leaked into a cluster. Fix the consolidation
(re-dispatch the consolidator, or correct the map) until it passes, then proceed.
**Re-run this same command as an export precondition** in step 7b — the map must
still validate at write time.

### 5. Render a comprehension doc per cluster

For each cluster in `consolidation.json`, dispatch one
`Task(refactor-comprehension-author)` to render a self-contained HTML
comprehension doc from that cluster's `plan_path` (a merged
`consolidated_plan.md` or a singleton's `refactor_plan.md`). Pass the exact
staging target `backlog/docs/<slug>.comprehension.html` (`<slug>` is the
cluster's `consolidation.json` `slug`; a singleton's is its `fault_area`) — the
filename is the
graduation contract (`graduate_group_docs.ts` moves exactly that path in 7c; a
mismatch is a silent `skipped_no_src`). The doc is staged in the repo so the
user can open it from their tree while deciding; the `*.comprehension.html`
glob is gitignored, so a staging never lands in a commit until graduation moves
a funded cluster's doc into `backlog/tasks/`. Dispatch prompt:

> Render the comprehension doc for cluster `<slug>`. The plan is at
> `<plan_path>`. Write the self-contained HTML to
> `backlog/docs/<slug>.comprehension.html`. For a merged cluster, the member
> fault areas are `<member_fault_areas>` and the sub-task work order is
> `<ordering>`. Reply `wrote <slug>.comprehension.html`.

Then author one **index** comprehension doc (written to
`<root>/comprehension_index.html` and opened)
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
for all to finish. Step 7a.5 surfaces each authored cluster for a human read before
any write. Steps 7b and 7c then run per confirmed cluster, one at a time.

**Step 7a — author the backlog tasks** (one `refactor-task-architect` per confirmed cluster):

Dispatch one `Task(refactor-task-architect)` per confirmed cluster. **Resume
skip:** before dispatching a cluster, if its `task_assignment.json` (beside the
plan) already exists and is non-empty, the architect finished on a prior run —
skip the dispatch and reuse it. The agent
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
complete before proceeding to 7a.5.

**Step 7a.5 — per-cluster human read** (before any write):

The cards are judge prose exported verbatim, and the funding decision (step 6)
predated the authoring it funds. Give the human the last look. For each confirmed
cluster, run the export in **preview mode** — `--assignments` WITHOUT `--write` —
so it renders the would-be card bodies (title + acceptance criteria) and writes
nothing:

```bash
node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --id <row_id> --id <row_id> … \
  --assignments <root>/clusters/<slug>/task_assignment.json
```

Surface each cluster's rendered `exported[]` (each entry's `title` +
`acceptance_criteria`) through `AskUserQuestion` — approve / edit / skip. On
**edit**, the human revises `task_assignment.json` (or you do, at their direction)
and re-run the preview. On **skip**, drop the cluster from this run's write set.
Only approved clusters proceed to 7b. This is the same DIFF-channel treatment the
registry gets from `--stage`.

**Step 7b — export the rows** (one run per approved cluster):

Re-run the step-4.5 validator as the export precondition (the map must still
validate at write time), then export **with `--write`**:

```bash
node --import tsx .claude/skills/plan/scripts/validate_consolidation.ts \
  --consolidation <root>/consolidation.json --groups <root>/groups.json \
  --reroutes <root>/reroutes.json

node --import tsx .claude/skills/plan/scripts/export_to_backlog.ts \
  --id <row_id> --id <row_id> … \
  --assignments <root>/clusters/<slug>/task_assignment.json --write \
  > "<root>/export_summary_<slug>.json"
```

Both `--assignments` and `--write` are **required** for a write: `--assignments`
supplies the authored `tasks[]` that become the backlog cards, and `--write` is the
opt-in past the preview (plain `--assignments` only renders card bodies — that is
step 7a.5). Select the cluster's rows by repeating `--id` for every id in the
cluster's `member_row_ids` — this spans a merged cluster's multiple fault areas in
one run, and every selected id must be claimed by some authored task or the export
errors. (For a singleton cluster `--fault-area <area>` selects the same rows.)
Redirect the summary to `<root>/export_summary_<slug>.json` — the run's staging
root already used throughout steps 3–7 — and use that path in 7c.

**Step 7c — graduate the comprehension doc** (reads the export summary, moves the
staged comprehension doc beside the epic for each funded cluster):

```bash
node --import tsx .claude/skills/plan/scripts/graduate_group_docs.ts \
  --slug <slug> \
  --export-summary "<root>/export_summary_<slug>.json"
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

| Flag                          | Selects                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `--status proposed\|accepted` | rows in that lifecycle state                                          |
| `--fault-area <area>`         | rows in one `AriadneFaultArea`                                        |
| `--id <db-task-id>`           | one exact row (repeatable); overrides the filters                     |
| `--assignments <file>`        | authored `tasks[]`; renders card previews (no write on its own)       |
| `--write`                     | opt-in past the preview; **required to write** (with `--assignments`) |
| `--dry-run`                   | list the selection, write nothing (wins over `--write`)               |

With no selectors, every exportable (`proposed`/`accepted`) row is selected —
always preview that with `--dry-run` first. A write requires both `--assignments`
and `--write`; `--assignments` alone renders the card previews, and no
`--assignments` only previews the candidate rows.
