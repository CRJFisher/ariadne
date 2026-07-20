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
 *
 * The evidence cases are committed fixtures under
 * tests/fixtures/typescript/code/integration/optional_param_properties/ rather
 * than inline strings: the NestJS cases span two files that import each other,
 * so they are grouped in their own subdirectory and copied into an isolated
 * temp dir per test to keep cross-file resolution self-contained.
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

describe("TypeScript optional ctor param-property receiver resolution (TASK-350)", () => {
  describe("NestJS ApplicationConfig cluster", () => {
    it("getGlobalPipes is reachable via a private readonly optional param-property receiver", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "application_config.ts",
        "pipes_context_creator.ts",
      ]);
      const call_graph = project.get_call_graph();

      assert_member_reachable(call_graph, "getGlobalPipes", file_paths["application_config.ts"]);
    });

    it("getGlobalGuards is reachable via the same optional param-property receiver", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "application_config.ts",
        "pipes_context_creator.ts",
      ]);
      const call_graph = project.get_call_graph();

      assert_member_reachable(call_graph, "getGlobalGuards", file_paths["application_config.ts"]);
    });
  });

  describe("NestJS TestingInjector", () => {
    it("setMocker is reachable via a public (non-readonly) optional param-property receiver", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "application_config.ts",
        "testing_injector.ts",
      ]);
      const call_graph = project.get_call_graph();

      assert_member_reachable(call_graph, "setMocker", file_paths["application_config.ts"]);
    });
  });

  // The recursive members have no external caller, so rather than asserting
  // entry-point absence (as the NestJS cases do), these tests pin the exact
  // resolved self-edge — the method's own call site resolving back to itself
  // through `this.previous` — which is a stronger proof that the optional
  // self-typed param-property receiver resolved.
  describe("Prisma MergedExtensionsList recursive cluster", () => {
    it("getAllComputedFields resolves its recursive this.previous?.method() self-call", async () => {
      const { project, file_paths } = await project_from_fixtures([
        "merged_extensions_list.ts",
      ]);
      const call_graph = project.get_call_graph();
      const file = file_paths["merged_extensions_list.ts"];

      const method_node = Array.from(call_graph.nodes.values()).find(
        (n) =>
          n.name === ("getAllComputedFields" as SymbolName) &&
          n.location.file_path === file
      );
      expect(method_node).toBeDefined();
      const self_call = method_node!.enclosed_calls.find(
        (c) => c.name === ("getAllComputedFields" as SymbolName)
      );
      expect(self_call).toBeDefined();
      expect(self_call!.resolutions.some((r) => r.symbol_id === method_node!.symbol_id)).toBe(true);
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
      );
      expect(method_node).toBeDefined();
      const self_call = method_node!.enclosed_calls.find(
        (c) => c.name === ("getAllQueryCallbacks" as SymbolName)
      );
      expect(self_call).toBeDefined();
      expect(self_call!.resolutions.some((r) => r.symbol_id === method_node!.symbol_id)).toBe(true);
    });
  });
});

/**
 * Loads a single inline TypeScript source into an isolated Project, so a
 * self-contained snippet exercises the full index → resolve → call-graph
 * pipeline without a committed fixture file.
 */
async function project_from_inline(
  source: string
): Promise<{ project: Project; file: FilePath }> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-task360-"));
  temp_dirs.push(temp_dir);
  const file = path.join(temp_dir, "di.ts") as FilePath;
  fs.writeFileSync(file, source);

  const project = new Project();
  await project.initialize(temp_dir as FilePath);
  project.update_file(file, source);
  return { project, file };
}

/**
 * The SymbolId of the given method on the given class, in the given file.
 */
function method_symbol_id(
  call_graph: CallGraph,
  method: string,
  file: FilePath
): string | undefined {
  return Array.from(call_graph.nodes.values()).find(
    (n) =>
      n.name === (method as SymbolName) && n.location.file_path === file
  )?.symbol_id;
}

describe("TypeScript generic return type from type-token argument (TASK-360)", () => {
  it("injector.get(Token).method() resolves the method against the token class", async () => {
    const { project, file } = await project_from_inline(`
class Service {
  handle(): void {}
}
interface Type<T> {}
class Injector {
  get<T>(token: Type<T>): T {
    return null as unknown as T;
  }
}
function run(injector: Injector): void {
  injector.get(Service).handle();
}
`);
    const call_graph = project.get_call_graph();

    const handle_id = method_symbol_id(call_graph, "handle", file);
    const run_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("run" as SymbolName)
    );
    const handle_call = run_node?.enclosed_calls.find(
      (c) => c.name === ("handle" as SymbolName)
    );
    expect(handle_call?.resolutions.map((r) => r.symbol_id)).toEqual([handle_id]);
  });

  it("infers the generic return for a differently-named container and provider", async () => {
    const { project, file } = await project_from_inline(`
class Widget {
  render(): void {}
}
interface Provider<R> {}
class Container {
  resolve<R>(marker: Provider<R>): R {
    return null as unknown as R;
  }
}
function go(container: Container): void {
  container.resolve(Widget).render();
}
`);
    const call_graph = project.get_call_graph();

    const render_id = method_symbol_id(call_graph, "render", file);
    const go_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("go" as SymbolName)
    );
    const render_call = go_node?.enclosed_calls.find(
      (c) => c.name === ("render" as SymbolName)
    );
    expect(render_call?.resolutions.map((r) => r.symbol_id)).toEqual([render_id]);
  });

  it("infers the generic return when the token is a parameter typed Type<Service>", async () => {
    const { project, file } = await project_from_inline(`
class Service {
  handle(): void {}
}
interface Type<T> {}
class Injector {
  get<T>(token: Type<T>): T {
    return null as unknown as T;
  }
}
function run(injector: Injector, token: Type<Service>): void {
  injector.get(token).handle();
}
`);
    const call_graph = project.get_call_graph();

    const handle_id = method_symbol_id(call_graph, "handle", file);
    const run_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("run" as SymbolName)
    );
    const handle_call = run_node?.enclosed_calls.find(
      (c) => c.name === ("handle" as SymbolName)
    );
    expect(handle_call?.resolutions.map((r) => r.symbol_id)).toEqual([handle_id]);
  });

  it("does not infer when the generic return has no type-token parameter", async () => {
    const { project } = await project_from_inline(`
class Service {
  handle(): void {}
}
class Injector {
  get<T>(): T {
    return null as unknown as T;
  }
}
function run(injector: Injector): void {
  injector.get(Service).handle();
}
`);
    const call_graph = project.get_call_graph();

    const run_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("run" as SymbolName)
    );
    const handle_call = run_node?.enclosed_calls.find(
      (c) => c.name === ("handle" as SymbolName)
    );
    expect(handle_call?.resolutions).toEqual([]);
    expect(handle_call?.resolution_failure?.reason).toBe("member_type_unknown");
  });
});
