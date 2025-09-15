import { describe, it, expect } from "vitest";
import { analyze_file } from "./file_analyzer";
import { CodeFile } from "./project/file_scanner";

describe("Scope Entity Connections", () => {
  it("should build scope entity connections for functions and classes", async () => {
    const jsFile: CodeFile = {
      file_path: "/test/example.js",
      language: "javascript",
      source_code: `
        function globalFunction() {
          const localVar = 42;
          
          function nestedFunction() {
            return localVar * 2;
          }
          
          return nestedFunction();
        }
        
        class MyClass {
          constructor() {
            this.value = 10;
          }
          
          method1() {
            return this.value;
          }
          
          method2() {
            const innerVar = 20;
            return innerVar + this.value;
          }
        }
      `,
    };

    const { analysis } = await analyze_file(jsFile);

    // The scope entity connections should be built (even if not exposed in FileAnalysis)
    // This test verifies the wiring is working without errors

    // Check that functions are detected
    expect(analysis.functions).toBeDefined();
    expect(analysis.functions.length).toBeGreaterThan(0);

    // Check that classes are detected
    expect(analysis.classes).toBeDefined();
    expect(analysis.classes.length).toBeGreaterThan(0);

    // Check that scopes are built
    expect(analysis.scopes).toBeDefined();
    expect(analysis.scopes.nodes.size).toBeGreaterThan(0);
  });

  it("should handle Python classes with scope connections", async () => {
    const pyFile: CodeFile = {
      file_path: "/test/example.py",
      language: "python",
      source_code: `
class BaseClass:
    def __init__(self, value):
        self.value = value
    
    def get_value(self):
        return self.value

class DerivedClass(BaseClass):
    def __init__(self, value, extra):
        super().__init__(value)
        self.extra = extra
    
    def get_value(self):
        base_value = super().get_value()
        return base_value + self.extra
    
    def helper_method(self):
        local_var = 100
        
        def inner_function():
            return local_var * 2
        
        return inner_function()
      `,
    };

    const { analysis } = await analyze_file(pyFile);

    // Verify classes are detected
    expect(analysis.classes).toBeDefined();
    expect(analysis.classes.length).toBe(2);

    // Verify methods are detected
    const baseClass = analysis.classes.find((c) => c.symbol === "BaseClass");
    expect(baseClass).toBeDefined();
    expect(baseClass?.methods.length).toBeGreaterThan(0);

    const derivedClass = analysis.classes.find(
      (c) => c.symbol === "DerivedClass"
    );
    expect(derivedClass).toBeDefined();
    expect(derivedClass?.methods.length).toBeGreaterThan(0);

    // Verify scopes exist for classes and methods
    expect(analysis.scopes.nodes.size).toBeGreaterThan(0);
  });

  it("should handle TypeScript interfaces and classes", async () => {
    const tsFile: CodeFile = {
      file_path: "/test/example.ts",
      language: "typescript",
      source_code: `
        interface Shape {
          area(): number;
        }
        
        class Circle implements Shape {
          private radius: number;
          
          constructor(radius: number) {
            this.radius = radius;
          }
          
          area(): number {
            return Math.PI * this.radius ** 2;
          }
          
          private helper(): number {
            const pi = Math.PI;
            return pi * 2;
          }
        }
        
        function createShape(type: string): Shape {
          if (type === 'circle') {
            return new Circle(5);
          }
          throw new Error('Unknown shape type');
        }
      `,
    };

    const { analysis } = await analyze_file(tsFile);

    // Verify the Circle class is found
    expect(analysis.classes).toBeDefined();
    const circleClass = analysis.classes.find((c) => c.symbol === "Circle");
    expect(circleClass).toBeDefined();

    // Verify methods are found
    expect(circleClass?.methods).toBeDefined();
    const areaMethod = circleClass?.methods.find((m) => m.name === "area");
    expect(areaMethod).toBeDefined();

    // Verify functions are found
    expect(analysis.functions).toBeDefined();
    const createShapeFunc = analysis.functions.find(
      (f) => f.name === "createShape"
    );
    expect(createShapeFunc).toBeDefined();

    // Verify scopes are created
    expect(analysis.scopes).toBeDefined();
    expect(analysis.scopes.nodes.size).toBeGreaterThan(0);
  });
});
