import { describe, expect, it } from "vitest";

import {
  parse_triage_verdict,
  type TriageVerdict,
  type VerdictFpClassifierRegression,
  type VerdictFpNovelCited,
  type VerdictFpNovelNew,
  type VerdictTp,
  type VerdictUncertain,
} from "./triage_verdict.js";

describe("parse_triage_verdict", () => {
  describe("round-trip every verdict kind", () => {
    it("tp", () => {
      const verdict: VerdictTp = {
        kind: "tp",
        member_evidence: { file: "src/a.ts", line: 12, why: "not called anywhere" },
      };
      expect(parse_triage_verdict(verdict)).toEqual(verdict);
    });

    it("fp-novel-new", () => {
      const verdict: VerdictFpNovelNew = {
        kind: "fp-novel-new",
        proposed_root_cause: "framework registers route via decorator",
        evidence_excerpt: "@route('/x') public handler() { ... }",
        member_evidence: { file: "src/routes.ts", line: 7, why: "decorator-registered route" },
      };
      expect(parse_triage_verdict(verdict)).toEqual(verdict);
    });

    it("fp-novel-cited", () => {
      const verdict: VerdictFpNovelCited = {
        kind: "fp-novel-cited",
        novel_issue_id: "decorator-route-registration",
        evidence_excerpt: "@route('/y') public other() { ... }",
      };
      expect(parse_triage_verdict(verdict)).toEqual(verdict);
    });

    it("fp-classifier-regression", () => {
      const verdict: VerdictFpClassifierRegression = {
        kind: "fp-classifier-regression",
        should_have_matched_rule_id: "test-fixture-export",
        evidence_excerpt: "export const fixture = { ... }",
        member_evidence: { file: "tests/fixtures/x.ts", line: 1, why: "test fixture file" },
      };
      expect(parse_triage_verdict(verdict)).toEqual(verdict);
    });

    it("uncertain", () => {
      const verdict: VerdictUncertain = {
        kind: "uncertain",
        reason: "compounding gaps; could be either decorator or DI container",
        member_evidence: { file: "src/handler.ts", line: 22, why: "ambiguous registration site" },
      };
      expect(parse_triage_verdict(verdict)).toEqual(verdict);
    });

    it("preserves discriminated-union narrowing on parsed result", () => {
      const raw: unknown = {
        kind: "tp",
        member_evidence: { file: "src/a.ts", line: 1, why: "unused export" },
      };
      const parsed: TriageVerdict = parse_triage_verdict(raw);
      // Type-level: narrowing on `kind` reveals payload shape.
      if (parsed.kind === "tp") {
        expect(parsed.member_evidence.file).toEqual("src/a.ts");
      } else {
        throw new Error("expected tp");
      }
    });
  });

  describe("rejects malformed inputs", () => {
    it("rejects non-object", () => {
      expect(() => parse_triage_verdict(null)).toThrow(/expected object/);
      expect(() => parse_triage_verdict(42)).toThrow(/expected object/);
      expect(() => parse_triage_verdict("verdict")).toThrow(/expected object/);
      expect(() => parse_triage_verdict([])).toThrow(/expected object/);
    });

    it("rejects missing kind", () => {
      expect(() => parse_triage_verdict({ member_evidence: {} })).toThrow(
        /'kind' must be a string/,
      );
    });

    it("rejects non-string kind", () => {
      expect(() => parse_triage_verdict({ kind: 123 })).toThrow(
        /'kind' must be a string, got number/,
      );
      expect(() => parse_triage_verdict({ kind: null })).toThrow(
        /'kind' must be a string, got null/,
      );
    });

    it("rejects unknown kind", () => {
      expect(() => parse_triage_verdict({ kind: "fp" })).toThrow(/unknown kind 'fp'/);
    });

    it("rejects missing required payload field", () => {
      // tp without member_evidence
      expect(() => parse_triage_verdict({ kind: "tp" })).toThrow(
        /missing required field 'member_evidence'/,
      );
      // fp-novel-new missing evidence_excerpt
      expect(() =>
        parse_triage_verdict({
          kind: "fp-novel-new",
          proposed_root_cause: "x",
          member_evidence: { file: "a", line: 1, why: "y" },
        }),
      ).toThrow(/missing required field 'evidence_excerpt'/);
      // fp-novel-cited missing novel_issue_id
      expect(() =>
        parse_triage_verdict({ kind: "fp-novel-cited", evidence_excerpt: "x" }),
      ).toThrow(/missing required field 'novel_issue_id'/);
      // fp-classifier-regression missing should_have_matched_rule_id
      expect(() =>
        parse_triage_verdict({
          kind: "fp-classifier-regression",
          evidence_excerpt: "x",
          member_evidence: { file: "a", line: 1, why: "y" },
        }),
      ).toThrow(/missing required field 'should_have_matched_rule_id'/);
      // uncertain missing reason
      expect(() =>
        parse_triage_verdict({
          kind: "uncertain",
          member_evidence: { file: "a", line: 1, why: "y" },
        }),
      ).toThrow(/missing required field 'reason'/);
    });

    it("rejects unexpected extra field", () => {
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: "a", line: 1, why: "y" },
          stowaway: 1,
        }),
      ).toThrow(/unexpected field 'stowaway'/);
    });

    it("rejects empty-string fields", () => {
      expect(() =>
        parse_triage_verdict({
          kind: "fp-novel-new",
          proposed_root_cause: "",
          evidence_excerpt: "x",
          member_evidence: { file: "a", line: 1, why: "y" },
        }),
      ).toThrow(/proposed_root_cause: must be non-empty/);
    });

    it("rejects malformed member_evidence", () => {
      // missing field
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: "a", line: 1 },
        }),
      ).toThrow(/member_evidence: missing required field 'why'/);
      // empty file
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: "", line: 1, why: "y" },
        }),
      ).toThrow(/member_evidence.file: must be non-empty/);
      // non-string file
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: 42, line: 1, why: "y" },
        }),
      ).toThrow(/member_evidence.file: must be a string, got number/);
      // non-integer line
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: "a", line: 1.5, why: "y" },
        }),
      ).toThrow(/member_evidence.line: must be a positive integer/);
      // negative line
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: "a", line: 0, why: "y" },
        }),
      ).toThrow(/member_evidence.line: must be a positive integer/);
      // non-number line
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: "a", line: "5", why: "y" },
        }),
      ).toThrow(/member_evidence.line: must be a positive integer, got string/);
      // empty why
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: { file: "a", line: 1, why: "" },
        }),
      ).toThrow(/member_evidence.why: must be non-empty/);
      // wrong type
      expect(() =>
        parse_triage_verdict({
          kind: "tp",
          member_evidence: "not an object",
        }),
      ).toThrow(/member_evidence: expected object/);
    });
  });
});
