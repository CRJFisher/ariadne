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

All `llm-triage` entries render a single template — `templates/prompt.md` — which is parameterized by the entry's `diagnosis`. `scripts/get_entry_context.ts` substitutes diagnosis-specific hints (title, summary, investigation guide) for three diagnoses — `callers-not-in-registry`, `callers-in-registry-unresolved`, and `callers-in-registry-wrong-target`. The fourth diagnosis, `no-textual-callers`, and any other value fall back to a generic broad-investigation guide (`GENERIC_HINTS`). The template itself uses `{{entry.*}}` placeholders filled from the triage state entry.

## Verdict Output

Each investigated entry produces exactly one `TriageVerdict` (`src/verdict/triage_verdict.ts`), written as raw JSON to `results/<entry_index>.json` under the run directory. The union has four arms, discriminated by `kind`:

| `kind`                     | Meaning                                                         | Arm-specific fields                                  |
| -------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| `tp`                       | Genuinely unreachable — the call graph is correct               | —                                                    |
| `fp-novel`                 | Real caller exists that no in-scope rule should have caught      | `proposed_root_cause`, `evidence_excerpt`            |
| `fp-classifier-regression` | Real caller an in-scope wip/permanent rule should have matched   | `should_have_matched_rule_id`, `evidence_excerpt`    |
| `uncertain`                | Cannot be reduced to a single verdict                           | `reason`                                             |

Every arm also carries `member_evidence` (`file`, `line`, `why`).

`parse_triage_verdict` (`src/verdict/strict_parse.ts`) parses each file at finalize. It rejects an unknown `kind`, a missing or extra field, or an empty string — a shape violation throws and halts finalize; there is no silent skipping. Finalize reads these files to build `novel_issues[]` (one per `fp-novel`) and `classifier_regressions[]` (rolled up from `fp-classifier-regression`).
