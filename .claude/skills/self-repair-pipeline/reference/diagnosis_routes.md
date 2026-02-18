# Diagnosis Routes: Routing Table and Escape Hatch

Entry point candidates are routed through the triage pipeline based on their classification against the known-entrypoints registry and their pre-gathered diagnostic data.

## Entry Classification Routes

| Route | Source | Initial Status | Description |
| ----- | ------ | -------------- | ----------- |
| `known-tp` | Registry match | `completed` | Entry matched the known-entrypoints registry — confirmed true positive |
| `llm-triage` | No registry match | `pending` | Entry needs LLM investigation to determine classification |

Two active routes handle all entry point candidates. Registry-matched entries skip LLM investigation entirely, while unmatched entries proceed through the triage loop for classification.

## Diagnosis Values

Each entry has a `diagnosis` field from pre-gathered diagnostics during detection. These diagnoses describe what Ariadne observed about the entry's call sites:

| Diagnosis | Meaning |
| --------- | ------- |
| `no-textual-callers` | Grep found no call sites for this function anywhere in the codebase |
| `callers-not-in-registry` | Grep found call sites but the calling files are not in Ariadne's file registry |
| `callers-in-registry-unresolved` | Calling files are indexed but resolution failed to link them to this definition |
| `callers-in-registry-wrong-target` | Calls were resolved but linked to a different symbol |

## Diagnosis-to-Template Routing Table

For `llm-triage` entries, the diagnosis selects which investigation prompt template to use:

| Diagnosis | Template File | Investigation Focus |
| --------- | ------------- | ------------------- |
| `callers-not-in-registry` | `templates/prompt_callers_not_in_registry.md` | Verify call sites exist in unindexed files, check file coverage gaps |
| `callers-in-registry-unresolved` | `templates/prompt_resolution_failure.md` | Identify resolution failure pattern (aliased imports, barrel re-exports, etc.) |
| `callers-in-registry-wrong-target` | `templates/prompt_wrong_target.md` | Determine why resolution linked to wrong symbol (class hierarchy, shadowing) |
| All other diagnoses | `templates/prompt_generic.md` | Broad investigation: check for legitimate entry points, indirect callers, dead code |

Templates use `{{entry.*}}` placeholder syntax. Substitute with entry fields before launching the triage-investigator sub-agent.

## Ternary Classification Output

Each investigated entry produces a `TriageEntryResult` with a ternary classification:

| Classification | `is_true_positive` | `is_likely_dead_code` | `group_id` |
| -------------- | ------------------- | --------------------- | ---------- |
| True positive | `true` | `false` | `"true-positive"` |
| Dead code | `false` | `true` | `"dead-code"` |
| False positive | `false` | `false` | Kebab-case root cause (e.g., `"barrel-reexport"`, `"cross-package-call"`) |

False-positive entries also include:

- `root_cause`: Full description of the detection gap
- `reasoning`: Explanation of why this causes false positives

## Escape Hatch: Multi-Entry FP Groups

After aggregation and meta-review, false-positive entries are grouped by `group_id`. The pipeline applies an escape hatch to determine which groups proceed to fix planning:

| Group Size | Action |
| ---------- | ------ |
| >1 entry (multi-entry group) | Proceeds to fix planning — 5 plans, synthesis, 4 reviews, task creation |
| 1 entry (single-entry group) | Recorded in results but skipped for fix planning |

This prevents creating fix tasks for isolated false positives that may not represent systematic issues. The single-entry groups remain in the finalization output for tracking.
