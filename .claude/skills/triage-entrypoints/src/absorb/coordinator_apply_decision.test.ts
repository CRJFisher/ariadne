import { describe, expect, it } from "vitest";

import { apply_coordinator_decision } from "./coordinator_apply_decision.js";
import type { CoordinatorDecision } from "./coordinator_decision.js";
import {
  EMPTY_NOVEL_ISSUES_FILE,
  type NovelIssuesFile,
} from "./novel_issues.js";
import type {
  VerdictFpNovelCited,
  VerdictFpNovelNew,
} from "../verdict/triage_verdict.js";

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

const SEED_WITH_ISSUE: NovelIssuesFile = {
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

describe("apply_coordinator_decision", () => {
  describe("register_new", () => {
    it("registers a brand-new issue seeded with the verdict's evidence", () => {
      const decision: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Decorator route registration",
        root_cause: "framework registers handler via @route decorator",
        reason: "no existing match",
      };
      const result = apply_coordinator_decision(
        EMPTY_NOVEL_ISSUES_FILE,
        4,
        VERDICT_NOVEL_NEW,
        decision,
      );
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
      if (result.kind !== "registered") throw new Error("expected registered");
      expect(result.next).toEqual(expected_file);
      expect(result.registered_issue).toEqual(expected_file.issues[0]);
      expect(result.applied_decision).toEqual(decision);
    });

    it("appends a numeric suffix on canonical_name collision", () => {
      const decision: CoordinatorDecision = {
        kind: "register_new",
        canonical_name: "Decorator route registration",
        root_cause: "different gap collapsed onto same name",
        reason: "name collision",
      };
      const result = apply_coordinator_decision(
        SEED_WITH_ISSUE,
        9,
        VERDICT_NOVEL_NEW,
        decision,
      );
      if (result.kind !== "registered") throw new Error("expected registered");
      expect(result.registered_issue.id).toEqual(
        "decorator-route-registration-2",
      );
    });
  });

  describe("merge_into", () => {
    it("appends a citation to an existing issue", () => {
      const decision: CoordinatorDecision = {
        kind: "merge_into",
        novel_issue_id: "decorator-route-registration",
        reason: "same gap",
      };
      const result = apply_coordinator_decision(
        SEED_WITH_ISSUE,
        9,
        VERDICT_NOVEL_CITED,
        decision,
      );
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
      if (result.kind !== "merged") throw new Error("expected merged");
      expect(result.next).toEqual(expected_file);
      expect(result.applied_decision).toEqual(decision);
    });

    it("downgrades to flag when novel_issue_id is not present in the snapshot", () => {
      const decision: CoordinatorDecision = {
        kind: "merge_into",
        novel_issue_id: "does-not-exist",
        reason: "coordinator hallucinated this id",
      };
      const result = apply_coordinator_decision(
        SEED_WITH_ISSUE,
        9,
        VERDICT_NOVEL_CITED,
        decision,
      );
      if (result.kind !== "flagged") throw new Error("expected flagged");
      expect(result.applied_decision).toEqual({
        kind: "flag",
        reason:
          "coordinator referenced unknown novel_issue_id 'does-not-exist'; downgraded to flag",
      });
      // novel_issues.issues untouched; only flagged grew.
      expect(result.next.issues).toEqual(SEED_WITH_ISSUE.issues);
      expect(result.next.flagged).toEqual([
        {
          entry_index: 9,
          verdict: VERDICT_NOVEL_CITED,
          reason:
            "coordinator referenced unknown novel_issue_id 'does-not-exist'; downgraded to flag",
        },
      ]);
    });
  });

  describe("flag", () => {
    it("records the verdict in flagged with the coordinator's reason", () => {
      const decision: CoordinatorDecision = {
        kind: "flag",
        reason: "evidence compounds two gaps",
      };
      const result = apply_coordinator_decision(
        EMPTY_NOVEL_ISSUES_FILE,
        11,
        VERDICT_NOVEL_NEW,
        decision,
      );
      if (result.kind !== "flagged") throw new Error("expected flagged");
      expect(result.next).toEqual({
        issues: [],
        flagged: [
          {
            entry_index: 11,
            verdict: VERDICT_NOVEL_NEW,
            reason: "evidence compounds two gaps",
          },
        ],
      });
      expect(result.applied_decision).toEqual(decision);
    });
  });
});
