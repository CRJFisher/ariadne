# Diagnosis Routes: Routing Table and Classification Guide

Entry point candidates are routed through the triage pipeline based on their classification against the known-issues registry (predicate classifiers) and their pre-gathered diagnostic data.

## Entry Classification Routes

| Route               | Source              | Initial Status | Description                                                                    |
| ------------------- | ------------------- | -------------- | ------------------------------------------------------------------------------ |
| `known-unreachable` | Classifier match    | `completed`    | A predicate classifier from the known-issues registry matched — no LLM needed  |
| `llm-triage`        | No classifier match | `pending`      | Entry needs LLM investigation to determine whether Ariadne missed real callers |

## Diagnosis Values

Each entry has a `diagnosis` field from pre-gathered diagnostics during detection. These diagnoses describe what Ariadne observed about the entry's call sites:

| Diagnosis                          | Meaning                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `no-textual-callers`               | Grep found no call sites for this function anywhere in the codebase             |
| `callers-not-in-registry`          | Grep found call sites but the calling files are not in Ariadne's file registry  |
| `callers-in-registry-unresolved`   | Calling files are indexed but resolution failed to link them to this definition |
| `callers-in-registry-wrong-target` | Calls were resolved but linked to a different symbol                            |

## Investigation Prompt

All `llm-triage` entries render a single template — `templates/prompt.md` — which is parameterized by the entry's `diagnosis`. `scripts/get_entry_context.ts` substitutes diagnosis-specific hints (title, summary, investigation guide, classification hint) for the four diagnoses above; any other diagnosis falls back to a generic broad-investigation guide. The template itself uses `{{entry.*}}` placeholders filled from the triage state entry.

## Binary Classification Output

Each investigated entry produces a `TriageEntryResult` with a binary classification:

| Classification                                    | `ariadne_correct` | `group_id`                                                                   |
| ------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| No real callers found — Ariadne correct           | `true`            | `"confirmed-unreachable"`                                                    |
| Real callers missed — Ariadne has a detection gap | `false`           | Kebab-case detection gap (e.g., `"barrel-reexport"`, `"cross-package-call"`) |

All results also include:

- `root_cause`: Description of the detection gap (or confirmation of unreachability)
- `reasoning`: Evidence and explanation supporting the classification
