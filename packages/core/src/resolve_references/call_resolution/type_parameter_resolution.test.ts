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

/** Write `files` to a fresh directory and load every one of them. */
async function load_project(
  files: Readonly<Record<string, string>>
): Promise<{ project: Project; paths: Record<string, FilePath> }> {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "type-parameter-")));
  temp_dirs.push(dir);
  const paths: Record<string, FilePath> = {};
  const project = new Project();
  await project.initialize(dir as FilePath);
  for (const [name, source] of Object.entries(files)) {
    const file = path.join(dir, name) as FilePath;
    paths[name] = file;
    fs.writeFileSync(file, source);
    project.update_file(file, source);
  }
  return { project, paths };
}

/** One inline source, loaded as the project's only file. */
async function project_from_inline(
  source: string,
  extension = "ts"
): Promise<{ project: Project; file: FilePath }> {
  const name = `main.${extension}`;
  const { project, paths } = await load_project({ [name]: source });
  return { project, file: paths[name] };
}

/** The SymbolId the member `name` declared in `file` has in the call graph. */
function member_id(call_graph: CallGraph, name: string, file: FilePath): string | undefined {
  return [...call_graph.nodes.values()].find(
    (node) => node.name === (name as SymbolName) && node.location.file_path === file
  )?.symbol_id;
}

/**
 * The member the project holds under `type_name.member_name`. A trait or
 * interface method with no body is no call-graph node, so a target list that
 * leads with one is only reachable through the member index.
 */
function member_of(project: Project, file: FilePath, type_name: string, member_name: string): string {
  const index = project.get_index_single_file(file);
  const type_id = [...(index?.classes.values() ?? []), ...(index?.interfaces.values() ?? [])].find(
    (def) => def.name === (type_name as SymbolName)
  )?.symbol_id;
  if (type_id === undefined) {
    throw new Error(`${file} declares no type named ${type_name}`);
  }
  const member = project.definitions
    .get_member_index()
    .get(type_id)
    ?.get(member_name as SymbolName);
  if (member === undefined) {
    throw new Error(`${type_name} holds no member named ${member_name}`);
  }
  return member;
}

/** The one call to `callee` made inside `caller`. */
function call_in(call_graph: CallGraph, caller: string, callee: string) {
  const caller_node = [...call_graph.nodes.values()].find(
    (node) => node.name === (caller as SymbolName)
  );
  return caller_node?.enclosed_calls.find((call) => call.name === (callee as SymbolName));
}

describe("a generic return bound from the call's arguments", () => {
  it("resolves a type token against the class its argument names", async () => {
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

    expect(call_in(call_graph, "run", "handle")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "handle", file),
    ]);
  });

  it("resolves a token wrapper and provider whatever they are named", async () => {
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

    expect(call_in(call_graph, "go", "render")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "render", file),
    ]);
  });

  it("resolves through a token the caller holds as a parameter", async () => {
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

    expect(call_in(call_graph, "run", "handle")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "handle", file),
    ]);
  });

  it("resolves when both token annotations are nullable", async () => {
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

    expect(call_in(call_graph, "run", "handle")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "handle", file),
    ]);
  });

  it("binds each parameter from the argument standing at its own position", async () => {
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

    expect(call_in(call_graph, "run", "handle")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "handle", file),
    ]);
  });

  it("resolves a sequence parameter's element, which the token rule alone could not read", async () => {
    const { project, file } = await project_from_inline(`
class Service {
  handle(): void {}
}
class Injector {
  first<T>(tokens: T[]): T {
    return tokens[0];
  }
}
function run(injector: Injector, tokens: Service[]): void {
  injector.first(tokens).handle();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "run", "handle")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "handle", file),
    ]);
  });

  it("reads the element of a sequence a local constant declares", async () => {
    const { project, file } = await project_from_inline(`
class Service {
  handle(): void {}
}
class Injector {
  first<T>(tokens: T[]): T {
    return tokens[0];
  }
}
function run(injector: Injector): void {
  const tokens: Service[] = [];
  injector.first(tokens).handle();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "run", "handle")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "handle", file),
    ]);
  });

  it("resolves across a file boundary when the token class is imported", async () => {
    const { project, paths } = await load_project({
      "service.ts": `
export class Service {
  handle(): void {}
}
`,
      "consumer.ts": `
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
`,
    });
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "run", "handle")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "handle", paths["service.ts"]),
    ]);
  });
});

describe("a generic factory's result", () => {
  it("types a binding from the type token the factory call was handed", async () => {
    const { project, file } = await project_from_inline(`
class Router {
  navigate(): void {}
}
interface Type<T> {}
function create<T>(token: Type<T>): T {
  return null as unknown as T;
}
function run(): void {
  const router = create(Router);
  router.navigate();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "run", "navigate")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "navigate", file),
    ]);
  });

  it("types a binding from a factory another file declares", async () => {
    const { project, paths } = await load_project({
      "router.ts": `
export class Router {
  navigate(): void {}
}
`,
      "factory.ts": `
export interface Type<T> {}
export function create<T>(token: Type<T>): T {
  return null as unknown as T;
}
`,
      "consumer.ts": `
import { Router } from "./router";
import { create } from "./factory";
function run(): void {
  const router = create(Router);
  router.navigate();
}
`,
    });
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "run", "navigate")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "navigate", paths["router.ts"]),
    ]);
  });

  it("binds a same-named factory in two files to the class each file hands it", async () => {
    const { project, paths } = await load_project({
      "a.ts": `
export class Alpha {
  only_on_alpha(): void {}
}
export interface Type<T> {}
export function create<T>(token: Type<T>): T {
  return null as unknown as T;
}
export function run_a(): void {
  const x = create(Alpha);
  x.only_on_alpha();
}
`,
      "b.ts": `
export class Beta {
  only_on_beta(): void {}
}
export interface Type<T> {}
export function create<T>(token: Type<T>): T {
  return null as unknown as T;
}
export function run_b(): void {
  const x = create(Beta);
  x.only_on_beta();
}
`,
    });
    const call_graph = project.get_call_graph();

    expect(
      call_in(call_graph, "run_a", "only_on_alpha")?.resolutions.map((r) => r.symbol_id)
    ).toEqual([member_id(call_graph, "only_on_alpha", paths["a.ts"])]);
    expect(
      call_in(call_graph, "run_b", "only_on_beta")?.resolutions.map((r) => r.symbol_id)
    ).toEqual([member_id(call_graph, "only_on_beta", paths["b.ts"])]);
  });

  it("leaves a binding from a factory call that binds nothing untyped", async () => {
    const { project } = await project_from_inline(`
class Router {
  navigate(): void {}
}
function create<T>(): T {
  return null as unknown as T;
}
function run(): void {
  const router = create();
  router.navigate();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "run", "navigate")?.resolutions).toEqual([]);
  });
});

describe("a generic return bound from the receiver's declared instantiation", () => {
  it("resolves a method returning the type argument its receiver was declared with", async () => {
    const { project, file } = await project_from_inline(`
class Foo {
  run(): void {}
}
class Provider<T> {
  get(): T {
    return null as unknown as T;
  }
}
function use(provider: Provider<Foo>): void {
  provider.get().run();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "use", "run")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "run", file),
    ]);
  });

  it("resolves a method returning the type argument a local constant was declared with", async () => {
    const { project, file } = await project_from_inline(`
class Foo {
  run(): void {}
}
class Provider<T> {
  get(): T {
    return null as unknown as T;
  }
}
function use(): void {
  const provider: Provider<Foo> = new Provider<Foo>();
  provider.get().run();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "use", "run")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "run", file),
    ]);
  });

  it("reads the head of a nested type argument", async () => {
    const { project, file } = await project_from_inline(`
class Bar {}
class Foo<E> {
  run(): void {}
}
class Provider<T> {
  get(): T {
    return null as unknown as T;
  }
}
function use(provider: Provider<Foo<Bar>>): void {
  provider.get().run();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "use", "run")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "run", file),
    ]);
  });

  it("binds nothing from a subtype instantiation, whose argument order is its own", async () => {
    const { project } = await project_from_inline(`
class Foo {
  run(): void {}
}
class Provider<T> {
  get(): T {
    return null as unknown as T;
  }
}
class MyProvider<A, T> extends Provider<T> {}
function use(provider: MyProvider<string, Foo>): void {
  provider.get().run();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "use", "run")?.resolutions).toEqual([]);
  });
});

describe("a method's own type parameter shadowing its owning type's", () => {
  it("answers from the method's own bound, not the receiver's instantiation", async () => {
    const { project, file } = await project_from_inline(`
class Foo {
  foo(): void {}
}
class Base {
  base_method(): void {}
}
class Box<T> {
  wrap<T extends Base>(): T {
    return null as unknown as T;
  }
}
function use(box: Box<Foo>): void {
  box.wrap().base_method();
}
`);
    const call_graph = project.get_call_graph();

    expect(
      call_in(call_graph, "use", "base_method")?.resolutions.map((r) => r.symbol_id)
    ).toEqual([member_id(call_graph, "base_method", file)]);
  });

  it("does not leak the receiver's instantiation into the method's own parameter", async () => {
    const { project } = await project_from_inline(`
class Foo {
  foo(): void {}
}
class Base {
  base_method(): void {}
}
class Box<T> {
  wrap<T extends Base>(): T {
    return null as unknown as T;
  }
}
function use(box: Box<Foo>): void {
  box.wrap().foo();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "use", "foo")?.resolutions).toEqual([]);
  });
});

describe("a receiver typed by a bounded type parameter", () => {
  it("reaches the bound's members from a Rust trait bound", async () => {
    const { project, file } = await project_from_inline(
      `
pub trait Visitor {
    fn visit_item(&mut self);
}

pub struct Collector {}

impl Visitor for Collector {
    fn visit_item(&mut self) {}
}

pub fn walk<V: Visitor>(v: &mut V) {
    v.visit_item();
}
`,
      "rs"
    );
    const call_graph = project.get_call_graph();

    // The bound types the receiver as the trait, and trait-typed dispatch then
    // fans out to the implementer, exactly as a `dyn Visitor` receiver does.
    expect(call_in(call_graph, "walk", "visit_item")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_of(project, file, "Visitor", "visit_item"),
      member_of(project, file, "Collector", "visit_item"),
    ]);
  });

  it("reaches the bound's members from a Rust local annotated with the parameter", async () => {
    const { project, file } = await project_from_inline(
      `
pub trait Visitor {
    fn visit_item(&mut self);
}

pub struct Collector {}

impl Visitor for Collector {
    fn visit_item(&mut self) {}
}

pub fn walk<V: Visitor>(v: V) {
    let mut inner: V = v;
    inner.visit_item();
}
`,
      "rs"
    );
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "walk", "visit_item")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_of(project, file, "Visitor", "visit_item"),
      member_of(project, file, "Collector", "visit_item"),
    ]);
  });

  it("reaches the constraint's members from a TypeScript `extends` bound", async () => {
    const { project, file } = await project_from_inline(`
class Base {
  describe(): void {}
}
function show<T extends Base>(item: T): void {
  item.describe();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "show", "describe")?.resolutions.map((r) => r.symbol_id)).toEqual([
      member_id(call_graph, "describe", file),
    ]);
  });

  it("does not fan out to an unrelated class declaring a method of the same name", async () => {
    const { project, file } = await project_from_inline(`
class Base {
  describe_self(): void {}
}
class Derived extends Base {
  describe_self(): void {}
}
class Unrelated {
  describe_self(): void {}
}
function show<T extends Base>(item: T): void {
  item.describe_self();
}
`);
    const call_graph = project.get_call_graph();
    const resolved = call_in(call_graph, "show", "describe_self")?.resolutions.map(
      (r) => r.symbol_id
    );

    expect(resolved).toEqual([
      member_of(project, file, "Base", "describe_self"),
      member_of(project, file, "Derived", "describe_self"),
    ]);
  });

  it("leaves a receiver typed by an unbounded parameter unresolved", async () => {
    const { project } = await project_from_inline(`
class Base {
  describe(): void {}
}
function show<T>(item: T): void {
  item.describe();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "show", "describe")?.resolutions).toEqual([]);
  });
});

describe("a type parameter nothing binds", () => {
  it("leaves the receiver unresolved when no parameter carries the return's type", async () => {
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
    const handle_call = call_in(call_graph, "run", "handle");

    expect(handle_call?.resolutions).toEqual([]);
    expect(handle_call?.resolution_failure?.reason).toBe("member_type_unknown");
  });

  it("leaves the receiver unresolved when the wrapper's arity says nothing about the argument", async () => {
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
    const handle_call = call_in(call_graph, "run", "handle");

    expect(handle_call?.resolutions).toEqual([]);
    expect(handle_call?.resolution_failure?.reason).toBe("member_type_unknown");
  });

  it("leaves the receiver unresolved when the argument is a value rather than the type itself", async () => {
    const { project } = await project_from_inline(`
class Service {
  handle(): void {}
}
interface Type<T> {}
class Injector {
  get<T>(token: Type<T>): T {
    return null as unknown as T;
  }
}
function run(injector: Injector, service: Service): void {
  injector.get(service).handle();
}
`);
    const call_graph = project.get_call_graph();
    const handle_call = call_in(call_graph, "run", "handle");

    expect(handle_call?.resolutions).toEqual([]);
    expect(handle_call?.resolution_failure?.reason).toBe("member_type_unknown");
  });

  it("leaves a receiver whose bound type the project does not hold unresolved", async () => {
    const { project } = await project_from_inline(`
function show<T extends Elsewhere>(item: T): void {
  item.describe();
}
`);
    const call_graph = project.get_call_graph();

    expect(call_in(call_graph, "show", "describe")?.resolutions).toEqual([]);
  });
  it("does not answer from a project type the parameter is merely named after", async () => {
    const { project } = await project_from_inline(`
class T {
  real_method(): void {}
}
class Injector {
  get<T>(): T {
    return null as unknown as T;
  }
}
function run(injector: Injector): void {
  injector.get().real_method();
}
`);
    const call_graph = project.get_call_graph();
    const call = call_in(call_graph, "run", "real_method");

    expect(call?.resolutions).toEqual([]);
    expect(call?.resolution_failure?.reason).toBe("member_type_unknown");
  });

  it("reads a Rust bound rather than the unrelated struct sharing its parameter's name", async () => {
    const { project } = await project_from_inline(
      `
pub struct T {}
impl T {
    pub fn real_method(&self) {}
}

pub trait Visitor {
    fn visit_item(&mut self);
}

pub fn walk<T: Visitor>(v: &mut T) {
    v.visit_item();
}
`,
      "rs"
    );
    const call_graph = project.get_call_graph();
    const call = call_in(call_graph, "walk", "visit_item");

    // The bound types the receiver as `Visitor`, which no type in the file
    // implements, so the lookup fails on that trait -- never on the struct
    // that happens to be called `T`.
    expect(call?.resolutions).toEqual([]);
    expect(call?.resolution_failure?.reason).toBe("method_not_on_type");
  });
});
