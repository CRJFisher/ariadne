# Diagnosis Routes: Routing Table and Classification Guide

Entry point candidates are routed through the triage pipeline based on their classification against the known-entrypoints registry and their pre-gathered diagnostic data.

## Entry Classification Routes

| Route               | Source            | Initial Status | Description                                                                         |
| ------------------- | ----------------- | -------------- | ----------------------------------------------------------------------------------- |
| `known-unreachable` | Registry match    | `completed`    | Entry matched the known-entrypoints registry — confirmed unreachable, no LLM needed |
| `llm-triage`        | No registry match | `pending`      | Entry needs LLM investigation to determine whether Ariadne missed real callers      |

## Diagnosis Values

Each entry has a `diagnosis` field from pre-gathered diagnostics during detection. These diagnoses describe what Ariadne observed about the entry's call sites:

| Diagnosis                          | Meaning                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `no-textual-callers`               | Grep found no call sites for this function anywhere in the codebase             |
| `callers-not-in-registry`          | Grep found call sites but the calling files are not in Ariadne's file registry  |
| `callers-in-registry-unresolved`   | Calling files are indexed but resolution failed to link them to this definition |
| `callers-in-registry-wrong-target` | Calls were resolved but linked to a different symbol                            |

## Diagnosis-to-Template Routing Table

For `llm-triage` entries, the diagnosis selects which investigation prompt template to use:

| Diagnosis                          | Template File                                 | Investigation Focus                                                            |
| ---------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `callers-not-in-registry`          | `templates/prompt_callers_not_in_registry.md` | Verify call sites exist in unindexed files, check file coverage gaps           |
| `callers-in-registry-unresolved`   | `templates/prompt_resolution_failure.md`      | Identify resolution failure pattern (aliased imports, barrel re-exports, etc.) |
| `callers-in-registry-wrong-target` | `templates/prompt_wrong_target.md`            | Determine why resolution linked to wrong symbol (class hierarchy, shadowing)   |
| All other diagnoses                | `templates/prompt_generic.md`                 | Broad investigation: check for indirect callers, detection gaps                |

Templates use `{{entry.*}}` placeholder syntax. Substitute with entry fields before launching the triage-investigator sub-agent.

## Binary Classification Output

Each investigated entry produces a `TriageEntryResult` with a binary classification:

| Classification                                    | `ariadne_correct` | `group_id`                                                                   |
| ------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| No real callers found — Ariadne correct           | `true`            | `"confirmed-unreachable"`                                                    |
| Real callers missed — Ariadne has a detection gap | `false`           | Kebab-case detection gap (e.g., `"barrel-reexport"`, `"cross-package-call"`) |

All results also include:

- `root_cause`: Description of the detection gap (or confirmation of unreachability)
- `reasoning`: Evidence and explanation supporting the classification
