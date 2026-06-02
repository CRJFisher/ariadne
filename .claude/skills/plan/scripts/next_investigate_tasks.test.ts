import { describe, expect, it } from "vitest";

import type { DispatchEntry } from "./next_investigate_tasks.js";

function dispatch(novel_issue_id: string, output_suffix = ""): DispatchEntry {
  return {
    run_path: `/runs/${novel_issue_id}.json`,
    novel_issue_id,
    output_path: `/out/${novel_issue_id}${output_suffix}.json`,
    get_context_cmd: `cmd ${novel_issue_id}`,
  };
}

describe("DispatchEntry", () => {
  it("carries the four canonical dispatch fields", () => {
    const entry = dispatch("a");
    expect(entry).toEqual({
      run_path: "/runs/a.json",
      novel_issue_id: "a",
      output_path: "/out/a.json",
      get_context_cmd: "cmd a",
    });
  });
});

describe("dedupe by output_path (puller invariant)", () => {
  it("treats identical output_paths as the same dispatch", () => {
    const a = dispatch("a");
    const a_dup = dispatch("a");
    const map = new Map<string, DispatchEntry>();
    map.set(a.output_path, a);
    map.set(a_dup.output_path, a_dup);
    expect(map.size).toBe(1);
  });

  it("preserves entries with distinct output_paths", () => {
    const a = dispatch("a");
    const b = dispatch("b");
    const map = new Map<string, DispatchEntry>();
    map.set(a.output_path, a);
    map.set(b.output_path, b);
    expect(map.size).toBe(2);
  });
});
