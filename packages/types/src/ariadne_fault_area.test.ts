/**
 * Tests for the `AriadneFaultArea` taxonomy and the `derive_fault_area`
 * deterministic derivation. Every case asserts the exact `AriadneFaultLocation`.
 */

import { describe, test, expect } from "vitest";
import type { ResolutionFailureReason, ResolutionFailureStage } from "./call_chains.js";
import {
  ARIADNE_FAULT_AREAS,
  ARIADNE_FAULT_AREA_FOLDER,
  is_ariadne_fault_area,
  derive_fault_area,
} from "./ariadne_fault_area.js";
import type { AriadneFaultLocation, DeriveFaultAreaInput } from "./ariadne_fault_area.js";

// Base input with no fault evidence; per-case overrides supply the signal.
function input(over: Partial<DeriveFaultAreaInput>): DeriveFaultAreaInput {
  return {
    resolution_failure: null,
    diagnosis: "callers-in-registry-wrong-target",
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
    ...over,
  };
}

function failure(
  stage: ResolutionFailureStage,
  reason: ResolutionFailureReason,
): DeriveFaultAreaInput {
  return input({ resolution_failure: { stage, reason } });
}

describe("derive_fault_area — (stage, reason) table", () => {
  // Each reason at the stage it is actually emitted from, → its area.
  // needs_judgement is false for all reasons except collection_dispatch_miss.
  const cases: ReadonlyArray<{
    stage: ResolutionFailureStage;
    reason: ResolutionFailureReason;
    expected: AriadneFaultLocation;
  }> = [
    {
      stage: "name_resolution",
      reason: "name_not_in_scope",
      expected: {
        area: "name_resolution",
        resolution_stage: "name_resolution",
        resolution_reason: "name_not_in_scope",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "import_resolution",
      reason: "import_unresolved",
      expected: {
        area: "import_resolution",
        resolution_stage: "import_resolution",
        resolution_reason: "import_unresolved",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "import_resolution",
      reason: "reexport_chain_unresolved",
      expected: {
        area: "import_resolution",
        resolution_stage: "import_resolution",
        resolution_reason: "reexport_chain_unresolved",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "type_inference",
      reason: "receiver_type_unknown",
      expected: {
        area: "receiver_type_inference",
        resolution_stage: "type_inference",
        resolution_reason: "receiver_type_unknown",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "type_inference",
      reason: "member_type_unknown",
      expected: {
        area: "receiver_type_inference",
        resolution_stage: "type_inference",
        resolution_reason: "member_type_unknown",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "method_lookup",
      reason: "polymorphic_no_implementations",
      expected: {
        area: "polymorphic_dispatch",
        resolution_stage: "method_lookup",
        resolution_reason: "polymorphic_no_implementations",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "collection_dispatch",
      reason: "dynamic_dispatch",
      expected: {
        area: "collection_dispatch",
        resolution_stage: "collection_dispatch",
        resolution_reason: "dynamic_dispatch",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "receiver_resolution",
      reason: "no_enclosing_class_scope",
      expected: {
        area: "scope_construction",
        resolution_stage: "receiver_resolution",
        resolution_reason: "no_enclosing_class_scope",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "receiver_resolution",
      reason: "class_definition_not_found",
      expected: {
        area: "scope_construction",
        resolution_stage: "receiver_resolution",
        resolution_reason: "class_definition_not_found",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "receiver_resolution",
      reason: "no_parent_class",
      expected: {
        area: "scope_construction",
        resolution_stage: "receiver_resolution",
        resolution_reason: "no_parent_class",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "name_resolution",
      reason: "definition_has_no_body_scope",
      expected: {
        area: "scope_construction",
        resolution_stage: "name_resolution",
        resolution_reason: "definition_has_no_body_scope",
        language: undefined,
        needs_judgement: false,
      },
    },
    {
      stage: "constructor_lookup",
      reason: "constructor_target_not_a_class",
      expected: {
        area: "method_lookup",
        resolution_stage: "constructor_lookup",
        resolution_reason: "constructor_target_not_a_class",
        language: undefined,
        needs_judgement: false,
      },
    },
  ];

  test.each(cases)("$reason @ $stage → $expected.area", ({ stage, reason, expected }) => {
    expect(derive_fault_area(failure(stage, reason))).toEqual(expected);
  });

  test("collection_dispatch_miss → collection_dispatch with needs_judgement (residual case 4)", () => {
    expect(derive_fault_area(failure("collection_dispatch", "collection_dispatch_miss"))).toEqual({
      area: "collection_dispatch",
      resolution_stage: "collection_dispatch",
      resolution_reason: "collection_dispatch_miss",
      language: undefined,
      needs_judgement: true,
    });
  });
});

describe("derive_fault_area — method_not_on_type is the sole stage-ambiguous reason", () => {
  test("at receiver_resolution → receiver_type_inference", () => {
    expect(derive_fault_area(failure("receiver_resolution", "method_not_on_type"))).toEqual({
      area: "receiver_type_inference",
      resolution_stage: "receiver_resolution",
      resolution_reason: "method_not_on_type",
      language: undefined,
      needs_judgement: false,
    });
  });

  test("at method_lookup → method_lookup", () => {
    expect(derive_fault_area(failure("method_lookup", "method_not_on_type"))).toEqual({
      area: "method_lookup",
      resolution_stage: "method_lookup",
      resolution_reason: "method_not_on_type",
      language: undefined,
      needs_judgement: false,
    });
  });

  test("at an unrecognized stage → other escape hatch", () => {
    const result = derive_fault_area(
      input({ resolution_failure: { stage: "future_stage", reason: "method_not_on_type" } }),
    );
    expect(result.area).toEqual("other");
    expect(result.needs_judgement).toEqual(true);
    expect(result.description).toContain("method_not_on_type");
  });
});

describe("derive_fault_area — diagnosis fallback", () => {
  test("no-textual-callers → entry_point_classification, needs_judgement (residual case 3)", () => {
    expect(derive_fault_area(input({ diagnosis: "no-textual-callers" }))).toEqual({
      area: "entry_point_classification",
      language: undefined,
      needs_judgement: true,
    });
  });

  test("callers-in-registry-wrong-target → entry_point_classification, deterministic", () => {
    expect(derive_fault_area(input({ diagnosis: "callers-in-registry-wrong-target" }))).toEqual({
      area: "entry_point_classification",
      language: undefined,
      needs_judgement: false,
    });
  });

  test("no-textual-callers + callers only in unindexed tests → coverage_config (the real coverage-gap shape)", () => {
    // compute_diagnosis returns no-textual-callers when the indexed grep is
    // empty, which is exactly the case when every caller is in an excluded dir.
    // The coverage signal must win over the no-textual-callers default.
    expect(
      derive_fault_area(
        input({ diagnosis: "no-textual-callers", callers_only_in_unindexed_tests: true }),
      ),
    ).toEqual({
      area: "coverage_config",
      language: undefined,
      needs_judgement: false,
    });
  });

  test("coverage signal wins over the diagnosis regardless of which diagnosis is set", () => {
    expect(
      derive_fault_area(
        input({ diagnosis: "callers-not-in-registry", callers_only_in_unindexed_tests: true }),
      ),
    ).toEqual({
      area: "coverage_config",
      language: undefined,
      needs_judgement: false,
    });
  });

  test("callers-not-in-registry + uncaptured indexed hit → syntactic_extraction, deterministic", () => {
    expect(
      derive_fault_area(
        input({ diagnosis: "callers-not-in-registry", has_uncaptured_indexed_grep_hit: true }),
      ),
    ).toEqual({
      area: "syntactic_extraction",
      language: undefined,
      needs_judgement: false,
    });
  });

  test("callers-not-in-registry + captured-but-lost hit → syntactic_extraction, needs_judgement (residual case 1)", () => {
    expect(derive_fault_area(input({ diagnosis: "callers-not-in-registry" }))).toEqual({
      area: "syntactic_extraction",
      language: undefined,
      needs_judgement: true,
    });
  });

  test("coverage_config wins over the uncaptured-hit signal", () => {
    expect(
      derive_fault_area(
        input({
          diagnosis: "callers-not-in-registry",
          callers_only_in_unindexed_tests: true,
          has_uncaptured_indexed_grep_hit: true,
        }),
      ),
    ).toEqual({
      area: "coverage_config",
      language: undefined,
      needs_judgement: false,
    });
  });
});

describe("derive_fault_area — residual case 2: callers-in-registry-unresolved with no resolution_failure", () => {
  test("→ other with a non-empty description and needs_judgement", () => {
    const result = derive_fault_area(input({ diagnosis: "callers-in-registry-unresolved" }));
    expect(result.area).toEqual("other");
    expect(result.needs_judgement).toEqual(true);
    expect(result.description?.length).toBeGreaterThan(0);
    expect(result.description).toContain("missing emit");
  });
});

describe("derive_fault_area — precedence: resolution_failure beats diagnosis", () => {
  test("a failure derives from the (stage, reason) path even with a conflicting diagnosis", () => {
    expect(
      derive_fault_area({
        resolution_failure: { stage: "import_resolution", reason: "import_unresolved" },
        diagnosis: "no-textual-callers",
        has_uncaptured_indexed_grep_hit: false,
        callers_only_in_unindexed_tests: false,
      }),
    ).toEqual({
      area: "import_resolution",
      resolution_stage: "import_resolution",
      resolution_reason: "import_unresolved",
      language: undefined,
      needs_judgement: false,
    });
  });
});

describe("derive_fault_area — escape hatch for forward-incompatible signals", () => {
  test("unknown resolution_failure reason → other, exact shape (no resolution_stage/reason leak)", () => {
    expect(
      derive_fault_area(
        input({ resolution_failure: { stage: "name_resolution", reason: "brand_new_reason" } }),
      ),
    ).toEqual({
      area: "other",
      language: undefined,
      needs_judgement: true,
      description:
        "unrecognized resolution_failure reason \"brand_new_reason\" at stage \"name_resolution\"",
    });
  });

  test("unknown diagnosis → other, exact shape", () => {
    expect(derive_fault_area(input({ diagnosis: "some-future-diagnosis" }))).toEqual({
      area: "other",
      language: undefined,
      needs_judgement: true,
      description: "unrecognized diagnosis \"some-future-diagnosis\"",
    });
  });

  test("a known reason at an unrecognized stage still derives (stage is omitted)", () => {
    // name_not_in_scope is stage-independent: an unknown stage does not block it.
    expect(
      derive_fault_area(
        input({ resolution_failure: { stage: "future_stage", reason: "name_not_in_scope" } }),
      ),
    ).toEqual({
      area: "name_resolution",
      resolution_stage: undefined,
      resolution_reason: "name_not_in_scope",
      language: undefined,
      needs_judgement: false,
    });
  });
});

describe("derive_fault_area — language is echoed as a language-specific signal", () => {
  test("echoes language through the (stage, reason) path", () => {
    expect(
      derive_fault_area({
        resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
        diagnosis: "callers-not-in-registry",
        has_uncaptured_indexed_grep_hit: false,
        callers_only_in_unindexed_tests: false,
        language: "typescript",
      }),
    ).toEqual({
      area: "name_resolution",
      resolution_stage: "name_resolution",
      resolution_reason: "name_not_in_scope",
      language: "typescript",
      needs_judgement: false,
    });
  });

  test("echoes language through the diagnosis fallback", () => {
    expect(
      derive_fault_area(input({ diagnosis: "no-textual-callers", language: "rust" })),
    ).toEqual({
      area: "entry_point_classification",
      language: "rust",
      needs_judgement: true,
    });
  });
});

describe("ARIADNE_FAULT_AREA_FOLDER and the area enumeration", () => {
  test("the folder map keys are exactly the fault-area enumeration", () => {
    expect(Object.keys(ARIADNE_FAULT_AREA_FOLDER).sort()).toEqual([...ARIADNE_FAULT_AREAS].sort());
  });

  test("every non-other area maps to a non-empty repo-relative path; other maps to empty", () => {
    for (const area of ARIADNE_FAULT_AREAS) {
      if (area === "other") {
        expect(ARIADNE_FAULT_AREA_FOLDER[area]).toEqual("");
      } else {
        expect(ARIADNE_FAULT_AREA_FOLDER[area].startsWith("packages/core/src/")).toEqual(true);
      }
    }
  });

  test("the enumeration is the 10 folder-anchored areas plus other", () => {
    expect([...ARIADNE_FAULT_AREAS].sort()).toEqual(
      [
        "collection_dispatch",
        "coverage_config",
        "entry_point_classification",
        "import_resolution",
        "method_lookup",
        "name_resolution",
        "other",
        "polymorphic_dispatch",
        "receiver_type_inference",
        "scope_construction",
        "syntactic_extraction",
      ].sort(),
    );
  });

  test("is_ariadne_fault_area narrows known and rejects unknown strings", () => {
    expect(is_ariadne_fault_area("method_lookup")).toEqual(true);
    expect(is_ariadne_fault_area("other")).toEqual(true);
    expect(is_ariadne_fault_area("receiver_resolution")).toEqual(false);
    expect(is_ariadne_fault_area("not_an_area")).toEqual(false);
  });
});
