import { describe, it, expect, beforeEach } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import {
  ClassHierarchyContext,
  build_class_hierarchy,
} from './index';
import type { ClassDefinition } from '@ariadnejs/types';

describe('class_hierarchy', () => {
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
  
  describe('JavaScript/TypeScript', () => {
    it('should extract class extends relationship', () => {
      const code = `
        class Animal {
          move() {}
        }
        class Dog extends Animal {
          bark() {}
        }
      `;
      
      const tree = jsParser.parse(code);
      
      // Create mock definitions
      const definitions: Def[] = [
        {
          symbol_id: 'animal',
          name: 'Animal',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: {
            start: { row: 1, column: 8 },
            end: { row: 3, column: 9 }
          }
        },
        {
          symbol_id: 'dog',
          name: 'Dog',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: {
            start: { row: 4, column: 8 },
            end: { row: 6, column: 9 }
          }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.js', {
        tree,
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      expect(hierarchy.classes.size).toBe(2);
      
      const dogInfo = hierarchy.classes.get('dog');
      expect(dogInfo).toBeDefined();
      expect(dogInfo!.parent_class).toBe('Animal');
      expect(dogInfo!.parent_class_def?.symbol_id).toBe('animal');
      
      const animalInfo = hierarchy.classes.get('animal');
      expect(animalInfo).toBeDefined();
      expect(animalInfo!.subclasses.length).toBe(1);
      expect(animalInfo!.subclasses[0].symbol_id).toBe('dog');
    });
    
    it('should extract TypeScript implements relationship', () => {
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
      
      const definitions: Def[] = [
        {
          symbol_id: 'flyable',
          name: 'Flyable',
          symbol_kind: 'interface',
          file_path: 'test.ts',
          range: {
            start: { row: 1, column: 18 },
            end: { row: 3, column: 9 }
          }
        },
        {
          symbol_id: 'swimmable',
          name: 'Swimmable',
          symbol_kind: 'interface',
          file_path: 'test.ts',
          range: {
            start: { row: 4, column: 18 },
            end: { row: 6, column: 9 }
          }
        },
        {
          symbol_id: 'bird',
          name: 'Bird',
          symbol_kind: 'class',
          file_path: 'test.ts',
          range: {
            start: { row: 7, column: 14 },
            end: { row: 9, column: 9 }
          }
        },
        {
          symbol_id: 'duck',
          name: 'Duck',
          symbol_kind: 'class',
          file_path: 'test.ts',
          range: {
            start: { row: 10, column: 14 },
            end: { row: 12, column: 9 }
          }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.ts', {
        tree,
        source_code: code,
        file_path: 'test.ts',
        language: 'typescript',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      const birdInfo = hierarchy.classes.get('bird');
      expect(birdInfo).toBeDefined();
      expect(birdInfo!.implemented_interfaces).toContain('Flyable');
      expect(birdInfo!.interface_defs.length).toBe(1);
      expect(birdInfo!.interface_defs[0].symbol_id).toBe('flyable');
      
      const duckInfo = hierarchy.classes.get('duck');
      expect(duckInfo).toBeDefined();
      expect(duckInfo!.parent_class).toBe('Bird');
      expect(duckInfo!.implemented_interfaces).toContain('Swimmable');
      expect(duckInfo!.interface_defs.length).toBe(1);
      expect(duckInfo!.interface_defs[0].symbol_id).toBe('swimmable');
    });
  });
  
  describe('Python', () => {
    it('should extract Python class inheritance', () => {
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
      
      const definitions: Def[] = [
        {
          symbol_id: 'animal',
          name: 'Animal',
          symbol_kind: 'class',
          file_path: 'test.py',
          range: {
            start: { row: 1, column: 6 },
            end: { row: 3, column: 12 }
          }
        },
        {
          symbol_id: 'mammal',
          name: 'Mammal',
          symbol_kind: 'class',
          file_path: 'test.py',
          range: {
            start: { row: 5, column: 6 },
            end: { row: 7, column: 12 }
          }
        },
        {
          symbol_id: 'dog',
          name: 'Dog',
          symbol_kind: 'class',
          file_path: 'test.py',
          range: {
            start: { row: 9, column: 6 },
            end: { row: 11, column: 12 }
          }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.py', {
        tree,
        source_code: code,
        file_path: 'test.py',
        language: 'python',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      const dogInfo = hierarchy.classes.get('dog');
      expect(dogInfo).toBeDefined();
      expect(dogInfo!.parent_class).toBe('Mammal');
      
      const mammalInfo = hierarchy.classes.get('mammal');
      expect(mammalInfo).toBeDefined();
      expect(mammalInfo!.parent_class).toBe('Animal');
      
      // Check inheritance chain
      expect(is_subclass_of(
        definitions[2], // Dog
        definitions[0], // Animal
        hierarchy
      )).toBe(true);
    });
    
    it('should handle Python multiple inheritance', () => {
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
      
      const definitions: Def[] = [
        {
          symbol_id: 'flyable',
          name: 'Flyable',
          symbol_kind: 'class',
          file_path: 'test.py',
          range: {
            start: { row: 1, column: 6 },
            end: { row: 3, column: 12 }
          }
        },
        {
          symbol_id: 'swimmable',
          name: 'Swimmable',
          symbol_kind: 'class',
          file_path: 'test.py',
          range: {
            start: { row: 5, column: 6 },
            end: { row: 7, column: 12 }
          }
        },
        {
          symbol_id: 'duck',
          name: 'Duck',
          symbol_kind: 'class',
          file_path: 'test.py',
          range: {
            start: { row: 9, column: 6 },
            end: { row: 11, column: 12 }
          }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.py', {
        tree,
        source_code: code,
        file_path: 'test.py',
        language: 'python',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      const duckInfo = hierarchy.classes.get('duck');
      expect(duckInfo).toBeDefined();
      expect(duckInfo!.parent_class).toBe('Flyable'); // First base is parent
      expect(duckInfo!.implemented_interfaces).toContain('Swimmable'); // Rest are interfaces
    });
  });
  
  describe('Rust', () => {
    it('should extract Rust trait implementations', () => {
      const code = `
trait Drawable {
    fn draw(&self);
}

struct Circle {
    radius: f64,
}

impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle");
    }
}
`;
      
      const tree = rustParser.parse(code);
      
      const definitions: Def[] = [
        {
          symbol_id: 'drawable',
          name: 'Drawable',
          symbol_kind: 'interface', // Traits are like interfaces
          file_path: 'test.rs',
          range: {
            start: { row: 1, column: 6 },
            end: { row: 3, column: 1 }
          }
        },
        {
          symbol_id: 'circle',
          name: 'Circle',
          symbol_kind: 'struct',
          file_path: 'test.rs',
          range: {
            start: { row: 5, column: 7 },
            end: { row: 7, column: 1 }
          }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.rs', {
        tree,
        source_code: code,
        file_path: 'test.rs',
        language: 'rust',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      const circleInfo = hierarchy.classes.get('circle');
      expect(circleInfo).toBeDefined();
      expect(circleInfo!.implemented_interfaces).toContain('Drawable');
    });
    
    it('should extract derived traits', () => {
      const code = `
#[derive(Debug, Clone, PartialEq)]
struct Point {
    x: i32,
    y: i32,
}
`;
      
      const tree = rustParser.parse(code);
      
      const definitions: Def[] = [
        {
          symbol_id: 'point',
          name: 'Point',
          symbol_kind: 'struct',
          file_path: 'test.rs',
          range: {
            start: { row: 2, column: 7 },
            end: { row: 5, column: 1 }
          }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.rs', {
        tree,
        source_code: code,
        file_path: 'test.rs',
        language: 'rust',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      const pointInfo = hierarchy.classes.get('point');
      expect(pointInfo).toBeDefined();
      expect(pointInfo!.implemented_interfaces).toContain('Debug');
      expect(pointInfo!.implemented_interfaces).toContain('Clone');
      expect(pointInfo!.implemented_interfaces).toContain('PartialEq');
    });
  });
  
  describe('Hierarchy traversal', () => {
    it('should find all ancestors and descendants', () => {
      const code = `
        class A {}
        class B extends A {}
        class C extends B {}
        class D extends B {}
      `;
      
      const tree = jsParser.parse(code);
      
      const definitions: Def[] = [
        {
          symbol_id: 'a',
          name: 'A',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: { start: { row: 1, column: 14 }, end: { row: 1, column: 15 } }
        },
        {
          symbol_id: 'b',
          name: 'B',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: { start: { row: 2, column: 14 }, end: { row: 2, column: 15 } }
        },
        {
          symbol_id: 'c',
          name: 'C',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: { start: { row: 3, column: 14 }, end: { row: 3, column: 15 } }
        },
        {
          symbol_id: 'd',
          name: 'D',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: { start: { row: 4, column: 14 }, end: { row: 4, column: 15 } }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.js', {
        tree,
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      // Check C's ancestors (should be B and A)
      const cInfo = hierarchy.classes.get('c')!;
      expect(cInfo.all_ancestors.map(d => d.name)).toEqual(['B', 'A']);
      
      // Check A's descendants (should be B, C, and D)
      const aInfo = hierarchy.classes.get('a')!;
      expect(aInfo.all_descendants.map(d => d.name).sort()).toEqual(['B', 'C', 'D']);
      
      // Check B's descendants (should be C and D)
      const bInfo = hierarchy.classes.get('b')!;
      expect(bInfo.all_descendants.map(d => d.name).sort()).toEqual(['C', 'D']);
      
      // Check inheritance path from C to A
      const path = get_inheritance_path(
        definitions[2], // C
        definitions[0], // A
        hierarchy
      );
      expect(path).toBeDefined();
      expect(path!.map(d => d.name)).toEqual(['C', 'B', 'A']);
    });
    
    it('should identify root classes', () => {
      const code = `
        class RootA {}
        class RootB {}
        class Child extends RootA {}
      `;
      
      const tree = jsParser.parse(code);
      
      const definitions: Def[] = [
        {
          symbol_id: 'root-a',
          name: 'RootA',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: { start: { row: 1, column: 14 }, end: { row: 1, column: 19 } }
        },
        {
          symbol_id: 'root-b',
          name: 'RootB',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: { start: { row: 2, column: 14 }, end: { row: 2, column: 19 } }
        },
        {
          symbol_id: 'child',
          name: 'Child',
          symbol_kind: 'class',
          file_path: 'test.js',
          range: { start: { row: 3, column: 14 }, end: { row: 3, column: 19 } }
        }
      ];
      
      const contexts = new Map<string, ClassHierarchyContext>();
      contexts.set('test.js', {
        tree,
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        all_definitions: definitions
      });
      
      const hierarchy = build_class_hierarchy(definitions, contexts);
      
      expect(hierarchy.roots.length).toBe(2);
      expect(hierarchy.roots.map(d => d.name).sort()).toEqual(['RootA', 'RootB']);
    });
  });
});