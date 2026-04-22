import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apply_proposals,
  mark_drift_in_registry,
  parse_investigate_response,
  parse_qa_response,
  validate_code_changes,
} from "./apply_proposals.js";
import type {
  InvestigateResponse,
  KnownIssue,
  QaResponse,
} from "./types.js";

let tmp_dir: string;
let allowed_root: string;
let registry_path: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "curator-apply-"));
  allowed_root = path.join(tmp_dir, "allowed");
  await fs.mkdir(allowed_root, { recursive: true });
  registry_path = path.join(tmp_dir, "registry.json");
  await fs.writeFile(registry_path, "[]", "utf8");
});

afterEach(async () => {
  await fs.rm(tmp_dir, { recursive: true, force: true });
});

function known(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    group_id,
    title: group_id,
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "builtin", function_name: group_id, min_confidence: 0.9 },
    ...overrides,
  };
}

async function write_registry(entries: KnownIssue[]): Promise<void> {
  await fs.writeFile(registry_path, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

async function read_registry_json(): Promise<KnownIssue[]> {
  const raw = await fs.readFile(registry_path, "utf8");
  return JSON.parse(raw) as KnownIssue[];
}

describe("validate_code_changes", () => {
  it("accepts paths inside allowed roots", async () => {
    const inside = path.join(allowed_root, "sub", "file.ts");
    const violations = await validate_code_changes(
      [{ path: inside, contents: "x" }],
      { allowed_roots: [allowed_root] },
    );
    expect(violations).toEqual([]);
  });

  it("rejects paths outside allowed roots", async () => {
    const outside = path.join(tmp_dir, "other", "file.ts");
    const violations = await validate_code_changes(
      [{ path: outside, contents: "x" }],
      { allowed_roots: [allowed_root] },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/outside allowed roots/);
  });

  it("rejects relative paths", async () => {
    const violations = await validate_code_changes(
      [{ path: "relative/file.ts", contents: "x" }],
      { allowed_roots: [allowed_root] },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/absolute/);
  });

  it("rejects empty paths", async () => {
    const violations = await validate_code_changes(
      [{ path: "", contents: "x" }],
      { allowed_roots: [allowed_root] },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/empty/);
  });

  it("rejects path traversal with ..", async () => {
    const traversal = path.join(allowed_root, "..", "escape.ts");
    const violations = await validate_code_changes(
      [{ path: traversal, contents: "x" }],
      { allowed_roots: [allowed_root] },
    );
    expect(violations).toHaveLength(1);
  });

  it("rejects symlink-escape into a sibling directory", async () => {
    const elsewhere = path.join(tmp_dir, "elsewhere");
    await fs.mkdir(elsewhere, { recursive: true });
    // allowed_root/link → elsewhere (a sibling outside the allow-root)
    const link_dir = path.join(allowed_root, "link");
    await fs.symlink(elsewhere, link_dir);
    const target = path.join(link_dir, "pwned.ts");
    const violations = await validate_code_changes(
      [{ path: target, contents: "x" }],
      { allowed_roots: [allowed_root] },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/outside allowed roots/);
  });
});

describe("parse_qa_response", () => {
  it("accepts a well-formed response", () => {
    const parsed = parse_qa_response({
      group_id: "g1",
      outliers: [{ entry_index: 3, reason: "looks wrong" }],
      notes: "ok",
    });
    expect(parsed).toEqual<QaResponse>({
      group_id: "g1",
      outliers: [{ entry_index: 3, reason: "looks wrong" }],
      notes: "ok",
    });
  });

  it("rejects non-object input", () => {
    expect(parse_qa_response(null)).toEqual({ error: "QA response is not an object" });
    expect(parse_qa_response("x")).toEqual({ error: "QA response is not an object" });
  });

  it("rejects missing group_id", () => {
    const result = parse_qa_response({ outliers: [], notes: "" });
    expect(result).toEqual({ error: "QA response: group_id must be a non-empty string" });
  });

  it("rejects non-integer entry_index", () => {
    const result = parse_qa_response({
      group_id: "g",
      outliers: [{ entry_index: 1.5, reason: "x" }],
      notes: "",
    });
    expect(result).toEqual({
      error: "QA response: outliers[0].entry_index must be an integer",
    });
  });
});

describe("parse_investigate_response", () => {
  const base = {
    group_id: "g",
    proposed_classifier: null,
    backlog_ref: null,
    new_signals_needed: [],
    code_changes: [],
    reasoning: "",
  };

  it("accepts a minimal well-formed response", () => {
    const result = parse_investigate_response(base);
    expect(result).toEqual<InvestigateResponse>(base);
  });

  it("accepts full response with predicate classifier and backlog ref", () => {
    const full = {
      group_id: "g",
      proposed_classifier: {
        kind: "predicate",
        axis: "B",
        min_confidence: 0.85,
        expression: { op: "diagnosis_eq", value: "x" },
      },
      backlog_ref: { title: "fix it", description: "body" },
      new_signals_needed: ["grep_call_sites"],
      code_changes: [{ path: "/abs/p.ts", contents: "src" }],
      reasoning: "because",
    };
    const result = parse_investigate_response(full);
    expect(result).toEqual<InvestigateResponse>({
      group_id: "g",
      proposed_classifier: {
        kind: "predicate",
        axis: "B",
        min_confidence: 0.85,
        expression: { op: "diagnosis_eq", value: "x" },
      },
      backlog_ref: { title: "fix it", description: "body" },
      new_signals_needed: ["grep_call_sites"],
      code_changes: [{ path: "/abs/p.ts", contents: "src" }],
      reasoning: "because",
    });
  });

  it("accepts kind='none' classifier", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "none" },
    });
    expect(result).toEqual<InvestigateResponse>({
      ...base,
      proposed_classifier: { kind: "none" },
    });
  });

  it("rejects kind='none' that carries extra fields", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "none", function_name: "nope" },
    });
    expect(result).toEqual({
      error:
        "proposed_classifier: kind='none' must not carry function_name, expression, or axis",
    });
  });

  it("rejects invalid classifier kind", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "magic", min_confidence: 0.9 },
    });
    expect(result).toEqual({
      error: "proposed_classifier.kind must be 'none', 'builtin', or 'predicate'",
    });
  });

  it("rejects out-of-range min_confidence", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "x", min_confidence: 1.5 },
    });
    expect(result).toEqual({ error: "proposed_classifier.min_confidence must be in [0, 1]" });
  });

  it("defaults missing min_confidence to 0.9 on builtin", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "some_check" },
    });
    expect(result).toEqual<InvestigateResponse>({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "some_check", min_confidence: 0.9 },
    });
  });

  it("defaults missing min_confidence to 0.9 on predicate", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: {
        kind: "predicate",
        axis: "A",
        expression: { op: "receiver_kind_eq", value: "object" },
      },
    });
    expect(result).toEqual<InvestigateResponse>({
      ...base,
      proposed_classifier: {
        kind: "predicate",
        axis: "A",
        expression: { op: "receiver_kind_eq", value: "object" },
        min_confidence: 0.9,
      },
    });
  });

  it("rejects kind='builtin' missing function_name", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", min_confidence: 0.9 },
    });
    expect(result).toEqual({
      error: "proposed_classifier: kind='builtin' requires a non-empty 'function_name'",
    });
  });

  it("rejects kind='builtin' that carries predicate fields", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: {
        kind: "builtin",
        function_name: "f",
        expression: { op: "x" },
      },
    });
    expect(result).toEqual({
      error: "proposed_classifier: kind='builtin' must not carry 'expression' or 'axis'",
    });
  });

  it("rejects kind='predicate' missing axis", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: {
        kind: "predicate",
        expression: { op: "x" },
        min_confidence: 0.9,
      },
    });
    expect(result).toEqual({
      error: "proposed_classifier: kind='predicate' requires axis 'A', 'B', or 'C'",
    });
  });

  it("rejects kind='predicate' missing expression", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "predicate", axis: "A", min_confidence: 0.9 },
    });
    expect(result).toEqual({
      error: "proposed_classifier: kind='predicate' requires 'expression'",
    });
  });

  it("rejects kind='predicate' that carries function_name", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: {
        kind: "predicate",
        axis: "A",
        expression: { op: "x" },
        function_name: "oops",
      },
    });
    expect(result).toEqual({
      error: "proposed_classifier: kind='predicate' must not carry 'function_name'",
    });
  });

  it("rejects empty backlog title", () => {
    const result = parse_investigate_response({
      ...base,
      backlog_ref: { title: "", description: "x" },
    });
    expect(result).toEqual({ error: "backlog_ref.title must be a non-empty string" });
  });

  it("rejects malformed code_changes entries", () => {
    const result = parse_investigate_response({
      ...base,
      code_changes: [{ path: 123, contents: "x" }],
    });
    expect(result).toEqual({ error: "investigate response: code_changes[0].path must be a string" });
  });

  it("rejects code_changes entries with missing contents", () => {
    const result = parse_investigate_response({
      ...base,
      code_changes: [{ path: "/a/b.ts" }],
    });
    expect(result).toEqual({
      error: "investigate response: code_changes[0].contents must be a string",
    });
  });
});

describe("mark_drift_in_registry", () => {
  it("tags groups whose outlier rate meets threshold", () => {
    const reg: KnownIssue[] = [known("a"), known("b"), known("c")];
    const qa: QaResponse[] = [
      { group_id: "a", outliers: [{ entry_index: 0, reason: "" }, { entry_index: 1, reason: "" }, { entry_index: 2, reason: "" }], notes: "" },
      { group_id: "b", outliers: [{ entry_index: 0, reason: "" }], notes: "" },
    ];
    const { updated, drift_tagged_groups } = mark_drift_in_registry(reg, qa, {
      a: 20, // 3/20 = 15% → drift
      b: 20, // 1/20 = 5% → no drift
    });
    expect(drift_tagged_groups).toEqual(["a"]);
    expect(updated.find((e) => e.group_id === "a")?.drift_detected).toBe(true);
    expect(updated.find((e) => e.group_id === "b")?.drift_detected).toBeUndefined();
    expect(updated.find((e) => e.group_id === "c")?.drift_detected).toBeUndefined();
  });

  it("2/10 is at 20% — drift (≥15%)", () => {
    const reg: KnownIssue[] = [known("a")];
    const qa: QaResponse[] = [
      {
        group_id: "a",
        outliers: [
          { entry_index: 0, reason: "" },
          { entry_index: 1, reason: "" },
        ],
        notes: "",
      },
    ];
    const { drift_tagged_groups } = mark_drift_in_registry(reg, qa, { a: 10 });
    expect(drift_tagged_groups).toEqual(["a"]);
  });

  it("1/10 is below threshold — no drift", () => {
    const reg: KnownIssue[] = [known("a")];
    const qa: QaResponse[] = [
      { group_id: "a", outliers: [{ entry_index: 0, reason: "" }], notes: "" },
    ];
    const { drift_tagged_groups } = mark_drift_in_registry(reg, qa, { a: 10 });
    expect(drift_tagged_groups).toEqual([]);
  });

  it("is pure (does not mutate input registry)", () => {
    const reg: KnownIssue[] = [known("a")];
    mark_drift_in_registry(
      reg,
      [{ group_id: "a", outliers: [{ entry_index: 0, reason: "" }, { entry_index: 1, reason: "" }, { entry_index: 2, reason: "" }], notes: "" }],
      { a: 20 },
    );
    expect(reg[0].drift_detected).toBeUndefined();
  });

  it("skips groups with zero members", () => {
    const reg: KnownIssue[] = [known("a")];
    const { drift_tagged_groups } = mark_drift_in_registry(
      reg,
      [{ group_id: "a", outliers: [{ entry_index: 0, reason: "" }], notes: "" }],
      { a: 0 },
    );
    expect(drift_tagged_groups).toEqual([]);
  });

  it("tags previously-clean entries but does not clear existing drift flags", () => {
    // Drift-tagging is sticky — a clean follow-up run does not untag.
    const reg: KnownIssue[] = [known("a", { drift_detected: true })];
    const qa: QaResponse[] = [
      { group_id: "a", outliers: [], notes: "" }, // 0/20 = clean
    ];
    const { updated, drift_tagged_groups } = mark_drift_in_registry(reg, qa, { a: 20 });
    expect(drift_tagged_groups).toEqual([]);
    expect(updated[0].drift_detected).toBe(true);
  });
});

describe("apply_proposals", () => {
  it("dry_run performs zero writes", async () => {
    await write_registry([known("a")]);
    const qa: QaResponse[] = [
      { group_id: "a", outliers: [{ entry_index: 0, reason: "" }, { entry_index: 1, reason: "" }, { entry_index: 2, reason: "" }], notes: "" },
    ];
    const inv: InvestigateResponse[] = [
      {
        group_id: "new-group",
        proposed_classifier: { kind: "builtin", function_name: "new_check", min_confidence: 0.9 },
        backlog_ref: { title: "t", description: "d" },
        new_signals_needed: [],
        code_changes: [{ path: path.join(allowed_root, "new.ts"), contents: "content" }],
        reasoning: "r",
      },
    ];
    const result = await apply_proposals(qa, inv, { a: 20 }, {
      dry_run: true,
      scope: { allowed_roots: [allowed_root] },
      registry_path,
    });

    expect(result.wrote_files).toEqual([]);
    expect(result.drift_tagged_groups).toEqual(["a"]);
    expect(result.registry_upserts).toEqual(["new-group"]);
    expect(result.backlog_tasks_to_create).toEqual([{ title: "t", description: "d" }]);

    const on_disk = await read_registry_json();
    expect(on_disk).toEqual([known("a")]);
    const new_file_exists = await fs
      .stat(path.join(allowed_root, "new.ts"))
      .then(() => true)
      .catch(() => false);
    expect(new_file_exists).toBe(false);
  });

  it("apply mode writes registry + allowed code_changes", async () => {
    await write_registry([known("a")]);
    const qa: QaResponse[] = [
      { group_id: "a", outliers: [{ entry_index: 0, reason: "" }, { entry_index: 1, reason: "" }, { entry_index: 2, reason: "" }], notes: "" },
    ];
    const target = path.join(allowed_root, "sub", "file.ts");
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: {
          kind: "predicate",
          axis: "B",
          expression: { op: "diagnosis_eq", value: "x" },
          min_confidence: 0.95,
        },
        backlog_ref: null,
        new_signals_needed: [],
        code_changes: [{ path: target, contents: "hello" }],
        reasoning: "",
      },
    ];
    const result = await apply_proposals(qa, inv, { a: 20 }, {
      dry_run: false,
      scope: { allowed_roots: [allowed_root] },
      registry_path,
    });

    expect(result.wrote_files).toContain(target);
    expect(result.wrote_files).toContain(registry_path);
    expect(result.skipped_code_changes).toEqual([]);

    const on_disk = await read_registry_json();
    expect(on_disk[0].drift_detected).toBe(true);
    expect(on_disk[0].classifier).toEqual({
      kind: "predicate",
      axis: "B",
      expression: { op: "diagnosis_eq", value: "x" },
      min_confidence: 0.95,
    });
    const written = await fs.readFile(target, "utf8");
    expect(written).toBe("hello");
  });

  it("rejects out-of-allowlist code_changes and still applies registry changes", async () => {
    await write_registry([known("a")]);
    const outside = path.join(tmp_dir, "escape", "bad.ts");
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: {
          kind: "predicate",
          axis: "A",
          expression: { op: "x" },
          min_confidence: 0.9,
        },
        backlog_ref: null,
        new_signals_needed: [],
        code_changes: [{ path: outside, contents: "x" }],
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: false,
      scope: { allowed_roots: [allowed_root] },
      registry_path,
    });

    expect(result.skipped_code_changes).toHaveLength(1);
    expect(result.skipped_code_changes[0].change.path).toBe(outside);
    expect(result.wrote_files).toEqual([registry_path]);
    const escaped = await fs
      .stat(outside)
      .then(() => true)
      .catch(() => false);
    expect(escaped).toBe(false);
  });

  it("rejects code_changes that target the registry path", async () => {
    await write_registry([known("a")]);
    // Registry happens to live under allowed_root in this test.
    const inside_registry = path.join(allowed_root, "registry.json");
    await fs.writeFile(inside_registry, "[]", "utf8");
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: null,
        backlog_ref: null,
        new_signals_needed: [],
        code_changes: [{ path: inside_registry, contents: "[{\"hacked\":true}]" }],
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: false,
      scope: { allowed_roots: [allowed_root] },
      registry_path: inside_registry,
    });

    expect(result.skipped_code_changes).toHaveLength(1);
    expect(result.skipped_code_changes[0].reason).toMatch(/registry is managed/);
    // Registry contents untouched.
    const on_disk = await fs.readFile(inside_registry, "utf8");
    expect(on_disk).toBe("[]");
  });

  it("does not write registry when nothing changed", async () => {
    await write_registry([known("a")]);
    const result = await apply_proposals([], [], {}, {
      dry_run: false,
      scope: { allowed_roots: [allowed_root] },
      registry_path,
    });
    expect(result.wrote_files).toEqual([]);
    expect(result.registry_upserts).toEqual([]);
    expect(result.drift_tagged_groups).toEqual([]);
  });

  it("deduplicates new_signals_needed across responses", async () => {
    await write_registry([]);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: null,
        backlog_ref: null,
        new_signals_needed: ["grep_call_sites", "decorator_scan"],
        code_changes: [],
        reasoning: "",
      },
      {
        group_id: "b",
        proposed_classifier: null,
        backlog_ref: null,
        new_signals_needed: ["decorator_scan", "receiver_kind"],
        code_changes: [],
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: true,
      scope: { allowed_roots: [allowed_root] },
      registry_path,
    });
    expect(result.new_signals_needed.sort()).toEqual([
      "decorator_scan",
      "grep_call_sites",
      "receiver_kind",
    ]);
  });
});
