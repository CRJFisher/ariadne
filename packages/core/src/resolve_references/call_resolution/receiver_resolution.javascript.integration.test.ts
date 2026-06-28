/**
 * Integration tests for TASK-350.1 — JavaScript parameters typed only through a
 * JSDoc `@param {T} name` tag as method-call receivers.
 *
 * The evidence case reproduces webpack's buildChunkGraph: a function parameter
 * carries its declared type purely in a JSDoc `@param {ModuleGraph} g` tag (pure
 * JS has no `: T` annotation). Before the fix the parameter's declared type was
 * dropped at indexing time, the receiver call `g.getParentBlockIndex()` could not
 * resolve, and the called member was reported as an unreachable entry point (a
 * false positive). These tests assert the member is reachable now that the JSDoc
 * param type survives indexing — and they fail if the core fix is reverted, since
 * the member would reappear as an entry point.
 *
 * The fixtures live under
 * tests/fixtures/javascript/code/integration/jsdoc_param_types/ and span two
 * files that import each other, copied into an isolated temp dir per test to keep
 * cross-file resolution self-contained.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../../project/project";
import type { FilePath, SymbolName, CallGraph } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const FIXTURE_DIR = path.join(
  __dirname,
  "../../../tests/fixtures/javascript/code/integration/jsdoc_param_types"
);

function load_fixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

/**
 * Writes the named fixtures into a temp dir, then loads them into a Project so
 * cross-file imports resolve against an isolated tree.
 */
async function project_from_fixtures(
  names: string[]
): Promise<{ project: Project; file_paths: Record<string, FilePath> }> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-task350-1-"));
  temp_dirs.push(temp_dir);

  const file_paths: Record<string, FilePath> = {};
  for (const name of names) {
    const abs_path = path.join(temp_dir, name);
    fs.writeFileSync(abs_path, load_fixture(name));
    file_paths[name] = abs_path as FilePath;
  }

  const project = new Project();
  await project.initialize(temp_dir as FilePath);
  for (const name of names) {
    project.update_file(file_paths[name], load_fixture(name));
  }

  return { project, file_paths };
}

/**
 * An entry point is a false positive here iff the named member in the given file
 * is reported as uncalled. Returns the matching entry point's SymbolId, or
 * undefined when the member is reachable (the post-fix expectation).
 */
function entry_point_for(
  call_graph: CallGraph,
  member: string,
  file: FilePath
): string | undefined {
  return call_graph.entry_points.find((ep) => {
    const node = call_graph.nodes.get(ep);
    return (
      node?.name === (member as SymbolName) &&
      node.location.file_path === file
    );
  });
}

/**
 * Asserts the member is a real graph node AND is not reported as an entry
 * point. The node-presence guard stops the entry-point check from passing
 * vacuously if the member ever disappears from the graph entirely.
 */
function assert_member_reachable(
  call_graph: CallGraph,
  member: string,
  file: FilePath
): void {
  const node_present = Array.from(call_graph.nodes.values()).some(
    (n) => n.name === (member as SymbolName) && n.location.file_path === file
  );
  expect(node_present).toBe(true);
  expect(entry_point_for(call_graph, member, file)).toBeUndefined();
}

describe("JavaScript JSDoc @param receiver resolution (TASK-350.1)", () => {
  it("getParentBlockIndex is reachable via a JSDoc @param {ModuleGraph}-typed receiver", async () => {
    const { project, file_paths } = await project_from_fixtures([
      "module_graph.js",
      "build_chunk_graph.js",
    ]);
    const call_graph = project.get_call_graph();

    assert_member_reachable(
      call_graph,
      "getParentBlockIndex",
      file_paths["module_graph.js"]
    );
  });

  it("buildChunkGraph's g.getParentBlockIndex() call resolves to the ModuleGraph method", async () => {
    const { project, file_paths } = await project_from_fixtures([
      "module_graph.js",
      "build_chunk_graph.js",
    ]);
    const call_graph = project.get_call_graph();

    const caller = Array.from(call_graph.nodes.values()).find(
      (n) =>
        n.name === ("buildChunkGraph" as SymbolName) &&
        n.location.file_path === file_paths["build_chunk_graph.js"]
    );
    expect(caller).toBeDefined();

    const target = Array.from(call_graph.nodes.values()).find(
      (n) =>
        n.name === ("getParentBlockIndex" as SymbolName) &&
        n.location.file_path === file_paths["module_graph.js"]
    );
    expect(target).toBeDefined();

    const call = caller!.enclosed_calls.find(
      (c) => c.name === ("getParentBlockIndex" as SymbolName)
    );
    expect(call).toBeDefined();
    expect(
      call!.resolutions.some((r) => r.symbol_id === target!.symbol_id)
    ).toBe(true);
  });
});
