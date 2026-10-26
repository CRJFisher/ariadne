---
id: TASK-410
title: >-
  Cut the cost of a triage run by an order of magnitude without losing verdict
  quality
status: To Do
assignee: []
created_date: "2026-10-19 22:30"
updated_date: "2026-10-25 21:30"
labels:
  - triage
  - performance
  - cost
dependencies: []
references:
  - TASK-190.23
  - TASK-190.43
documentation:
  - .claude/skills/triage/benchmark/v1/README.md
  - ~/.ariadne/triage-entrypoints/benchmark/spikes/prompt-caching.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

`/triage` turns a corpus's entry-point candidates into verdicts: confirmed unreachable, novel false positive, classifier regression. Those verdicts feed `plan` and, through it, every call-graph fix. That makes them the evidence behind the top of the intention tree, detecting call graphs well enough to find a codebase's true entry points. A run over a mid-size corpus costs about $10 (webpack, 254 investigations: $38.90), and that cost caps how many corpora can be triaged per fix. This task keeps verdict quality fixed, measured on a gold benchmark, and cuts cost per run by roughly 10–30×.

## Where the money goes

Measured from the transcripts of the 23 `triage-suite` runs that dispatched investigators: 2,042 investigations, 2026-10. Usage is priced at list rates: Sonnet 5 coordinator ($2 / $10 per MTok, 1-hour cache), Haiku 4.5 investigators ($1 / $5 per MTok, 5-minute cache).

| Component                                        | Spend                              | Share |
| ------------------------------------------------ | ---------------------------------- | ----- |
| Coordinator (the skill agent running Phases 0–4) | $52.10 ($2.27 per run)             | 23%   |
| Investigators (`triage-investigator`, Haiku 4.5) | $174.01 ($0.085 per investigation) | 77%   |

The coordinator's share is 12–40% on large runs and 65–80% on small ones (express, lodash: 7–8 investigations). It starts every run at about 55k tokens of context, which is the harness prompt plus the 45k-character `SKILL.md`. It ends a typical run at about 95k, re-reading that prefix on 40–115 turns. Each dispatch adds about 600 characters, so this is a fixed tax, not a runaway context.

An investigator costs what it re-reads. It averages 12 turns (median 10, p90 22). Every turn re-reads the whole context from cache, and each new tool result is written to cache at 1.25×. The table attributes each piece of context to the turns that re-read it:

| Context segment                                                                                              | Share of investigator cost |
| ------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Fixed prefix: Claude Code harness prompt, tool schemas, agent definition (~11.4k tokens, re-read every turn) | ~45%                       |
| Entry-context bundle from `get_entry_context.ts` (median 15k characters)                                     | ~25%                       |
| `Read` results                                                                                               | ~20%                       |
| Bash grep, find, cat, and tool inputs                                                                        | ~10%                       |

Inside the bundle:

- **Classifier rules:** the in-scope rules, serialised as full registry JSON, are 55% of the bundle on average (8.4k characters). They decide 7% of verdicts, the `fp-classifier-regression` ones.
- **Static instructions:** the investigation steps and output contract are 19%. They are identical on every dispatch.
- **Uncapped evidence:** the evidence lists have no cap. Non-call reference sites are 86% of all evidence text. Evidence alone is 45k characters at p90 and 854k at the maximum.

Behaviours that add turns:

- **Truncated bundles.** 272 investigations (13%) received the bundle as a 2k-character "output too large" preview. 233 of them then `cat` the saved file back in, and 102 re-ran `get_entry_context.ts`.
- **A broken tool.** `mcp__ariadne__show_call_graph_neighborhood` is in the agent's tool list, but the MCP server is unavailable to subagents: all 15 calls failed. 249 investigations improvised a nonexistent `mcp.ts` script instead.
- **Paged reads.** 35% of `Read` calls page through a file already opened. 258 reads had no line limit and returned over 20k characters each, 8.4M characters in total.
- **Sequential calls.** Investigators issue one tool call per turn (0.2 turns per investigation carry parallel calls). They search with Bash `grep` (7,223 calls) and never use the `Grep` tool.

Model price: the agent definition says `model: haiku`, which resolves to `claude-haiku-4-5` at $1 / $5 per MTok. `claude-haiku-5-5` lists at $0.10 / $0.50 per MTok, a tenth of that.

## Recommended changes

Each change is gated by the benchmark below. Land them in this order, so each is measured on its own.

1. **Benchmark harness first.** Move the curated suite into `.claude/skills/triage/benchmark/v1/`, with a review page where a human casts the deciding vote between the models' verdicts into `benchmark/v1/human_review.json`. Port `score.py` to a TypeScript scorer with tests. Eleven cases were recorded in a container, and their `entry` paths start with `/home/node/.ariadne/triage-entrypoints/repos/`. The runner rebases every `…/triage-entrypoints/repos/<project>/` prefix onto the local clone before it builds the investigator's context. Add a runner that replays every case through the investigator, with N repeats, and records verdicts plus per-case usage (USD, turns, input, cache and output tokens) under `~/.ariadne/triage-entrypoints/benchmark_runs/<ts>/`. Record a fresh baseline of today's configuration, two repeats. Run-to-run disagreement on the same entry is about 12%, so single runs are noise.
2. **Deterministic dispatch loop.** One TypeScript script owns dispense → investigate → absorb → finalize. It runs a continuous pool of N concurrent investigators: no batch barrier, so concurrency is N, not N/2. It writes each verdict through the existing parser, and stops dispatching on a spend or rate-limit error instead of burning partial investigations (93 investigations in these runs died on the monthly spend limit). The skill agent does only what needs judgement, which is authoring a new project config. Phase 3–4 prose in `SKILL.md` collapses to one command. This removes the coordinator spend: $2.27 per run, 23% overall, up to 80% on small corpora. The script, not a Claude Code dynamic workflow, hosts this loop. A workflow agent carries the Claude Code harness and injected CLAUDE.md files, takes no turn cap, reports no per-agent usage, and returns `null` on a spend limit without saying why, so it rules out step 3 and the benchmark's cost reporting. TASK-190.23 applies dynamic workflows to `plan`'s strategist wave instead.
   - **Cache warm-up:** the shared prefix becomes readable only once the first response has started, so investigators launched together each pay the full cache write. Four simultaneous starts cost $0.0283; one lead followed by four cost $0.0130. At run start, and after any idle gap over 5 minutes, the loop dispatches one lead investigator and releases the rest after its first `assistant` message. The lead is a real investigation.
   - **Cache check:** for every investigation the loop records the turn-1 `cache_read_input_tokens` and `cache_creation_input_tokens`, plus `modelUsage` cost. It counts a `prefix_miss` when a non-lead investigation's turn-1 cache read is under 90% of the expected prefix, so a silent cache regression shows up in the run summary.
3. **Lean investigator.**
   - **Prompt and tools:** run each investigation as an Agent SDK `query()` with a purpose-written system prompt (the investigation rules and verdict contract), not the Claude Code preset. No settings or CLAUDE.md loading. Only three tools: `Read` with a line cap, `Grep`, and a schema-validated `submit_verdict` that replaces the file `Write`. Implement all three in one in-process SDK MCP server. `Read` needs a custom implementation for the line cap anyway, and the built-in `Read` and `Grep` definitions alone cost 1.5–2k prefix tokens.
   - **Shared cache prefix:** the SDK caches automatically, and separate `query()` calls share the tools and system-prompt prefix when both are byte-identical. Keep the system prompt a constant string, with nothing per-entry or dynamic in it or in tool descriptions. Keep the tool set and MCP server name fixed for the whole run, use one API workspace, and pin the SDK version, because a CLI upgrade changes the built-in tool text. The SDK appends 0.6–1k tokens of environment reminders that cannot be shared, so budget for them in each investigation.
   - **`query()` options:**
     - `systemPrompt: <constant string>`, `settingSources: []`, `persistSession: false`, `strictMcpConfig: true`, `maxTurns: 20`.
     - `title: 'investigator'`. Without it, every call makes a hidden session-title call of about 1.2k uncached tokens.
     - `env: {...process.env, CLAUDE_CODE_PROMPT_CACHE_TTL: '5m', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'}`. A subscription login defaults to 1-hour entries at 2× write cost, and a continuous pool re-reads the prefix far more often than every 5 minutes.
     - On Haiku 4.5, `thinking: {type: 'disabled'}`, because its default is a 32k thinking budget. On Haiku 5.5, control thinking through `effort`.
   - **Context in the prompt:** pass the entry context in the first user message. That saves a turn and makes truncation impossible.
   - **Drop the MCP tool:** remove `mcp__ariadne__show_call_graph_neighborhood`, since the bundle already carries Ariadne's call references.
   - **Turn limits:** cap at 20 turns, the measured p90, and ask for parallel searches.
   - **Clean up:** delete `.claude/agents/triage-investigator.md`.
   - **Target:** a fixed prefix of 3–4k tokens, down from about 11.4k, and about 25% fewer turns. The minimum cacheable prefix is 4,096 tokens on `claude-haiku-4-5` and 512 on `claude-haiku-5-5`. On Haiku 4.5 a 3–4k prefix is not shared across investigators, so each one writes it at 1.25× and never reads it back. Steps 3 and 4 are therefore gated on both models: the 4.5 run is comparable with the baseline, and the 5.5 run shows the cost the change actually delivers. Do not pad the prompt to reach 4,096.
4. **Bounded entry-context bundle.**
   - **Rules:** render the classifier rules as `group_id: title — description`, one line each.
   - **Static instructions:** move the investigation guide and output contract into the cached system prompt.
   - **Evidence caps:** cap every evidence list (for example, the first 40 sites, ordered by relevance) with an explicit "N more" count and the command to fetch the rest. This lands together with TASK-190.43 #1, which adds fields to the call-reference formatter, so the cap and the richer fields reach one bounded format.
   - **Target:** median bundle about 5k characters, p99 under 12k.
5. **Model.** Pin `claude-haiku-5-5` with an explicit effort setting, chosen by a `low`/`medium` sweep on the benchmark. This is the largest single lever: about 10× on price ($0.10 input, $0.50 output, $0.125 5-minute cache write, $0.01 cache read per MTok). The effort setting does not change the shared prefix, so the sweep's runs share one cache. Sharing the prefix across investigators saves about $0.0005 per investigation at this price. The savings come from the price and the prefix size, not from sharing. It ships only if the gate holds.

Projected effect: steps 3–4 cut investigator tokens by about 60%, step 5 cuts the price per token by 10×, and step 2 removes the coordinator. A 90-investigation run falls from about $10 to roughly $0.30–$0.90. The benchmark replaces this projection with measured numbers at every step.

## Benchmark

The curated suite has 63 cases across 37 corpora and four languages. It covers all six diagnosis routes and all three verdict kinds, with 9 distinct regression rules, plus contested, expensive and oversized-evidence cases. Each case freezes the exact `TriageEntry` and names the repo and commit. Source code stays in the existing `repos/` clones, so the suite is 1.3 MB (184 KB gzipped). Gold labels come from independent Opus adjudication against source: 48 high confidence, 15 medium. The 89 verdicts recorded from earlier pipeline runs (76 Sonnet, 13 Haiku 4.5) score 92.1% on verdict kind and 72.5% on caller-file evidence. The suite lives in `.claude/skills/triage/benchmark/v1/`; its README documents the contents, the runner, the scorer, the review page, the labelling protocol, and the gate.

The baseline is today's configuration, the investigator on `claude-haiku-4-5`, over two repeats (126 replays). It scores 86.5% on verdict kind, 77.0% on exact gold kind, 92.9% on rule id and 61.0% on caller-file evidence. It makes 3 `fp-* → tp` errors and leaves 6 replays without a valid verdict. Investigator cost is $0.104 per investigation (median $0.096, p90 $0.156) over 14 median turns. The same pipeline with only the model set to `claude-haiku-5-5` costs $0.0052 per investigation over 6 median turns, about 20× less, and scores 87.3% on verdict kind. It does not pass the gate on its own, because `fp-* → tp` errors rise to 4 and caller-file evidence falls to 28.0%. The benchmark README holds the full table and the run directories.

A change passes when, over two repeats:

- Verdict-kind accuracy stays within 2 points of the baseline.
- `fp-* → tp` errors do not rise.
- Rule-id accuracy does not fall.
- Missing or invalid verdicts do not rise.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 The benchmark suite, its label-review tool, a tested TypeScript scorer, and a replay runner live under `.claude/skills/triage/benchmark/`, and a baseline of the current configuration (two repeats, with usage) is recorded
- [ ] #2 A human has reviewed the 15 flagged labels (all medium confidence; 14 of them list two acceptable kinds) in the review tool, and every amendment in `benchmark/v1/human_review.json` is applied to `labels/`
- [ ] #3 One deterministic script runs dispense, investigation and finalize with a continuous pool, warms the cache with one lead investigator at start and after idle gaps, records turn-1 cache usage and a `prefix_miss` count per run, and stops cleanly on spend or rate-limit errors; no agent coordinates Phases 3–4
- [ ] #4 Investigators run with a constant purpose-written system prompt, the entry context in the first message, `Read`/`Grep`/`submit_verdict` only, a turn cap, a pinned SDK version, an explicit 5-minute cache TTL and a fixed session title; `.claude/agents/triage-investigator.md` is removed
- [ ] #5 The entry-context bundle is bounded (rules as one line each, static instructions in the system prompt, capped evidence lists with explicit overflow counts) and coordinated with TASK-190.43 #1
- [ ] #6 The investigator model is pinned explicitly, with effort chosen by a benchmark sweep
- [ ] #7 Every step passes the benchmark gate, and the final configuration's cost per investigation and per run is reported next to the baseline
- [ ] #8 `SKILL.md`, the skill README and its diagrams, `meta.json` and `.claude/rules/classifier-lifecycle.md` describe the pipeline as it runs
<!-- AC:END -->
