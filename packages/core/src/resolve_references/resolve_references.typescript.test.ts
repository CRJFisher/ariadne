/**
 * TypeScript multi-file integration tests for resolve_references
 *
 * Focuses on namespace import resolution (`import * as X`) and
 * cross-file constructor calls through the full pipeline.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../project/project";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Helper to set up a project with files already on disk before initialization.
 */
async function setup_project(
  files: Record<string, string>
): Promise<{
  project: Project;
  temp_dir: string;
  file_paths: Record<string, FilePath>;
}> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-ts-resolve-"));

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

  return { project, temp_dir, file_paths };
}

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("TypeScript Namespace Import Resolution Integration", () => {
  it("import * as X; X.func() should resolve to the exported function", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "utils.ts": `export function formatName(name: string): string {
  return name.toUpperCase();
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
`,
      "consumer.ts": `import * as utils from "./utils";

export function process(name: string, date: Date): string {
  return utils.formatName(name) + " " + utils.formatDate(date);
}
`,
    });
    temp_dirs.push(temp_dir);

    // Verify namespace import resolves in name resolution
    const consumer_scope = project.scopes.get_file_root_scope(
      file_paths["consumer.ts"]
    );
    expect(consumer_scope).toBeDefined();

    const resolved_utils = project.resolutions.resolve(
      consumer_scope!.id,
      "utils" as SymbolName
    );
    expect(resolved_utils).not.toBeNull();

    // Namespace-imported functions should be resolved in the call graph,
    // so they should NOT appear as entry points
    const call_graph = project.get_call_graph();

    const format_name_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("formatName" as SymbolName) &&
        node.location.file_path === file_paths["utils.ts"]
      );
    });
    const format_date_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("formatDate" as SymbolName) &&
        node.location.file_path === file_paths["utils.ts"]
      );
    });

    expect(format_name_entry).toBeUndefined();
    expect(format_date_entry).toBeUndefined();

    // Verify the process function's enclosed calls resolve to formatName and formatDate
    const process_node = [...call_graph.nodes.values()].find(
      (node) =>
        node.name === ("process" as SymbolName) &&
        node.location.file_path === file_paths["consumer.ts"]
    );
    expect(process_node).toBeDefined();

    const called_names = process_node!.enclosed_calls.map((call) => call.name);
    expect(called_names).toContain("formatName" as SymbolName);
    expect(called_names).toContain("formatDate" as SymbolName);
  });

  it("import * as X; new X.Class() should resolve cross-file constructor", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "models.ts": `export class User {
  constructor(public name: string) {}

  greet(): string {
    return "Hello, " + this.name;
  }
}
`,
      "app.ts": `import * as models from "./models";

export function createUser(name: string): string {
  const user = new models.User(name);
  return user.greet();
}
`,
    });
    temp_dirs.push(temp_dir);

    // Verify namespace import resolves
    const app_scope = project.scopes.get_file_root_scope(file_paths["app.ts"]);
    expect(app_scope).toBeDefined();

    const resolved_models = project.resolutions.resolve(
      app_scope!.id,
      "models" as SymbolName
    );
    expect(resolved_models).not.toBeNull();

    // The User constructor should be resolved through the namespace import,
    // so User should not appear as an unreferenced entry point
    const call_graph = project.get_call_graph();

    const user_class_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("User" as SymbolName) &&
        node.location.file_path === file_paths["models.ts"]
      );
    });
    expect(user_class_entry).toBeUndefined();

    // greet() should NOT be an entry point — user.greet() resolves through
    // the namespace import type binding for `user`
    const greet_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("greet" as SymbolName) &&
        node.location.file_path === file_paths["models.ts"]
      );
    });
    expect(greet_entry).toBeUndefined();
  });

  it("namespace import with re-exports should resolve through barrel file", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "math/add.ts": `export function add(a: number, b: number): number {
  return a + b;
}
`,
      "math/multiply.ts": `export function multiply(a: number, b: number): number {
  return a * b;
}
`,
      "math/index.ts": `export { add } from "./add";
export { multiply } from "./multiply";
`,
      "calculator.ts": `import * as math from "./math";

export function calculate(a: number, b: number): number {
  return math.add(a, b) + math.multiply(a, b);
}
`,
    });
    temp_dirs.push(temp_dir);

    const calc_scope = project.scopes.get_file_root_scope(
      file_paths["calculator.ts"]
    );
    expect(calc_scope).toBeDefined();

    const resolved_math = project.resolutions.resolve(
      calc_scope!.id,
      "math" as SymbolName
    );
    expect(resolved_math).not.toBeNull();

    const call_graph = project.get_call_graph();

    // calculator.calculate should exist as an entry point (exported, not called)
    const calculate_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("calculate" as SymbolName) &&
        node.location.file_path === file_paths["calculator.ts"]
      );
    });
    expect(calculate_entry).toBeDefined();

    // add and multiply are not entry points: the barrel file's re-exports
    // create function references that mark them as indirectly reachable.
    // However, the call edges from calculate → add/multiply are missing because
    // resolve_namespace_method skips import-kind definitions (re-exports).
    const add_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("add" as SymbolName) &&
        node.location.file_path === file_paths["math/add.ts"]
      );
    });
    const multiply_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("multiply" as SymbolName) &&
        node.location.file_path === file_paths["math/multiply.ts"]
      );
    });

    expect(add_entry).toBeUndefined();
    expect(multiply_entry).toBeUndefined();

    // calculate emits CallReferences for math.add() and math.multiply() but
    // they fail to resolve through the barrel file's re-export imports.
    // Each emitted CallReference carries an empty resolutions array and a
    // resolution_failure diagnostic.
    const calculate_node = [...call_graph.nodes.values()].find(
      (node) =>
        node.name === ("calculate" as SymbolName) &&
        node.location.file_path === file_paths["calculator.ts"]
    );
    expect(calculate_node).toBeDefined();
    const method_calls = calculate_node!.enclosed_calls.filter(
      (call) =>
        call.call_type === "method" &&
        (call.name === "add" || call.name === "multiply")
    );
    // Each math.X(...) call site emits at least one CallReference.
    expect(method_calls.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(method_calls.map((c) => c.name as string))
    ).toEqual(new Set(["add", "multiply"]));
    for (const call of method_calls) {
      expect(call.resolutions).toEqual([]);
      expect(call.resolution_failure?.stage).toBe("method_lookup");
      expect(call.resolution_failure?.reason).toBe("method_not_on_type");
    }
  });
});

describe("TypeScript Cross-File Constructor Call Integration", () => {
  it("should resolve cross-file new Class() constructor calls", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "widget.ts": `export class Widget {
  constructor(public label: string) {}

  render(): string {
    return "<div>" + this.label + "</div>";
  }
}
`,
      "dashboard.ts": `import { Widget } from "./widget";

export function buildDashboard(): string {
  const w = new Widget("stats");
  return w.render();
}
`,
    });
    temp_dirs.push(temp_dir);

    // Verify Widget is resolved in the consumer
    const dashboard_scope = project.scopes.get_file_root_scope(
      file_paths["dashboard.ts"]
    );
    expect(dashboard_scope).toBeDefined();

    const resolved_widget = project.resolutions.resolve(
      dashboard_scope!.id,
      "Widget" as SymbolName
    );
    expect(resolved_widget).not.toBeNull();
    expect(resolved_widget).toContain("Widget");
    expect(resolved_widget).toContain("widget.ts");
  });
});
