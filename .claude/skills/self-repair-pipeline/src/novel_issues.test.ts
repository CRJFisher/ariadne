import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  add_citation,
  read_novel_issues,
  register_issue,
  write_novel_issues,
  type NovelIssue,
  type NovelIssueCitation,
  type NovelIssuesFile,
} from "./novel_issues.js";

const EMPTY_FILE: NovelIssuesFile = { issues: [] };

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
      };
      await write_novel_issues(target, file);
      const out = await read_novel_issues(target);
      expect(out).toEqual(file);
    });

    it("rejects malformed JSON", async () => {
      await fs.writeFile(target, "{ not json", "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow();
    });

    it("rejects malformed shape", async () => {
      await fs.writeFile(target, JSON.stringify({ issues: [{ id: "x" }] }), "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow(
        /missing required field 'canonical_name'/,
      );
    });

    it("rejects extra unknown fields", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({ issues: [], extra: 1 }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(/unexpected field 'extra'/);
    });

    it("rejects negative entry_index", async () => {
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
        }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /entry_index: must be a non-negative integer, got number/,
      );
    });

    it("rejects non-array issues field", async () => {
      await fs.writeFile(target, JSON.stringify({ issues: "x" }), "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow(
        /novel_issues.issues: expected array, got string/,
      );
    });

    it("rejects non-array citations field", async () => {
      await fs.writeFile(
        target,
        JSON.stringify({
          issues: [
            { id: "x", canonical_name: "X", root_cause: "y", citations: "z" },
          ],
        }),
        "utf8",
      );
      await expect(read_novel_issues(target)).rejects.toThrow(
        /citations: expected array, got string/,
      );
    });

    it("rejects non-object issue entry", async () => {
      await fs.writeFile(target, JSON.stringify({ issues: [42] }), "utf8");
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
      };
      await fs.writeFile(target, JSON.stringify(dup), "utf8");
      await expect(read_novel_issues(target)).rejects.toThrow(
        /novel_issues: duplicate id 'x'/,
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
    const seed: NovelIssuesFile = { issues: [seed_issue] };

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
      };
      expect(next).toEqual(expected);
      // Input unchanged
      expect(seed).toEqual({ issues: [seed_issue] });
      // Returned object is a new reference (no in-place mutation)
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
      const expected_file: NovelIssuesFile = { issues: [expected_issue] };
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
      // Construct a file where base is taken but suffix -2 is also taken;
      // expect -3 picked (lowest free). Then a follow-up registers -4.
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
      const seed: NovelIssuesFile = { issues: [] };
      register_issue(seed, {
        canonical_name: "X",
        root_cause: "y",
        initial_citation: { entry_index: 0, evidence_excerpt: "z" },
      });
      expect(seed).toEqual({ issues: [] });
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

  describe("write_boundary contract: novel_issues.json is the dispatcher's surface", () => {
    it("a full dispatch cycle (register → add → write → read) round-trips", async () => {
      const reg = register_issue(EMPTY_FILE, {
        canonical_name: "Decorator route registration",
        root_cause: "framework registers route via decorator",
        initial_citation: { entry_index: 4, evidence_excerpt: "@route('/x')" },
      });
      const cited = add_citation(reg.file, reg.issue.id, {
        entry_index: 7,
        evidence_excerpt: "@route('/y')",
      });
      await write_novel_issues(target, cited);
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
      };
      expect(read).toEqual(expected);
    });
  });
});
