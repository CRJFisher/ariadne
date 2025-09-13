/**
 * Tests for TypeScript-specific bespoke export detection
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import {
  handle_type_exports,
  handle_namespace_exports,
  handle_declaration_merging,
  get_typescript_bespoke_exports
} from './export_detection.typescript';

describe('TypeScript bespoke export detection', () => {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  
  describe('handle_type_exports', () => {
    it('should detect type-only export statements', () => {
      const code = `
export type { MyType } from './types';
export type { Type1, Type2 } from './module';
      `;
      const tree = parser.parse(code);
      const exports = handle_type_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThanOrEqual(3);
      expect(exports.every(e => e.kind === 'type')).toBe(true);
      expect(exports.map(e => e.name)).toContain('MyType');
      expect(exports.map(e => e.name)).toContain('Type1');
      expect(exports.map(e => e.name)).toContain('Type2');
    });
    
    it('should detect type alias exports', () => {
      const code = `
export type StringOrNumber = string | number;
export type Optional<T> = T | undefined;
      `;
      const tree = parser.parse(code);
      const exports = handle_type_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThanOrEqual(2);
      expect(exports.map(e => e.name)).toContain('StringOrNumber');
      expect(exports.map(e => e.name)).toContain('Optional');
      expect(exports.every(e => e.kind === 'type')).toBe(true);
    });
    
    it('should detect type exports with aliases', () => {
      const code = `
export type { OriginalType as RenamedType } from './types';
export type { Type1 as T1, Type2 as T2 } from './module';
      `;
      const tree = parser.parse(code);
      const exports = handle_type_exports(tree.rootNode, code);
      
      const renamed = exports.find(e => e.name === 'RenamedType');
      expect(renamed).toBeDefined();
      expect(renamed?.original_name).toBe('OriginalType');
      
      const t1 = exports.find(e => e.name === 'T1');
      expect(t1).toBeDefined();
      expect(t1?.original_name).toBe('Type1');
    });
    
    it('should handle inline type exports', () => {
      const code = `
export type Result<T> = { success: boolean; data?: T; error?: string };
export type Callback = (value: string) => void;
      `;
      const tree = parser.parse(code);
      const exports = handle_type_exports(tree.rootNode, code);
      
      expect(exports.map(e => e.name)).toContain('Result');
      expect(exports.map(e => e.name)).toContain('Callback');
      expect(exports.every(e => e.source === 'local')).toBe(true);
    });
  });
  
  describe('handle_namespace_exports', () => {
    it('should detect exported namespaces', () => {
      const code = `
export namespace Utils {
  export function helper() {}
  export interface Config {}
}
      `;
      const tree = parser.parse(code);
      const exports = handle_namespace_exports(tree.rootNode, code);
      
      const namespace = exports.find(e => e.name === 'Utils');
      expect(namespace).toBeDefined();
      expect(namespace?.kind).toBe('namespace');
      
      // Should also detect exports within namespace
      expect(exports.some(e => e.name === 'helper')).toBe(true);
      expect(exports.some(e => e.name === 'Config')).toBe(true);
    });
    
    it('should detect module declarations', () => {
      const code = `
export module MyModule {
  export class MyClass {}
  export const constant = 42;
}
      `;
      const tree = parser.parse(code);
      const exports = handle_namespace_exports(tree.rootNode, code);
      
      const module = exports.find(e => e.name === 'MyModule');
      expect(module).toBeDefined();
      expect(module?.kind).toBe('namespace');
      
      // Inner exports
      expect(exports.some(e => e.name === 'MyClass')).toBe(true);
      expect(exports.some(e => e.name === 'constant')).toBe(true);
    });
    
    it('should handle nested namespaces', () => {
      const code = `
export namespace Outer {
  export namespace Inner {
    export function deep_function() {}
  }
}
      `;
      const tree = parser.parse(code);
      const exports = handle_namespace_exports(tree.rootNode, code);
      
      expect(exports.some(e => e.name === 'Outer')).toBe(true);
      expect(exports.some(e => e.name === 'Inner')).toBe(true);
      expect(exports.some(e => e.name === 'deepFunction')).toBe(true);
    });
    
    it('should mark namespace members appropriately', () => {
      const code = `
export namespace API {
  export function request() {}
  export type Response = {};
}
      `;
      const tree = parser.parse(code);
      const exports = handle_namespace_exports(tree.rootNode, code);
      
      const request = exports.find(e => e.name === 'request');
      expect(request?.namespace_export).toBe(true);
      
      const response = exports.find(e => e.name === 'Response');
      expect(response?.namespace_export).toBe(true);
    });
  });
  
  describe('handle_declaration_merging', () => {
    it('should detect merged interface and class', () => {
      const code = `
export interface MyClass {
  prop: string;
}
export class MyClass {
  constructor(public prop: string) {}
}
      `;
      const tree = parser.parse(code);
      const exports = handle_declaration_merging(tree.rootNode, code);
      
      const merged = exports.find(e => e.name === 'MyClass');
      expect(merged).toBeDefined();
      expect(merged?.kind).toBe('merged');
      expect(merged?.merged_kinds).toContain('interface');
      expect(merged?.merged_kinds).toContain('class');
    });
    
    it('should detect multiple interface merging', () => {
      const code = `
export interface Config {
  host: string;
}
export interface Config {
  port: number;
}
export interface Config {
  secure: boolean;
}
      `;
      const tree = parser.parse(code);
      const exports = handle_declaration_merging(tree.rootNode, code);
      
      const config = exports.find(e => e.name === 'Config');
      expect(config).toBeDefined();
      expect(config?.kind).toBe('merged');
      expect(config?.merged_kinds?.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should detect namespace and function merging', () => {
      const code = `
export function my_function() {}
export namespace my_function {
  export const version = '1.0';
}
      `;
      const tree = parser.parse(code);
      const exports = handle_declaration_merging(tree.rootNode, code);
      
      const merged = exports.find(e => e.name === 'MyFunction');
      expect(merged).toBeDefined();
      expect(merged?.merged_kinds).toContain('function');
      expect(merged?.merged_kinds).toContain('namespace');
    });
    
    it('should handle non-merged declarations', () => {
      const code = `
export interface Interface1 {}
export class Class1 {}
export function function1() {}
      `;
      const tree = parser.parse(code);
      const exports = handle_declaration_merging(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      expect(exports.every(e => e.kind !== 'merged')).toBe(true);
    });
  });
  
  describe('get_typescript_bespoke_exports', () => {
    it('should include CommonJS exports', () => {
      const code = `
module.exports = {
  foo: 'bar',
  baz: 42
};
exports.helper = function() {};
      `;
      const tree = parser.parse(code);
      const exports = get_typescript_bespoke_exports(tree.rootNode, code);
      
      // Should detect CommonJS patterns
      expect(exports.length).toBeGreaterThan(0);
      expect(exports.some(e => e.name === 'helper')).toBe(true);
    });
    
    it('should include complex re-exports', () => {
      const code = `
export { default } from './module';
export { default as MyDefault } from './other';
      `;
      const tree = parser.parse(code);
      const exports = get_typescript_bespoke_exports(tree.rootNode, code);
      
      expect(exports.some(e => e.kind === 'default')).toBe(true);
      expect(exports.some(e => e.name === 'MyDefault')).toBe(true);
    });
    
    it('should include dynamic exports', () => {
      const code = `
const key = 'dynamic';
exports[key] = value;
      `;
      const tree = parser.parse(code);
      const exports = get_typescript_bespoke_exports(tree.rootNode, code);
      
      const dynamic = exports.find(e => e.is_dynamic);
      expect(dynamic).toBeDefined();
      expect(dynamic?.name).toBe('<dynamic>');
    });
    
    it('should handle all TypeScript-specific patterns', () => {
      const code = `
// Type exports
export type MyType = string;
export type { External } from './types';

// Namespace exports
export namespace NS {
  export const value = 1;
}

// Declaration merging
export interface Merged {}
export class Merged {}

// CommonJS
module.exports.common = true;
      `;
      const tree = parser.parse(code);
      const exports = get_typescript_bespoke_exports(tree.rootNode, code);
      
      // Should include all patterns
      expect(exports.some(e => e.name === 'MyType')).toBe(true);
      expect(exports.some(e => e.name === 'External')).toBe(true);
      expect(exports.some(e => e.name === 'NS')).toBe(true);
      expect(exports.some(e => e.name === 'Merged')).toBe(true);
      expect(exports.some(e => e.name === 'common')).toBe(true);
    });
  });
  
  describe('edge cases', () => {
    it('should handle ambient module declarations', () => {
      const code = `
declare module 'express' {
  export interface Request {
    user?: User;
  }
}
      `;
      const tree = parser.parse(code);
      const exports = handle_namespace_exports(tree.rootNode, code);
      
      // Ambient modules are different from regular exports
      // This test verifies they don't cause errors
      expect(exports).toBeDefined();
    });
    
    it('should handle type predicates', () => {
      const code = `
export type IsString<T> = T extends string ? true : false;
export type Guard = (value: unknown) => value is string;
      `;
      const tree = parser.parse(code);
      const exports = handle_type_exports(tree.rootNode, code);
      
      expect(exports.map(e => e.name)).toContain('IsString');
      expect(exports.map(e => e.name)).toContain('Guard');
    });
    
    it('should handle conditional types', () => {
      const code = `
export type NonNullable<T> = T extends null | undefined ? never : T;
export type Extract<T, U> = T extends U ? T : never;
      `;
      const tree = parser.parse(code);
      const exports = handle_type_exports(tree.rootNode, code);
      
      expect(exports.map(e => e.name)).toContain('NonNullable');
      expect(exports.map(e => e.name)).toContain('Extract');
    });
    
    it('should handle enum exports', () => {
      const code = `
export enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue'
}
export const enum Direction {
  Up = 1,
  Down,
  Left,
  Right
}
      `;
      const tree = parser.parse(code);
      // Enums should be handled by generic processor, but let's verify no errors
      const exports = get_typescript_bespoke_exports(tree.rootNode, code);
      
      expect(exports).toBeDefined();
    });
    
    it('should handle abstract classes', () => {
      const code = `
export abstract class BaseClass {
  abstract method(): void;
}
      `;
      const tree = parser.parse(code);
      // Abstract classes should be handled by generic processor
      const exports = get_typescript_bespoke_exports(tree.rootNode, code);
      
      expect(exports).toBeDefined();
    });
  });
});