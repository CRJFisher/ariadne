import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { KnownIssue } from "@ariadnejs/types";
import {
  load_permanent_registry,
  PermanentRegistryError,
  reset_permanent_registry_cache_for_tests,
} from "./registry_loader";
import { PERMANENT_REGISTRY } from "./registry_permanent";

describe("registry_loader", () => {
  beforeEach(() => {
    reset_permanent_registry_cache_for_tests();
  });

  it("loads the bundled permanent slice", () => {
    const registry = load_permanent_registry();
    expect(registry.length).toBeGreaterThan(0);
    // Every loaded rule is permanent and has a non-`none` classifier.
    for (const issue of registry) {
      expect(issue.status).toBe("permanent");
      expect(issue.classifier.kind).not.toBe("none");
    }
  });

  it("includes the py-dunder-protocol rule that replaces filter_entry_points.python.ts", () => {
    const registry = load_permanent_registry();
    const dunder = registry.find((i) => i.group_id === "py-dunder-protocol");
    expect(dunder).toBeDefined();
    expect(dunder!.classifier.kind).toBe("builtin");
  });

  it("pre-compiles regex patterns on predicate nodes", () => {
    const registry = load_permanent_registry();
    const py_property = registry.find((i) => i.group_id === "py-property-decorator-access");
    expect(py_property).toBeDefined();
    const expr = (py_property!.classifier as { expression: { of: { compiled_pattern?: RegExp; op: string }[] } }).expression;
    const decorator_node = expr.of.find((n) => n.op === "decorator_matches");
    expect(decorator_node?.compiled_pattern).toBeInstanceOf(RegExp);
  });

  it("returns the same registry instance on repeated calls (cache hit)", () => {
    const a = load_permanent_registry();
    const b = load_permanent_registry();
    expect(a).toBe(b);
  });
});

describe("registry_loader — defense-in-depth", () => {
  let restored: KnownIssue[];

  beforeEach(() => {
    reset_permanent_registry_cache_for_tests();
    // Snapshot the bundled slice so each negative test can mutate the
    // module-level constant and restore it after the assertion.
    restored = [...PERMANENT_REGISTRY];
  });

  afterEach(() => {
    PERMANENT_REGISTRY.length = 0;
    PERMANENT_REGISTRY.push(...restored);
    reset_permanent_registry_cache_for_tests();
  });

  it("rejects a synthetic non-permanent rule injected into the bundled slice", () => {
    PERMANENT_REGISTRY.push({
      group_id: "synthetic-wip-rule",
      title: "synthetic",
      description: "synthetic",
      status: "wip",
      languages: ["typescript"],
      examples: [],
      classifier: {
        kind: "predicate",
        axis: "A",
        expression: { op: "diagnosis_eq", value: "no-textual-callers" },
        min_confidence: 1.0,
      },
    });
    expect(() => load_permanent_registry()).toThrow(PermanentRegistryError);
    expect(() => load_permanent_registry()).toThrow(/non-permanent/);
  });

  it("rejects a synthetic kind:\"none\" rule injected into the bundled slice", () => {
    PERMANENT_REGISTRY.push({
      group_id: "synthetic-kind-none-rule",
      title: "synthetic",
      description: "synthetic",
      status: "permanent",
      languages: ["typescript"],
      examples: [],
      classifier: { kind: "none" },
    });
    expect(() => load_permanent_registry()).toThrow(PermanentRegistryError);
    expect(() => load_permanent_registry()).toThrow(/kind:"none"/);
  });
});
