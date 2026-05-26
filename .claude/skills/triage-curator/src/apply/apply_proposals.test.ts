import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apply_proposals,
  bump_observed_stats,
  derive_languages_for_upsert,
  link_ariadne_bug_tasks,
} from "./apply_proposals.js";
import type {
  BuiltinClassifierSpec,
  InvestigateResponse,
  KnownIssue,
} from "../types.js";

let tmp_dir: string;
let authored_dir: string;
let registry_path: string;

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "curator-apply-"));
  authored_dir = path.join(tmp_dir, "authored");
  await fs.mkdir(authored_dir, { recursive: true });
  registry_path = path.join(tmp_dir, "registry.json");
  await fs.writeFile(registry_path, "{\"schema_version\":1,\"rules\":[]}\n", "utf8");
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
  const file = { schema_version: 1, rules: entries };
  await fs.writeFile(registry_path, JSON.stringify(file, null, 2) + "\n", "utf8");
}

async function read_registry_json(): Promise<KnownIssue[]> {
  const raw = await fs.readFile(registry_path, "utf8");
  const parsed = JSON.parse(raw) as { schema_version: number; rules: KnownIssue[] };
  return parsed.rules;
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
    classifier_spec: minimal_spec(`check_${group_id}`),
    retargets_to: null,
    signal_library_gap: null,
    ariadne_bug: null,
    rejected_members: [],
    reasoning: "",
    ...overrides,
  };
}

describe("bump_observed_stats", () => {
  it("increments observed_count, merges observed_projects, sets last_seen_run", () => {
    const reg: KnownIssue[] = [
      known("a", { observed_count: 3, observed_projects: ["old-proj"] }),
      known("b"),
    ];
    const { updated, bumped_groups } = bump_observed_stats(
      reg,
      { a: 5, b: 2 },
      "new-proj",
      "run-2026-04-24",
    );
    expect(bumped_groups).toEqual(["a", "b"]);
    expect(updated[0].observed_count).toBe(8);
    expect(updated[0].observed_projects).toEqual(["old-proj", "new-proj"]);
    expect(updated[0].last_seen_run).toBe("run-2026-04-24");
    expect(updated[1].observed_count).toBe(2);
    expect(updated[1].observed_projects).toEqual(["new-proj"]);
    expect(updated[1].last_seen_run).toBe("run-2026-04-24");
  });

  it("does not duplicate a project already in observed_projects", () => {
    const reg: KnownIssue[] = [known("a", { observed_projects: ["p"] })];
    const { updated } = bump_observed_stats(reg, { a: 1 }, "p", "run-id");
    expect(updated[0].observed_projects).toEqual(["p"]);
  });

  it("skips registry entries not observed in this run", () => {
    const reg: KnownIssue[] = [known("a"), known("b")];
    const { updated, bumped_groups } = bump_observed_stats(
      reg,
      { a: 1 },
      "p",
      "r",
    );
    expect(bumped_groups).toEqual(["a"]);
    expect(updated[1]).toEqual(known("b"));
  });

  it("skips status='fixed' rows even when observed in this run (reconciler owns the row)", () => {
    const reg: KnownIssue[] = [
      known("a", { status: "fixed", observed_count: 99, observed_projects: ["old"] }),
      known("b"),
    ];
    const { updated, bumped_groups } = bump_observed_stats(
      reg,
      { a: 7, b: 3 },
      "new-proj",
      "run-id",
    );
    expect(bumped_groups).toEqual(["b"]);
    // The fixed row is returned unchanged — no observed_count bump, no
    // observed_projects merge, no last_seen_run set.
    expect(updated[0]).toEqual(
      known("a", { status: "fixed", observed_count: 99, observed_projects: ["old"] }),
    );
    expect(updated[1].observed_count).toBe(3);
  });
});

describe("derive_languages_for_upsert", () => {
  it("returns declared language_eq values from the classifier spec", () => {
    const spec: BuiltinClassifierSpec = {
      ...minimal_spec("check_x"),
      checks: [
        { op: "language_eq", value: "python" },
        { op: "callers_count_at_most", n: 0 },
      ],
    };
    expect(derive_languages_for_upsert(builtin_inv("g", { classifier_spec: spec }))).toEqual([
      "python",
    ]);
  });

  it("returns empty when the spec has no language_eq check", () => {
    const spec: BuiltinClassifierSpec = {
      ...minimal_spec("check_x"),
      checks: [{ op: "callers_count_at_most", n: 0 }],
    };
    expect(derive_languages_for_upsert(builtin_inv("g", { classifier_spec: spec }))).toEqual([]);
  });

  it("returns empty for kind='none' (no spec to scan)", () => {
    const response: InvestigateResponse = builtin_inv("g", {
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
    });
    expect(derive_languages_for_upsert(response)).toEqual([]);
  });

  it("returns languages in deterministic sorted order across multiple language_eq checks", () => {
    const spec: BuiltinClassifierSpec = {
      ...minimal_spec("check_x"),
      checks: [
        { op: "language_eq", value: "rust" },
        { op: "language_eq", value: "python" },
        { op: "language_eq", value: "typescript" },
        { op: "language_eq", value: "javascript" },
      ],
    };
    expect(derive_languages_for_upsert(builtin_inv("g", { classifier_spec: spec }))).toEqual([
      "javascript",
      "python",
      "rust",
      "typescript",
    ]);
  });
});

describe("apply_proposals", () => {
  it("dry_run does not mutate the registry", async () => {
    await write_registry([known("a")]);
    const authored_path = path.join(authored_dir, "check_new-group.ts");
    await write_authored_file(authored_path);
    const result = await apply_proposals([builtin_inv("new-group")], { a: 20 }, {
      dry_run: true,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [
        {
          rule_id: "a",
          flagged_entries: [
            { entry_index: 0, evidence_excerpt: "" },
            { entry_index: 1, evidence_excerpt: "" },
            { entry_index: 2, evidence_excerpt: "" },
          ],
        },
      ],
      authored_files_by_group: { "new-group": authored_path },
    });

    expect(result.authored_files).toEqual([authored_path]);
    expect(result.failed_authoring).toEqual([]);
    expect(result.drift_tagged_groups).toEqual(["a"]);
    expect(result.registry_upserts).toEqual(["new-group"]);
    expect(result.signal_library_gap_tasks).toEqual([]);
    expect(result.ariadne_bug_tasks).toEqual([]);

    const on_disk = await read_registry_json();
    expect(on_disk).toEqual([known("a")]);
  });

  it("records failed_authoring when a builtin group has no authored file", async () => {
    await write_registry([]);
    const result = await apply_proposals([builtin_inv("a")], {}, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
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
    const result = await apply_proposals([builtin_inv("a")], {}, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
      authored_files_by_group: { a: missing },
    });

    expect(result.failed_authoring).toHaveLength(1);
    expect(result.failed_authoring[0].reason).toMatch(/missing or unreadable/);
  });

  it("upserts a builtin when the authored file exists", async () => {
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_a.ts");
    await write_authored_file(authored_path);
    const result = await apply_proposals([builtin_inv("a")], {}, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
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

  it("preserves schema_version: 1 on the registry envelope after a mutation", async () => {
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_a.ts");
    await write_authored_file(authored_path);
    await apply_proposals([builtin_inv("a")], {}, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
      authored_files_by_group: { a: authored_path },
    });

    const raw = await fs.readFile(registry_path, "utf8");
    const parsed = JSON.parse(raw) as { schema_version: number; rules: KnownIssue[] };
    expect(parsed.schema_version).toEqual(1);
    expect(parsed.rules).toHaveLength(1);
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
    const result = await apply_proposals([inv], { "dispatch-group": 2 }, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
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
    const result = await apply_proposals([], {}, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
      authored_files_by_group: {},
    });
    expect(result.registry_upserts).toEqual([]);
    expect(result.drift_tagged_groups).toEqual([]);
    expect(result.authored_files).toEqual([]);
  });

  it("collects signal_library_gap entries as separate tasks (one per response)", async () => {
    await write_registry([]);
    const inv: InvestigateResponse[] = [
      {
        group_id: "a",
        proposed_classifier: null,
        classifier_spec: null,
        retargets_to: null,
        signal_library_gap: {
          signals_needed: ["grep_call_sites", "decorator_scan"],
          title: "a-gap",
          description: "",
        },
        ariadne_bug: null,
        rejected_members: [],
        reasoning: "",
      },
      {
        group_id: "b",
        proposed_classifier: null,
        classifier_spec: null,
        retargets_to: null,
        signal_library_gap: {
          signals_needed: ["decorator_scan", "receiver_kind"],
          title: "b-gap",
          description: "",
        },
        ariadne_bug: null,
        rejected_members: [],
        reasoning: "",
      },
    ];
    const result = await apply_proposals(inv, {}, {
      dry_run: true,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
      authored_files_by_group: {},
    });
    expect(result.signal_library_gap_tasks).toEqual([
      {
        group_id: "a",
        title: "a-gap",
        description: "",
        signals_needed: ["grep_call_sites", "decorator_scan"],
      },
      {
        group_id: "b",
        title: "b-gap",
        description: "",
        signals_needed: ["decorator_scan", "receiver_kind"],
      },
    ]);
    expect(result.ariadne_bug_tasks).toEqual([]);
  });

  it("collects ariadne_bug proposals with retargets_to folded into target_registry_group_id", async () => {
    await write_registry([known("existing-entry")]);
    const inv: InvestigateResponse = builtin_inv("dispatch-group", {
      retargets_to: "existing-entry",
      ariadne_bug: {
        root_cause_category: "receiver_resolution",
        title: "Resolver loses field type",
        description: "details",
        existing_task_id: null,
      },
    });
    // Need an authored file to keep upsert flow happy.
    const authored_path = path.join(authored_dir, "check_existing-entry.ts");
    await write_authored_file(authored_path);

    const result = await apply_proposals([inv], { "dispatch-group": 2 }, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
      authored_files_by_group: { "existing-entry": authored_path },
    });

    expect(result.ariadne_bug_tasks.length).toBe(1);
    const task = result.ariadne_bug_tasks[0];
    expect(task.group_id).toBe("dispatch-group");
    expect(task.target_registry_group_id).toBe("existing-entry");
    expect(task.root_cause_category).toBe("receiver_resolution");
    expect(task.title).toBe("Resolver loses field type");
    expect(task.existing_task_id).toBeNull();
    // description is now the rendered Ariadne-bug body — spot-check the
    // sections that distinguish it from the raw investigator narrative.
    expect(task.description).toContain("**Root cause category:** `receiver_resolution`");
    expect(task.description).toContain("**Target registry entry:** `existing-entry`");
    expect(task.description).toContain("details");
    expect(task.description).toContain("## Observations");
    expect(task.description).toContain("## Proposed classifier (workaround)");
    expect(task.description).toContain("## Acceptance criteria");
  });

  it("skips upsert when existing entry is status='permanent'", async () => {
    await write_registry([known("a", { status: "permanent" })]);
    const inv: InvestigateResponse = builtin_inv("a", {
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
    });
    const result = await apply_proposals([inv], {}, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
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

  it("populates languages on a new builtin upsert using classifier_spec language_eq", async () => {
    // New entry → no existing registry row. The classifier_spec declares
    // language_eq='python'; upsert must land languages=['python']. Under v4
    // language_eq is the sole source of language derivation for new entries.
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_py-only.ts");
    await write_authored_file(authored_path);
    const inv: InvestigateResponse = builtin_inv("py-only", {
      classifier_spec: {
        ...minimal_spec("check_py-only"),
        checks: [
          { op: "language_eq", value: "python" },
          { op: "callers_count_at_most", n: 0 },
        ],
      },
    });
    const result = await apply_proposals([inv], { "py-only": 1 }, {
      dry_run: false,
      registry_path,
      project: "p",
      run_id: "r",
      classifier_regressions: [],
      authored_files_by_group: { "py-only": authored_path },
    });
    expect(result.registry_upserts).toEqual(["py-only"]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].languages).toEqual(["python"]);
  });

  it("fails authoring for a new kind='none' upsert with no language gate", async () => {
    // Under v4 the published artifact carries no FP entry file paths to
    // infer from — language_eq in the spec is the only source for new
    // entries. A kind='none' proposal with no spec must surface as failed
    // authoring rather than landing an entry with an empty languages list.
    await write_registry([]);
    const inv: InvestigateResponse = builtin_inv("member-path-only", {
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
    });
    const result = await apply_proposals([inv], { "member-path-only": 2 }, {
      dry_run: false,
      registry_path,
      project: "p",
      run_id: "r",
      classifier_regressions: [],
      authored_files_by_group: {},
    });
    expect(result.registry_upserts).toEqual([]);
    expect(result.failed_authoring).toHaveLength(1);
    expect(result.failed_authoring[0].group_id).toBe("member-path-only");
    expect(result.failed_authoring[0].reason).toMatch(/cannot derive languages/);
  });

  it("does not downgrade languages when upserting onto an existing entry", async () => {
    // Existing entry has languages=['python','rust']; the classifier_spec only
    // declares language_eq='python'. The upsert must preserve both.
    await write_registry([
      known("x", { languages: ["python", "rust"], classifier: { kind: "none" } }),
    ]);
    const authored_path = path.join(authored_dir, "check_x.ts");
    await write_authored_file(authored_path);
    const inv: InvestigateResponse = builtin_inv("x", {
      classifier_spec: {
        ...minimal_spec("check_x"),
        checks: [{ op: "language_eq", value: "python" }],
      },
    });
    const result = await apply_proposals([inv], { x: 1 }, {
      dry_run: false,
      registry_path,
      project: "p",
      run_id: "r",
      classifier_regressions: [],
      authored_files_by_group: { x: authored_path },
    });
    expect(result.registry_upserts).toEqual(["x"]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].languages).toEqual(["python", "rust"]);
  });

  it("records failed_authoring when languages cannot be derived for a new entry", async () => {
    // No language_eq in spec, no triage_groups provided → empty languages → fail.
    await write_registry([]);
    const authored_path = path.join(authored_dir, "check_no-lang.ts");
    await write_authored_file(authored_path);
    const inv: InvestigateResponse = builtin_inv("no-lang", {
      classifier_spec: {
        ...minimal_spec("check_no-lang"),
        checks: [{ op: "callers_count_at_most", n: 0 }],
      },
    });
    const result = await apply_proposals([inv], { "no-lang": 1 }, {
      dry_run: false,
      registry_path,
      project: "p",
      run_id: "r",
      classifier_regressions: [],
      authored_files_by_group: { "no-lang": authored_path },
    });
    expect(result.failed_authoring).toHaveLength(1);
    expect(result.failed_authoring[0].group_id).toBe("no-lang");
    expect(result.failed_authoring[0].reason).toMatch(/cannot derive languages/);
    expect(result.registry_upserts).toEqual([]);
  });

  it("kind='none' overwrite flips status to wip and sets drift_detected", async () => {
    await write_registry([known("a", { status: "fixed" })]);
    const inv: InvestigateResponse = builtin_inv("a", {
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
    });
    const result = await apply_proposals([inv], {}, {
      dry_run: false,
      registry_path,
      project: "test-project",
      run_id: "test-run",
      classifier_regressions: [],
      authored_files_by_group: {},
    });
    expect(result.registry_upserts).toEqual(["a"]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].status).toBe("wip");
    expect(on_disk[0].drift_detected).toBe(true);
    expect(on_disk[0].classifier).toEqual({ kind: "none" });
  });
});

describe("apply_proposals — classifier_regressions integration", () => {
  it("tags drift_detected + writes in-flight drift_evidence end-to-end", async () => {
    await write_registry([known("decorator-route")]);
    const result = await apply_proposals(
      [],
      {},
      {
        dry_run: false,
        registry_path,
        project: "test-project",
        run_id: "test-run",
        classifier_regressions: [
          {
            rule_id: "decorator-route",
            flagged_entries: [
              { entry_index: 3, evidence_excerpt: "@route('/x')" },
              { entry_index: 7, evidence_excerpt: "@route('/y')" },
            ],
          },
        ],
        authored_files_by_group: {},
      },
    );
    expect(result.drift_tagged_groups).toEqual(["decorator-route"]);
    expect(result.skipped_permanent_upserts).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].drift_detected).toBe(true);
    expect(on_disk[0].drift_evidence).toEqual([
      { entry_index: 3, evidence_excerpt: "@route('/x')" },
      { entry_index: 7, evidence_excerpt: "@route('/y')" },
    ]);
  });

  it("merges in-flight regressions against permanent rules into skipped_permanent_upserts", async () => {
    await write_registry([known("perm-rule", { status: "permanent" })]);
    const result = await apply_proposals(
      [],
      {},
      {
        dry_run: false,
        registry_path,
        project: "test-project",
        run_id: "test-run",
        classifier_regressions: [
          {
            rule_id: "perm-rule",
            flagged_entries: [{ entry_index: 1, evidence_excerpt: "x" }],
          },
        ],
        authored_files_by_group: {},
      },
    );
    expect(result.skipped_permanent_upserts).toEqual(["perm-rule"]);
    expect(result.skipped_fixed_upserts).toEqual([]);
    expect(result.drift_tagged_groups).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].drift_detected).toBeUndefined();
    expect(on_disk[0].drift_evidence).toBeUndefined();
  });

  it("routes in-flight regressions against fixed rules into skipped_fixed_upserts (reconciler owns mutations)", async () => {
    await write_registry([known("fixed-rule", { status: "fixed" })]);
    const result = await apply_proposals(
      [],
      {},
      {
        dry_run: false,
        registry_path,
        project: "test-project",
        run_id: "test-run",
        classifier_regressions: [
          {
            rule_id: "fixed-rule",
            flagged_entries: [{ entry_index: 1, evidence_excerpt: "resurfaced" }],
          },
        ],
        authored_files_by_group: {},
      },
    );
    expect(result.skipped_fixed_upserts).toEqual(["fixed-rule"]);
    expect(result.skipped_permanent_upserts).toEqual([]);
    expect(result.drift_tagged_groups).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].status).toEqual("fixed");
    expect(on_disk[0].drift_detected).toBeUndefined();
    expect(on_disk[0].drift_evidence).toBeUndefined();
  });

  it("is a no-op when classifier_regressions is empty (no spurious registry write)", async () => {
    await write_registry([known("a")]);
    const result = await apply_proposals(
      [],
      {},
      {
        dry_run: false,
        registry_path,
        project: "test-project",
        run_id: "test-run",
        classifier_regressions: [],
        authored_files_by_group: {},
      },
    );
    expect(result.drift_tagged_groups).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk).toEqual([known("a")]);
  });
});

describe("link_ariadne_bug_tasks", () => {
  it("writes backlog_task onto matching registry entries", async () => {
    await write_registry([known("a"), known("b"), known("c")]);
    const result = await link_ariadne_bug_tasks(registry_path, {
      a: "TASK-300",
      c: "TASK-301",
    });
    expect(result.updated_groups.sort()).toEqual(["a", "c"]);
    const on_disk = await read_registry_json();
    expect(on_disk.find((e) => e.group_id === "a")?.backlog_task).toBe("TASK-300");
    expect(on_disk.find((e) => e.group_id === "b")?.backlog_task).toBeUndefined();
    expect(on_disk.find((e) => e.group_id === "c")?.backlog_task).toBe("TASK-301");
  });

  it("no-ops when the task id already matches", async () => {
    await write_registry([known("a", { backlog_task: "TASK-300" })]);
    const result = await link_ariadne_bug_tasks(registry_path, { a: "TASK-300" });
    expect(result.updated_groups).toEqual([]);
  });

  it("silently skips ids that don't match any registry entry", async () => {
    await write_registry([known("a")]);
    const result = await link_ariadne_bug_tasks(registry_path, {
      a: "TASK-300",
      "no-such-entry": "TASK-999",
    });
    expect(result.updated_groups).toEqual(["a"]);
  });

  it("short-circuits on an empty mapping", async () => {
    await write_registry([known("a")]);
    const result = await link_ariadne_bug_tasks(registry_path, {});
    expect(result.updated_groups).toEqual([]);
    const on_disk = await read_registry_json();
    expect(on_disk[0].backlog_task).toBeUndefined();
  });
});
