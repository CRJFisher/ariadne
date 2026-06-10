# Triage

Triage pipeline for entry point analysis: detect false positives and classify root causes. The per-entry `triage-investigator` emits one `TriageVerdict` — a discriminated union with `tp`, `fp-novel`, `fp-classifier-regression`, or `uncertain` arms. Each false-positive verdict is self-contained: it carries its own evidence and (for `fp-novel`) the deterministic core fault diagnostics, so the published `triage_results` need no in-run consolidation. Offline grouping of false positives happens downstream in the `plan` skill.

Each invocation produces a self-contained run under `triage_state/<project>/runs/<run-id>/`. Run-id format is `<short-commit>-<iso-ts>` (or `nogit-<iso-ts>` for non-git projects). Re-running at the same target commit reuses prior `confirmed_unreachable` verdicts via the TP cache (skip with `--no-reuse-tp`). The classifier registry at `known_issues/registry.json` is the canonical registry; this skill reads it to filter classifier hits and the human maintains it (the `plan` skill never reads it). A generated `permanent`-status slice is bundled into `@ariadnejs/core` at `packages/core/src/classify_entry_points/permanent_data.ts`, so library consumers of `Project.get_call_graph()` filter framework noise without depending on this skill. The slice is regenerated from the source registry when its permanent rules change.

Orthogonally, the `detect_dead_code` Stop hook (`.claude/hooks/detect_dead_code.ts`) reads a human-maintained whitelist at `~/.ariadne/triage-entrypoints/known_entrypoints/<package>.json` to guard against dead code introduced during coding sessions. That whitelist is not read or written by any script in this skill — see [SKILL.md → Dead-code guardrail](SKILL.md#dead-code-guardrail).

## Self-healing pipeline

This skill is the first link in the self-healing chain: triage (sense) → plan (classify) → human (actuate). It is _self-healing_ because two durable surfaces survive between runs — `registry.json` (what we learned) and the target repo's git log (what we changed) — and both are read on the _next_ triage run. The diagram below traces the data those runs deposit and the processes that read/write each artifact.

<!-- Source: ./README.pipeline.mmd — edit there, then re-render with the /mermaid-pre-render skill -->

![Self-healing pipeline data layout (sense → classify → actuate)](./README.pipeline.svg)

**Reading the diagram**: top-to-bottom is temporal order. Each node is a **data artifact or persistent store**, labelled inline with **W** (writer) and **R** (reader). Green tags are per-run files; purple cylinders are persistent stores that survive between runs. The red-bordered `registry.json` on the right is the loop-closing surface — the human authors `wip` rows from `plan`'s proposals and flips them to `fixed` after a `fix(task_id):` commit lands, and the next triage run reads it as a filter. See the per-step diagram below and the sibling skill READMEs for the scripts, sub-agents, and intra-skill flow.

## Pipeline Flow

This skill's internal flow is a top-down four-phase pipeline. Read-only stores sit on a left rail and only feed the phases that touch them; the published `triage_results/<run-id>.json` fans out to three downstream consumers and (on the _next_ same-commit run) becomes the TP-cache source.

<!-- Source: ./README.per-step.mmd — edit there, then re-render with the /mermaid-pre-render skill -->

![Triage-entrypoints four-phase pipeline](./README.per-step.svg)

**What to look for**: four phase bands stacked top-to-bottom (strict reading order); two read-only stores (registry, prior triage_results) sit outside the phase bands — this skill **never** writes the registry (lifecycle contract); three Phase-2 buckets (auto / TP / residual) determine whether an entry skips the triage loop entirely. Each investigator writes one self-contained `TriageVerdict` to `results/<entry_index>.json`; finalize is the single reader, building `novel_issues[]` (one-per-`fp-novel`) and `classifier_regressions[]` (rolled up from `fp-classifier-regression`) directly from those files. Each run's published `triage_results` becomes the next same-commit run's TP cache.

## Sub-Agent Summary

| Agent               | Model  | Multiplicity              | Purpose                                                                |
| ------------------- | ------ | ------------------------- | ---------------------------------------------------------------------- |
| triage-investigator | Sonnet | 1 per entry (worker pool) | Fetch own context via `get_entry_context.ts`, emit one `TriageVerdict` |

## Key Modules

See [SKILL.md → Architecture: Key Modules](SKILL.md#architecture-key-modules).
