/**
 * JavaScript/TypeScript interface implementation tests
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import {
  extract_javascript_interface_definitions,
  find_javascript_interface_implementations,
  check_structural_implementation
} from './interface_implementation.javascript';

describe('interface_implementation.javascript', () => {
  describe('TypeScript interfaces', () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
    
    it('should extract interface definitions', () => {
      const code = `
interface Shape {
  area(): number;
  perimeter(): number;
  width: number;
  height: number;
}

interface ColoredShape extends Shape {
  color: string;
}`;
      
      const tree = parser.parse(code);
      const interfaces = extract_javascript_interface_definitions(
        tree.rootNode,
        parser,
        code,
        'test.ts'
      );
      
      expect(interfaces).toHaveLength(2);
      
      // First interface
      expect(interfaces[0].definition.name).toBe('Shape');
      expect(interfaces[0].required_methods).toHaveLength(2);
      expect(interfaces[0].required_methods[0].name).toBe('area');
      expect(interfaces[0].required_methods[1].name).toBe('perimeter');
      expect(interfaces[0].required_properties).toHaveLength(2);
      expect(interfaces[0].required_properties![0].name).toBe('width');
      expect(interfaces[0].required_properties![1].name).toBe('height');
      
      // Second interface with extends
      expect(interfaces[1].definition.name).toBe('ColoredShape');
      expect(interfaces[1].extends_interfaces).toContain('Shape');
      expect(interfaces[1].required_properties).toHaveLength(1);
      expect(interfaces[1].required_properties![0].name).toBe('color');
    });
    
    it('should find class implementations', () => {
      const code = `
interface Shape {
  area(): number;
  width: number;
}

class Rectangle implements Shape {
  width: number = 10;
  height: number = 20;
  
  area(): number {
    return this.width * this.height;
  }
}

class Square implements Shape {
  width: number = 5;
  
  area(): number {
    return this.width * this.width;
  }
}`;
      
      const tree = parser.parse(code);
      const interfaces = extract_javascript_interface_definitions(
        tree.rootNode,
        parser,
        code,
        'test.ts'
      );
      
      const implementations = find_javascript_interface_implementations(
        tree.rootNode,
        parser,
        code,
        'test.ts',
        interfaces
      );
      
      expect(implementations).toHaveLength(2);
      
      // Rectangle implementation
      expect(implementations[0].implementor.name).toBe('Rectangle');
      expect(implementations[0].is_complete).toBe(true);
      expect(implementations[0].missing_members).toHaveLength(0);
      expect(implementations[0].implemented_methods.has('area')).toBe(true);
      expect(implementations[0].implemented_properties?.has('width')).toBe(true);
      
      // Square implementation
      expect(implementations[1].implementor.name).toBe('Square');
      expect(implementations[1].is_complete).toBe(true);
      expect(implementations[1].missing_members).toHaveLength(0);
    });
    
    it('should detect incomplete implementations', () => {
      const code = `
interface Shape {
  area(): number;
  perimeter(): number;
}

class PartialShape implements Shape {
  area(): number {
    return 0;
  }
  // Missing perimeter method
}`;
      
      const tree = parser.parse(code);
      const interfaces = extract_javascript_interface_definitions(
        tree.rootNode,
        parser,
        code,
        'test.ts'
      );
      
      const implementations = find_javascript_interface_implementations(
        tree.rootNode,
        parser,
        code,
        'test.ts',
        interfaces
      );
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].is_complete).toBe(false);
      expect(implementations[0].missing_members).toContain('method: perimeter');
    });
    
    it('should handle multiple interface implementations', () => {
      const code = `
interface Drawable {
  draw(): void;
}

interface Resizable {
  resize(scale: number): void;
}

class Shape implements Drawable, Resizable {
  draw(): void {
    console.log("Drawing");
  }
  
  resize(scale: number): void {
    console.log("Resizing by", scale);
  }
}`;
      
      const tree = parser.parse(code);
      const interfaces = extract_javascript_interface_definitions(
        tree.rootNode,
        parser,
        code,
        'test.ts'
      );
      
      const implementations = find_javascript_interface_implementations(
        tree.rootNode,
        parser,
        code,
        'test.ts',
        interfaces
      );
      
      expect(implementations).toHaveLength(2);
      
      const drawableImpl = implementations.find(
        i => i.interface_def.definition.name === 'Drawable'
      );
      expect(drawableImpl).toBeDefined();
      expect(drawableImpl!.is_complete).toBe(true);
      
      const resizableImpl = implementations.find(
        i => i.interface_def.definition.name === 'Resizable'
      );
      expect(resizableImpl).toBeDefined();
      expect(resizableImpl!.is_complete).toBe(true);
    });
    
    it('should handle interface inheritance', () => {
      const code = `
interface Animal {
  name: string;
  eat(): void;
}

interface Mammal extends Animal {
  furColor: string;
  nurse(): void;
}`;
      
      const tree = parser.parse(code);
      const interfaces = extract_javascript_interface_definitions(
        tree.rootNode,
        parser,
        code,
        'test.ts'
      );
      
      const mammal = interfaces.find(i => i.definition.name === 'Mammal');
      expect(mammal).toBeDefined();
      expect(mammal!.extends_interfaces).toContain('Animal');
      expect(mammal!.required_properties).toHaveLength(1);
      expect(mammal!.required_properties![0].name).toBe('furColor');
      expect(mammal!.required_methods).toHaveLength(1);
      expect(mammal!.required_methods[0].name).toBe('nurse');
    });
  });
  
  describe('structural implementation checking', () => {
    it('should detect structural compliance', () => {
      const interface_def = {
        definition: {
          name: 'Duck',
          symbol_id: 'test.ts:Duck',
          symbol_kind: 'interface' as const,
          file_path: 'test.ts',
          range: {
            start: { row: 0, column: 0 },
            end: { row: 3, column: 1 }
          }
        },
        required_methods: [
          { name: 'quack', parameters: [], return_type: 'void' },
          { name: 'swim', parameters: [], return_type: 'void' }
        ],
        required_properties: [
          { name: 'feathers', type: 'boolean' }
        ],
        extends_interfaces: [],
        language: 'typescript'
      };
      
      const class_def = {
        name: 'MallardDuck',
        symbol_id: 'test.ts:MallardDuck',
        symbol_kind: 'class' as const,
        file_path: 'test.ts',
        range: {
          start: { row: 5, column: 0 },
          end: { row: 10, column: 1 }
        }
      };
      
      const class_methods = [
        {
          name: 'quack',
          symbol_id: 'test.ts:MallardDuck.quack',
          symbol_kind: 'method' as const,
          file_path: 'test.ts',
          range: {
            start: { row: 6, column: 2 },
            end: { row: 6, column: 30 }
          }
        },
        {
          name: 'swim',
          symbol_id: 'test.ts:MallardDuck.swim',
          symbol_kind: 'method' as const,
          file_path: 'test.ts',
          range: {
            start: { row: 7, column: 2 },
            end: { row: 7, column: 30 }
          }
        }
      ];
      
      const class_properties = [
        {
          name: 'feathers',
          symbol_id: 'test.ts:MallardDuck.feathers',
          symbol_kind: 'property' as const,
          file_path: 'test.ts',
          range: {
            start: { row: 8, column: 2 },
            end: { row: 8, column: 25 }
          }
        }
      ];
      
      const result = check_structural_implementation(
        class_def,
        interface_def,
        class_methods,
        class_properties
      );
      
      expect(result).toBe(true);
    });
    
    it('should detect structural non-compliance', () => {
      const interface_def = {
        definition: {
          name: 'Duck',
          symbol_id: 'test.ts:Duck',
          symbol_kind: 'interface' as const,
          file_path: 'test.ts',
          range: {
            start: { row: 0, column: 0 },
            end: { row: 3, column: 1 }
          }
        },
        required_methods: [
          { name: 'quack', parameters: [], return_type: 'void' },
          { name: 'fly', parameters: [], return_type: 'void' }
        ],
        extends_interfaces: [],
        language: 'typescript'
      };
      
      const class_def = {
        name: 'RubberDuck',
        symbol_id: 'test.ts:RubberDuck',
        symbol_kind: 'class' as const,
        file_path: 'test.ts',
        range: {
          start: { row: 5, column: 0 },
          end: { row: 10, column: 1 }
        }
      };
      
      const class_methods = [
        {
          name: 'quack',
          symbol_id: 'test.ts:RubberDuck.quack',
          symbol_kind: 'method' as const,
          file_path: 'test.ts',
          range: {
            start: { row: 6, column: 2 },
            end: { row: 6, column: 30 }
          }
        }
        // Missing 'fly' method
      ];
      
      const result = check_structural_implementation(
        class_def,
        interface_def,
        class_methods
      );
      
      expect(result).toBe(false);
    });
  });
});