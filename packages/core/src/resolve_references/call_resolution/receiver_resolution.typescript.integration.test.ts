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

  it("selects the token parameter that binds the return type, not the first parameter", async () => {
    const { project, file } = await project_from_inline(`
class Service {
  handle(): void {}
}
interface Key<K> {}
interface Type<T> {}
class Injector {
  get<K, T>(key: Key<K>, token: Type<T>): T {
    return null as unknown as T;
  }
}
function run(injector: Injector, key: Key<string>): void {
  injector.get(key, Service).handle();
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

  it("infers across a file boundary when the token class is imported", async () => {
    const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-task360-xfile-"));
    temp_dirs.push(temp_dir);
    const service_file = path.join(temp_dir, "service.ts") as FilePath;
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;
    const service_src = `
export class Service {
  handle(): void {}
}
`;
    const consumer_src = `
import { Service } from "./service";
interface Type<T> {}
class Injector {
  get<T>(token: Type<T>): T {
    return null as unknown as T;
  }
}
function run(injector: Injector): void {
  injector.get(Service).handle();
}
`;
    fs.writeFileSync(service_file, service_src);
    fs.writeFileSync(consumer_file, consumer_src);
    const project = new Project();
    await project.initialize(temp_dir as FilePath);
    project.update_file(service_file, service_src);
    project.update_file(consumer_file, consumer_src);
    const call_graph = project.get_call_graph();

    const handle_id = method_symbol_id(call_graph, "handle", service_file);
    const run_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("run" as SymbolName)
    );
    const handle_call = run_node?.enclosed_calls.find(
      (c) => c.name === ("handle" as SymbolName)
    );
    expect(handle_call?.resolutions.map((r) => r.symbol_id)).toEqual([handle_id]);
  });

  it("does not infer when the token parameter is a multi-argument generic", async () => {
    const { project } = await project_from_inline(`
class Service {
  handle(): void {}
}
interface Registry<K, V> {}
class Injector {
  get<K, T>(token: Registry<K, T>): T {
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

  it("does not infer when the return type is a composite of the generic, not the bare generic", async () => {
    const { project } = await project_from_inline(`
class Service {
  handle(): void {}
}
interface Type<T> {}
class Injector {
  get<T>(token: Type<T>): T[] {
    return [];
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

  it("does not infer when the parameter is an array of the generic, not a token wrapping it", async () => {
    const { project } = await project_from_inline(`
class Service {
  handle(): void {}
}
class Injector {
  get<T>(tokens: T[]): T {
    return null as unknown as T;
  }
}
function run(injector: Injector, tokens: Service[]): void {
  injector.get(tokens).handle();
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

describe("TypeScript interface-typed destructured binding receivers (TASK-389)", () => {
  /** The SymbolId of the given method's resolution targets at its call site. */
  function resolutions_of(
    call_graph: CallGraph,
    caller: string,
    call_name: string
  ): string[] {
    const caller_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === (caller as SymbolName)
    );
    const call = caller_node?.enclosed_calls.find(
      (c) => c.name === (call_name as SymbolName)
    );
    return (call?.resolutions ?? []).map((r) => r.symbol_id as string);
  }

  it("reaches the implementation through a destructured interface-typed option binding", async () => {
    const { project, file } = await project_from_inline(`
interface PersistenceStorage {
  sweep(paths: Set<string>): void;
}
class FileSystemStorage implements PersistenceStorage {
  sweep(paths: Set<string>): void {}
}
interface Options {
  storage?: PersistenceStorage;
}
function load(options: Options): void {
  const { storage } = options;
  storage!.sweep(new Set());
}
`);
    const call_graph = project.get_call_graph();
    assert_member_reachable(call_graph, "sweep", file);

    const impl_id = method_symbol_id(call_graph, "sweep", file);
    expect(resolutions_of(call_graph, "load", "sweep")).toContain(impl_id);
  });

  it("attributes the dispatch to the interface member as well as the implementation", async () => {
    const { project, file } = await project_from_inline(`
interface PersistenceStorage {
  sweep(paths: Set<string>): void;
}
class FileSystemStorage implements PersistenceStorage {
  sweep(paths: Set<string>): void {}
}
interface Options {
  storage?: PersistenceStorage;
}
function load(options: Options): void {
  const { storage } = options;
  storage!.sweep(new Set());
}
`);
    const call_graph = project.get_call_graph();

    const index = project.get_index_single_file(file);
    const interface_member_id = Array.from(index!.interfaces.values())
      .find((i) => (i.name as string) === "PersistenceStorage")
      ?.methods.find((m) => (m.name as string) === "sweep")?.symbol_id as string;
    const impl_id = method_symbol_id(call_graph, "sweep", file);

    expect(resolutions_of(call_graph, "load", "sweep").sort()).toEqual(
      [interface_member_id, impl_id].sort()
    );
    // The interface member gains an incoming edge without becoming a node.
    expect(call_graph.nodes.has(interface_member_id as SymbolName as never)).toBe(false);

    // The head is the interface member (direct); the implementation reaches it
    // by implementing the interface, named as its declaring interface.
    const load_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("load" as SymbolName)
    );
    const sweep_call = load_node?.enclosed_calls.find(
      (c) => c.name === ("sweep" as SymbolName)
    );
    const interface_type_id = Array.from(
      project.get_index_single_file(file)!.interfaces.values()
    ).find((i) => (i.name as string) === "PersistenceStorage")!.symbol_id;
    const by_id = new Map(
      (sweep_call?.resolutions ?? []).map((r) => [r.symbol_id as string, r])
    );
    expect(by_id.get(interface_member_id)?.reason).toEqual({ type: "direct" });
    expect(by_id.get(impl_id!)?.reason).toEqual({
      type: "interface_implementation",
      interface_id: interface_type_id,
    });
  });

  it("attributes a class dispatch to its base and overrides, each of them direct", async () => {
    const { project, file } = await project_from_inline(`
class Base {
  handle(): void {}
}
class Derived extends Base {
  handle(): void {}
}
function run(base: Base): void {
  base.handle();
}
`);
    const call_graph = project.get_call_graph();
    const run_node = Array.from(call_graph.nodes.values()).find(
      (n) => n.name === ("run" as SymbolName)
    );
    const handle_call = run_node?.enclosed_calls.find(
      (c) => c.name === ("handle" as SymbolName)
    );
    expect(handle_call?.resolutions.length).toBe(2);
    for (const resolution of handle_call?.resolutions ?? []) {
      expect(resolution.reason).toEqual({ type: "direct" });
    }
  });

  it("reaches the implementation through a binding destructured from another destructured binding", async () => {
    const { project, file } = await project_from_inline(`
interface PersistenceStorage {
  sweep(paths: Set<string>): void;
}
class FileSystemStorage implements PersistenceStorage {
  sweep(paths: Set<string>): void {}
}
interface Inner {
  storage: PersistenceStorage;
}
interface Options {
  inner: Inner;
}
function load(options: Options): void {
  const { inner } = options;
  const { storage } = inner;
  storage.sweep(new Set());
}
`);
    const call_graph = project.get_call_graph();
    assert_member_reachable(call_graph, "sweep", file);
  });

  it("reaches the implementation through a renamed destructured binding", async () => {
    const { project, file } = await project_from_inline(`
interface PersistenceStorage {
  sweep(paths: Set<string>): void;
}
class FileSystemStorage implements PersistenceStorage {
  sweep(paths: Set<string>): void {}
}
interface Options {
  storage?: PersistenceStorage;
}
function load(options: Options): void {
  const { storage: store } = options;
  store!.sweep(new Set());
}
`);
    const call_graph = project.get_call_graph();
    assert_member_reachable(call_graph, "sweep", file);
  });

  it("leaves the implementation an entry point when the destructuring source is a call", async () => {
    const { project, file } = await project_from_inline(`
interface PersistenceStorage {
  sweep(paths: Set<string>): void;
}
class FileSystemStorage implements PersistenceStorage {
  sweep(paths: Set<string>): void {}
}
interface Options {
  storage?: PersistenceStorage;
}
function make(): Options {
  return { storage: new FileSystemStorage() };
}
function load(): void {
  const { storage } = make();
  storage!.sweep(new Set());
}
`);
    const call_graph = project.get_call_graph();
    expect(entry_point_for(call_graph, "sweep", file)).toBeDefined();
  });
});
