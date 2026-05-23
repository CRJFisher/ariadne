import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  absorb_verdict,
  type AbsorbVerdictOptions,
  type CoordinatorFn,
} from "./absorb_verdict.js";
import {
  read_classifier_regression_records,
  type ClassifierRegressionRecord,
} from "./classifier_regressions.js";
import type { CoordinatorDecision } from "./coordinator/decision.js";
import {
  read_coordinator_log,
  type CoordinatorLogEntry,
} from "./coordinator/log.js";
import {
  read_novel_issues,
  type NovelIssuesFile,
  write_novel_issues,
} from "./novel_issues.js";
import type {
  TriageVerdict,
  VerdictFpClassifierRegression,
  VerdictFpNovelCited,
  VerdictFpNovelNew,
  VerdictTp,
  VerdictUncertain,
} from "./triage_verdict.js";

const FIXED_NOW = "2026-05-22T12:00:00.000Z";

const VERDICT_TP: VerdictTp = {
  kind: "tp",
  member_evidence: { file: "src/a.ts", line: 12, why: "not called anywhere" },
};

const VERDICT_REGRESSION: VerdictFpClassifierRegression = {
  kind: "fp-classifier-regression",
  should_have_matched_rule_id: "decorator-route",
  evidence_excerpt: "@route('/x')",
  member_evidence: { file: "src/b.ts", line: 5, why: "should have matched" },
};

const VERDICT_UNCERTAIN: VerdictUncertain = {
  kind: "uncertain",
  reason: "compound evidence — two gaps overlap",
  member_evidence: { file: "src/c.ts", line: 9, why: "ambiguous" },
};

const VERDICT_NOVEL_NEW: VerdictFpNovelNew = {
  kind: "fp-novel-new",
  proposed_root_cause: "framework registers handler via @route decorator",
  evidence_excerpt: "@route('/x') def handler_x(): ...",
  member_evidence: {
    file: "src/routes.ts",
    line: 7,
    why: "decorator-registered route",
  },
};

const VERDICT_NOVEL_CITED: VerdictFpNovelCited = {
  kind: "fp-novel-cited",
  novel_issue_id: "decorator-route-registration",
  evidence_excerpt: "@route('/y') def handler_y(): ...",
};

describe("absorb_verdict", () => {
  let tmp_dir: string;
  let novel_path: string;
  let log_path: string;
  let regressions_path: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "absorb-verdict-"));
    novel_path = path.join(tmp_dir, "novel_issues.json");
    log_path = path.join(tmp_dir, "coordinator_log.jsonl");
    regressions_path = path.join(tmp_dir, "classifier_regressions.jsonl");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  describe("direct absorb (no coordinator call)", () => {
    it.each<[string, TriageVerdict]>([
      ["tp", VERDICT_TP],
      ["fp-classifier-regression", VERDICT_REGRESSION],
      ["uncertain", VERDICT_UNCERTAIN],
    ])("never invokes the coordinator for %s", async (_, verdict) => {
      let coordinator_called = false;
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async () => {
          coordinator_called = true;
          throw new Error("coordinator should not be called");
        },
        now: () => FIXED_NOW,
      };
      const result = await absorb_verdict(3, verdict, opts);
      expect(coordinator_called).toEqual(false);
      expect(result).toEqual({ kind: verdict.kind });
    });

    it("does not touch novel_issues.json or coordinator_log.jsonl on tp/uncertain absorb", async () => {
      const opts = build_opts(novel_path, log_path, regressions_path, throwing_coordinator);
      await absorb_verdict(3, VERDICT_TP, opts);
      await expect(fs.access(novel_path)).rejects.toThrow();
      await expect(fs.access(log_path)).rejects.toThrow();
      await expect(fs.access(regressions_path)).rejects.toThrow();
    });
  });

  describe("classifier-regression absorb", () => {
    it("appends a record to classifier_regressions.jsonl with the verdict payload", async () => {
      const opts = build_opts(novel_path, log_path, regressions_path, throwing_coordinator);
      const result = await absorb_verdict(7, VERDICT_REGRESSION, opts);
      expect(result).toEqual({ kind: "fp-classifier-regression" });

      const expected: ClassifierRegressionRecord[] = [
        {
          timestamp: FIXED_NOW,
          entry_index: 7,
          should_have_matched_rule_id: "decorator-route",
          evidence_excerpt: "@route('/x')",
          member_evidence: { file: "src/b.ts", line: 5, why: "should have matched" },
        },
      ];
      expect(await read_classifier_regression_records(regressions_path)).toEqual(expected);
      // No novel-issue side effects.
      await expect(fs.access(novel_path)).rejects.toThrow();
      await expect(fs.access(log_path)).rejects.toThrow();
    });

    it("appends a second record without rewriting the first", async () => {
      const opts = build_opts(novel_path, log_path, regressions_path, throwing_coordinator);
      await absorb_verdict(7, VERDICT_REGRESSION, opts);
      await absorb_verdict(9, VERDICT_REGRESSION, opts);
      const records = await read_classifier_regression_records(regressions_path);
      expect(records.map((r) => r.entry_index)).toEqual([7, 9]);
    });
  });

  describe("coordinator decision: register_new", () => {
    it("registers a brand-new issue with the verdict's evidence as the initial citation", async () => {
      const decision: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Decorator route registration",
        root_cause: "framework registers handler via @route decorator",
        reason: "no existing issue matches",
      };
      const opts = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision),
      );
      const result = await absorb_verdict(4, VERDICT_NOVEL_NEW, opts);

      const expected_file: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [
              {
                entry_index: 4,
                evidence_excerpt: "@route('/x') def handler_x(): ...",
              },
            ],
          },
        ],
        flagged: [],
      };
      expect(await read_novel_issues(novel_path)).toEqual(expected_file);

      if (!("outcome" in result) || result.outcome !== "registered") {
        throw new Error("expected registered outcome");
      }
      expect(result.novel_issues).toEqual(expected_file);
      expect(result.registered_issue).toEqual(expected_file.issues[0]);
      expect(result.coordinator_decision).toEqual(decision);
      expect(result.applied_decision).toEqual(decision);
    });

    it("logs the register_new decision to coordinator_log.jsonl", async () => {
      const decision: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Decorator route registration",
        root_cause: "framework registers handler via @route decorator",
        reason: "no existing issue matches",
      };
      const opts = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision),
      );
      await absorb_verdict(4, VERDICT_NOVEL_NEW, opts);

      const expected_log: CoordinatorLogEntry[] = [
        {
          timestamp: FIXED_NOW,
          entry_index: 4,
          verdict: VERDICT_NOVEL_NEW,
          decision,
        },
      ];
      expect(await read_coordinator_log(log_path)).toEqual(expected_log);
    });

    it("appends a numeric suffix on canonical_name collision", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "pre-existing",
            citations: [{ entry_index: 0, evidence_excerpt: "x" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      const decision: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Decorator route registration",
        root_cause: "second occurrence of the same name",
        reason: "name collision",
      };
      const opts = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision),
      );
      const result = await absorb_verdict(9, VERDICT_NOVEL_NEW, opts);

      if (!("outcome" in result) || result.outcome !== "registered") {
        throw new Error("expected registered outcome");
      }
      expect(result.registered_issue.id).toEqual(
        "decorator-route-registration-2",
      );
    });
  });

  describe("coordinator decision: merge_into", () => {
    it("appends a citation to the existing issue", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [{ entry_index: 1, evidence_excerpt: "@route('/x')" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      const decision: CoordinatorDecision = {
        kind: "merge_into",
        novel_issue_id: "decorator-route-registration",
        reason: "verdict cites the same gap as the existing issue",
      };
      const opts = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision),
      );
      const result = await absorb_verdict(9, VERDICT_NOVEL_CITED, opts);

      const expected_file: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [
              { entry_index: 1, evidence_excerpt: "@route('/x')" },
              {
                entry_index: 9,
                evidence_excerpt: "@route('/y') def handler_y(): ...",
              },
            ],
          },
        ],
        flagged: [],
      };
      expect(await read_novel_issues(novel_path)).toEqual(expected_file);

      if (!("outcome" in result) || result.outcome !== "merged") {
        throw new Error("expected merged outcome");
      }
      expect(result.kind).toEqual("fp-novel-cited");
      expect(result.novel_issues).toEqual(expected_file);
      expect(result.coordinator_decision).toEqual(decision);
      expect(result.applied_decision).toEqual(decision);
    });

    it("logs the merge_into decision", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [{ entry_index: 1, evidence_excerpt: "@route('/x')" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      const decision: CoordinatorDecision = {
        kind: "merge_into",
        novel_issue_id: "decorator-route-registration",
        reason: "same gap",
      };
      const opts = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision),
      );
      await absorb_verdict(9, VERDICT_NOVEL_CITED, opts);
      const log = await read_coordinator_log(log_path);
      expect(log).toEqual([
        {
          timestamp: FIXED_NOW,
          entry_index: 9,
          verdict: VERDICT_NOVEL_CITED,
          decision,
        },
      ]);
    });

    it("downgrades merge_into to flag when novel_issue_id is unknown — and logs the downgrade", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [{ entry_index: 1, evidence_excerpt: "@route('/x')" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      const decision: CoordinatorDecision = {
        kind: "merge_into",
        novel_issue_id: "does-not-exist",
        reason: "coordinator hallucinated this id",
      };
      const opts = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision),
      );
      const result = await absorb_verdict(9, VERDICT_NOVEL_CITED, opts);

      const downgrade_reason =
        "coordinator referenced unknown novel_issue_id 'does-not-exist'; downgraded to flag";
      const expected_file: NovelIssuesFile = {
        issues: seed.issues,
        flagged: [
          {
            entry_index: 9,
            verdict: VERDICT_NOVEL_CITED,
            reason: downgrade_reason,
          },
        ],
      };
      expect(await read_novel_issues(novel_path)).toEqual(expected_file);

      if (!("outcome" in result) || result.outcome !== "flagged") {
        throw new Error("expected flagged outcome");
      }
      expect(result.coordinator_decision).toEqual(decision);
      expect(result.applied_decision).toEqual({
        kind: "flag",
        reason: downgrade_reason,
      });

      const log = await read_coordinator_log(log_path);
      expect(log).toEqual([
        {
          timestamp: FIXED_NOW,
          entry_index: 9,
          verdict: VERDICT_NOVEL_CITED,
          decision: { kind: "flag", reason: downgrade_reason },
        },
      ]);
    });
  });

  describe("coordinator decision: flag", () => {
    it("appends a flagged entry and logs the decision", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [{ entry_index: 1, evidence_excerpt: "@route('/x')" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      const decision: CoordinatorDecision = {
        kind: "flag",
        reason: "evidence excerpt compounds two gaps",
      };
      const opts = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision),
      );
      const result = await absorb_verdict(11, VERDICT_NOVEL_NEW, opts);

      const expected_file: NovelIssuesFile = {
        issues: seed.issues,
        flagged: [
          {
            entry_index: 11,
            verdict: VERDICT_NOVEL_NEW,
            reason: "evidence excerpt compounds two gaps",
          },
        ],
      };
      expect(await read_novel_issues(novel_path)).toEqual(expected_file);

      if (!("outcome" in result) || result.outcome !== "flagged") {
        throw new Error("expected flagged outcome");
      }
      expect(result.coordinator_decision).toEqual(decision);
      expect(result.applied_decision).toEqual(decision);

      const expected_log: CoordinatorLogEntry[] = [
        {
          timestamp: FIXED_NOW,
          entry_index: 11,
          verdict: VERDICT_NOVEL_NEW,
          decision,
        },
      ];
      expect(await read_coordinator_log(log_path)).toEqual(expected_log);
    });
  });

  describe("replay guard (H5)", () => {
    it("skips re-absorbing an entry already cited in an existing issue", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [
              {
                entry_index: 9,
                evidence_excerpt: "previously absorbed evidence",
              },
            ],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      let coordinator_called = false;
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async () => {
          coordinator_called = true;
          return { kind: "flag", reason: "should not be called" };
        },
        now: () => FIXED_NOW,
      };
      const result = await absorb_verdict(9, VERDICT_NOVEL_CITED, opts);

      expect(coordinator_called).toEqual(false);
      expect(await read_novel_issues(novel_path)).toEqual(seed);
      await expect(fs.access(log_path)).rejects.toThrow();
      if (!("outcome" in result) || result.outcome !== "replayed-citation") {
        throw new Error("expected replayed-citation outcome");
      }
      expect(result.novel_issues).toEqual(seed);
    });

    it("skips re-absorbing an entry already in flagged", async () => {
      const seed: NovelIssuesFile = {
        issues: [],
        flagged: [
          {
            entry_index: 11,
            verdict: VERDICT_NOVEL_NEW,
            reason: "prior flag",
          },
        ],
      };
      await write_novel_issues(novel_path, seed);

      let coordinator_called = false;
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async () => {
          coordinator_called = true;
          return { kind: "flag", reason: "should not be called" };
        },
        now: () => FIXED_NOW,
      };
      const result = await absorb_verdict(11, VERDICT_NOVEL_NEW, opts);

      expect(coordinator_called).toEqual(false);
      if (!("outcome" in result) || result.outcome !== "replayed-flag") {
        throw new Error("expected replayed-flag outcome");
      }
      expect(result.novel_issues).toEqual(seed);
    });
  });

  describe("coordinator throw (H4) — degrades to synthetic flag and still logs", () => {
    it("converts a thrown error into a flag decision with the message as reason", async () => {
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async () => {
          throw new Error("sub-agent timed out");
        },
        now: () => FIXED_NOW,
      };
      const result = await absorb_verdict(5, VERDICT_NOVEL_NEW, opts);

      const expected_decision: CoordinatorDecision = {
        kind: "flag",
        reason: "coordinator threw: sub-agent timed out",
      };
      if (!("outcome" in result) || result.outcome !== "flagged") {
        throw new Error("expected flagged outcome");
      }
      expect(result.coordinator_decision).toEqual(expected_decision);
      expect(result.applied_decision).toEqual(expected_decision);

      const expected_file: NovelIssuesFile = {
        issues: [],
        flagged: [
          {
            entry_index: 5,
            verdict: VERDICT_NOVEL_NEW,
            reason: "coordinator threw: sub-agent timed out",
          },
        ],
      };
      expect(await read_novel_issues(novel_path)).toEqual(expected_file);

      const expected_log: CoordinatorLogEntry[] = [
        {
          timestamp: FIXED_NOW,
          entry_index: 5,
          verdict: VERDICT_NOVEL_NEW,
          decision: expected_decision,
        },
      ];
      expect(await read_coordinator_log(log_path)).toEqual(expected_log);
    });
  });

  describe("idempotency under repeated identical absorptions (AC#4)", () => {
    it("merge_into: file content unchanged on replay; log records the first absorb only", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers handler via @route decorator",
            citations: [{ entry_index: 9, evidence_excerpt: "@route('/y')" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      const decision: CoordinatorDecision = {
        kind: "merge_into",
        novel_issue_id: "decorator-route-registration",
        reason: "same gap",
      };
      let coordinator_call_count = 0;
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async () => {
          coordinator_call_count += 1;
          return decision;
        },
        now: () => FIXED_NOW,
      };
      await absorb_verdict(9, VERDICT_NOVEL_CITED, opts);
      await absorb_verdict(9, VERDICT_NOVEL_CITED, opts);

      expect(await read_novel_issues(novel_path)).toEqual(seed);
      // The replay guard catches the second call before the coordinator runs.
      expect(coordinator_call_count).toEqual(0);
      // Empty log because the entry was already cited; no novel work to record.
      expect(await read_coordinator_log(log_path)).toEqual([]);
    });

    it("register_new: replay does not create a -2 suffix duplicate", async () => {
      const decision: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Decorator route registration",
        root_cause: "framework registers handler via @route decorator",
        reason: "first time",
      };
      let coordinator_call_count = 0;
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async () => {
          coordinator_call_count += 1;
          return decision;
        },
        now: () => FIXED_NOW,
      };
      await absorb_verdict(4, VERDICT_NOVEL_NEW, opts);
      await absorb_verdict(4, VERDICT_NOVEL_NEW, opts);

      const file = await read_novel_issues(novel_path);
      expect(file.issues.length).toEqual(1);
      expect(file.issues[0].id).toEqual("decorator-route-registration");
      expect(file.issues[0].citations).toEqual([
        {
          entry_index: 4,
          evidence_excerpt: "@route('/x') def handler_x(): ...",
        },
      ]);
      // Second call was guarded.
      expect(coordinator_call_count).toEqual(1);
    });
  });

  describe("default now()", () => {
    it("falls back to a valid ISO-8601 timestamp when production uses default_now", async () => {
      // Mirrors the production wiring: the dispatcher passes
      // `() => new Date().toISOString()` as `now`.
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async () => ({
          kind: "flag",
          reason: "test",
        }),
        now: () => new Date().toISOString(),
      };
      await absorb_verdict(7, VERDICT_NOVEL_NEW, opts);
      const log = await read_coordinator_log(log_path);
      expect(log.length).toEqual(1);
      expect(log[0].timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe("coordinator prompt input", () => {
    it("passes the current novel_issues snapshot to the coordinator", async () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "existing-issue",
            canonical_name: "Existing issue",
            root_cause: "something",
            citations: [{ entry_index: 0, evidence_excerpt: "x" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(novel_path, seed);

      const seen_inputs: {
        entry_index: number;
        verdict: TriageVerdict;
        current: NovelIssuesFile;
      }[] = [];
      const opts: AbsorbVerdictOptions = {
        novel_issues_path: novel_path,
        coordinator_log_path: log_path,
        classifier_regressions_path: regressions_path,
        coordinator: async (input) => {
          seen_inputs.push({
            entry_index: input.entry_index,
            verdict: input.verdict,
            current: input.current,
          });
          return { kind: "flag", reason: "test" };
        },
        now: () => FIXED_NOW,
      };
      await absorb_verdict(5, VERDICT_NOVEL_NEW, opts);

      expect(seen_inputs).toEqual([
        { entry_index: 5, verdict: VERDICT_NOVEL_NEW, current: seed },
      ]);
    });
  });

  describe("verdict shape validation at the boundary (H1)", () => {
    it("rejects a malformed verdict before any I/O", async () => {
      const opts = build_opts(novel_path, log_path, regressions_path, throwing_coordinator);
      const malformed = {
        kind: "fp-novel-new",
        proposed_root_cause: "x",
        // missing evidence_excerpt and member_evidence
      } as unknown as TriageVerdict;
      await expect(absorb_verdict(1, malformed, opts)).rejects.toThrow(
        /missing required field/,
      );
      await expect(fs.access(novel_path)).rejects.toThrow();
      await expect(fs.access(log_path)).rejects.toThrow();
    });
  });

  describe("per-path serialization (C3)", () => {
    it("serializes concurrent absorbs against the same path", async () => {
      // Two absorbs against an empty path with register_new decisions for
      // different entries. Without the path lock they would race the
      // read-modify-write cycle and one would clobber the other; with the
      // lock both issues end up in the file.
      const decision_a: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Issue A",
        root_cause: "gap A",
        reason: "first",
      };
      const decision_b: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Issue B",
        root_cause: "gap B",
        reason: "second",
      };
      const opts_a = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision_a),
      );
      const opts_b = build_opts(
        novel_path,
        log_path,
        regressions_path,
        constant_coordinator(decision_b),
      );
      await Promise.all([
        absorb_verdict(1, VERDICT_NOVEL_NEW, opts_a),
        absorb_verdict(2, VERDICT_NOVEL_NEW, opts_b),
      ]);
      const file = await read_novel_issues(novel_path);
      expect(file.issues.length).toEqual(2);
      const ids = new Set(file.issues.map((i) => i.id));
      expect(ids).toEqual(new Set(["issue-a", "issue-b"]));
    });
  });
});

function build_opts(
  novel_issues_path: string,
  coordinator_log_path: string,
  classifier_regressions_path: string,
  coordinator: CoordinatorFn,
): AbsorbVerdictOptions {
  return {
    novel_issues_path,
    coordinator_log_path,
    classifier_regressions_path,
    coordinator,
    now: () => FIXED_NOW,
  };
}

function constant_coordinator(decision: CoordinatorDecision): CoordinatorFn {
  return async () => decision;
}

const throwing_coordinator: CoordinatorFn = async () => {
  throw new Error("coordinator should not be called");
};
