/**
 * TypeScript multi-file integration tests for resolve_references
 *
 * Focuses on namespace import resolution (`import * as X`) and
 * cross-file constructor calls through the full pipeline.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../project/project";
import {
  find_caller_node,
  is_entry_point,
} from "./resolve_references.test";
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

  // Manifests belong on disk for the specifier index to read, but only source
  // files are indexed — the same split the real loader makes.
  for (const [relative_path, content] of Object.entries(files)) {
    if (/\.(ts|tsx|js|jsx)$/.test(relative_path)) {
      project.update_file(file_paths[relative_path], content);
    }
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

    // add and multiply resolve through the barrel file's re-export chain, so
    // they are reachable (called by calculate) and not entry points.
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

    // calculate's math.add() and math.multiply() call sites resolve through the
    // barrel file's re-exports to the terminal functions in add.ts / multiply.ts,
    // with no resolution_failure.
    const calculate_node = [...call_graph.nodes.values()].find(
      (node) =>
        node.name === ("calculate" as SymbolName) &&
        node.location.file_path === file_paths["calculator.ts"]
    );
    expect(calculate_node).toBeDefined();
    const barrel_calls = calculate_node!.enclosed_calls.filter(
      (call) => call.name === "add" || call.name === "multiply"
    );
    expect(
      new Set(barrel_calls.map((c) => c.name as string))
    ).toEqual(new Set(["add", "multiply"]));

    const add_call = barrel_calls.find((c) => c.name === "add");
    const multiply_call = barrel_calls.find((c) => c.name === "multiply");
    expect(add_call!.resolution_failure).toBeUndefined();
    expect(multiply_call!.resolution_failure).toBeUndefined();

    const add_target = call_graph.nodes.get(add_call!.resolutions[0].symbol_id);
    expect(add_target?.location.file_path).toBe(file_paths["math/add.ts"]);
    const multiply_target = call_graph.nodes.get(
      multiply_call!.resolutions[0].symbol_id
    );
    expect(multiply_target?.location.file_path).toBe(
      file_paths["math/multiply.ts"]
    );
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

describe("TypeScript Named Import Regression Control", () => {
  it("resolves an exported named import to its definition and leaves the callee out of the entry points", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "lib.ts": `export function foo(x: number): number {
  return x;
}
`,
      "app.ts": `import { foo } from "./lib";

export function run(): number {
  return foo(1);
}
`,
    });
    temp_dirs.push(temp_dir);

    const app_scope = project.scopes.get_file_root_scope(file_paths["app.ts"]);
    expect(app_scope).not.toBeUndefined();
    const resolved = project.resolutions.resolve(
      app_scope!.id,
      "foo" as SymbolName
    );
    expect(resolved).not.toBeNull();
    expect(resolved).toContain("lib.ts");
    expect(resolved).toContain("foo");

    const call_graph = project.get_call_graph();
    const run_node = [...call_graph.nodes.values()].find(
      (node) =>
        node.name === ("run" as SymbolName) &&
        node.location.file_path === file_paths["app.ts"]
    );
    const call = run_node!.enclosed_calls.find(
      (c) => c.name === ("foo" as SymbolName)
    );
    expect(call!.resolution_failure).toBeUndefined();
    const target = call_graph.nodes.get(call!.resolutions[0].symbol_id);
    expect(target?.location.file_path).toEqual(file_paths["lib.ts"]);
    expect(target?.name).toEqual("foo" as SymbolName);

    const entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("foo" as SymbolName) &&
        node.location.file_path === file_paths["lib.ts"]
      );
    });
    expect(entry).toBeUndefined();
  });
});

// Variable-bound named function expression (task-355): `var X = function X(){}`
// registers the outer `X` in the enclosing scope, so intra-file references
// resolve and `X` is not surfaced as a spurious entry point.
describe("TypeScript Variable-Bound Named Function Expression", () => {
  const temp_dirs: string[] = [];
  afterAll(() => {
    for (const dir of temp_dirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("resolves an intra-file bare-name call to the outer function binding", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "mod.ts": `var X = function X(): number {
  return 1;
};

export function run(): number {
  return X();
}
`,
    });
    temp_dirs.push(temp_dir);

    const call = project.resolutions
      .get_calls_for_file(file_paths["mod.ts"])
      .find((c) => c.name === ("X" as SymbolName));
    expect(call!.resolution_failure).toBeUndefined();
    expect(call!.resolutions.length).toEqual(1);

    const x_def_ids = project.definitions
      .get_definitions_by_name("X" as SymbolName)
      .filter((def) => def.location.file_path === file_paths["mod.ts"])
      .map((def) => def.symbol_id);
    expect(x_def_ids).toContain(call!.resolutions[0].symbol_id);

    const x_entries = project.get_call_graph().entry_points.filter((ep) => {
      const node = project.get_call_graph().nodes.get(ep);
      return (
        node?.name === ("X" as SymbolName) &&
        node.location.file_path === file_paths["mod.ts"]
      );
    });
    expect(x_entries).toEqual([]);
  });

  it("keeps a constructor-only var-bound function off the entry-point set", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "mod.ts": `var Widget = function Widget() {
  return { ok: true };
};

export function main() {
  return new Widget();
}
`,
    });
    temp_dirs.push(temp_dir);

    const widget_calls = project.resolutions
      .get_calls_for_file(file_paths["mod.ts"])
      .filter((c) => c.name === ("Widget" as SymbolName));
    expect(widget_calls.length).toEqual(1);

    const call_graph = project.get_call_graph();
    const widget_nodes = Array.from(call_graph.nodes.values()).filter(
      (n) =>
        n.name === ("Widget" as SymbolName) &&
        n.location.file_path === file_paths["mod.ts"]
    );
    expect(widget_nodes.length).toEqual(1);
    const widget_entries = call_graph.entry_points.filter((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("Widget" as SymbolName) &&
        node.location.file_path === file_paths["mod.ts"]
      );
    });
    expect(widget_entries).toEqual([]);
  });

  it("resolves the self-reference and the outer binding for a distinct inner name", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "mod.ts": `const factorial = function fact(n: number): number {
  return n <= 1 ? 1 : n * fact(n - 1);
};

export function run(): number {
  return factorial(5);
}
`,
    });
    temp_dirs.push(temp_dir);

    const calls = project.resolutions.get_calls_for_file(file_paths["mod.ts"]);
    const outer_call = calls.find(
      (c) => c.name === ("factorial" as SymbolName)
    );
    expect(outer_call!.resolution_failure).toBeUndefined();
    expect(outer_call!.resolutions.length).toEqual(1);
    const self_call = calls.find((c) => c.name === ("fact" as SymbolName));
    expect(self_call!.resolution_failure).toBeUndefined();
    expect(self_call!.resolutions.length).toEqual(1);

    const call_graph = project.get_call_graph();
    const factorial_nodes = Array.from(call_graph.nodes.values()).filter(
      (n) =>
        n.name === ("factorial" as SymbolName) &&
        n.location.file_path === file_paths["mod.ts"]
    );
    expect(factorial_nodes.length).toEqual(1);
    const stray_entries = call_graph.entry_points.filter((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        (node?.name === ("factorial" as SymbolName) ||
          node?.name === ("fact" as SymbolName)) &&
        node.location.file_path === file_paths["mod.ts"]
      );
    });
    expect(stray_entries).toEqual([]);
  });

  it("indexes an exported binding without a duplicate-export error and exports only the outer name", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "mod.ts": `export const X = function X(): number {
  return 1;
};
`,
      "use.ts": `import { X } from "./mod";

export function run(): number {
  return X();
}
`,
    });
    temp_dirs.push(temp_dir);

    const call = project.resolutions
      .get_calls_for_file(file_paths["use.ts"])
      .find((c) => c.name === ("X" as SymbolName));
    expect(call!.resolution_failure).toBeUndefined();
    expect(call!.resolutions.length).toEqual(1);
  });
});

describe("Getter reads through non-identifier receivers", () => {
  it("resolves this.argsTypes to the argsTypes getter", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "dmmf.ts": [
        "export class Dmmf {",
        "  get argsTypes() { return 1; }",
        "  run() { return this.argsTypes; }",
        "}",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const cg = project.get_call_graph();
    const file = file_paths["dmmf.ts"];
    const getter = find_caller_node(cg, "argsTypes", file);
    const run = find_caller_node(cg, "run", file);
    expect(
      run?.enclosed_calls.map((c) => ({
        name: c.name,
        call_type: c.call_type,
        targets: c.resolutions.map((r) => r.symbol_id),
      }))
    ).toEqual([
      { name: "argsTypes", call_type: "method", targets: [getter!.symbol_id] },
    ]);
    expect(is_entry_point(cg, "argsTypes", file)).toEqual(false);
  });

  it("resolves this.helper.rootFieldMap to the rootFieldMap getter", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "dmmf.ts": [
        "export class Helper {",
        "  get rootFieldMap() { return 1; }",
        "}",
        "export class Dmmf {",
        "  helper: Helper = new Helper();",
        "  run() { return this.helper.rootFieldMap; }",
        "}",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const cg = project.get_call_graph();
    const file = file_paths["dmmf.ts"];
    const getter = find_caller_node(cg, "rootFieldMap", file);
    const run = find_caller_node(cg, "run", file);
    expect(
      run?.enclosed_calls.map((c) => ({
        name: c.name,
        targets: c.resolutions.map((r) => r.symbol_id),
      }))
    ).toEqual([
      { name: "rootFieldMap", targets: [getter!.symbol_id] },
    ]);
    expect(is_entry_point(cg, "rootFieldMap", file)).toEqual(false);
  });

  it("resolves context.dmmf.typeAndModelMap to the typeAndModelMap getter", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "ctx.ts": [
        "export class Dmmf {",
        "  get typeAndModelMap() { return 1; }",
        "}",
        "export class Context {",
        "  dmmf: Dmmf = new Dmmf();",
        "}",
        "export function run(context: Context) {",
        "  return context.dmmf.typeAndModelMap;",
        "}",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const cg = project.get_call_graph();
    const file = file_paths["ctx.ts"];
    const getter = find_caller_node(cg, "typeAndModelMap", file);
    const run = find_caller_node(cg, "run", file);
    expect(
      run?.enclosed_calls.map((c) => ({
        name: c.name,
        targets: c.resolutions.map((r) => r.symbol_id),
      }))
    ).toEqual([
      { name: "typeAndModelMap", targets: [getter!.symbol_id] },
    ]);
    expect(is_entry_point(cg, "typeAndModelMap", file)).toEqual(false);
  });

  it("resolves the nest instanceLinksHost and parentInjector getter reads", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "injector.ts": [
        "export class Injector {",
        "  get instanceLinksHost() { return 1; }",
        "  get parentInjector() { return 2; }",
        "  resolve() {",
        "    const links = this.instanceLinksHost;",
        "    const parent = this.parentInjector;",
        "    return [links, parent];",
        "  }",
        "}",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const cg = project.get_call_graph();
    const file = file_paths["injector.ts"];
    expect(is_entry_point(cg, "instanceLinksHost", file)).toEqual(false);
    expect(is_entry_point(cg, "parentInjector", file)).toEqual(false);
  });

  it("resolves the angular compiler getter read through an intermediate chain link", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "boot.ts": [
        "export class Compiler {",
        "  compileModule(m: string) { return m; }",
        "}",
        "export class Bootstrap {",
        "  get compiler() { return new Compiler(); }",
        "  run() { return this.compiler.compileModule('m'); }",
        "}",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const cg = project.get_call_graph();
    const file = file_paths["boot.ts"];
    expect(is_entry_point(cg, "compiler", file)).toEqual(false);
  });

  it("creates no edge from a data-field read or a plain method read", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "box.ts": [
        "export class Box {",
        "  field = 1;",
        "  plain() { return 3; }",
        "}",
        "export function run(b: Box) {",
        "  const f = b.field;",
        "  const m = b.plain;",
        "  return [f, m];",
        "}",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const cg = project.get_call_graph();
    const file = file_paths["box.ts"];
    const run = find_caller_node(cg, "run", file);
    expect(run?.enclosed_calls).toEqual([]);
    expect(is_entry_point(cg, "plain", file)).toEqual(true);
  });
});

describe("Accessor pair ahead of other members", () => {
  it("resolves this- and super-rooted calls in a class whose getter/setter pair is declared first", async () => {
    // The class scope index is keyed by name, so the setter lands under the
    // getter's key. Reverse-looking a method up through the deduplicated member
    // index then failed to name the owning class, and every this-rooted call in
    // the class went unresolved.
    const { project, temp_dir, file_paths } = await setup_project({
      "engine.ts": [
        "class Base { greet(): number { return 1; } }",
        "",
        "export class Engine extends Base {",
        "  private q = 0;",
        "  get v(): number { return this.q; }",
        "  set v(x: number) { this.q = x; }",
        "  run(): number { this.step_one(); return super.greet(); }",
        "  step_one(): number { return 1; }",
        "}",
        "",
        "export function main(): number { return new Engine().run(); }",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const call_graph = project.get_call_graph();
    const file = file_paths["engine.ts"];

    const run = find_caller_node(call_graph, "run", file);
    expect(
      run?.enclosed_calls.map((c) => [c.name, c.resolutions.length])
    ).toEqual([
      ["step_one", 1],
      ["greet", 1],
      // `super` itself is a self-reference with no target of its own.
      ["super", 0],
    ]);
    expect(is_entry_point(call_graph, "step_one", file)).toEqual(false);
    expect(is_entry_point(call_graph, "greet", file)).toEqual(false);
  });
});

describe("Namespace member exports", () => {
  it("indexes a file where two namespaces export the same member name", async () => {
    // A member exported from a namespace is reached through the namespace, so
    // registering it as a file export put the two into collision and aborted
    // the file — taking every definition and edge in it down.
    const { project, temp_dir, file_paths } = await setup_project({
      "n.ts": [
        "export namespace A {",
        "  export function helper(): number { return 1; }",
        "}",
        "",
        "export namespace B {",
        "  export function helper(): number { return 2; }",
        "}",
        "",
        "export function main(): number { return A.helper() + B.helper(); }",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const file = file_paths["n.ts"];

    const index = project.get_index_single_file(file)!;
    expect(
      [...index.functions.values()].map((f) => f.name).sort()
    ).toEqual(["helper", "helper", "main"]);

    const call_graph = project.get_call_graph();
    const main = find_caller_node(call_graph, "main", file);
    expect(main?.enclosed_calls.map((c) => c.name)).toEqual([
      "helper",
      "helper",
    ]);
  });
});

describe("TypeScript export-* barrel resolution", () => {
  function expect_call_resolves_to(
    project: Project,
    caller_file: FilePath,
    call_name: string,
    target_file: FilePath
  ): void {
    const call = project.resolutions
      .get_calls_for_file(caller_file)
      .find((c) => c.name === (call_name as SymbolName));
    expect(call).toBeDefined();
    expect(call!.resolution_failure).toBeUndefined();
    expect(call!.resolutions.length).toEqual(1);

    const target_ids = project.definitions
      .get_definitions_by_name(call_name as SymbolName)
      .filter((def) => def.location.file_path === target_file)
      .filter((def) => def.kind !== "import")
      .map((def) => def.symbol_id);
    expect(target_ids).toContain(call!.resolutions[0].symbol_id);
  }

  it("resolves a named import through one export-* hop to its leaf definition", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "src/compiler/moduleNameResolver.ts": `export function loadModuleFromGlobalCache(moduleName: string): number {
  return moduleName.length;
}
`,
      "src/compiler/utilities.ts": `export function emitDetachedComments(text: string): number {
  return text.length;
}
`,
      "src/compiler/_namespaces/ts.ts": `export * from "../moduleNameResolver";
export * from "../utilities";
`,
      "src/compiler/resolutionCache.ts": `import { loadModuleFromGlobalCache } from "./_namespaces/ts";

export function createResolutionCache(): number {
  return loadModuleFromGlobalCache("mod");
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/compiler/resolutionCache.ts"],
      "loadModuleFromGlobalCache",
      file_paths["src/compiler/moduleNameResolver.ts"]
    );
  });

  it("resolves a second name through the same barrel to a different leaf", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "src/compiler/moduleNameResolver.ts": `export function loadModuleFromGlobalCache(moduleName: string): number {
  return moduleName.length;
}
`,
      "src/compiler/utilities.ts": `export function emitDetachedComments(text: string): number {
  return text.length;
}
`,
      "src/compiler/_namespaces/ts.ts": `export * from "../moduleNameResolver";
export * from "../utilities";
`,
      "src/compiler/emitter.ts": `import { emitDetachedComments } from "./_namespaces/ts";

export function emitFiles(): number {
  return emitDetachedComments("x");
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/compiler/emitter.ts"],
      "emitDetachedComments",
      file_paths["src/compiler/utilities.ts"]
    );
  });

  it("resolves through a barrel that also star-re-exports another barrel", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "src/compiler/moduleNameResolver.ts": `export function loadModuleFromGlobalCache(moduleName: string): number {
  return moduleName.length;
}
`,
      "src/compiler/_namespaces/ts.ts": `export * from "../moduleNameResolver";
`,
      "src/services/utilities.ts": `export function findTokenOnLeftOfPosition(file: string, position: number): number {
  return file.length + position;
}
`,
      "src/services/_namespaces/ts.ts": `export * from "../../compiler/_namespaces/ts";
export * from "../utilities";
`,
      "src/services/signatureHelp.ts": `import { findTokenOnLeftOfPosition } from "./_namespaces/ts";

export function getSignatureHelpItems(file: string): number {
  return findTokenOnLeftOfPosition(file, 0);
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/services/signatureHelp.ts"],
      "findTokenOnLeftOfPosition",
      file_paths["src/services/utilities.ts"]
    );
  });

  it("resolves a namespace member through a wildcard hop, a namespace-object hop and a wildcard hop", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "src/jsTyping/jsTyping.ts": `export function discoverTypings(fileNames: string[]): number {
  return fileNames.length;
}
`,
      "src/jsTyping/_namespaces/ts.JsTyping.ts": `export * from "../jsTyping";
`,
      "src/jsTyping/_namespaces/ts.ts": `import * as JsTyping from "./ts.JsTyping";
export { JsTyping };
`,
      "src/typingsInstallerCore/_namespaces/ts.ts": `export * from "../../jsTyping/_namespaces/ts";
`,
      "src/typingsInstallerCore/typingsInstaller.ts": `import { JsTyping } from "./_namespaces/ts";

export function installTypings(fileNames: string[]): number {
  return JsTyping.discoverTypings(fileNames);
}
`,
    });
    temp_dirs.push(temp_dir);

    const call = project.resolutions
      .get_calls_for_file(file_paths["src/typingsInstallerCore/typingsInstaller.ts"])
      .find((c) => c.name === ("discoverTypings" as SymbolName));
    expect(call).toBeDefined();
    expect(call!.resolution_failure).toBeUndefined();
    expect(call!.resolutions.length).toEqual(1);

    const target_ids = project.definitions
      .get_definitions_by_name("discoverTypings" as SymbolName)
      .filter(
        (def) =>
          def.location.file_path === file_paths["src/jsTyping/jsTyping.ts"]
      )
      .filter((def) => def.kind !== "import")
      .map((def) => def.symbol_id);
    expect(target_ids).toContain(call!.resolutions[0].symbol_id);
  });

  it("does not surface a name the barrel's targets do not export", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "src/leaf.ts": `export function realExport(): number {
  return 1;
}
`,
      "src/barrel.ts": `export * from "./leaf";
`,
      "src/consumer.ts": `import { notAName } from "./barrel";

export function tryIt(): number {
  return notAName();
}
`,
    });
    temp_dirs.push(temp_dir);

    const call = project.resolutions
      .get_calls_for_file(file_paths["src/consumer.ts"])
      .find((c) => c.name === ("notAName" as SymbolName));
    expect(call).toBeDefined();
    expect(call!.resolutions.length).toEqual(0);
    expect(call!.resolution_failure?.stage).toEqual("name_resolution");
    expect(call!.resolution_failure?.reason).toEqual("name_not_in_scope");
  });

  it("resolves a namespace member reached directly, with no barrel in the chain", async () => {
    // The FindAllReferences.Core.getReferencesForFileName shape.
    const { project, temp_dir, file_paths } = await setup_project({
      "src/findAllReferences.ts": `export namespace FindAllReferences {
  export namespace Core {
    export function getReferencesForFileName(fileName: string): number {
      return fileName.length;
    }
  }
}
`,
      "src/consumer.ts": `import { FindAllReferences } from "./findAllReferences";

export function drive(): number {
  return FindAllReferences.Core.getReferencesForFileName("x");
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/consumer.ts"],
      "getReferencesForFileName",
      file_paths["src/findAllReferences.ts"]
    );
  });

  it("resolves a namespace member through a barrel's namespace object", async () => {
    // import { formatting } from './_namespaces/ts.js' where the barrel does
    // `import * as formatting …; export { formatting }` and the leaf exports *.
    const { project, temp_dir, file_paths } = await setup_project({
      "src/services/formatting/rules.ts": `export function formatOnSemicolon(pos: number): number {
  return pos;
}
`,
      "src/services/_namespaces/ts.formatting.ts": `export * from "../formatting/rules";
`,
      "src/services/_namespaces/ts.ts": `import * as formatting from "./ts.formatting";
export { formatting };
`,
      "src/services/formatting.ts": `import { formatting } from "./_namespaces/ts";

export function applyFormatting(): number {
  return formatting.formatOnSemicolon(1);
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/services/formatting.ts"],
      "formatOnSemicolon",
      file_paths["src/services/formatting/rules.ts"]
    );
  });

  it("resolves a namespace member through a barrel whose leaf re-exports by name", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "src/services/formatting/rules.ts": `export function formatOnSemicolon(pos: number): number {
  return pos;
}
`,
      "src/services/_namespaces/ts.formatting.ts": `export { formatOnSemicolon } from "../formatting/rules";
`,
      "src/services/_namespaces/ts.ts": `import * as formatting from "./ts.formatting";
export { formatting };
`,
      "src/services/formatting.ts": `import { formatting } from "./_namespaces/ts";

export function applyFormatting(): number {
  return formatting.formatOnSemicolon(1);
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/services/formatting.ts"],
      "formatOnSemicolon",
      file_paths["src/services/formatting/rules.ts"]
    );
  });

  it("resolves a member through a namespace import of a chained barrel", async () => {
    // ts.JsTyping.discoverTypings(): a namespace import, a namespace-object hop
    // and a wildcard hop.
    const { project, temp_dir, file_paths } = await setup_project({
      "src/jsTyping/jsTyping.ts": `export function discoverTypings(fileNames: string[]): number {
  return fileNames.length;
}
`,
      "src/jsTyping/_namespaces/ts.JsTyping.ts": `export * from "../jsTyping";
`,
      "src/jsTyping/_namespaces/ts.ts": `import * as JsTyping from "./ts.JsTyping";
export { JsTyping };
`,
      "src/typingsInstallerCore/typingsInstaller.ts": `import * as ts from "../jsTyping/_namespaces/ts";

export function installTypings(fileNames: string[]): number {
  return ts.JsTyping.discoverTypings(fileNames);
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/typingsInstallerCore/typingsInstaller.ts"],
      "discoverTypings",
      file_paths["src/jsTyping/jsTyping.ts"]
    );
  });

  it("resolves a bare specifier through a tsconfig paths alias onto a star-re-exporting barrel", async () => {
    // nest: `import { mixin } from "@nestjs/common"`, where the alias target's
    // index.ts is itself a star re-export chain.
    const { project, temp_dir, file_paths } = await setup_project({
      "tsconfig.json": `{
  "compilerOptions": {
    "paths": {
      "@nestjs/common": ["./packages/common"],
    },
  },
}`,
      "packages/common/index.ts": `export * from "./utils";
`,
      "packages/common/utils.ts": `export function mixin(): number {
  return 1;
}
`,
      "packages/core/injector.ts": `import { mixin } from "@nestjs/common";

export function inject(): number {
  return mixin();
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["packages/core/injector.ts"],
      "mixin",
      file_paths["packages/common/utils.ts"]
    );
  });

  it("resolves an alias a per-package tsconfig inherits through extends", async () => {
    // The standard monorepo layout: one shared base config declares `paths`,
    // each package's own config declares none and only extends it.
    const { project, temp_dir, file_paths } = await setup_project({
      "tsconfig.base.json": `{
  "compilerOptions": {
    "baseUrl": "./libs",
    "paths": {
      "@app/shared": ["shared"],
    },
  },
}`,
      "packages/web/tsconfig.json": "{ \"extends\": \"../../tsconfig.base.json\" }",
      "libs/shared/index.ts": `export function share(): number {
  return 1;
}
`,
      "packages/web/app.ts": `import { share } from "@app/shared";

export function run(): number {
  return share();
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["packages/web/app.ts"],
      "share",
      file_paths["libs/shared/index.ts"]
    );
  });

  it("resolves a workspace package through its exports entry point", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": { ".": { "import": "./src/index.ts" } }
}`,
      "packages/core/src/index.ts": `export function core(): number {
  return 1;
}
`,
      "packages/app/main.ts": `import { core } from "@scope/core";

export function run(): number {
  return core();
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["packages/app/main.ts"],
      "core",
      file_paths["packages/core/src/index.ts"]
    );
  });

  it("resolves a workspace package's subpath export", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing/harness.ts"
  }
}`,
      "packages/core/src/index.ts": `export function core(): number {
  return 1;
}
`,
      "packages/core/src/testing/harness.ts": `export function harness(): number {
  return 2;
}
`,
      "packages/app/main.ts": `import { harness } from "@scope/core/testing";

export function run(): number {
  return harness();
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["packages/app/main.ts"],
      "harness",
      file_paths["packages/core/src/testing/harness.ts"]
    );
  });

  it("resolves a deep import into a package whose exports names its entry point", async () => {
    // A specifier the `exports` map does not list sits beside the entry point it
    // does, not under it.
    const { project, temp_dir, file_paths } = await setup_project({
      "packages/core/package.json": `{
  "name": "@scope/core",
  "exports": { ".": "./src/index.ts" }
}`,
      "packages/core/src/index.ts": `export function core(): number {
  return 1;
}
`,
      "packages/core/src/util/helper.ts": `export function helper(): number {
  return 2;
}
`,
      "packages/app/main.ts": `import { helper } from "@scope/core/util/helper";

export function run(): number {
  return helper();
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["packages/app/main.ts"],
      "helper",
      file_paths["packages/core/src/util/helper.ts"]
    );
  });

  it("resolves a deep import through an alias naming a file without its extension", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "tsconfig.json": `{
  "compilerOptions": {
    "paths": { "@app/lib": ["./src/lib/index"] },
  },
}`,
      "src/lib/index.ts": `export function entry(): number {
  return 1;
}
`,
      "src/lib/deep.ts": `export function deep(): number {
  return 2;
}
`,
      "src/app.ts": `import { deep } from "@app/lib/deep";

export function run(): number {
  return deep();
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/app.ts"],
      "deep",
      file_paths["src/lib/deep.ts"]
    );
  });

  it("leaves a genuinely external specifier opaque", async () => {
    // Decoys the resolver must not reach for: a directory whose name looks like
    // the specifier's scope, and a workspace package whose declared name differs
    // from its directory.
    const { project, temp_dir, file_paths } = await setup_project({
      "vendor/ui/index.ts": `export function render(): number {
  return 1;
}
`,
      "packages/other/package.json": "{ \"name\": \"@other/pkg\" }",
      "packages/other/index.ts": `export function render(): number {
  return 2;
}
`,
      "packages/app/main.ts": `import { render } from "@vendor/ui";

export function run(): number {
  return render();
}
`,
    });
    temp_dirs.push(temp_dir);

    const import_def = Array.from(
      project.get_index_single_file(file_paths["packages/app/main.ts"])!
        .imported_symbols.values()
    ).find((imp) => imp.name === ("render" as SymbolName));
    expect(import_def).toBeDefined();
    expect(
      project.imports.get_resolved_import_path(import_def!.symbol_id)
    ).toEqual("@vendor/ui" as FilePath);

    const call = project.resolutions
      .get_calls_for_file(file_paths["packages/app/main.ts"])
      .find((c) => c.name === ("render" as SymbolName));
    expect(call).toBeDefined();
    expect(call!.resolutions).toEqual([]);
    expect(call!.resolution_failure?.reason).toEqual("name_not_in_scope");
  });

  it("resolves a two-statement named re-export through to the origin definition", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "src/leaf.ts": `export function origin_fn(): number {
  return 1;
}
`,
      "src/middle.ts": `import { origin_fn } from "./leaf";
export { origin_fn };
`,
      "src/consumer.ts": `import { origin_fn } from "./middle";

export function drive(): number {
  return origin_fn();
}
`,
    });
    temp_dirs.push(temp_dir);

    expect_call_resolves_to(
      project,
      file_paths["src/consumer.ts"],
      "origin_fn",
      file_paths["src/leaf.ts"]
    );
  });
});

/**
 * The exported-singleton idiom — `export const extUri = new ExtUri()`, imported
 * and used from more than one file — driven through the BULK path in three
 * arrival orders.
 *
 * The bulk path is what the guard is written against, and it is not
 * interchangeable with `Project.update_file`: `resolve_corpus` runs phase 2.5
 * for every file before it resolves any, so a constructor binding looked up by
 * location sees every importer's rewritten import location already in the
 * registry. The per-arrival driver resolves each file against the corpus as it
 * stood when that file landed, and never asks the question at a moment when
 * more than one file could answer it.
 */
describe("TypeScript Ingest Order Independence", () => {
  const SINGLETON = `export class ExtUri {
  compare(left: string, right: string): number {
    return left < right ? -1 : 1;
  }

  basename(target: string): string {
    return target;
  }
}

export const extUri = new ExtUri();
`;

  const FIRST_CONSUMER = `import { extUri } from "./singleton";

export function sort_paths(paths: string[]): string[] {
  return [...paths].sort((left, right) => extUri.compare(left, right));
}
`;

  const SECOND_CONSUMER = `import { extUri } from "./singleton";

export function name_of(target: string): string {
  return extUri.basename(target);
}
`;

  /**
   * The reported graph as text: node ids, entry points, and every resolved
   * caller-to-callee edge, each path made relative so three runs over one
   * directory are comparable.
   */
  function call_graph_shape(project: Project, temp_dir: string): string[] {
    const call_graph = project.get_call_graph();
    const relative = (value: string) => value.split(`${temp_dir}/`).join("");

    const lines: string[] = [];
    for (const symbol_id of call_graph.nodes.keys()) {
      lines.push(`node ${relative(symbol_id)}`);
    }
    for (const symbol_id of call_graph.entry_points) {
      lines.push(`entry ${relative(symbol_id)}`);
    }
    for (const [caller, node] of call_graph.nodes) {
      for (const call of node.enclosed_calls) {
        for (const resolution of call.resolutions) {
          lines.push(
            `edge ${relative(caller)} -> ${relative(resolution.symbol_id)}`
          );
        }
      }
    }
    return lines.sort();
  }

  it("reports one call graph whichever order the corpus is ingested in", async () => {
    const temp_dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ariadne-ts-ingest-order-")
    );
    temp_dirs.push(temp_dir);

    const sources: Record<string, string> = {
      "singleton.ts": SINGLETON,
      "consumer_a.ts": FIRST_CONSUMER,
      "consumer_b.ts": SECOND_CONSUMER,
    };
    for (const [name, content] of Object.entries(sources)) {
      fs.writeFileSync(path.join(temp_dir, name), content);
    }

    const orders = [
      ["singleton.ts", "consumer_a.ts", "consumer_b.ts"],
      ["consumer_b.ts", "consumer_a.ts", "singleton.ts"],
      ["consumer_a.ts", "singleton.ts", "consumer_b.ts"],
    ];

    const shapes: string[][] = [];
    for (const order of orders) {
      const project = new Project();
      await project.initialize(temp_dir as FilePath);
      for (const name of order) {
        project.ingest_file(
          path.join(temp_dir, name) as FilePath,
          sources[name]
        );
      }
      project.resolve_corpus();
      shapes.push(call_graph_shape(project, temp_dir));
    }

    expect(shapes[1]).toEqual(shapes[0]);
    expect(shapes[2]).toEqual(shapes[0]);

    // The idiom named in the shape, so a run that agreed on an empty graph
    // could not pass: both methods reached through the singleton are called.
    expect(shapes[0]).toContain(
      "edge function:consumer_a.ts:4:26:4:69:<anonymous> -> method:singleton.ts:2:3:2:9:compare"
    );
    expect(shapes[0]).toContain(
      "edge function:consumer_b.ts:3:17:3:23:name_of -> method:singleton.ts:6:3:6:10:basename"
    );
  });
});
