/**
 * Language-specific integration tests for method hierarchy resolution
 * 
 * Tests that the enrichment works correctly for JavaScript, TypeScript, Python, and Rust
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { find_method_calls, enrich_method_calls_with_hierarchy } from './index';
import { MethodCallContext } from './method_calls';
import { ClassHierarchy, ClassInfo } from '../../inheritance/class_hierarchy';
import { Def } from '@ariadnejs/types';

describe('method hierarchy language integration', () => {
  describe('JavaScript', () => {
    it('should enrich ES6 class inheritance', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `
class Animal {
  speak() { return "sound"; }
  move() { return "moving"; }
}

class Dog extends Animal {
  speak() { return "woof"; }
  wagTail() { return "wagging"; }
}

const dog = new Dog();
dog.speak();
dog.move();
dog.wagTail();`;
      
      const tree = parser.parse(source);
      
      // Extract method calls
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.js',
        source_code: source,
        language: 'javascript'
      };
      
      const method_calls = find_method_calls(context);
      
      // Create mock hierarchy
      const hierarchy = create_js_hierarchy();
      
      // Create type info mapping 'dog' to 'Dog'
      const type_info = new Map<string, string>();
      type_info.set('dog', 'Dog');
      
      // Enrich with hierarchy
      const enriched = enrich_method_calls_with_hierarchy(method_calls, hierarchy, type_info);
      
      // Verify enrichment
      const speak_call = enriched.find(c => c.method_name === 'speak');
      expect(speak_call?.defining_class_resolved).toBe('Dog');
      expect(speak_call?.is_override).toBe(true);
      
      const move_call = enriched.find(c => c.method_name === 'move');
      expect(move_call?.defining_class_resolved).toBe('Animal');
      expect(move_call?.is_override).toBe(false);
      
      const wagTail_call = enriched.find(c => c.method_name === 'wagTail');
      expect(wagTail_call?.defining_class_resolved).toBe('Dog');
      expect(wagTail_call?.is_override).toBe(false);
    });

    function create_js_hierarchy(): ClassHierarchy {
      const animal_def: Def = {
        symbol_id: 'Animal',
        symbol_name: 'Animal',
        symbol_kind: 'class',
        file_path: 'test.js',
        range: { start: { line: 1, column: 0 }, end: { line: 4, column: 1 } },
        members: [
          {
            symbol_id: 'Animal.speak',
            symbol_name: 'speak',
            symbol_kind: 'method',
            file_path: 'test.js',
            range: { start: { line: 2, column: 2 }, end: { line: 2, column: 30 } }
          },
          {
            symbol_id: 'Animal.move',
            symbol_name: 'move',
            symbol_kind: 'method',
            file_path: 'test.js',
            range: { start: { line: 3, column: 2 }, end: { line: 3, column: 30 } }
          }
        ]
      };
      
      const dog_def: Def = {
        symbol_id: 'Dog',
        symbol_name: 'Dog',
        symbol_kind: 'class',
        file_path: 'test.js',
        range: { start: { line: 6, column: 0 }, end: { line: 9, column: 1 } },
        members: [
          {
            symbol_id: 'Dog.speak',
            symbol_name: 'speak',
            symbol_kind: 'method',
            file_path: 'test.js',
            range: { start: { line: 7, column: 2 }, end: { line: 7, column: 30 } }
          },
          {
            symbol_id: 'Dog.wagTail',
            symbol_name: 'wagTail',
            symbol_kind: 'method',
            file_path: 'test.js',
            range: { start: { line: 8, column: 2 }, end: { line: 8, column: 35 } }
          }
        ]
      };
      
      const hierarchy: ClassHierarchy = {
        classes: new Map(),
        edges: [],
        roots: [animal_def],
        language: 'javascript'
      };
      
      const animal_info: ClassInfo = {
        definition: animal_def,
        implemented_interfaces: [],
        interface_defs: [],
        subclasses: [dog_def],
        all_ancestors: [],
        all_descendants: [dog_def],
        method_resolution_order: [animal_def]
      };
      
      const dog_info: ClassInfo = {
        definition: dog_def,
        parent_class: 'Animal',
        parent_class_def: animal_def,
        implemented_interfaces: [],
        interface_defs: [],
        subclasses: [],
        all_ancestors: [animal_def],
        all_descendants: [],
        method_resolution_order: [dog_def, animal_def]
      };
      
      hierarchy.classes.set('Animal', animal_info);
      hierarchy.classes.set('Dog', dog_info);
      
      return hierarchy;
    }
  });

  describe('TypeScript', () => {
    it('should enrich interface implementations', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      
      const source = `
interface ILogger {
  log(message: string): void;
}

class ConsoleLogger implements ILogger {
  log(message: string): void {
    console.log(message);
  }
  
  debug(message: string): void {
    console.debug(message);
  }
}

const logger: ILogger = new ConsoleLogger();
logger.log("test");`;
      
      const tree = parser.parse(source);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.ts',
        source_code: source,
        language: 'typescript'
      };
      
      const method_calls = find_method_calls(context);
      
      // Create mock hierarchy with interface
      const hierarchy = create_ts_hierarchy();
      
      // Create type info
      const type_info = new Map<string, string>();
      type_info.set('logger', 'ConsoleLogger');
      
      // Enrich with hierarchy
      const enriched = enrich_method_calls_with_hierarchy(method_calls, hierarchy, type_info);
      
      // Verify interface method detection
      const log_call = enriched.find(c => c.method_name === 'log' && c.receiver_name === 'logger');
      expect(log_call?.is_interface_method).toBe(true);
      expect(log_call?.defining_class_resolved).toBe('ILogger');
    });

    function create_ts_hierarchy(): ClassHierarchy {
      const ilogger_def: Def = {
        symbol_id: 'ILogger',
        symbol_name: 'ILogger',
        symbol_kind: 'interface',
        file_path: 'test.ts',
        range: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
        members: [
          {
            symbol_id: 'ILogger.log',
            symbol_name: 'log',
            symbol_kind: 'method',
            file_path: 'test.ts',
            range: { start: { line: 2, column: 2 }, end: { line: 2, column: 30 } }
          }
        ]
      };
      
      const console_logger_def: Def = {
        symbol_id: 'ConsoleLogger',
        symbol_name: 'ConsoleLogger',
        symbol_kind: 'class',
        file_path: 'test.ts',
        range: { start: { line: 5, column: 0 }, end: { line: 12, column: 1 } },
        members: [
          {
            symbol_id: 'ConsoleLogger.log',
            symbol_name: 'log',
            symbol_kind: 'method',
            file_path: 'test.ts',
            range: { start: { line: 6, column: 2 }, end: { line: 8, column: 3 } }
          },
          {
            symbol_id: 'ConsoleLogger.debug',
            symbol_name: 'debug',
            symbol_kind: 'method',
            file_path: 'test.ts',
            range: { start: { line: 10, column: 2 }, end: { line: 12, column: 3 } }
          }
        ]
      };
      
      const hierarchy: ClassHierarchy = {
        classes: new Map(),
        edges: [],
        roots: [ilogger_def, console_logger_def],
        language: 'typescript'
      };
      
      const ilogger_info: ClassInfo = {
        definition: ilogger_def,
        implemented_interfaces: [],
        interface_defs: [],
        subclasses: [],
        all_ancestors: [],
        all_descendants: [],
        method_resolution_order: [ilogger_def]
      };
      
      const console_logger_info: ClassInfo = {
        definition: console_logger_def,
        implemented_interfaces: ['ILogger'],
        interface_defs: [ilogger_def],
        subclasses: [],
        all_ancestors: [],
        all_descendants: [],
        method_resolution_order: [console_logger_def]
      };
      
      hierarchy.classes.set('ILogger', ilogger_info);
      hierarchy.classes.set('ConsoleLogger', console_logger_info);
      
      return hierarchy;
    }
  });

  describe('Python', () => {
    it('should handle multiple inheritance and super calls', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `
class Base:
    def method(self):
        return "base"

class Mixin:
    def helper(self):
        return "mixin"

class Derived(Base, Mixin):
    def method(self):
        super().method()
        return "derived"
    
    def use_helper(self):
        self.helper()

d = Derived()
d.method()
d.helper()`;
      
      const tree = parser.parse(source);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.py',
        source_code: source,
        language: 'python'
      };
      
      const method_calls = find_method_calls(context);
      
      // Create Python hierarchy with multiple inheritance
      const hierarchy = create_python_hierarchy();
      
      // Create type info
      const type_info = new Map<string, string>();
      type_info.set('d', 'Derived');
      
      // Enrich with hierarchy
      const enriched = enrich_method_calls_with_hierarchy(method_calls, hierarchy, type_info);
      
      // Verify multiple inheritance resolution
      const helper_call = enriched.find(c => 
        c.method_name === 'helper' && c.receiver_name === 'd'
      );
      expect(helper_call?.defining_class_resolved).toBe('Mixin');
      
      // Verify override detection
      const method_call = enriched.find(c => 
        c.method_name === 'method' && c.receiver_name === 'd'
      );
      expect(method_call?.defining_class_resolved).toBe('Derived');
      expect(method_call?.is_override).toBe(true);
    });

    function create_python_hierarchy(): ClassHierarchy {
      const base_def: Def = {
        symbol_id: 'Base',
        symbol_name: 'Base',
        symbol_kind: 'class',
        file_path: 'test.py',
        range: { start: { line: 1, column: 0 }, end: { line: 3, column: 20 } },
        members: [
          {
            symbol_id: 'Base.method',
            symbol_name: 'method',
            symbol_kind: 'method',
            file_path: 'test.py',
            range: { start: { line: 2, column: 4 }, end: { line: 3, column: 20 } }
          }
        ]
      };
      
      const mixin_def: Def = {
        symbol_id: 'Mixin',
        symbol_name: 'Mixin',
        symbol_kind: 'class',
        file_path: 'test.py',
        range: { start: { line: 5, column: 0 }, end: { line: 7, column: 21 } },
        members: [
          {
            symbol_id: 'Mixin.helper',
            symbol_name: 'helper',
            symbol_kind: 'method',
            file_path: 'test.py',
            range: { start: { line: 6, column: 4 }, end: { line: 7, column: 21 } }
          }
        ]
      };
      
      const derived_def: Def = {
        symbol_id: 'Derived',
        symbol_name: 'Derived',
        symbol_kind: 'class',
        file_path: 'test.py',
        range: { start: { line: 9, column: 0 }, end: { line: 15, column: 22 } },
        members: [
          {
            symbol_id: 'Derived.method',
            symbol_name: 'method',
            symbol_kind: 'method',
            file_path: 'test.py',
            range: { start: { line: 10, column: 4 }, end: { line: 12, column: 24 } }
          },
          {
            symbol_id: 'Derived.use_helper',
            symbol_name: 'use_helper',
            symbol_kind: 'method',
            file_path: 'test.py',
            range: { start: { line: 14, column: 4 }, end: { line: 15, column: 22 } }
          }
        ]
      };
      
      const hierarchy: ClassHierarchy = {
        classes: new Map(),
        edges: [],
        roots: [base_def, mixin_def],
        language: 'python'
      };
      
      const base_info: ClassInfo = {
        definition: base_def,
        implemented_interfaces: [],
        interface_defs: [],
        subclasses: [derived_def],
        all_ancestors: [],
        all_descendants: [derived_def],
        method_resolution_order: [base_def]
      };
      
      const mixin_info: ClassInfo = {
        definition: mixin_def,
        implemented_interfaces: [],
        interface_defs: [],
        subclasses: [derived_def],
        all_ancestors: [],
        all_descendants: [derived_def],
        method_resolution_order: [mixin_def]
      };
      
      const derived_info: ClassInfo = {
        definition: derived_def,
        parent_class: 'Base',
        parent_class_def: base_def,
        implemented_interfaces: [],
        interface_defs: [],
        subclasses: [],
        all_ancestors: [base_def, mixin_def],
        all_descendants: [],
        method_resolution_order: [derived_def, base_def, mixin_def] // Python MRO
      };
      
      hierarchy.classes.set('Base', base_info);
      hierarchy.classes.set('Mixin', mixin_info);
      hierarchy.classes.set('Derived', derived_info);
      
      return hierarchy;
    }
  });

  describe('Rust', () => {
    it('should handle trait implementations', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = `
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

impl Point {
    fn distance(&self) -> f64 {
        ((self.x * self.x + self.y * self.y) as f64).sqrt()
    }
}

let p = Point { x: 3, y: 4 };
p.fmt();
p.distance();`;
      
      const tree = parser.parse(source);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        source_code: source,
        language: 'rust'
      };
      
      const method_calls = find_method_calls(context);
      
      // Create Rust hierarchy with trait
      const hierarchy = create_rust_hierarchy();
      
      // Create type info
      const type_info = new Map<string, string>();
      type_info.set('p', 'Point');
      
      // Enrich with hierarchy
      const enriched = enrich_method_calls_with_hierarchy(method_calls, hierarchy, type_info);
      
      // Verify trait method resolution
      const fmt_call = enriched.find(c => c.method_name === 'fmt');
      expect(fmt_call?.defining_class_resolved).toBe('Display');
      expect(fmt_call?.is_interface_method).toBe(true);
      
      // Verify inherent method resolution
      const distance_call = enriched.find(c => c.method_name === 'distance');
      expect(distance_call?.defining_class_resolved).toBe('Point');
      expect(distance_call?.is_interface_method).toBe(false);
    });

    function create_rust_hierarchy(): ClassHierarchy {
      const display_def: Def = {
        symbol_id: 'Display',
        symbol_name: 'Display',
        symbol_kind: 'trait',
        file_path: 'test.rs',
        range: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
        members: [
          {
            symbol_id: 'Display.fmt',
            symbol_name: 'fmt',
            symbol_kind: 'method',
            file_path: 'test.rs',
            range: { start: { line: 2, column: 4 }, end: { line: 2, column: 29 } }
          }
        ]
      };
      
      const point_def: Def = {
        symbol_id: 'Point',
        symbol_name: 'Point',
        symbol_kind: 'struct',
        file_path: 'test.rs',
        range: { start: { line: 5, column: 0 }, end: { line: 8, column: 1 } },
        members: [
          {
            symbol_id: 'Point.fmt',
            symbol_name: 'fmt',
            symbol_kind: 'method',
            file_path: 'test.rs',
            range: { start: { line: 11, column: 4 }, end: { line: 13, column: 5 } }
          },
          {
            symbol_id: 'Point.distance',
            symbol_name: 'distance',
            symbol_kind: 'method',
            file_path: 'test.rs',
            range: { start: { line: 17, column: 4 }, end: { line: 19, column: 5 } }
          }
        ]
      };
      
      const hierarchy: ClassHierarchy = {
        classes: new Map(),
        edges: [],
        roots: [display_def, point_def],
        language: 'rust'
      };
      
      const display_info: ClassInfo = {
        definition: display_def,
        implemented_interfaces: [],
        interface_defs: [],
        subclasses: [],
        all_ancestors: [],
        all_descendants: [],
        method_resolution_order: [display_def]
      };
      
      const point_info: ClassInfo = {
        definition: point_def,
        implemented_interfaces: ['Display'],
        interface_defs: [display_def],
        subclasses: [],
        all_ancestors: [],
        all_descendants: [],
        method_resolution_order: [point_def]
      };
      
      hierarchy.classes.set('Display', display_info);
      hierarchy.classes.set('Point', point_info);
      
      return hierarchy;
    }
  });
});