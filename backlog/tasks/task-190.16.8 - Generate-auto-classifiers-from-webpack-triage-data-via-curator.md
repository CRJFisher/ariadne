---
id: TASK-190.16.8
title: Generate auto-classifiers from webpack triage data via curator
status: To Do
assignee: []
created_date: "2026-04-17 14:38"
labels:
  - self-repair
  - auto-classifier
  - curator
dependencies:
  - TASK-190.16.1
  - TASK-190.16.2
  - TASK-190.16.4
  - TASK-190.16.5
  - TASK-190.16.7
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - >-
    /Users/chuck/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results/
  - .claude/skills/self-repair-pipeline/src/auto_classify/
  - .claude/skills/triage-curator/
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase C2.

Run the `triage-curator` skill (TASK-190.16.6 scaffold + TASK-190.16.7 dispatchers) over the existing webpack triage output and let the opus group investigator propose `ClassifierSpec` entries + co-located `.ts` builtin files for the dominant webpack failure modes. At the start of this task `known_issues/registry.json` is seeded but has **no active classifiers** — every flagged entry lands in the residual set, so every dominant group triggers an opus investigation.

**Inputs:**

- `~/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results/*.json` — the curator's target.
- Enriched `CallReference` facts from TASK-190.16.1/.2 and the introspection APIs from TASK-190.16.3.
- `known_issues/registry.json` schema (TASK-190.16.4) and predicate DSL evaluator (TASK-190.16.5).
- `.claude/skills/triage-curator/reference/signal_inventory.md` (TASK-190.16.6 AC #4) — the authoritative signal inventory opus consults.

**Workflow:**

1. Run `curate_all --project webpack` against the triage output with the curator's opus investigator enabled.
2. For each residual group, opus proposes a `ClassifierSpec` + (where `kind: builtin`) a new `.ts` file in `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/`, writing both through the dispatcher's allowed-write scope.
3. Each proposed classifier comes with co-located fixture tests drawn from the webpack entries that seeded the group.
4. A human reviews the curator's PR-shaped output before any registry entry is promoted from `status: "wip"` to active.

**Reference benchmark (for validation in TASK-190.16.9):**

The human-designed taxonomy below is the expected coverage shape — i.e., what we would have hand-written without the curator. It is NOT the prescriptive classifier list; the curator may diverge (split, merge, refine, or add groups) based on the actual shape of the webpack data. TASK-190.16.9 compares what the curator produces against this reference and explains every divergence.

| Priority | group_id                          | axis   | kind      | Logic                                                                                                                      |
| -------- | --------------------------------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1        | `framework-pytest-fixture`        | C      | predicate | `decorator_matches "@pytest.fixture*"`                                                                                      |
| 2        | `framework-flask-route`           | C      | predicate | `language_eq python` AND `decorator_matches "@*.route*"`                                                                    |
| 3        | `framework-component-decorator`   | C      | predicate | `decorator_matches "@Component*"`                                                                                           |
| 4        | `method-chain-dispatch`           | A+B    | builtin   | `receiver_kind_eq "call_chain"` AND resolution unresolved                                                                   |
| 5        | `polymorphic-subtype-dispatch`    | B (F7) | builtin   | diagnosis `callers-in-registry-wrong-target` AND no inheritance link between caller and resolved target                     |
| 6        | `dynamic-property-keyed-callback` | B (F9) | builtin   | `syntactic_feature_eq is_dynamic_dispatch true` AND collection-source with non-literal key                                  |
| 7        | `constructor-new-expression`      | A      | builtin   | grep line matches `new Name(` AND `missing_capture_at_grep_hit "@reference.constructor"`                                    |
| 8        | `python-module-attribute-call`    | B (F4) | predicate | `language_eq python` AND `resolution_failure_reason_eq "import_unresolved"` AND import_kind ≠ namespace                     |
| 9        | `aliased-re-export-walk-broken`   | B (F5) | builtin   | resolution_failure stage = `import_resolution`, reason = `reexport_chain_unresolved`                                                |
| 10       | `unindexed-external-module`       | B (F6) | predicate | `resolution_failure_reason_eq "receiver_is_external_import"`                                                                |

### Known resolver gaps surfaced during curator investigation

- **Namespace-import barrel re-export emits `method_lookup`/`method_not_on_type` instead of `import_resolution`/`reexport_chain_unresolved`.** When `import * as ns from "./barrel"` is followed by `ns.fn()` and `barrel/index.ts` re-exports `fn` via `export { fn } from "./fn"`, `resolve_method_on_type` (namespace path, `method_lookup.ts:48-69`) calls `resolve_namespace_export`, which skips `kind === "import"` defs (re-exports). It returns null and the resolver emits `method_lookup`/`method_not_on_type` — losing the barrel-walk signal that any `aliased-re-export-walk-broken`-shaped classifier needs. The `reexport_chain_unresolved` reason currently fires only on the named/default-import path (`method_lookup.ts:108-115`). If the curator proposes a classifier keyed on this reason, it must either (a) flag the resolver gap for follow-up extension of `resolve_namespace_export` to emit `reexport_chain_unresolved` on miss, or (b) widen the predicate to also match `method_not_on_type` for namespace-import receivers backed by a re-export-only source file. Verified by `resolve_references.typescript.test.ts > "namespace import with re-exports should resolve through barrel file"`.

### `explain_call_site` API caveats

The chained-call addressability gap and the `ResolutionFailureReason` short-circuit behaviour are documented in two places:

1. The canonical API docstring on `packages/core/src/introspection/explain_call_site.ts` (travels with the code).
2. `.claude/skills/triage-curator/reference/signal_inventory.md` (see TASK-190.16.6 AC #4) — the authoritative reference the opus investigator reads when drafting predicates.

The opus investigator and any human reviewer should consult `signal_inventory.md` before signing off on a predicate keyed on `receiver_kind` or `resolution_failure_reason`. In particular, any `method-chain-dispatch`-shaped classifier depends on `receiver_kind === "call_chain"` on the outer call and must iterate `project.resolutions.get_calls_for_file(file)` directly rather than go through `explain_call_site`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Curator opus investigation has been run end-to-end against `~/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results/*.json` with an initially empty classifier set
- [ ] #2 Every residual group with `observed_count` above the curator's threshold has a proposed `ClassifierSpec` in `known_issues/registry.json` with `status: "wip"` plus (where `kind: builtin`) a co-located `.ts` file in `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/`
- [ ] #3 Each proposed builtin classifier has a co-located `.test.ts` with fixtures drawn from the webpack entries that seeded the group plus synthetic edge cases
- [ ] #4 Each classifier's measured precision on its fixture set meets the registry-declared `min_confidence`
- [ ] #5 Classifiers promoted from `wip` to active after human review are registered in the registry with a correct `ClassifierSpec`
- [ ] #6 End-to-end run against webpack: auto-classified ÷ total flagged ≥ 40%
- [ ] #7 Classifier-to-agent disagreement rate < 10% per classifier registered with `min_confidence: 0.9`
- [ ] #8 Regression run against the core.json (Ariadne self-corpus) produces non-zero auto-classify rate with the same precision guarantees as webpack
- [ ] #9 Resolver gaps surfaced during the investigation (e.g. the namespace-import barrel re-export case) are filed as follow-up tasks linked to the originating `group_id`
<!-- AC:END -->
