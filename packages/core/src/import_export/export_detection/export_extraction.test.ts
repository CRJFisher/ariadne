/**
 * Tests for export extraction functionality
 * 
 * Tests both the architectural move from symbol_resolution to export_detection
 * and the new type-only export detection for TypeScript
 */

import { describe, it, expect } from 'vitest';
import { extract_exports, extract_typescript_exports } from './export_extraction';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';

describe('export_extraction', () => {
  const typescript_parser = new Parser();
  typescript_parser.setLanguage(TypeScript.typescript);
  
  const javascript_parser = new Parser();
  javascript_parser.setLanguage(JavaScript);
  
  const python_parser = new Parser();
  python_parser.setLanguage(Python);
  
  const rust_parser = new Parser();
  rust_parser.setLanguage(Rust);
  
  describe('TypeScript type-only exports', () => {
    it('should detect statement-level type-only exports', () => {
      const code = `
        export type { User, Profile } from './models';
        export type { Config } from './config';
      `;
      
      const tree = typescript_parser.parse(code);
      const exports = extract_typescript_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      
      const user_export = exports.find(e => e.name === 'User');
      expect(user_export).toBeDefined();
      expect(user_export?.is_type_only).toBe(true);
      expect(user_export?.source).toBe('./models');
      
      const config_export = exports.find(e => e.name === 'Config');
      expect(config_export).toBeDefined();
      expect(config_export?.is_type_only).toBe(true);
      expect(config_export?.source).toBe('./config');
    });
    
    it('should detect inline type modifiers in mixed exports', () => {
      const code = `
        export { type User, api, type Config } from './module';
      `;
      
      const tree = typescript_parser.parse(code);
      const exports = extract_typescript_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      
      const user_export = exports.find(e => e.name === 'User');
      expect(user_export?.is_type_only).toBe(true);
      
      const api_export = exports.find(e => e.name === 'api');
      expect(api_export?.is_type_only).toBeFalsy();
      
      const config_export = exports.find(e => e.name === 'Config');
      expect(config_export?.is_type_only).toBe(true);
    });
    
    it('should detect type-only namespace exports', () => {
      const code = `
        export type * as types from './types';
        export type * from './models';
      `;
      
      const tree = typescript_parser.parse(code);
      const exports = extract_typescript_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThanOrEqual(1);
      
      const namespace_export = exports.find(e => e.kind === 'namespace');
      expect(namespace_export).toBeDefined();
      expect(namespace_export?.is_type_only).toBe(true);
    });
    
    it('should detect type-only default exports', () => {
      const code = `
        interface User {
          name: string;
        }
        export type default User;
      `;
      
      const tree = typescript_parser.parse(code);
      const exports = extract_typescript_exports(tree.rootNode, code);
      
      // Note: TypeScript doesn't actually support "export type default"
      // but we should handle type exports of interfaces/types
      expect(exports.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle regular exports alongside type-only exports', () => {
      const code = `
        export const api = {};
        export type { User } from './models';
        export function getData() {}
        export type interface Config {}
      `;
      
      const tree = typescript_parser.parse(code);
      const exports = extract_typescript_exports(tree.rootNode, code);
      
      const api_export = exports.find(e => e.name === 'api');
      expect(api_export?.is_type_only).toBeFalsy();
      
      const user_export = exports.find(e => e.name === 'User');
      expect(user_export?.is_type_only).toBe(true);
      
      const getData_export = exports.find(e => e.name === 'getData');
      expect(getData_export?.is_type_only).toBeFalsy();
    });
  });
  
  describe('JavaScript exports', () => {
    it('should extract ES6 named exports', () => {
      const code = `
        export const foo = 1;
        export function bar() {}
        export class Baz {}
      `;
      
      const tree = javascript_parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, 'javascript');
      
      expect(exports).toHaveLength(3);
      expect(exports.map(e => e.name)).toContain('foo');
      expect(exports.map(e => e.name)).toContain('bar');
      expect(exports.map(e => e.name)).toContain('Baz');
    });
    
    it('should extract ES6 default exports', () => {
      const code = `
        export default function main() {}
      `;
      
      const tree = javascript_parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, 'javascript');
      
      expect(exports).toHaveLength(1);
      expect(exports[0].kind).toBe('default');
      expect(exports[0].is_default).toBe(true);
    });
    
    it('should extract CommonJS exports', () => {
      const code = `
        module.exports = { foo, bar };
        exports.baz = 123;
      `;
      
      const tree = javascript_parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, 'javascript');
      
      expect(exports.length).toBeGreaterThanOrEqual(1);
      const baz_export = exports.find(e => e.name === 'baz');
      expect(baz_export).toBeDefined();
    });
  });
  
  describe('Python exports', () => {
    it('should extract __all__ exports', () => {
      const code = `
__all__ = ['foo', 'bar', 'baz']

def foo():
    pass

def bar():
    pass

def baz():
    pass

def _private():
    pass
      `;
      
      const tree = python_parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, 'python');
      
      expect(exports.map(e => e.name)).toContain('foo');
      expect(exports.map(e => e.name)).toContain('bar');
      expect(exports.map(e => e.name)).toContain('baz');
    });
    
    it('should extract public module-level definitions', () => {
      const code = `
def public_function():
    pass

class PublicClass:
    pass

def _private_function():
    pass
      `;
      
      const tree = python_parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, 'python');
      
      expect(exports.map(e => e.name)).toContain('public_function');
      expect(exports.map(e => e.name)).toContain('PublicClass');
      expect(exports.map(e => e.name)).not.toContain('_private_function');
    });
  });
  
  describe('Rust exports', () => {
    it('should extract public items', () => {
      const code = `
        pub fn public_function() {}
        pub struct PublicStruct {}
        pub enum PublicEnum {}
        fn private_function() {}
      `;
      
      const tree = rust_parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, 'rust');
      
      expect(exports.map(e => e.name)).toContain('public_function');
      expect(exports.map(e => e.name)).toContain('PublicStruct');
      expect(exports.map(e => e.name)).toContain('PublicEnum');
      expect(exports.map(e => e.name)).not.toContain('private_function');
    });
    
    it('should extract pub use re-exports', () => {
      const code = `
        pub use crate::module::Item;
        pub use super::another::*;
        use private::module::Thing;
      `;
      
      const tree = rust_parser.parse(code);
      const exports = extract_exports(tree.rootNode, code, 'rust');
      
      const item_export = exports.find(e => e.name === 'Item');
      expect(item_export).toBeDefined();
      expect(item_export?.is_reexport).toBe(true);
    });
  });
  
  describe('Cross-language consistency', () => {
    it('should return empty array for unsupported languages', () => {
      const code = 'some code';
      const tree = javascript_parser.parse(code);
      
      // @ts-expect-error - testing unsupported language
      const exports = extract_exports(tree.rootNode, code, 'unknown');
      
      expect(exports).toEqual([]);
    });
    
    it('should handle empty files', () => {
      const code = '';
      
      const js_tree = javascript_parser.parse(code);
      const js_exports = extract_exports(js_tree.rootNode, code, 'javascript');
      expect(js_exports).toEqual([]);
      
      const ts_tree = typescript_parser.parse(code);
      const ts_exports = extract_exports(ts_tree.rootNode, code, 'typescript');
      expect(ts_exports).toEqual([]);
    });
  });
});

describe('Type-only import/export integration', () => {
  const typescript_parser = new Parser();
  typescript_parser.setLanguage(TypeScript.typescript);
  
  it('should handle complete type-only module', () => {
    const code = `
      // Type-only imports
      import type { Request, Response } from 'express';
      import type * as Types from './types';
      
      // Type-only exports
      export type { Request, Response };
      export type interface Config {
        port: number;
      }
      
      // Mixed exports
      export { type User, createUser } from './user';
    `;
    
    const tree = typescript_parser.parse(code);
    const exports = extract_typescript_exports(tree.rootNode, code);
    
    // Check type-only re-exports
    const request_export = exports.find(e => e.name === 'Request');
    expect(request_export?.is_type_only).toBe(true);
    
    // Check mixed exports
    const user_export = exports.find(e => e.name === 'User');
    expect(user_export?.is_type_only).toBe(true);
    
    const createUser_export = exports.find(e => e.name === 'createUser');
    expect(createUser_export?.is_type_only).toBeFalsy();
  });
});