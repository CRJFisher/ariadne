# Diagnosis Routes: Routing Table and Classification Guide

Entry point candidates are routed through the triage pipeline based on their classification against the known-issues registry (builtin classifiers) and their pre-gathered diagnostic data.

## Entry Classification Routes

| Route               | Source              | Initial Status | Description                                                                    |
| ------------------- | ------------------- | -------------- | ------------------------------------------------------------------------------ |
| `known-unreachable` | Classifier match    | `completed`    | A builtin classifier from the known-issues registry matched — no LLM needed    |
| `llm-triage`        | No classifier match | `pending`      | Entry needs LLM investigation to determine whether Ariadne missed real callers |

## Diagnosis Values

Each entry has a `diagnosis` field from pre-gathered diagnostics during detection. These diagnoses describe what Ariadne observed about the entry's call sites:

| Diagnosis                          | Meaning                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `no-textual-callers`               | Nothing in the discovered corpus mentions this callable, in any form            |
| `callers-not-in-registry`          | Indexed call sites exist but produced no `CallReference`                        |
| `callers-in-registry-unresolved`   | Calling files are indexed but resolution failed to link them to this definition |
| `callers-in-registry-wrong-target` | Calls were resolved but linked to a different symbol                            |
| `callers-outside-indexed-corpus`   | The caller sits in a file that was discovered but never indexed                 |
| `references-without-call-syntax`   | The only mentions are non-call references — a read, a registration, a bare name |

`callers-outside-indexed-corpus` is a statement about coverage: a project-config
`exclude`, a `--folders` scope, or an indexing error kept the caller's file out
of the corpus. Investigating the member is pointless until the corpus question
is answered, so it routes to `coverage_config` without judgement.

`references-without-call-syntax` is a statement about syntax: the member is
reached by a getter read, a callback handed to an invoker, or a dispatch-table
value, none of which carry call parens. Its evidence lives in `reference_sites`,
not `grep_call_sites`, and it is exactly the surface a classifier author works
from — so it routes to `entry_point_classification`, and it carries
`needs_judgement: true`. The reference index keys on a name's final dotted
segment rather than on a resolved symbol, so a same-named member elsewhere can
supply the evidence: the area is certain, whether these particular sites reach
this member is not.

## Investigation Prompt

All `llm-triage` entries render a single template — `templates/prompt.md` — which is parameterized by the entry's `diagnosis`. `scripts/get_entry_context.ts` substitutes diagnosis-specific hints (title, summary, investigation guide) for three diagnoses — `callers-not-in-registry`, `callers-in-registry-unresolved`, and `callers-in-registry-wrong-target`. `callers-outside-indexed-corpus` and `references-without-call-syntax` carry their own hints too, and their evidence renders in the same block — the out-of-index hits and the reference sites respectively. `no-textual-callers`, and any value this table does not list, falls back to a generic broad-investigation guide (`GENERIC_HINTS`). The residual bucket is dispensed by tree size with no diagnosis filter, so any of these can reach an investigator. The template itself uses `{{entry.*}}` placeholders filled from the triage state entry.

## Verdict Output

Each investigated entry produces exactly one `TriageVerdict` (`src/verdict/triage_verdict.ts`), written as raw JSON to `results/<entry_index>.json` under the run directory. The union has four arms, discriminated by `kind`:

| `kind`                     | Meaning                                                        | Arm-specific fields                               |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| `tp`                       | Genuinely unreachable — the call graph is correct              | —                                                 |
| `fp-novel`                 | Real caller exists that no in-scope rule should have caught    | `proposed_root_cause`, `evidence_excerpt`         |
| `fp-classifier-regression` | Real caller an in-scope wip/permanent rule should have matched | `should_have_matched_rule_id`, `evidence_excerpt` |
| `uncertain`                | Cannot be reduced to a single verdict                          | `reason`                                          |

Every arm also carries `member_evidence` (`file`, `line`, `why`).

`parse_triage_verdict` (`src/verdict/triage_verdict.ts`) parses each file at finalize. It rejects an unknown `kind`, a missing or extra field, or an empty string — a shape violation throws and halts finalize; there is no silent skipping. Finalize reads these files to build `novel_issues[]` (one per `fp-novel`) and `classifier_regressions[]` (rolled up from `fp-classifier-regression`).
