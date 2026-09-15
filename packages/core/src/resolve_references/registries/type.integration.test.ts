import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "../../project/project";
import type { FilePath, SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * Every form a receiver's type is written in — an annotation, a construction,
 * a call initialiser — resolves to the type it declares, end to end: index →
 * TypeRegistry → receiver resolution → call edge. Each "does not" case is the
 * insulation beside it — a wrapper or container the annotation grammar must
 * not see through.
 */
describe("receiver types through the project pipeline", () => {
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

  /**
   * A variable's type and what a callable returns are recorded in two stores:
   * a hop through a function or method continues on its declared return, a
   * hop through anything else on the value it holds.
   */
  /**
   * Heritage names resolve exactly as annotations do, so every shape a
   * declaration writes its parents in — qualified through a namespace or a
   * module, generic, a Rust `impl Trait for T` — lands as an edge keyed on the
   * definition it names, and dispatch walks those edges.
   */
  describe("heritage", () => {
    /** The head of a dispatch list, then the rest as a set: implementations arrive in ingest order. */
    function head_and_rest(targets: readonly SymbolId[]): [SymbolId | undefined, Set<SymbolId>] {
      return [targets[0], new Set(targets.slice(1))];
    }

    it.each([
      ["interface file first", ["output_ast.ts", "abstract_emitter.ts", "translator.ts", "type_translator.ts"]],
      ["implementers first", ["type_translator.ts", "translator.ts", "abstract_emitter.ts", "output_ast.ts"]],
    ])(
      "presents every `implements o.TypeVisitor` implementer to a TypeVisitor receiver (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          read_fixture("typescript", "heritage_namespace_visitor"),
          order
        );
        const ast = paths["output_ast.ts"];
        const type_visitor = type_named(project, ast, "TypeVisitor");
        const expression_visitor = type_named(project, ast, "ExpressionVisitor");
        const emitter = type_named(project, paths["abstract_emitter.ts"], "AbstractEmitterVisitor");
        const translator = type_named(project, paths["translator.ts"], "ExpressionTranslatorVisitor");
        const type_translator = type_named(project, paths["type_translator.ts"], "TypeTranslatorVisitor");

        expect(project.definitions.get_parent_types(emitter)).toEqual([
          type_named(project, ast, "BaseVisitor"),
          type_visitor,
        ]);
        expect(project.definitions.get_parent_types(translator)).toEqual([expression_visitor, type_visitor]);
        expect(project.definitions.get_parent_types(type_translator)).toEqual([
          expression_visitor,
          type_visitor,
        ]);
        expect(head_and_rest(targets_of(project, ast, "visitBuiltinType", 15))).toEqual([
          member_of(project, ast, "TypeVisitor", "visitBuiltinType"),
          new Set([
            member_of(project, paths["abstract_emitter.ts"], "AbstractEmitterVisitor", "visitBuiltinType"),
            member_of(project, paths["translator.ts"], "ExpressionTranslatorVisitor", "visitBuiltinType"),
            member_of(project, paths["type_translator.ts"], "TypeTranslatorVisitor", "visitBuiltinType"),
          ]),
        ]);
        expect(targets_of(project, paths["abstract_emitter.ts"], "visitComment", 7)).toEqual([
          member_of(project, ast, "BaseVisitor", "visitComment"),
        ]);
      }
    );

    it("re-dispatches a parent's call site when another file gains `implements`, drops it, or is deleted", async () => {
      const visitor = `export interface Visitor {
  visit(): void;
}
export function dispatch(v: Visitor) {
  v.visit();
}
`;
      const implementing = `import { Visitor } from "./visitor";
export class Printer implements Visitor {
  visit(): void {}
}
`;
      const standalone = `export class Printer {
  visit(): void {}
}
`;
      const { project, paths } = await load_project({ "visitor.ts": visitor, "printer.ts": standalone });
      const interface_member = member_of(project, paths["visitor.ts"], "Visitor", "visit");
      expect(targets_of(project, paths["visitor.ts"], "visit", 5)).toEqual([]);

      project.update_file(paths["printer.ts"], implementing);

      expect(targets_of(project, paths["visitor.ts"], "visit", 5)).toEqual([
        interface_member,
        member_of(project, paths["printer.ts"], "Printer", "visit"),
      ]);

      project.update_file(paths["printer.ts"], standalone);

      expect(targets_of(project, paths["visitor.ts"], "visit", 5)).toEqual([]);

      project.update_file(paths["printer.ts"], implementing);
      project.remove_file(paths["printer.ts"]);

      expect(targets_of(project, paths["visitor.ts"], "visit", 5)).toEqual([]);
    });

    it.todo(
      "fans a trait-bound generic receiver, `fn walk<V: Visitor>(v: &mut V)`, out to every `impl Visitor for T` — binding V through its bound is TASK-376.15"
    );

    it("registers both edges for a class implementing two same-named interfaces from different modules", async () => {
      const facade = "export interface CompilerFacade {\n  compilePipe(): void;\n}\n";
      const { project, paths } = await load_project({
        "compiler/compiler_facade_interface.ts": facade,
        "core/compiler_facade_interface.ts": facade,
        "compiler/jit_compiler_facade.ts": `import * as core from "../core/compiler_facade_interface";
import { CompilerFacade } from "./compiler_facade_interface";
export class CompilerFacadeImpl implements core.CompilerFacade, CompilerFacade {
  compilePipe(): void {}
}
`,
      });
      const core_facade = type_named(project, paths["core/compiler_facade_interface.ts"], "CompilerFacade");
      const compiler_facade = type_named(project, paths["compiler/compiler_facade_interface.ts"], "CompilerFacade");
      const impl = type_named(project, paths["compiler/jit_compiler_facade.ts"], "CompilerFacadeImpl");

      expect(core_facade).not.toEqual(compiler_facade);
      expect(project.definitions.get_parent_types(impl)).toEqual([core_facade, compiler_facade]);
    });

    it.each([
      ["trait file first", ["lib.rs", "fold.rs", "visit.rs", "cache.rs"]],
      ["implementer first", ["cache.rs", "visit.rs", "fold.rs", "lib.rs"]],
    ])(
      "records `impl DocFolder for CacheBuilder` once and reaches the override from the trait's default body (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          read_fixture("rust", "heritage_trait_impls"),
          order
        );
        const doc_folder = type_named(project, paths["fold.rs"], "DocFolder");
        const cache_builder = type_named(project, paths["cache.rs"], "CacheBuilder");

        expect(project.definitions.get_parent_types(cache_builder)).toEqual([doc_folder]);
        expect(new Set(project.definitions.get_subtypes(doc_folder))).toEqual(new Set([cache_builder]));
        expect(head_and_rest(targets_of(project, paths["fold.rs"], "fold_item", 11))).toEqual([
          member_of(project, paths["fold.rs"], "DocFolder", "fold_item"),
          new Set([member_of(project, paths["cache.rs"], "CacheBuilder", "fold_item")]),
        ]);
      }
    );

    it("fans a trait-typed receiver out to every `impl Visitor for T`", async () => {
      const { project, paths } = await load_project(read_fixture("rust", "heritage_trait_impls"));
      const visit = paths["visit.rs"];
      const visitor = type_named(project, visit, "Visitor");
      const collector = type_named(project, visit, "Collector");
      const counter = type_named(project, visit, "Counter");

      expect(new Set(project.definitions.get_subtypes(visitor))).toEqual(new Set([collector, counter]));
      expect(head_and_rest(targets_of(project, visit, "visit_item", 24))).toEqual([
        member_of(project, visit, "Visitor", "visit_item"),
        new Set([
          member_of(project, visit, "Collector", "visit_item"),
          member_of(project, visit, "Counter", "visit_item"),
        ]),
      ]);
    });

    it.each([
      ["type file first", ["types.rs", "impls.rs"]],
      ["impl file first", ["impls.rs", "types.rs"]],
    ])("records the trait edge of an impl whose type another file declares (%s)", async (_order, order) => {
      const read = (name: string) =>
        fs.readFileSync(path.join(FIXTURES_ROOT, "rust", "code", "integration", name), "utf-8");
      const { project, paths } = await load_project(
        { "types.rs": read("types.rs"), "impls.rs": read("impls.rs") },
        order
      );

      const lowering = type_named(project, paths["types.rs"], "Lowering");
      const report = project.definitions.get_member_index().get(lowering)?.get("report" as SymbolName);

      expect(project.definitions.get_parent_types(lowering)).toEqual([
        type_named(project, paths["types.rs"], "Visit"),
      ]);
      expect(report && project.definitions.get(report)?.location.file_path).toEqual(paths["impls.rs"]);
      expect(targets_of(project, paths["impls.rs"], "report", 17)).toEqual([report]);
    });

    it.each([
      ["type, impl, caller", ["s.rs", "impl_s.rs", "main.rs"]],
      ["impl, type, caller", ["impl_s.rs", "s.rs", "main.rs"]],
    ])(
      "resolves a third file's call to a method a cross-file impl declares, and keeps it out of the entry points (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          {
            "s.rs": "pub struct S {\n    pub val: i32,\n}\n",
            "impl_s.rs": "use crate::s::S;\nimpl S {\n    pub fn helper(&self) -> i32 {\n        self.val\n    }\n}\n",
            "main.rs": "mod s;\nmod impl_s;\nuse crate::s::S;\npub fn run(s: S) -> i32 {\n    s.helper()\n}\n",
          },
          order
        );
        const helper = member_of(project, paths["s.rs"], "S", "helper");

        expect(project.definitions.get(helper)?.location.file_path).toEqual(paths["impl_s.rs"]);
        expect(targets_of(project, paths["main.rs"], "helper", 5)).toEqual([helper]);
        expect(project.get_call_graph().entry_points).not.toContain(helper);

        project.remove_file(paths["impl_s.rs"]);

        const s_type = type_named(project, paths["s.rs"], "S");
        expect([...(project.definitions.get_member_index().get(s_type)?.keys() ?? [])]).toEqual(["val"]);
      }
    );

    it.each([
      ["base first", ["sql/__init__.py", "sql/compiler.py", "dialects/__init__.py", "dialects/pg.py"]],
      ["subclass first", ["dialects/pg.py", "dialects/__init__.py", "sql/compiler.py", "sql/__init__.py"]],
    ])(
      "resolves super() through a dotted base, `class PGDDLCompiler(compiler.DDLCompiler)` (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(
          read_fixture("python", "heritage_dotted_base"),
          order
        );
        const base_visit = member_of(project, paths["sql/compiler.py"], "DDLCompiler", "visit_create_sequence");
        const pg_visit = member_of(project, paths["dialects/pg.py"], "PGDDLCompiler", "visit_create_sequence");

        expect(project.definitions.get_parent_types(type_named(project, paths["dialects/pg.py"], "PGDDLCompiler"))).toEqual([
          type_named(project, paths["sql/compiler.py"], "DDLCompiler"),
        ]);
        // super() runs the base method and nothing below it; a call on the
        // base's own `self` fans out to the override beside it.
        expect(targets_of(project, paths["dialects/pg.py"], "visit_create_sequence", 8)).toEqual([base_visit]);
        expect(targets_of(project, paths["sql/compiler.py"], "visit_create_sequence", 10)).toEqual([
          base_visit,
          pg_visit,
        ]);
      }
    );

    it.each([
      ["base first", ["base.py", "widgets.py"]],
      ["subclasses first", ["widgets.py", "base.py"]],
    ])(
      "reaches a subclass override from a base or mixin body, and a member two hops up the second base (%s)",
      async (_order, order) => {
        const { project, paths } = await load_project(read_fixture("python", "heritage_mixins"), order);
        const base = paths["base.py"];
        const widgets = paths["widgets.py"];
        const c = type_named(project, widgets, "C");

        expect(project.definitions.get_parent_types(type_named(project, widgets, "Widget"))).toEqual([
          type_named(project, base, "Base"),
          type_named(project, base, "Mixin"),
        ]);
        expect(new Set(targets_of(project, base, "step", 30))).toEqual(
          new Set([
            member_of(project, base, "Base", "step"),
            member_of(project, base, "Local", "step"),
            member_of(project, widgets, "Widget", "step"),
          ])
        );
        expect(targets_of(project, base, "hook", 22)).toEqual([
          member_of(project, base, "Mixin", "hook"),
          member_of(project, widgets, "Widget", "hook"),
        ]);
        expect(project.types.walk_inheritance_chain(c)).toEqual([
          c,
          type_named(project, base, "Other"),
          type_named(project, base, "Mid"),
          type_named(project, base, "Root"),
        ]);
        expect(targets_of(project, widgets, "deep", 19)).toEqual([member_of(project, base, "Root", "deep")]);
      }
    );
  });

  describe("value types and callable return types", () => {
    it("records a method's return annotation as its return type, never as a value type, and hops through it", async () => {
      const { project, paths } = await load_project({
        "a.ts": `class Conn { exec() {} }
class Engine { connect(): Conn { return new Conn(); } }
function chained(e: Engine) { e.connect().exec(); }
`,
      });
      const file = paths["a.ts"];
      const connect = member_of(project, file, "Engine", "connect");
      expect(project.types.get_callable_return_type(connect)).toEqual(type_named(project, file, "Conn"));
      expect(project.types.get_symbol_type(connect)).toBeNull();
      expect(project.types.get_symbol_type(parameter_of(project, file, "chained", "e"))).toEqual(
        type_named(project, file, "Engine")
      );
      expect(project.types.get_callable_return_type(parameter_of(project, file, "chained", "e"))).toBeNull();
      expect(targets_of(project, file, "exec", 3)).toEqual([member_of(project, file, "Conn", "exec")]);
    });

    it("hops through a module function's return type reached through a namespace import", async () => {
      const { project, paths } = await load_project({
        "conn.ts": `export class Conn { exec() {} }
export function open(): Conn { return new Conn(); }
`,
        "use.ts": `import * as factory from "./conn";
function use() { factory.open().exec(); }
`,
      });
      const open = [...project.get_index_single_file(paths["conn.ts"])!.functions.values()].find(
        (definition) => definition.name === "open"
      )!.symbol_id;
      expect(project.types.get_callable_return_type(open)).toEqual(type_named(project, paths["conn.ts"], "Conn"));
      expect(project.types.get_symbol_type(open)).toBeNull();
      expect(targets_of(project, paths["use.ts"], "exec", 2)).toEqual([
        member_of(project, paths["conn.ts"], "Conn", "exec"),
      ]);
    });

    it("hops through a Rust method's return type on a self receiver", async () => {
      const { project, paths } = await load_project({
        "lib.rs": `struct Header;
impl Header { fn encoded_size(&self) -> usize { 0 } }
struct Frame { header: Header }
impl Frame {
    fn header(&self) -> &Header { &self.header }
    fn size(&self) -> usize { self.header().encoded_size() }
}
`,
      });
      const file = paths["lib.rs"];
      expect(targets_of(project, file, "encoded_size", 6)).toEqual([
        member_of(project, file, "Header", "encoded_size"),
      ]);
    });

    it("hops through a Rust enum method's return type", async () => {
      const { project, paths } = await load_project({
        "lib.rs": `struct Parser;
impl Parser { fn run(&self) {} }
enum Mode { Fast }
impl Mode {
    fn parser(&self) -> Parser { Parser }
    fn go(&self) { self.parser().run(); }
}
`,
      });
      const file = paths["lib.rs"];
      expect(project.types.get_callable_return_type(member_of(project, file, "Mode", "parser"))).toEqual(
        type_named(project, file, "Parser")
      );
      expect(targets_of(project, file, "run", 6)).toEqual([member_of(project, file, "Parser", "run")]);
    });
  });

  describe("constructions and call initialisers", () => {
    /** The 1-based line of the one line of `source` containing `text`. */
    function line_of(source: string, text: string): number {
      const lines = source.split("\n");
      const matches = lines.flatMap((line, index) => (line.includes(text) ? [index + 1] : []));
      expect(matches.length).toBe(1);
      return matches[0];
    }

    function variable_in(project: Project, file: FilePath, name: string, line: number): SymbolId {
      const found = [...(project.get_index_single_file(file)?.variables.values() ?? [])].find(
        (definition) => definition.name === name && definition.location.start_line === line
      );
      if (!found) throw new Error(`${file} declares no ${name} on line ${line}`);
      return found.symbol_id;
    }

    describe("typescript", () => {
      it("binds a declarator to the outer construction, not one passed as its argument (angular lexer.ts:116)", async () => {
        const files = read_fixture("typescript", "initialiser_capture");
        const { project, paths } = await load_project(files);
        const file = paths["lexer.ts"];
        expect(
          targets_of(project, file, "tokenize", line_of(files["lexer.ts"], "tokenizer.tokenize()"))
        ).toEqual([member_of(project, file, "_Tokenizer", "tokenize")]);
      });

      it("types a field from its initialiser and from a constructor write to it", async () => {
        const files = read_fixture("typescript", "initialiser_capture");
        const { project, paths } = await load_project(files);
        const file = paths["services.ts"];
        const source = files["services.ts"];
        expect(targets_of(project, file, "log", line_of(source, "this.logger.log()"))).toEqual([
          member_of(project, file, "Logger", "log"),
        ]);
        expect(targets_of(project, file, "clear", line_of(source, "this.cache.clear()"))).toEqual([
          member_of(project, file, "Cache", "clear"),
        ]);
      });

      it("types a variable initialised from a method call", async () => {
        const files = read_fixture("typescript", "initialiser_capture");
        const { project, paths } = await load_project(files);
        const file = paths["services.ts"];
        const describe_calls = files["services.ts"]
          .split("\n")
          .flatMap((line, index) => (line.includes("info.describe()") ? [index + 1] : []));
        expect(describe_calls.map((line) => targets_of(project, file, "describe", line))).toEqual([
          [member_of(project, file, "Info", "describe")],
          [member_of(project, file, "Info", "describe")],
        ]);
      });
      it.each([
        ["callee first", ["registry.ts", "report.ts"]],
        ["caller first", ["report.ts", "registry.ts"]],
      ] as const)(
        "types a method-call initialiser whose callee another file declares, %s",
        async (_order, order) => {
          const files = {
            "registry.ts": `export class Info { describe(): void {} }
export class Registry { getInfo(): Info { return new Info(); } }
`,
            "report.ts": `import { Registry } from "./registry";
export function report(registry: Registry): void {
  const info = registry.getInfo();
  info.describe();
}
`,
          };
          const { project, paths } = await load_project(files, order);
          expect(targets_of(project, paths["report.ts"], "describe", 4)).toEqual([
            member_of(project, paths["registry.ts"], "Info", "describe"),
          ]);
        }
      );
    });

    describe("javascript", () => {
      it("resolves a private-name chain and fields a constructor declares by assigning them (webpack Compilation)", async () => {
        const files = read_fixture("javascript", "initialiser_capture");
        const { project, paths } = await load_project(files);
        const file = paths["compilation.js"];
        const source = files["compilation.js"];
        expect([
          targets_of(project, file, "getTransaction", line_of(source, "this.#tm.getTransaction()")),
          targets_of(project, file, "split", line_of(source, "this.chunk.split()")),
          targets_of(project, file, "connect", line_of(source, "this.chunkGraph.connect()")),
        ]).toEqual([
          [member_of(project, file, "TransactionManager", "getTransaction")],
          [member_of(project, file, "Chunk", "split")],
          [member_of(project, file, "ChunkGraph", "connect")],
        ]);
      });

      it("types a constructor write and a local declarator from their JSDoc @type", async () => {
        const files = read_fixture("javascript", "initialiser_capture");
        const { project, paths } = await load_project(files);
        const file = paths["jsdoc_types.js"];
        const source = files["jsdoc_types.js"];
        const get = member_of(project, file, "Cache", "get");
        expect([
          targets_of(project, file, "get", line_of(source, "this.cache.get()")),
          targets_of(project, file, "get", line_of(source, "  cache.get()")),
        ]).toEqual([[get], [get]]);
      });
    });

    describe("python", () => {
      it("types a variable from the declared return of the function or method it calls", async () => {
        const files = read_fixture("python", "initialiser_capture");
        const { project, paths } = await load_project(files);
        const file = paths["html.py"];
        const execute = member_of(project, file, "Connection", "execute");
        const execute_lines = files["html.py"]
          .split("\n")
          .flatMap((line, index) => (line.includes("conn.execute()") ? [index + 1] : []));
        expect(execute_lines.map((line) => targets_of(project, file, "execute", line))).toEqual([
          [execute],
          [execute],
          [execute],
        ]);
      });

      it("does not type a variable from a return annotation that names a type variable (sqlalchemy queue.get)", async () => {
        const source = `from typing import Generic, TypeVar

_T = TypeVar("_T")


class Queue(Generic[_T]):
    def get(self) -> _T:
        raise NotImplementedError()


def dispose(queue: Queue):
    conn = queue.get()
    conn.close()
`;
        const { project, paths } = await load_project({ "queue.py": source });
        const file = paths["queue.py"];
        const conn = variable_in(project, file, "conn", line_of(source, "conn = queue.get()"));
        expect(project.types.get_symbol_type(conn)).toBe(null);
      });

      it("records a type[X] return as a class object, not an instance (pandas _parser_dispatch)", async () => {
        const files = read_fixture("python", "initialiser_capture");
        const { project, paths } = await load_project(files);
        const file = paths["html.py"];
        const source = files["html.py"];
        const parser = variable_in(project, file, "parser", line_of(source, "parser = _parser_dispatch"));
        const factory_product = variable_in(project, file, "p", line_of(source, "p = make()(io)"));
        const dispatch = [...project.get_index_single_file(file)!.functions.values()].find(
          (definition) => definition.name === "_parser_dispatch"
        )!.symbol_id;
        expect({
          parser_type: project.types.get_symbol_type(parser),
          parser_arguments: project.types.get_symbol_type_arguments(parser),
          factory_product_type: project.types.get_symbol_type(factory_product),
          dispatch_return_type: project.types.get_callable_return_type(dispatch),
          dispatch_return_class: project.types.get_callable_return_class(dispatch),
        }).toEqual({
          parser_type: null,
          parser_arguments: [type_named(project, file, "_HtmlFrameParser")],
          // What a class object constructs is what the binding holds, not the
          // type its declaration records: the value source answers it.
          factory_product_type: null,
          dispatch_return_type: null,
          dispatch_return_class: type_named(project, file, "_HtmlFrameParser"),
        });
      });
    });
  });
});
