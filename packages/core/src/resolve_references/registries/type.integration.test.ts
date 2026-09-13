import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "../../project/project";
import type { FilePath, SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * Every annotation form a receiver's type is written in resolves to the type it
 * declares, end to end: index → TypeRegistry → receiver resolution → call edge.
 * Each "does not" case is the insulation beside it — a wrapper or container
 * the annotation grammar must not see through.
 */
describe("annotation resolution through the project pipeline", () => {
  const FIXTURES_ROOT = path.resolve(__dirname, "../../../tests/fixtures");
  const temp_dirs: string[] = [];

  afterAll(() => {
    for (const dir of temp_dirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  /** Write `files` to a fresh directory and load them in `order` (default: as listed). */
  async function load_project(
    files: Readonly<Record<string, string>>,
    order: readonly string[] = Object.keys(files)
  ): Promise<{ project: Project; paths: Record<string, FilePath> }> {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "annotation-")));
    temp_dirs.push(dir);
    const paths: Record<string, FilePath> = {};
    for (const [relative, content] of Object.entries(files)) {
      const absolute = path.join(dir, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content);
      paths[relative] = absolute as FilePath;
    }
    const project = new Project();
    await project.initialize(dir as FilePath);
    for (const relative of order) {
      project.update_file(paths[relative], files[relative]);
    }
    return { project, paths };
  }

  /** Every file of a committed fixture directory, keyed by its path inside it. */
  function read_fixture(language: string, name: string): Record<string, string> {
    const root = path.join(FIXTURES_ROOT, language, "code", "integration", name);
    const files: Record<string, string> = {};
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(absolute);
        } else {
          files[path.relative(root, absolute)] = fs.readFileSync(absolute, "utf-8");
        }
      }
    };
    walk(root);
    return files;
  }

  /** The targets the one call to `name` on 1-based `line` of `file` resolved to. */
  function targets_of(
    project: Project,
    file: FilePath,
    name: string,
    line: number
  ): readonly SymbolId[] {
    const calls = project.resolutions
      .get_calls_for_file(file)
      .filter((call) => call.name === name && call.location.start_line === line);
    expect(calls.length).toBe(1);
    return calls[0].resolutions.map((resolution) => resolution.symbol_id);
  }

  function type_named(project: Project, file: FilePath, type_name: string): SymbolId {
    const index = project.get_index_single_file(file);
    if (!index) throw new Error(`${file} is not indexed`);
    const declaration = [
      ...index.classes.values(),
      ...index.interfaces.values(),
      ...index.enums.values(),
    ].find((definition) => definition.name === type_name);
    if (!declaration) throw new Error(`${file} declares no ${type_name}`);
    return declaration.symbol_id;
  }

  /** The member `member` of the type named `type_name` declared in `file`. */
  function member_of(
    project: Project,
    file: FilePath,
    type_name: string,
    member: string
  ): SymbolId {
    const type_id = type_named(project, file, type_name);
    const member_id = project.definitions
      .get_member_index()
      .get(type_id)
      ?.get(member as SymbolName);
    if (!member_id) throw new Error(`${type_name} has no member ${member}`);
    return member_id;
  }

  /** The parameter `parameter` of the function `function_name` in `file`. */
  function parameter_of(
    project: Project,
    file: FilePath,
    function_name: string,
    parameter: string
  ): SymbolId {
    const index = project.get_index_single_file(file);
    const found = [...(index?.functions.values() ?? [])]
      .find((definition) => definition.name === function_name)
      ?.signature.parameters.find((definition) => definition.name === parameter);
    if (!found) throw new Error(`${function_name} has no parameter ${parameter}`);
    return found.symbol_id;
  }

  describe("rust", () => {
    const LIB = `struct S;
impl S { fn m(&self) {} }
trait Emit { fn emit(&self); }
struct Enc;
impl Enc { fn enc(&self) {} }
fn by_ref(x: &S) { x.m(); }
fn by_mut(x: &mut S) { x.m(); }
fn by_lifetime<'a>(x: &'a S) { x.m(); }
fn optional(x: Option<Enc>) { x.enc(); }
fn boxed(x: Box<dyn Emit>) { x.emit(); }
fn opaque(x: impl Emit) { x.emit(); }
fn listed(x: Vec<Enc>) { x.enc(); }
struct Holder { inner: Box<Enc> }
impl Holder { fn go(&self) { self.inner.enc(); } }
`;

    it.each([
      ["&S", 6],
      ["&mut S", 7],
      ["&'a S", 8],
    ])("resolves a %s receiver to S's method", async (_form, line) => {
      const { project, paths } = await load_project({ "lib.rs": LIB });
      const file = paths["lib.rs"];
      expect(targets_of(project, file, "m", line)).toEqual([member_of(project, file, "S", "m")]);
    });

    it("resolves an Option<Enc> receiver to Enc's method", async () => {
      const { project, paths } = await load_project({ "lib.rs": LIB });
      const file = paths["lib.rs"];
      expect(targets_of(project, file, "enc", 9)).toEqual([member_of(project, file, "Enc", "enc")]);
    });

    it("resolves a Box<Enc> field hop to Enc's method", async () => {
      const { project, paths } = await load_project({ "lib.rs": LIB });
      const file = paths["lib.rs"];
      expect(targets_of(project, file, "enc", 14)).toEqual([member_of(project, file, "Enc", "enc")]);
    });

    it.each([
      ["Box<dyn Emit>", "boxed"],
      ["impl Emit", "opaque"],
    ])("types a %s parameter as the trait it names", async (_form, function_name) => {
      const { project, paths } = await load_project({ "lib.rs": LIB });
      const file = paths["lib.rs"];
      expect(
        project.types.get_symbol_type(parameter_of(project, file, function_name, "x"))
      ).toEqual(type_named(project, file, "Emit"));
    });

    it("does not see through Vec<Enc>: the receiver is the Vec, the element an argument", async () => {
      const { project, paths } = await load_project({ "lib.rs": LIB });
      const file = paths["lib.rs"];
      const parameter = parameter_of(project, file, "listed", "x");
      expect(project.types.get_symbol_type(parameter)).toBeNull();
      expect(project.types.get_symbol_type_arguments(parameter)).toEqual([
        type_named(project, file, "Enc"),
      ]);
      expect(targets_of(project, file, "enc", 12)).toEqual([]);
    });

    it.each([
      ["callee modules first", ["c.rs", "b.rs", "a.rs", "lib.rs"]],
      ["referring file first", ["lib.rs", "a.rs", "b.rs", "c.rs"]],
    ])(
      "resolves a module-qualified type through a two-hop pub use chain (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          read_fixture("rust", "annotation_module_path"),
          order
        );
        const go = member_of(project, paths["c.rs"], "State", "go");
        expect(targets_of(project, paths["lib.rs"], "go", 6)).toEqual([go]);
        expect(targets_of(project, paths["lib.rs"], "go", 10)).toEqual([go]);
      }
    );
  });

  describe("typescript", () => {
    const SOURCE = `export class F { m() {} }
class G { m() {} }
function nullable(x: F | null) { x.m(); }
function undefinable(x: F | undefined) { x.m(); }
function listed(x: F[]) { x.m(); }
function either(x: F | G) { x.m(); }
class Guard { can() {} }
class Config {
  constructor(private readonly guard?: Guard) {}
  run() { this.guard.can(); }
}
class Conn { exec() {} }
class Engine { connect(): Conn | null { return null; } }
function chained(e: Engine) { e.connect().exec(); }
function make(): Conn | null { return null; }
const made = make();
made.exec();
`;

    it.each([
      ["F | null", 3],
      ["F | undefined", 4],
    ])("resolves a %s receiver to F's method", async (_form, line) => {
      const { project, paths } = await load_project({ "a.ts": SOURCE });
      const file = paths["a.ts"];
      expect(targets_of(project, file, "m", line)).toEqual([member_of(project, file, "F", "m")]);
    });

    it("resolves a constructor parameter property receiver through the property's own annotation", async () => {
      const { project, paths } = await load_project({ "a.ts": SOURCE });
      const file = paths["a.ts"];
      expect(targets_of(project, file, "can", 10)).toEqual([
        member_of(project, file, "Guard", "can"),
      ]);
    });

    it("resolves a chained call through a nullable method return annotation", async () => {
      const { project, paths } = await load_project({ "a.ts": SOURCE });
      const file = paths["a.ts"];
      expect(targets_of(project, file, "exec", 14)).toEqual([
        member_of(project, file, "Conn", "exec"),
      ]);
    });

    it("types a factory-initialised variable from a nullable return annotation", async () => {
      const { project, paths } = await load_project({ "a.ts": SOURCE });
      const file = paths["a.ts"];
      expect(targets_of(project, file, "exec", 17)).toEqual([
        member_of(project, file, "Conn", "exec"),
      ]);
    });

    it.each([
      ["F[]", 5],
      ["F | G", 6],
    ])("does not resolve a %s receiver to a member type", async (_form, line) => {
      const { project, paths } = await load_project({ "a.ts": SOURCE });
      expect(targets_of(project, paths["a.ts"], "m", line)).toEqual([]);
    });

    it("records type arguments only when every argument resolves", async () => {
      const { project, paths } = await load_project({
        "a.ts": `export class F { m() {} }
class G {}
function paired(x: Map<G, F>) {}
function keyed(x: Map<Missing, F>) {}
`,
      });
      const file = paths["a.ts"];
      expect(project.types.get_symbol_type_arguments(parameter_of(project, file, "paired", "x"))).toEqual([
        type_named(project, file, "G"),
        type_named(project, file, "F"),
      ]);
      expect(project.types.get_symbol_type_arguments(parameter_of(project, file, "keyed", "x"))).toEqual([]);
    });

    it("carries a factory return annotation's type arguments onto the variable it initialises", async () => {
      const { project, paths } = await load_project({
        "a.ts": `export class F { m() {} }
class G {}
function make(): Map<G, F> { return new Map(); }
const made = make();
`,
      });
      const file = paths["a.ts"];
      const made = [...project.get_index_single_file(file)!.variables.values()].find(
        (variable) => variable.name === "made"
      )!.symbol_id;
      expect(project.types.get_symbol_type_arguments(made)).toEqual([
        type_named(project, file, "G"),
        type_named(project, file, "F"),
      ]);
    });

    it("re-derives an annotation's type and arguments when its file is edited", async () => {
      const first = `export class F { m() {} }
export class G { m() {} }
function use(x: F | null, y: Set<F>) { x.m(); }
`;
      const second = `export class F { m() {} }
export class G { m() {} }
function use(x: G | null, y: Set<Missing>) { x.m(); }
`;
      const { project, paths } = await load_project({ "a.ts": first });
      const file = paths["a.ts"];
      expect(targets_of(project, file, "m", 3)).toEqual([member_of(project, file, "F", "m")]);
      expect(project.types.get_symbol_type_arguments(parameter_of(project, file, "use", "y"))).toEqual([
        type_named(project, file, "F"),
      ]);

      project.update_file(file, second);

      expect(targets_of(project, file, "m", 3)).toEqual([member_of(project, file, "G", "m")]);
      expect(project.types.get_symbol_type_arguments(parameter_of(project, file, "use", "y"))).toEqual([]);
    });

    it.each([
      ["leaf first", ["leaf.ts", "mid.ts", "barrel.ts", "consumer.ts"]],
      ["consumer first", ["consumer.ts", "barrel.ts", "mid.ts", "leaf.ts"]],
    ])(
      "resolves namespace-qualified and inline import types through a two-hop export * barrel (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          read_fixture("typescript", "annotation_namespace_barrel"),
          order
        );
        const read_file = member_of(project, paths["leaf.ts"], "FileSystem", "read_file");
        expect(targets_of(project, paths["consumer.ts"], "read_file", 7)).toEqual([read_file]);
        expect(targets_of(project, paths["consumer.ts"], "read_file", 11)).toEqual([read_file]);
      }
    );
  });

  describe("python", () => {
    const SOURCE = `from typing import List, Optional, Union
class C:
    def m(self): pass
def optional(x: Optional[C]): x.m()
def union(x: Union[C, None]): x.m()
def forward(x: "C"): x.m()
def pep604(x: C | None): x.m()
def listed(x: List[C]): x.m()
`;

    it.each([
      ["Optional[C]", 4],
      ["Union[C, None]", 5],
      ["\"C\"", 6],
      ["C | None", 7],
    ])("resolves a %s receiver to C's method", async (_form, line) => {
      const { project, paths } = await load_project({ "a.py": SOURCE });
      const file = paths["a.py"];
      expect(targets_of(project, file, "m", line)).toEqual([member_of(project, file, "C", "m")]);
    });

    it("records no annotation arguments for a binding whose type a construction supplied", async () => {
      const { project, paths } = await load_project({
        "a.py": `from typing import Generic, TypeVar
T = TypeVar("T")
class Foo:
    pass
class Base(Generic[T]):
    def run(self): pass
class Derived(Base[Foo]):
    def run(self): pass
handler: Base[Foo] = Derived()
annotated: Base[Foo] = make()
`,
      });
      const file = paths["a.py"];
      const variable_id = (name: string): SymbolId =>
        [...project.get_index_single_file(file)!.variables.values()].find(
          (variable) => variable.name === name
        )!.symbol_id;
      expect(project.types.get_symbol_type(variable_id("handler"))).toEqual(type_named(project, file, "Derived"));
      expect(project.types.get_symbol_type_arguments(variable_id("handler"))).toEqual([]);
      expect(project.types.get_symbol_type(variable_id("annotated"))).toEqual(type_named(project, file, "Base"));
      expect(project.types.get_symbol_type_arguments(variable_id("annotated"))).toEqual([
        type_named(project, file, "Foo"),
      ]);
    });

    it("walks to a base class written through a module alias", async () => {
      const { project, paths } = await load_project({
        "base.py": "class Animal:\n    def speak(self): pass\n",
        "dog.py": "import base as zoo\nclass Dog(zoo.Animal):\n    pass\ndef bark(d: Dog): d.speak()\n",
      });
      const dog = type_named(project, paths["dog.py"], "Dog");
      expect(project.types.walk_inheritance_chain(dog)).toEqual([
        dog,
        type_named(project, paths["base.py"], "Animal"),
      ]);
      expect(targets_of(project, paths["dog.py"], "speak", 4)).toEqual([
        member_of(project, paths["base.py"], "Animal", "speak"),
      ]);
    });

    it("does not resolve a List[C] receiver to C's method", async () => {
      const { project, paths } = await load_project({ "a.py": SOURCE });
      expect(targets_of(project, paths["a.py"], "m", 8)).toEqual([]);
    });

    it.each([
      ["package first", ["pkg/leaf.py", "pkg/mid.py", "pkg/__init__.py", "consumer.py"]],
      ["consumer first", ["consumer.py", "pkg/__init__.py", "pkg/mid.py", "pkg/leaf.py"]],
    ])(
      "resolves module-qualified types through an aliased package and a submodule import (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          read_fixture("python", "annotation_module_barrel"),
          order
        );
        const compile = member_of(project, paths["pkg/leaf.py"], "DDLCompiler", "compile");
        expect(targets_of(project, paths["consumer.py"], "compile", 8)).toEqual([compile]);
        expect(targets_of(project, paths["consumer.py"], "compile", 12)).toEqual([compile]);
      }
    );
  });

  describe("javascript (JSDoc)", () => {
    const SOURCE = `export class ChunkGraph { m() {} }
/** @param {ChunkGraph=} x */
function optional(x) { x.m(); }
/** @param {ChunkGraph|null} x */
function nullable(x) { x.m(); }
/** @param {?ChunkGraph} x */
function prefixed(x) { x.m(); }
`;

    it.each([
      ["{ChunkGraph=}", 3],
      ["{ChunkGraph|null}", 5],
      ["{?ChunkGraph}", 7],
    ])("resolves a %s receiver to ChunkGraph's method", async (_form, line) => {
      const { project, paths } = await load_project({ "a.js": SOURCE });
      const file = paths["a.js"];
      expect(targets_of(project, file, "m", line)).toEqual([
        member_of(project, file, "ChunkGraph", "m"),
      ]);
    });

    it.each([
      ["leaf first", ["leaf.js", "mid.js", "barrel.js", "consumer.js"]],
      ["consumer first", ["consumer.js", "barrel.js", "mid.js", "leaf.js"]],
    ])(
      "resolves inline import and namespace-qualified JSDoc types through a two-hop export * barrel (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          read_fixture("javascript", "annotation_import_type_barrel"),
          order
        );
        const connect = member_of(project, paths["leaf.js"], "ChunkGraph", "connect");
        expect(targets_of(project, paths["consumer.js"], "connect", 7)).toEqual([connect]);
        expect(targets_of(project, paths["consumer.js"], "connect", 14)).toEqual([connect]);
      }
    );
  });
});
