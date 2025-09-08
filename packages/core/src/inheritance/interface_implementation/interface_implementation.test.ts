/**
 * Integration tests for interface implementation module
 * 
 * Tests the main API functions across different languages
 */

import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import {
  InterfaceDefinition,
  InterfaceImplementation,
  build_interface_implementation_map,
  extract_interface_definitions,
  find_interface_implementations
} from './index';

describe('interface_implementation integration', () => {
  describe('TypeScript interfaces', () => {
    it('should extract interface definitions', () => {
      const code = `
        interface User {
          id: number;
          name: string;
          isActive(): boolean;
        }
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      
      const interfaces = extract_interface_definitions(
        tree.rootNode,
        'typescript',
        'test.ts',
        code
      );
      
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('User');
      expect(interfaces[0].required_methods).toHaveLength(1);
      expect(interfaces[0].required_properties).toHaveLength(2);
    });
    
    it('should find interface implementations', () => {
      const code = `
        interface Flyable {
          fly(): void;
        }
        
        class Bird implements Flyable {
          fly(): void {
            console.log("Flying");
          }
        }
      `;
      
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
      expect(implementations[0].implementor_name).toBe('Bird');
      expect(implementations[0].interface_name).toBe('Flyable');
      expect(implementations[0].is_complete).toBe(true);
    });
  });
  
  describe('build_interface_implementation_map', () => {
    it('should build complete map for mixed language codebase', () => {
      const tsCode = `
interface Shape {
  area(): number;
}

class Circle implements Shape {
  area(): number {
    return Math.PI * 10 * 10;
  }
}`;

      const pyCode = `
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None:
        ...

class Picture:
    def draw(self) -> None:
        print("Drawing picture")
`;
      
      const files = [
        {
          root_node: get_language_parser('typescript').parse(tsCode).rootNode,
          language: 'typescript' as const,
          file_path: 'shapes.ts',
          source_code: tsCode
        },
        {
          root_node: get_language_parser('python').parse(pyCode).rootNode,
          language: 'python' as const,
          file_path: 'drawing.py',
          source_code: pyCode
        }
      ];
      
      const result = build_interface_implementation_map(files);
      
      expect(result.statistics.total_interfaces).toBe(2);
      expect(result.statistics.total_implementations).toBe(1); // Only TypeScript has explicit implementation
      expect(result.statistics.complete_implementations).toBe(1);
      expect(result.statistics.incomplete_implementations).toBe(0);
      expect(result.statistics.coverage_percentage).toBe(100);
      
      expect(result.map.interfaces.has('Shape')).toBe(true);
      expect(result.map.interfaces.has('Drawable')).toBe(true);
      expect(result.map.implementations.get('Shape')).toHaveLength(1);
      expect(result.map.implementations.get('Drawable')).toHaveLength(0); // Python uses structural typing
    });
  });
});