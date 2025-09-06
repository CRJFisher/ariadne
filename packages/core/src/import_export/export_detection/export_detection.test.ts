/**
 * Integration tests for export detection
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { 
  detect_exports,
  has_exports,
  find_export_by_name,
  get_exported_names,
  group_exports,
  get_default_export,
  is_symbol_exported,
  get_module_interface
} from './index';

describe('export_detection', () => {
  const jsParser = new Parser();
  jsParser.setLanguage(JavaScript);
  
  const tsParser = new Parser();
  tsParser.setLanguage(TypeScript.typescript);
  
  const pyParser = new Parser();
  pyParser.setLanguage(Python);
  
  const rustParser = new Parser();
  rustParser.setLanguage(Rust);
  
  describe('JavaScript exports', () => {
    it('should detect named exports', () => {
      const code = `
        export function myFunction() {}
        export const myConstant = 42;
      `;
      
      const tree = jsParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      expect(exports.length).toBeGreaterThanOrEqual(2);
      const names = exports.map(e => e.name);
      expect(names).toContain('myFunction');
      expect(names).toContain('myConstant');
    });
    
    it('should detect default exports', () => {
      const code = `export default class MyClass {}`;
      
      const tree = jsParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      const defaultExport = get_default_export(exports);
      
      expect(defaultExport).toBeDefined();
      expect(defaultExport?.kind).toBe('default');
    });
    
    it('should detect CommonJS exports', () => {
      const code = `
        module.exports = {
          foo: 'bar',
          baz: 42
        };
      `;
      
      const tree = jsParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      expect(exports.length).toBeGreaterThan(0);
    });
  });
  
  describe('TypeScript exports', () => {
    it('should detect interface exports', () => {
      const code = `
        export interface MyInterface {
          name: string;
        }
      `;
      
      const tree = tsParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'typescript');
      
      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('MyInterface');
    });
    
    it('should detect type exports', () => {
      const code = `
        export type MyType = string | number;
        export type { AnotherType } from './types';
      `;
      
      const tree = tsParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'typescript');
      
      expect(exports.length).toBeGreaterThan(0);
    });
  });
  
  describe('Python exports', () => {
    it('should detect public functions', () => {
      const code = `
def public_function():
    pass

def _private_function():
    pass
      `;
      
      const tree = pyParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'python');
      
      const names = exports.map(e => e.name);
      expect(names).toContain('public_function');
      expect(names).not.toContain('_private_function');
    });
    
    it('should respect __all__ definition', () => {
      const code = `
__all__ = ['exported_func']

def exported_func():
    pass

def not_exported():
    pass
      `;
      
      const tree = pyParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'python');
      
      const names = exports.map(e => e.name);
      expect(names).toContain('exported_func');
      // When __all__ is defined, only listed items are exported
    });
  });
  
  describe('Rust exports', () => {
    it('should detect pub items', () => {
      const code = `
pub fn public_function() {}
fn private_function() {}
pub struct PublicStruct;
      `;
      
      const tree = rustParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'rust');
      
      const names = exports.map(e => e.name);
      expect(names).toContain('public_function');
      expect(names).toContain('PublicStruct');
      expect(names).not.toContain('private_function');
    });
    
    it('should detect pub(crate) items', () => {
      const code = `
pub(crate) fn crate_function() {}
pub(super) mod super_module {}
      `;
      
      const tree = rustParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'rust');
      
      expect(exports.length).toBeGreaterThan(0);
    });
  });
  
  describe('Utility functions', () => {
    it('should check if file exports a symbol', () => {
      const code = `export function foo() {}`;
      const tree = jsParser.parse(code);
      
      expect(is_symbol_exported('foo', tree.rootNode, code, 'javascript')).toBe(true);
      expect(is_symbol_exported('bar', tree.rootNode, code, 'javascript')).toBe(false);
    });
    
    it('should create module interface', () => {
      const code = `
        export default class Main {}
        export function helper() {}
        export * from './utils';
      `;
      
      const tree = jsParser.parse(code);
      const moduleInterface = get_module_interface(tree.rootNode, code, 'javascript', 'test.js');
      
      expect(moduleInterface).toBeDefined();
      expect(moduleInterface.file_path).toBe('test.js');
      expect(moduleInterface.default_export).toBeDefined();
      expect(moduleInterface.named_exports.length).toBeGreaterThan(0);
    });
    
    it('should group exports by kind', () => {
      const code = `
        export default function main() {}
        export function foo() {}
        export const bar = 42;
        export * as utils from './utils';
      `;
      
      const tree = jsParser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      const grouped = group_exports(exports);
      
      expect(grouped.default).toBeDefined();
      expect(grouped.named.length).toBeGreaterThan(0);
    });
    
    it('should get exported names', () => {
      const code = `
        export function foo() {}
        export const bar = 42;
        export class Baz {}
      `;
      
      const tree = jsParser.parse(code);
      const names = get_exported_names(tree.rootNode, code, 'javascript');
      
      expect(names).toBeInstanceOf(Set);
      expect(names.has('foo')).toBe(true);
      expect(names.has('bar')).toBe(true);
      expect(names.has('Baz')).toBe(true);
    });
  });
});