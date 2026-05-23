import { describe, expect, it } from "vitest";

import {
  parse_coordinator_decision,
  type CoordinatorDecision,
  type DecisionFlag,
  type DecisionMergeInto,
  type DecisionRegisterNew,
} from "./decision.js";

describe("parse_coordinator_decision", () => {
  describe("round-trip every decision kind", () => {
    it("merge_into", () => {
      const decision: DecisionMergeInto = {
        kind: "merge_into",
        novel_issue_id: "decorator-route-registration",
        reason: "Same gap as existing issue under different wording.",
      };
      expect(parse_coordinator_decision(decision)).toEqual(decision);
    });

    it("register_new", () => {
      const decision: DecisionRegisterNew = {
        kind: "register_new",
        canonical_name: "Decorator route registration",
        root_cause: "Framework registers handlers via @route decorator.",
        reason: "No existing issue covers this decorator-driven pattern.",
      };
      expect(parse_coordinator_decision(decision)).toEqual(decision);
    });

    it("flag", () => {
      const decision: DecisionFlag = {
        kind: "flag",
        reason: "Evidence excerpt compounds two distinct detection gaps.",
      };
      expect(parse_coordinator_decision(decision)).toEqual(decision);
    });
  });

  describe("rejects malformed input", () => {
    it("rejects non-object root", () => {
      expect(() => parse_coordinator_decision(42)).toThrow(
        /coordinator_decision: expected object, got number/,
      );
    });

    it("rejects missing kind field", () => {
      expect(() => parse_coordinator_decision({})).toThrow(
        /'kind' must be a string, got undefined/,
      );
    });

    it("rejects numeric kind field", () => {
      expect(() => parse_coordinator_decision({ kind: 42 })).toThrow(
        /'kind' must be a string, got number/,
      );
    });

    it("rejects unknown kind", () => {
      expect(() =>
        parse_coordinator_decision({ kind: "ignore", reason: "x" }),
      ).toThrow(/unknown kind 'ignore'/);
    });

    it("rejects merge_into missing novel_issue_id", () => {
      expect(() =>
        parse_coordinator_decision({ kind: "merge_into", reason: "x" }),
      ).toThrow(/missing required field 'novel_issue_id'/);
    });

    it("rejects merge_into with non-string novel_issue_id", () => {
      expect(() =>
        parse_coordinator_decision({
          kind: "merge_into",
          novel_issue_id: 42,
          reason: "x",
        }),
      ).toThrow(/novel_issue_id: must be a string, got number/);
    });

    it("rejects merge_into with empty reason", () => {
      expect(() =>
        parse_coordinator_decision({
          kind: "merge_into",
          novel_issue_id: "x",
          reason: "",
        }),
      ).toThrow(/reason: must be non-empty/);
    });

    it("rejects register_new missing canonical_name", () => {
      expect(() =>
        parse_coordinator_decision({
          kind: "register_new",
          root_cause: "y",
          reason: "z",
        }),
      ).toThrow(/missing required field 'canonical_name'/);
    });

    it("rejects register_new missing root_cause", () => {
      expect(() =>
        parse_coordinator_decision({
          kind: "register_new",
          canonical_name: "X",
          reason: "y",
        }),
      ).toThrow(/missing required field 'root_cause'/);
    });

    it("rejects register_new with non-string canonical_name", () => {
      expect(() =>
        parse_coordinator_decision({
          kind: "register_new",
          canonical_name: 42,
          root_cause: "y",
          reason: "z",
        }),
      ).toThrow(/canonical_name: must be a string, got number/);
    });

    it("rejects register_new with empty canonical_name", () => {
      expect(() =>
        parse_coordinator_decision({
          kind: "register_new",
          canonical_name: "",
          root_cause: "y",
          reason: "z",
        }),
      ).toThrow(/canonical_name: must be non-empty/);
    });

    it("rejects flag with extra unknown field", () => {
      expect(() =>
        parse_coordinator_decision({
          kind: "flag",
          reason: "x",
          novel_issue_id: "y",
        }),
      ).toThrow(/unexpected field 'novel_issue_id'/);
    });

    it("rejects flag missing reason", () => {
      expect(() => parse_coordinator_decision({ kind: "flag" })).toThrow(
        /missing required field 'reason'/,
      );
    });
  });

  describe("round-trip from JSON wire format", () => {
    it("merge_into via JSON.parse", () => {
      const wire = JSON.stringify({
        kind: "merge_into",
        novel_issue_id: "x",
        reason: "y",
      });
      const parsed: CoordinatorDecision = parse_coordinator_decision(
        JSON.parse(wire),
      );
      const expected: DecisionMergeInto = {
        kind: "merge_into",
        novel_issue_id: "x",
        reason: "y",
      };
      expect(parsed).toEqual(expected);
    });

    it("register_new via JSON.parse", () => {
      const wire = JSON.stringify({
        kind: "register_new",
        canonical_name: "X",
        root_cause: "Y",
        reason: "Z",
      });
      expect(parse_coordinator_decision(JSON.parse(wire))).toEqual({
        kind: "register_new",
        canonical_name: "X",
        root_cause: "Y",
        reason: "Z",
      });
    });

    it("flag via JSON.parse", () => {
      const wire = JSON.stringify({ kind: "flag", reason: "x" });
      expect(parse_coordinator_decision(JSON.parse(wire))).toEqual({
        kind: "flag",
        reason: "x",
      });
    });
  });
});
