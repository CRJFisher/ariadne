import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GREP_MATCH_CAP,
  READ_LINE_CAP,
  accept_verdict,
  grep_repository,
  read_window,
  resolve_in_root,
  type SubmittedVerdict,
} from "./investigation_tools.js";

let root: string;

function write(relative: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), content);
}

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "triage-tools-")));
  write("src/app.py", ["def handler(req):", "    return dispatch(req)", "", "ROUTES = {'x': handler}"].join("\n"));
  write("src/lib/dispatch.py", "def dispatch(req):\n    return req\n");
  write("docs/notes.md", "handler is registered in ROUTES\n");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("resolve_in_root", () => {
  it("resolves a relative or absolute path inside the root to its relative form", () => {
    expect(resolve_in_root(root, "src/app.py")).toEqual("src/app.py");
    expect(resolve_in_root(root, path.join(root, "src/app.py"))).toEqual("src/app.py");
  });

  it("refuses a path that leaves the root, directly or through a symlink", () => {
    expect(resolve_in_root(root, "../elsewhere.txt")).toEqual(null);
    fs.symlinkSync(os.tmpdir(), path.join(root, "escape"));
    expect(resolve_in_root(root, "escape")).toEqual(null);
  });
});

describe("read_window", () => {
  it("returns numbered lines from the offset", () => {
    expect(read_window(root, { path: "src/app.py", offset: 2, limit: 2 })).toEqual({
      ok: true,
      text: "2\t    return dispatch(req)\n3\t\n(lines 2-3 of 4; pass offset 4 to continue)",
    });
  });

  it(`never returns more than ${READ_LINE_CAP} lines`, () => {
    write("big.txt", Array.from({ length: READ_LINE_CAP + 50 }, (_, i) => `line ${i + 1}`).join("\n"));
    const result = read_window(root, { path: "big.txt" });
    const lines = result.text.split("\n");
    expect(lines.length).toEqual(READ_LINE_CAP + 1);
    expect(lines[READ_LINE_CAP]).toEqual(`(lines 1-${READ_LINE_CAP} of ${READ_LINE_CAP + 50}; pass offset ${READ_LINE_CAP + 1} to continue)`);
  });

  it("refuses a file outside the repository and reports a missing one", () => {
    expect(read_window(root, { path: "/etc/hosts" })).toEqual({ ok: false, text: "/etc/hosts is outside the repository." });
    expect(read_window(root, { path: "src/missing.py" })).toEqual({ ok: false, text: "src/missing.py does not exist." });
  });
});

describe.each([
  ["a git work tree", true],
  ["a plain directory", false],
])("grep_repository in %s", (_label, git) => {
  beforeEach(() => {
    if (git) execFileSync("git", ["init", "-q", root]);
  });

  it("returns path:line: text for every match", async () => {
    expect(await grep_repository(root, { pattern: "\\bhandler\\b" })).toEqual({
      ok: true,
      text: ["docs/notes.md:1: handler is registered in ROUTES", "src/app.py:1: def handler(req):", "src/app.py:4: ROUTES = {'x': handler}"].join("\n"),
    });
  });

  it("narrows to a directory and a glob", async () => {
    expect(await grep_repository(root, { pattern: "def \\w+", path: "src", glob: "*.py" })).toEqual({
      ok: true,
      text: ["src/app.py:1: def handler(req):", "src/lib/dispatch.py:1: def dispatch(req):"].join("\n"),
    });
  });

  it(`shows at most ${GREP_MATCH_CAP} matches and counts the rest`, async () => {
    write("many.txt", Array.from({ length: GREP_MATCH_CAP + 7 }, () => "needle").join("\n"));
    const result = await grep_repository(root, { pattern: "needle", path: "many.txt" });
    const lines = result.text.split("\n");
    expect(lines.length).toEqual(GREP_MATCH_CAP + 1);
    expect(lines[GREP_MATCH_CAP]).toEqual("… 7 more matches; narrow with path or glob");
  });

  it("reports no matches and refuses a scope outside the repository", async () => {
    expect(await grep_repository(root, { pattern: "nothing_matches_this" })).toEqual({ ok: true, text: "(no matches)" });
    expect(await grep_repository(root, { pattern: "x", path: "../" })).toEqual({ ok: false, text: "../ is outside the repository." });
  });
});

describe("accept_verdict", () => {
  const fp_novel: SubmittedVerdict = {
    kind: "fp-novel",
    member_evidence: { file: "src/app.py", line: 4, why: "registered in the ROUTES dispatch table" },
    evidence_excerpt: "ROUTES = {'x': handler}",
    proposed_root_cause: "A dict value dispatched through a computed key produces no call edge.",
  };

  it("accepts a well-formed verdict and normalises its evidence path", () => {
    expect(accept_verdict(root, { ...fp_novel, member_evidence: { ...fp_novel.member_evidence, file: path.join(root, "src/app.py") } }, [])).toEqual({
      verdict: {
        kind: "fp-novel",
        proposed_root_cause: "A dict value dispatched through a computed key produces no call edge.",
        evidence_excerpt: "ROUTES = {'x': handler}",
        member_evidence: { file: "src/app.py", line: 4, why: "registered in the ROUTES dispatch table" },
      },
    });
  });

  it("drops fields another kind uses", () => {
    expect(
      accept_verdict(root, { kind: "tp", member_evidence: { file: "src/app.py", line: 1, why: "no callers" }, reason: "stray" }, []),
    ).toEqual({ verdict: { kind: "tp", member_evidence: { file: "src/app.py", line: 1, why: "no callers" } } });
  });

  it("rejects a missing field, evidence that names no line of the repository, and an out-of-scope rule", () => {
    expect(accept_verdict(root, { ...fp_novel, proposed_root_cause: undefined }, [])).toEqual({
      error: "verdict(fp-novel): missing required field 'proposed_root_cause'",
    });
    expect(accept_verdict(root, { ...fp_novel, member_evidence: { ...fp_novel.member_evidence, file: "src/gone.py" } }, [])).toEqual({
      error: "member_evidence.file src/gone.py is not a file in the repository.",
    });
    expect(accept_verdict(root, { ...fp_novel, member_evidence: { ...fp_novel.member_evidence, line: 99 } }, [])).toEqual({
      error: "member_evidence.line 99 is past the end of src/app.py (4 lines).",
    });
    expect(
      accept_verdict(
        root,
        { kind: "fp-classifier-regression", member_evidence: fp_novel.member_evidence, evidence_excerpt: "x", should_have_matched_rule_id: "other-rule" },
        ["dict-dispatch"],
      ),
    ).toEqual({ error: "should_have_matched_rule_id other-rule is not an in-scope rule; in scope: dict-dispatch." });
  });
});
