import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { BENCHMARK_SUITE_DIR, load_benchmark_suite } from "../load_benchmark_suite.js";
import { assemble_review_case } from "./assemble_review_case.js";
import { ReviewChatStore, case_briefing, reviewer_message, tool_detail, tutor_system_prompt } from "./review_chat.js";
import { build_review_glossary } from "./review_glossary.js";

const suite = load_benchmark_suite();
const glossary = build_review_glossary(BENCHMARK_SUITE_DIR, suite.registry_snapshot);

describe("reviewer_message", () => {
  it("carries the draft and the page selection with the question", () => {
    expect(reviewer_message("Is there a caller?", { draft: "leaning fp-novel", selection: "  applyStatics(d)  " })).toEqual(
      "Reviewer's current draft: leaning fp-novel\n\nText the reviewer has selected on the page:\n\"\"\"\napplyStatics(d)\n\"\"\"\n\nQuestion: Is there a caller?",
    );
  });

  it("omits an empty selection", () => {
    expect(reviewer_message("Why?", { draft: "none", selection: " " })).toEqual(
      "Reviewer's current draft: none\n\nQuestion: Why?",
    );
  });
});

describe("tool_detail", () => {
  it("shows the command or file a tool call touched", () => {
    expect(tool_detail({ command: "grep -rn x .", description: "d" })).toEqual("grep -rn x .");
    expect(tool_detail({ file_path: "/a/b.js", limit: 10 })).toEqual("/a/b.js");
    expect(tool_detail("raw")).toEqual("");
  });
});

describe("tutor_system_prompt", () => {
  it("states every verdict definition and the repository it may read", () => {
    const prompt = tutor_system_prompt(glossary, "/repo/ariadne");
    expect(Object.values(glossary.kinds).every((text) => prompt.includes(text))).toEqual(true);
    expect(prompt.includes("Ariadne's own repository is at /repo/ariadne")).toEqual(true);
  });
});

describe("case_briefing", () => {
  it("names the entry, the label and the in-scope rules", () => {
    const labelled = suite.cases.find((c) => c.case.case_id === "Automattic--mongoose__applyStatics__L9");
    if (labelled === undefined) throw new Error("fixture case missing from the suite");
    const review = assemble_review_case({
      labelled,
      clone_dir: path.join(os.homedir(), ".ariadne/triage-entrypoints/repos/Automattic--mongoose"),
      model_runs: [],
      rules: suite.registry_snapshot,
      gold_rules: new Map(),
    });
    const briefing = case_briefing(review, glossary);
    expect(briefing.split("\n").slice(0, 3)).toEqual([
      "# Case Automattic--mongoose__applyStatics__L9",
      "",
      `Entry: function \`applyStatics\` at lib/helpers/model/applyStatics.js:9 in Automattic/mongoose @ 3e212ce (javascript); exported: ${review.entry.is_exported}.`,
    ]);
    expect(review.rules.every((r) => briefing.includes(`- ${r.group_id}: ${r.title}.`))).toEqual(true);
    expect(briefing.includes("- lib/model.js:1044")).toEqual(true);
  });
});

describe("ReviewChatStore", () => {
  let dir: string;
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("starts a case with no session and keeps what it is given", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-chat-"));
    const store = new ReviewChatStore(dir);
    expect(store.read("c1")).toEqual({ case_id: "c1", session_id: null, turns: [], usd: 0 });
    const transcript = {
      case_id: "c1",
      session_id: "s1",
      turns: [{ role: "user" as const, text: "q", tools: [], at: "t" }],
      usd: 0.02,
    };
    store.write(transcript);
    expect(store.read("c1")).toEqual(transcript);
    store.clear("c1");
    expect(store.read("c1").session_id).toEqual(null);
  });
});
