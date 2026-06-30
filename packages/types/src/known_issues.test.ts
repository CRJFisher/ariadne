import { describe, expect, it } from "vitest";

import {
  KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
  type KnownIssue,
  parse_known_issues_registry_json,
  render_permanent_slice_module,
  select_permanent_slice_rules,
  serialize_known_issues_registry_json,
} from "./known_issues.js";

const sample_rule: KnownIssue = {
  group_id: "example-group",
  title: "Example",
  description: "An example rule for tests.",
  status: "permanent",
  languages: ["typescript"],
  examples: [],
  classifier: { kind: "none" },
};

function envelope(rules: KnownIssue[]): string {
  return JSON.stringify(
    { schema_version: KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, rules },
    null,
    2,
  );
}

describe("parse_known_issues_registry_json", () => {
  it("returns rules from a well-formed envelope", () => {
    const out = parse_known_issues_registry_json(envelope([sample_rule]));
    expect(out).toEqual([sample_rule]);
  });

  it("rejects non-JSON input with the JSON parser error", () => {
    expect(() => parse_known_issues_registry_json("not-json")).toThrowError(
      /registry\.json is not valid JSON/,
    );
  });

  it("rejects a top-level array (envelope must be an object)", () => {
    expect(() => parse_known_issues_registry_json("[]")).toThrowError(
      /must be a JSON object/,
    );
  });

  it("rejects null payloads", () => {
    expect(() => parse_known_issues_registry_json("null")).toThrowError(
      /must be a JSON object/,
    );
  });

  it("rejects mismatched schema_version", () => {
    const body = JSON.stringify({ schema_version: 999, rules: [] });
    expect(() => parse_known_issues_registry_json(body)).toThrowError(
      /schema_version mismatch/,
    );
  });

  it("rejects non-array `rules`", () => {
    const body = JSON.stringify({
      schema_version: KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
      rules: { not: "an array" },
    });
    expect(() => parse_known_issues_registry_json(body)).toThrowError(
      /`rules` must be an array/,
    );
  });
});

describe("serialize_known_issues_registry_json", () => {
  it("wraps rules in the canonical envelope and ends with a newline", () => {
    const out = serialize_known_issues_registry_json([sample_rule]);
    expect(out.endsWith("\n")).toBe(true);
    const re_parsed = JSON.parse(out) as {
      schema_version: number;
      rules: KnownIssue[];
    };
    expect(re_parsed.schema_version).toBe(
      KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
    );
    expect(re_parsed.rules).toEqual([sample_rule]);
  });

  it("round-trips through parse without loss", () => {
    const wire = serialize_known_issues_registry_json([sample_rule]);
    expect(parse_known_issues_registry_json(wire)).toEqual([sample_rule]);
  });

  it("serializes an empty array as a valid envelope", () => {
    const out = serialize_known_issues_registry_json([]);
    const parsed = parse_known_issues_registry_json(out);
    expect(parsed).toEqual([]);
  });

  it("round-trips a retired-kind rule with its nested `from` intact", () => {
    const retired_rule: KnownIssue = {
      group_id: "retired-rule",
      title: "Retired rule",
      description: "A retired classifier preserving its former builtin.",
      status: "fixed",
      languages: ["typescript"],
      examples: [],
      classifier: {
        kind: "retired",
        from: { kind: "builtin", function_name: "check_retired", min_confidence: 1 },
        reason: "subsumed by TASK-348",
      },
    };
    const wire = serialize_known_issues_registry_json([retired_rule]);
    expect(parse_known_issues_registry_json(wire)).toEqual([retired_rule]);
  });
});

const permanent_predicate_rule: KnownIssue = {
  group_id: "permanent-predicate",
  title: "Permanent predicate rule",
  description: "A bundled rule with a real classifier.",
  status: "permanent",
  languages: ["typescript"],
  examples: [],
  classifier: {
    kind: "predicate",
    axis: "B",
    expression: { op: "diagnosis_eq", value: "no_callers_found" },
    min_confidence: 1,
  },
};

const permanent_none_rule: KnownIssue = {
  group_id: "permanent-none",
  title: "Permanent rule without a classifier",
  description: "Permanent but kind none — must be dropped from the slice.",
  status: "permanent",
  languages: ["python"],
  examples: [],
  classifier: { kind: "none" },
};

const wip_rule: KnownIssue = {
  group_id: "wip-rule",
  title: "Wip rule",
  description: "Not permanent — must be dropped from the slice.",
  status: "wip",
  languages: ["rust"],
  examples: [],
  classifier: {
    kind: "builtin",
    function_name: "check_wip_rule",
    min_confidence: 1,
  },
};

describe("select_permanent_slice_rules", () => {
  it("keeps only permanent rules with a real classifier, in source order", () => {
    const out = select_permanent_slice_rules([
      wip_rule,
      permanent_none_rule,
      permanent_predicate_rule,
    ]);
    expect(out).toEqual([permanent_predicate_rule]);
  });

  it("returns an empty slice when no rule qualifies", () => {
    expect(select_permanent_slice_rules([wip_rule, permanent_none_rule])).toEqual([]);
  });

  it("drops a retired rule even if it is (anomalously) marked permanent", () => {
    const permanent_retired_rule: KnownIssue = {
      group_id: "permanent-retired",
      title: "Permanent but retired",
      description: "A retired classifier must never enter the slice, even if permanent.",
      status: "permanent",
      languages: ["typescript"],
      examples: [],
      classifier: {
        kind: "retired",
        from: { kind: "builtin", function_name: "check_gone", min_confidence: 1 },
        reason: "retired",
      },
    };
    expect(
      select_permanent_slice_rules([permanent_retired_rule, permanent_predicate_rule]),
    ).toEqual([permanent_predicate_rule]);
  });
});

describe("render_permanent_slice_module", () => {
  it("renders the exact module text for a one-rule slice", () => {
    const out = render_permanent_slice_module(KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, [
      permanent_predicate_rule,
    ]);
    const expected =
      "// AUTO-GENERATED slice of the known-issues registry — do not edit by hand.\n" +
      "// Source of truth: .claude/skills/triage/known_issues/registry.json\n" +
      "// Regenerated from the source registry when its permanent slice changes.\n" +
      "\n" +
      "import type { KnownIssuesRegistryFile } from \"@ariadnejs/types\";\n" +
      "\n" +
      "export const PERMANENT_REGISTRY_FILE: KnownIssuesRegistryFile = " +
      JSON.stringify(
        { schema_version: KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, rules: [permanent_predicate_rule] },
        null,
        2,
      ) +
      ";\n";
    expect(out).toEqual(expected);
  });

  it("filters the input through select_permanent_slice_rules", () => {
    const full = render_permanent_slice_module(KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, [
      wip_rule,
      permanent_none_rule,
      permanent_predicate_rule,
    ]);
    const filtered = render_permanent_slice_module(KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, [
      permanent_predicate_rule,
    ]);
    expect(full).toEqual(filtered);
  });

  it("is byte-deterministic for identical input", () => {
    const a = render_permanent_slice_module(KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, [
      permanent_predicate_rule,
    ]);
    const b = render_permanent_slice_module(KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, [
      permanent_predicate_rule,
    ]);
    expect(a).toEqual(b);
  });

  it("renders an empty slice as a valid module", () => {
    const out = render_permanent_slice_module(KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION, [
      wip_rule,
    ]);
    expect(out).toContain("\"rules\": []");
  });
});
