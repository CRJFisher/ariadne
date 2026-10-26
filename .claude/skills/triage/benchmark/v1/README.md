# Triage benchmark v1

63 frozen triage investigation cases with gold verdicts. The suite measures whether a change to the triage pipeline (model, prompt, context bundle, tools, dispatch loop) keeps the quality of its verdicts while it changes their cost. Run it before and after the change, and compare.

## What a case is

| File                     | Content                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cases/<case_id>.json`   | The exact `TriageEntry` an investigator receives (`entry`), its identity (`member_symbol`), the target (`github`, `commit`), its strata, and the verdicts earlier pipeline runs reached (`prior_verdicts`) with their turns and cost |
| `labels/<case_id>.json`  | The gold label: `gold_kind`, `acceptable_kinds`, `gold_rule_id`, `caller_evidence` (file:line of real callers), `confidence`, `rationale`                                                                                            |
| `registry_snapshot.json` | The classifier registry the labels were graded against. The runner refuses to run while the live registry differs from it                                                                                                            |
| `manifest.json`          | One row per case: strata, project, language, diagnosis, prior kinds, contested flag                                                                                                                                                  |
| `ADJUDICATE.md`          | The labelling protocol and the verdict definitions. Use it to add or re-label cases                                                                                                                                                  |
| `human_review.json`      | The human's deciding vote on each reviewed case, written by the review page                                                                                                                                                          |

Source code is not copied. A case names `owner/repo` and a commit, and every reader uses the clone under `~/.ariadne/triage-entrypoints/repos/<owner>--<repo>/`, rebasing any path recorded on another machine onto it. The runner refuses to run while a clone is off its pinned commit.

Every case entry carries the full diagnostics shape the investigation's first message renders: `grep_call_sites`, `grep_call_sites_outside_index`, `reference_sites` and `ariadne_call_refs`. The suite loader rejects a case that lacks one. The 25 cases frozen from July runs predate the last two lists; they carry them empty, which is what those runs recorded.

## Running it

```bash
node --import tsx .claude/skills/triage/scripts/run_benchmark.ts \
  --model claude-haiku-5-5 --effort medium --repeats 2 --max-usd 2
node --import tsx .claude/skills/triage/scripts/run_benchmark.ts \
  --model claude-haiku-4-5 --repeats 2 --max-usd 15
```

Each replay runs the pipeline's own investigation (`src/investigate/run_investigation.ts`) on the case's frozen entry, rebased onto the local clone, with the in-scope slice of the registry snapshot: the same constant system prompt, bounded first message, tools, turn cap and cache settings a triage run uses, through the same warm-up pool. `--effort` is required for a model with effort control and refused for `claude-haiku-4-5`, which runs with thinking disabled. The investigation's `read` and `grep` tools are confined to the clone, so it cannot reach this suite's case or label files.

Before any paid call the runner checks that the live registry matches the snapshot and that every clone is at its commit, and renders every pending case's context. During the run it stops at the first account error (spend, rate limit, auth) and once the run's spend reaches `--max-usd`. A replay that dies leaves no record, so `--resume <run_dir>` runs exactly the replays still missing; a record's missing verdict is always the investigation's own outcome.

A run lands in `~/.ariadne/triage-entrypoints/benchmark_runs/<started_at>--<model>[-<effort>]/`:

| Path                          | Content                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `run.json`                    | Model, effort, repeats, case ids, SDK version                                                                                        |
| `replays/<case_id>.r<n>.json` | The verdict (or the reason there is none), usage including the first turn's cache split, whether it led the pool, and the tool calls |
| `score.json`                  | The run graded against the labels, with spend and `prefix_miss`                                                                      |

## Scoring

```bash
node --import tsx .claude/skills/triage/scripts/score_benchmark.ts --run <run_dir>
node --import tsx .claude/skills/triage/scripts/score_benchmark.ts --prior latest   # or: all
```

The score reports verdict-kind accuracy against `acceptable_kinds` and against `gold_kind`, rule-id accuracy on accepted regressions, caller-file match on false positives, `fp-* -> tp` errors, missing verdicts, the cases whose repeats disagree, and per-slice and confusion breakdowns. `--run` grades against the labels as they are now and rewrites the run's `score.json`, so re-scoring after a label amendment needs no new replays.

## Reviewing labels

```bash
node --import tsx .claude/skills/triage/scripts/serve_benchmark_review.ts   # http://127.0.0.1:4310/
```

The review page compares each case's verdicts: both repeats of each benchmark run (the newest run per model and effort, or `--runs <dir,dir>`) and the Opus label. The reviewer casts the deciding vote: agree with one candidate verdict (a kind, plus a rule for a regression), or record that none fits. "None fits" is a finding about the taxonomy and requires feedback naming what does not fit (a verdict definition, a classifier rule, a diagnosis route) and what should change. Votes are written to `human_review.json` as they are cast.

The page has two levels:

- **Overview:** each model's agreement with the label, cost per case and missing verdicts, then every case grouped by the shape of its disagreement. Each group names the step of the verdict definitions it turns on: is there a real caller (tp against a false positive), does a rule cover it (regression against novel), which rule, a run that could not decide, or a flagged label everyone agrees with. A row shows the label and each run's verdict, with departures from the label highlighted, and the reviewer's vote. Cases where every verdict matches a high-confidence label need no vote and are listed under "All cases".
- **Case:** the group's question, a one-line summary of what each verdict says that opens into its full reasoning, evidence excerpt and tool calls, and the vote. Supporting material sits in collapsed sections below the vote. `Esc` returns to the overview where it was left, and `j`/`k` step through the cases in overview order.

The page teaches as the reviewer goes:

- **Work it through:** the verdict definitions as three questions (a real caller? reaching this definition? covered by a rule's intent?), with the verdict the answers point to.
- **Explainers:** every verdict kind, diagnosis route and rule is a term with its definition, drawn from `ADJUDICATE.md`, the investigator's diagnosis hints and the registry snapshot, and the glossary tab highlights the terms of the current case.
- **Ask Claude:** a session per case (Opus 5.5 by default, `--chat-model` to change) that has read the case and sees the reviewer's draft vote and any text selected on the page. It reads the target clone and Ariadne's source and never edits files. Sessions persist under `~/.ariadne/triage-entrypoints/benchmark_review/chats/`.

Verdicts frozen into the cases are listed under "Earlier pipeline verdicts", attributed by run date: the investigator ran on Sonnet until 2026-10-13 and on Haiku 4.5 after.

## Coverage

- **Languages:** JavaScript 18, TypeScript 17, Python 16, Rust 12.
- **Projects:** 37, at most 3 cases each.
- **Gold verdicts:** fp-novel 30, tp 19, fp-classifier-regression 14 (9 distinct rules).
- **Diagnoses:** all six routes. no-textual-callers 20, callers-in-registry-unresolved 19, callers-in-registry-wrong-target 8, callers-not-in-registry 7, references-without-call-syntax 5, callers-outside-indexed-corpus 4.
- **Hard slices:**
  - 10 cases that received different verdicts in different runs at the same commit.
  - 5 cases that took 25 or more worker turns.
  - 3 entries with over 40k characters of evidence, which overflow the bundle into a saved preview.

## How the labels were made

Nine independent Opus adjudicators, about 7 cases each, followed `ADJUDICATE.md` against the source at the pinned commit. 48 labels are high confidence and 15 medium. 14 cases list a second acceptable kind, usually regression vs novel where the rule's scope is arguable. The 15 medium-confidence labels, and every case where the benchmark runs disagree, are the ones the review page asks a human to vote on.

## The recorded pipeline verdicts

The 89 verdicts frozen into the cases come from earlier triage runs: 76 from Sonnet (runs before 2026-10-13) and 13 from Haiku 4.5. Graded against the labels:

| Metric                             | Latest verdict per case (n=63) | All recorded verdicts (n=89) |
| ---------------------------------- | ------------------------------ | ---------------------------- |
| Verdict kind in `acceptable_kinds` | 92.1%                          | 91.0%                        |
| Verdict kind equals `gold_kind`    | 87.3%                          | 84.3%                        |
| Rule id correct (regressions)      | 100%                           | 88.2%                        |
| Cited caller file matches gold     | 72.5%                          | 73.8%                        |

The adjudicators saw these verdicts, which may flatter them, and they are mostly Sonnet's. A benchmark run of the current configuration is the "before" number.

## Baseline

The baseline is the investigator as the pipeline ran it on 2026-10-25: a Claude Code subagent dispatched by the skill agent, on `claude-haiku-4-5`, two repeats of every case. Beside it, the same pipeline ran with only the investigator's model set to `claude-haiku-5-5`. Both runs are under `~/.ariadne/triage-entrypoints/benchmark_runs/`: `2026-10-25T15-07-11-075Z--claude-haiku-4-5` and `2026-10-25T15-07-09-527Z--claude-haiku-5-5`.

| Metric (126 replays each)                     | Haiku 4.5 (baseline)   | Haiku 5.5                 |
| --------------------------------------------- | ---------------------- | ------------------------- |
| Verdict kind in `acceptable_kinds`            | 86.5%                  | 87.3%                     |
| Verdict kind equals `gold_kind`               | 77.0%                  | 79.4%                     |
| Rule id correct (accepted regressions)        | 92.9%                  | 100%                      |
| Cited caller file matches gold                | 61.0%                  | 28.0%                     |
| `fp-* -> tp` errors                           | 3                      | 4                         |
| Missing or invalid verdicts                   | 6                      | 1                         |
| Cases whose repeats disagree                  | 11                     | 10                        |
| Investigator USD per case (median, mean, p90) | $0.096, $0.104, $0.156 | $0.0048, $0.0052, $0.0070 |
| Investigator turns (median, p90)              | 14, 25                 | 6, 8                      |
| Investigator spend for the run                | $13.11                 | $0.65                     |

Spend is the investigator's model alone; the coordinator that dispatched those subagents is excluded.

Swapping the model alone does not pass the gate: `fp-* -> tp` errors rise from 3 to 4, and Haiku 5.5 cites the gold caller file half as often. Most of that evidence gap is the output contract, not the search: Haiku 5.5 set `member_evidence` to the entry's own definition in 82 of its 84 false-positive verdicts. The investigator's system prompt requires a false positive's `member_evidence` to be the real caller's call site. Label amendments from the human review change the gold, so after applying them re-score both runs with `score_benchmark.ts --run` before comparing a change against this baseline.

## Gating a change

1. Run the suite with the current configuration (two repeats) and record verdicts and usage.
2. Run it with the change (two repeats), on `claude-haiku-4-5` for comparability with the baseline and on the pinned `claude-haiku-5-5` for the cost the change delivers.
3. The change passes when all of these hold:
   - Kind accuracy is within 2 points of the baseline.
   - The count of `fp-* -> tp` errors does not rise. These are the costly misses: they hide a real resolver gap.
   - Rule-id accuracy does not fall.
   - Missing or invalid verdicts do not rise.
4. Report cost per case (USD, turns, input tokens) and `prefix_miss` alongside accuracy. A nonzero `prefix_miss` means replays that started into a warm cache missed the shared prefix: something in the system prompt or tool definitions varies per investigation.
