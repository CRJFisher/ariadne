---
id: TASK-190.25
title: "Triage skill: surface dropped evidence, fix grep declaration FP, add classifier precision audit"
status: To Do
assignee: []
created_date: "2026-06-23 00:00"
labels:
  - self-repair
  - triage
  - quality
parent_task_id: TASK-190
priority: high
---

## Description

A 23-agent Opus review of the triage skill across 20 corpora identified no critical bugs but surfaced seven significant issues and five high-leverage improvements. The skill is functionally sound — 97.7% noise reduction, HIGH efficacy — but several localized defects limit accuracy and observability. This task tracks the actionable work from that review.

## Findings Summary

**Efficacy verdict:** HIGH, MEDIUM confidence. Novel-issue volume tracks metaprogramming density (jquery 0/96, celery 134/859), not corpus size — signal, not noise. Proposed root causes are specific and mechanism-level. The MEDIUM confidence is structural: the 96-99% confirmed-unreachable slice rests on classifier precision that is never independently audited in-run. The remaining issues below are all localized and fixable without architectural change.

---

## Significant Issues

### 1. Call-ref formatter drops decisive evidence on the hardest routes

`format_call_refs` in `get_entry_context.ts:224-234` renders only `caller_file / call_line / call_type / caller_function / resolution_count / resolved_to` and silently drops:

- `resolution_failure.{stage, reason, partial_info.last_known_scope}`
- `receiver_kind`
- `syntactic_features` (`is_new_expression`, `is_super_call`, `is_optional_chain`, `is_callback_arg`, `is_dynamic_dispatch`)

The unresolved-route investigation guide then asks the model to manually classify which resolution stage failed — the exact information `resolution_failure.stage` already states verbatim. This forces re-derivation on the hardest routes and produces mislabelled `proposed_root_cause` and wrong `should_have_matched_rule_id`.

**Fix:** Surface `resolution_failure.{stage, reason, last_known_scope}`, `receiver_kind`, and the relevant `syntactic_features` booleans in `format_call_refs`. Also surface the grep `captures` array in `format_grep_hits` so declaration lines are visually distinct from actual call captures. Single-file change, near-zero cost.

---

### 2. Declaration-as-caller false positive in grep index

`grep_for_calls` in `extract_entry_point_diagnostics.ts` matches any `identifier\s*(` pattern and excludes only the entry's own exact `(def_file, def_line)` line (and, for constructors, `class Name`). A same-named function overload, interface method, abstract method, or declaration in another file is counted as a grep call site.

A declaration line produces no `CallReference`, so `captures_from_refs` returns `[]` — which is exactly the signal `has_uncaptured_indexed_grep_hit` keys off, falsely setting it `true`. A single spurious declaration hit also flips `compute_diagnosis` from the cheap `no-textual-callers` bucket to the costly `callers-not-in-registry` LLM route. Verified empirically across all four languages (TS, Python, Rust, JS).

**Fix:** In `grep_for_calls`, build a definition-location set from `project.definitions` and skip any grep hit coinciding with a known definition of the same name. As a defense-in-depth layer, also skip lines matching declaration patterns (`function/def/fn NAME(`, interface/abstract/overload signatures). Add a regression test asserting a same-named declaration in another file is not returned as a call site and does not set `has_uncaptured_indexed_grep_hit`.

---

### 3. The confirmed-unreachable slice is never independently audited

Auto-classified (predicate/builtin) matches go directly to `confirmed_unreachable` — no investigator ever sees them (`build_triage_entries.ts:59-75`). The only mechanism that can flag a wrong classifier (`fp-classifier-regression`) is emitted exclusively by LLM investigators who only see non-matched entries. An over-broad predicate that buries a real entry point is structurally invisible to the regression path.

This is the structural reason efficacy confidence is MEDIUM rather than HIGH.

**Fix:** Add an in-run blind verification cohort: divert a small bounded fraction (2-5% or fixed N per `group_id`) of auto-classified entries into the `llm-triage` route. When an investigator returns `fp-novel` or `fp-classifier-regression` on a supposedly-matched entry, publish it as a `classifier_false_negative` slice. This converts the implicit precision assumption into a measured per-run lower bound at bounded LLM cost.

---

### 4. Registry loop-closure is stalled

Of 180 rules: 171 wip (95%), 9 permanent, **0 fixed**. 60 uncurated placeholders carrying the boilerplate "fill in before enabling" description with empty `examples[]` and `title == group_id` already fire live classifiers. Bugs whose fixes have landed may still be suppressing entries.

The 19 highest-volume drift-suspended rules (`callback-registration` 219 obs, `interface-polymorphic-dispatch` 111, `method-chain-dispatch` 107) carry `kind: none` — the dominant failure modes have zero active predicate.

Specific predicate issues also identified:

- `rust-macro-invocation-call` matches bang-style `macro!(...)` only, so it simultaneously over-matches stdlib `assert!/vec!/matches!` and misses `#[test]` attribute macros (actix-web, sqlx, tokio).
- `module-attribute-alias` fires on **any** entry with `diagnosis_eq: callers-in-registry-wrong-target` with no further qualification — a whole misdiagnosis class auto-suppressed wholesale.

**Fix:** Flip the 60 firing placeholders to `kind: none` until curated. Run `reconcile-registry` to flip `wip → fixed` for rules whose `backlog_task` matches a landed `fix`/`feat` commit. Review the 19 drift-suspended high-volume rules. Split `rust-macro-invocation-call` into a narrowed bang-macro predicate (excluding stdlib macros) plus a separate attribute-macro predicate for `#[test]/#[tokio::test]`. Add qualification to `module-attribute-alias` beyond the bare `diagnosis_eq`.

---

### 5. `failed` entries silently vanish from the published artifact

A verdict file that fails strict parse sets `status='failed'` in `merge_results.ts:40`. It is never re-picked (`pick_next_entries` only picks `pending`), never blocks finalize (`any_pending_non_classified` counts only `pending`), and is silently dropped at `output.ts:153 continue`. It survives only as the aggregate `failed_count` integer, which never reaches the durable v5 `TriageResultsFile`.

A transient malformed write or investigator timeout permanently removes a real candidate from the published output with no operator-facing explanation. This is asymmetric with the careful fail-loud throw on `pending` entries.

**Fix:** Assert `failed_count === 0` at finalize (fail-loud, matching the surrounding pending-entry throw) unless an explicit `--allow-failed` flag is passed. Alternatively, add a `failed[]` audit array of entry refs to the v5 schema so lost candidates are auditable. Document the `failed` status end-to-end in `SKILL.md`.

---

### 6. No deterministic grounding gate — parser validates shape, not truth

`parse_triage_verdict` rejects unknown shape but not incorrect content. A fabricated-but-well-formed `evidence_excerpt`, a wrong `member_evidence.line`, or a `should_have_matched_rule_id` that doesn't exist in the in-scope registry slice all pass parsing and are transcribed verbatim into the published artifact. `reconcile_registry` rejects phantom ids before any durable registry write, but published `classifier_regressions[]` counts get inflated.

**Fix:** Add a finalize integrity gate: open `member_evidence.file`, assert the line is in range and the entry name appears on or near it, downgrade failures to `uncertain`. Validate `should_have_matched_rule_id` against the in-scope `relevant_registry_slice` (known at dispatch time) and demote unknown-id regressions to `uncertain` with the bad id in the reason.

---

### 7. Test-only-caller evidence is computed but never shown to the investigator

`diagnostics.callers_only_in_unindexed_tests` and `grep_call_sites_unindexed_tests` are computed but never substituted into the prompt template. A function called only from unindexed test files is indistinguishable from genuinely dead code, producing inconsistent verdicts across runs.

Four inconsistent test-only-caller representations exist in the registry: `test-file-callers-missed` (builtin), `unindexed-test-files` (`kind: none`, 81 obs, drift-detected), `test-file-exclusion` (`kind: none`), and a dead `test_only` typed branch produced by no rule.

**Fix:** Surface `callers_only_in_unindexed_tests` / `grep_call_sites_unindexed_tests` into the prompt template. Consolidate the four representations into one `test-only-caller` classifier (fold `unindexed-test-files` and `test-file-exclusion`) and delete the dead `test_only` branch.

---

## Minor Issues (for awareness)

- `uncertain` arm has no positive trigger in the prompt; effectively unused (0/250 in the sampled run). Add explicit triggers for genuinely undecidable polymorphic/wrong-target cases.
- Wrong-target route guide primes `fp` when the `resolved_to` may be a defensible same-name sibling. Add a skeptical null-hypothesis step.
- `VALID_LANGUAGES` / `language_from_extension` accept only TS/JS/Python/Rust, but `detect_entrypoints` advertises Go/Java/C/C++ — a latent mismatch.
- Stale-analysis HEAD-mismatch warning in `prepare_triage.ts:157-171` is undocumented; prescribed operator action not in `SKILL.md`.
- `AskUserQuestion` used in the "Creating a New Project Config" flow but absent from `SKILL.md` allowed-tools frontmatter — would be blocked.
- `finalize` exits code 2 on already-finalized runs; neither the script header nor `SKILL.md` documents this.
- The bespoke backward-scanning streaming-JSON parser in `load_json_streaming` would silently break if the writer's byte layout changes — consider NDJSON.

## Acceptance Criteria

- [ ] `format_call_refs` surfaces `resolution_failure.{stage, reason}`, `receiver_kind`, `syntactic_features`, and grep `captures`
- [ ] `grep_for_calls` excludes declaration lines; regression test added
- [ ] Blind verification cohort implemented (or explicit decision to defer with documented rationale)
- [ ] 60 firing uncurated placeholders flipped to `kind: none`; `wip → fixed` reconciliation run
- [ ] `rust-macro-invocation-call` split; `module-attribute-alias` qualified
- [ ] `failed_count === 0` assertion at finalize (or `failed[]` audit array added to v5 schema)
- [ ] Finalize integrity gate validates `member_evidence.file:line` and `should_have_matched_rule_id`
- [ ] Test-only-caller evidence surfaced in prompt; four registry representations consolidated
