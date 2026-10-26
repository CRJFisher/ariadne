import { describe, expect, it } from "vitest";

import { BENCHMARK_SUITE_DIR, load_benchmark_suite } from "../load_benchmark_suite.js";
import { build_review_glossary, parse_adjudication_terms } from "./review_glossary.js";

const ADJUDICATE = `# Adjudicating

## Verdict definitions (identical to the triage pipeline)

- **\`tp\`**: genuinely unreachable.
- **\`fp-classifier-regression\`**: a rule should have caught it.
- **\`fp-novel\`**: no rule covers it.
- **\`uncertain\`**: cannot be reduced.

A "real caller" is any in-repo code path that invokes the member.

Pitfalls:

- **Name collisions.** A grep hit may be a sibling.
- **Lazy TPs.** Search harder.

## How to work

- **\`tp\`**: not a definition.
`;

describe("parse_adjudication_terms", () => {
  it("reads the verdict kinds, the caller definition and the pitfalls", () => {
    expect(parse_adjudication_terms(ADJUDICATE)).toEqual({
      kinds: {
        tp: "genuinely unreachable.",
        "fp-novel": "no rule covers it.",
        "fp-classifier-regression": "a rule should have caught it.",
        uncertain: "cannot be reduced.",
      },
      real_caller: "A \"real caller\" is any in-repo code path that invokes the member.",
      pitfalls: [
        { title: "Name collisions", text: "A grep hit may be a sibling." },
        { title: "Lazy TPs", text: "Search harder." },
      ],
    });
  });

  it("fails when a verdict kind is undefined", () => {
    expect(() => parse_adjudication_terms(ADJUDICATE.replace("- **`uncertain`**: cannot be reduced.\n", ""))).toThrow(
      "ADJUDICATE.md does not define verdict kind uncertain",
    );
  });
});

describe("build_review_glossary", () => {
  it("defines every diagnosis and rule the shipped suite uses", () => {
    const suite = load_benchmark_suite();
    const glossary = build_review_glossary(BENCHMARK_SUITE_DIR, suite.registry_snapshot);
    const diagnoses = new Set(suite.cases.map((c) => c.case.diagnosis));
    const rules = new Set(suite.cases.map((c) => c.label.gold_rule_id).filter((r) => r !== null));
    expect([...diagnoses].filter((d) => glossary.diagnoses[d] === undefined)).toEqual([]);
    expect([...rules].filter((r) => glossary.rules[r] === undefined)).toEqual([]);
    expect(glossary.pitfalls.map((p) => p.title)).toEqual(["Name collisions", "Over-generous regressions", "Lazy TPs"]);
  });
});
