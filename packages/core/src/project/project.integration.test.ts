import { describe, it, expect, beforeEach, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "./project";
import type {
  CallReference,
  FilePath,
  LexicalScope,
  ResolutionFailure,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import type {
  ConstructorCallReference,
  MethodCallReference,
  SelfReferenceCall,
  FunctionCallReference,
} from "@ariadnejs/types";

describe("Project - Language-Agnostic Resolution Patterns", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  describe("Shadowing - Cross-Language Consistency", () => {
    it("should resolve shadowed imports correctly in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 'utils'; }");
      project.update_file("main.ts" as FilePath, `
import { helper } from "./utils";
function helper() { return "local"; }
const result = helper();
      `);

      const main_index = project.get_index_single_file("main.ts" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
      );

      expect(helper_call).toBeDefined();
      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        // Should resolve to LOCAL helper in main.ts, not imported one
        expect(resolved_def?.location.file_path).toContain("main.ts");
        expect(resolved_def?.kind).toBe("function");
      }
    });

    it("should resolve shadowed imports correctly in JavaScript", () => {
      project.update_file("utils.js" as FilePath, "export function helper() { return 'utils'; }");
      project.update_file("main.js" as FilePath, `
import { helper } from "./utils";
function helper() { return "local"; }
const result = helper();
      `);

      const main_index = project.get_index_single_file("main.js" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
      );

      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("main.js");
      }
    });

    it("should resolve shadowed imports correctly in Python", () => {
      project.update_file("utils.py" as FilePath, "def helper():\n    return 'utils'");
      project.update_file("main.py" as FilePath, `
from utils import helper

def helper():
    return "local"

result = helper()
      `);

      const main_index = project.get_index_single_file("main.py" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
      );

      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("main.py");
      }
    });
  });

  describe("Nested Scopes", () => {
    it("should create nested scopes for TypeScript functions", () => {
      project.update_file("test.ts" as FilePath, `
function outer() {
  function inner() {
    return 42;
  }
}
      `);

      const index = project.get_index_single_file("test.ts" as FilePath);
      const scopes = Array.from(index!.scopes.values());

      // Should have module scope, outer scope, inner scope
      expect(scopes.length).toBeGreaterThanOrEqual(3);

      // Verify scope hierarchy exists
      const nested_scopes = scopes.filter((s) => s.parent_id !== null);
      expect(nested_scopes.length).toBeGreaterThan(0);
    });

    it("should create nested scopes for Python functions", () => {
      project.update_file("test.py" as FilePath, `
def outer():
    def inner():
        return 42
      `);

      const index = project.get_index_single_file("test.py" as FilePath);
      const scopes = Array.from(index!.scopes.values());

      expect(scopes.length).toBeGreaterThanOrEqual(3);

      const nested_scopes = scopes.filter((s) => s.parent_id !== null);
      expect(nested_scopes.length).toBeGreaterThan(0);
    });

    it("should create nested scopes for Rust functions", () => {
      project.update_file("test.rs" as FilePath, `
fn outer() {
    fn inner() -> i32 {
        42
    }
}
      `);

      const index = project.get_index_single_file("test.rs" as FilePath);
      const scopes = Array.from(index!.scopes.values());

      expect(scopes.length).toBeGreaterThanOrEqual(3);

      const nested_scopes = scopes.filter((s) => s.parent_id !== null);
      expect(nested_scopes.length).toBeGreaterThan(0);
    });
  });

  describe("Constructor → Type → Method Chains", () => {
    it("should resolve constructor and method calls in TypeScript", () => {
      project.update_file("test.ts" as FilePath, `
class User {
  constructor(public name: string) {}
  getName() { return this.name; }
}

const user = new User("Alice");
const name = user.getName();
      `);

      const index = project.get_index_single_file("test.ts" as FilePath);

      // Find constructor call
      const constructor_calls = index?.references.filter(
        (r): r is ConstructorCallReference => r.kind === "constructor_call"
      );
      expect(constructor_calls?.length).toBeGreaterThan(0);

      // Find method call
      const method_calls = index?.references.filter(
        (r) => r.kind === "method_call" && r.name === ("getName" as SymbolName)
      );
      expect(method_calls?.length).toBeGreaterThan(0);

      // Verify method resolves
      const method_call = method_calls?.[0];
      if (method_call) {
        const resolved = project.resolutions.resolve(method_call.scope_id, method_call.name);
        expect(resolved).toBeDefined();
      }
    });

    it("resolves a Python construction to the class's constructor and a method call on the constructed variable", () => {
      project.update_file("test.py" as FilePath, `
class User:
    def __init__(self, name):
        self.name = name
    def get_name(self):
        return self.name

user = User("Alice")
name = user.get_name()
      `);

      // The construction is one constructor CallReference reaching `__init__`,
      // and `user` takes `User` as its type from it, so `get_name` resolves.
      const calls = project.resolutions
        .get_calls_for_file("test.py" as FilePath)
        .map((call) => ({
          name: call.name,
          call_type: call.call_type,
          targets: call.resolutions.map((r) => r.symbol_id.split(":").slice(-1)[0]),
        }));
      expect(calls).toEqual([
        { name: "User", call_type: "constructor", targets: ["__init__"] },
        { name: "get_name", call_type: "method", targets: ["get_name"] },
      ]);
    });

    it("should resolve associated functions and methods in Rust", () => {
      project.update_file("test.rs" as FilePath, `
struct User {
    name: String,
}

impl User {
    fn new(name: String) -> Self {
        User { name }
    }
    fn get_name(&self) -> &str {
        &self.name
    }
}

fn main() {
    let user = User::new(String::from("Alice"));
    let name = user.get_name();
}
      `);

      const index = project.get_index_single_file("test.rs" as FilePath);

      // Find User::new() call — captured as constructor_call with the type name
      const new_calls = index?.references.filter(
        (r): r is ConstructorCallReference => r.kind === "constructor_call" && r.name === "User"
      );
      expect(new_calls?.length).toBeGreaterThan(0);

      // Find get_name() method call
      const method_calls = index?.references.filter(
        (r) => r.kind === "method_call" && r.name === ("get_name" as SymbolName)
      );
      expect(method_calls?.length).toBeGreaterThan(0);

      if (method_calls && method_calls.length > 0) {
        const method_call = method_calls[0];
        const resolved = project.resolutions.resolve(method_call.scope_id, method_call.name);
        expect(resolved).toBeDefined();
      }
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve imported function calls across files in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 42; }");
      project.update_file("main.ts" as FilePath, `
import { helper } from "./utils";
const result = helper();
      `);

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find import - verifies import capture works
      const imports = Array.from(main_index!.imported_symbols.values());
      const helper_import = imports.find((i) => i.name === ("helper" as SymbolName));
      expect(helper_import).toBeDefined();
      expect(helper_import?.import_path).toBe("./utils");

      // Find call - verifies call capture works
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      // FULL TEST: Verify cross-module resolution works
      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        expect(resolved).toBeDefined();
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("utils.ts");
        expect(resolved_def?.name).toBe("helper" as SymbolName);
        expect(resolved_def?.kind).toBe("function");
      }
    });

    it("should resolve imported classes and method calls across files in TypeScript", () => {
      project.update_file("types.ts" as FilePath, `
export class User {
  getName() { return "Alice"; }
}
      `);
      project.update_file("main.ts" as FilePath, `
import { User } from "./types";
const user = new User();
const name = user.getName();
      `);

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find class import
      const imports = Array.from(main_index!.imported_symbols.values());
      const user_import = imports.find((i) => i.name === ("User" as SymbolName));
      expect(user_import).toBeDefined();

      // Find constructor call
      const constructor_call = main_index?.references.find(
        (r): r is ConstructorCallReference => r.kind === "constructor_call" && r.name === ("User" as SymbolName)
      );
      expect(constructor_call).toBeDefined();

      // FULL TEST: Verify constructor resolves to imported class
      if (constructor_call) {
        const resolved = project.resolutions.resolve(constructor_call.scope_id, constructor_call.name);
        expect(resolved).toBeDefined();
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("types.ts");
        expect(resolved_def?.name).toBe("User" as SymbolName);
        expect(resolved_def?.kind).toBe("class");
      }

      // Find method call
      const method_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("getName" as SymbolName)
      );
      expect(method_call).toBeDefined();
    });

    it("should resolve imported functions in Python", () => {
      project.update_file("utils.py" as FilePath, "def helper():\n    return 42");
      project.update_file("main.py" as FilePath, `
from utils import helper

result = helper()
      `);

      const main_index = project.get_index_single_file("main.py" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
      );

      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("utils.py");
      }
    });

    it("should resolve imported modules in Rust", () => {
      project.update_file("user_mod.rs" as FilePath, `
pub struct User {
    pub name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }
}
      `);
      project.update_file("main.rs" as FilePath, `
mod user_mod;
use user_mod::User;

fn main() {
    let user = User::new(String::from("Alice"));
}
      `);

      const main_index = project.get_index_single_file("main.rs" as FilePath);

      // Find import
      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.find((i) => i.name === ("User" as SymbolName))).toBeDefined();

      // Find User::new() call — captured as constructor_call with the type name
      const new_call = main_index?.references.find(
        (r): r is ConstructorCallReference => r.kind === "constructor_call" && r.name === "User"
      );
      expect(new_call).toBeDefined();
    });
  });

  describe("Namespace Import Resolution", () => {
    it("should resolve function call via namespace import in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 'utils'; }");
      project.update_file("main.ts" as FilePath, `
import * as utils from "./utils";
const result = utils.helper();
      `);

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find namespace import
      const imports = Array.from(main_index!.imported_symbols.values());
      const utils_import = imports.find((i) => i.name === ("utils" as SymbolName));
      expect(utils_import).toBeDefined();
      expect(utils_import?.import_kind).toBe("namespace");

      // Find method call (namespace member access becomes method call with receiver)
      const helper_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      // Verify call resolves to helper function in utils.ts
      // Note: Namespace member access is a METHOD call, not simple name resolution
      if (helper_call) {
        // Resolve the call using the public API
        const resolved_symbol_id = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );

        expect(resolved_symbol_id).toBeDefined();

        if (resolved_symbol_id) {
          const resolved_def = project.definitions.get(resolved_symbol_id);
          expect(resolved_def?.location.file_path).toContain("utils.ts");
          expect(resolved_def?.name).toBe("helper" as SymbolName);
        }
      }
    });

    it("should resolve multiple members on same namespace in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, `
export function a() { return 1; }
export function b() { return 2; }
      `);
      project.update_file("main.ts" as FilePath, `
import * as utils from "./utils";
const x = utils.a();
const y = utils.b();
      `);

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find both calls
      const a_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("a" as SymbolName)
      );
      const b_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("b" as SymbolName)
      );

      expect(a_call).toBeDefined();
      expect(b_call).toBeDefined();

      // Both should resolve to their definitions in utils.ts
      if (a_call) {
        const resolved_a_symbol = project.resolutions.resolve(
          a_call.scope_id,
          a_call.name
        );
        expect(resolved_a_symbol).toBeDefined();
        if (resolved_a_symbol) {
          const resolved_a_def = project.definitions.get(resolved_a_symbol);
          expect(resolved_a_def?.name).toBe("a" as SymbolName);
          expect(resolved_a_def?.location.file_path).toContain("utils.ts");
        }
      }

      if (b_call) {
        const resolved_b_symbol = project.resolutions.resolve(
          b_call.scope_id,
          b_call.name
        );
        expect(resolved_b_symbol).toBeDefined();
        if (resolved_b_symbol) {
          const resolved_b_def = project.definitions.get(resolved_b_symbol);
          expect(resolved_b_def?.name).toBe("b" as SymbolName);
          expect(resolved_b_def?.location.file_path).toContain("utils.ts");
        }
      }
    });

    it("should return undefined for missing namespace member", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 1; }");
      project.update_file("main.ts" as FilePath, `
import * as utils from "./utils";
const x = utils.missing();
      `);

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find call to missing function
      const missing_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("missing" as SymbolName)
      );
      expect(missing_call).toBeDefined();

      // Should not resolve (missing member)
      if (missing_call) {
        // The reference should exist but not be resolved
        const resolved = project.resolutions.resolve(missing_call.scope_id, missing_call.name);
        expect(resolved).toBeNull();
      }
    });
  });

  describe("Output Structure Validation", () => {
    it("nests function scopes under the module root", () => {
      const file_path = "test.ts" as FilePath;
      project.update_file(file_path, `
function outer() {
  function inner() {
    return 42;
  }
}
      `);

      // Looked up by name rather than by child_ids position — LexicalScope does
      // not promise children in source order.
      const child_named = (scope: LexicalScope, name: string): LexicalScope => {
        const found = scope.child_ids
          .map((id) => project.scopes.get_scope(id))
          .find((child) => child?.name === (name as SymbolName));
        if (!found) throw new Error(`No child scope named ${name} under ${scope.id}`);
        return found;
      };

      const root = project.scopes.get_file_root_scope(file_path);
      if (!root) throw new Error("No root scope indexed for test.ts");
      expect(root.type).toEqual("module");
      expect(root.parent_id).toEqual(null);
      expect(root.location.file_path).toEqual(file_path);

      const outer = child_named(root, "outer");
      expect(outer.type).toEqual("function");
      expect(outer.parent_id).toEqual(root.id);

      const inner = child_named(outer, "inner");
      expect(inner.type).toEqual("function");
      expect(inner.parent_id).toEqual(outer.id);
    });

    it("should produce well-formed Reference objects", () => {
      project.update_file("test.ts" as FilePath, `
function foo() { return bar(); }
function bar() { return 42; }
      `);

      const index = project.get_index_single_file("test.ts" as FilePath);

      for (const ref of index!.references) {
        // SymbolReference fields: location, kind, scope_id, name
        expect(ref.name).toBeDefined();
        expect(ref.kind).toBeDefined();
        expect(ref.scope_id).toBeDefined();
        expect(ref.location).toBeDefined();
      }
    });

  });

  describe("Destructured interface-typed binding re-resolution (TASK-389)", () => {
    function sweep_is_entry_point(project: Project): boolean {
      const cg = project.get_call_graph();
      return cg.entry_points.some((id) => {
        const node = cg.nodes.get(id);
        return (
          node?.name === ("sweep" as SymbolName) &&
          node.location.file_path.includes("fs.ts")
        );
      });
    }

    it("re-resolves a destructured receiver when the interface's file changes", async () => {
      const project = new Project();
      await project.initialize();
      project.update_file(
        "lib.ts" as FilePath,
        `export interface Storage { sweep(): void; }
`
      );
      project.update_file(
        "fs.ts" as FilePath,
        `import { Storage } from "./lib";
export class FileStorage implements Storage { sweep(): void {} }
`
      );
      project.update_file(
        "consumer.ts" as FilePath,
        `import { Storage } from "./lib";
` +
          `interface Opts { storage?: Storage }
` +
          `function load(o: Opts) { const { storage } = o; storage!.sweep(); }
`
      );

      // Reached through the destructured binding: not an entry point.
      expect(sweep_is_entry_point(project)).toBe(false);

      // Renaming the interface leaves the property's annotation naming nothing,
      // so the call no longer reaches FileStorage.sweep — the consumer must
      // re-resolve. (Renaming only the member would not break it: a subtype
      // declaring `sweep` is still reached through the interface.)
      project.update_file(
        "lib.ts" as FilePath,
        `export interface Store { sweep(): void; }
`
      );
      expect(sweep_is_entry_point(project)).toBe(true);

      // Restoring it reconnects the edge.
      project.update_file(
        "lib.ts" as FilePath,
        `export interface Storage { sweep(): void; }
`
      );
      expect(sweep_is_entry_point(project)).toBe(false);

      // Retyping the property the binding is destructured from breaks the hop
      // itself, with the interface left untouched.
      project.update_file(
        "consumer.ts" as FilePath,
        "import { Storage } from \"./lib\";\n" +
          "interface Opts { storage?: number }\n" +
          "function load(o: Opts) { const { storage } = o; storage!.sweep(); }\n"
      );
      expect(sweep_is_entry_point(project)).toBe(true);
    });
  });

  describe("Dispatch through a subtype closure, whatever order files arrive in", () => {
    const FIXTURES_ROOT = path.resolve(__dirname, "../../tests/fixtures");
    const temp_dirs: string[] = [];

    afterAll(() => {
      for (const dir of temp_dirs) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    type Driver = "update_file" | "ingest_file + resolve_corpus";
    const DRIVERS: readonly Driver[] = ["update_file", "ingest_file + resolve_corpus"];

    /** Every file of a committed integration fixture, keyed by file name. */
    function read_fixture(language: string, fixture: string): Record<string, string> {
      const root = path.join(FIXTURES_ROOT, language, "code", "integration", fixture);
      const files: Record<string, string> = {};
      for (const name of fs.readdirSync(root)) {
        files[name] = fs.readFileSync(path.join(root, name), "utf-8");
      }
      return files;
    }

    /** Write `files` to a fresh directory and load `order` of them through `driver`. */
    async function load_project(
      files: Readonly<Record<string, string>>,
      order: readonly string[],
      driver: Driver
    ): Promise<{ project: Project; paths: Record<string, FilePath> }> {
      const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "subtype-dispatch-")));
      temp_dirs.push(dir);
      const paths: Record<string, FilePath> = {};
      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), content);
        paths[name] = path.join(dir, name) as FilePath;
      }
      const project = new Project();
      await project.initialize(dir as FilePath);
      for (const name of order) {
        if (driver === "update_file") {
          project.update_file(paths[name], files[name]);
        } else {
          project.ingest_file(paths[name], files[name]);
        }
      }
      if (driver !== "update_file") {
        project.resolve_corpus();
      }
      return { project, paths };
    }

    function permutations<T>(items: readonly T[]): T[][] {
      if (items.length <= 1) {
        return [[...items]];
      }
      return items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])
      );
    }

    /** Every (order, driver) pair over `names`, labelled for `it.each`. */
    function order_matrix(names: readonly string[]): [string, Driver, string[]][] {
      return DRIVERS.flatMap((driver) =>
        permutations(names).map((order): [string, Driver, string[]] => [order.join(" → "), driver, order])
      );
    }

    /** The one call to `name` on 1-based `line` of `file`. */
    function call_at(project: Project, file: FilePath, name: string, line: number): CallReference {
      const calls = project.resolutions
        .get_calls_for_file(file)
        .filter((call) => call.name === name && call.location.start_line === line);
      expect(calls.length).toBe(1);
      return calls[0];
    }

    /** A call's leading target and the set of targets after it — subtype order follows arrival order. */
    function head_and_rest(call: CallReference): [SymbolId | undefined, Set<SymbolId>] {
      const [head, ...rest] = call.resolutions.map((resolution) => resolution.symbol_id);
      return [head, new Set(rest)];
    }

    function targets_of(call: CallReference): Set<SymbolId> {
      return new Set(call.resolutions.map((resolution) => resolution.symbol_id));
    }

    function type_named(project: Project, file: FilePath, type_name: string): SymbolId {
      const index = project.get_index_single_file(file);
      const found = [...(index?.classes.values() ?? []), ...(index?.interfaces.values() ?? [])].find(
        (def) => def.name === type_name
      );
      if (found === undefined) {
        throw new Error(`${file} declares no type named ${type_name}`);
      }
      return found.symbol_id;
    }

    /** The top-level function `name` declares in `file`. */
    function function_named(project: Project, file: FilePath, name: string): SymbolId {
      const found = [...(project.get_index_single_file(file)?.functions.values() ?? [])].find(
        (def) => def.name === name
      );
      if (found === undefined) {
        throw new Error(`${file} declares no function named ${name}`);
      }
      return found.symbol_id;
    }

    /** The member the project currently holds under `type_name.member_name`. */
    function member_of(project: Project, file: FilePath, type_name: string, member_name: string): SymbolId {
      const member = project.definitions
        .get_member_index()
        .get(type_named(project, file, type_name))
        ?.get(member_name as SymbolName);
      if (member === undefined) {
        throw new Error(`${type_name} in ${file} holds no member named ${member_name}`);
      }
      return member;
    }

    const typescript = read_fixture("typescript", "subtype_dispatch");
    const python = read_fixture("python", "subtype_dispatch");
    const rust = read_fixture("rust", "subtype_dispatch");

    it.each(order_matrix(["shape.ts", "square.ts", "measure.ts"]))(
      "reaches a TypeScript implementer through the interface the caller names (%s, %s)",
      async (_label, driver, order) => {
        const { project, paths } = await load_project(typescript, order, driver);

        expect(head_and_rest(call_at(project, paths["measure.ts"], "area", 6))).toEqual([
          member_of(project, paths["shape.ts"], "Shape", "area"),
          new Set([member_of(project, paths["square.ts"], "Square", "area")]),
        ]);
      }
    );

    it.each(order_matrix(["handler.py", "json_handler.py", "dispatch.py"]))(
      "fans a Python base-typed miss out to the subclass declaring the member (%s, %s)",
      async (_label, driver, order) => {
        const { project, paths } = await load_project(python, order, driver);

        expect(call_at(project, paths["dispatch.py"], "handle", 7).resolutions).toEqual([
          {
            symbol_id: member_of(project, paths["json_handler.py"], "JsonHandler", "handle"),
            confidence: "certain",
            reason: { type: "direct" },
          },
        ]);
      }
    );

    it.each(order_matrix(["visitor.rs", "collector.rs", "walk.rs"]))(
      "reaches a Rust `impl Visitor for T` through a `dyn Visitor` receiver (lib.rs → %s, %s)",
      async (_label, driver, order) => {
        const { project, paths } = await load_project(rust, ["lib.rs", ...order], driver);

        expect(head_and_rest(call_at(project, paths["walk.rs"], "visit_item", 6))).toEqual([
          member_of(project, paths["visitor.rs"], "Visitor", "visit_item"),
          new Set([member_of(project, paths["collector.rs"], "Collector", "visit_item")]),
        ]);

        // `fn walk_bounded<V: Visitor>(v: &mut V)` reaches the same closure:
        // the trait bound is what types a receiver its `dyn` sibling declares.
        expect(head_and_rest(call_at(project, paths["walk.rs"], "visit_item", 10))).toEqual([
          member_of(project, paths["visitor.rs"], "Visitor", "visit_item"),
          new Set([member_of(project, paths["collector.rs"], "Collector", "visit_item")]),
        ]);
      }
    );

    it.each(DRIVERS)(
      "fans a caller that arrived first out to every implementer, including one two hops below the interface (%s)",
      async (driver) => {
        const { project, paths } = await load_project(
          typescript,
          ["measure.ts", "shape.ts", "square.ts", "circle.ts", "rounded_square.ts"],
          driver
        );

        expect(head_and_rest(call_at(project, paths["measure.ts"], "area", 6))).toEqual([
          member_of(project, paths["shape.ts"], "Shape", "area"),
          new Set([
            member_of(project, paths["square.ts"], "Square", "area"),
            member_of(project, paths["circle.ts"], "Circle", "area"),
            member_of(project, paths["rounded_square.ts"], "RoundedSquare", "area"),
          ]),
        ]);
      }
    );

    it.each(DRIVERS)(
      "fans a trait-typed caller that arrived first out to every Rust implementer (%s)",
      async (driver) => {
        const { project, paths } = await load_project(
          rust,
          ["lib.rs", "walk.rs", "visitor.rs", "collector.rs", "counter.rs"],
          driver
        );

        expect(head_and_rest(call_at(project, paths["walk.rs"], "visit_item", 6))).toEqual([
          member_of(project, paths["visitor.rs"], "Visitor", "visit_item"),
          new Set([
            member_of(project, paths["collector.rs"], "Collector", "visit_item"),
            member_of(project, paths["counter.rs"], "Counter", "visit_item"),
          ]),
        ]);

        expect(head_and_rest(call_at(project, paths["walk.rs"], "visit_item", 10))).toEqual([
          member_of(project, paths["visitor.rs"], "Visitor", "visit_item"),
          new Set([
            member_of(project, paths["collector.rs"], "Collector", "visit_item"),
            member_of(project, paths["counter.rs"], "Counter", "visit_item"),
          ]),
        ]);
      }
    );

    it.each(DRIVERS)(
      "resolves an abstract base's hook by fanning the miss out, and never fans a `super` miss out (%s)",
      async (driver) => {
        const { project, paths } = await load_project(
          python,
          ["dispatch.py", "handler.py", "json_handler.py", "xml_handler.py"],
          driver
        );
        const hooks = new Set([
          member_of(project, paths["json_handler.py"], "JsonHandler", "handle"),
          member_of(project, paths["xml_handler.py"], "XmlHandler", "handle"),
        ]);

        // `handler.handle()` from a caller holding the base, and `self.handle()`
        // inside the base itself: neither receiver declares the member.
        expect(targets_of(call_at(project, paths["dispatch.py"], "handle", 7))).toEqual(hooks);
        expect(targets_of(call_at(project, paths["handler.py"], "handle", 8))).toEqual(hooks);

        // `super()` runs what follows the calling class in its method resolution
        // order, where only Handler follows and declares neither member:
        // XmlHandler's constructor is not JsonHandler's base constructor, and
        // JsonHandler.close is not what `super().close()` inside XmlHandler runs
        // — nor is XmlHandler.close itself.
        const expected_failure: ResolutionFailure = {
          stage: "method_lookup",
          reason: "method_not_on_type",
          partial_info: {
            resolved_receiver_type: type_named(project, paths["handler.py"], "Handler"),
          },
        };
        for (const chained of [
          call_at(project, paths["json_handler.py"], "__init__", 8),
          call_at(project, paths["xml_handler.py"], "close", 14),
        ]) {
          expect(chained.resolutions).toEqual([]);
          expect(chained.resolution_failure).toEqual(expected_failure);
        }
      }
    );

    it.each(DRIVERS)(
      "dispatches a TypeScript `super` call to the member the parent declares or inherits, and to nothing below it (%s)",
      async (driver) => {
        const { project, paths } = await load_project(
          read_fixture("typescript", "super_dispatch"),
          ["article.ts", "comment.ts", "invoice.ts", "model.ts"],
          driver
        );
        const model_save = member_of(project, paths["model.ts"], "Model", "save");
        const model_validate = member_of(project, paths["model.ts"], "Model", "validate");

        // `Model` declares `save`; `Document` inherits `validate` from `Model`.
        expect(targets_of(call_at(project, paths["article.ts"], "save", 7))).toEqual(new Set([model_save]));
        expect(targets_of(call_at(project, paths["invoice.ts"], "validate", 7))).toEqual(new Set([model_validate]));

        // Neither override calls itself and nothing calls the sibling.
        expect(new Set(project.get_call_graph().entry_points)).toEqual(
          new Set([
            member_of(project, paths["article.ts"], "Article", "save"),
            member_of(project, paths["comment.ts"], "Comment", "save"),
            member_of(project, paths["invoice.ts"], "Invoice", "validate"),
            member_of(project, paths["model.ts"], "Document", "render"),
          ])
        );
      }
    );

    it.each(DRIVERS)(
      "dispatches a Python `super` call along the method resolution order of every class it can run on, re-answered when a subclass mixes a sibling in (%s)",
      async (driver) => {
        const files = read_fixture("python", "super_dispatch");
        const { project, paths } = await load_project(
          files,
          ["article.py", "comment.py", "invoice.py", "model.py", "audited.py", "draft.py"],
          driver
        );
        const model = type_named(project, paths["model.py"], "Model");
        const document = type_named(project, paths["model.py"], "Document");
        const model_save = member_of(project, paths["model.py"], "Model", "save");
        const audited_save = member_of(project, paths["audited.py"], "Audited", "save");
        const article_save = () => call_at(project, paths["article.py"], "save", 8);

        // On a `Draft(Article, Audited)`, `super().save()` inside `Article` runs
        // `Audited.save`; on an `Article`, `Model.save`. `Invoice`'s parent
        // inherits `validate` from `Model`.
        expect(targets_of(article_save())).toEqual(new Set([model_save, audited_save]));
        expect(targets_of(call_at(project, paths["invoice.py"], "validate", 8))).toEqual(
          new Set([member_of(project, paths["model.py"], "Model", "validate")])
        );
        expect(project.resolutions.get_files_dispatching_through([model])).toEqual(new Set([paths["article.py"]]));
        expect(project.resolutions.get_files_dispatching_through([document])).toEqual(new Set([paths["invoice.py"]]));

        // No call edge reaches an override from its own body, and the sibling
        // nothing mixes in stays an entry point. The Python indexer also records
        // the `save` in `super().save()` as a name read, which binds to the
        // enclosing class's own `save` and keeps it out of the entry points.
        const call_targets = new Set(
          project.get_all_files().flatMap((file) =>
            project.resolutions.get_calls_for_file(file).flatMap((call) => call.resolutions.map((r) => r.symbol_id))
          )
        );
        expect(
          [
            member_of(project, paths["article.py"], "Article", "save"),
            member_of(project, paths["invoice.py"], "Invoice", "validate"),
          ].filter((member) => call_targets.has(member))
        ).toEqual([]);
        expect(new Set(project.get_call_graph().entry_points)).toEqual(
          new Set([
            member_of(project, paths["comment.py"], "Comment", "save"),
            member_of(project, paths["model.py"], "Document", "render"),
          ])
        );

        // The subclass that mixes the sibling in leaves: the call runs on an
        // `Article` alone.
        project.remove_file(paths["draft.py"]);
        expect(targets_of(article_save())).toEqual(new Set([model_save]));
      }
    );

    it("re-answers a caller when an implementer's members change and its heritage does not", async () => {
      const { project, paths } = await load_project(typescript, ["shape.ts", "square.ts", "measure.ts"], "update_file");
      const shape = type_named(project, paths["shape.ts"], "Shape");
      const shape_area = member_of(project, paths["shape.ts"], "Shape", "area");
      const measure_area = () => call_at(project, paths["measure.ts"], "area", 6);
      const square_is_entry_point = () =>
        project.get_call_graph().entry_points.includes(member_of(project, paths["square.ts"], "Square", "area"));
      const edit_square = (content: string) => project.update_file(paths["square.ts"], content);

      // A line inside the class body moves `area` to a new symbol while
      // `Square implements Shape` stays where it was.
      edit_square(typescript["square.ts"].replace("{\n  area", "{\n  // measured in unit squares\n  area"));
      expect(head_and_rest(measure_area())).toEqual([
        shape_area,
        new Set([member_of(project, paths["square.ts"], "Square", "area")]),
      ]);
      expect(square_is_entry_point()).toBe(false);

      // The implementer stops declaring the member.
      edit_square(typescript["square.ts"].replace("  area(): number {\n    return 4;\n  }\n", ""));
      const no_implementations: ResolutionFailure = {
        stage: "method_lookup",
        reason: "polymorphic_no_implementations",
        partial_info: { resolved_receiver_type: shape },
      };
      expect(measure_area().resolution_failure).toEqual(no_implementations);

      // And declares it again.
      edit_square(typescript["square.ts"]);
      expect(head_and_rest(measure_area())).toEqual([
        shape_area,
        new Set([member_of(project, paths["square.ts"], "Square", "area")]),
      ]);
      expect(square_is_entry_point()).toBe(false);
    });

    it("keeps the subtype-dispatch index to the files whose calls still dispatch, across an incremental session", async () => {
      const { project, paths } = await load_project(typescript, ["measure.ts", "shape.ts"], "update_file");
      const shape = type_named(project, paths["shape.ts"], "Shape");
      const shape_area = member_of(project, paths["shape.ts"], "Shape", "area");
      const measure_area = () => call_at(project, paths["measure.ts"], "area", 6);
      const no_implementations: ResolutionFailure = {
        stage: "method_lookup",
        reason: "polymorphic_no_implementations",
        partial_info: { resolved_receiver_type: shape },
      };

      // No implementer yet: the call fails, and its file is indexed under Shape.
      expect(measure_area().resolution_failure).toEqual(no_implementations);
      expect(project.resolutions.get_files_dispatching_through([shape])).toEqual(
        new Set([paths["measure.ts"]])
      );

      // The implementer arrives; the caller re-resolves and stays indexed, so
      // the next implementer reaches it too.
      project.update_file(paths["square.ts"], typescript["square.ts"]);
      const square_area = member_of(project, paths["square.ts"], "Square", "area");
      expect(head_and_rest(measure_area())).toEqual([shape_area, new Set([square_area])]);
      expect(project.resolutions.get_files_dispatching_through([shape])).toEqual(
        new Set([paths["measure.ts"]])
      );

      // Deleting the implementer re-answers the caller through the same index.
      project.remove_file(paths["square.ts"]);
      expect(measure_area().resolution_failure).toEqual(no_implementations);

      // The caller stops dispatching: re-resolving its file evicts its entry.
      project.update_file(paths["measure.ts"], "export function measure(): number {\n  return 0;\n}\n");
      expect(project.resolutions.get_files_dispatching_through([shape])).toEqual(new Set());

      // Dispatching again, then deleting the caller, evicts it with the file.
      project.update_file(paths["measure.ts"], typescript["measure.ts"]);
      expect(project.resolutions.get_files_dispatching_through([shape])).toEqual(
        new Set([paths["measure.ts"]])
      );
      project.remove_file(paths["measure.ts"]);
      expect(project.resolutions.get_files_dispatching_through([shape])).toEqual(new Set());
    });

    describe("Dispatch through an interface no class declares against", () => {
      const conformance = read_fixture("typescript", "structural_conformance");

      const FACADE_CLUSTER = ["core_facade.ts", "facade_impl.ts", "caller.ts"];

      it.each(order_matrix(FACADE_CLUSTER))(
        "reaches the conforming class through core's replica, whatever order files arrive in (%s, %s)",
        async (_label, driver, order) => {
          const { project, paths } = await load_project(conformance, order, driver);

          expect(head_and_rest(call_at(project, paths["caller.ts"], "compileNgModule", 6))).toEqual([
            member_of(project, paths["core_facade.ts"], "CompilerFacade", "compileNgModule"),
            new Set([
              member_of(project, paths["facade_impl.ts"], "CompilerFacadeImpl", "compileNgModule"),
            ]),
          ]);
        }
      );

      it.each(DRIVERS)(
        "reaches it through an accessor's return type, where the caller names neither end (%s)",
        async (driver) => {
          const { project, paths } = await load_project(
            conformance,
            ["core_facade.ts", "accessor.ts", "facade_impl.ts", "accessor_caller.ts"],
            driver
          );

          expect(
            head_and_rest(call_at(project, paths["accessor_caller.ts"], "compileComponent", 9))
          ).toEqual([
            member_of(project, paths["core_facade.ts"], "CompilerFacade", "compileComponent"),
            new Set([
              member_of(project, paths["facade_impl.ts"], "CompilerFacadeImpl", "compileComponent"),
            ]),
          ]);
        }
      );

      it.each(DRIVERS)(
        "leaves a class one member short of the interface out of the fan-out (%s)",
        async (driver) => {
          const { project, paths } = await load_project(
            conformance,
            [...FACADE_CLUSTER, "near_impl.ts"],
            driver
          );

          expect(targets_of(call_at(project, paths["caller.ts"], "compileNgModule", 6))).toEqual(
            new Set([
              member_of(project, paths["core_facade.ts"], "CompilerFacade", "compileNgModule"),
              member_of(project, paths["facade_impl.ts"], "CompilerFacadeImpl", "compileNgModule"),
            ])
          );
        }
      );

      it.each(DRIVERS)(
        "keeps the two replica declarations distinct, each reaching the one implementation (%s)",
        async (driver) => {
          const { project, paths } = await load_project(
            conformance,
            [...FACADE_CLUSTER, "compiler_facade.ts"],
            driver
          );
          const core_facade = type_named(project, paths["core_facade.ts"], "CompilerFacade");
          const compiler_facade = type_named(project, paths["compiler_facade.ts"], "CompilerFacade");
          const impl = type_named(project, paths["facade_impl.ts"], "CompilerFacadeImpl");

          // Two ids, and only the one a call dispatches through is asked about:
          // conformance is inferred where a dispatch needs it, never swept over
          // every interface the project holds.
          expect(core_facade).not.toEqual(compiler_facade);
          expect([...project.definitions.get_subtypes(core_facade)]).toEqual([impl]);
          expect([...project.definitions.get_subtypes(compiler_facade)]).toEqual([]);

          // The call names core's replica, so core's member leads the answer.
          expect(head_and_rest(call_at(project, paths["caller.ts"], "compileNgModule", 6))).toEqual([
            member_of(project, paths["core_facade.ts"], "CompilerFacade", "compileNgModule"),
            new Set([
              member_of(project, paths["facade_impl.ts"], "CompilerFacadeImpl", "compileNgModule"),
            ]),
          ]);
        }
      );

      const ENVIRONMENT_CLUSTER = [
        "environment.ts",
        "type_check_environment.ts",
        "environment_caller.ts",
      ];

      /** The superclass-coverage assertion, over whatever order has been loaded. */
      function expect_prelude_reaches_environment(
        project: Project,
        paths: Record<string, FilePath>
      ): void {
        expect(
          head_and_rest(call_at(project, paths["environment_caller.ts"], "getPreludeStatements", 6))
        ).toEqual([
          member_of(project, paths["environment.ts"], "TcbEnvironment", "getPreludeStatements"),
          new Set([
            member_of(
              project,
              paths["type_check_environment.ts"],
              "Environment",
              "getPreludeStatements"
            ),
          ]),
        ]);
      }

      it.each(order_matrix(ENVIRONMENT_CLUSTER))(
        "counts coverage the conforming class's superclass supplies (%s, %s)",
        async (_label, driver, order) => {
          const { project, paths } = await load_project(
            conformance,
            ["base_environment.ts", ...order],
            driver
          );

          // `Environment` declares three of the six members; `BaseEnvironment`
          // declares the other three and is named by `extends`, not by the
          // interface.
          expect_prelude_reaches_environment(project, paths);
        }
      );

      // The base's own arrival is the dimension a re-trigger turns on: until it
      // lands the member closure is three members short and the interface
      // conforms to nothing, so the closure change has to re-answer a caller
      // that already failed. It is permuted through every later position rather
      // than crossed with the matrix above, which covers it arriving first.
      it.each(
        DRIVERS.flatMap((driver): [Driver, number][] => [1, 2, 3].map((at) => [driver, at]))
      )(
        "counts it whenever the base arrives (%s, base after %d of the other files)",
        async (driver, at) => {
          const { project, paths } = await load_project(
            conformance,
            [...ENVIRONMENT_CLUSTER.slice(0, at), "base_environment.ts", ...ENVIRONMENT_CLUSTER.slice(at)],
            driver
          );

          expect_prelude_reaches_environment(project, paths);
        }
      );

      it.each(DRIVERS)(
        "refuses an interface below the member floor, in a project where conformance answers (%s)",
        async (driver) => {
          const { project, paths } = await load_project(
            conformance,
            [
              ...FACADE_CLUSTER,
              "disposable.ts",
              "disposable_carriers.ts",
              "disposable_caller.ts",
              "token_list.ts",
              "token_list_carriers.ts",
              "token_list_caller.ts",
            ],
            driver
          );
          const failed_dispatch = (receiver: SymbolId): ResolutionFailure => ({
            stage: "method_lookup",
            reason: "polymorphic_no_implementations",
            partial_info: { resolved_receiver_type: receiver },
          });

          // The control: conformance ran in this project and answered the
          // facade, so a refusal below is the floor's and not the step's
          // absence.
          expect([
            ...project.definitions.get_subtypes(
              type_named(project, paths["core_facade.ts"], "CompilerFacade")
            ),
          ]).toEqual([type_named(project, paths["facade_impl.ts"], "CompilerFacadeImpl")]);

          // One member, three classes carrying it, none declaring the
          // interface: the floor is all that stands between the call and a
          // three-way fan-out to unrelated classes.
          const disposable = type_named(project, paths["disposable.ts"], "IDisposable");
          expect(
            call_at(project, paths["disposable_caller.ts"], "dispose", 6).resolution_failure
          ).toEqual(failed_dispatch(disposable));
          expect([...project.definitions.get_subtypes(disposable)]).toEqual([]);

          // Two members — the boundary the floor was calibrated at, where a
          // two-method floor took 14 false edges on angular's own
          // `RDomTokenList`.
          const tokens = type_named(project, paths["token_list.ts"], "RDomTokenList");
          expect(call_at(project, paths["token_list_caller.ts"], "add", 6).resolution_failure).toEqual(
            failed_dispatch(tokens)
          );
          expect([...project.definitions.get_subtypes(tokens)]).toEqual([]);
        }
      );

      it.each(DRIVERS)(
        "disposes a contribution reached through a keyed container, and bounds the fan-out (%s)",
        async (driver) => {
          const { project, paths } = await load_project(
            conformance,
            [
              "editor_contribution.ts",
              "code_editor_widget.ts",
              "contribution_disposer.ts",
              // Classes carrying `dispose` and nothing else the contribution names.
              "disposable.ts",
              "disposable_carriers.ts",
            ],
            driver
          );
          const contribution = type_named(project, paths["editor_contribution.ts"], "IEditorContribution");

          // The receiver is one element of a `Map<string, IEditorContribution>`,
          // and the class satisfies the interface structurally only.
          expect(
            head_and_rest(call_at(project, paths["contribution_disposer.ts"], "dispose", 7))
          ).toEqual([
            member_of(project, paths["editor_contribution.ts"], "IEditorContribution", "dispose"),
            new Set([
              member_of(project, paths["code_editor_widget.ts"], "FoldingController", "dispose"),
            ]),
          ]);

          // The bound: the one class covering all three members, never the
          // three others carrying `dispose` alone. Those three satisfy the
          // interface as TypeScript reads it — its other two members are
          // optional — and conformance still refuses them, because it reads
          // member names and not optionality.
          expect([...project.definitions.get_subtypes(contribution)]).toEqual([
            type_named(project, paths["code_editor_widget.ts"], "FoldingController"),
          ]);
        }
      );

      // The module reads members and nothing else, so the same test has to
      // answer a protocol and a trait as it answers an interface. What differs
      // per language is what the indexer puts in the member closure, which is
      // what these two exercise: Python names the protocol as a base nothing
      // declares, Rust covers the trait from an inherent `impl` block.
      it.each(DRIVERS)("answers a Python protocol no class names as a base (%s)", async (driver) => {
        const { project, paths } = await load_project(
          read_fixture("python", "structural_conformance"),
          ["reader.py", "file_reader.py", "reader_caller.py"],
          driver
        );

        expect(head_and_rest(call_at(project, paths["reader_caller.py"], "read", 7))).toEqual([
          member_of(project, paths["reader.py"], "Reader", "read"),
          new Set([member_of(project, paths["file_reader.py"], "FileReader", "read")]),
        ]);
      });

      it.each(DRIVERS)("answers a Rust trait no `impl Trait for T` names (%s)", async (driver) => {
        const { project, paths } = await load_project(
          read_fixture("rust", "structural_conformance"),
          ["lib.rs", "visitor.rs", "collector.rs", "walk.rs"],
          driver
        );

        expect(head_and_rest(call_at(project, paths["walk.rs"], "visit_item", 6))).toEqual([
          member_of(project, paths["visitor.rs"], "Visitor", "visit_item"),
          new Set([member_of(project, paths["collector.rs"], "Collector", "visit_item")]),
        ]);
      });

      it("re-answers a caller when the conforming class arrives after the dispatch failed", async () => {
        const { project, paths } = await load_project(
          conformance,
          ["core_facade.ts", "caller.ts"],
          "update_file"
        );
        const core_facade = type_named(project, paths["core_facade.ts"], "CompilerFacade");
        const compile_call = () => call_at(project, paths["caller.ts"], "compileNgModule", 6);
        const no_implementations: ResolutionFailure = {
          stage: "method_lookup",
          reason: "polymorphic_no_implementations",
          partial_info: { resolved_receiver_type: core_facade },
        };

        // Nothing conforms yet.
        expect(compile_call().resolution_failure).toEqual(no_implementations);

        // The conforming class arrives in a file the caller does not import and
        // which imports nothing the caller touches.
        project.update_file(paths["facade_impl.ts"], conformance["facade_impl.ts"]);
        expect(head_and_rest(compile_call())).toEqual([
          member_of(project, paths["core_facade.ts"], "CompilerFacade", "compileNgModule"),
          new Set([
            member_of(project, paths["facade_impl.ts"], "CompilerFacadeImpl", "compileNgModule"),
          ]),
        ]);
        // The inferred edge connects the implementation, so it is no longer an
        // entry point — while the caller nothing calls still is, which is what
        // makes that absence a connected edge rather than an empty graph.
        const entry_points = new Set(project.get_call_graph().entry_points);
        expect(
          entry_points.has(
            member_of(project, paths["facade_impl.ts"], "CompilerFacadeImpl", "compileNgModule")
          )
        ).toBe(false);
        expect(entry_points.has(function_named(project, paths["caller.ts"], "compile"))).toBe(true);

        // It stops conforming: the inferred edge leaves with the members that
        // held it up.
        project.update_file(
          paths["facade_impl.ts"],
          conformance["facade_impl.ts"].replace(
            / {2}compilePipe\(meta: string\): string \{\n {4}return `pipe:\$\{meta\}`;\n {2}\}\n/,
            ""
          )
        );
        expect(compile_call().resolution_failure).toEqual(no_implementations);
        expect([...project.definitions.get_subtypes(core_facade)]).toEqual([]);

        // And conforms again.
        project.update_file(paths["facade_impl.ts"], conformance["facade_impl.ts"]);
        expect(head_and_rest(compile_call())).toEqual([
          member_of(project, paths["core_facade.ts"], "CompilerFacade", "compileNgModule"),
          new Set([
            member_of(project, paths["facade_impl.ts"], "CompilerFacadeImpl", "compileNgModule"),
          ]),
        ]);

        // Deleting it altogether goes back through the same index.
        project.remove_file(paths["facade_impl.ts"]);
        expect(compile_call().resolution_failure).toEqual(no_implementations);
      });
    });
  });

});
