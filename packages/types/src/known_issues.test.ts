import { describe, expect, it } from "vitest";

import {
  KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
  type KnownIssue,
  parse_known_issues_registry_json,
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
});
