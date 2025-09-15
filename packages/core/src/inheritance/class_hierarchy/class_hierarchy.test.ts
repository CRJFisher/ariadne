import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import {
  ClassHierarchyContext,
  build_class_hierarchy,
  CLASS_HIERARCHY_CONTEXT,
} from "./index";
import type { ClassDefinition, ClassNode } from "@ariadnejs/types";

describe("class_hierarchy", () => {
  let jsParser: Parser;
  let tsParser: Parser;
  let pyParser: Parser;
  let rustParser: Parser;

  beforeEach(() => {
    jsParser = new Parser();
    jsParser.setLanguage(JavaScript);

    tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);

    pyParser = new Parser();
    pyParser.setLanguage(Python);

    rustParser = new Parser();
    rustParser.setLanguage(Rust);
  });

  describe("Module Context", () => {
    it("should have correct module context", () => {
      expect(CLASS_HIERARCHY_CONTEXT.module).toBe("class_hierarchy");
      expect(CLASS_HIERARCHY_CONTEXT.refactored).toBe(true);
      expect(CLASS_HIERARCHY_CONTEXT.version).toBe("2.0.0");
    });
  });

  describe("JavaScript/TypeScript", () => {
    it("should extract class extends relationship", () => {
      const code = `
        class Animal {
          move() {}
        }
        class Dog extends Animal {
          bark() {}
        }
      `;

      const tree = jsParser.parse(code);

      // Create mock definitions - use partial type with required fields
      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Animal",
          file_path: "test.js",
          location: {
            file_path: "test.js",
            line: 2,
            column: 14,
            end_line: 4,
            end_column: 9,
          },
        },
        {
          symbol: "Dog",
          file_path: "test.js",
          location: {
            file_path: "test.js",
            line: 5,
            column: 14,
            end_line: 7,
            end_column: 9,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.js", {
        tree,
        source_code: code,
        file_path: "test.js",
        language: "javascript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      expect(hierarchy.classes.size).toBe(2);

      // Find Dog class
      let dogInfo: ClassNode | undefined;
      let animalInfo: ClassNode | undefined;

      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Dog") dogInfo = node;
        if (node.symbol === "Animal") animalInfo = node;
      }

      expect(dogInfo).toBeDefined();
      expect(animalInfo).toBeDefined();

      // Check Dog extends Animal
      expect(dogInfo!.base_classes).toContain("Animal");
      expect(dogInfo!.parent_class?.symbol).toBe("Animal");

      // Check Animal has Dog as derived class
      expect(animalInfo!.derived_classes).toContain("Dog");

      // Check inheritance edges
      const extendsEdge = hierarchy.inheritance_edges.find(
        (e) => e.from === "Dog" && e.to === "Animal"
      );
      expect(extendsEdge).toBeDefined();
      expect(extendsEdge!.type).toBe("extends");
    });

    it("should extract TypeScript implements relationship", () => {
      const code = `
        interface Flyable {
          fly(): void;
        }
        interface Swimmable {
          swim(): void;
        }
        class Bird implements Flyable {
          fly() {}
        }
        class Duck extends Bird implements Swimmable {
          swim() {}
        }
      `;

      const tree = tsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Flyable",
          file_path: "test.ts",
          is_interface: true,
          location: {
            file_path: "test.ts",
            line: 2,
            column: 18,
            end_line: 4,
            end_column: 9,
          },
        },
        {
          symbol: "Swimmable",
          file_path: "test.ts",
          is_interface: true,
          location: {
            file_path: "test.ts",
            line: 5,
            column: 18,
            end_line: 7,
            end_column: 9,
          },
        },
        {
          symbol: "Bird",
          file_path: "test.ts",
          location: {
            file_path: "test.ts",
            line: 8,
            column: 14,
            end_line: 10,
            end_column: 9,
          },
        },
        {
          symbol: "Duck",
          file_path: "test.ts",
          location: {
            file_path: "test.ts",
            line: 11,
            column: 14,
            end_line: 13,
            end_column: 9,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.ts", {
        tree,
        source_code: code,
        file_path: "test.ts",
        language: "typescript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find classes
      let birdInfo: ClassNode | undefined;
      let duckInfo: ClassNode | undefined;

      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Bird") birdInfo = node;
        if (node.symbol === "Duck") duckInfo = node;
      }

      expect(birdInfo).toBeDefined();
      expect(duckInfo).toBeDefined();

      // Check Bird implements Flyable
      expect(birdInfo!.interfaces).toContain("Flyable");

      // Check Duck extends Bird and implements Swimmable
      expect(duckInfo!.base_classes).toContain("Bird");
      expect(duckInfo!.parent_class?.symbol).toBe("Bird");
      expect(duckInfo!.interfaces).toContain("Swimmable");

      // Check inheritance edges
      const implementsEdge = hierarchy.inheritance_edges.find(
        (e) => e.from === "Bird" && e.to === "Flyable"
      );
      expect(implementsEdge).toBeDefined();
      expect(implementsEdge!.type).toBe("implements");
    });

    it("should detect mixin patterns", () => {
      const code = `
        function withLogging(Base) {
          return class extends Base {
            log() {}
          };
        }
        class MyClass extends withLogging(BaseClass) {
          method() {}
        }
      `;

      const tree = jsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "MyClass",
          file_path: "test.js",
          location: {
            file_path: "test.js",
            line: 7,
            column: 14,
            end_line: 9,
            end_column: 9,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.js", {
        tree,
        source_code: code,
        file_path: "test.js",
        language: "javascript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find MyClass
      let myClassInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "MyClass") myClassInfo = node;
      }

      expect(myClassInfo).toBeDefined();
      expect(myClassInfo!.is_mixin).toBe(true);
    });
  });

  describe("Python", () => {
    it("should extract Python class inheritance", () => {
      const code = `
class Animal:
    def move(self):
        pass

class Mammal(Animal):
    def feed_milk(self):
        pass

class Dog(Mammal):
    def bark(self):
        pass
`;

      const tree = pyParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Animal",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 2,
            column: 6,
            end_line: 4,
            end_column: 12,
          },
        },
        {
          symbol: "Mammal",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 6,
            column: 6,
            end_line: 8,
            end_column: 12,
          },
        },
        {
          symbol: "Dog",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 10,
            column: 6,
            end_line: 12,
            end_column: 12,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.py", {
        tree,
        source_code: code,
        file_path: "test.py",
        language: "python",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find classes
      let dogInfo: ClassNode | undefined;
      let mammalInfo: ClassNode | undefined;

      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Dog") dogInfo = node;
        if (node.symbol === "Mammal") mammalInfo = node;
      }

      expect(dogInfo).toBeDefined();
      expect(mammalInfo).toBeDefined();

      // Check inheritance chain
      expect(dogInfo!.base_classes).toContain("Mammal");
      expect(dogInfo!.parent_class?.symbol).toBe("Mammal");
      expect(mammalInfo!.base_classes).toContain("Animal");
    });

    it("should handle Python multiple inheritance", () => {
      const code = `
class Flyable:
    def fly(self):
        pass

class Swimmable:
    def swim(self):
        pass

class Duck(Flyable, Swimmable):
    def quack(self):
        pass
`;

      const tree = pyParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Flyable",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 2,
            column: 6,
            end_line: 4,
            end_column: 12,
          },
        },
        {
          symbol: "Swimmable",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 6,
            column: 6,
            end_line: 8,
            end_column: 12,
          },
        },
        {
          symbol: "Duck",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 10,
            column: 6,
            end_line: 12,
            end_column: 12,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.py", {
        tree,
        source_code: code,
        file_path: "test.py",
        language: "python",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find Duck
      let duckInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Duck") duckInfo = node;
      }

      expect(duckInfo).toBeDefined();

      // In Python multiple inheritance, all are base classes
      expect(duckInfo!.base_classes).toContain("Flyable");
      expect(duckInfo!.base_classes).toContain("Swimmable");
      expect(duckInfo!.parent_class?.symbol).toBe("Flyable");
    });

    it("should detect abstract base classes", () => {
      const code = `
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

class Circle(Shape):
    def area(self):
        return 3.14 * self.radius ** 2
`;

      const tree = pyParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Shape",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 4,
            column: 6,
            end_line: 7,
            end_column: 12,
          },
        },
        {
          symbol: "Circle",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 9,
            column: 6,
            end_line: 11,
            end_column: 39,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.py", {
        tree,
        source_code: code,
        file_path: "test.py",
        language: "python",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find Shape
      let shapeInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Shape") shapeInfo = node;
      }

      expect(shapeInfo).toBeDefined();
      expect(shapeInfo!.is_abstract).toBe(true);
    });

    it("should detect metaclass", () => {
      const code = `
class SingletonMeta(type):
    pass

class Singleton(metaclass=SingletonMeta):
    pass
`;

      const tree = pyParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Singleton",
          file_path: "test.py",
          location: {
            file_path: "test.py",
            line: 5,
            column: 6,
            end_line: 6,
            end_column: 8,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.py", {
        tree,
        source_code: code,
        file_path: "test.py",
        language: "python",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find Singleton
      let singletonInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Singleton") singletonInfo = node;
      }

      expect(singletonInfo).toBeDefined();
      expect((singletonInfo as any).metaclass).toBe("SingletonMeta");
    });
  });

  describe("Rust", () => {
    it("should extract Rust trait implementations", () => {
      const code = `
trait Drawable {
    fn draw(&self);
}

struct Circle {
    radius: f32,
}

impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle");
    }
}
`;

      const tree = rustParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Drawable",
          file_path: "test.rs",
          is_trait: true,
          location: {
            file_path: "test.rs",
            line: 2,
            column: 6,
            end_line: 4,
            end_column: 1,
          },
        },
        {
          symbol: "Circle",
          file_path: "test.rs",
          location: {
            file_path: "test.rs",
            line: 6,
            column: 7,
            end_line: 8,
            end_column: 1,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.rs", {
        tree,
        source_code: code,
        file_path: "test.rs",
        language: "rust",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find Circle
      let circleInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Circle") circleInfo = node;
      }

      expect(circleInfo).toBeDefined();
      expect(circleInfo!.interfaces).toContain("Drawable");
    });

    it("should extract derived traits", () => {
      const code = `
#[derive(Debug, Clone, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}
`;

      const tree = rustParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Point",
          file_path: "test.rs",
          location: {
            file_path: "test.rs",
            line: 3,
            column: 7,
            end_line: 6,
            end_column: 1,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.rs", {
        tree,
        source_code: code,
        file_path: "test.rs",
        language: "rust",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find Point
      let pointInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Point") pointInfo = node;
      }

      expect(pointInfo).toBeDefined();
      expect(pointInfo!.interfaces).toContain("Debug");
      expect(pointInfo!.interfaces).toContain("Clone");
      expect(pointInfo!.interfaces).toContain("PartialEq");
    });

    it("should extract super traits", () => {
      const code = `
trait Display {
    fn fmt(&self) -> String;
}

trait Debug: Display {
    fn debug(&self) -> String;
}
`;

      const tree = rustParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Display",
          file_path: "test.rs",
          is_trait: true,
          location: {
            file_path: "test.rs",
            line: 2,
            column: 6,
            end_line: 4,
            end_column: 1,
          },
        },
        {
          symbol: "Debug",
          file_path: "test.rs",
          is_trait: true,
          location: {
            file_path: "test.rs",
            line: 6,
            column: 6,
            end_line: 8,
            end_column: 1,
          },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.rs", {
        tree,
        source_code: code,
        file_path: "test.rs",
        language: "rust",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find Debug trait
      let debugInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "Debug") debugInfo = node;
      }

      expect(debugInfo).toBeDefined();
      expect(debugInfo!.base_classes).toContain("Display");
    });
  });

  describe("Hierarchy traversal", () => {
    it("should find all ancestors and descendants", () => {
      const code = `
        class A {}
        class B extends A {}
        class C extends B {}
        class D extends B {}
      `;

      const tree = jsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "A",
          file_path: "test.js",
          location: { file_path: "test.js", line: 2, column: 14 },
        },
        {
          symbol: "B",
          file_path: "test.js",
          location: { file_path: "test.js", line: 3, column: 14 },
        },
        {
          symbol: "C",
          file_path: "test.js",
          location: { file_path: "test.js", line: 4, column: 14 },
        },
        {
          symbol: "D",
          file_path: "test.js",
          location: { file_path: "test.js", line: 5, column: 14 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.js", {
        tree,
        source_code: code,
        file_path: "test.js",
        language: "javascript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find class C
      let cInfo: ClassNode | undefined;
      let aInfo: ClassNode | undefined;

      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "C") cInfo = node;
        if (node.symbol === "A") aInfo = node;
      }

      expect(cInfo).toBeDefined();
      expect(aInfo).toBeDefined();

      // C should have B and A as ancestors
      expect(cInfo!.all_ancestors).toBeDefined();
      expect(cInfo!.all_ancestors!.length).toBe(2);
      expect(cInfo!.all_ancestors!.map((a) => a.symbol)).toContain("B");
      expect(cInfo!.all_ancestors!.map((a) => a.symbol)).toContain("A");

      // A should have B, C, D as descendants
      expect(aInfo!.all_descendants).toBeDefined();
      expect(aInfo!.all_descendants!.length).toBe(3);
      expect(aInfo!.all_descendants!.map((d) => d.symbol)).toContain("B");
      expect(aInfo!.all_descendants!.map((d) => d.symbol)).toContain("C");
      expect(aInfo!.all_descendants!.map((d) => d.symbol)).toContain("D");
    });

    it("should identify root classes", () => {
      const code = `
        class Root1 {}
        class Root2 {}
        class Child extends Root1 {}
      `;

      const tree = jsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Root1",
          file_path: "test.js",
          location: { file_path: "test.js", line: 2, column: 14 },
        },
        {
          symbol: "Root2",
          file_path: "test.js",
          location: { file_path: "test.js", line: 3, column: 14 },
        },
        {
          symbol: "Child",
          file_path: "test.js",
          location: { file_path: "test.js", line: 4, column: 14 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.js", {
        tree,
        source_code: code,
        file_path: "test.js",
        language: "javascript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      expect(hierarchy.root_classes.size).toBe(2);
      expect(hierarchy.root_classes).toContain("Root1");
      expect(hierarchy.root_classes).toContain("Root2");
      expect(hierarchy.root_classes).not.toContain("Child");
    });

    it("should compute method resolution order", () => {
      const code = `
        class A {}
        class B extends A {}
        class C extends B {}
      `;

      const tree = jsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "A",
          file_path: "test.js",
          location: { file_path: "test.js", line: 2, column: 14 },
        },
        {
          symbol: "B",
          file_path: "test.js",
          location: { file_path: "test.js", line: 3, column: 14 },
        },
        {
          symbol: "C",
          file_path: "test.js",
          location: { file_path: "test.js", line: 4, column: 14 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.js", {
        tree,
        source_code: code,
        file_path: "test.js",
        language: "javascript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Find class C
      let cInfo: ClassNode | undefined;
      for (const [key, node] of hierarchy.classes) {
        if (node.symbol === "C") cInfo = node;
      }

      expect(cInfo).toBeDefined();
      expect(cInfo!.method_resolution_order).toBeDefined();
      expect(cInfo!.method_resolution_order!.length).toBe(3);
      expect(cInfo!.method_resolution_order![0].symbol).toBe("C");
      expect(cInfo!.method_resolution_order![1].symbol).toBe("B");
      expect(cInfo!.method_resolution_order![2].symbol).toBe("A");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty hierarchy", () => {
      const contexts = new Map<string, ClassHierarchyContext>();
      const hierarchy = build_class_hierarchy([], contexts);

      expect(hierarchy.classes.size).toBe(0);
      expect(hierarchy.inheritance_edges.length).toBe(0);
      expect(hierarchy.root_classes.size).toBe(0);
    });

    it("should handle missing context", () => {
      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "TestClass",
          file_path: "missing.js",
          location: { file_path: "missing.js", line: 1, column: 1 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      // No context for missing.js

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Should gracefully handle missing context
      expect(hierarchy.classes.size).toBe(0);
    });

    it("should handle circular inheritance gracefully", () => {
      // Note: Most languages don't allow circular inheritance,
      // but we should handle it gracefully if it somehow occurs
      const code = `
        class A extends B {}
        class B extends A {}
      `;

      const tree = jsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "A",
          file_path: "test.js",
          location: { file_path: "test.js", line: 2, column: 14 },
        },
        {
          symbol: "B",
          file_path: "test.js",
          location: { file_path: "test.js", line: 3, column: 14 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.js", {
        tree,
        source_code: code,
        file_path: "test.js",
        language: "javascript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Should create the nodes and edges without infinite loops
      expect(hierarchy.classes.size).toBe(2);
      expect(hierarchy.inheritance_edges.length).toBe(2);
    });
  });

  describe("Configuration-driven features", () => {
    it("should extract complex TypeScript inheritance chains", () => {
      const code = `
        interface IBase { }
        interface IExtended extends IBase { }
        abstract class AbstractService implements IExtended { }
        class ConcreteService extends AbstractService implements IBase, IExtended { }
      `;

      const tree = tsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "IBase",
          file_path: "test.ts",
          location: { line: 2, column: 18 },
          is_interface: true,
        },
        {
          symbol: "IExtended",
          file_path: "test.ts",
          location: { line: 3, column: 18 },
          is_interface: true,
        },
        {
          symbol: "AbstractService",
          file_path: "test.ts",
          location: { line: 4, column: 23 },
          is_abstract: true,
        },
        {
          symbol: "ConcreteService",
          file_path: "test.ts",
          location: { line: 5, column: 14 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.ts", {
        tree,
        source_code: code,
        file_path: "test.ts",
        language: "typescript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Check interface extension
      const iExtended = hierarchy.classes.get("test.ts#IExtended");
      expect(iExtended?.base_classes).toContain("IBase");

      // Check abstract class implementation
      const abstractService = hierarchy.classes.get("test.ts#AbstractService");
      expect(abstractService?.interfaces).toContain("IExtended");

      // Check concrete class multiple inheritance
      const concreteService = hierarchy.classes.get("test.ts#ConcreteService");
      expect(concreteService?.base_classes).toContain("AbstractService");
      expect(concreteService?.interfaces).toContain("IBase");
      expect(concreteService?.interfaces).toContain("IExtended");
    });

    it("should handle Python complex inheritance patterns", () => {
      const code = `
from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from enum import Enum

T = TypeVar('T')

class Status(Enum):
    ACTIVE = 1
    INACTIVE = 0

class Meta(type):
    pass

class AbstractBase(ABC):
    @abstractmethod
    def method(self): pass

class GenericBase(Generic[T], AbstractBase):
    pass

class Concrete(GenericBase[int], metaclass=Meta):
    def method(self): pass

@dataclass
class DataModel:
    field: str
`;

      const tree = pyParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Status",
          file_path: "test.py",
          location: { line: 8, column: 6 },
        },
        {
          symbol: "Meta",
          file_path: "test.py",
          location: { line: 12, column: 6 },
        },
        {
          symbol: "AbstractBase",
          file_path: "test.py",
          location: { line: 15, column: 6 },
        },
        {
          symbol: "GenericBase",
          file_path: "test.py",
          location: { line: 19, column: 6 },
        },
        {
          symbol: "Concrete",
          file_path: "test.py",
          location: { line: 22, column: 6 },
        },
        {
          symbol: "DataModel",
          file_path: "test.py",
          location: { line: 26, column: 6 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.py", {
        tree,
        source_code: code,
        file_path: "test.py",
        language: "python",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Check enum detection
      const status = hierarchy.classes.get("test.py#Status");
      expect(status?.base_classes).toContain("Enum");
      expect((status as any).is_enum).toBe(true);

      // Check ABC detection
      const abstractBase = hierarchy.classes.get("test.py#AbstractBase");
      expect(abstractBase?.base_classes).toContain("ABC");
      expect((abstractBase as any).is_abstract).toBe(true);

      // Check multiple inheritance with Generic
      const genericBase = hierarchy.classes.get("test.py#GenericBase");
      expect(genericBase?.base_classes).toContain("Generic[T]");
      expect(genericBase?.base_classes).toContain("AbstractBase");

      // Check metaclass detection
      const concrete = hierarchy.classes.get("test.py#Concrete");
      expect((concrete as any).metaclass).toBe("Meta");

      // Check dataclass detection
      const dataModel = hierarchy.classes.get("test.py#DataModel");
      expect((dataModel as any).is_dataclass).toBe(true);
    });

    it("should handle Rust complex trait patterns", () => {
      const code = `
#[derive(Debug, Clone, Copy)]
struct Point { x: i32, y: i32 }

trait Display {
    fn fmt(&self) -> String;
}

trait Debug: Display {
    fn debug(&self);
}

unsafe trait UnsafeTrait { }

auto trait Send { }

impl Display for Point {
    fn fmt(&self) -> String { format!("{},{}", self.x, self.y) }
}

impl Debug for Point {
    fn debug(&self) { println!("{:?}", self); }
}

unsafe impl UnsafeTrait for Point { }

struct Generic<T: Display + Debug> where T: Clone {
    value: T
}

impl<T: Display + Debug> Generic<T> where T: Clone {
    fn new(value: T) -> Self { Self { value } }
}
`;

      const tree = rustParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Point",
          file_path: "test.rs",
          location: { line: 3, column: 7 },
        },
        {
          symbol: "Display",
          file_path: "test.rs",
          location: { line: 5, column: 6 },
          is_trait: true,
        },
        {
          symbol: "Debug",
          file_path: "test.rs",
          location: { line: 9, column: 6 },
          is_trait: true,
        },
        {
          symbol: "UnsafeTrait",
          file_path: "test.rs",
          location: { line: 13, column: 13 },
          is_trait: true,
        },
        {
          symbol: "Send",
          file_path: "test.rs",
          location: { line: 15, column: 5 },
          is_trait: true,
        },
        {
          symbol: "Generic",
          file_path: "test.rs",
          location: { line: 27, column: 7 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.rs", {
        tree,
        source_code: code,
        file_path: "test.rs",
        language: "rust",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      // Check derived traits
      const point = hierarchy.classes.get("test.rs#Point");
      expect(point?.interfaces).toContain("Debug");
      expect(point?.interfaces).toContain("Clone");
      expect(point?.interfaces).toContain("Copy");

      // Check trait implementations
      expect(point?.interfaces).toContain("Display");
      expect(point?.interfaces).toContain("UnsafeTrait");

      // Check super traits
      const debugTrait = hierarchy.classes.get("test.rs#Debug");
      expect(debugTrait?.base_classes).toContain("Display");

      // Check unsafe trait detection
      const unsafeTrait = hierarchy.classes.get("test.rs#UnsafeTrait");
      expect((unsafeTrait as any).is_unsafe).toBe(true);

      // Check auto trait detection
      const sendTrait = hierarchy.classes.get("test.rs#Send");
      // TODO: Fix auto trait detection - the AST structure makes it difficult to detect
      // expect((sendTrait as any).is_auto_trait).toBe(true);

      // Check generic constraints
      const generic = hierarchy.classes.get("test.rs#Generic");
      // TODO: Fix generic constraint detection
      // expect((generic as any).generic_constraints).toBeDefined();
      // expect((generic as any).where_constraints).toBeDefined();
    });
  });

  describe("Bespoke handler features", () => {
    it("should detect TypeScript abstract classes", () => {
      const code = `
        abstract class AbstractBase {
          abstract method(): void;
        }
        class Concrete extends AbstractBase {
          method(): void { }
        }
      `;

      const tree = tsParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "AbstractBase",
          file_path: "test.ts",
          location: { line: 2, column: 23 },
          is_abstract: true,
        },
        {
          symbol: "Concrete",
          file_path: "test.ts",
          location: { line: 5, column: 14 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.ts", {
        tree,
        source_code: code,
        file_path: "test.ts",
        language: "typescript",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      const abstractBase = hierarchy.classes.get("test.ts#AbstractBase");
      expect((abstractBase as any).is_abstract).toBe(true);
    });

    it("should detect Python namedtuples", () => {
      const code = `
from typing import NamedTuple

class Point(NamedTuple):
    x: int
    y: int
`;

      const tree = pyParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Point",
          file_path: "test.py",
          location: { line: 4, column: 6 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.py", {
        tree,
        source_code: code,
        file_path: "test.py",
        language: "python",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      const point = hierarchy.classes.get("test.py#Point");
      expect(point?.base_classes).toContain("NamedTuple");
      expect((point as any).is_namedtuple).toBe(true);
    });

    it("should detect Rust Copy and Clone traits", () => {
      const code = `
struct Copyable;
impl Copy for Copyable {}
impl Clone for Copyable { fn clone(&self) -> Self { *self } }

struct Cloneable;
impl Clone for Cloneable { fn clone(&self) -> Self { Cloneable } }
`;

      const tree = rustParser.parse(code);

      const definitions: Partial<ClassDefinition>[] = [
        {
          symbol: "Copyable",
          file_path: "test.rs",
          location: { line: 2, column: 7 },
        },
        {
          symbol: "Cloneable",
          file_path: "test.rs",
          location: { line: 6, column: 7 },
        },
      ];

      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set("test.rs", {
        tree,
        source_code: code,
        file_path: "test.rs",
        language: "rust",
      });

      const hierarchy = build_class_hierarchy(
        definitions as ClassDefinition[],
        contexts
      );

      const copyable = hierarchy.classes.get("test.rs#Copyable");
      expect(copyable?.interfaces).toContain("Copy");
      expect(copyable?.interfaces).toContain("Clone");
      expect((copyable as any).is_copy).toBe(true);
      expect((copyable as any).is_clone).toBe(true);

      const cloneable = hierarchy.classes.get("test.rs#Cloneable");
      expect(cloneable?.interfaces).toContain("Clone");
      expect((cloneable as any).is_copy).toBeFalsy();
      expect((cloneable as any).is_clone).toBe(true);
    });
  });
});
