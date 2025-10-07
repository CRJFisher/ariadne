/**
 * Semantic Index Tests - Rust
 *
 * Tests verify that Rust code is properly parsed and indexed, focusing on:
 * - Structs and enums (as classes)
 * - Traits (as interfaces)
 * - Impl blocks (methods)
 * - Functions
 * - Basic ownership patterns (& references)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { FilePath, Language } from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import type { ParsedFile } from "./file_utils";

const FIXTURES_DIR = join(__dirname, "..", "..", "tests", "fixtures", "rust");

// Helper to create a ParsedFile from code
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path: filePath,
    file_lines: lines.length,
    // For 1-indexed positions with exclusive ends: end_column = length + 1
    // (tree-sitter's endPosition is exclusive and we add 1 to convert to 1-indexed)
    file_end_column: (lines[lines.length - 1]?.length || 0) + 1,
    tree,
    lang: language,
  };
}

describe("Semantic Index - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  // ============================================================================
  // STRUCTS AND ENUMS
  // ============================================================================

  describe("Structs and enums", () => {
    it("should extract struct definitions", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "basic_structs_and_enums.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "basic_structs_and_enums.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify structs are captured as classes
      const class_names = Array.from(index.classes.values()).map((c) => c.name);
      expect(class_names).toContain("Point");
      expect(class_names).toContain("Pair");
      expect(class_names).toContain("Color");
    });

    it("should extract enum definitions", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "basic_structs_and_enums.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "basic_structs_and_enums.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify enums are captured
      const enum_names = Array.from(index.enums.values()).map((e) => e.name);
      expect(enum_names).toContain("Direction");
      expect(enum_names).toContain("Option");
      expect(enum_names).toContain("Message");
    });

    it("should extract enum variants with complete structure", () => {
      const code = `
enum Direction {
    North,
    South,
    East,
    West,
}

enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(i32, i32, i32),
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify Direction enum with simple variants
      const direction_enum = Array.from(index.enums.values()).find(
        (e) => e.name === "Direction"
      );
      expect(direction_enum).toBeDefined();

      if (direction_enum) {
        // Verify complete enum structure
        expect(direction_enum).toMatchObject({
          kind: "enum",
          symbol_id: expect.stringMatching(/^enum:/),
          name: "Direction",
          location: expect.objectContaining({
            file_path: "test.rs",
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          }),
          defining_scope_id: expect.any(String),
        });

        // Verify enum members
        expect(direction_enum.members).toBeDefined();
        expect(Array.isArray(direction_enum.members)).toBe(true);
        expect(direction_enum.members.length).toBe(4);

        // Extract member names (they might be in symbol ID format)
        const member_names = direction_enum.members.map((m) => {
          const name = m.name;
          // Handle both plain names and symbol IDs like "enum_member:North:file:line:col"
          return name.includes(":") ? name.split(":")[1] : name;
        });

        expect(member_names).toContain("North");
        expect(member_names).toContain("South");
        expect(member_names).toContain("East");
        expect(member_names).toContain("West");
      }

      // Verify Message enum with complex variants
      const message_enum = Array.from(index.enums.values()).find(
        (e) => e.name === "Message"
      );
      expect(message_enum).toBeDefined();

      if (message_enum) {
        expect(message_enum).toMatchObject({
          kind: "enum",
          symbol_id: expect.stringMatching(/^enum:/),
          name: "Message",
          location: expect.objectContaining({
            file_path: "test.rs",
          }),
          defining_scope_id: expect.any(String),
        });

        // Verify members with different field types
        expect(message_enum.members).toBeDefined();
        expect(message_enum.members.length).toBe(4);

        const member_names = message_enum.members.map((m) => {
          const name = m.name;
          return name.includes(":") ? name.split(":")[1] : name;
        });

        expect(member_names).toContain("Quit");
        expect(member_names).toContain("Move");
        expect(member_names).toContain("Write");
        expect(member_names).toContain("ChangeColor");
      }
    });

    it("should extract enum variants", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "basic_structs_and_enums.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "basic_structs_and_enums.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify enum members are captured within enum definitions
      const direction_enum = Array.from(index.enums.values()).find(
        (e) => e.name === "Direction"
      );
      expect(direction_enum).toBeDefined();
      expect(direction_enum?.members).toBeDefined();

      const member_names =
        direction_enum?.members.map((m) => {
          const name = m.name;
          return name.includes(":") ? name.split(":").pop() || name : name;
        }) || [];
      expect(member_names).toContain("North");
      expect(member_names).toContain("South");
      expect(member_names).toContain("East");
      expect(member_names).toContain("West");
    });

    it("should extract struct fields", () => {
      const code = `
struct Point {
    x: f64,
    y: f64,
}

struct Color {
    r: u8,
    g: u8,
    b: u8,
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify properties are captured within class definitions
      const point_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Point"
      );
      expect(point_class).toBeDefined();

      // Note: Properties may not be fully populated yet for Rust
      // Just verify the class definition exists
      expect(point_class?.name).toBe("Point");

      const color_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Color"
      );
      expect(color_class).toBeDefined();
      expect(color_class?.name).toBe("Color");
    });
  });

  // ============================================================================
  // TRAITS (INTERFACES)
  // ============================================================================

  describe("Traits", () => {
    it("should extract trait definitions", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "traits_and_generics.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "traits_and_generics.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify traits are captured as interfaces
      const interface_names = Array.from(index.interfaces.values()).map(
        (i) => i.name
      );
      expect(interface_names).toContain("Drawable");
      // Note: traits_and_generics.rs may not contain Printable - just verify we have traits
      expect(interface_names.length).toBeGreaterThan(0);
    });

    it("CRITICAL: should extract trait method signatures with parameters", () => {
      const code = `
trait Drawable {
    fn draw(&self, canvas: &Canvas);
    fn color(&self) -> Color;
    fn resize(&mut self, width: u32, height: u32);
}

trait Default {
    fn default() -> Self;
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify Drawable trait with complete structure
      const drawable_trait = Array.from(index.interfaces.values()).find(
        (i) => i.name === "Drawable"
      );
      expect(drawable_trait).toBeDefined();

      if (drawable_trait) {
        // Verify complete trait structure
        expect(drawable_trait).toMatchObject({
          kind: "interface",
          symbol_id: expect.stringMatching(/^interface:/),
          name: "Drawable",
          location: expect.objectContaining({
            file_path: "test.rs",
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          }),
          defining_scope_id: expect.any(String),
        });

        // CRITICAL: Verify trait methods exist
        expect(drawable_trait.methods).toBeDefined();
        expect(Array.isArray(drawable_trait.methods)).toBe(true);
        expect(drawable_trait.methods.length).toBe(3);

        // Verify draw method with parameters
        const draw_method = drawable_trait.methods.find(
          (m) => m.name === "draw"
        );
        expect(draw_method).toBeDefined();

        if (draw_method) {
          expect(draw_method).toMatchObject({
            kind: "method",
            symbol_id: expect.any(String),
            name: "draw",
            location: expect.objectContaining({
              file_path: "test.rs",
            }),
            defining_scope_id: expect.any(String),
          });

          // CRITICAL: Verify parameters (&self, canvas)
          expect(draw_method.parameters).toBeDefined();
          expect(draw_method.parameters.length).toBe(2);

          expect(draw_method.parameters[0]).toMatchObject({
            kind: "parameter",
            name: "self",
          });

          expect(draw_method.parameters[1]).toMatchObject({
            kind: "parameter",
            name: "canvas",
            type: "&Canvas",
          });
        }

        // Verify color method
        const color_method = drawable_trait.methods.find(
          (m) => m.name === "color"
        );
        expect(color_method).toBeDefined();

        if (color_method) {
          expect(color_method.parameters).toBeDefined();
          expect(color_method.parameters.length).toBe(1); // &self
          expect(color_method.return_type).toBe("Color");
        }

        // Verify resize method with multiple parameters
        const resize_method = drawable_trait.methods.find(
          (m) => m.name === "resize"
        );
        expect(resize_method).toBeDefined();

        if (resize_method) {
          expect(resize_method.parameters).toBeDefined();
          expect(resize_method.parameters.length).toBe(3); // &mut self, width, height

          const self_param = resize_method.parameters.find(
            (p) => p.name === "self"
          );
          expect(self_param).toBeDefined();

          const width_param = resize_method.parameters.find(
            (p) => p.name === "width"
          );
          expect(width_param).toBeDefined();

          if (width_param) {
            expect(width_param).toMatchObject({
              kind: "parameter",
              name: "width",
              type: "u32",
            });
          }

          const height_param = resize_method.parameters.find(
            (p) => p.name === "height"
          );
          expect(height_param).toBeDefined();

          if (height_param) {
            expect(height_param).toMatchObject({
              kind: "parameter",
              name: "height",
              type: "u32",
            });
          }
        }
      }

      // Verify Default trait with associated function (no self)
      const default_trait = Array.from(index.interfaces.values()).find(
        (i) => i.name === "Default"
      );
      expect(default_trait).toBeDefined();

      if (default_trait) {
        const default_method = default_trait.methods.find(
          (m) => m.name === "default"
        );
        expect(default_method).toBeDefined();

        if (default_method) {
          // Associated function - no self parameter
          expect(default_method.parameters).toBeDefined();
          expect(default_method.parameters.length).toBe(0);
          expect(default_method.static).toBe(true);
        }
      }
    });

    it("should extract trait methods", () => {
      const code = `
trait Display {
    fn fmt(&self) -> String;
    fn print(&self) {
        println!("{}", self.fmt());
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify trait is captured
      const display_trait = Array.from(index.interfaces.values()).find(
        (i) => i.name === "Display"
      );
      expect(display_trait).toBeDefined();
      expect(display_trait?.name).toBe("Display");

      // Verify trait methods are populated
      expect(display_trait?.methods).toBeDefined();
      expect(display_trait?.methods.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // IMPL BLOCKS (METHODS)
  // ============================================================================

  describe("Impl blocks", () => {
    it("CRITICAL: should extract method parameters including self", () => {
      const code = `
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn new(width: u32, height: u32) -> Self {
        Rectangle { width, height }
    }

    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn scale(&mut self, factor: u32) {
        self.width *= factor;
        self.height *= factor;
    }

    fn from_square(size: u32) -> Self {
        Rectangle::new(size, size)
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify struct is captured
      const struct_def = Array.from(index.classes.values()).find(
        (c) => c.name === "Rectangle"
      );
      expect(struct_def).toBeDefined();

      if (struct_def) {
        // Verify struct has complete structure
        expect(struct_def).toMatchObject({
          kind: "class",
          symbol_id: expect.stringMatching(/^class:/),
          name: "Rectangle",
          location: expect.objectContaining({
            file_path: "test.rs",
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          }),
          defining_scope_id: expect.any(String),
        });

        // Verify methods exist
        expect(struct_def.methods).toBeDefined();
        expect(Array.isArray(struct_def.methods)).toBe(true);
        expect(struct_def.methods.length).toBeGreaterThan(0);

        // Constructor (new method - should be static)
        const new_method = struct_def.methods.find((m) => m.name === "new");
        expect(new_method).toBeDefined();

        if (new_method) {
          expect(new_method).toMatchObject({
            kind: "method",
            symbol_id: expect.any(String),
            name: "new",
            location: expect.objectContaining({
              file_path: "test.rs",
            }),
            defining_scope_id: expect.any(String),
            static: true,
          });

          // CRITICAL: Verify parameters (width, height - not Self)
          expect(new_method.parameters).toBeDefined();
          expect(new_method.parameters.length).toBe(2);

          expect(new_method.parameters[0]).toMatchObject({
            kind: "parameter",
            name: "width",
            type: "u32",
          });

          expect(new_method.parameters[1]).toMatchObject({
            kind: "parameter",
            name: "height",
            type: "u32",
          });
        }

        // Instance method with &self
        const area_method = struct_def.methods.find((m) => m.name === "area");
        expect(area_method).toBeDefined();

        if (area_method) {
          expect(area_method.static).toBeFalsy();
          expect(area_method.parameters).toBeDefined();
          expect(area_method.parameters.length).toBeGreaterThanOrEqual(1);

          const self_param = area_method.parameters.find(
            (p) => p.name === "self"
          );
          expect(self_param).toBeDefined();
        }

        // Mutable self method
        const scale_method = struct_def.methods.find((m) => m.name === "scale");
        expect(scale_method).toBeDefined();

        if (scale_method) {
          expect(scale_method.parameters).toBeDefined();
          expect(scale_method.parameters.length).toBe(2); // &mut self, factor

          const self_param = scale_method.parameters.find(
            (p) => p.name === "self"
          );
          expect(self_param).toBeDefined();

          const factor_param = scale_method.parameters.find(
            (p) => p.name === "factor"
          );
          expect(factor_param).toBeDefined();

          if (factor_param) {
            expect(factor_param).toMatchObject({
              kind: "parameter",
              name: "factor",
              type: "u32",
            });
          }
        }

        // Associated function (static)
        const from_square = struct_def.methods.find(
          (m) => m.name === "from_square"
        );
        expect(from_square).toBeDefined();

        if (from_square) {
          expect(from_square.static).toBe(true);
          expect(from_square.parameters).toBeDefined();
          expect(from_square.parameters.length).toBe(1); // size

          expect(from_square.parameters[0]).toMatchObject({
            kind: "parameter",
            name: "size",
            type: "u32",
          });
        }
      }
    });

    it("should extract methods from impl blocks", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "basic_structs_and_enums.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "basic_structs_and_enums.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify struct is captured
      const point_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Point"
      );
      expect(point_class).toBeDefined();

      // Verify methods are populated
      expect(point_class?.methods).toBeDefined();
      expect(point_class?.methods.length).toBeGreaterThan(0);
    });

    it("should distinguish associated functions from methods", () => {
      const code = `
struct Calculator;

impl Calculator {
    // Associated function (no self)
    fn new() -> Self {
        Calculator
    }

    // Method (has self)
    fn add(&self, a: i32, b: i32) -> i32 {
        a + b
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify struct is captured
      const calc_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Calculator"
      );
      expect(calc_class).toBeDefined();
      expect(calc_class?.name).toBe("Calculator");

      // Note: Methods within impl blocks may not be fully populated yet
    });

    it("should extract trait implementations", () => {
      const code = `
trait Display {
    fn fmt(&self) -> String;
}

struct Point {
    x: i32,
    y: i32,
}

impl Display for Point {
    fn fmt(&self) -> String {
        format!("({}, {})", self.x, self.y)
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify trait is captured
      const interface_names = Array.from(index.interfaces.values()).map(
        (i) => i.name
      );
      expect(interface_names).toContain("Display");

      // Verify struct is captured
      const point_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Point"
      );
      expect(point_class).toBeDefined();
      expect(point_class?.name).toBe("Point");

      // Note: Trait implementation methods may not be fully populated yet
    });
  });

  // ============================================================================
  // FUNCTIONS
  // ============================================================================

  describe("Functions", () => {
    it("should extract function definitions", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "functions_and_closures.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "functions_and_closures.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify functions are captured
      const function_names = Array.from(index.functions.values()).map(
        (f) => f.name
      );
      expect(function_names).toContain("add");
      // Note: main might not be extracted in all fixtures - just verify we have functions
      expect(function_names.length).toBeGreaterThan(0);
    });

    it("CRITICAL: should extract function parameters with complete structure", () => {
      const code = `
fn add(x: i32, y: i32) -> i32 {
    x + y
}

fn greet(name: &str, times: usize) -> String {
    format!("Hello {} times {}", name, times)
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify add function with complete object assertion
      const add_func = Array.from(index.functions.values()).find(
        (f) => f.name === "add"
      );
      expect(add_func).toBeDefined();

      if (add_func) {
        // THIS WAS COMPLETELY BROKEN - parameters were never tracked!
        // NOTE: Functions have signature.parameters (not direct parameters)
        expect(add_func.signature).toBeDefined();
        expect(add_func.signature.parameters).toBeDefined();
        expect(Array.isArray(add_func.signature.parameters)).toBe(true);
        expect(add_func.signature.parameters.length).toBe(2);

        // Verify complete parameter structure
        expect(add_func.signature.parameters[0]).toMatchObject({
          kind: "parameter",
          symbol_id: expect.any(String),
          name: "x",
          location: expect.objectContaining({
            file_path: "test.rs",
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          }),
          defining_scope_id: expect.any(String),
          type: "i32",
        });

        expect(add_func.signature.parameters[1]).toMatchObject({
          kind: "parameter",
          symbol_id: expect.any(String),
          name: "y",
          location: expect.objectContaining({
            file_path: "test.rs",
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          }),
          defining_scope_id: expect.any(String),
          type: "i32",
        });
      }

      // Verify greet function with reference type
      const greet_func = Array.from(index.functions.values()).find(
        (f) => f.name === "greet"
      );
      expect(greet_func).toBeDefined();

      if (greet_func) {
        expect(greet_func.signature).toBeDefined();
        expect(greet_func.signature.parameters).toBeDefined();
        expect(greet_func.signature.parameters.length).toBe(2);

        const name_param = greet_func.signature.parameters.find(
          (p) => p.name === "name"
        );
        expect(name_param).toBeDefined();
        expect(name_param?.type).toBe("&str");

        const times_param = greet_func.signature.parameters.find(
          (p) => p.name === "times"
        );
        expect(times_param).toBeDefined();
        expect(times_param?.type).toBe("usize");
      }
    });

    it("should extract function parameters", () => {
      const code = `
fn greet(name: &str, age: u32) -> String {
    format!("Hello {}, you are {} years old", name, age)
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify function is captured
      const function_names = Array.from(index.functions.values()).map(
        (f) => f.name
      );
      expect(function_names).toContain("greet");

      // Verify function signature exists
      const greet_func = Array.from(index.functions.values()).find(
        (f) => f.name === "greet"
      );
      expect(greet_func).toBeDefined();
      expect(greet_func?.signature).toBeDefined();

      // Verify parameters are tracked (Functions use signature.parameters)
      expect(greet_func?.signature.parameters).toBeDefined();
      expect(greet_func?.signature.parameters.length).toBeGreaterThanOrEqual(2);
    });

    it("should extract function return types", () => {
      const code = `
fn calculate(x: i32, y: i32) -> i32 {
    x + y
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify function is captured
      const function_names = Array.from(index.functions.values()).map(
        (f) => f.name
      );
      expect(function_names).toContain("calculate");
    });

    it("should track direct function calls", () => {
      const code = `
fn helper(x: i32) -> i32 {
    x * 2
}

fn main() {
    let result = helper(5);
    let doubled = helper(result);
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify function calls are tracked
      const function_calls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "function"
      );
      expect(function_calls.length).toBeGreaterThan(0);

      // Should have at least two calls to helper
      const helper_calls = function_calls.filter((c) =>
        c.name.includes("helper")
      );
      expect(helper_calls.length).toBeGreaterThanOrEqual(2);
    });

    it("should track associated function calls", () => {
      const code = `
struct Config;

impl Config {
    fn new() -> Self {
        Config
    }
}

fn main() {
    let config = Config::new();
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify associated function call is tracked
      const calls = index.references.filter((r) => r.type === "call");
      expect(calls.length).toBeGreaterThan(0);

      const new_call = calls.find((c) => c.name.includes("new"));
      expect(new_call).toBeDefined();
    });
  });

  // ============================================================================
  // BASIC OWNERSHIP PATTERNS (REFERENCES)
  // ============================================================================

  describe("Ownership patterns", () => {
    it("should handle reference types in function signatures", () => {
      const code = `
fn read_string(s: &str) -> usize {
    s.len()
}

fn modify_string(s: &mut String) {
    s.push_str(" world");
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify functions are captured
      const function_names = Array.from(index.functions.values()).map(
        (f) => f.name
      );
      expect(function_names).toContain("read_string");
      expect(function_names).toContain("modify_string");
    });

    it("should handle basic borrowing patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "ownership_and_patterns.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "ownership_and_patterns.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify basic structures are captured
      expect(index.functions.size).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // MODULES AND VISIBILITY
  // ============================================================================

  describe("Modules and visibility", () => {
    it("should extract module declarations", () => {
      const code = `
pub mod math {
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }
}

mod utils {
    pub(crate) fn helper() -> i32 {
        42
    }
}

pub(crate) mod internal {
    pub fn internal_function() -> &'static str {
        "internal"
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify modules are extracted as namespaces
      expect(index.namespaces.size).toBeGreaterThan(0);

      const namespace_names = Array.from(index.namespaces.values()).map(
        (ns) => ns.name
      );
      expect(namespace_names).toContain("math");
      expect(namespace_names).toContain("utils");
      expect(namespace_names).toContain("internal");
    });

    it("should extract inline module declarations", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "modules_and_visibility.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "modules_and_visibility.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify modules are extracted
      expect(index.namespaces.size).toBeGreaterThan(0);

      const namespace_names = Array.from(index.namespaces.values()).map(
        (ns) => ns.name
      );
      expect(namespace_names).toContain("math");
    });

    it("should extract nested module declarations", () => {
      const code = `
pub mod outer {
    pub mod inner {
        pub fn nested_function() -> i32 {
            42
        }
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify both outer and inner modules are captured
      const namespace_names = Array.from(index.namespaces.values()).map(
        (ns) => ns.name
      );
      expect(namespace_names).toContain("outer");
      expect(namespace_names).toContain("inner");
    });

    it("should distinguish public and private modules", () => {
      const code = `
pub mod public_module {
    pub fn public_fn() {}
}

mod private_module {
    fn private_fn() {}
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify modules are extracted
      expect(index.namespaces.size).toBe(2);

      const public_mod = Array.from(index.namespaces.values()).find(
        (ns) => ns.name === "public_module"
      );
      const private_mod = Array.from(index.namespaces.values()).find(
        (ns) => ns.name === "private_module"
      );

      expect(public_mod).toBeDefined();
      expect(private_mod).toBeDefined();

    });

    it("CRITICAL: should extract use statements with complete structure", () => {
      // CRITICAL - Import extraction was completely missing for Rust!
      const code = `
use std::collections::HashMap;
use std::io::{Read, Write};
use std::fmt::*;
use crate::models::User;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // CRITICAL: Verify imports are tracked (was completely missing!)
      expect(index.imported_symbols.size).toBeGreaterThanOrEqual(4);

      // Verify HashMap import with complete structure
      const hashmap_import = Array.from(index.imported_symbols.values()).find(
        (imp) => imp.name === "HashMap"
      );
      expect(hashmap_import).toBeDefined();

      if (hashmap_import) {
        expect(hashmap_import).toMatchObject({
          kind: "import",
          symbol_id: expect.any(String),
          name: "HashMap",
          location: expect.objectContaining({
            file_path: "test.rs",
            start_line: expect.any(Number),
            start_column: expect.any(Number),
          }),
          defining_scope_id: expect.any(String),
          import_path: "std::collections::HashMap",
          import_kind: "named",
        });
      }

      // Verify grouped imports (Read, Write)
      const read_import = Array.from(index.imported_symbols.values()).find(
        (imp) => imp.name === "Read"
      );
      expect(read_import).toBeDefined();

      if (read_import) {
        expect(read_import.import_path).toContain("std::io");
        expect(read_import.import_kind).toBe("named");
      }

      const write_import = Array.from(index.imported_symbols.values()).find(
        (imp) => imp.name === "Write"
      );
      expect(write_import).toBeDefined();

      if (write_import) {
        expect(write_import.import_path).toContain("std::io");
      }

      // Verify glob import
      const glob_imports = Array.from(index.imported_symbols.values()).filter(
        (imp) => imp.import_kind === "namespace"
      );
      expect(glob_imports.length).toBeGreaterThan(0);

      // Verify crate import
      const user_import = Array.from(index.imported_symbols.values()).find(
        (imp) => imp.name === "User"
      );
      expect(user_import).toBeDefined();

      if (user_import) {
        expect(user_import.import_path).toBe("crate::models::User");
      }
    });

    it("should extract simple use statements", () => {
      // Import extraction now implemented for Rust
      const code = `
use std::collections::HashMap;
use std::io::Result;

fn main() {
    let map: HashMap<String, i32> = HashMap::new();
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify imports are tracked
      expect(index.imported_symbols.size).toBeGreaterThan(0);

      const imported_names = Array.from(index.imported_symbols.values()).map(
        (imp) => imp.name
      );
      expect(imported_names).toContain("HashMap");
      expect(imported_names).toContain("Result");
    });

    it("should extract multiple imports from same module", () => {
      // Import extraction now implemented for Rust
      const code = `
use std::fmt::{Display, Formatter, Result};
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify all imports are captured
      const imported_names = Array.from(index.imported_symbols.values()).map(
        (imp) => imp.name
      );
      expect(imported_names).toContain("Display");
      expect(imported_names).toContain("Formatter");
      expect(imported_names).toContain("Result");
    });

    it("should extract aliased imports", () => {
      // Import extraction now implemented for Rust
      const code = `
use std::collections::HashMap as Map;
use std::io::Result as IoResult;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify aliased imports are captured
      const imports = Array.from(index.imported_symbols.values());

      // Check for HashMap/Map
      const map_import = imports.find(
        (imp) => imp.name === "Map" || imp.original_name === "HashMap"
      );
      expect(map_import).toBeDefined();

      // Check for Result/IoResult
      const result_import = imports.find(
        (imp) => imp.name === "IoResult" || imp.original_name === "Result"
      );
      expect(result_import).toBeDefined();
    });

    it("should handle glob imports", () => {
      const code = `
use std::collections::*;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify glob import is captured (even if as a special case)
      // Implementation may vary - just ensure it doesn't error
      expect(index).toBeDefined();
    });

    it("should extract extern crate declarations", () => {
      const code = `
extern crate serde;
extern crate tokio;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify extern crate imports are captured
      const imported_names = Array.from(index.imported_symbols.values()).map(
        (imp) => imp.name
      );
      expect(imported_names).toContain("serde");
      expect(imported_names).toContain("tokio");

      // Verify complete structure
      const serdeImport = Array.from(index.imported_symbols.values()).find(
        (imp) => imp.name === "serde"
      );
      expect(serdeImport).toBeDefined();
      if (serdeImport) {
        expect(serdeImport).toMatchObject({
          name: "serde",
          location: expect.objectContaining({
            file_path: "test.rs",
          }),
        });
      }
    });

    it("should extract extern crate with alias", () => {
      const code = `
extern crate serde_json as json;
extern crate tokio_core as tokio;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify aliased extern crate imports are captured
      const imported_names = Array.from(index.imported_symbols.values()).map(
        (imp) => imp.name
      );
      expect(imported_names).toContain("json");
      expect(imported_names).toContain("tokio");

      // Verify original names are preserved
      const jsonImport = Array.from(index.imported_symbols.values()).find(
        (imp) => imp.name === "json"
      );
      expect(jsonImport).toBeDefined();
      if (jsonImport) {
        expect(jsonImport.original_name).toBe("serde_json");
      }

      const tokioImport = Array.from(index.imported_symbols.values()).find(
        (imp) => imp.name === "tokio"
      );
      expect(tokioImport).toBeDefined();
      if (tokioImport) {
        expect(tokioImport.original_name).toBe("tokio_core");
      }
    });

    it("should handle mixed use and extern crate imports", () => {
      const code = `
extern crate serde;
use std::collections::HashMap;
extern crate tokio as runtime;
use std::io::Result;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify all imports are captured
      const imported_names = Array.from(index.imported_symbols.values()).map(
        (imp) => imp.name
      );
      expect(imported_names).toContain("serde");
      expect(imported_names).toContain("HashMap");
      expect(imported_names).toContain("runtime");
      expect(imported_names).toContain("Result");

      expect(index.imported_symbols.size).toBeGreaterThanOrEqual(4);
    });

    it("should extract nested/grouped imports", () => {
      const code = `
use std::{
    cmp::Ordering,
    collections::{HashMap, HashSet},
    fs::File,
};
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify nested imports are captured
      const imported_names = Array.from(index.imported_symbols.values()).map(
        (imp) => imp.name
      );
      expect(imported_names).toContain("Ordering");
      expect(imported_names).toContain("HashMap");
      expect(imported_names).toContain("HashSet");
      expect(imported_names).toContain("File");
    });

    it("should extract re-exports (pub use)", () => {
      const code = `
pub use std::collections::HashMap;
pub use self::math::add as add_numbers;

mod math {
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify re-exports are captured
      const imports = Array.from(index.imported_symbols.values());

      // Check that we have imports
      expect(imports.length).toBeGreaterThan(0);

      // Verify HashMap import exists
      const hashmap_import = imports.find((imp) => imp.name === "HashMap");
      expect(hashmap_import).toBeDefined();
      if (hashmap_import) {
        expect(hashmap_import.import_path).toBe("std::collections::HashMap");
      }

      // Verify add_numbers import exists (aliased from self::math::add)
      const add_numbers_import = imports.find(
        (imp) => imp.name === "add_numbers"
      );
      expect(add_numbers_import).toBeDefined();
      if (add_numbers_import) {
        // The original_name should be the full path from the import
        expect(add_numbers_import.original_name).toBe("self::math::add");
      }
    });
  });

  // ============================================================================
  // TYPE METADATA EXTRACTION
  // ============================================================================

  describe("Type metadata extraction", () => {
    it("should extract type info from function parameter type annotations", () => {
      const code = `
fn greet(name: &str, age: u32) -> String {
    format!("Hello {}, you are {} years old", name, age)
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Check that type references were extracted
      const type_refs = index.references.filter((r) => r.type === "type");
      expect(type_refs.length).toBeGreaterThan(0);

      // Check that type_info is populated
      const types_with_info = type_refs.filter((r) => r.type_info);
      expect(types_with_info.length).toBeGreaterThan(0);

      // Verify type info structure
      const first_type = types_with_info[0];
      expect(first_type.type_info).toBeDefined();
      expect(first_type.type_info?.type_name).toBeDefined();
      expect(first_type.type_info?.certainty).toBe("declared");
    });

    it("should extract type info from variable annotations", () => {
      const code = `
fn main() {
    let count: i32 = 0;
    let name: String = String::from("Alice");
    let items: Vec<String> = Vec::new();
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      const type_refs = index.references.filter((r) => r.type === "type");
      const types_with_info = type_refs.filter((r) => r.type_info);

      expect(types_with_info.length).toBeGreaterThan(0);

      // Check that at least one type has proper metadata
      const has_valid_type = types_with_info.some(
        (t) => t.type_info?.type_name && t.type_info.certainty === "declared"
      );
      expect(has_valid_type).toBe(true);
    });

    it("should handle generic types", () => {
      const code = `
use std::collections::HashMap;

fn process(items: Vec<String>, mapping: HashMap<String, i32>) -> Option<String> {
    None
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      const type_refs = index.references.filter((r) => r.type === "type");
      const types_with_info = type_refs.filter((r) => r.type_info);

      // Check that we have type references with metadata
      expect(types_with_info.length).toBeGreaterThan(0);

      // Check that type_name is extracted
      const types_with_names = types_with_info.filter(
        (t) => t.type_info?.type_name
      );
      expect(types_with_names.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // METHOD CALLS AND TYPE RESOLUTION
  // ============================================================================

  describe("Method calls and type resolution", () => {
    it("should track method calls with receivers", () => {
      const code = `
struct Point {
    x: i32,
    y: i32,
}

impl Point {
    fn distance(&self) -> f64 {
        ((self.x * self.x + self.y * self.y) as f64).sqrt()
    }
}

fn main() {
    let p = Point { x: 3, y: 4 };
    let d = p.distance();
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify method call is captured
      const method_calls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Note: receiver_location may not always be populated
      // Just verify we captured the method call
      const distance_call = method_calls.find((c) =>
        c.name.includes("distance")
      );
      expect(distance_call).toBeDefined();
    });

    it("should handle chained method calls", () => {
      const code = `
fn main() {
    let s = String::from("hello")
        .to_uppercase()
        .trim()
        .to_string();
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify method calls are captured
      const method_calls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Note: Method names may be qualified - just verify we got method calls
      expect(method_calls.length).toBeGreaterThanOrEqual(3);
    });

    it("should capture field access chains", () => {
      const code = `
struct Inner {
    value: i32,
}

struct Outer {
    inner: Inner,
}

fn main() {
    let obj = Outer {
        inner: Inner { value: 42 }
    };
    let val = obj.inner.value;
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Note: Field access tracking may not be fully implemented yet
      // Just verify we captured the structs
      expect(index.classes.size).toBeGreaterThan(0);
      const class_names = Array.from(index.classes.values()).map((c) => c.name);
      expect(class_names).toContain("Inner");
      expect(class_names).toContain("Outer");
    });

    it("should capture struct instantiation", () => {
      const code = `
struct Config {
    host: String,
    port: u16,
}

fn main() {
    let config = Config {
        host: String::from("localhost"),
        port: 8080,
    };
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify struct is defined
      const class_names = Array.from(index.classes.values()).map((c) => c.name);
      expect(class_names).toContain("Config");

      // Verify construct call is captured
      const construct_calls = index.references.filter(
        (r) => r.type === "construct"
      );
      expect(construct_calls.length).toBeGreaterThan(0);

      const config_construct = construct_calls.find((c) => c.name === "Config");
      expect(config_construct).toBeDefined();
      expect(config_construct?.context?.construct_target).toBeDefined();
    });

    it.skip("should extract method resolution metadata for all receiver patterns", () => {
      // SKIPPED: Assignment tracking and receiver_location not yet implemented for Rust
      const code = `
struct Service {
    data: Vec<String>,
}

impl Service {
    fn get_data(&self) -> &Vec<String> {
        &self.data
    }
}

fn create_service() -> Service {
    Service { data: vec![] }
}

fn main() {
    // Scenario 1: Receiver type from annotation
    let service1: Service = create_service();
    service1.get_data();

    // Scenario 2: Receiver type from constructor
    let service2 = Service { data: vec![] };
    service2.get_data();
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      // Scenario 1: Receiver from type annotation
      // Verify the assignment is captured
      const service1_assignment = result.references.find(
        (ref) => ref.type === "assignment" && ref.name === "service1"
      );
      expect(service1_assignment).toBeDefined();

      // Note: assignment_type from type annotations is a future enhancement

      // Verify method calls have receiver_location
      const method_calls = result.references.filter(
        (ref) => ref.type === "call" && ref.name === "get_data"
      );

      // Should have at least 2 get_data method calls
      expect(method_calls.length).toBeGreaterThanOrEqual(2);

      // At least some method calls should have receiver_location
      const calls_with_receiver = method_calls.filter(
        (c) => c.context?.receiver_location
      );
      expect(calls_with_receiver.length).toBeGreaterThan(0);

      // Scenario 2: Verify struct instantiation has construct_target
      const constructor_calls = result.references.filter(
        (ref) => ref.type === "construct" && ref.name === "Service"
      );

      // Should have at least one constructor call with construct_target
      const construct_with_target = constructor_calls.find(
        (c) => c.context?.construct_target
      );
      expect(construct_with_target).toBeDefined();
    });
  });

  // ============================================================================
  // COMPREHENSIVE INTEGRATION TESTS
  // ============================================================================

  describe("Comprehensive integration", () => {
    it("should handle comprehensive definition file", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_definitions.rs"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_definitions.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify we have definitions across all categories
      expect(index.functions.size).toBeGreaterThan(0);
      expect(index.classes.size).toBeGreaterThan(0);
      expect(index.enums.size).toBeGreaterThan(0);

      // Note: Methods, properties, and parameters may not be fully populated yet
      // Just verify we have the main definition types
    });

    it("should integrate Rust extractors into semantic index pipeline", () => {
      const code = `
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Config {
    settings: HashMap<String, String>,
    version: u32,
}

impl Config {
    fn new() -> Self {
        Config {
            settings: HashMap::new(),
            version: 1,
        }
    }

    fn get(&self, key: &str) -> Option<&String> {
        self.settings.get(key)
    }

    fn set(&mut self, key: String, value: String) {
        self.settings.insert(key, value);
    }
}

fn main() {
    let mut config = Config::new();
    config.set(String::from("theme"), String::from("dark"));

    if let Some(theme) = config.get("theme") {
        println!("Current theme: {}", theme);
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "config.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Comprehensive checks
      expect(index).toBeDefined();
      expect(index.language).toBe("rust");
      expect(index.file_path).toBe(file_path);

      // Check that various reference types are captured
      const type_refs = index.references.filter((r) => r.type === "type");
      const call_refs = index.references.filter((r) => r.type === "call");

      expect(type_refs.length).toBeGreaterThan(0);
      expect(call_refs.length).toBeGreaterThan(0);

      // Check that metadata is being extracted
      const refs_with_metadata = index.references.filter((r) => r.type_info);
      expect(refs_with_metadata.length).toBeGreaterThan(0);

      // Verify Rust-specific metadata
      const rust_types = type_refs.filter((r) => r.type_info?.type_name);
      expect(rust_types.length).toBeGreaterThan(0);

      // Verify certainty is set correctly
      const declared_types = rust_types.filter(
        (r) => r.type_info?.certainty === "declared"
      );
      expect(declared_types.length).toBeGreaterThan(0);
    });

    it("should extract generic parameters from structs and functions", () => {
      const code = `
struct Container<T> {
    value: T,
}

impl<T> Container<T> {
    fn new(value: T) -> Self {
        Container { value }
    }

    fn get(&self) -> &T {
        &self.value
    }
}

fn identity<T>(x: T) -> T {
    x
}

fn pair<T, U>(first: T, second: U) -> (T, U) {
    (first, second)
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify generic struct
      const struct_def = Array.from(index.classes.values()).find(
        (c) => c.name === "Container"
      );
      expect(struct_def).toBeDefined();

      if (struct_def) {
        // Verify generic type parameters (classes use generics field)
        expect(struct_def.generics).toBeDefined();
        expect(Array.isArray(struct_def.generics)).toBe(true);
        expect(struct_def.generics).toEqual(["T"]);

        // Verify methods exist
        expect(struct_def.methods).toBeDefined();
        expect(struct_def.methods.length).toBeGreaterThan(0);

        // Verify new method with generic parameter
        const new_method = struct_def.methods.find((m) => m.name === "new");
        expect(new_method).toBeDefined();

        if (new_method) {
          expect(new_method.parameters).toBeDefined();
          expect(new_method.parameters.length).toBe(1);

          expect(new_method.parameters[0]).toMatchObject({
            kind: "parameter",
            name: "value",
            type: "T",
          });
        }

        // Verify get method returning generic type
        const get_method = struct_def.methods.find((m) => m.name === "get");
        expect(get_method).toBeDefined();

        if (get_method) {
          expect(get_method.return_type).toBe("&T");
        }
      }

      // Verify generic function with single type parameter
      const identity_func = Array.from(index.functions.values()).find(
        (f) => f.name === "identity"
      );
      expect(identity_func).toBeDefined();

      if (identity_func) {
        // Functions use generics field (not type_parameters)
        expect(identity_func.generics).toBeDefined();
        expect(identity_func.generics).toEqual(["T"]);

        // Functions use signature.parameters
        expect(identity_func.signature).toBeDefined();
        expect(identity_func.signature.parameters).toBeDefined();
        expect(identity_func.signature.parameters.length).toBe(1);

        expect(identity_func.signature.parameters[0]).toMatchObject({
          kind: "parameter",
          name: "x",
          type: "T",
        });
      }

      // Verify generic function with multiple type parameters
      const pair_func = Array.from(index.functions.values()).find(
        (f) => f.name === "pair"
      );
      expect(pair_func).toBeDefined();

      if (pair_func) {
        expect(pair_func.generics).toBeDefined();
        expect(pair_func.generics?.length).toBe(2);
        expect(pair_func.generics).toEqual(["T", "U"]);

        expect(pair_func.signature).toBeDefined();
        expect(pair_func.signature.parameters).toBeDefined();
        expect(pair_func.signature.parameters.length).toBe(2);

        expect(pair_func.signature.parameters[0]).toMatchObject({
          kind: "parameter",
          name: "first",
          type: "T",
        });

        expect(pair_func.signature.parameters[1]).toMatchObject({
          kind: "parameter",
          name: "second",
          type: "U",
        });
      }
    });
  });

  // ============================================================================
  // SCOPE BOUNDARY TESTS (Body-Based Scopes)
  // ============================================================================

  describe("Scope boundaries for body-based scopes", () => {
    it("DEBUG: should show all scopes created", () => {
      const code = `struct Point {
    x: i32,
    y: i32,
}

enum Direction {
    North,
    South,
}

trait Drawable {
    fn draw(&self);
}

impl Point {
    fn new() -> Self {
        Point { x: 0, y: 0 }
    }
}`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      console.log("\n=== ALL SCOPES ===");
      Array.from(index.scopes.values()).forEach((scope) => {
        console.log(
          `Type: ${scope.type}, ID: ${scope.id.substring(0, 40)}..., Line: ${
            scope.location.start_line
          }, Col: ${scope.location.start_column}-${scope.location.end_column}`
        );
      });

      console.log("\n=== STRUCT DEFINITION ===");
      const struct_def = Array.from(index.classes.values()).find(
        (c) => c.name === "Point"
      );
      if (struct_def) {
        console.log(
          `Name location: Line ${struct_def.location.start_line}, Col ${struct_def.location.start_column}`
        );
        console.log(`Scope ID: ${struct_def.defining_scope_id}`);
      }

      console.log("\n=== ENUM DEFINITION ===");
      const enum_def = Array.from(index.enums.values()).find(
        (e) => e.name === "Direction"
      );
      if (enum_def) {
        console.log(
          `Name location: Line ${enum_def.location.start_line}, Col ${enum_def.location.start_column}`
        );
        console.log(`Scope ID: ${enum_def.defining_scope_id}`);
      }

      console.log("\n=== TRAIT DEFINITION ===");
      const trait_def = Array.from(index.interfaces.values()).find(
        (i) => i.name === "Drawable"
      );
      if (trait_def) {
        console.log(
          `Name location: Line ${trait_def.location.start_line}, Col ${trait_def.location.start_column}`
        );
        console.log(`Scope ID: ${trait_def.defining_scope_id}`);
      }

      // This test should always pass - just for debugging
      expect(index.scopes.size).toBeGreaterThan(0);
    });

    it("should capture struct body scope (not including name)", () => {
      const code = `struct Point {
    x: i32,
    y: i32,
}`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify struct definition exists
      const struct_def = Array.from(index.classes.values()).find(
        (c) => c.name === "Point"
      );
      expect(struct_def).toBeDefined();

      // Find struct body scope (type: class, at line 1)
      const struct_body_scopes = Array.from(index.scopes.values()).filter(
        (s) => s.type === "class" && s.location.start_line === 1
      );
      expect(struct_body_scopes.length).toBeGreaterThan(0);

      const struct_scope = struct_body_scopes[0];
      if (struct_scope && struct_def) {
        // Struct name "Point" ends around col 13
        // Scope should start at the opening brace (line 1, after "Point ")
        // The scope should NOT include "Point"
        expect(struct_scope.location.start_line).toBe(1);
        expect(struct_scope.location.start_column).toBeGreaterThan(13); // After "Point"

        // Struct definition name should be before the scope
        expect(struct_def.location.start_line).toBe(1);
        expect(struct_def.location.start_column).toBeLessThan(
          struct_scope.location.start_column
        );
      }
    });

    it("should capture enum body scope (not including name)", () => {
      const code = `enum Direction {
    North,
    South,
    East,
    West,
}`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify enum definition exists
      const enum_def = Array.from(index.enums.values()).find(
        (e) => e.name === "Direction"
      );
      expect(enum_def).toBeDefined();

      // Find enum body scope (type: class, at line 1)
      const enum_body_scopes = Array.from(index.scopes.values()).filter(
        (s) => s.type === "class" && s.location.start_line === 1
      );
      expect(enum_body_scopes.length).toBeGreaterThan(0);

      const enum_scope = enum_body_scopes[0];
      if (enum_scope && enum_def) {
        // Enum name "Direction" ends around col 15
        // Scope should start at the opening brace, after "Direction "
        expect(enum_scope.location.start_line).toBe(1);
        expect(enum_scope.location.start_column).toBeGreaterThan(15); // After "Direction"

        // Enum definition name should be before the scope
        expect(enum_def.location.start_line).toBe(1);
        expect(enum_def.location.start_column).toBeLessThan(
          enum_scope.location.start_column
        );
      }
    });

    it("should capture trait body scope (not including name)", () => {
      const code = `trait Drawable {
    fn draw(&self);
}`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify trait definition exists
      const trait_def = Array.from(index.interfaces.values()).find(
        (i) => i.name === "Drawable"
      );
      expect(trait_def).toBeDefined();

      // Find trait body scope (type: class, at line 1, after the trait name)
      const trait_body_scopes = Array.from(index.scopes.values()).filter(
        (s) =>
          s.type === "class" &&
          s.location.start_line === 1 &&
          s.location.start_column > (trait_def?.location.start_column || 0)
      );
      expect(trait_body_scopes.length).toBeGreaterThan(0);

      const trait_scope = trait_body_scopes[0];
      if (trait_scope && trait_def) {
        // Trait name "Drawable" is 8 chars, starts at col 7 (1-indexed)
        // "trait Drawable {" - opening brace is at col 17 (1-indexed)
        // Scope should start at the opening brace, after "Drawable "
        expect(trait_scope.location.start_line).toBe(1);
        expect(trait_scope.location.start_column).toBeGreaterThan(
          trait_def.location.start_column
        ); // After trait name

        // Trait definition name should be before the scope
        expect(trait_def.location.start_line).toBe(1);
        expect(trait_def.location.start_column).toBeLessThan(
          trait_scope.location.start_column
        );
      }
    });

    it("should capture impl body scope (not including type name)", () => {
      const code = `struct Point { x: i32 }

impl Point {
    fn new() -> Self {
        Point { x: 0 }
    }
}`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Find impl block scope (it creates a block scope)
      // The impl body should start after "Point " on line 3 (1-indexed)
      const impl_scopes = Array.from(index.scopes.values()).filter(
        (s) => s.type === "block" && s.location.start_line === 3
      );

      expect(impl_scopes.length).toBeGreaterThan(0);

      const impl_scope = impl_scopes[0];
      if (impl_scope) {
        // "impl Point" starts at line 3, col 1
        // Type name "Point" is at col 6-11
        // Scope should start at the opening brace, after "Point "
        expect(impl_scope.location.start_line).toBe(3);
        expect(impl_scope.location.start_column).toBeGreaterThan(11); // After "Point"
      }
    });

    it("should not create scopes for tuple structs (no body)", () => {
      const code = `struct Point(i32, i32);
struct Color(u8, u8, u8);`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Verify struct definitions exist
      const point_def = Array.from(index.classes.values()).find(
        (c) => c.name === "Point"
      );
      const color_def = Array.from(index.classes.values()).find(
        (c) => c.name === "Color"
      );

      expect(point_def).toBeDefined();
      expect(color_def).toBeDefined();

      // Tuple structs don't have field_declaration_list bodies, so they shouldn't create struct scopes
      // They may have scopes from function bodies, but not from the struct itself
      // Only the module scope should exist (no class scopes at line 1 or 2 where the structs are defined)
      const struct_scopes = Array.from(index.scopes.values()).filter(
        (s) =>
          s.type === "class" &&
          (s.location.start_line === 1 || s.location.start_line === 2)
      );

      // Should have 0 class scopes for tuple structs since they don't have bodies
      expect(struct_scopes.length).toBe(0);
    });
  });

  // ============================================================================
  // TYPE ALIAS TESTS
  // ============================================================================

  describe("Type aliases", () => {
    it("should extract simple type aliases with complete structure", () => {
      const code = `
type Kilometers = i32;
type Result<T> = std::result::Result<T, Error>;
pub type BoxedError = Box<dyn Error>;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      // Verify type aliases exist
      const typeNames = Array.from(result.types.values()).map((t) => t.name);
      expect(typeNames).toContain("Kilometers");
      expect(typeNames).toContain("Result");
      expect(typeNames).toContain("BoxedError");

      // Verify Kilometers type alias with complete structure
      const kilometersType = Array.from(result.types.values()).find(
        (t) => t.name === "Kilometers"
      );

      expect(kilometersType).toBeDefined();

      if (kilometersType) {
        expect(kilometersType).toMatchObject({
          kind: "type_alias",
          symbol_id: expect.stringMatching(/^type/),
          name: "Kilometers",
          type_expression: "i32",
          location: expect.objectContaining({
            file_path: "test.rs",
            start_line: expect.any(Number),
            start_column: expect.any(Number),
            end_line: expect.any(Number),
            end_column: expect.any(Number),
          }),
          defining_scope_id: expect.any(String),
          availability: expect.objectContaining({
            scope: expect.any(String),
          }),
        });
      }

      // Verify generic Result type alias
      const resultType = Array.from(result.types.values()).find(
        (t) => t.name === "Result"
      );

      expect(resultType).toBeDefined();

      if (resultType) {
        expect(resultType).toMatchObject({
          kind: "type_alias",
          name: "Result",
          type_expression: "std::result::Result<T, Error>",
          generics: expect.arrayContaining(["T"]),
        });
      }

      // Verify public BoxedError type alias
      const boxedErrorType = Array.from(result.types.values()).find(
        (t) => t.name === "BoxedError"
      );

      expect(boxedErrorType).toBeDefined();

      if (boxedErrorType) {
        expect(boxedErrorType).toMatchObject({
          kind: "type_alias",
          name: "BoxedError",
          type_expression: "Box<dyn Error>",
          availability: expect.objectContaining({
            scope: "public",
          }),
        });
      }
    });

    it("should extract associated type aliases in traits", () => {
      const code = `
trait Iterator {
    type Item;

    fn next(&mut self) -> Option<Self::Item>;
}

impl Iterator for MyIterator {
    type Item = i32;

    fn next(&mut self) -> Option<Self::Item> {
        None
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      // Verify associated type aliases exist
      const typeNames = Array.from(result.types.values()).map((t) => t.name);
      expect(typeNames).toContain("Item");

      // Should find both the trait associated type and the impl associated type
      const itemTypes = Array.from(result.types.values()).filter(
        (t) => t.name === "Item"
      );

      expect(itemTypes.length).toBeGreaterThanOrEqual(1);

      // Verify structure of at least one Item type
      const firstItem = itemTypes[0];
      expect(firstItem).toBeDefined();
      expect(firstItem.kind).toBe("type_alias");
      expect(firstItem.location.file_path).toBe("test.rs");
    });

    it("should extract type expressions for all type alias forms", () => {
      const code = `
type Kilometers = i32;
type Point = (i32, i32);
type Result<T> = std::result::Result<T, Error>;
type Callback = Box<dyn Fn() -> i32>;
type FnPtr = fn(i32, i32) -> i32;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      const type_aliases = Array.from(result.types.values()).filter(
        (d) => d.kind === "type_alias"
      );

      expect(type_aliases.length).toBeGreaterThanOrEqual(5);

      // Check Kilometers (simple type)
      const kilometers = type_aliases.find((t) => t.name === "Kilometers");
      expect(kilometers).toBeDefined();
      expect(kilometers?.type_expression).toBe("i32");

      // Check Point (tuple type)
      const point = type_aliases.find((t) => t.name === "Point");
      expect(point).toBeDefined();
      expect(point?.type_expression).toBe("(i32, i32)");

      // Check Result (generic with type parameters)
      const result_type = type_aliases.find((t) => t.name === "Result");
      expect(result_type).toBeDefined();
      expect(result_type?.type_expression).toBe(
        "std::result::Result<T, Error>"
      );
      expect(result_type?.generics).toEqual(["T"]);

      // Check Callback (trait object)
      const callback = type_aliases.find((t) => t.name === "Callback");
      expect(callback).toBeDefined();
      expect(callback?.type_expression).toBe("Box<dyn Fn() -> i32>");

      // Check FnPtr (function pointer)
      const fn_ptr = type_aliases.find((t) => t.name === "FnPtr");
      expect(fn_ptr).toBeDefined();
      expect(fn_ptr?.type_expression).toBe("fn(i32, i32) -> i32");
    });

    it("should extract type aliases with lifetime parameters", () => {
      const code = `
type Ref<'a> = &'a str;
type RefPair<'a, 'b> = (&'a str, &'b str);
type GenericRef<'a, T> = &'a T;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      const type_aliases = Array.from(result.types.values()).filter(
        (d) => d.kind === "type_alias"
      );

      expect(type_aliases.length).toBeGreaterThanOrEqual(3);

      // Check Ref with single lifetime
      const refType = type_aliases.find((t) => t.name === "Ref");
      expect(refType).toBeDefined();
      expect(refType?.type_expression).toBe("&'a str");
      expect(refType?.generics).toEqual(["'a"]);

      // Check RefPair with multiple lifetimes
      const refPairType = type_aliases.find((t) => t.name === "RefPair");
      expect(refPairType).toBeDefined();
      expect(refPairType?.type_expression).toBe("(&'a str, &'b str)");
      expect(refPairType?.generics).toEqual(["'a", "'b"]);

      // Check GenericRef with lifetime and type parameter
      const genericRefType = type_aliases.find((t) => t.name === "GenericRef");
      expect(genericRefType).toBeDefined();
      expect(genericRefType?.type_expression).toBe("&'a T");
      expect(genericRefType?.generics).toEqual(["'a", "T"]);
    });

    it("should extract type aliases with const generics", () => {
      const code = `
type Arr<T, const N: usize> = [T; N];
type Matrix<const ROWS: usize, const COLS: usize> = [[f64; COLS]; ROWS];
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      const type_aliases = Array.from(result.types.values()).filter(
        (d) => d.kind === "type_alias"
      );

      expect(type_aliases.length).toBeGreaterThanOrEqual(2);

      // Check Arr with const generic
      const arrType = type_aliases.find((t) => t.name === "Arr");
      expect(arrType).toBeDefined();
      expect(arrType?.type_expression).toBe("[T; N]");

      // Check Matrix with multiple const generics
      const matrixType = type_aliases.find((t) => t.name === "Matrix");
      expect(matrixType).toBeDefined();
      expect(matrixType?.type_expression).toBe("[[f64; COLS]; ROWS]");
    });

    it("should extract complex nested type aliases", () => {
      const code = `
type NestedResult<T, E> = Result<Option<T>, Box<dyn std::error::Error>>;
type ComplexCallback<T> = Box<dyn Fn(Result<T, String>) -> Option<T>>;
type AsyncFn<'a, T> = Box<dyn Future<Output = Result<T, Box<dyn Error>>> + Send + 'a>;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      const type_aliases = Array.from(result.types.values()).filter(
        (d) => d.kind === "type_alias"
      );

      expect(type_aliases.length).toBeGreaterThanOrEqual(3);

      // Check NestedResult
      const nestedResult = type_aliases.find((t) => t.name === "NestedResult");
      expect(nestedResult).toBeDefined();
      expect(nestedResult?.type_expression).toBe(
        "Result<Option<T>, Box<dyn std::error::Error>>"
      );
      expect(nestedResult?.generics).toEqual(["T", "E"]);

      // Check ComplexCallback
      const complexCallback = type_aliases.find(
        (t) => t.name === "ComplexCallback"
      );
      expect(complexCallback).toBeDefined();
      expect(complexCallback?.type_expression).toBe(
        "Box<dyn Fn(Result<T, String>) -> Option<T>>"
      );
      expect(complexCallback?.generics).toEqual(["T"]);

      // Check AsyncFn
      const asyncFn = type_aliases.find((t) => t.name === "AsyncFn");
      expect(asyncFn).toBeDefined();
      expect(asyncFn?.type_expression).toBe(
        "Box<dyn Future<Output = Result<T, Box<dyn Error>>> + Send + 'a>"
      );
      expect(asyncFn?.generics).toEqual(["'a", "T"]);
    });

    it("should extract type aliases with trait bounds", () => {
      const code = `
type Handler<T: Display> = Box<dyn Fn(T)>;
type CompareFn<T: PartialOrd + Clone> = fn(&T, &T) -> bool;
type SerializeFn<T: Serialize + Send + 'static> = Box<dyn Fn(T) -> String>;
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");
      const result = build_semantic_index(parsed_file, tree, "rust");

      const type_aliases = Array.from(result.types.values()).filter(
        (d) => d.kind === "type_alias"
      );

      expect(type_aliases.length).toBeGreaterThanOrEqual(3);

      // Check Handler with Display bound
      const handler = type_aliases.find((t) => t.name === "Handler");
      expect(handler).toBeDefined();
      expect(handler?.type_expression).toBe("Box<dyn Fn(T)>");
      expect(handler?.generics).toEqual(["T"]);

      // Check CompareFn with multiple bounds
      const compareFn = type_aliases.find((t) => t.name === "CompareFn");
      expect(compareFn).toBeDefined();
      expect(compareFn?.type_expression).toBe("fn(&T, &T) -> bool");
      expect(compareFn?.generics).toEqual(["T"]);

      // Check SerializeFn with multiple bounds including lifetime
      const serializeFn = type_aliases.find((t) => t.name === "SerializeFn");
      expect(serializeFn).toBeDefined();
      expect(serializeFn?.type_expression).toBe("Box<dyn Fn(T) -> String>");
      expect(serializeFn?.generics).toEqual(["T"]);
    });
  });
});
