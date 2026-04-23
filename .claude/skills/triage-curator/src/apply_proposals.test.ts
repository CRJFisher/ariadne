import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apply_proposals,
  derive_languages_for_upsert,
  mark_drift_in_registry,
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

function builtin_inv(
  group_id: string,
  overrides: Partial<InvestigateResponse> = {},
): InvestigateResponse {
  return {
    group_id,
    proposed_classifier: {
      kind: "builtin",
      function_name: `check_${group_id}`,
      min_confidence: 0.9,
    },
    backlog_ref: null,
    new_signals_needed: [],
    classifier_spec: minimal_spec(`check_${group_id}`),
    retargets_to: null,
    reasoning: "",
    ...overrides,
  };
}

describe("mark_drift_in_registry", () => {
  it("tags groups whose outlier rate meets threshold", () => {
    const reg: KnownIssue[] = [known("a"), known("b"), known("c")];
    const qa: QaResponse[] = [
      {
        group_id: "a",
        outliers: [
          { entry_index: 0, reason: "" },
          { entry_index: 1, reason: "" },
          { entry_index: 2, reason: "" },
        ],
        notes: "",
      },
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

  it("is pure (does not mutate input registry)", () => {
    const reg: KnownIssue[] = [known("a")];
    mark_drift_in_registry(
      reg,
      [
        {
          group_id: "a",
          outliers: [
            { entry_index: 0, reason: "" },
            { entry_index: 1, reason: "" },
            { entry_index: 2, reason: "" },
          ],
          notes: "",
        },
      ],
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
    const qa: QaResponse[] = [{ group_id: "a", outliers: [], notes: "" }];
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

  it("prefers declared language_eq values from the classifier spec", () => {
    const spec: BuiltinClassifierSpec = {
      ...minimal_spec("check_x"),
      checks: [
        { op: "language_eq", value: "python" },
        { op: "callers_count_at_most", n: 0 },
      ],
    };
    const group = group_with_extensions("g", [".ts", ".ts"]);
    expect(derive_languages_for_upsert(builtin_inv("g", { classifier_spec: spec }), group)).toEqual([
      "python",
    ]);
  });

  it("falls back to member file extensions when no language_eq in spec", () => {
    const spec: BuiltinClassifierSpec = {
      ...minimal_spec("check_x"),
      checks: [{ op: "callers_count_at_most", n: 0 }],
    };
    const group = group_with_extensions("g", [".js", ".jsx", ".mjs"]);
    expect(derive_languages_for_upsert(builtin_inv("g", { classifier_spec: spec }), group)).toEqual([
      "javascript",
    ]);
  });

  it("returns empty for kind='none' when group has no recognizable extensions", () => {
    const response: InvestigateResponse = builtin_inv("g", {
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
    });
    const group = group_with_extensions("g", [".txt", ".md"]);
    expect(derive_languages_for_upsert(response, group)).toEqual([]);
  });

  it("derives mixed languages from mixed-extension groups", () => {
    const response: InvestigateResponse = builtin_inv("g", {
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
    });
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
      {
        group_id: "a",
        outliers: [
          { entry_index: 0, reason: "" },
          { entry_index: 1, reason: "" },
          { entry_index: 2, reason: "" },
        ],
        notes: "",
      },
    ];
    const authored_path = path.join(authored_dir, "check_new-group.ts");
    await write_authored_file(authored_path);
    const result = await apply_proposals(qa, [builtin_inv("new-group")], { a: 20 }, {
      dry_run: true,
      registry_path,
      authored_files_by_group: { "new-group": authored_path },
    });

    expect(result.authored_files).toEqual([authored_path]);
    expect(result.failed_authoring).toEqual([]);
    expect(result.drift_tagged_groups).toEqual(["a"]);
    expect(result.registry_upserts).toEqual(["new-group"]);
    expect(result.backlog_tasks_to_create).toEqual([]);

    const on_disk = await read_registry_json();
    expect(on_disk).toEqual([known("a")]);
  });

  it("records failed_authoring when a builtin group has no authored file", async () => {
    await write_registry([]);
    const result = await apply_proposals([], [builtin_inv("a")], {}, {
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
    const result = await apply_proposals([], [builtin_inv("a")], {}, {
      dry_run: false,
      registry_path,
      authored_files_by_group: { a: missing },
    });

    expect(result.failed_authoring).toHaveLength(1);
    expect(result.failed_authoring[0].reason).toMatch(/missing or unreadable/);
  });

  it("upserts a builtin when the authored file exists", async () => {
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_a.ts");
    await write_authored_file(authored_path);
    const result = await apply_proposals([], [builtin_inv("a")], {}, {
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

  it("upserts against retargets_to and looks up authored file by the retarget key", async () => {
    // Existing registry entry that the investigator wants to extend.
    await write_registry([
      known("existing-entry", {
        languages: ["python"],
        classifier: { kind: "none" },
      }),
    ]);
    const authored_path = path.join(authored_dir, "check_existing-entry.ts");
    await write_authored_file(authored_path);
    const inv = builtin_inv("dispatch-group", {
      proposed_classifier: {
        kind: "builtin",
        function_name: "check_dispatch_group",
        min_confidence: 0.9,
      },
      classifier_spec: minimal_spec("check_dispatch_group"),
      retargets_to: "existing-entry",
    });
    const result = await apply_proposals([], [inv], { "dispatch-group": 2 }, {
      dry_run: false,
      registry_path,
      authored_files_by_group: { "existing-entry": authored_path },
    });

    expect(result.failed_authoring).toEqual([]);
    expect(result.authored_files).toEqual([authored_path]);
    expect(result.registry_upserts).toEqual(["existing-entry"]);

    const on_disk = await read_registry_json();
    expect(on_disk).toHaveLength(1);
    expect(on_disk[0].group_id).toBe("existing-entry");
    // Languages preserved from the existing entry, not touched by the upsert.
    expect(on_disk[0].languages).toEqual(["python"]);
    expect(on_disk[0].classifier).toEqual({
      kind: "builtin",
      function_name: "check_dispatch_group",
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
        retargets_to: null,
        reasoning: "",
      },
      {
        group_id: "b",
        proposed_classifier: null,
        backlog_ref: null,
        new_signals_needed: ["decorator_scan", "receiver_kind"],
        classifier_spec: null,
        retargets_to: null,
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
    const inv: InvestigateResponse = {
      group_id: "a",
      proposed_classifier: { kind: "none" },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: null,
      retargets_to: null,
      reasoning: "",
    };
    const result = await apply_proposals([], [inv], {}, {
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
    const inv: InvestigateResponse = {
      group_id: "a",
      proposed_classifier: { kind: "none" },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: null,
      retargets_to: null,
      reasoning: "",
    };
    const result = await apply_proposals([], [inv], {}, {
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
