import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { query_tree } from "./query_code_tree";
import type { Language } from "@ariadnejs/types";

function unique_capture_names(
  lang: Language,
  ts_lang: unknown,
  code: string,
): string[] {
  const parser = new Parser();
  parser.setLanguage(ts_lang);
  const tree = parser.parse(code);
  const captures = query_tree(lang, tree);
  return [...new Set(captures.map((c) => c.name))].sort();
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
      const code = `function add(a, b) { return a + b; }`;
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
        TypeScript.typescript,
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
      const code = `enum Direction { Up, Down, Left, Right }`;
      const names = unique_capture_names(
        "typescript",
        TypeScript.typescript,
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
        TypeScript.typescript,
        code,
      );
      expect(names).toContain("definition.interface");
      expect(names).toContain("definition.interface.method");
      expect(names).toContain("definition.parameter");
      expect(names).toContain("scope.interface");
      expect(names).toContain("reference.type");
    });

    it("should capture type alias definitions", () => {
      const code = `type Result<T> = { ok: true; value: T } | { ok: false; error: Error };`;
      const names = unique_capture_names(
        "typescript",
        TypeScript.typescript,
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
        TypeScript.typescript,
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
        "_scope_method_name",
        "assignment.property",
        "assignment.variable",
        "decorator.method",
        "decorator.property",
        "definition.class",
        "definition.constructor",
        "definition.field",
        "definition.function",
        "definition.import",
        "definition.method",
        "definition.parameter",
        "definition.property",
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
`;
      const names = unique_capture_names("python", Python, code);
      expect(names).toContain("decorator.method");
      expect(names).toContain("decorator.property");
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
      const code = `mapper = lambda x: x * 2`;
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
      const code = `const PI: f64 = 3.14159;`;
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
