/**
 * Fixture tests for the registry lint lens. Covers the three cross-checks it
 * layers on top of `validate_registry` (BUILTIN_CHECKS membership, a present
 * observed_count >= 1, no drift on fixed rows) plus its short-circuit on a
 * structurally invalid registry. The structural schema itself is covered in
 * `known_issues_registry.test.ts`.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { KnownIssue } from "@ariadnejs/types";
import { serialize_known_issues_registry_json } from "@ariadnejs/types";

import { check_registry } from "./check_registry.js";

const valid_rule: KnownIssue = {
  group_id: "dynamic-dispatch",
  title: "Dynamic dispatch",
  description: "A permanent limitation with a real backing builtin check.",
  status: "permanent",
  languages: ["typescript"],
  examples: [],
  classifier: { function_name: "check_dynamic_dispatch", min_confidence: 1 },
  observed_count: 3,
};

describe("check_registry", () => {
  let tmp_dir: string;
  let registry_path: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "check-registry-"));
    registry_path = path.join(tmp_dir, "registry.json");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  it("passes a registry whose classifiers all resolve to BUILTIN_CHECKS", async () => {
    await fs.writeFile(registry_path, serialize_known_issues_registry_json([valid_rule]));
    expect(check_registry(registry_path)).toEqual({
      registry_path,
      ok: true,
      checked: 1,
      issues: [],
    });
  });

  it("fails a classifier function_name absent from BUILTIN_CHECKS", async () => {
    const rule: KnownIssue = {
      ...valid_rule,
      group_id: "bogus-rule",
      status: "wip",
      classifier: { function_name: "check_does_not_exist", min_confidence: 0.5 },
      observed_count: 3,
    };
    await fs.writeFile(registry_path, serialize_known_issues_registry_json([rule]));
    expect(check_registry(registry_path)).toEqual({
      registry_path,
      ok: false,
      checked: 1,
      issues: [
        "group_id=\"bogus-rule\": classifier.function_name \"check_does_not_exist\" is not a registered BUILTIN_CHECKS check",
      ],
    });
  });

  it("fails a present observed_count below 1", async () => {
    const rule: KnownIssue = { ...valid_rule, group_id: "unobserved", observed_count: 0 };
    await fs.writeFile(registry_path, serialize_known_issues_registry_json([rule]));
    expect(check_registry(registry_path)).toEqual({
      registry_path,
      ok: false,
      checked: 1,
      issues: [
        "group_id=\"unobserved\": observed_count=0 — a present observed_count must be >= 1 (no never-observed classifiers)",
      ],
    });
  });

  it("fails a fixed row carrying drift_detected", async () => {
    const rule: KnownIssue = {
      ...valid_rule,
      group_id: "fixed-drift",
      status: "fixed",
      drift_detected: true,
    };
    await fs.writeFile(registry_path, serialize_known_issues_registry_json([rule]));
    expect(check_registry(registry_path)).toEqual({
      registry_path,
      ok: false,
      checked: 1,
      issues: [
        "group_id=\"fixed-drift\": a fixed row must not carry drift_detected=true (drift review is a live-rule signal)",
      ],
    });
  });

  it("short-circuits with checked=0 on a structurally invalid registry", async () => {
    await fs.writeFile(
      registry_path,
      JSON.stringify({ schema_version: 1, rules: [{ group_id: "NOT_KEBAB" }] }),
    );
    const result = check_registry(registry_path);
    expect(result.ok).toEqual(false);
    expect(result.checked).toEqual(0);
    expect(result.issues.length).toEqual(1);
  });

  it("passes observed_count exactly 1 and an absent observed_count", async () => {
    const at_gate: KnownIssue = { ...valid_rule, group_id: "at-gate", observed_count: 1 };
    const absent: KnownIssue = { ...valid_rule, group_id: "absent-count" };
    delete absent.observed_count;
    absent.classifier = { function_name: "check_string_keyed_dispatch", min_confidence: 1 };
    await fs.writeFile(registry_path, serialize_known_issues_registry_json([at_gate, absent]));
    expect(check_registry(registry_path)).toEqual({
      registry_path,
      ok: true,
      checked: 2,
      issues: [],
    });
  });

  it("checks every row and accumulates one issue per violation across a multi-rule registry", async () => {
    const bogus: KnownIssue = {
      ...valid_rule,
      group_id: "bogus-fn",
      status: "wip",
      classifier: { function_name: "check_missing_one", min_confidence: 0.5 },
      observed_count: 2,
    };
    const good: KnownIssue = {
      ...valid_rule,
      group_id: "good-row",
      classifier: { function_name: "check_string_keyed_dispatch", min_confidence: 1 },
    };
    const drift: KnownIssue = {
      ...valid_rule,
      group_id: "fixed-with-drift",
      status: "fixed",
      classifier: { function_name: "check_eval_based_dynamic_dispatch", min_confidence: 1 },
      drift_detected: true,
    };
    await fs.writeFile(registry_path, serialize_known_issues_registry_json([bogus, good, drift]));
    expect(check_registry(registry_path)).toEqual({
      registry_path,
      ok: false,
      checked: 3,
      issues: [
        "group_id=\"bogus-fn\": classifier.function_name \"check_missing_one\" is not a registered BUILTIN_CHECKS check",
        "group_id=\"fixed-with-drift\": a fixed row must not carry drift_detected=true (drift review is a live-rule signal)",
      ],
    });
  });

  it("passes an empty registry with checked=0", async () => {
    await fs.writeFile(registry_path, serialize_known_issues_registry_json([]));
    expect(check_registry(registry_path)).toEqual({
      registry_path,
      ok: true,
      checked: 0,
      issues: [],
    });
  });

  it("reports a missing --file target as a structured issue, not a stack dump", () => {
    const missing_path = path.join(tmp_dir, "does-not-exist.json");
    const result = check_registry(missing_path);
    expect(result.ok).toEqual(false);
    expect(result.checked).toEqual(0);
    expect(result.issues.length).toEqual(1);
    expect(result.issues[0]).toContain("ENOENT");
  });
});
