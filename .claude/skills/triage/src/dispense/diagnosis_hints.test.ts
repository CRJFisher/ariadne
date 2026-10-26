import { describe, expect, it } from "vitest";

import { DIAGNOSIS_HINTS, GENERIC_HINTS, hints_for_diagnosis } from "./diagnosis_hints.js";

describe("hints_for_diagnosis", () => {
  it("returns the route's own hints for a known diagnosis", () => {
    expect(hints_for_diagnosis("callers-in-registry-wrong-target").title).toEqual("Wrong Resolution Target");
  });

  it("falls back to the generic hints for a diagnosis with no route of its own", () => {
    expect(hints_for_diagnosis("no-textual-callers")).toEqual(GENERIC_HINTS);
  });

  it("covers every routed diagnosis", () => {
    expect(Object.keys(DIAGNOSIS_HINTS).sort()).toEqual([
      "callers-in-registry-unresolved",
      "callers-in-registry-wrong-target",
      "callers-not-in-registry",
      "callers-outside-indexed-corpus",
      "references-without-call-syntax",
    ]);
  });
});
