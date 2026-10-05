/**
 * End-to-end boundary for the `untyped-attribute-receiver` interim classifier.
 *
 * Proves both sides of the narrowness contract against the real pipeline
 * (index → resolve → trace → enrich → classify):
 *
 * - Resolved side: TASK-350 Fix C types `self.<attr> = Constructor()`, so a
 *   method called on that attribute resolves and never surfaces as an entry
 *   point — the classifier never sees it.
 * - Residual side: an attribute that stays untyped (a plain constructor
 *   parameter, the pandas `self.obj` Cython-`object` shape) leaves the called
 *   method flagged, and the builtin classifier matches it via the real
 *   registry-rule → barrel lookup.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../project/project";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import { extract_entry_point_diagnostics } from "./extract_entry_point_diagnostics";
import { auto_classify } from "./auto_classify";
import type { FilePath, KnownIssue, KnownIssuesRegistry } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function setup_project(
  files: Record<string, string>,
): Promise<{ project: Project; file_paths: Record<string, FilePath> }> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-classify-"));
  temp_dirs.push(temp_dir);
  const file_paths: Record<string, FilePath> = {};
  for (const [relative_path, content] of Object.entries(files)) {
    const abs_path = path.join(temp_dir, relative_path);
    fs.mkdirSync(path.dirname(abs_path), { recursive: true });
    fs.writeFileSync(abs_path, content);
    file_paths[relative_path] = abs_path as FilePath;
  }
  const project = new Project();
  await project.initialize(temp_dir as FilePath);
  for (const [relative_path, content] of Object.entries(files)) {
    project.update_file(file_paths[relative_path], content);
  }
  return { project, file_paths };
}

function enrich(project: Project) {
  const call_graph = trace_call_graph(project.definitions, project.resolutions, project.get_languages(), {});
  return extract_entry_point_diagnostics(call_graph, project);
}

const read_file_lines = (file_path: string): readonly string[] =>
  fs.readFileSync(file_path, "utf8").split("\n");

// The rule as authored in the source registry. Constructed inline so the
// test stays independent of `.claude/skills`, but the implementation is resolved
// through the real `BUILTIN_CHECKS` barrel by `function_name`.
const UNTYPED_ATTRIBUTE_RECEIVER_RULE: KnownIssue = {
  group_id: "untyped-attribute-receiver",
  title: "Python method reached only via an untyped self-attribute receiver",
  description: "Classifier for the residual out-of-static-reach pandas row.",
  status: "permanent",
  languages: ["python"],
  examples: [],
  classifier: {
    function_name: "check_untyped_attribute_receiver",
    min_confidence: 0.9,
  },
};
const REGISTRY: KnownIssuesRegistry = [UNTYPED_ATTRIBUTE_RECEIVER_RULE];

describe("untyped-attribute-receiver classifier boundary", () => {
  it("Fix C resolves the typed-attribute receiver, so the member is not an entry point", async () => {
    const { project } = await setup_project({
      "resolved.py": `class DataFrame:
    def count(self):
        return 0


class Loader:
    def setup(self):
        self.df = DataFrame()

    def run(self):
        return self.df.count()
`,
    });

    const enriched = enrich(project);
    // `self.df = DataFrame()` lives in `setup()`, outside `__init__` — the shape
    // Fix C (TASK-350.2) promotes to a typed property. The typed receiver
    // resolves: count gains an incoming edge and never surfaces as an entry
    // point, so the classifier is never asked about it. (Revert Fix C — make
    // `df` an untyped param — and count reappears as an entry point.)
    expect(enriched.find((e) => e.name === "count")).toBeUndefined();
  });

  it("classifies the untyped self-attribute receiver residual via the registry rule", async () => {
    const { project } = await setup_project({
      "residual.py": `class DataFrame:
    def _set_value(self, k, v):
        return 0


class NDFrameIndexerBase:
    def __init__(self, obj):
        self.obj = obj


class _ScalarAccessIndexer(NDFrameIndexerBase):
    def __setitem__(self, key, value):
        self.obj._set_value(key, value)
`,
    });

    const enriched = enrich(project);
    const set_value = enriched.find((e) => e.name === "_set_value");
    // The untyped `self.obj` receiver leaves _set_value flagged as unreachable.
    expect(set_value).toBeDefined();

    const classified = auto_classify(enriched, REGISTRY, read_file_lines, project.get_languages());
    const set_value_result = classified.find(
      (c) => c.entry_point.name === "_set_value",
    );
    expect(set_value_result).toBeDefined();
    expect(set_value_result!.result).toEqual({
      auto_classified: true,
      auto_group_id: "untyped-attribute-receiver",
      reasoning:
        "Matched builtin classifier check_untyped_attribute_receiver for untyped-attribute-receiver",
      classifier_hints: [],
    });
  });

  it("does not classify a resolved member even when handed to the classifier", async () => {
    const { project } = await setup_project({
      "resolved.py": `class DataFrame:
    def count(self):
        return 0


class Loader:
    def setup(self):
        self.df = DataFrame()

    def run(self):
        return self.df.count()
`,
    });

    const enriched = enrich(project);
    const classified = auto_classify(enriched, REGISTRY, read_file_lines, project.get_languages());
    // No remaining entry point matches the rule — setup/run are plain functions
    // with no untyped self-attribute call.
    for (const c of classified) {
      expect(c.result.auto_classified).toBe(false);
    }
  });
});
