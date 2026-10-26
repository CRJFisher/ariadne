import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  parse_case_review,
  read_human_review,
  write_case_review,
  type CaseReview,
} from "./human_review_store.js";

const AGREE: CaseReview = {
  decision: "agree",
  chosen: { kind: "fp-classifier-regression", rule_id: "rule-x" },
  agreed_with: ["claude-haiku-4-5", "opus-label"],
  also_acceptable: ["fp-novel"],
  walkthrough: { real_caller: "yes", reaches_definition: "yes", rule_covers: "unsure" },
  feedback: null,
  notes: "",
  reviewed_at: "2026-10-25T15:00:00.000Z",
};

const NONE_FITS: CaseReview = {
  ...AGREE,
  decision: "none-fits",
  chosen: null,
  agreed_with: [],
  also_acceptable: [],
  feedback: { target: "classifier-rule", rule_id: "rule-x", problem: "scope is arguable", proposal: "narrow it" },
};

describe("parse_case_review", () => {
  it("accepts an agreeing vote and a none-fits vote", () => {
    expect(parse_case_review(AGREE, "c1")).toEqual(AGREE);
    expect(parse_case_review(NONE_FITS, "c1")).toEqual(NONE_FITS);
  });

  it("accepts an undecided draft carrying only walkthrough answers", () => {
    const draft: CaseReview = { ...AGREE, decision: null, chosen: null, agreed_with: [], also_acceptable: [] };
    expect(parse_case_review(draft, "c1")).toEqual(draft);
  });

  it("requires a rule exactly for a regression verdict", () => {
    expect(() => parse_case_review({ ...AGREE, chosen: { kind: "fp-classifier-regression", rule_id: null } }, "c1")).toThrow(
      "review c1: chosen.rule_id is required exactly for a fp-classifier-regression verdict",
    );
    expect(() => parse_case_review({ ...AGREE, chosen: { kind: "tp", rule_id: "rule-x" } }, "c1")).toThrow(
      "review c1: chosen.rule_id is required exactly for a fp-classifier-regression verdict",
    );
  });

  it("requires feedback for a none-fits vote", () => {
    expect(() => parse_case_review({ ...NONE_FITS, feedback: null }, "c1")).toThrow(
      "review c1: a none-fits decision requires feedback",
    );
  });

  it("requires feedback to say what does not fit", () => {
    expect(() =>
      parse_case_review({ ...NONE_FITS, feedback: { ...NONE_FITS.feedback, problem: "  " } }, "c1"),
    ).toThrow("review c1: feedback.problem must say what does not fit");
  });

  it("rejects a chosen verdict on an undecided review", () => {
    expect(() => parse_case_review({ ...AGREE, decision: null }, "c1")).toThrow(
      "review c1: chosen is required exactly when decision is agree",
    );
  });

  it("rejects an also-acceptable kind that repeats the chosen one", () => {
    expect(() => parse_case_review({ ...AGREE, also_acceptable: ["fp-classifier-regression"] }, "c1")).toThrow(
      "review c1: also_acceptable repeats the chosen kind",
    );
  });

  it("rejects an unknown walkthrough answer", () => {
    expect(() =>
      parse_case_review({ ...AGREE, walkthrough: { ...AGREE.walkthrough, rule_covers: "maybe" } }, "c1"),
    ).toThrow("review c1: walkthrough.rule_covers must be yes, no, unsure or null");
  });
});

describe("human review file", () => {
  let dir: string;
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("starts empty and stores each case's review", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-review-"));
    expect(read_human_review(dir).reviews).toEqual({});
    write_case_review(dir, new Set(["c1", "c2"]), "c1", AGREE);
    write_case_review(dir, new Set(["c1", "c2"]), "c2", NONE_FITS);
    expect(read_human_review(dir).reviews).toEqual({ c1: AGREE, c2: NONE_FITS });
  });

  it("refuses a review for a case outside the suite", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-review-"));
    expect(() => write_case_review(dir, new Set(["c1"]), "zz", AGREE)).toThrow("review zz: no such case in the suite");
  });
});
