import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { LANGUAGE_TO_TREESITTER_LANG } from "./parsers";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { query_tree } from "./query_code_tree";
import type { Language } from "@ariadnejs/types";
import * as fs from "node:fs";
import * as path from "node:path";

function unique_capture_names(
  lang: Language,
  ts_lang: Parser.Language,
  code: string,
): string[] {
  const parser = new Parser();
  parser.setLanguage(ts_lang);
  const tree = parser.parse(code);
  const captures = query_tree(lang, tree);
  return [...new Set(captures.map((c) => c.name))].sort();
}

/**
 * Capture node texts for one capture name, in document order — asserting the
 * exact list pins both count and identity ("exactly one @definition.method per
 * decorator shape" is a `toEqual` on this).
 */
export function capture_texts(
  lang: Language,
  ts_lang: Parser.Language,
  code: string,
  capture_name: string,
): string[] {
  const parser = new Parser();
  parser.setLanguage(ts_lang);
  const tree = parser.parse(code);
  return query_tree(lang, tree)
    .filter((c) => c.name === capture_name)
    .sort((a, b) => a.node.startIndex - b.node.startIndex)
    .map((c) => c.node.text);
}

describe("query_tree", () => {
  describe("JavaScript", () => {
    it("should produce exact capture names for a multi-construct module", () => {
      const code = `
import { foo } from "./module";
export function greet(name) {
  const result = foo(name);
  return result;
}
export class MyClass extends Base {
  constructor(value) {
    super();
    this.value = value;
  }
  method(x) {
    return this.value + x;
  }
}
const arrow = (a) => a + 1;
`;
      const names = unique_capture_names("javascript", JavaScript, code);
      expect(names).toEqual([
        "assignment.variable",
        "definition.class",
        "definition.constructor",
        "definition.function",
        "definition.import",
        "definition.method",
        "definition.parameter",
        "definition.variable",
        "export.class",
        "export.function",
        "reference.call",
        "reference.member_access",
        "reference.super",
        "reference.this",
        "reference.type_reference",
        "reference.variable",
        "return.function",
        "return.variable",
        "scope.class",
        "scope.constructor",
        "scope.function",
        "scope.method",
        "scope.module",
      ]);
    });

    it("should capture scope, definition, and reference for a simple function", () => {
      const code = "function add(a, b) { return a + b; }";
      const names = unique_capture_names("javascript", JavaScript, code);
      expect(names).toContain("scope.module");
      expect(names).toContain("scope.function");
      expect(names).toContain("definition.function");
      expect(names).toContain("definition.parameter");
      expect(names).toContain("reference.variable");
      expect(names).toContain("return.variable");
    });

    it("should capture import definitions", () => {
      const code = `
import { a, b } from "./lib";
import c from "./other";
`;
      const names = unique_capture_names("javascript", JavaScript, code);
      expect(names).toContain("definition.import");
      expect(names).toContain("reference.variable");
    });
  });

  describe("TypeScript", () => {
    it("should produce exact capture names for a multi-construct module", () => {
      const code = `
import { foo } from "./module";
export function greet(name: string): string {
  const result = foo(name);
  return result;
}
export class MyClass extends Base {
  private value: number;
  constructor(value: number) {
    super();
    this.value = value;
  }
  method(x: number): number {
    return this.value + x;
  }
}
export interface Greeter {
  greet(name: string): void;
}
enum Color { Red, Green, Blue }
type StringAlias = string;
const arrow = (a: number): number => a + 1;
`;
      const names = unique_capture_names(
        "typescript",
        LANGUAGE_TO_TREESITTER_LANG.get("typescript")!,
        code,
      );
      expect(names).toEqual([
        "assignment.variable",
        "definition.class",
        "definition.constructor",
        "definition.enum",
        "definition.enum.member",
        "definition.field",
        "definition.function",
        "definition.import",
        "definition.interface",
        "definition.interface.method",
        "definition.method",
        "definition.parameter",
        "definition.type_alias",
        "definition.variable",
        "export.class",
        "export.function",
        "export.interface",
        "modifier.access_modifier",
        "reference.call",
        "reference.member_access",
        "reference.super",
        "reference.this",
        "reference.type",
        "reference.type_reference",
        "reference.variable",
        "return.function",
        "return.variable",
        "scope.class",
        "scope.constructor",
        "scope.enum",
        "scope.function",
        "scope.interface",
        "scope.method",
        "scope.module",
      ]);
    });

    it("should capture enum definitions and members", () => {
      const code = "enum Direction { Up, Down, Left, Right }";
      const names = unique_capture_names(
        "typescript",
        LANGUAGE_TO_TREESITTER_LANG.get("typescript")!,
        code,
      );
      expect(names).toContain("definition.enum");
      expect(names).toContain("definition.enum.member");
      expect(names).toContain("scope.enum");
    });

    it("should capture interface definitions and method signatures", () => {
      const code = `
interface Repository {
  save(entity: Entity): Promise<void>;
  find(id: string): Entity | null;
}
`;
      const names = unique_capture_names(
        "typescript",
        LANGUAGE_TO_TREESITTER_LANG.get("typescript")!,
        code,
      );
      expect(names).toContain("definition.interface");
      expect(names).toContain("definition.interface.method");
      expect(names).toContain("definition.parameter");
      expect(names).toContain("scope.interface");
      expect(names).toContain("reference.type");
    });

    it("should capture type alias definitions", () => {
      const code = "type Result<T> = { ok: true; value: T } | { ok: false; error: Error };";
      const names = unique_capture_names(
        "typescript",
        LANGUAGE_TO_TREESITTER_LANG.get("typescript")!,
        code,
      );
      expect(names).toContain("definition.type_alias");
    });

    it("should capture access modifiers on class fields", () => {
      const code = `
class Foo {
  private x: number;
  protected y: string;
  public z: boolean;
}
`;
      const names = unique_capture_names(
        "typescript",
        LANGUAGE_TO_TREESITTER_LANG.get("typescript")!,
        code,
      );
      expect(names).toContain("modifier.access_modifier");
      expect(names).toContain("definition.field");
    });
  });

  describe("Python", () => {
    it("should produce exact capture names for a multi-construct module", () => {
      const code = `
from module import foo

def greet(name: str) -> str:
    result = foo(name)
    return result

class MyClass(Base):
    def __init__(self, value: int):
        super().__init__()
        self.value = value

    def method(self, x: int) -> int:
        return self.value + x

    @property
    def computed(self):
        return self.value * 2

class Color:
    RED = 1
    GREEN = 2

arrow = lambda a: a + 1
`;
      const names = unique_capture_names("python", Python, code);
      expect(names).toEqual([
        "_scope_decorated_method_name",
        "_scope_method_name",
        "assignment.property",
        "assignment.variable",
        "decorator.method",
        "definition.class",
        "definition.constructor",
        "definition.field",
        "definition.function",
        "definition.import",
        "definition.method",
        "definition.parameter",
        "definition.variable",
        "export.class",
        "export.function",
        "export.variable",
        "reference.call",
        "reference.constructor",
        "reference.member_access",
        "reference.property",
        "reference.super",
        "reference.this",
        "reference.type",
        "reference.variable",
        "reference.variable.base",
        "reference.variable.source",
        "reference.variable.target",
        "reference.write",
        "return.function",
        "return.variable",
        "scope.class",
        "scope.closure",
        "scope.constructor",
        "scope.function",
        "scope.method",
        "scope.module",
      ]);
    });

    it("should capture decorator captures", () => {
      const code = `
class Foo:
    @staticmethod
    def bar():
        pass

    @property
    def baz(self):
        return 1

    @cython.cfunc
    def qux(self):
        return 2

    @lru_cache(maxsize=1)
    def quux(self):
        return 3
`;
      const names = unique_capture_names("python", Python, code);
      expect(names).toContain("decorator.method");
      expect(names).toContain("definition.method");
    });

    it("should capture class field assignments", () => {
      const code = `
class Config:
    DEBUG = True
    MAX_RETRIES = 3
`;
      const names = unique_capture_names("python", Python, code);
      expect(names).toContain("definition.field");
      expect(names).toContain("definition.class");
    });

    it("should capture lambda as closure scope", () => {
      const code = "mapper = lambda x: x * 2";
      const names = unique_capture_names("python", Python, code);
      expect(names).toContain("scope.closure");
      // Note: lambda parameters use lambda_parameters node, not captured as definition.parameter
      expect(names).not.toContain("definition.parameter");
    });

    it("should capture from-import with multiple names", () => {
      const code = `
from os.path import join, dirname, basename
`;
      const names = unique_capture_names("python", Python, code);
      expect(names).toContain("definition.import");
    });
  });

  describe("Rust", () => {
    it("should produce exact capture names for a multi-construct module", () => {
      const code = `
use std::fmt;

pub fn greet(name: &str) -> String {
    format!("Hello, {}", name)
}

pub struct MyStruct {
    value: i32,
}

impl MyStruct {
    pub fn new(value: i32) -> Self {
        MyStruct { value }
    }

    pub fn method(&self, x: i32) -> i32 {
        self.value + x
    }
}

pub trait Drawable {
    fn draw(&self, canvas: &Canvas);
}

pub enum Color {
    Red,
    Green,
    Blue,
}

const MAX_SIZE: usize = 100;
`;
      const names = unique_capture_names("rust", Rust, code);
      expect(names).toEqual([
        "definition.class",
        "definition.constant",
        "definition.constructor",
        "definition.enum",
        "definition.enum_member",
        "definition.field",
        "definition.function",
        "definition.import",
        "definition.interface",
        "definition.interface.method",
        "definition.method",
        "definition.parameter",
        "definition.parameter.self",
        "export.class",
        "export.enum",
        "export.function",
        "export.interface",
        "modifier.visibility",
        "reference.constructor.struct",
        "reference.macro",
        "reference.this",
        "reference.type",
        "reference.variable",
        "scope.block",
        "scope.class",
        "scope.enum",
        "scope.function",
        "scope.interface",
        "scope.module",
      ]);
    });

    it("should capture trait definitions and method signatures", () => {
      const code = `
trait Serializable {
    fn serialize(&self) -> Vec<u8>;
    fn deserialize(data: &[u8]) -> Self;
}
`;
      const names = unique_capture_names("rust", Rust, code);
      expect(names).toContain("definition.interface");
      expect(names).toContain("definition.interface.method");
      expect(names).toContain("definition.parameter.self");
      expect(names).toContain("definition.parameter");
      expect(names).toContain("scope.interface");
    });

    it("should capture enum definitions with variants", () => {
      const code = `
enum Shape {
    Circle,
    Rectangle,
    Triangle,
}
`;
      const names = unique_capture_names("rust", Rust, code);
      expect(names).toContain("definition.enum");
      expect(names).toContain("definition.enum_member");
      expect(names).toContain("scope.enum");
    });

    it("should capture constant definitions", () => {
      const code = "const PI: f64 = 3.14159;";
      const names = unique_capture_names("rust", Rust, code);
      expect(names).toContain("definition.constant");
    });

    it("should capture self parameter in impl methods", () => {
      const code = `
struct Foo;
impl Foo {
    fn consume(self) {}
    fn borrow(&self) {}
    fn mutate(&mut self) {}
}
`;
      const names = unique_capture_names("rust", Rust, code);
      expect(names).toContain("definition.parameter.self");
      expect(names).toContain("definition.method");
    });

    it("should capture macro references", () => {
      const code = `
fn main() {
    println!("hello");
    vec![1, 2, 3];
}
`;
      const names = unique_capture_names("rust", Rust, code);
      expect(names).toContain("reference.macro");
    });
  });

  describe("Error Cases", () => {
    it("should throw error for unsupported language", () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse("const x = 1;");

      expect(() => {
        query_tree("unsupported" as Language, tree);
      }).toThrow();
    });
  });
});

describe("Python base-class references", () => {
  it("emits one type reference per base, whatever the class body holds", () => {
    // Carrying the base inside the Enum/Protocol member patterns re-emits it
    // once per class-body member, which is how a Django-shaped model came to
    // publish dozens of identical references to one base.
    const cases: [string, string[]][] = [
      ["class Sub(Base): pass", ["Base"]],
      ["class Sub(Base):\n    x = 1\n    y = 2", ["Base"]],
      ["class Article(models.Model):\n    a = 1\n    b = 2\n    c = 3", ["Model"]],
      ["class C(Base[T]): pass", ["Base"]],
      ["class C(mod.Base[T]): pass", ["Base"]],
      ["class F(Mammal, Flyable): pass", ["Mammal", "Flyable"]],
      ["class C: pass", []],
      ["class Color(Enum):\n    RED = 1\n    BLUE = 2", ["Enum"]],
      // A type annotation is a type reference too, so the Protocol's members
      // contribute theirs alongside the single reference to the base.
      ["class P(Protocol):\n    x: int\n    y: str", ["Protocol", "int", "str"]],
    ];

    expect(
      cases.map(([code]) => capture_texts("python", Python, code, "reference.type"))
    ).toEqual(cases.map(([, expected]) => expected));
  });
});

describe("Python class definitions over every superclass shape", () => {
  it("captures one class definition for bare, dotted, generic, dotted-generic, absent and multiple superclasses", () => {
    const code = [
      "class A(Base): pass",
      "class B(compiler.DDLCompiler): pass",
      "class C(Base[T]): pass",
      "class D(mod.Base[T]): pass",
      "class E: pass",
      "class F(Mammal, Flyable): pass",
    ].join("\n");
    expect(capture_texts("python", Python, code, "definition.class")).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
  });
});

describe("Python decorated methods over every decorator shape", () => {
  const CLASS_WITH_DECORATORS = [
    "class Box:",
    "    @property",
    "    def data(self):",
    "        return 1",
    "",
    "    @data.setter",
    "    def data(self, v):",
    "        pass",
    "",
    "    @staticmethod",
    "    def s():",
    "        return 2",
    "",
    "    @classmethod",
    "    def c(cls):",
    "        return 3",
    "",
    "    @cython.cfunc",
    "    def cy(self):",
    "        return 4",
    "",
    "    @util.memoized_property",
    "    def mp(self):",
    "        return 5",
    "",
    "    @functools.lru_cache()",
    "    def lc(self):",
    "        return 6",
    "",
    "    @lru_cache(maxsize=1)",
    "    def lm(self):",
    "        return 7",
    "",
    "    @mod.dec(arg)",
    "    def md(self):",
    "        return 8",
    "",
    "    def plain(self):",
    "        return 9",
  ].join("\n");

  it("captures one method definition per decorator shape", () => {
    expect(
      capture_texts("python", Python, CLASS_WITH_DECORATORS, "definition.method")
    ).toEqual(["data", "data", "s", "c", "cy", "mp", "lc", "lm", "md", "plain"]);
  });

  it("captures one method scope per method whatever decorates it", () => {
    const scopes = capture_texts(
      "python",
      Python,
      CLASS_WITH_DECORATORS,
      "scope.method"
    ).map((t) => t.split("\n")[0]);
    expect(scopes).toEqual([
      "def data(self):",
      "def data(self, v):",
      "def s():",
      "def c(cls):",
      "def cy(self):",
      "def mp(self):",
      "def lc(self):",
      "def lm(self):",
      "def md(self):",
      "def plain(self):",
    ]);
  });

  it("emits one call reference for a decorator", () => {
    const code = ["class C:", "    @property", "    def x(self):", "        return 1"].join(
      "\n"
    );
    expect(capture_texts("python", Python, code, "reference.call")).toEqual([
      "property",
    ]);
  });
});

describe("Python self and cls references", () => {
  it("captures self and cls as this references and nothing else", () => {
    const code = [
      "class C:",
      "    def m(self, key):",
      "        return cython.cfunc(self, key)",
      "",
      "    @classmethod",
      "    def k(cls):",
      "        return cls",
    ].join("\n");
    expect(capture_texts("python", Python, code, "reference.this")).toEqual([
      "self",
      "self",
      "cls",
      "cls",
    ]);
  });
});

describe("Python call references", () => {
  it("emits one call reference per call node", () => {
    const code = [
      "foo()",
      "bar(1)",
      "obj.method(2)",
      "Klass.static_m(3)",
    ].join("\n");
    expect(capture_texts("python", Python, code, "reference.call")).toEqual([
      "foo",
      "bar",
      "obj.method(2)",
      "Klass.static_m(3)",
    ]);
  });
});

describe("Fixture corpus invariants", () => {
  const FIXTURE_ROOT = path.join(__dirname, "../../../tests/fixtures");

  const CORPUS: Record<
    string,
    {
      grammar: Parser.Language;
      ext: string;
      named_definition_nodes: string[];
      duplicate_families: string[];
      /**
       * Duplicates the queries still emit, frozen exactly. A new duplicate and
       * a silently-fixed one both fail, so the residue can only shrink
       * deliberately.
       */
      known_duplicates: string[];
      single_definition_per_range: boolean;
    }
  > = {
    python: {
      grammar: Python,
      ext: ".py",
      named_definition_nodes: ["class_definition", "function_definition"],
      duplicate_families: [
        "definition.",
        "scope.",
        "reference.call",
        "reference.this",
      ],
      known_duplicates: [],
      single_definition_per_range: true,
    },
    javascript: {
      grammar: JavaScript,
      ext: ".js",
      named_definition_nodes: [
        "class_declaration",
        "function_declaration",
        "generator_function_declaration",
        "method_definition",
      ],
      duplicate_families: [
        "definition.",
        "scope.",
        "reference.call",
        "reference.member_access",
      ],
      known_duplicates: [],
      single_definition_per_range: false,
    },
    typescript: {
      grammar: LANGUAGE_TO_TREESITTER_LANG.get("typescript")!,
      ext: ".ts",
      // TypeScript parameter properties deliberately mint definition.parameter
      // and definition.field at one range — two different capture names — so
      // the single-definition-per-range clause stays python-only.
      named_definition_nodes: [
        "class_declaration",
        "abstract_class_declaration",
        "function_declaration",
        "method_definition",
      ],
      duplicate_families: [
        "definition.",
        "scope.",
        "reference.call",
        "reference.member_access",
      ],
      // Modifier-variant patterns re-capture fields, parameters and methods.
      // Collapsing them is owned by TASK-374.5; freezing the exact residue
      // here fails the build on a new one.
      known_duplicates: [
        "typescript/code/classes/basic_class.ts definition.parameter@90:94 x2",
        "typescript/code/classes/basic_class.ts definition.parameter@115:120 x2",
        "typescript/code/classes/inheritance.ts definition.parameter@149:153 x2",
        "typescript/code/classes/methods.ts definition.field@206:213 x3",
        "typescript/code/classes/methods.ts definition.field@235:242 x2",
        "typescript/code/classes/methods.ts definition.method@507:515 x2",
        "typescript/code/classes/methods.ts definition.method@599:605 x2",
        "typescript/code/classes/properties.ts definition.field@132:136 x2",
        "typescript/code/classes/properties.ts definition.field@156:159 x2",
        "typescript/code/classes/properties.ts definition.field@181:188 x2",
        "typescript/code/classes/properties.ts definition.field@209:211 x2",
        "typescript/code/classes/properties.ts definition.method@392:399 x2",
        "typescript/code/classes/properties.ts definition.method@448:461 x2",
        "typescript/code/classes/properties.ts definition.method@505:516 x2",
        "typescript/code/generics/generic_classes.ts definition.parameter@160:165 x2",
        "typescript/code/generics/generic_classes.ts definition.parameter@374:377 x2",
        "typescript/code/generics/generic_classes.ts definition.parameter@393:398 x2",
        "typescript/code/generics/generic_classes.ts definition.field@591:596 x2",
        "typescript/code/generics/generic_classes.ts definition.parameter@918:925 x2",
        "typescript/code/generics/generic_classes.ts definition.parameter.optional@947:951 x2",
        "typescript/code/generics/generic_classes.ts definition.parameter.optional@968:973 x2",
        "typescript/code/generics/generic_classes.ts definition.method@995:997 x2",
        "typescript/code/generics/generic_classes.ts definition.method@1072:1075 x2",
        "typescript/code/integration/constructor_method_chain.ts definition.parameter@145:149 x2",
        "typescript/code/integration/constructor_method_chain.ts definition.parameter@170:175 x2",
        "typescript/code/integration/optional_param_properties/application_config.ts definition.field@329:340 x2",
        "typescript/code/integration/optional_param_properties/merged_extensions_list.ts definition.parameter.optional@406:414 x3",
        "typescript/code/integration/optional_param_properties/merged_extensions_list.ts definition.field@406:414 x2",
        "typescript/code/integration/optional_param_properties/pipes_context_creator.ts definition.parameter.optional@485:502 x3",
        "typescript/code/integration/optional_param_properties/pipes_context_creator.ts definition.field@485:502 x2",
        "typescript/code/integration/optional_param_properties/testing_injector.ts definition.parameter.optional@357:374 x2",
        "typescript/code/integration/types.ts definition.parameter@162:166 x2",
        "typescript/code/integration/types.ts definition.parameter@187:192 x2",
        "typescript/code/modules/exports.ts definition.parameter@388:396 x2",
        "typescript/code/modules/exports.ts definition.parameter@1112:1118 x2",
      ],
      single_definition_per_range: false,
    },
  };

  /**
   * Definition-capture sets that already land on one byte range. A class-body
   * assignment is a field and a variable; in an Enum or Protocol body the
   * member capture joins them. Collapsing these is TASK-374.5.
   */
  const KNOWN_RANGE_COLLISIONS = [
    "definition.field+definition.variable",
    "definition.enum_member+definition.field+definition.variable",
    "definition.field+definition.property.interface+definition.variable",
  ];

  function corpus_files(lang: string, ext: string): string[] {
    const dir = path.join(FIXTURE_ROOT, lang, "code");
    const found: string[] = [];
    const stack = [dir];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name.endsWith(ext)) found.push(full);
      }
    }
    return found.sort();
  }

  function walk_named_nodes(
    root: Parser.SyntaxNode,
    visit: (node: Parser.SyntaxNode) => void
  ): void {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop()!;
      visit(node);
      for (let i = 0; i < node.namedChildCount; i++) {
        stack.push(node.namedChild(i)!);
      }
    }
  }

  for (const [lang, config] of Object.entries(CORPUS)) {
    it(`yields a definition capture at the name of every named definition node in the ${lang} corpus`, () => {
      const parser = new Parser();
      parser.setLanguage(config.grammar);
      const missing: string[] = [];

      for (const file of corpus_files(lang, config.ext)) {
        const tree = parser.parse(fs.readFileSync(file, "utf-8"));
        const captures = query_tree(lang as Language, tree);
        const definition_ranges = new Set(
          captures
            .filter((c) => c.name.startsWith("definition."))
            .map((c) => `${c.node.startIndex}:${c.node.endIndex}`)
        );
        walk_named_nodes(tree.rootNode, (node) => {
          if (!config.named_definition_nodes.includes(node.type)) return;
          const name_node = node.childForFieldName("name");
          if (!name_node) return;
          const range = `${name_node.startIndex}:${name_node.endIndex}`;
          if (!definition_ranges.has(range)) {
            missing.push(
              `${path.relative(FIXTURE_ROOT, file)}:${
                name_node.startPosition.row + 1
              } ${node.type} ${name_node.text}`
            );
          }
        });
      }

      expect(missing).toEqual([]);
    });

    // The duplicate audit covers the families listed per language in
    // CORPUS.duplicate_families. Families outside that scope still carry
    // same-(name,range) duplicates — the python reference/assignment attribute
    // captures among them — and are owned by TASK-374.5.
    it(`repeats a capture at one byte range only where ${lang} already did`, () => {
      const parser = new Parser();
      parser.setLanguage(config.grammar);
      const duplicates: string[] = [];

      for (const file of corpus_files(lang, config.ext)) {
        const tree = parser.parse(fs.readFileSync(file, "utf-8"));
        const captures = query_tree(lang as Language, tree);
        const seen = new Map<string, number>();
        for (const capture of captures) {
          if (!config.duplicate_families.some((f) => capture.name.startsWith(f)))
            continue;
          const key = `${capture.name}@${capture.node.startIndex}:${capture.node.endIndex}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
        for (const [key, count] of seen) {
          if (count > 1) {
            duplicates.push(`${path.relative(FIXTURE_ROOT, file)} ${key} x${count}`);
          }
        }
      }

      expect(duplicates).toEqual(config.known_duplicates);
    });

    if (config.single_definition_per_range) {
      it(`emits at most one definition-category capture per byte range in the ${lang} corpus`, () => {
        const parser = new Parser();
        parser.setLanguage(config.grammar);
        const collisions: string[] = [];

        for (const file of corpus_files(lang, config.ext)) {
          const tree = parser.parse(fs.readFileSync(file, "utf-8"));
          const captures = query_tree(lang as Language, tree);
          const by_range = new Map<string, string[]>();
          for (const capture of captures) {
            if (!capture.name.startsWith("definition.")) continue;
            const range = `${capture.node.startIndex}:${capture.node.endIndex}`;
            by_range.set(range, [...(by_range.get(range) ?? []), capture.name]);
          }
          for (const [range, names] of by_range) {
            if (names.length <= 1) continue;
            // A class-body assignment mints definition.field and
            // definition.variable at one range; inside an Enum or a Protocol
            // the member capture lands on the same range as a third. Both are
            // pre-existing collisions owned by TASK-374.5. Listing the exact
            // sets keeps a NEW collision failing.
            const sorted = [...names].sort().join("+");
            if (KNOWN_RANGE_COLLISIONS.includes(sorted)) continue;
            collisions.push(
              `${path.relative(FIXTURE_ROOT, file)} ${range} ${names.join("+")}`
            );
          }
        }

        expect(collisions).toEqual([]);
      });
    }
  }
});
