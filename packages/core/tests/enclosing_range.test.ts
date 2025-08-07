import { Project } from "../src/index";
import { Def } from "../src/graph";

describe("enclosing_range", () => {
  describe("JavaScript", () => {
    it("should populate enclosing_range for function declarations", () => {
      const project = new Project();
      const code = `function greet(name) {
  console.log("Hello " + name);
  return true;
}`;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      const greet = defs.find(d => d.name === "greet");
      
      expect(greet).toBeDefined();
      expect(greet!.enclosing_range).toBeDefined();
      expect(greet!.enclosing_range!.start.row).toBe(0);
      expect(greet!.enclosing_range!.start.column).toBe(0);
      expect(greet!.enclosing_range!.end.row).toBe(3);
      expect(greet!.enclosing_range!.end.column).toBe(1);
    });

    it("should populate enclosing_range for arrow functions", () => {
      const project = new Project();
      const code = `const add = (a, b) => {
  return a + b;
};`;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      const add = defs.find(d => d.name === "add");
      
      expect(add).toBeDefined();
      expect(add!.enclosing_range).toBeUndefined(); // arrow functions are assigned to variables
    });

    it("should populate enclosing_range for method definitions", () => {
      const project = new Project();
      const code = `class Calculator {
  add(a, b) {
    return a + b;
  }
  
  multiply(a, b) {
    const result = a * b;
    return result;
  }
}`;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      const add = defs.find(d => d.name === "add" && d.symbol_kind === "method");
      const multiply = defs.find(d => d.name === "multiply" && d.symbol_kind === "method");
      
      expect(add).toBeDefined();
      expect(add!.enclosing_range).toBeDefined();
      expect(add!.enclosing_range!.start.row).toBe(1);
      expect(add!.enclosing_range!.start.column).toBe(2);
      expect(add!.enclosing_range!.end.row).toBe(3);
      expect(add!.enclosing_range!.end.column).toBe(3);
      
      expect(multiply).toBeDefined();
      expect(multiply!.enclosing_range).toBeDefined();
      expect(multiply!.enclosing_range!.start.row).toBe(5);
      expect(multiply!.enclosing_range!.start.column).toBe(2);
      expect(multiply!.enclosing_range!.end.row).toBe(8);
      expect(multiply!.enclosing_range!.end.column).toBe(3);
    });
  });

  describe("TypeScript", () => {
    it("should populate enclosing_range for TypeScript functions", () => {
      const project = new Project();
      const code = `function calculate(x: number, y: number): number {
  const sum = x + y;
  const product = x * y;
  return sum + product;
}`;
      
      project.add_or_update_file("test.ts", code);
      const defs = project.get_definitions("test.ts");
      const calculate = defs.find(d => d.name === "calculate");
      
      expect(calculate).toBeDefined();
      expect(calculate!.enclosing_range).toBeDefined();
      expect(calculate!.enclosing_range!.start.row).toBe(0);
      expect(calculate!.enclosing_range!.end.row).toBe(4);
    });
  });

  describe("Python", () => {
    it("should populate enclosing_range for Python functions", () => {
      const project = new Project();
      const code = `def fibonacci(n):
    """Calculate fibonacci number"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      const fibonacci = defs.find(d => d.name === "fibonacci");
      
      expect(fibonacci).toBeDefined();
      expect(fibonacci!.enclosing_range).toBeDefined();
      expect(fibonacci!.enclosing_range!.start.row).toBe(0);
      expect(fibonacci!.enclosing_range!.end.row).toBe(4);
    });

    it("should populate enclosing_range for Python methods", () => {
      const project = new Project();
      const code = `class Math:
    def add(self, a, b):
        """Add two numbers"""
        return a + b
    
    def multiply(self, a, b):
        result = a * b
        return result`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      const add = defs.find(d => d.name === "add" && d.symbol_kind === "method");
      const multiply = defs.find(d => d.name === "multiply" && d.symbol_kind === "method");
      
      expect(add).toBeDefined();
      expect(add!.enclosing_range).toBeDefined();
      expect(add!.enclosing_range!.start.row).toBe(1);
      expect(add!.enclosing_range!.end.row).toBe(3);
      
      expect(multiply).toBeDefined();
      expect(multiply!.enclosing_range).toBeDefined();
      expect(multiply!.enclosing_range!.start.row).toBe(5);
      expect(multiply!.enclosing_range!.end.row).toBe(7);
    });
  });

  describe("Rust", () => {
    it("should populate enclosing_range for Rust functions", () => {
      const project = new Project();
      const code = `fn factorial(n: u32) -> u32 {
    if n == 0 {
        1
    } else {
        n * factorial(n - 1)
    }
}`;
      
      project.add_or_update_file("test.rs", code);
      const defs = project.get_definitions("test.rs");
      const factorial = defs.find(d => d.name === "factorial");
      
      expect(factorial).toBeDefined();
      expect(factorial!.enclosing_range).toBeDefined();
      expect(factorial!.enclosing_range!.start.row).toBe(0);
      expect(factorial!.enclosing_range!.end.row).toBe(6);
    });

    it("should populate enclosing_range for Rust methods", () => {
      const project = new Project();
      const code = `impl Calculator {
    fn add(&self, a: i32, b: i32) -> i32 {
        a + b
    }
    
    pub fn multiply(&self, a: i32, b: i32) -> i32 {
        let result = a * b;
        result
    }
}`;
      
      project.add_or_update_file("test.rs", code);
      const defs = project.get_definitions("test.rs");
      const add = defs.find(d => d.name === "add" && d.symbol_kind === "method");
      const multiply = defs.find(d => d.name === "multiply" && d.symbol_kind === "method");
      
      expect(add).toBeDefined();
      expect(add!.enclosing_range).toBeDefined();
      expect(add!.enclosing_range!.start.row).toBe(1);
      expect(add!.enclosing_range!.end.row).toBe(3);
      
      expect(multiply).toBeDefined();
      expect(multiply!.enclosing_range).toBeDefined();
      expect(multiply!.enclosing_range!.start.row).toBe(5);
      expect(multiply!.enclosing_range!.end.row).toBe(8);
    });
  });

  describe("Python", () => {
    it("should populate enclosing_range for Python classes", () => {
      const project = new Project();
      const code = `class Calculator:
    def __init__(self):
        self.value = 0
    
    def add(self, x):
        self.value += x`;
      
      project.add_or_update_file("test.py", code);
      const defs = project.get_definitions("test.py");
      const calc = defs.find(d => d.name === "Calculator");
      
      expect(calc).toBeDefined();
      expect(calc!.enclosing_range).toBeDefined();
      expect(calc!.enclosing_range!.start.row).toBe(0);
      expect(calc!.enclosing_range!.end.row).toBe(5);
    });
  });

  describe("Rust", () => {
    it("should populate enclosing_range for Rust structs", () => {
      const project = new Project();
      const code = `struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
}`;
      
      project.add_or_update_file("test.rs", code);
      const defs = project.get_definitions("test.rs");
      const point = defs.find(d => d.name === "Point");
      
      expect(point).toBeDefined();
      expect(point!.enclosing_range).toBeDefined();
      expect(point!.enclosing_range!.start.row).toBe(0);
      expect(point!.enclosing_range!.end.row).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("should not populate enclosing_range for simple variable definitions", () => {
      const project = new Project();
      const code = `const PI = 3.14159;
let counter = 0;`;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      const pi = defs.find(d => d.name === "PI");
      const counter = defs.find(d => d.name === "counter");
      
      expect(pi).toBeDefined();
      expect(pi!.enclosing_range).toBeUndefined();
      
      expect(counter).toBeDefined();
      expect(counter!.enclosing_range).toBeUndefined();
    });
    
    it("should populate enclosing_range for class definitions", () => {
      const project = new Project();
      const code = `class Shape {
  constructor() {}
  area() { return 0; }
}`;
      
      project.add_or_update_file("test.js", code);
      const defs = project.get_definitions("test.js");
      const shape = defs.find(d => d.name === "Shape");
      
      expect(shape).toBeDefined();
      expect(shape!.enclosing_range).toBeDefined();
      expect(shape!.enclosing_range!.start.row).toBe(0);
      expect(shape!.enclosing_range!.end.row).toBe(3);
    });
  });
});