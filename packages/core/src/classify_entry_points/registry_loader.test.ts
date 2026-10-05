import { describe, expect, it, beforeEach } from "vitest";
import type { KnownIssue } from "@ariadnejs/types";
import {
  load_permanent_registry,
  PermanentRegistryError,
  reset_permanent_registry_cache_for_tests,
  validate_permanent_slice,
} from "./registry_loader";
import { BUILTIN_CHECKS } from "./builtins";

describe("bundled slice ↔ BUILTIN_CHECKS bijection", () => {
  it("every bundled function_name resolves in BUILTIN_CHECKS", () => {
    // Locks the barrel↔registry invariant so a drift (a registry rule naming a
    // builtin the barrel never registered) fails fast here instead of as a
    // runtime MissingBuiltinError when an entry point happens to match.
    const names = load_permanent_registry().map(
      (rule) => rule.classifier.function_name,
    );
    const missing = names.filter((name) => !(name in BUILTIN_CHECKS));
    expect(missing).toEqual([]);
  });
});

describe("registry_loader", () => {
  beforeEach(() => {
    reset_permanent_registry_cache_for_tests();
  });

  it("loads the bundled permanent slice with only permanent rules", () => {
    const registry = load_permanent_registry();
    expect(registry.length).toBeGreaterThan(0);
    for (const issue of registry) {
      expect(issue.status).toEqual("permanent");
    }
  });

  it("includes the py-dunder-protocol rule that replaces filter_entry_points.python.ts", () => {
    const registry = load_permanent_registry();
    const dunder = registry.find((i) => i.group_id === "py-dunder-protocol");
    if (!dunder) throw new Error("py-dunder-protocol not present in bundled slice");
    expect(dunder.classifier.function_name).toEqual("check_py_dunder_protocol");
  });

  it("includes the true-positive-lambda-handler rule with its firing classifier", () => {
    const registry = load_permanent_registry();
    const lambda = registry.find((i) => i.group_id === "true-positive-lambda-handler");
    if (!lambda) throw new Error("true-positive-lambda-handler not present in bundled slice");
    expect(lambda.classifier.function_name).toEqual("check_true_positive_lambda_handler");
  });

  it("returns the same registry instance on repeated calls (cache hit)", () => {
    const a = load_permanent_registry();
    const b = load_permanent_registry();
    expect(a).toBe(b);
  });
});

describe("validate_permanent_slice — pure validator", () => {
  // Pure function — operates on the synthetic input, no module-level state.
  // Each test constructs the slice it wants to assert against; no mutation
  // of the bundled `PERMANENT_REGISTRY` constant required.

  function make_permanent_rule(group_id: string): KnownIssue {
    return {
      group_id,
      title: group_id,
      description: group_id,
      status: "permanent",
      languages: ["typescript"],
      examples: [],
      classifier: {
        function_name: `check_${group_id.replace(/-/g, "_")}`,
        min_confidence: 1.0,
      },
    };
  }

  it("accepts a slice of permanent rules", () => {
    const slice: readonly KnownIssue[] = [make_permanent_rule("ok-1")];
    expect(() => validate_permanent_slice(slice)).not.toThrow();
  });

  it("rejects a synthetic non-permanent rule with PermanentRegistryError", () => {
    const slice: readonly KnownIssue[] = [
      { ...make_permanent_rule("synthetic-wip-rule"), status: "wip" },
    ];
    expect(() => validate_permanent_slice(slice)).toThrow(PermanentRegistryError);
    expect(() => validate_permanent_slice(slice)).toThrow(/non-permanent/);
  });

  it("rejects a synthetic fixed rule with PermanentRegistryError", () => {
    const slice: readonly KnownIssue[] = [
      { ...make_permanent_rule("synthetic-fixed-rule"), status: "fixed" },
    ];
    expect(() => validate_permanent_slice(slice)).toThrow(PermanentRegistryError);
    expect(() => validate_permanent_slice(slice)).toThrow(/non-permanent/);
  });
});
