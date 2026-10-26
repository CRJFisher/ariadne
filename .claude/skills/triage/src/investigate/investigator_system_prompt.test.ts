import { describe, expect, it } from "vitest";

import { DIAGNOSIS_HINTS, GENERIC_HINTS } from "../dispense/diagnosis_hints.js";
import { INVESTIGATOR_SYSTEM_PROMPT } from "./investigator_system_prompt.js";

describe("INVESTIGATOR_SYSTEM_PROMPT", () => {
  it("carries a guide for every diagnosis route and the generic one", () => {
    for (const [diagnosis, hints] of Object.entries(DIAGNOSIS_HINTS)) {
      expect(INVESTIGATOR_SYSTEM_PROMPT).toContain(`### ${hints.title} (\`${diagnosis}\`)`);
    }
    expect(INVESTIGATOR_SYSTEM_PROMPT).toContain(`### ${GENERIC_HINTS.title} (\`no-textual-callers\`)`);
  });

  it("names no entry: no template placeholder survives into the shared prefix", () => {
    expect(INVESTIGATOR_SYSTEM_PROMPT).not.toContain("{{");
  });

  it("asks for the caller's site, not the definition, as a false positive's evidence", () => {
    expect(INVESTIGATOR_SYSTEM_PROMPT).toContain(
      "For `fp-novel` and `fp-classifier-regression` it is the real caller's call site, not the definition.",
    );
  });
});
