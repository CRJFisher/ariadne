import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "../../project/project";
import type { CallGraph, FilePath, SymbolName } from "@ariadnejs/types";

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Loads a single inline TypeScript source into an isolated Project, so a
 * self-contained snippet exercises the full index → resolve → call-graph
 * pipeline without a committed fixture file.
 */
async function project_from_inline(
  source: string
): Promise<{ project: Project; file: FilePath }> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-type-token-"));
  temp_dirs.push(temp_dir);
  const file = path.join(temp_dir, "di.ts") as FilePath;
  fs.writeFileSync(file, source);

  const project = new Project();
  await project.initialize(temp_dir as FilePath);
  project.update_file(file, source);
  return { project, file };
}

/** The SymbolId of the method named `method` in `file`. */
function method_symbol_id(
  call_graph: CallGraph,
  method: string,
  file: FilePath
): string | undefined {
  return Array.from(call_graph.nodes.values()).find(
    (n) => n.name === (method as SymbolName) && n.location.file_path === file
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

  it("infers the generic return when both token annotations are nullable", async () => {
    const { project, file } = await project_from_inline(`
class Service {
  handle(): void {}
}
interface Type<T> {}
class Injector {
  get<T>(token: Type<T> | null): T {
    return null as unknown as T;
  }
}
function run(injector: Injector, token: Type<Service> | undefined): void {
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

  it.each([
    ["T[]", "Service[]"],
    ["Array<T>", "Array<Service>"],
  ])("does not infer when the parameter is an array of the generic (%s), not a token wrapping it", async (parameter_type, argument_type) => {
    const { project } = await project_from_inline(`
class Service {
  handle(): void {}
}
class Injector {
  get<T>(tokens: ${parameter_type}): T {
    return null as unknown as T;
  }
}
function run(injector: Injector, tokens: ${argument_type}): void {
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
