import { describe, expect, it, beforeEach } from "vitest";
import type { KnownIssue } from "@ariadnejs/types";
import {
  load_permanent_registry,
  PermanentRegistryError,
  reset_permanent_registry_cache_for_tests,
  validate_permanent_slice,
} from "./registry_loader";

describe("registry_loader", () => {
  beforeEach(() => {
    reset_permanent_registry_cache_for_tests();
  });

  it("loads the bundled permanent slice with only permanent + non-none rules", () => {
    const registry = load_permanent_registry();
    expect(registry.length).toBeGreaterThan(0);
    for (const issue of registry) {
      expect(issue.status).toEqual("permanent");
      expect(issue.classifier.kind === "none").toEqual(false);
    }
  });

  it("includes the py-dunder-protocol rule that replaces filter_entry_points.python.ts", () => {
    const registry = load_permanent_registry();
    const dunder = registry.find((i) => i.group_id === "py-dunder-protocol");
    if (!dunder) throw new Error("py-dunder-protocol not present in bundled slice");
    expect(dunder.classifier.kind).toEqual("builtin");
  });

  it("pre-compiles regex patterns on predicate nodes", () => {
    const registry = load_permanent_registry();
    const py_property = registry.find(
      (i) => i.group_id === "py-property-decorator-access",
    );
    if (!py_property) throw new Error("py-property-decorator-access missing");
    if (py_property.classifier.kind !== "predicate") {
      throw new Error("py-property-decorator-access: expected predicate classifier");
    }
    const expression = py_property.classifier.expression;
    if (expression.op !== "all" && expression.op !== "any") {
      throw new Error(`expected combinator at root, got op=${expression.op}`);
    }
    const decorator_node = expression.of.find((n) => n.op === "decorator_matches");
    if (decorator_node === undefined || decorator_node.op !== "decorator_matches") {
      throw new Error("decorator_matches node missing from expression");
    }
    expect(decorator_node.compiled_pattern instanceof RegExp).toEqual(true);
    expect(decorator_node.compiled_pattern?.source).toEqual(decorator_node.pattern);
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

  function make_permanent_predicate_rule(group_id: string): KnownIssue {
    return {
      group_id,
      title: group_id,
      description: group_id,
      status: "permanent",
      languages: ["typescript"],
      examples: [],
      classifier: {
        kind: "predicate",
        axis: "A",
        expression: { op: "diagnosis_eq", value: "no-textual-callers" },
        min_confidence: 1.0,
      },
    };
  }

  it("accepts a slice of permanent + non-none rules", () => {
    const slice: readonly KnownIssue[] = [make_permanent_predicate_rule("ok-1")];
    expect(() => validate_permanent_slice(slice)).not.toThrow();
  });

  it("rejects a synthetic non-permanent rule with PermanentRegistryError", () => {
    const slice: readonly KnownIssue[] = [
      { ...make_permanent_predicate_rule("synthetic-wip-rule"), status: "wip" },
    ];
    expect(() => validate_permanent_slice(slice)).toThrow(PermanentRegistryError);
    expect(() => validate_permanent_slice(slice)).toThrow(/non-permanent/);
  });

  it('rejects a synthetic kind:"none" rule with PermanentRegistryError', () => {
    const slice: readonly KnownIssue[] = [
      {
        group_id: "synthetic-kind-none-rule",
        title: "synthetic",
        description: "synthetic",
        status: "permanent",
        languages: ["typescript"],
        examples: [],
        classifier: { kind: "none" },
      },
    ];
    expect(() => validate_permanent_slice(slice)).toThrow(PermanentRegistryError);
    expect(() => validate_permanent_slice(slice)).toThrow(/kind:"none"/);
  });
});
