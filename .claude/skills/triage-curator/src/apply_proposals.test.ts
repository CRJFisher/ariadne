import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apply_proposals,
  derive_languages_for_upsert,
  mark_drift_in_registry,
  parse_investigate_response,
  parse_qa_response,
} from "./apply_proposals.js";
import type {
  BuiltinClassifierSpec,
  FalsePositiveGroup,
  InvestigateResponse,
  KnownIssue,
  QaResponse,
} from "./types.js";

let tmp_dir: string;
let authored_dir: string;
let registry_path: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "curator-apply-"));
  authored_dir = path.join(tmp_dir, "authored");
  await fs.mkdir(authored_dir, { recursive: true });
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

function minimal_spec(function_name: string): BuiltinClassifierSpec {
  return {
    function_name,
    min_confidence: 0.9,
    combinator: "all",
    checks: [{ op: "language_eq", value: "typescript" }],
    positive_examples: [],
    negative_examples: [],
    description: "",
  };
}

async function write_authored_file(file_path: string, source = "export {};\n"): Promise<void> {
  await fs.mkdir(path.dirname(file_path), { recursive: true });
  await fs.writeFile(file_path, source, "utf8");
}

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
    classifier_spec: null,
    retargets_to: null,
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
      classifier_spec: null,
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
      classifier_spec: null,
      retargets_to: null,
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
      classifier_spec: minimal_spec("x"),
    });
    expect(result).toEqual({ error: "proposed_classifier.min_confidence must be in [0, 1]" });
  });

  it("defaults missing min_confidence to 0.9 on builtin", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "some_check" },
      classifier_spec: minimal_spec("some_check"),
    });
    expect(result).toEqual<InvestigateResponse>({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "some_check", min_confidence: 0.9 },
      classifier_spec: minimal_spec("some_check"),
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

  it("requires classifier_spec when proposed_classifier is builtin", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      classifier_spec: null,
    });
    expect(result).toEqual({
      error:
        "investigate response: classifier_spec must be provided when proposed_classifier.kind === 'builtin'",
    });
  });

  it("rejects classifier_spec when proposed_classifier is not builtin", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: null,
      classifier_spec: minimal_spec("stray"),
    });
    expect(result).toEqual({
      error:
        "investigate response: classifier_spec must be null unless proposed_classifier.kind === 'builtin'",
    });
  });

  it("rejects classifier_spec whose function_name disagrees with proposed_classifier", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "expected_name", min_confidence: 0.9 },
      classifier_spec: minimal_spec("wrong_name"),
    });
    expect(result).toEqual({
      error:
        "classifier_spec.function_name must equal proposed_classifier.function_name",
    });
  });

  it("accepts builtin with matching classifier_spec and validates every SignalCheck op", () => {
    const spec: BuiltinClassifierSpec = {
      function_name: "check_x",
      min_confidence: 0.95,
      combinator: "any",
      checks: [
        { op: "diagnosis_eq", value: "v" },
        { op: "name_matches", pattern: "^foo" },
      ],
      positive_examples: [0, 2],
      negative_examples: [],
      description: "desc",
    };
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.95 },
      classifier_spec: spec,
    });
    expect(result).toEqual<InvestigateResponse>({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.95 },
      classifier_spec: spec,
    });
  });

  it("rejects unknown SignalCheck op inside classifier_spec", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      classifier_spec: {
        ...minimal_spec("check_x"),
        checks: [{ op: "bogus_op" }],
      },
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/bogus_op/);
    }
  });

  it("rejects negative positive_examples index", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      classifier_spec: {
        ...minimal_spec("check_x"),
        positive_examples: [-1],
      },
    });
    expect(result).toEqual({
      error: "classifier_spec.positive_examples[0] must be a non-negative integer",
    });
  });

  it("rejects duplicate positive_examples indexes", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      classifier_spec: {
        ...minimal_spec("check_x"),
        positive_examples: [0, 2, 0],
      },
    });
    expect(result).toEqual({
      error: "classifier_spec.positive_examples[2] is a duplicate entry index (0)",
    });
  });

  it("rejects duplicate negative_examples indexes", () => {
    const result = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      classifier_spec: {
        ...minimal_spec("check_x"),
        negative_examples: [3, 3],
      },
    });
    expect(result).toEqual({
      error: "classifier_spec.negative_examples[1] is a duplicate entry index (3)",
    });
  });

  it("accepts capture_name on capture ops and rejects the wrong field", () => {
    const ok = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      classifier_spec: {
        ...minimal_spec("check_x"),
        checks: [{ op: "has_capture_at_grep_hit", capture_name: "reference.call" }],
      },
    });
    expect("error" in ok).toBe(false);

    const bad = parse_investigate_response({
      ...base,
      proposed_classifier: { kind: "builtin", function_name: "check_x", min_confidence: 0.9 },
      classifier_spec: {
        ...minimal_spec("check_x"),
        checks: [{ op: "has_capture_at_grep_hit", capture: "reference.call" }],
      },
    });
    expect(bad).toEqual({
      error: "classifier_spec.checks[0].capture_name must be a string",
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

describe("derive_languages_for_upsert", () => {
  function group_with_extensions(
    group_id: string,
    extensions: string[],
  ): FalsePositiveGroup {
    return {
      group_id,
      root_cause: "",
      reasoning: "",
      existing_task_fixes: [],
      entries: extensions.map((ext, i) => ({
        name: `e${i}`,
        file_path: `src/e${i}${ext}`,
        start_line: 1,
      })),
    };
  }

  function builtin_response(
    group_id: string,
    spec: BuiltinClassifierSpec,
  ): InvestigateResponse {
    return {
      group_id,
      proposed_classifier: {
        kind: "builtin",
        function_name: spec.function_name,
        min_confidence: spec.min_confidence,
      },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: spec,
      retargets_to: null,
      reasoning: "",
    };
  }

  it("prefers declared language_eq values from the classifier spec", () => {
    const spec: BuiltinClassifierSpec = {
      ...minimal_spec("check_x"),
      checks: [
        { op: "language_eq", value: "python" },
        { op: "callers_count_at_most", n: 0 },
      ],
    };
    const group = group_with_extensions("g", [".ts", ".ts"]);
    expect(derive_languages_for_upsert(builtin_response("g", spec), group)).toEqual([
      "python",
    ]);
  });

  it("falls back to member file extensions when no language_eq in spec", () => {
    const spec: BuiltinClassifierSpec = {
      ...minimal_spec("check_x"),
      checks: [{ op: "callers_count_at_most", n: 0 }],
    };
    const group = group_with_extensions("g", [".js", ".jsx", ".mjs"]);
    expect(derive_languages_for_upsert(builtin_response("g", spec), group)).toEqual([
      "javascript",
    ]);
  });

  it("returns empty for kind='none' when group has no recognizable extensions", () => {
    const response: InvestigateResponse = {
      group_id: "g",
      proposed_classifier: { kind: "none" },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: null,
      retargets_to: null,
      reasoning: "",
    };
    const group = group_with_extensions("g", [".txt", ".md"]);
    expect(derive_languages_for_upsert(response, group)).toEqual([]);
  });

  it("derives mixed languages from mixed-extension groups", () => {
    const response: InvestigateResponse = {
      group_id: "g",
      proposed_classifier: { kind: "none" },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: null,
      retargets_to: null,
      reasoning: "",
    };
    const group = group_with_extensions("g", [".ts", ".py", ".rs"]);
    expect(derive_languages_for_upsert(response, group).sort()).toEqual([
      "python",
      "rust",
      "typescript",
    ]);
  });
});

describe("apply_proposals", () => {
  it("dry_run does not mutate the registry", async () => {
    await write_registry([known("a")]);
    const qa: QaResponse[] = [
      { group_id: "a", outliers: [{ entry_index: 0, reason: "" }, { entry_index: 1, reason: "" }, { entry_index: 2, reason: "" }], notes: "" },
    ];
    const authored_path = path.join(authored_dir, "check_new-group.ts");
    await write_authored_file(authored_path);
    const inv: InvestigateResponse[] = [
      {
        group_id: "new-group",
        proposed_classifier: { kind: "builtin", function_name: "new_check", min_confidence: 0.9 },
        backlog_ref: null,
        new_signals_needed: [],
        classifier_spec: minimal_spec("new_check"),
        reasoning: "r",
      },
    ];
    const result = await apply_proposals(qa, inv, { a: 20 }, {
      dry_run: true,
      registry_path,
      authored_files_by_group: { "new-group": authored_path },
    });

    expect(result.authored_files).toEqual([authored_path]);
    expect(result.failed_authoring).toEqual([]);
    expect(result.spec_validation_failures).toEqual([]);
    expect(result.drift_tagged_groups).toEqual(["a"]);
    expect(result.registry_upserts).toEqual(["new-group"]);
    expect(result.backlog_tasks_to_create).toEqual([]);

    const on_disk = await read_registry_json();
    expect(on_disk).toEqual([known("a")]);
  });

  it("apply mode writes registry upserts for a predicate classifier", async () => {
    await write_registry([known("a")]);
    const qa: QaResponse[] = [
      { group_id: "a", outliers: [{ entry_index: 0, reason: "" }, { entry_index: 1, reason: "" }, { entry_index: 2, reason: "" }], notes: "" },
    ];
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
        classifier_spec: null,
        reasoning: "",
      },
    ];
    const result = await apply_proposals(qa, inv, { a: 20 }, {
      dry_run: false,
      registry_path,
      authored_files_by_group: {},
    });

    expect(result.registry_upserts).toEqual(["a"]);
    expect(result.failed_authoring).toEqual([]);

    const on_disk = await read_registry_json();
    expect(on_disk[0].drift_detected).toBe(true);
    expect(on_disk[0].classifier).toEqual({
      kind: "predicate",
      axis: "B",
      expression: { op: "diagnosis_eq", value: "x" },
      min_confidence: 0.95,
    });
  });

  it("records failed_authoring when a builtin group has no authored file", async () => {
    await write_registry([]);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: { kind: "builtin", function_name: "check_a", min_confidence: 0.9 },
        backlog_ref: null,
        new_signals_needed: [],
        classifier_spec: minimal_spec("check_a"),
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: false,
      registry_path,
      authored_files_by_group: {},
    });

    expect(result.failed_authoring).toHaveLength(1);
    expect(result.failed_authoring[0].group_id).toBe("a");
    expect(result.failed_authoring[0].reason).toMatch(/no authored classifier file/);
    expect(result.registry_upserts).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk).toEqual([]);
  });

  it("records failed_authoring when the authored file is missing on disk", async () => {
    await write_registry([]);
    const missing = path.join(authored_dir, "check_a.ts");
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: { kind: "builtin", function_name: "check_a", min_confidence: 0.9 },
        backlog_ref: null,
        new_signals_needed: [],
        classifier_spec: minimal_spec("check_a"),
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: false,
      registry_path,
      authored_files_by_group: { a: missing },
    });

    expect(result.failed_authoring).toHaveLength(1);
    expect(result.failed_authoring[0].group_id).toBe("a");
    expect(result.failed_authoring[0].reason).toMatch(/missing or unreadable/);
    expect(result.registry_upserts).toEqual([]);
  });

  it("records spec_validation_failures when positive_examples is out of range", async () => {
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_a.ts");
    await write_authored_file(authored_path);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: { kind: "builtin", function_name: "check_a", min_confidence: 0.9 },
        backlog_ref: null,
        new_signals_needed: [],
        classifier_spec: {
          ...minimal_spec("check_a"),
          positive_examples: [0, 7],
        },
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, { a: 3 }, {
      dry_run: false,
      registry_path,
      authored_files_by_group: { a: authored_path },
    });

    expect(result.spec_validation_failures).toEqual([
      {
        group_id: "a",
        reason:
          "classifier_spec.positive_examples contains index 7 but group has 3 entries",
      },
    ]);
    expect(result.registry_upserts).toEqual([]);
    expect(result.failed_authoring).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk).toEqual([]);
  });

  it("records spec_validation_failures when negative_examples is out of range", async () => {
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_a.ts");
    await write_authored_file(authored_path);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: { kind: "builtin", function_name: "check_a", min_confidence: 0.9 },
        backlog_ref: null,
        new_signals_needed: [],
        classifier_spec: {
          ...minimal_spec("check_a"),
          positive_examples: [0],
          negative_examples: [99],
        },
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, { a: 5 }, {
      dry_run: false,
      registry_path,
      authored_files_by_group: { a: authored_path },
    });

    expect(result.spec_validation_failures).toEqual([
      {
        group_id: "a",
        reason:
          "classifier_spec.negative_examples contains index 99 but group has 5 entries",
      },
    ]);
    expect(result.registry_upserts).toEqual([]);
  });

  it("upserts a builtin when the authored file exists", async () => {
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_a.ts");
    await write_authored_file(authored_path);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: { kind: "builtin", function_name: "check_a", min_confidence: 0.9 },
        backlog_ref: null,
        new_signals_needed: [],
        classifier_spec: minimal_spec("check_a"),
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: false,
      registry_path,
      authored_files_by_group: { a: authored_path },
    });

    expect(result.failed_authoring).toEqual([]);
    expect(result.authored_files).toEqual([authored_path]);
    expect(result.registry_upserts).toEqual(["a"]);
    const on_disk = await read_registry_json();
    expect(on_disk).toHaveLength(1);
    expect(on_disk[0].classifier).toEqual({
      kind: "builtin",
      function_name: "check_a",
      min_confidence: 0.9,
    });
  });

  it("does not write registry when nothing changed", async () => {
    await write_registry([known("a")]);
    const result = await apply_proposals([], [], {}, {
      dry_run: false,
      registry_path,
      authored_files_by_group: {},
    });
    expect(result.registry_upserts).toEqual([]);
    expect(result.drift_tagged_groups).toEqual([]);
    expect(result.authored_files).toEqual([]);
  });

  it("deduplicates new_signals_needed across responses", async () => {
    await write_registry([]);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: null,
        backlog_ref: null,
        new_signals_needed: ["grep_call_sites", "decorator_scan"],
        classifier_spec: null,
        reasoning: "",
      },
      {
        group_id: "b",
        proposed_classifier: null,
        backlog_ref: null,
        new_signals_needed: ["decorator_scan", "receiver_kind"],
        classifier_spec: null,
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: true,
      registry_path,
      authored_files_by_group: {},
    });
    expect(result.new_signals_needed.sort()).toEqual([
      "decorator_scan",
      "grep_call_sites",
      "receiver_kind",
    ]);
  });

  it("skips upsert when existing entry is status='permanent'", async () => {
    await write_registry([known("a", { status: "permanent" })]);
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
        classifier_spec: null,
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: false,
      registry_path,
      authored_files_by_group: {},
    });
    expect(result.skipped_permanent_upserts).toEqual(["a"]);
    expect(result.registry_upserts).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].classifier).toEqual({
      kind: "builtin",
      function_name: "a",
      min_confidence: 0.9,
    });
  });

  it("kind='none' overwrite flips status to wip and sets drift_detected", async () => {
    await write_registry([known("a", { status: "fixed" })]);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: { kind: "none" },
        backlog_ref: null,
        new_signals_needed: [],
        classifier_spec: null,
        reasoning: "",
      },
    ];
    const result = await apply_proposals([], inv, {}, {
      dry_run: false,
      registry_path,
      authored_files_by_group: {},
    });
    expect(result.registry_upserts).toEqual(["a"]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].status).toBe("wip");
    expect(on_disk[0].drift_detected).toBe(true);
    expect(on_disk[0].classifier).toEqual({ kind: "none" });
  });
});

describe("parse_investigate_response — backlog_ref gate", () => {
  it("rejects backlog_ref when new_signals_needed is empty", () => {
    const result = parse_investigate_response({
      group_id: "g",
      proposed_classifier: null,
      backlog_ref: { title: "fix", description: "d" },
      new_signals_needed: [],
      classifier_spec: null,
      reasoning: "",
    });
    expect(result).toEqual({
      error:
        "investigate response: backlog_ref only permitted when new_signals_needed is non-empty",
    });
  });

  it("accepts backlog_ref when new_signals_needed is non-empty", () => {
    const result = parse_investigate_response({
      group_id: "g",
      proposed_classifier: { kind: "none" },
      backlog_ref: { title: "needs signal", description: "d" },
      new_signals_needed: ["receiver-type-in-await"],
      classifier_spec: null,
      reasoning: "",
    });
    expect("error" in result).toBe(false);
  });
});
