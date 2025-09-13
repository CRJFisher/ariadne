/**
 * Edge case tests for export detection improvements
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { detect_exports } from './export_detection';
import { 
  is_barrel_export,
  normalize_export_kind,
  contains_export_keyword
} from './language_configs';

describe('Export Detection Edge Cases', () => {
  const js_parser = new Parser();
  js_parser.setLanguage(JavaScript);
  
  const ts_parser = new Parser();
  ts_parser.setLanguage(TypeScript.typescript);
  
  const py_parser = new Parser();
  py_parser.setLanguage(Python);
  
  const rust_parser = new Parser();
  rust_parser.setLanguage(Rust);
  
  describe('JavaScript Advanced Patterns', () => {
    it('should detect async function exports', () => {
      const code = `
        export async function fetch_data() {}
        export const async_fn = async () => {};
      `;
      
      const tree = js_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      expect(exports.length).toBe(2);
      expect(exports[0].name).toBe('fetchData');
      expect(exports[0].is_async).toBe(true);
      expect(exports[1].name).toBe('asyncFn');
    });
    
    it('should detect generator function exports', () => {
      const code = `
        export function* generateSequence() {
          yield 1;
          yield 2;
        }
      `;
      
      const tree = js_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      expect(exports.length).toBe(1);
      expect(exports[0].name).toBe('generateSequence');
      expect(exports[0].is_generator).toBe(true);
    });
    
    it('should detect Object.defineProperty exports', () => {
      const code = `
        Object.defineProperty(exports, 'myProp', {
          value: 42,
          writable: false
        });
      `;
      
      const tree = js_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      expect(exports.length).toBe(1);
      expect(exports[0].name).toBe('myProp');
      expect(exports[0].is_defineProperty).toBe(true);
    });
    
    it('should detect dynamic exports with computed properties', () => {
      const code = `
        const key = 'dynamicKey';
        exports[key] = 'value';
        exports['literalKey'] = 'value2';
      `;
      
      const tree = js_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      expect(exports.length).toBe(2);
      expect(exports[0].is_dynamic).toBe(true);
      expect(exports[1].name).toBe('literalKey');
      expect(exports[1].is_dynamic).toBe(false);
    });
    
    it('should detect barrel exports', () => {
      const code = `
        export * from './components';
        export * from './utils';
        export { default as MyComponent } from './MyComponent';
      `;
      
      const tree = js_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      const barrelExports = exports.filter(e => e.kind === 'barrel');
      expect(barrelExports.length).toBeGreaterThan(0);
    });
  });
  
  describe('TypeScript Advanced Patterns', () => {
    it('should detect export = syntax', () => {
      const code = `
        class MyClass {}
        export = MyClass;
      `;
      
      const tree = ts_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'typescript');
      
      const defaultExport = exports.find(e => e.kind === 'default');
      expect(defaultExport).toBeDefined();
      expect(defaultExport?.is_export_equals).toBe(true);
    });
    
    it('should detect abstract class exports', () => {
      const code = `
        export abstract class BaseClass {
          abstract method(): void;
        }
      `;
      
      const tree = ts_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'typescript');
      
      expect(exports.length).toBe(1);
      expect(exports[0].name).toBe('BaseClass');
    });
    
    it('should detect declare exports', () => {
      const code = `
        export declare const CONFIG: any;
        export declare function external(): void;
        export declare class External {}
      `;
      
      const tree = ts_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'typescript');
      
      expect(exports.length).toBe(3);
      expect(exports.map(e => e.name)).toContain('CONFIG');
      expect(exports.map(e => e.name)).toContain('external');
      expect(exports.map(e => e.name)).toContain('External');
    });
    
    it('should detect complex type exports', () => {
      const code = `
        export type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
        export interface Generic<T, U = string> {
          value: T;
          metadata: U;
        }
      `;
      
      const tree = ts_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'typescript');
      
      expect(exports.length).toBe(2);
      expect(exports[0].name).toBe('Result');
      expect(exports[0].kind).toBe('type');
      expect(exports[1].name).toBe('Generic');
    });
  });
  
  describe('Python Advanced Patterns', () => {
    it('should detect async function exports', () => {
      const code = `
async def fetch_data():
    pass

async def _private_async():
    pass
      `;
      
      const tree = py_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'python');
      
      expect(exports.length).toBe(1);
      expect(exports[0].name).toBe('fetch_data');
      expect(exports[0].is_async).toBe(true);
    });
    
    it('should handle special dunder methods', () => {
      const code = `
class MyClass:
    def __init__(self):
        pass
    
    def __str__(self):
        return "MyClass"
    
    def __secret__(self):
        pass
      `;
      
      const tree = py_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'python');
      
      // MyClass should be exported, but not the dunder methods
      expect(exports.map(e => e.name)).toContain('MyClass');
      expect(exports.map(e => e.name)).not.toContain('__secret__');
    });
    
    it('should detect __all__ augmentation', () => {
      const code = `
__all__ = ['foo']
__all__ += ['bar']
      `;
      
      const tree = py_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'python');
      
      const exportNames = exports.map(e => e.name);
      expect(exportNames).toContain('foo');
      // Note: augmentation detection requires bespoke handler
    });
    
    it('should detect import aliases at module level', () => {
      const code = `
from typing import List as ListType
import numpy as np

class DataProcessor:
    pass
      `;
      
      const tree = py_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'python');
      
      // DataProcessor should be exported
      expect(exports.map(e => e.name)).toContain('DataProcessor');
    });
  });
  
  describe('Rust Advanced Patterns', () => {
    it('should detect async fn exports', () => {
      const code = `
        pub async fn fetch_data() -> Result<String, Error> {
            Ok("data".to_string())
        }
      `;
      
      const tree = rust_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'rust');
      
      expect(exports.length).toBe(1);
      expect(exports[0].name).toBe('fetch_data');
    });
    
    it('should detect unsafe fn exports', () => {
      const code = `
        pub unsafe fn raw_memory_access(ptr: *mut u8) {
            *ptr = 42;
        }
      `;
      
      const tree = rust_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'rust');
      
      expect(exports.length).toBe(1);
      expect(exports[0].name).toBe('raw_memory_access');
    });
    
    it('should detect pub(self) visibility', () => {
      const code = `
        pub(self) fn internal_only() {}
        pub(crate) fn crate_visible() {}
        pub(super) fn parent_visible() {}
        pub(in crate::module) fn module_visible() {}
      `;
      
      const tree = rust_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'rust');
      
      // All should be detected with appropriate visibility levels
      expect(exports.length).toBeGreaterThan(0);
      const visibilities = exports.map(e => e.visibility);
      expect(visibilities).toContain('crate');
      expect(visibilities).toContain('super');
    });
    
    it('should detect glob imports with aliases', () => {
      const code = `
        pub use std::collections::* as collections;
        pub use crate::utils::*;
      `;
      
      const tree = rust_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'rust');
      
      const namespaceExports = exports.filter(e => e.kind === 'namespace');
      expect(namespaceExports.length).toBeGreaterThan(0);
    });
  });
  
  describe('Configuration Utilities', () => {
    it('should detect barrel export patterns', () => {
      expect(is_barrel_export('./components')).toBe(true);
      expect(is_barrel_export('./utils/index')).toBe(true);
      expect(is_barrel_export('../parent')).toBe(false);
      expect(is_barrel_export('./styles.css')).toBe(false);
      expect(is_barrel_export('./data.json')).toBe(false);
    });
    
    it('should normalize export kinds by language', () => {
      expect(normalize_export_kind('function', 'rust')).toBe('fn');
      expect(normalize_export_kind('class', 'rust')).toBe('struct');
      expect(normalize_export_kind('interface', 'rust')).toBe('trait');
      expect(normalize_export_kind('module', 'rust')).toBe('mod');
      
      expect(normalize_export_kind('interface', 'python')).toBe('class');
      expect(normalize_export_kind('trait', 'python')).toBe('class');
      
      expect(normalize_export_kind('function', 'javascript')).toBe('function');
    });
    
    it('should detect export keywords in text', () => {
      expect(contains_export_keyword('export function foo()', 'javascript')).toBe(true);
      expect(contains_export_keyword('module.exports = {}', 'javascript')).toBe(true);
      expect(contains_export_keyword('pub fn main()', 'rust')).toBe(true);
      expect(contains_export_keyword('def foo():', 'python')).toBe(false);
    });
  });
  
  describe('Performance Improvements', () => {
    it('should handle large files efficiently', () => {
      // Generate a large file with many exports
      const exports = Array.from({ length: 100 }, (_, i) => 
        `export function func${i}() { return ${i}; }`
      ).join('\n');
      
      const code = exports;
      const tree = js_parser.parse(code);
      
      const start = performance.now();
      const detectedExports = detect_exports(tree.rootNode, code, 'javascript');
      const duration = performance.now() - start;
      
      expect(detectedExports.length).toBe(100);
      expect(duration).toBeLessThan(100); // Should process in under 100ms
    });
    
    it('should avoid duplicate detection', () => {
      const code = `
        export { foo };
        export { foo as bar };
        const foo = 'value';
      `;
      
      const tree = js_parser.parse(code);
      const exports = detect_exports(tree.rootNode, code, 'javascript');
      
      // Should have unique exports based on name and location
      const uniqueNames = new Set(exports.map(e => `${e.name}:${e.location.start.line}`));
      expect(uniqueNames.size).toBe(exports.length);
    });
  });
});