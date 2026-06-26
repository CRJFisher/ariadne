/**
 * Integration tests for TASK-350 — optional TypeScript constructor
 * parameter-properties as method-call receivers.
 *
 * Each evidence case reproduces a real-world cluster (NestJS, Prisma) where a
 * method is reached only through an optional `private readonly x?: T` (or
 * `public x?: T`) constructor param-property. Before the `.scm` fix the implicit
 * class field — and therefore the receiver's declared type — was lost at
 * indexing time, the call could not resolve, and the member was reported as an
 * unreachable entry point (false positive). These tests assert the members are
 * reachable now that the field's type survives indexing.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../../project/project";
import type { FilePath, SymbolName, CallGraph } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const FIXTURE_DIR = path.join(
  __dirname,
  "../../../tests/fixtures/typescript/code/integration/optional_param_properties"
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
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-task350-"));
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

describe("TypeScript optional ctor param-property receiver resolution (TASK-350)", () => {
  describe("NestJS ApplicationConfig cluster", () => {
    it("getGlobalPipes is reachable via a private readonly optional param-property receiver", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "application_config.ts",
        "pipes_context_creator.ts",
      ]);
      const call_graph = project.get_call_graph();

      expect(
        entry_point_for(call_graph, "getGlobalPipes", file_paths["application_config.ts"])
      ).toBeUndefined();
    });

    it("getGlobalGuards is reachable via the same optional param-property receiver", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "application_config.ts",
        "pipes_context_creator.ts",
      ]);
      const call_graph = project.get_call_graph();

      expect(
        entry_point_for(call_graph, "getGlobalGuards", file_paths["application_config.ts"])
      ).toBeUndefined();
    });
  });

  describe("NestJS TestingInjector", () => {
    it("setMocker is reachable via a public (non-readonly) optional param-property receiver", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "application_config.ts",
        "testing_injector.ts",
      ]);
      const call_graph = project.get_call_graph();

      expect(
        entry_point_for(call_graph, "setMocker", file_paths["application_config.ts"])
      ).toBeUndefined();
    });
  });

  describe("Prisma MergedExtensionsList recursive cluster", () => {
    it("getAllComputedFields resolves its recursive this.previous?.method() self-call", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "merged_extensions_list.ts",
      ]);
      const call_graph = project.get_call_graph();
      const file = file_paths["merged_extensions_list.ts"];

      // The recursive call resolves to the same member: the caller node carries a
      // resolved `getAllComputedFields` call edge.
      const method_node = Array.from(call_graph.nodes.values()).find(
        (n) =>
          n.name === ("getAllComputedFields" as SymbolName) &&
          n.location.file_path === file
      )!;
      const self_call = method_node.enclosed_calls.find(
        (c) => c.name === ("getAllComputedFields" as SymbolName)
      )!;
      expect(self_call.resolutions.length).toBeGreaterThan(0);
      expect(self_call.resolutions.some((r) => r.symbol_id === method_node.symbol_id)).toBe(true);
    });

    it("getAllQueryCallbacks resolves its recursive self-call", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "merged_extensions_list.ts",
      ]);
      const call_graph = project.get_call_graph();
      const file = file_paths["merged_extensions_list.ts"];

      const method_node = Array.from(call_graph.nodes.values()).find(
        (n) =>
          n.name === ("getAllQueryCallbacks" as SymbolName) &&
          n.location.file_path === file
      )!;
      const self_call = method_node.enclosed_calls.find(
        (c) => c.name === ("getAllQueryCallbacks" as SymbolName)
      )!;
      expect(self_call.resolutions.length).toBeGreaterThan(0);
      expect(self_call.resolutions.some((r) => r.symbol_id === method_node.symbol_id)).toBe(true);
    });
  });
});
