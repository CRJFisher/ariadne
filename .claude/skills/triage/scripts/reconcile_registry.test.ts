/**
 * Tests for `reconcile_registry`: the pure helpers and detectors with typed
 * literal expectations, the pure fold, and the apply path against a temp
 * registry file (real `atomic_update_registry`, real bytes, idempotent
 * re-run).
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { known_issues_registry_path } from "@ariadnejs/skill-protocol";
import type { KnownIssue } from "@ariadnejs/types";
import {
  parse_known_issues_registry_json,
  serialize_known_issues_registry_json,
} from "@ariadnejs/types";

import {
  bare_task_scope,
  detect_drift_proposals,
  detect_fixed_proposals,
  fold_proposals,
  parse_argv,
  parse_commit_subject,
  pick_latest_run_id,
  run,
  run_or_stage,
  type DriftSource,
  type ReconcileDeps,
} from "./reconcile_registry.js";

function make_wip_rule(over: Partial<KnownIssue> & { group_id: string }): KnownIssue {
  return {
    title: "Rule",
    description: "A test rule.",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "none" },
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("bare_task_scope", () => {
  it("strips the TASK- prefix from a single id", () => {
    expect(bare_task_scope("TASK-198")).toEqual("198");
  });

  it("strips the prefix from a hierarchical id", () => {
    expect(bare_task_scope("TASK-190.17.13")).toEqual("190.17.13");
  });

  it("returns null for a non-TASK-shaped value", () => {
    expect(bare_task_scope("not-a-task")).toEqual(null);
  });
});

describe("parse_commit_subject", () => {
  it("parses a fix commit with a single task scope", () => {
    expect(parse_commit_subject("fix(198): handle null receiver")).toEqual({
      type: "fix",
      task_ids: ["198"],
    });
  });

  it("expands a range scope into exact ids", () => {
    expect(parse_commit_subject("feat(190.17.12-14): batched retarget")).toEqual({
      type: "feat",
      task_ids: ["190.17.12", "190.17.13", "190.17.14"],
    });
  });

  it("returns null for a named (non-task) scope", () => {
    expect(parse_commit_subject("refactor(core): split module")).toEqual(null);
  });

  it("returns null when there is no scope", () => {
    expect(parse_commit_subject("chore: tidy gitignore")).toEqual(null);
  });

  it("returns null for a non-Conventional-Commits subject", () => {
    expect(parse_commit_subject("Merge branch feat/x into main")).toEqual(null);
  });
});

describe("pick_latest_run_id", () => {
  it("orders by the timestamp tail, not the commit-hash prefix", () => {
    // Lexicographically `0011aaa-…` < `deadbee-…`, but deadbee's run is older.
    expect(
      pick_latest_run_id([
        "deadbee-2026-06-01T10-00-00.000Z.json",
        "0011aaa-2026-06-11T10-00-00.000Z.json",
      ]),
    ).toEqual("0011aaa-2026-06-11T10-00-00.000Z");
  });

  it("picks the newer timestamp within one commit", () => {
    expect(
      pick_latest_run_id([
        "deadbee-2026-06-01T10-00-00.000Z.json",
        "deadbee-2026-06-02T09-00-00.000Z.json",
      ]),
    ).toEqual("deadbee-2026-06-02T09-00-00.000Z");
  });

  it("ignores non-run-id filenames", () => {
    expect(pick_latest_run_id([".DS_Store", "notes.txt"])).toEqual(null);
  });

  it("returns null for an empty directory", () => {
    expect(pick_latest_run_id([])).toEqual(null);
  });
});

// ---------------------------------------------------------------------------
// detect_fixed_proposals
// ---------------------------------------------------------------------------

describe("detect_fixed_proposals", () => {
  const rule_198 = make_wip_rule({ group_id: "rule-198", backlog_task: "TASK-198" });

  it("proposes a flip when a fix commit's scope matches the backlog_task", () => {
    expect(
      detect_fixed_proposals([rule_198], ["fix(198): handle null receiver"]),
    ).toEqual([
      {
        kind: "wip_to_fixed",
        group_id: "rule-198",
        backlog_task: "TASK-198",
        matched_scope: "198",
        matched_subject: "fix(198): handle null receiver",
      },
    ]);
  });

  it("matches a rule id inside a range scope", () => {
    const rule = make_wip_rule({
      group_id: "rule-range",
      backlog_task: "TASK-190.17.13",
    });
    expect(
      detect_fixed_proposals([rule], ["feat(190.17.12-14): batched retarget"]),
    ).toEqual([
      {
        kind: "wip_to_fixed",
        group_id: "rule-range",
        backlog_task: "TASK-190.17.13",
        matched_scope: "190.17.13",
        matched_subject: "feat(190.17.12-14): batched retarget",
      },
    ]);
  });

  it("does not prefix-match: a parent-task commit never flips a child rule", () => {
    const child_rule = make_wip_rule({
      group_id: "rule-child",
      backlog_task: "TASK-190.22.21",
    });
    expect(detect_fixed_proposals([child_rule], ["fix(190.22): parent work"])).toEqual([]);
  });

  it("does not prefix-match: a child-task commit never flips a parent rule", () => {
    const parent_rule = make_wip_rule({
      group_id: "rule-parent",
      backlog_task: "TASK-190.22",
    });
    expect(
      detect_fixed_proposals([parent_rule], ["fix(190.22.21): child work"]),
    ).toEqual([]);
  });

  it("ignores non-fix-bearing commit types referencing the task", () => {
    expect(
      detect_fixed_proposals(
        [rule_198],
        ["docs(198): document it", "review(198): apply findings", "backlog(198): file it"],
      ),
    ).toEqual([]);
  });

  it("skips rules without a backlog_task", () => {
    const rule = make_wip_rule({ group_id: "rule-untasked" });
    expect(detect_fixed_proposals([rule], ["fix(198): anything"])).toEqual([]);
  });

  it("skips non-wip rules", () => {
    const fixed_rule = make_wip_rule({
      group_id: "rule-done",
      backlog_task: "TASK-198",
      status: "fixed",
    });
    expect(detect_fixed_proposals([fixed_rule], ["fix(198): again"])).toEqual([]);
  });

  it("proposes nothing when no subject matches", () => {
    expect(detect_fixed_proposals([rule_198], ["fix(199): other task"])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detect_drift_proposals
// ---------------------------------------------------------------------------

describe("detect_drift_proposals", () => {
  const source = (
    over: Partial<DriftSource>,
  ): DriftSource => ({
    project: "webpack",
    run_id: "deadbee-2026-06-01T10-00-00.000Z",
    classifier_regressions: [],
    ...over,
  });

  it("proposes the flag plus evidence for an unflagged rule", () => {
    const rule = make_wip_rule({ group_id: "rule-a" });
    expect(
      detect_drift_proposals(
        [rule],
        [
          source({
            classifier_regressions: [
              {
                rule_id: "rule-a",
                flagged_entries: [{ entry_index: 4, evidence_excerpt: "@app.route" }],
              },
            ],
          }),
        ],
      ),
    ).toEqual({
      proposals: [
        {
          kind: "drift_detected",
          group_id: "rule-a",
          set_drift_flag: true,
          new_evidence: [{ entry_index: 4, evidence_excerpt: "@app.route" }],
          flagged_by: [{ project: "webpack", run_id: "deadbee-2026-06-01T10-00-00.000Z" }],
        },
      ],
      unknown_rule_ids: [],
    });
  });

  it("dedupes evidence already on the rule and keeps the flag unset", () => {
    const rule = make_wip_rule({
      group_id: "rule-a",
      drift_detected: true,
      drift_evidence: [{ entry_index: 4, evidence_excerpt: "@app.route" }],
    });
    expect(
      detect_drift_proposals(
        [rule],
        [
          source({
            classifier_regressions: [
              {
                rule_id: "rule-a",
                flagged_entries: [
                  { entry_index: 4, evidence_excerpt: "@app.route" },
                  { entry_index: 7, evidence_excerpt: "handlers[key]()" },
                ],
              },
            ],
          }),
        ],
      ),
    ).toEqual({
      proposals: [
        {
          kind: "drift_detected",
          group_id: "rule-a",
          set_drift_flag: false,
          new_evidence: [{ entry_index: 7, evidence_excerpt: "handlers[key]()" }],
          flagged_by: [{ project: "webpack", run_id: "deadbee-2026-06-01T10-00-00.000Z" }],
        },
      ],
      unknown_rule_ids: [],
    });
  });

  it("proposes nothing for a fully covered rule (idempotent re-run)", () => {
    const rule = make_wip_rule({
      group_id: "rule-a",
      drift_detected: true,
      drift_evidence: [{ entry_index: 4, evidence_excerpt: "@app.route" }],
    });
    expect(
      detect_drift_proposals(
        [rule],
        [
          source({
            classifier_regressions: [
              {
                rule_id: "rule-a",
                flagged_entries: [{ entry_index: 4, evidence_excerpt: "@app.route" }],
              },
            ],
          }),
        ],
      ),
    ).toEqual({ proposals: [], unknown_rule_ids: [] });
  });

  it("merges disjoint evidence from two projects, deduped by entry_index", () => {
    const rule = make_wip_rule({ group_id: "rule-a" });
    const detection = detect_drift_proposals(
      [rule],
      [
        source({
          project: "webpack",
          classifier_regressions: [
            {
              rule_id: "rule-a",
              flagged_entries: [{ entry_index: 4, evidence_excerpt: "@app.route" }],
            },
          ],
        }),
        source({
          project: "flask",
          run_id: "0011aaa-2026-06-11T10-00-00.000Z",
          classifier_regressions: [
            {
              rule_id: "rule-a",
              flagged_entries: [
                { entry_index: 4, evidence_excerpt: "@app.route" },
                { entry_index: 9, evidence_excerpt: "cli.command()" },
              ],
            },
          ],
        }),
      ],
    );
    expect(detection).toEqual({
      proposals: [
        {
          kind: "drift_detected",
          group_id: "rule-a",
          set_drift_flag: true,
          new_evidence: [
            { entry_index: 4, evidence_excerpt: "@app.route" },
            { entry_index: 9, evidence_excerpt: "cli.command()" },
          ],
          flagged_by: [
            { project: "webpack", run_id: "deadbee-2026-06-01T10-00-00.000Z" },
            { project: "flask", run_id: "0011aaa-2026-06-11T10-00-00.000Z" },
          ],
        },
      ],
      unknown_rule_ids: [],
    });
  });

  it("reports unknown rule_ids instead of proposing writes", () => {
    expect(
      detect_drift_proposals(
        [make_wip_rule({ group_id: "rule-a" })],
        [
          source({
            classifier_regressions: [
              {
                rule_id: "rule-ghost",
                flagged_entries: [{ entry_index: 1, evidence_excerpt: "x" }],
              },
            ],
          }),
        ],
      ),
    ).toEqual({ proposals: [], unknown_rule_ids: ["rule-ghost"] });
  });
});

// ---------------------------------------------------------------------------
// fold_proposals
// ---------------------------------------------------------------------------

describe("fold_proposals", () => {
  it("flips a wip rule to fixed and leaves others untouched", () => {
    const target = make_wip_rule({ group_id: "rule-a", backlog_task: "TASK-198" });
    const bystander = make_wip_rule({ group_id: "rule-b" });
    expect(
      fold_proposals(
        [target, bystander],
        [
          {
            kind: "wip_to_fixed",
            group_id: "rule-a",
            backlog_task: "TASK-198",
            matched_scope: "198",
            matched_subject: "fix(198): done",
          },
        ],
      ),
    ).toEqual([{ ...target, status: "fixed" }, bystander]);
  });

  it("appends drift evidence and sets the flag", () => {
    const rule = make_wip_rule({
      group_id: "rule-a",
      drift_evidence: [{ entry_index: 1, evidence_excerpt: "old" }],
    });
    expect(
      fold_proposals(
        [rule],
        [
          {
            kind: "drift_detected",
            group_id: "rule-a",
            set_drift_flag: true,
            new_evidence: [{ entry_index: 2, evidence_excerpt: "new" }],
            flagged_by: [{ project: "webpack", run_id: "deadbee-2026-06-01T10-00-00.000Z" }],
          },
        ],
      ),
    ).toEqual([
      {
        ...rule,
        drift_detected: true,
        drift_evidence: [
          { entry_index: 1, evidence_excerpt: "old" },
          { entry_index: 2, evidence_excerpt: "new" },
        ],
      },
    ]);
  });

  it("re-dedupes against current state so a stale proposal degrades to a no-op", () => {
    const rule = make_wip_rule({
      group_id: "rule-a",
      drift_detected: true,
      drift_evidence: [{ entry_index: 2, evidence_excerpt: "already-landed" }],
    });
    expect(
      fold_proposals(
        [rule],
        [
          {
            kind: "drift_detected",
            group_id: "rule-a",
            set_drift_flag: false,
            new_evidence: [{ entry_index: 2, evidence_excerpt: "already-landed" }],
            flagged_by: [{ project: "webpack", run_id: "deadbee-2026-06-01T10-00-00.000Z" }],
          },
        ],
      ),
    ).toEqual([rule]);
  });

  it("promotes a classified wip rule to permanent", () => {
    const rule = make_wip_rule({
      group_id: "rule-a",
      classifier: {
        kind: "builtin",
        function_name: "check_rule_a",
        min_confidence: 1,
      },
    });
    expect(
      fold_proposals([rule], [{ kind: "promote_to_permanent", group_id: "rule-a" }]),
    ).toEqual([{ ...rule, status: "permanent" }]);
  });

  it("throws when promoting a rule without a real classifier", () => {
    const rule = make_wip_rule({ group_id: "rule-a" });
    expect(() =>
      fold_proposals([rule], [{ kind: "promote_to_permanent", group_id: "rule-a" }]),
    ).toThrowError(/classifier\.kind is "none"/);
  });

  it("throws on a proposal naming an absent rule", () => {
    expect(() =>
      fold_proposals(
        [],
        [
          {
            kind: "wip_to_fixed",
            group_id: "rule-ghost",
            backlog_task: "TASK-1",
            matched_scope: "1",
            matched_subject: "fix(1): x",
          },
        ],
      ),
    ).toThrowError(/unknown rule "rule-ghost"/);
  });

  it("returns the rules unchanged for an empty proposal list", () => {
    const rules = [make_wip_rule({ group_id: "rule-a" })];
    expect(fold_proposals(rules, [])).toEqual(rules);
  });

  it("retires a builtin classifier: flips wip→fixed and rewrites it to retired", () => {
    const rule = make_wip_rule({
      group_id: "rule-a",
      classifier: { kind: "builtin", function_name: "check_rule_a", min_confidence: 1 },
    });
    expect(
      fold_proposals(
        [rule],
        [{ kind: "wip_to_fixed_by_name", group_id: "rule-a", reason: "subsumed by TASK-348" }],
      ),
    ).toEqual([
      {
        ...rule,
        status: "fixed",
        classifier: {
          kind: "retired",
          from: { kind: "builtin", function_name: "check_rule_a", min_confidence: 1 },
          reason: "subsumed by TASK-348",
        },
      },
    ]);
  });

  it("flips a wip+none rule to fixed and leaves the classifier none", () => {
    const rule = make_wip_rule({ group_id: "rule-a" });
    expect(
      fold_proposals(
        [rule],
        [{ kind: "wip_to_fixed_by_name", group_id: "rule-a", reason: "no classifier to retire" }],
      ),
    ).toEqual([{ ...rule, status: "fixed" }]);
  });

  it("is a no-op for a non-wip named rule", () => {
    const rule = make_wip_rule({
      group_id: "rule-a",
      status: "fixed",
      classifier: { kind: "none" },
    });
    expect(
      fold_proposals(
        [rule],
        [{ kind: "wip_to_fixed_by_name", group_id: "rule-a", reason: "already retired" }],
      ),
    ).toEqual([rule]);
  });

  it("re-running the name-mode retirement is idempotent", () => {
    const retired = make_wip_rule({
      group_id: "rule-a",
      status: "fixed",
      classifier: {
        kind: "retired",
        from: { kind: "builtin", function_name: "check_rule_a", min_confidence: 1 },
        reason: "subsumed by TASK-348",
      },
    });
    expect(
      fold_proposals(
        [retired],
        [{ kind: "wip_to_fixed_by_name", group_id: "rule-a", reason: "subsumed by TASK-348" }],
      ),
    ).toEqual([retired]);
  });
});

// ---------------------------------------------------------------------------
// parse_argv
// ---------------------------------------------------------------------------

describe("parse_argv", () => {
  it("defaults to a full preview with no selectors", () => {
    expect(parse_argv([])).toEqual({
      dry_run: false,
      fixed: false,
      drift: false,
      ids: [],
      promote: false,
      reason: null,
      name_mode: false,
      stage: null,
      apply: false,
    });
  });

  it("collects repeated --id values", () => {
    expect(parse_argv(["--id", "rule-a", "rule-b", "--dry-run"])).toEqual({
      dry_run: true,
      fixed: false,
      drift: false,
      ids: ["rule-a", "rule-b"],
      promote: false,
      reason: null,
      name_mode: false,
      stage: null,
      apply: false,
    });
  });

  it("parses --id --fixed --reason into name-mode args", () => {
    expect(parse_argv(["--id", "rule-a", "--fixed", "--reason", "subsumed by TASK-348"])).toEqual({
      dry_run: false,
      fixed: true,
      drift: false,
      ids: ["rule-a"],
      promote: false,
      reason: "subsumed by TASK-348",
      name_mode: true,
      stage: null,
      apply: false,
    });
  });

  it("rejects an empty --reason value", () => {
    expect(() => parse_argv(["--id", "rule-a", "--fixed", "--reason", ""])).toThrowError(
      /--reason requires a non-empty value/,
    );
  });

  it("rejects name-mode (--id --fixed) without --reason", () => {
    expect(() => parse_argv(["--id", "rule-a", "--fixed"])).toThrowError(/requires --reason/);
  });

  it("rejects name-mode combined with --drift", () => {
    expect(() =>
      parse_argv(["--id", "rule-a", "--fixed", "--drift", "--reason", "x"]),
    ).toThrowError(/cannot combine with --drift/);
  });

  it("rejects --reason with --promote (not name-mode)", () => {
    expect(() =>
      parse_argv(["--id", "rule-a", "--promote", "--reason", "x"]),
    ).toThrowError(/--reason is valid only with name-mode/);
  });

  it("rejects --reason on a bare auto --fixed run (no --id)", () => {
    expect(() => parse_argv(["--fixed", "--reason", "x"])).toThrowError(
      /--reason is valid only with name-mode/,
    );
  });

  it("rejects --reason with no following value", () => {
    expect(() => parse_argv(["--id", "rule-a", "--fixed", "--reason"])).toThrowError(
      /--reason requires a non-empty value/,
    );
  });

  it("rejects --promote without --id", () => {
    expect(() => parse_argv(["--promote"])).toThrowError(/--promote requires --id/);
  });

  it("rejects --promote combined with --fixed or --drift", () => {
    expect(() => parse_argv(["--promote", "--id", "rule-a", "--fixed"])).toThrowError(
      /cannot combine/,
    );
  });

  it("rejects unknown arguments", () => {
    expect(() => parse_argv(["--frobnicate"])).toThrowError(/Unknown argument/);
  });

  it("parses --stage <path> into stage args (dry-run by default)", () => {
    expect(parse_argv(["--stage", "/drafts/d.json"])).toEqual({
      dry_run: false,
      fixed: false,
      drift: false,
      ids: [],
      promote: false,
      reason: null,
      name_mode: false,
      stage: "/drafts/d.json",
      apply: false,
    });
  });

  it("rejects --stage combined with a selector flag", () => {
    expect(() => parse_argv(["--stage", "d.json", "--promote", "--id", "x"])).toThrowError(
      /--stage cannot combine with/,
    );
  });

  it("rejects --stage combined with --dry-run (dry-run is the default)", () => {
    expect(() => parse_argv(["--stage", "d.json", "--dry-run"])).toThrowError(
      /--stage is dry-run by default/,
    );
  });

  it("rejects --apply without --stage", () => {
    expect(() => parse_argv(["--apply"])).toThrowError(/--apply is valid only with --stage/);
  });

  it("rejects --stage with a missing path value", () => {
    expect(() => parse_argv(["--stage"])).toThrowError(/--stage requires a draft file path/);
  });
});

// ---------------------------------------------------------------------------
// run() orchestration + apply against a temp registry
// ---------------------------------------------------------------------------

describe("run", () => {
  let tmp_dir: string;
  let registry_path: string;

  const promotable_rule: KnownIssue = make_wip_rule({
    group_id: "rule-promotable",
    classifier: {
      kind: "builtin",
      function_name: "check_rule_promotable",
      min_confidence: 1,
    },
  });
  const tasked_rule = make_wip_rule({
    group_id: "rule-tasked",
    backlog_task: "TASK-198",
  });
  const quiet_rule = make_wip_rule({ group_id: "rule-quiet" });

  function make_deps(over: Partial<ReconcileDeps>): ReconcileDeps {
    return {
      registry_path,
      load_registry: async () => [promotable_rule, tasked_rule, quiet_rule],
      read_commit_subjects: () => [],
      discover_drift_sources: async () => ({ sources: [], skipped: [] }),
      regenerate_permanent_slice: async () => {
        throw new Error("regenerate_permanent_slice must not run without --promote");
      },
      read_draft: async () => {
        throw new Error("read_draft must not run outside stage-mode");
      },
      known_builtin_names: () => new Set<string>(),
      ...over,
    };
  }

  async function seed_registry(rules: KnownIssue[]): Promise<string> {
    const bytes = serialize_known_issues_registry_json(rules);
    await fs.writeFile(registry_path, bytes);
    return bytes;
  }

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconcile-registry-"));
    registry_path = path.join(tmp_dir, "registry.json");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  it("previews both signals under --dry-run and writes nothing", async () => {
    const seeded = await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const summary = await run(
      ["--dry-run"],
      make_deps({
        read_commit_subjects: () => ["fix(198): close it"],
        discover_drift_sources: async () => ({
          sources: [
            {
              project: "webpack",
              run_id: "deadbee-2026-06-01T10-00-00.000Z",
              classifier_regressions: [
                {
                  rule_id: "rule-quiet",
                  flagged_entries: [{ entry_index: 3, evidence_excerpt: "obj[name]()" }],
                },
              ],
            },
          ],
          skipped: [],
        }),
      }),
    );
    expect(summary).toEqual({
      dry_run: true,
      selectors: { fixed: false, drift: false, ids: [], promote: false },
      proposals: {
        wip_to_fixed: [
          {
            kind: "wip_to_fixed",
            group_id: "rule-tasked",
            backlog_task: "TASK-198",
            matched_scope: "198",
            matched_subject: "fix(198): close it",
          },
        ],
        wip_to_fixed_by_name: [],
        drift_detected: [
          {
            kind: "drift_detected",
            group_id: "rule-quiet",
            set_drift_flag: true,
            new_evidence: [{ entry_index: 3, evidence_excerpt: "obj[name]()" }],
            flagged_by: [
              { project: "webpack", run_id: "deadbee-2026-06-01T10-00-00.000Z" },
            ],
          },
        ],
        promote_to_permanent: [],
      },
      missing_ids: [],
      rejected_promotions: [],
      drift_unknown_rule_ids: [],
      skipped_sources: [],
      applied: false,
      permanent_slice_changed: false,
    });
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("applies a wip→fixed flip through the locked write and is idempotent", async () => {
    await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const deps = make_deps({
      read_commit_subjects: () => ["fix(198): close it"],
    });

    const first = await run(["--fixed"], deps);
    expect(first.applied).toEqual(true);
    const after_first = await fs.readFile(registry_path, "utf8");
    expect(after_first).toEqual(
      serialize_known_issues_registry_json([
        promotable_rule,
        { ...tasked_rule, status: "fixed" },
        quiet_rule,
      ]),
    );

    // The rule is no longer wip, so the detector proposes nothing.
    const second_deps = make_deps({
      load_registry: async () => [
        promotable_rule,
        { ...tasked_rule, status: "fixed" },
        quiet_rule,
      ],
      read_commit_subjects: () => ["fix(198): close it"],
    });
    const second = await run(["--fixed"], second_deps);
    expect(second.applied).toEqual(false);
    expect(second.proposals.wip_to_fixed).toEqual([]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(after_first);
  });

  it("restricts the changeset with --id and reports unmatched ids", async () => {
    await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const summary = await run(
      ["--dry-run", "--id", "rule-quiet", "rule-ghost"],
      make_deps({
        read_commit_subjects: () => ["fix(198): close it"],
      }),
    );
    expect(summary.proposals.wip_to_fixed).toEqual([]);
    expect(summary.missing_ids).toEqual(["rule-quiet", "rule-ghost"]);
  });

  it("--id overrides the signal filters: a named rule's fixed work surfaces despite --drift", async () => {
    await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const summary = await run(
      ["--dry-run", "--drift", "--id", "rule-tasked"],
      make_deps({
        read_commit_subjects: () => ["fix(198): close it"],
      }),
    );
    // rule-tasked's only work is an auto wip_to_fixed proposal; despite --drift,
    // bare --id overrides the filter and the fixed signal is scanned too. (The
    // name-mode trigger is --fixed --id, so --drift --id stays a selector.)
    expect(summary.proposals.wip_to_fixed).toEqual([
      {
        kind: "wip_to_fixed",
        group_id: "rule-tasked",
        backlog_task: "TASK-198",
        matched_scope: "198",
        matched_subject: "fix(198): close it",
      },
    ]);
    expect(summary.proposals.drift_detected).toEqual([]);
    expect(summary.proposals.wip_to_fixed_by_name).toEqual([]);
    expect(summary.missing_ids).toEqual([]);
  });

  it("name-mode flips a named wip rule and retires its classifier through the locked write", async () => {
    await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const summary = await run(
      ["--id", "rule-promotable", "--fixed", "--reason", "subsumed by TASK-348"],
      make_deps({}),
    );
    expect(summary.applied).toEqual(true);
    expect(summary.proposals.wip_to_fixed_by_name).toEqual([
      { kind: "wip_to_fixed_by_name", group_id: "rule-promotable", reason: "subsumed by TASK-348" },
    ]);
    expect(summary.missing_ids).toEqual([]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(
      serialize_known_issues_registry_json([
        {
          ...promotable_rule,
          status: "fixed",
          classifier: {
            kind: "retired",
            from: { kind: "builtin", function_name: "check_rule_promotable", min_confidence: 1 },
            reason: "subsumed by TASK-348",
          },
        },
        tasked_rule,
        quiet_rule,
      ]),
    );
  });

  it("reports an unknown name-mode id in missing_ids and writes nothing", async () => {
    const seeded = await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const summary = await run(
      ["--id", "rule-ghost", "--fixed", "--reason", "x"],
      make_deps({}),
    );
    expect(summary.missing_ids).toEqual(["rule-ghost"]);
    expect(summary.applied).toEqual(false);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("name-mode on a non-wip named rule is a silent no-op (not in missing_ids)", async () => {
    const already_fixed = make_wip_rule({ group_id: "rule-done", status: "fixed" });
    const seeded = await seed_registry([already_fixed, quiet_rule]);
    const summary = await run(
      ["--id", "rule-done", "--fixed", "--reason", "x"],
      make_deps({ load_registry: async () => [already_fixed, quiet_rule] }),
    );
    expect(summary.missing_ids).toEqual([]);
    expect(summary.proposals.wip_to_fixed_by_name).toEqual([]);
    expect(summary.applied).toEqual(false);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("re-running name-mode retirement is idempotent (applied:false on the second run)", async () => {
    await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const first = await run(
      ["--id", "rule-promotable", "--fixed", "--reason", "subsumed"],
      make_deps({}),
    );
    expect(first.applied).toEqual(true);
    const after_first = await fs.readFile(registry_path, "utf8");

    const retired_rule: KnownIssue = {
      ...promotable_rule,
      status: "fixed",
      classifier: {
        kind: "retired",
        from: { kind: "builtin", function_name: "check_rule_promotable", min_confidence: 1 },
        reason: "subsumed",
      },
    };
    const second = await run(
      ["--id", "rule-promotable", "--fixed", "--reason", "subsumed"],
      make_deps({ load_registry: async () => [retired_rule, tasked_rule, quiet_rule] }),
    );
    expect(second.applied).toEqual(false);
    expect(second.proposals.wip_to_fixed_by_name).toEqual([]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(after_first);
  });

  it("promotes a classified rule and regenerates the permanent slice", async () => {
    await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const regenerate_calls: { dry_run: boolean; preview_rules: KnownIssue[] | null }[] = [];
    const summary = await run(
      ["--id", "rule-promotable", "--promote"],
      make_deps({
        known_builtin_names: () => new Set(["check_rule_promotable"]),
        regenerate_permanent_slice: async (opts) => {
          regenerate_calls.push(opts);
          return true;
        },
      }),
    );
    expect(summary.proposals.promote_to_permanent).toEqual([
      { kind: "promote_to_permanent", group_id: "rule-promotable" },
    ]);
    expect(summary.applied).toEqual(true);
    expect(summary.permanent_slice_changed).toEqual(true);
    expect(regenerate_calls).toEqual([{ dry_run: false, preview_rules: null }]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(
      serialize_known_issues_registry_json([
        { ...promotable_rule, status: "permanent" },
        tasked_rule,
        quiet_rule,
      ]),
    );
  });

  it("rejects promoting an unclassified rule and writes no registry change", async () => {
    const seeded = await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const regenerate_calls: { dry_run: boolean; preview_rules: KnownIssue[] | null }[] = [];
    const summary = await run(
      ["--id", "rule-quiet", "--promote"],
      make_deps({
        regenerate_permanent_slice: async (opts) => {
          regenerate_calls.push(opts);
          return false;
        },
      }),
    );
    expect(summary.proposals.promote_to_permanent).toEqual([]);
    expect(summary.rejected_promotions).toEqual([
      {
        group_id: "rule-quiet",
        reason:
          "classifier.kind is \"none\" — author a builtin classifier before promoting",
      },
    ]);
    expect(summary.applied).toEqual(false);
    expect(summary.permanent_slice_changed).toEqual(false);
    // The slice sync still runs on every --promote so a crash between the
    // registry write and the regeneration is recoverable by re-running.
    expect(regenerate_calls).toEqual([{ dry_run: false, preview_rules: null }]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("previews a promotion under --dry-run from the would-be-promoted rules", async () => {
    const seeded = await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const regenerate_calls: { dry_run: boolean; preview_rules: KnownIssue[] | null }[] = [];
    const summary = await run(
      ["--dry-run", "--id", "rule-promotable", "--promote"],
      make_deps({
        known_builtin_names: () => new Set(["check_rule_promotable"]),
        regenerate_permanent_slice: async (opts) => {
          regenerate_calls.push(opts);
          return true;
        },
      }),
    );
    expect(summary.applied).toEqual(false);
    expect(summary.permanent_slice_changed).toEqual(true);
    expect(regenerate_calls).toEqual([
      {
        dry_run: true,
        preview_rules: [
          { ...promotable_rule, status: "permanent" },
          tasked_rule,
          quiet_rule,
        ],
      },
    ]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("rejects promoting a builtin whose function_name is absent from BUILTIN_CHECKS", async () => {
    const seeded = await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const regenerate_calls: { dry_run: boolean; preview_rules: KnownIssue[] | null }[] = [];
    const summary = await run(
      ["--id", "rule-promotable", "--promote"],
      make_deps({
        // make_deps defaults known_builtin_names to an empty set — the
        // check_rule_promotable builtin was deleted after staging.
        regenerate_permanent_slice: async (opts) => {
          regenerate_calls.push(opts);
          return false;
        },
      }),
    );
    expect(summary.proposals.promote_to_permanent).toEqual([]);
    expect(summary.rejected_promotions).toEqual([
      {
        group_id: "rule-promotable",
        reason:
          "builtin function_name \"check_rule_promotable\" is not registered in " +
          "core's BUILTIN_CHECKS — place the check_*.ts under " +
          "packages/core/src/classify_entry_points/builtins/, rebuild core " +
          "(pnpm build --filter core), then re-promote",
      },
    ]);
    expect(summary.applied).toEqual(false);
    expect(summary.permanent_slice_changed).toEqual(false);
    expect(regenerate_calls).toEqual([{ dry_run: false, preview_rules: null }]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("previews a dangling-builtin rejection under --dry-run without writing", async () => {
    const seeded = await seed_registry([promotable_rule, tasked_rule, quiet_rule]);
    const regenerate_calls: { dry_run: boolean; preview_rules: KnownIssue[] | null }[] = [];
    const summary = await run(
      ["--dry-run", "--id", "rule-promotable", "--promote"],
      make_deps({
        regenerate_permanent_slice: async (opts) => {
          regenerate_calls.push(opts);
          return false;
        },
      }),
    );
    expect(summary.proposals.promote_to_permanent).toEqual([]);
    expect(summary.rejected_promotions).toEqual([
      {
        group_id: "rule-promotable",
        reason:
          "builtin function_name \"check_rule_promotable\" is not registered in " +
          "core's BUILTIN_CHECKS — place the check_*.ts under " +
          "packages/core/src/classify_entry_points/builtins/, rebuild core " +
          "(pnpm build --filter core), then re-promote",
      },
    ]);
    expect(summary.applied).toEqual(false);
    // An empty proposal set folds to the unchanged registry, so the preview
    // reports no slice change from a rejected promotion.
    expect(regenerate_calls).toEqual([
      { dry_run: true, preview_rules: [promotable_rule, tasked_rule, quiet_rule] },
    ]);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("promotes the registered id and rejects the dangling one in a mixed batch", async () => {
    const second_rule: KnownIssue = {
      ...promotable_rule,
      group_id: "rule-promotable-2",
      classifier: { kind: "builtin", function_name: "check_gone", min_confidence: 1 },
    };
    await seed_registry([promotable_rule, second_rule]);
    const summary = await run(
      ["--id", "rule-promotable", "rule-promotable-2", "--promote"],
      make_deps({
        load_registry: async () => [promotable_rule, second_rule],
        known_builtin_names: () => new Set(["check_rule_promotable"]),
        regenerate_permanent_slice: async () => true,
      }),
    );
    expect(summary.proposals.promote_to_permanent).toEqual([
      { kind: "promote_to_permanent", group_id: "rule-promotable" },
    ]);
    expect(summary.rejected_promotions).toEqual([
      {
        group_id: "rule-promotable-2",
        reason:
          "builtin function_name \"check_gone\" is not registered in " +
          "core's BUILTIN_CHECKS — place the check_*.ts under " +
          "packages/core/src/classify_entry_points/builtins/, rebuild core " +
          "(pnpm build --filter core), then re-promote",
      },
    ]);
    expect(summary.applied).toEqual(true);
    // Only the accepted rule flips; the dangling rule stays wip.
    expect(await fs.readFile(registry_path, "utf8")).toEqual(
      serialize_known_issues_registry_json([
        { ...promotable_rule, status: "permanent" },
        second_rule,
      ]),
    );
  });

  it("reports the dangling-builtin reason ahead of already-permanent", async () => {
    const permanent_dangling: KnownIssue = {
      ...promotable_rule,
      group_id: "rule-perm-dangling",
      status: "permanent",
      classifier: { kind: "builtin", function_name: "check_gone", min_confidence: 1 },
    };
    await seed_registry([permanent_dangling]);
    const summary = await run(
      ["--id", "rule-perm-dangling", "--promote"],
      make_deps({
        load_registry: async () => [permanent_dangling],
        regenerate_permanent_slice: async () => false,
      }),
    );
    expect(summary.rejected_promotions).toEqual([
      {
        group_id: "rule-perm-dangling",
        reason:
          "builtin function_name \"check_gone\" is not registered in " +
          "core's BUILTIN_CHECKS — place the check_*.ts under " +
          "packages/core/src/classify_entry_points/builtins/, rebuild core " +
          "(pnpm build --filter core), then re-promote",
      },
    ]);
  });

  it("surfaces skipped sources from drift discovery", async () => {
    await seed_registry([quiet_rule]);
    const summary = await run(
      ["--dry-run", "--drift"],
      make_deps({
        load_registry: async () => [quiet_rule],
        discover_drift_sources: async () => ({
          sources: [],
          skipped: [
            {
              project: "webpack",
              file: "/published/webpack/triage_results/stale.json",
              error: "schema_version=4 does not match current v5",
            },
          ],
        }),
      }),
    );
    expect(summary.skipped_sources).toEqual([
      {
        project: "webpack",
        file: "/published/webpack/triage_results/stale.json",
        error: "schema_version=4 does not match current v5",
      },
    ]);
    expect(summary.proposals.drift_detected).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// run_stage: insert an agent-authored draft (via run_or_stage dispatch)
// ---------------------------------------------------------------------------

describe("run_stage", () => {
  let tmp_dir: string;
  let registry_path: string;

  const seeded_rule = make_wip_rule({ group_id: "rule-existing", observed_count: 1 });

  const staged_draft: KnownIssue = make_wip_rule({
    group_id: "rule-staged",
    observed_count: 1,
    classifier: { kind: "builtin", function_name: "check_staged", min_confidence: 0.95 },
  });

  function stage_deps(over: Partial<ReconcileDeps>): ReconcileDeps {
    return {
      registry_path,
      load_registry: async () => [seeded_rule],
      read_commit_subjects: () => [],
      discover_drift_sources: async () => ({ sources: [], skipped: [] }),
      regenerate_permanent_slice: async () => {
        throw new Error("regenerate_permanent_slice must not run in stage-mode");
      },
      read_draft: async () => staged_draft,
      known_builtin_names: () => new Set(["check_staged"]),
      ...over,
    };
  }

  async function seed(rules: KnownIssue[]): Promise<string> {
    const bytes = serialize_known_issues_registry_json(rules);
    await fs.writeFile(registry_path, bytes);
    return bytes;
  }

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "reconcile-stage-"));
    registry_path = path.join(tmp_dir, "registry.json");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  it("dry-runs by default: validates and previews the insert without writing", async () => {
    const seeded = await seed([seeded_rule]);
    const summary = await run_or_stage(["--stage", "/drafts/rule-staged.json"], stage_deps({}));
    expect(summary).toEqual({ draft: staged_draft, applied: false });
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("--apply appends the draft through the locked write", async () => {
    await seed([seeded_rule]);
    const summary = await run_or_stage(
      ["--stage", "/drafts/rule-staged.json", "--apply"],
      stage_deps({}),
    );
    expect(summary).toEqual({ draft: staged_draft, applied: true });
    expect(await fs.readFile(registry_path, "utf8")).toEqual(
      serialize_known_issues_registry_json([seeded_rule, staged_draft]),
    );
  });

  it("rejects a draft whose group_id already exists (no silent overwrite)", async () => {
    const dup = make_wip_rule({
      group_id: "rule-existing",
      observed_count: 1,
      classifier: { kind: "builtin", function_name: "check_staged", min_confidence: 0.95 },
    });
    const seeded = await seed([seeded_rule]);
    await expect(
      run_or_stage(["--stage", "/drafts/dup.json", "--apply"], stage_deps({ read_draft: async () => dup })),
    ).rejects.toThrowError(/group_id "rule-existing" already exists/);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("rejects a builtin draft whose function_name is not in BUILTIN_CHECKS", async () => {
    const seeded = await seed([seeded_rule]);
    await expect(
      run_or_stage(
        ["--stage", "/drafts/rule-staged.json", "--apply"],
        stage_deps({ known_builtin_names: () => new Set<string>() }),
      ),
    ).rejects.toThrowError(/function_name "check_staged" is not registered in core's BUILTIN_CHECKS/);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("blocks a wip builtin draft with observed_count < 1 (evidence gate)", async () => {
    const speculative = make_wip_rule({
      group_id: "rule-speculative",
      observed_count: 0,
      classifier: { kind: "builtin", function_name: "check_staged", min_confidence: 0.95 },
    });
    const seeded = await seed([seeded_rule]);
    await expect(
      run_or_stage(
        ["--stage", "/drafts/spec.json", "--apply"],
        stage_deps({ read_draft: async () => speculative }),
      ),
    ).rejects.toThrowError(/failed schema validation|observed_count/);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("rejects a non-builtin (none) draft — --stage inserts builtins only", async () => {
    const none_draft = make_wip_rule({ group_id: "rule-none-draft", observed_count: 1 });
    const seeded = await seed([seeded_rule]);
    await expect(
      run_or_stage(
        ["--stage", "/drafts/none.json", "--apply"],
        stage_deps({ read_draft: async () => none_draft }),
      ),
    ).rejects.toThrowError(/--stage inserts a builtin classifier/);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("rejects a draft whose builtin function_name is already used by another rule", async () => {
    const owner = make_wip_rule({
      group_id: "rule-owns-fn",
      observed_count: 1,
      classifier: { kind: "builtin", function_name: "check_staged", min_confidence: 0.95 },
    });
    const seeded = await seed([owner]);
    await expect(
      run_or_stage(
        ["--stage", "/drafts/rule-staged.json", "--apply"],
        stage_deps({ read_draft: async () => staged_draft, load_registry: async () => [owner] }),
      ),
    ).rejects.toThrowError(/function_name "check_staged" is already used by rule "rule-owns-fn"/);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("wraps a malformed-JSON read as a StageDraftError, writing nothing", async () => {
    const seeded = await seed([seeded_rule]);
    await expect(
      run_or_stage(
        ["--stage", "/drafts/bad.json"],
        stage_deps({
          read_draft: async () => {
            throw new SyntaxError("Unexpected token < in JSON");
          },
        }),
      ),
    ).rejects.toThrowError(/could not be read\/parsed/);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });

  it("catches a collision under the write lock that the pre-lock snapshot missed", async () => {
    // load_registry (the pre-lock read) is stale/empty, but the on-disk file
    // already holds the draft's group_id — the under-lock re-check must reject.
    const seeded = await seed([staged_draft]);
    await expect(
      run_or_stage(
        ["--stage", "/drafts/rule-staged.json", "--apply"],
        stage_deps({ load_registry: async () => [] }),
      ),
    ).rejects.toThrowError(/group_id "rule-staged" already exists/);
    expect(await fs.readFile(registry_path, "utf8")).toEqual(seeded);
  });
});

// ---------------------------------------------------------------------------
// Whole-repo invariant
// ---------------------------------------------------------------------------

describe("registry round-trip", () => {
  it("the committed registry re-serializes byte-identically (noop detection depends on it)", async () => {
    // The apply path's `next === raw` noop check assumes the on-disk file is
    // in the canonical serializer format. A hand-edit that reformats the
    // registry would silently turn every apply into a full-file rewrite.
    const raw = await fs.readFile(known_issues_registry_path(), "utf8");
    expect(
      serialize_known_issues_registry_json(parse_known_issues_registry_json(raw)),
    ).toEqual(raw);
  });
});
