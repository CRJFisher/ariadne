import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EMPTY_NOVEL_ISSUES_FILE,
  add_citation,
  find_flagged,
  find_issue_citing,
  flag_verdict,
  read_novel_issues,
  register_issue,
  write_novel_issues,
  type FlaggedVerdict,
  type NovelIssue,
  type NovelIssueCitation,
  type NovelIssuesFile,
} from "./novel_issues.js";
import type { VerdictFpNovelCited, VerdictFpNovelNew } from "../verdict/triage_verdict.js";

const EMPTY_FILE: NovelIssuesFile = EMPTY_NOVEL_ISSUES_FILE;

const FIXTURE_VERDICT_NEW: VerdictFpNovelNew = {
  kind: "fp-novel-new",
  proposed_root_cause: "framework registers route via decorator",
  evidence_excerpt: "@route('/x')",
  member_evidence: { file: "src/r.ts", line: 7, why: "decorator-registered" },
};

const FIXTURE_VERDICT_CITED: VerdictFpNovelCited = {
  kind: "fp-novel-cited",
  novel_issue_id: "decorator-route",
  evidence_excerpt: "@route('/y')",
};

describe("novel_issues storage", () => {
  let tmp_dir: string;
  let target: string;

  beforeEach(async () => {
    tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "novel-issues-"));
    target = path.join(tmp_dir, "novel_issues.json");
  });

  afterEach(async () => {
    await fs.rm(tmp_dir, { recursive: true, force: true });
  });

  describe("read_novel_issues", () => {
    it("returns empty file when path does not exist", async () => {
      const out = await read_novel_issues(target);
      expect(out).toEqual(EMPTY_FILE);
    });

    it("round-trips a written file", async () => {
      const file: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route",
            canonical_name: "Decorator route registration",
            root_cause: "@route decorator registers handler dynamically",
            citations: [{ entry_index: 4, evidence_excerpt: "@route('/x')" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(target, file);
      const out = await read_novel_issues(target);
      expect(out).toEqual(file);
    });

    it("round-trips a file containing flagged verdicts", async () => {
      const file: NovelIssuesFile = {
        issues: [],
        flagged: [
          {
            entry_index: 11,
            verdict: FIXTURE_VERDICT_NEW,
            reason: "compound gaps; surfaced for human review",
          },
        ],
      };
      await write_novel_issues(target, file);
      expect(await read_novel_issues(target)).toEqual(file);
    });

    it("rejects malformed JSON", async () => {
      await fs.writeFile(target, "{ not json", "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow();
    });

    it("rejects shape missing flagged field", async () => {
      await fs.writeFile(target, JSON.stringify({ issues: [] }), "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow(
        /missing required field 'flagged'/,
      );
    });

    it("rejects malformed issue shape", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({ issues: [{ id: "x" }], flagged: [] }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /missing required field 'canonical_name'/,
      );
    });

    it("rejects extra unknown fields", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({ issues: [], flagged: [], extra: 1 }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(/unexpected field 'extra'/);
    });

    it("rejects negative entry_index in citations", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({
          issues: [
            {
              id: "x",
              canonical_name: "X",
              root_cause: "y",
              citations: [{ entry_index: -1, evidence_excerpt: "z" }],
            },
          ],
          flagged: [],
        }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /entry_index: must be a non-negative integer/,
      );
    });

    it("rejects non-integer entry_index", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({
          issues: [
            {
              id: "x",
              canonical_name: "X",
              root_cause: "y",
              citations: [{ entry_index: 1.5, evidence_excerpt: "z" }],
            },
          ],
          flagged: [],
        }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /entry_index: must be a non-negative integer, got number/,
      );
    });

    it("rejects non-array issues field", async () => {
      await fs.writeFile(target, JSON.stringify({ issues: "x", flagged: [] }), "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow(
        /novel_issues.issues: expected array, got string/,
      );
    });

    it("rejects non-array flagged field", async () => {
      await fs.writeFile(target, JSON.stringify({ issues: [], flagged: "x" }), "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow(
        /novel_issues.flagged: expected array, got string/,
      );
    });

    it("rejects non-array citations field", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({
          issues: [
            { id: "x", canonical_name: "X", root_cause: "y", citations: "z" },
          ],
          flagged: [],
        }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /citations: expected array, got string/,
      );
    });

    it("rejects non-object issue entry", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({ issues: [42], flagged: [] }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /novel_issues.issues\[0\]: expected object, got number/,
      );
    });

    it("rejects duplicate ids", async () => {
      const dup: NovelIssuesFile = {
        issues: [
          {
            id: "x",
            canonical_name: "X1",
            root_cause: "a",
            citations: [{ entry_index: 0, evidence_excerpt: "e" }],
          },
          {
            id: "x",
            canonical_name: "X2",
            root_cause: "b",
            citations: [{ entry_index: 1, evidence_excerpt: "f" }],
          },
        ],
        flagged: [],
      };
      await fs.writeFile(target, JSON.stringify(dup), "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow(
        /novel_issues: duplicate id 'x'/,
      );
    });

    it("rejects flagged entry with non-novel verdict kind", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({
          issues: [],
          flagged: [
            {
              entry_index: 0,
              verdict: {
                kind: "tp",
                member_evidence: { file: "x", line: 1, why: "y" },
              },
              reason: "should not be stored as flagged",
            },
          ],
        }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /kind 'tp' is not a novel verdict/,
      );
    });
  });

  describe("write_novel_issues", () => {
    it("uses atomic temp+rename — no temp files remain after success", async () => {
      await write_novel_issues(target, EMPTY_FILE);
      const entries = await fs.readdir(tmp_dir);
      expect(entries).toEqual(["novel_issues.json"]);
    });

    it("overwrites existing content", async () => {
      await write_novel_issues(target, EMPTY_FILE);
      const next: NovelIssuesFile = {
        issues: [
          {
            id: "x",
            canonical_name: "X",
            root_cause: "y",
            citations: [{ entry_index: 0, evidence_excerpt: "z" }],
          },
        ],
        flagged: [],
      };
      await write_novel_issues(target, next);
      expect(await read_novel_issues(target)).toEqual(next);
    });

    it("writes trailing newline", async () => {
      await write_novel_issues(target, EMPTY_FILE);
      const raw = await fs.readFile(target, "utf8");
      expect(raw.endsWith("\n")).toEqual(true);
    });
  });

  describe("add_citation", () => {
    const seed_issue: NovelIssue = {
      id: "decorator-route",
      canonical_name: "Decorator route registration",
      root_cause: "framework registers route via decorator",
      citations: [{ entry_index: 1, evidence_excerpt: "@route('/x')" }],
    };
    const seed: NovelIssuesFile = { issues: [seed_issue], flagged: [] };

    it("appends a new citation without mutating input", () => {
      const new_citation: NovelIssueCitation = {
        entry_index: 2,
        evidence_excerpt: "@route('/y')",
      };
      const next = add_citation(seed, "decorator-route", new_citation);
      const expected: NovelIssuesFile = {
        issues: [
          {
            ...seed_issue,
            citations: [...seed_issue.citations, new_citation],
          },
        ],
        flagged: [],
      };
      expect(next).toEqual(expected);
      expect(seed).toEqual({ issues: [seed_issue], flagged: [] });
      expect(next).not.toBe(seed);
      expect(next.issues[0]).not.toBe(seed.issues[0]);
    });

    it("is idempotent — re-adding same entry_index is a no-op (returns same file)", () => {
      const dup_citation: NovelIssueCitation = {
        entry_index: 1,
        evidence_excerpt: "different excerpt but same entry",
      };
      const next = add_citation(seed, "decorator-route", dup_citation);
      expect(next).toEqual(seed);
      expect(next).toBe(seed);
    });

    it("throws when novel_issue_id is not registered", () => {
      expect(() =>
        add_citation(seed, "nonexistent", {
          entry_index: 9,
          evidence_excerpt: "x",
        }),
      ).toThrow(/novel_issue_id 'nonexistent' is not registered/);
    });

    it("preserves the flagged array unchanged", () => {
      const seed_with_flagged: NovelIssuesFile = {
        issues: [seed_issue],
        flagged: [
          {
            entry_index: 99,
            verdict: FIXTURE_VERDICT_NEW,
            reason: "pre-existing flag",
          },
        ],
      };
      const next = add_citation(seed_with_flagged, "decorator-route", {
        entry_index: 5,
        evidence_excerpt: "z",
      });
      expect(next.flagged).toEqual(seed_with_flagged.flagged);
      expect(next.flagged).toBe(seed_with_flagged.flagged);
    });
  });

  describe("register_issue", () => {
    it("registers a new issue with slugified id and seeded citation", () => {
      const result = register_issue(EMPTY_FILE, {
        canonical_name: "Decorator Route Registration",
        root_cause: "framework registers route via decorator",
        initial_citation: { entry_index: 4, evidence_excerpt: "@route('/x')" },
      });
      const expected_issue: NovelIssue = {
        id: "decorator-route-registration",
        canonical_name: "Decorator Route Registration",
        root_cause: "framework registers route via decorator",
        citations: [{ entry_index: 4, evidence_excerpt: "@route('/x')" }],
      };
      const expected_file: NovelIssuesFile = {
        issues: [expected_issue],
        flagged: [],
      };
      expect(result.file).toEqual(expected_file);
      expect(result.issue).toEqual(expected_issue);
    });

    it("appends numeric suffix to disambiguate id collisions", () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route",
            canonical_name: "Decorator route",
            root_cause: "x",
            citations: [{ entry_index: 0, evidence_excerpt: "z" }],
          },
        ],
        flagged: [],
      };
      const a = register_issue(seed, {
        canonical_name: "Decorator route",
        root_cause: "y",
        initial_citation: { entry_index: 1, evidence_excerpt: "w" },
      });
      expect(a.issue.id).toEqual("decorator-route-2");

      const b = register_issue(a.file, {
        canonical_name: "Decorator route",
        root_cause: "z",
        initial_citation: { entry_index: 2, evidence_excerpt: "w" },
      });
      expect(b.issue.id).toEqual("decorator-route-3");
    });

    it("picks the lowest free suffix when existing ids are non-contiguous", () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "x",
            canonical_name: "X",
            root_cause: "a",
            citations: [{ entry_index: 0, evidence_excerpt: "e" }],
          },
          {
            id: "x-2",
            canonical_name: "X",
            root_cause: "b",
            citations: [{ entry_index: 1, evidence_excerpt: "e" }],
          },
        ],
        flagged: [],
      };
      const next = register_issue(seed, {
        canonical_name: "X",
        root_cause: "c",
        initial_citation: { entry_index: 2, evidence_excerpt: "e" },
      });
      expect(next.issue.id).toEqual("x-3");
    });

    it("rejects canonical_name with no slug-safe characters", () => {
      expect(() =>
        register_issue(EMPTY_FILE, {
          canonical_name: "!!!",
          root_cause: "x",
          initial_citation: { entry_index: 0, evidence_excerpt: "y" },
        }),
      ).toThrow(/contains no slug-safe characters/);
    });

    it("does not mutate the input file", () => {
      const seed: NovelIssuesFile = { issues: [], flagged: [] };
      register_issue(seed, {
        canonical_name: "X",
        root_cause: "y",
        initial_citation: { entry_index: 0, evidence_excerpt: "z" },
      });
      expect(seed).toEqual({ issues: [], flagged: [] });
    });

    it("preserves the flagged array unchanged", () => {
      const seed: NovelIssuesFile = {
        issues: [],
        flagged: [
          {
            entry_index: 7,
            verdict: FIXTURE_VERDICT_CITED,
            reason: "ambiguous",
          },
        ],
      };
      const result = register_issue(seed, {
        canonical_name: "X",
        root_cause: "y",
        initial_citation: { entry_index: 0, evidence_excerpt: "z" },
      });
      expect(result.file.flagged).toEqual(seed.flagged);
      expect(result.file.flagged).toBe(seed.flagged);
    });

    it("rejects empty canonical_name", () => {
      expect(() =>
        register_issue(EMPTY_FILE, {
          canonical_name: "",
          root_cause: "y",
          initial_citation: { entry_index: 0, evidence_excerpt: "z" },
        }),
      ).toThrow(/canonical_name must be non-empty/);
    });

    it("rejects empty root_cause", () => {
      expect(() =>
        register_issue(EMPTY_FILE, {
          canonical_name: "X",
          root_cause: "",
          initial_citation: { entry_index: 0, evidence_excerpt: "z" },
        }),
      ).toThrow(/root_cause must be non-empty/);
    });
  });

  describe("flag_verdict", () => {
    it("appends a new flagged entry without mutating input", () => {
      const flagged: FlaggedVerdict = {
        entry_index: 11,
        verdict: FIXTURE_VERDICT_NEW,
        reason: "compound gaps",
      };
      const next = flag_verdict(EMPTY_FILE, flagged);
      expect(next).toEqual({ issues: [], flagged: [flagged] });
      expect(EMPTY_FILE).toEqual({ issues: [], flagged: [] });
      expect(next).not.toBe(EMPTY_FILE);
    });

    it("is idempotent — re-flagging same entry_index returns same file reference", () => {
      const flagged: FlaggedVerdict = {
        entry_index: 11,
        verdict: FIXTURE_VERDICT_NEW,
        reason: "compound gaps",
      };
      const once = flag_verdict(EMPTY_FILE, flagged);
      const twice = flag_verdict(once, {
        ...flagged,
        reason: "different reason but same entry",
      });
      expect(twice).toBe(once);
    });

    it("preserves the issues array unchanged", () => {
      const seed: NovelIssuesFile = {
        issues: [
          {
            id: "x",
            canonical_name: "X",
            root_cause: "y",
            citations: [{ entry_index: 0, evidence_excerpt: "z" }],
          },
        ],
        flagged: [],
      };
      const next = flag_verdict(seed, {
        entry_index: 11,
        verdict: FIXTURE_VERDICT_NEW,
        reason: "z",
      });
      expect(next.issues).toBe(seed.issues);
    });
  });

  describe("find_issue_citing", () => {
    const seed: NovelIssuesFile = {
      issues: [
        {
          id: "a",
          canonical_name: "A",
          root_cause: "a",
          citations: [
            { entry_index: 1, evidence_excerpt: "e1" },
            { entry_index: 2, evidence_excerpt: "e2" },
          ],
        },
        {
          id: "b",
          canonical_name: "B",
          root_cause: "b",
          citations: [{ entry_index: 7, evidence_excerpt: "e7" }],
        },
      ],
      flagged: [],
    };

    it("returns the issue whose citations include entry_index", () => {
      expect(find_issue_citing(seed, 2)).toEqual(seed.issues[0]);
      expect(find_issue_citing(seed, 7)).toEqual(seed.issues[1]);
    });

    it("returns null when no issue cites entry_index", () => {
      expect(find_issue_citing(seed, 99)).toEqual(null);
    });

    it("returns null on an empty file", () => {
      expect(find_issue_citing(EMPTY_FILE, 0)).toEqual(null);
    });
  });

  describe("find_flagged", () => {
    const seed: NovelIssuesFile = {
      issues: [],
      flagged: [
        {
          entry_index: 11,
          verdict: FIXTURE_VERDICT_NEW,
          reason: "ambiguous",
        },
      ],
    };

    it("returns the flagged entry for entry_index", () => {
      expect(find_flagged(seed, 11)).toEqual(seed.flagged[0]);
    });

    it("returns null when entry_index is not flagged", () => {
      expect(find_flagged(seed, 0)).toEqual(null);
    });
  });

  describe("write_boundary contract: novel_issues.json is the dispatcher's surface", () => {
    it("a full dispatch cycle (register → add → flag → write → read) round-trips", async () => {
      const reg = register_issue(EMPTY_FILE, {
        canonical_name: "Decorator route registration",
        root_cause: "framework registers route via decorator",
        initial_citation: { entry_index: 4, evidence_excerpt: "@route('/x')" },
      });
      const cited = add_citation(reg.file, reg.issue.id, {
        entry_index: 7,
        evidence_excerpt: "@route('/y')",
      });
      const flagged = flag_verdict(cited, {
        entry_index: 11,
        verdict: FIXTURE_VERDICT_NEW,
        reason: "compound gaps",
      });
      await write_novel_issues(target, flagged);
      const read = await read_novel_issues(target);
      const expected: NovelIssuesFile = {
        issues: [
          {
            id: "decorator-route-registration",
            canonical_name: "Decorator route registration",
            root_cause: "framework registers route via decorator",
            citations: [
              { entry_index: 4, evidence_excerpt: "@route('/x')" },
              { entry_index: 7, evidence_excerpt: "@route('/y')" },
            ],
          },
        ],
        flagged: [
          {
            entry_index: 11,
            verdict: FIXTURE_VERDICT_NEW,
            reason: "compound gaps",
          },
        ],
      };
      expect(read).toEqual(expected);
    });
  });
});
