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
