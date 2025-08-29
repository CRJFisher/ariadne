/**
 * Tests for Method Override Detection
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import {
  detect_method_overrides,
  is_override,
  is_overridden,
  get_root_method,
  find_overriding_methods,
  find_overridden_method,
  get_override_chain
} from './index';

describe('Method Override Detection', () => {
  describe('JavaScript/TypeScript', () => {
    it('should detect simple method override', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const code = `
        class Animal {
          speak() {
            console.log("Some sound");
          }
          
          move() {
            console.log("Moving");
          }
        }
        
        class Dog extends Animal {
          speak() {
            console.log("Woof!");
          }
        }
        
        class Puppy extends Dog {
          speak() {
            console.log("Yip!");
          }
        }
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'javascript',
        file_path: 'test.js',
        parser
      });
      
      // Should have override edges for Dog.speak and Puppy.speak
      expect(result.override_edges.length).toBe(2);
      
      // Find the speak methods (adjusting for actual line numbers)
      const dog_speak = result.override_edges.find(
        e => e.method.start_line === 13 // Line where Dog.speak actually starts
      );
      const puppy_speak = result.override_edges.find(
        e => e.method.start_line === 19 // Line where Puppy.speak actually starts
      );
      
      expect(dog_speak).toBeDefined();
      expect(puppy_speak).toBeDefined();
      
      // Dog.speak overrides Animal.speak
      expect(dog_speak?.base_method.start_line).toBe(3);
      
      // Puppy.speak overrides Dog.speak
      expect(puppy_speak?.base_method.start_line).toBe(13);
      
      // Override chain for Puppy.speak should include all three
      expect(puppy_speak?.override_chain.length).toBe(3);
    });
    
    it('should handle TypeScript interfaces', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      
      const code = `
        interface Shape {
          area(): number;
        }
        
        class Circle implements Shape {
          constructor(private radius: number) {}
          
          area(): number {
            return Math.PI * this.radius ** 2;
          }
        }
        
        class ColoredCircle extends Circle {
          constructor(radius: number, private color: string) {
            super(radius);
          }
          
          area(): number {
            console.log(\`Calculating area of \${this.color} circle\`);
            return super.area();
          }
        }
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'typescript',
        file_path: 'test.ts',
        parser
      });
      
      // Should detect ColoredCircle.area overriding Circle.area
      const overrides = result.override_edges.filter(
        e => e.method.name === 'area'
      );
      
      expect(overrides.length).toBeGreaterThan(0);
    });
    
    it('should not detect static methods as overrides', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const code = `
        class Base {
          static create() {
            return new Base();
          }
          
          instance() {
            return "base";
          }
        }
        
        class Derived extends Base {
          static create() {
            return new Derived();
          }
          
          instance() {
            return "derived";
          }
        }
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'javascript',
        file_path: 'test.js',
        parser
      });
      
      // Should only detect instance() as override, not static create()
      expect(result.override_edges.length).toBe(1);
      expect(result.override_edges[0].method.name).toBe('instance');
    });
  });
  
  describe('Python', () => {
    it('should detect Python method overrides', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const code = `
class Animal:
    def speak(self):
        print("Some sound")
    
    def move(self):
        print("Moving")

class Dog(Animal):
    def speak(self):
        print("Woof!")

class Cat(Animal):
    def speak(self):
        print("Meow!")
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'python',
        file_path: 'test.py',
        parser
      });
      
      // Should detect both Dog.speak and Cat.speak overriding Animal.speak
      expect(result.override_edges.length).toBe(2);
      
      const overrides = result.override_edges.filter(
        e => e.method.name === 'speak'
      );
      
      expect(overrides.length).toBe(2);
      
      // Both should override Animal.speak
      overrides.forEach(override => {
        expect(override.base_method.start_line).toBe(3);
      });
    });
    
    it('should handle multiple inheritance', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const code = `
class A:
    def method(self):
        return "A"

class B:
    def method(self):
        return "B"

class C(A, B):
    def method(self):
        return "C"
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'python',
        file_path: 'test.py',
        parser
      });
      
      // C.method should override A.method (first in MRO)
      const c_override = result.override_edges.find(
        e => e.method.start_line === 11
      );
      
      expect(c_override).toBeDefined();
      expect(c_override?.base_method.start_line).toBe(3); // A.method
    });
    
    it('should skip magic methods except __init__', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const code = `
class Base:
    def __init__(self):
        self.value = 0
    
    def __str__(self):
        return "Base"
    
    def normal(self):
        return "base"

class Derived(Base):
    def __init__(self):
        super().__init__()
        self.extra = 1
    
    def __str__(self):
        return "Derived"
    
    def normal(self):
        return "derived"
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'python',
        file_path: 'test.py',
        parser
      });
      
      // Should detect __init__ and normal, but not __str__
      const init_override = result.override_edges.find(
        e => e.method.name === '__init__'
      );
      const normal_override = result.override_edges.find(
        e => e.method.name === 'normal'
      );
      const str_override = result.override_edges.find(
        e => e.method.name === '__str__'
      );
      
      expect(init_override).toBeDefined();
      expect(normal_override).toBeDefined();
      expect(str_override).toBeUndefined();
    });
  });
  
  describe('Rust', () => {
    it('should detect trait method implementations', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
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

struct ColoredPoint {
    point: Point,
    color: String,
}

impl Display for ColoredPoint {
    fn fmt(&self) -> String {
        format!("{} {}", self.color, self.point.fmt())
    }
}
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'rust',
        file_path: 'test.rs',
        parser
      });
      
      // Should detect both implementations of Display::fmt
      const fmt_overrides = result.override_edges.filter(
        e => e.method.name === 'fmt'
      );
      
      expect(fmt_overrides.length).toBe(2);
      
      // Both should override the trait method
      fmt_overrides.forEach(override => {
        expect(override.base_method.start_line).toBe(3);
        expect(override.is_explicit).toBe(true);
      });
    });
    
    it('should handle default trait methods', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const code = `
trait Greet {
    fn hello(&self) -> &str {
        "Hello"
    }
    
    fn goodbye(&self) -> &str;
}

struct English;

impl Greet for English {
    fn goodbye(&self) -> &str {
        "Goodbye"
    }
}

struct French;

impl Greet for French {
    fn hello(&self) -> &str {
        "Bonjour"
    }
    
    fn goodbye(&self) -> &str {
        "Au revoir"
    }
}
      `;
      
      const tree = parser.parse(code);
      const result = detect_method_overrides(tree.rootNode, {
        language: 'rust',
        file_path: 'test.rs',
        parser
      });
      
      // French::hello should override the default implementation
      const hello_override = result.override_edges.find(
        e => e.method.name === 'hello' && e.method.start_line === 21
      );
      
      expect(hello_override).toBeDefined();
      expect(hello_override?.base_method.start_line).toBe(3);
      
      // All goodbye implementations should override the trait signature
      const goodbye_overrides = result.override_edges.filter(
        e => e.method.name === 'goodbye'
      );
      
      expect(goodbye_overrides.length).toBe(2);
    });
  });
  
  describe('Cross-language consistency', () => {
    it('should provide consistent API across languages', () => {
      const parser_js = new Parser();
      parser_js.setLanguage(JavaScript);
      
      const parser_py = new Parser();
      parser_py.setLanguage(Python);
      
      const parser_rs = new Parser();
      parser_rs.setLanguage(Rust);
      
      const js_code = `
        class Base {
          method() { return "base"; }
        }
        class Derived extends Base {
          method() { return "derived"; }
        }
      `;
      
      const py_code = `
class Base:
    def method(self):
        return "base"

class Derived(Base):
    def method(self):
        return "derived"
      `;
      
      const rs_code = `
trait Behavior {
    fn method(&self) -> &str;
}

struct Concrete;

impl Behavior for Concrete {
    fn method(&self) -> &str {
        "concrete"
    }
}
      `;
      
      const js_tree = parser_js.parse(js_code);
      const py_tree = parser_py.parse(py_code);
      const rs_tree = parser_rs.parse(rs_code);
      
      const js_result = detect_method_overrides(js_tree.rootNode, {
        language: 'javascript',
        file_path: 'test.js',
        parser: parser_js
      });
      
      const py_result = detect_method_overrides(py_tree.rootNode, {
        language: 'python',
        file_path: 'test.py',
        parser: parser_py
      });
      
      const rs_result = detect_method_overrides(rs_tree.rootNode, {
        language: 'rust',
        file_path: 'test.rs',
        parser: parser_rs
      });
      
      // All should detect one override
      expect(js_result.override_edges.length).toBe(1);
      expect(py_result.override_edges.length).toBe(1);
      expect(rs_result.override_edges.length).toBe(1);
      
      // All should have the same structure
      [js_result, py_result, rs_result].forEach(result => {
        expect(result).toHaveProperty('overrides');
        expect(result).toHaveProperty('override_edges');
        expect(result).toHaveProperty('leaf_methods');
        expect(result).toHaveProperty('abstract_methods');
        expect(result).toHaveProperty('language');
      });
    });
  });
});
