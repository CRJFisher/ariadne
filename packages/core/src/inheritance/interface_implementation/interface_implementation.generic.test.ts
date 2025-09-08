/**
 * Tests for Generic Interface Implementation Processor
 */

import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import {
  extract_interfaces_generic,
  find_implementations_generic,
  InterfaceProcessingContext
} from './interface_implementation.generic';
import { get_interface_config } from './language_configs';

describe('Generic Interface Implementation Processor', () => {
  describe('TypeScript Interface Extraction', () => {
    it('should extract basic interface definition', () => {
      const code = `
        interface User {
          id: number;
          name: string;
          isActive(): boolean;
        }
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const config = get_interface_config('typescript')!;
      
      const context: InterfaceProcessingContext = {
        language: 'typescript',
        file_path: 'test.ts',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('User');
      expect(interfaces[0].required_methods).toHaveLength(1);
      expect(interfaces[0].required_methods[0].name).toBe('isActive');
      expect(interfaces[0].required_properties).toHaveLength(2);
      expect(interfaces[0].required_properties![0].name).toBe('id');
      expect(interfaces[0].required_properties![1].name).toBe('name');
    });
    
    it('should extract interface with extends', () => {
      const code = `
        interface Animal {
          name: string;
        }
        
        interface Dog extends Animal {
          breed: string;
          bark(): void;
        }
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const config = get_interface_config('typescript')!;
      
      const context: InterfaceProcessingContext = {
        language: 'typescript',
        file_path: 'test.ts',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      
      expect(interfaces).toHaveLength(2);
      const dogInterface = interfaces.find(i => i.name === 'Dog');
      expect(dogInterface).toBeDefined();
      expect(dogInterface?.extends_interfaces).toContain('Animal');
    });
  });
  
  describe('TypeScript Implementation Detection', () => {
    it('should find class implementing interface', () => {
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
      const config = get_interface_config('typescript')!;
      
      const context: InterfaceProcessingContext = {
        language: 'typescript',
        file_path: 'test.ts',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      const implementations = find_implementations_generic(tree.rootNode, interfaces, context);
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].implementor_name).toBe('Bird');
      expect(implementations[0].interface_name).toBe('Flyable');
      expect(implementations[0].is_complete).toBe(true);
      expect(implementations[0].missing_members).toHaveLength(0);
    });
    
    it('should detect incomplete implementation', () => {
      const code = `
        interface Shape {
          area(): number;
          perimeter(): number;
        }
        
        class Circle implements Shape {
          area(): number {
            return Math.PI * 10 * 10;
          }
          // Missing perimeter method
        }
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const config = get_interface_config('typescript')!;
      
      const context: InterfaceProcessingContext = {
        language: 'typescript',
        file_path: 'test.ts',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      const implementations = find_implementations_generic(tree.rootNode, interfaces, context);
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].is_complete).toBe(false);
      expect(implementations[0].missing_members).toContain('method: perimeter');
    });
  });
  
  describe('Python Protocol Extraction', () => {
    it('should extract Protocol definition', () => {
      const code = `
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None:
        ...
    
    def get_color(self) -> str:
        ...
`;
      
      const parser = get_language_parser('python');
      const tree = parser.parse(code);
      const config = get_interface_config('python')!;
      
      const context: InterfaceProcessingContext = {
        language: 'python',
        file_path: 'test.py',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('Drawable');
      expect(interfaces[0].required_methods).toHaveLength(2);
      expect(interfaces[0].required_methods[0].name).toBe('draw');
      expect(interfaces[0].required_methods[1].name).toBe('get_color');
    });
    
    it('should extract ABC definition', () => {
      const code = `
from abc import ABC, abstractmethod

class Vehicle(ABC):
    @abstractmethod
    def start(self):
        pass
    
    @abstractmethod
    def stop(self):
        pass
`;
      
      const parser = get_language_parser('python');
      const tree = parser.parse(code);
      const config = get_interface_config('python')!;
      
      const context: InterfaceProcessingContext = {
        language: 'python',
        file_path: 'test.py',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('Vehicle');
      expect(interfaces[0].required_methods).toHaveLength(2);
      expect(interfaces[0].required_methods.some(m => m.name === 'start' && m.is_abstract)).toBe(true);
      expect(interfaces[0].required_methods.some(m => m.name === 'stop' && m.is_abstract)).toBe(true);
    });
  });
  
  describe('Python Implementation Detection', () => {
    it('should find class implementing Protocol', () => {
      const code = `
from typing import Protocol

class Printable(Protocol):
    def print(self) -> None:
        ...

class Document(Printable):
    def print(self) -> None:
        print("Printing document")
`;
      
      const parser = get_language_parser('python');
      const tree = parser.parse(code);
      const config = get_interface_config('python')!;
      
      const context: InterfaceProcessingContext = {
        language: 'python',
        file_path: 'test.py',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      const implementations = find_implementations_generic(tree.rootNode, interfaces, context);
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].implementor_name).toBe('Document');
      expect(implementations[0].interface_name).toBe('Printable');
      expect(implementations[0].is_complete).toBe(true);
    });
  });
  
  describe('Rust Trait Extraction', () => {
    it('should extract trait definition', () => {
      const code = `
trait Display {
    fn fmt(&self) -> String;
}

trait Debug {
    fn debug(&self);
}
`;
      
      const parser = get_language_parser('rust');
      const tree = parser.parse(code);
      const config = get_interface_config('rust')!;
      
      const context: InterfaceProcessingContext = {
        language: 'rust',
        file_path: 'test.rs',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      
      expect(interfaces).toHaveLength(2);
      expect(interfaces[0].name).toBe('Display');
      expect(interfaces[0].required_methods).toHaveLength(1);
      expect(interfaces[0].required_methods[0].name).toBe('fmt');
      expect(interfaces[1].name).toBe('Debug');
    });
    
    it('should extract trait with supertrait', () => {
      const code = `
trait Animal {
    fn name(&self) -> &str;
}

trait Dog: Animal {
    fn bark(&self);
}
`;
      
      const parser = get_language_parser('rust');
      const tree = parser.parse(code);
      const config = get_interface_config('rust')!;
      
      const context: InterfaceProcessingContext = {
        language: 'rust',
        file_path: 'test.rs',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      
      const dogTrait = interfaces.find(i => i.name === 'Dog');
      expect(dogTrait).toBeDefined();
      expect(dogTrait?.extends_interfaces).toContain('Animal');
    });
  });
  
  describe('Rust Implementation Detection', () => {
    it('should find impl blocks for traits', () => {
      const code = `
trait Greet {
    fn hello(&self);
}

struct Person {
    name: String,
}

impl Greet for Person {
    fn hello(&self) {
        println!("Hello, {}", self.name);
    }
}
`;
      
      const parser = get_language_parser('rust');
      const tree = parser.parse(code);
      const config = get_interface_config('rust')!;
      
      const context: InterfaceProcessingContext = {
        language: 'rust',
        file_path: 'test.rs',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      const implementations = find_implementations_generic(tree.rootNode, interfaces, context);
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].implementor_name).toBe('Person');
      expect(implementations[0].interface_name).toBe('Greet');
      expect(implementations[0].is_complete).toBe(true);
    });
    
    it('should detect incomplete trait implementation', () => {
      const code = `
trait Calculator {
    fn add(&self, a: i32, b: i32) -> i32;
    fn subtract(&self, a: i32, b: i32) -> i32;
}

struct SimpleCalc;

impl Calculator for SimpleCalc {
    fn add(&self, a: i32, b: i32) -> i32 {
        a + b
    }
    // Missing subtract method
}
`;
      
      const parser = get_language_parser('rust');
      const tree = parser.parse(code);
      const config = get_interface_config('rust')!;
      
      const context: InterfaceProcessingContext = {
        language: 'rust',
        file_path: 'test.rs',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      const implementations = find_implementations_generic(tree.rootNode, interfaces, context);
      
      expect(implementations).toHaveLength(1);
      expect(implementations[0].is_complete).toBe(false);
      expect(implementations[0].missing_members).toContain('method: subtract');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty interface', () => {
      const code = `interface Empty {}`;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const config = get_interface_config('typescript')!;
      
      const context: InterfaceProcessingContext = {
        language: 'typescript',
        file_path: 'test.ts',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('Empty');
      expect(interfaces[0].required_methods).toHaveLength(0);
      expect(interfaces[0].required_properties).toBeUndefined();
    });
    
    it('should handle multiple implementations', () => {
      const code = `
        interface Movable {
          move(): void;
        }
        
        class Car implements Movable {
          move(): void {}
        }
        
        class Person implements Movable {
          move(): void {}
        }
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const config = get_interface_config('typescript')!;
      
      const context: InterfaceProcessingContext = {
        language: 'typescript',
        file_path: 'test.ts',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      const implementations = find_implementations_generic(tree.rootNode, interfaces, context);
      
      expect(implementations).toHaveLength(2);
      expect(implementations.map(i => i.implementor_name).sort()).toEqual(['Car', 'Person']);
      expect(implementations.every(i => i.interface_name === 'Movable')).toBe(true);
    });
    
    it('should handle class implementing multiple interfaces', () => {
      const code = `
        interface Readable {
          read(): string;
        }
        
        interface Writable {
          write(data: string): void;
        }
        
        class File implements Readable, Writable {
          read(): string { return ""; }
          write(data: string): void {}
        }
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const config = get_interface_config('typescript')!;
      
      const context: InterfaceProcessingContext = {
        language: 'typescript',
        file_path: 'test.ts',
        source_code: code,
        config
      };
      
      const interfaces = extract_interfaces_generic(tree.rootNode, context);
      const implementations = find_implementations_generic(tree.rootNode, interfaces, context);
      
      expect(implementations).toHaveLength(2);
      expect(implementations.every(i => i.implementor_name === 'File')).toBe(true);
      const interfaceNames = implementations.map(i => i.interface_name).sort();
      expect(interfaceNames).toEqual(['Readable', 'Writable']);
    });
  });
});