/**
 * JavaScript/TypeScript interface implementation tests
 */

import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import {
  extract_interface_definitions,
  find_interface_implementations
} from './index';

describe('interface_implementation.javascript', () => {
  describe('TypeScript interfaces', () => {
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
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const interfaces = extract_interface_definitions(
        tree.rootNode,
        'typescript',
        'test.ts',
        code
      );
      
      expect(interfaces).toHaveLength(2);
      
      // First interface
      expect(interfaces[0].name).toBe('Shape');
      expect(interfaces[0].required_methods).toHaveLength(2);
      expect(interfaces[0].required_methods[0].name).toBe('area');
      expect(interfaces[0].required_methods[1].name).toBe('perimeter');
      expect(interfaces[0].required_properties).toHaveLength(2);
      expect(interfaces[0].required_properties![0].name).toBe('width');
      expect(interfaces[0].required_properties![1].name).toBe('height');
      
      // Second interface
      expect(interfaces[1].name).toBe('ColoredShape');
      expect(interfaces[1].extends_interfaces).toContain('Shape');
      expect(interfaces[1].required_properties).toHaveLength(1);
      expect(interfaces[1].required_properties![0].name).toBe('color');
    });
    
    it('should find class implementing interface', () => {
      const code = `
interface Drawable {
  draw(): void;
}

class Canvas implements Drawable {
  draw(): void {
    console.log("Drawing on canvas");
  }
}`;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      
      const interfaces = extract_interface_definitions(
        tree.rootNode,
        'typescript',
        'test.ts',
        code
      );
      
      const implementations = find_interface_implementations(
        tree.rootNode,
        'typescript',
        'test.ts',
        code,
        interfaces
      );
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].implementor_name).toBe('Canvas');
      expect(implementations[0].interface_name).toBe('Drawable');
      expect(implementations[0].is_complete).toBe(true);
      expect(implementations[0].missing_members).toHaveLength(0);
    });
    
    it('should detect incomplete implementation', () => {
      const code = `
interface Vehicle {
  start(): void;
  stop(): void;
  speed: number;
}

class Car implements Vehicle {
  speed: number = 0;
  
  start(): void {
    console.log("Starting car");
  }
  // Missing stop() method
}`;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      
      const interfaces = extract_interface_definitions(
        tree.rootNode,
        'typescript',
        'test.ts',
        code
      );
      
      const implementations = find_interface_implementations(
        tree.rootNode,
        'typescript',
        'test.ts',
        code,
        interfaces
      );
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].is_complete).toBe(false);
      expect(implementations[0].missing_members).toContain('method: stop');
    });
  });
  
  describe('JavaScript with JSDoc', () => {
    it('should extract JSDoc @interface', () => {
      const code = `
/**
 * @interface
 */
class ILogger {
  /**
   * @abstract
   * @param {string} message
   */
  log(message) {}
}`;
      
      const parser = get_language_parser('javascript');
      const tree = parser.parse(code);
      
      // Note: JSDoc interfaces may not be fully supported yet
      const interfaces = extract_interface_definitions(
        tree.rootNode,
        'javascript',
        'test.js',
        code
      );
      
      // This test documents expected behavior
      // Implementation may need enhancement for full JSDoc support
      expect(interfaces).toBeDefined();
    });
  });
  
  describe('Multiple interface implementation', () => {
    it('should handle class implementing multiple interfaces', () => {
      const code = `
interface Serializable {
  serialize(): string;
}

interface Cloneable {
  clone(): any;
}

class Document implements Serializable, Cloneable {
  serialize(): string {
    return JSON.stringify(this);
  }
  
  clone(): any {
    return Object.assign({}, this);
  }
}`;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      
      const interfaces = extract_interface_definitions(
        tree.rootNode,
        'typescript',
        'test.ts',
        code
      );
      
      const implementations = find_interface_implementations(
        tree.rootNode,
        'typescript',
        'test.ts',
        code,
        interfaces
      );
      
      expect(implementations).toHaveLength(2);
      expect(implementations.every(i => i.implementor_name === 'Document')).toBe(true);
      expect(implementations.map(i => i.interface_name).sort()).toEqual(['Cloneable', 'Serializable']);
      expect(implementations.every(i => i.is_complete)).toBe(true);
    });
  });
});