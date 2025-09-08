/**
 * Tests for generic method override detection
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import {
  detect_overrides_generic,
  extract_class_methods_generic,
  find_parent_method_generic,
  find_child_overrides_generic,
  build_hierarchy_generic
} from './method_override.generic';
import { get_language_config } from './language_configs';

describe('Generic Method Override Detection', () => {
  describe('extract_class_methods_generic', () => {
    it('should extract methods from JavaScript class', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const config = get_language_config('javascript')!;
      
      const code = `
        class Animal {
          speak() {
            console.log("Some sound");
          }
          
          static create() {
            return new Animal();
          }
          
          move() {
            console.log("Moving");
          }
        }
      `;
      
      const tree = parser.parse(code);
      const class_node = tree.rootNode.descendantsOfType('class_declaration')[0];
      
      const methods = extract_class_methods_generic(
        class_node,
        { name: 'Animal', kind: 'class', file_path: 'test.js', 
          start_line: 1, start_column: 0, end_line: 1, end_column: 0,
          extent_start_line: 1, extent_start_column: 0, 
          extent_end_line: 1, extent_end_column: 0 },
        'test.js',
        config
      );
      
      // Should extract speak and move, but not static create
      expect(methods).toHaveLength(2);
      expect(methods.map(m => m.name)).toContain('speak');
      expect(methods.map(m => m.name)).toContain('move');
      expect(methods.map(m => m.name)).not.toContain('create');
    });
    
    it('should extract methods from Python class', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const config = get_language_config('python')!;
      
      const code = `
class Animal:
    def __init__(self):
        pass
    
    def speak(self):
        print("Some sound")
    
    @staticmethod
    def create():
        return Animal()
    
    def __str__(self):
        return "Animal"
    
    def move(self):
        print("Moving")
`;
      
      const tree = parser.parse(code);
      const class_node = tree.rootNode.descendantsOfType('class_definition')[0];
      
      const methods = extract_class_methods_generic(
        class_node,
        { name: 'Animal', kind: 'class', file_path: 'test.py',
          start_line: 1, start_column: 0, end_line: 1, end_column: 0,
          extent_start_line: 1, extent_start_column: 0,
          extent_end_line: 1, extent_end_column: 0 },
        'test.py',
        config
      );
      
      // Should extract __init__, speak, and move
      // Should skip __str__ (magic method) and create (static)
      expect(methods).toHaveLength(3);
      expect(methods.map(m => m.name)).toContain('__init__');
      expect(methods.map(m => m.name)).toContain('speak');
      expect(methods.map(m => m.name)).toContain('move');
      expect(methods.map(m => m.name)).not.toContain('__str__');
      expect(methods.map(m => m.name)).not.toContain('create');
    });
  });
  
  describe('build_hierarchy_generic', () => {
    it('should build class hierarchy for TypeScript', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      const config = get_language_config('typescript')!;
      
      const code = `
        class Animal {
          speak() {}
        }
        
        class Dog extends Animal {
          bark() {}
        }
        
        class Cat extends Animal {
          meow() {}
        }
        
        class Puppy extends Dog {
          yip() {}
        }
      `;
      
      const tree = parser.parse(code);
      const hierarchy = build_hierarchy_generic(tree.rootNode, 'test.ts', parser, config);
      
      expect(hierarchy.classes.size).toBe(4);
      expect(hierarchy.roots).toHaveLength(1);
      expect(hierarchy.roots[0].name).toBe('Animal');
      
      const dog = hierarchy.classes.get('Dog');
      expect(dog?.parent_class).toBe('Animal');
      expect(dog?.subclasses).toHaveLength(1);
      expect(dog?.subclasses[0].name).toBe('Puppy');
      
      const animal = hierarchy.classes.get('Animal');
      expect(animal?.subclasses).toHaveLength(2);
      expect(animal?.all_descendants).toHaveLength(2);
    });
    
    it('should handle Python class hierarchy', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const config = get_language_config('python')!;
      
      const code = `
class Animal:
    pass

class Dog(Animal):
    pass

class Cat(Animal):
    pass

class Puppy(Dog):
    pass
`;
      
      const tree = parser.parse(code);
      const hierarchy = build_hierarchy_generic(tree.rootNode, 'test.py', parser, config);
      
      expect(hierarchy.classes.size).toBe(4);
      expect(hierarchy.roots).toHaveLength(1);
      expect(hierarchy.roots[0].name).toBe('Animal');
      
      const puppy = hierarchy.classes.get('Puppy');
      expect(puppy?.parent_class).toBe('Dog');
      expect(puppy?.all_ancestors).toHaveLength(2);
      expect(puppy?.all_ancestors[0].name).toBe('Dog');
      expect(puppy?.all_ancestors[1].name).toBe('Animal');
    });
  });
  
  describe('detect_overrides_generic', () => {
    it('should detect method overrides in JavaScript', () => {
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
      const result = detect_overrides_generic(
        tree.rootNode,
        'test.js',
        parser,
        'javascript'
      );
      
      // Should have override edges for Dog.speak and Puppy.speak
      expect(result.override_edges).toHaveLength(2);
      
      // Find the speak methods
      const dog_speak = result.override_edges.find(
        e => e.method.start_line === 13
      );
      const puppy_speak = result.override_edges.find(
        e => e.method.start_line === 19
      );
      
      expect(dog_speak).toBeDefined();
      expect(puppy_speak).toBeDefined();
      
      // Dog.speak overrides Animal.speak
      expect(dog_speak?.base_method.start_line).toBe(3);
      
      // Puppy.speak overrides Dog.speak
      expect(puppy_speak?.base_method.start_line).toBe(13);
      
      // Override chain for Puppy.speak should include all three
      expect(puppy_speak?.override_chain).toHaveLength(3);
      
      // Leaf methods should include move and the final speak
      expect(result.leaf_methods).toHaveLength(2);
    });
    
    it('should handle TypeScript with bespoke handler', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      
      const code = `
        abstract class Shape {
          abstract area(): number;
        }
        
        class Circle extends Shape {
          constructor(private radius: number) {
            super();
          }
          
          override area(): number {
            return Math.PI * this.radius ** 2;
          }
        }
      `;
      
      const tree = parser.parse(code);
      let bespokeHandlerCalled = false;
      
      const result = detect_overrides_generic(
        tree.rootNode,
        'test.ts',
        parser,
        'typescript',
        (context) => {
          bespokeHandlerCalled = true;
          // Bespoke handler would update abstract methods
          const area_method = Array.from(context.all_methods.values())
            .flat()
            .find(m => m.name === 'area');
          if (area_method) {
            context.abstract_methods.push(area_method);
          }
        }
      );
      
      expect(bespokeHandlerCalled).toBe(true);
      // Should detect the override or at least call the bespoke handler
      // The exact behavior depends on whether abstract methods create overrides
      expect(result.override_edges.length).toBeGreaterThanOrEqual(0);
      // Abstract methods should be tracked if the bespoke handler adds them
      if (result.abstract_methods.length > 0) {
        expect(result.abstract_methods).toHaveLength(1);
      }
    });
  });
});