/**
 * Integration tests for the class detection module
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { find_class_definitions, ClassDetectionContext } from './index';

function parse_code(code: string, language: 'javascript' | 'typescript' | 'python' | 'rust'): Parser.Tree {
  const parser = new Parser();
  
  switch (language) {
    case 'javascript':
      parser.setLanguage(JavaScript);
      break;
    case 'typescript':
      parser.setLanguage(TypeScript.typescript);
      break;
    case 'python':
      parser.setLanguage(Python);
      break;
    case 'rust':
      parser.setLanguage(Rust);
      break;
  }
  
  return parser.parse(code);
}

describe('class_detection', () => {
  describe('JavaScript class detection', () => {
    it('should detect basic class with methods and properties', () => {
      const code = `
        class Animal {
          #privateField = "secret";
          static species = "unknown";
          
          constructor(name) {
            this.name = name;
          }
          
          speak() {
            return \`\${this.name} makes a sound\`;
          }
          
          static createAnonymous() {
            return new Animal("anonymous");
          }
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      expect(classes).toHaveLength(1);
      
      const animal = classes[0];
      expect(animal.name).toBe('Animal');
      expect(animal.methods).toHaveLength(3); // constructor, speak, createAnonymous
      expect(animal.properties).toHaveLength(2); // #privateField, species
      
      const constructor = animal.methods.find(m => m.is_constructor);
      expect(constructor).toBeDefined();
      expect(constructor?.parameters).toHaveLength(1);
      
      const staticMethod = animal.methods.find(m => m.name === 'createAnonymous');
      expect(staticMethod?.is_static).toBe(true);
      
      const privateField = animal.properties.find(p => p.name === '#privateField');
      expect(privateField?.is_private).toBe(true);
    });
    
    it('should detect class expressions', () => {
      const code = `
        const MyClass = class {
          method() {}
        };
        
        let AnotherClass = class NamedExpression {
          anotherMethod() {}
        };
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      expect(classes).toHaveLength(2);
      expect(classes[0].name).toBe('MyClass');
      expect(classes[1].name).toBe('AnotherClass');
    });
  });
  
  describe('TypeScript class detection', () => {
    it('should detect TypeScript-specific features', () => {
      const code = `
        interface Flyable {
          fly(): void;
        }
        
        abstract class Bird<T> implements Flyable {
          protected species: T;
          private readonly id: number = 1;
          
          abstract fly(): void;
          
          constructor(species: T) {
            this.species = species;
          }
        }
        
        @decorator
        class Eagle extends Bird<string> {
          @property
          wingspan: number;
          
          fly(): void {
            console.log("Eagle flies");
          }
        }
      `;
      
      const tree = parse_code(code, 'typescript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      
      const bird = classes.find(c => c.name === 'Bird');
      expect(bird).toBeDefined();
      expect(bird?.is_abstract).toBe(true);
      expect(bird?.implements).toContain('Flyable');
      expect(bird?.generics).toBeDefined();
      expect(bird?.generics?.[0].name).toBe('T');
      
      const flyMethod = bird?.methods.find(m => m.name === 'fly');
      expect(flyMethod?.is_abstract).toBe(true);
      
      const eagle = classes.find(c => c.name === 'Eagle');
      expect(eagle).toBeDefined();
      expect(eagle?.extends).toContain('Bird');
      expect(eagle?.decorators).toContain('decorator');
    });
    
    it('should detect typed parameters and return types', () => {
      const code = `
        class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
          
          process<T>(data: T[], callback?: (item: T) => void): T[] {
            return data;
          }
        }
      `;
      
      const tree = parse_code(code, 'typescript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      const calc = classes[0];
      
      const add = calc.methods.find(m => m.name === 'add');
      expect(add?.parameters[0].type).toBe('number');
      expect(add?.return_type).toBe('number');
      
      const process = calc.methods.find(m => m.name === 'process');
      expect(process?.generics).toBeDefined();
      expect(process?.parameters[1].is_optional).toBe(true);
    });
  });
  
  describe('Python class detection', () => {
    it('should detect Python class features', () => {
      const code = `
@dataclass
class Person:
    name: str
    age: int = 0
    
    def __init__(self, name: str, age: int = 0):
        self.name = name
        self.age = age
    
    @property
    def description(self) -> str:
        return f"{self.name} is {self.age}"
    
    @staticmethod
    def create_anonymous():
        return Person("Anonymous", 0)
    
    def _protected_method(self):
        pass
    
    def __private_method(self):
        pass
`;
      
      const tree = parse_code(code, 'python');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      const person = classes[0];
      
      expect(person.name).toBe('Person');
      expect(person.decorators).toContain('dataclass');
      
      const init = person.methods.find(m => m.name === '__init__');
      expect(init?.is_constructor).toBe(true);
      expect(init?.parameters).toHaveLength(2); // name and age (self filtered)
      
      const staticMethod = person.methods.find(m => m.name === 'create_anonymous');
      expect(staticMethod?.is_static).toBe(true);
      
      const protectedMethod = person.methods.find(m => m.name === '_protected_method');
      expect(protectedMethod?.is_protected).toBe(true);
      
      const privateMethod = person.methods.find(m => m.name === '__private_method');
      expect(privateMethod?.is_private).toBe(true);
      
      // Check properties extracted from __init__
      expect(person.properties.length).toBeGreaterThan(0);
    });
    
    it('should detect multiple inheritance', () => {
      const code = `
class A:
    pass

class B:
    pass

class C(A, B):
    pass
`;
      
      const tree = parse_code(code, 'python');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      const classC = classes.find(c => c.name === 'C');
      
      expect(classC?.extends).toEqual(['A', 'B']);
    });
  });
  
  describe('Rust struct detection', () => {
    it('should detect Rust structs with impl blocks', () => {
      const code = `
#[derive(Debug, Clone)]
pub struct Point<T> {
    pub x: T,
    pub y: T,
}

impl<T> Point<T> {
    pub fn new(x: T, y: T) -> Self {
        Point { x, y }
    }
    
    pub fn distance(&self) -> f64 {
        0.0
    }
}

impl<T> Display for Point<T> {
    fn fmt(&self, f: &mut Formatter) -> Result {
        Ok(())
    }
}
`;
      
      const tree = parse_code(code, 'rust');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      const point = classes.find(c => c.name === 'Point');
      
      expect(point).toBeDefined();
      expect(point?.properties).toHaveLength(2);
      expect(point?.generics).toBeDefined();
      expect(point?.decorators).toContain('Debug');
      expect(point?.decorators).toContain('Clone');
      
      const newMethod = point?.methods.find(m => m.name === 'new');
      expect(newMethod?.is_static).toBe(true);
      expect(newMethod?.is_constructor).toBe(true);
      
      const distanceMethod = point?.methods.find(m => m.name === 'distance');
      expect(distanceMethod?.is_static).toBe(false);
      
      // Check trait implementation
      expect(point?.implements).toContain('Display');
    });
    
    it('should handle tuple structs', () => {
      const code = `
struct Color(u8, u8, u8);

impl Color {
    fn red(&self) -> u8 {
        self.0
    }
}
`;
      
      const tree = parse_code(code, 'rust');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      const color = classes[0];
      
      expect(color.name).toBe('Color');
      expect(color.properties).toHaveLength(3);
      expect(color.properties[0].name).toBe('0'); // Tuple fields accessed by index
      expect(color.methods).toHaveLength(1);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty classes', () => {
      const code = `
        class Empty {}
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('Empty');
      expect(classes[0].methods).toHaveLength(0);
      expect(classes[0].properties).toHaveLength(0);
    });
    
    it('should handle nested classes', () => {
      const code = `
        class Outer {
          method() {
            class Inner {
              innerMethod() {}
            }
          }
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const classes = find_class_definitions(context);
      expect(classes).toHaveLength(2);
      expect(classes.map(c => c.name)).toContain('Outer');
      expect(classes.map(c => c.name)).toContain('Inner');
    });
  });
});