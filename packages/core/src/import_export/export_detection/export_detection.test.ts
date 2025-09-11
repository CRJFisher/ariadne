/**
 * Tests for generic export detection processor
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import {
  detect_exports_generic,
  merge_exports,
  needs_bespoke_processing,
  get_export_stats,
  MODULE_CONTEXT
} from './export_detection';

describe('Generic Export Detection', () => {
  const jsParser = new Parser();
  jsParser.setLanguage(JavaScript);
  
  const tsParser = new Parser();
  tsParser.setLanguage(TypeScript.typescript);
  
  const pyParser = new Parser();
  pyParser.setLanguage(Python);
  
  const rustParser = new Parser();
  rustParser.setLanguage(Rust);
  
  describe('MODULE_CONTEXT', () => {
    it('should have correct module metadata', () => {
      expect(MODULE_CONTEXT.name).toBe('export_detection');
      expect(MODULE_CONTEXT.version).toBe('2.0.0');
      expect(MODULE_CONTEXT.layer).toBe(2);
    });
  });
  
  describe('JavaScript/TypeScript Export Detection', () => {
    it('should detect simple ES6 exports', () => {
      const code = `
        export function foo() {}
        export const bar = 42;
        export class Baz {}
      `;
      
      const tree = jsParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'javascript');
      
      expect(result.exports).toHaveLength(3);
      expect(result.exports.map(e => e.name)).toContain('foo');
      expect(result.exports.map(e => e.name)).toContain('bar');
      expect(result.exports.map(e => e.name)).toContain('Baz');
    });
    
    it('should detect default exports', () => {
      const code = `export default function main() {}`;
      
      const tree = jsParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'javascript');
      
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].kind).toBe('default');
    });
    
    it('should detect re-exports', () => {
      const code = `
        export { foo, bar } from './module';
        export * from './other';
      `;
      
      const tree = jsParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'javascript');
      
      expect(result.exports.length).toBeGreaterThan(0);
      expect(result.exports.some(e => e.source === './module')).toBe(true);
    });
    
    it('should flag CommonJS for bespoke processing', () => {
      const code = `
        module.exports = { foo };
        exports.bar = 42;
      `;
      
      const tree = jsParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'javascript');
      
      expect(result.requires_bespoke).toBe(true);
      expect(result.bespoke_hints?.has_commonjs).toBe(true);
    });
    
    it('should flag TypeScript type exports for bespoke', () => {
      const code = `
        export type Foo = string;
        export interface Bar {}
      `;
      
      const tree = tsParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'typescript');
      
      expect(result.requires_bespoke).toBe(true);
      expect(result.bespoke_hints?.has_type_exports).toBe(true);
    });
  });
  
  describe('Python Export Detection', () => {
    it('should detect implicit exports', () => {
      const code = `
def public_function():
    pass

class PublicClass:
    pass

def _private_function():
    pass
      `;
      
      const tree = pyParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'python');
      
      // Generic handles implicit exports
      expect(result.exports.length).toBeGreaterThanOrEqual(2);
      expect(result.exports.map(e => e.name)).toContain('public_function');
      expect(result.exports.map(e => e.name)).toContain('PublicClass');
      expect(result.exports.map(e => e.name)).not.toContain('_private_function');
    });
    
    it('should flag __all__ for bespoke processing', () => {
      const code = `
__all__ = ['foo', 'bar']

def foo():
    pass
      `;
      
      const tree = pyParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'python');
      
      expect(result.requires_bespoke).toBe(true);
      expect(result.bespoke_hints?.has_export_list).toBe(true);
    });
  });
  
  describe('Rust Export Detection', () => {
    it('should detect pub items', () => {
      const code = `
pub fn public_function() {}
pub struct PublicStruct;
fn private_function() {}
      `;
      
      const tree = rustParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'rust');
      
      // Basic pub detection handled by generic
      expect(result.exports.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should flag visibility modifiers for bespoke', () => {
      const code = `
pub(crate) fn crate_function() {}
pub(super) struct SuperStruct;
      `;
      
      const tree = rustParser.parse(code);
      const result = detect_exports_generic(tree.rootNode, code, 'rust');
      
      expect(result.requires_bespoke).toBe(true);
      expect(result.bespoke_hints?.has_visibility_modifiers).toBe(true);
    });
  });
  
  describe('Export Merging', () => {
    it('should merge without duplicates', () => {
      const generic = [
        { name: 'foo', source: 'local', kind: 'named' as const, location: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } } },
        { name: 'bar', source: 'local', kind: 'named' as const, location: { start: { line: 2, column: 1 }, end: { line: 2, column: 10 } } }
      ];
      
      const bespoke = [
        { name: 'foo', source: 'local', kind: 'named' as const, location: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } } }, // Duplicate
        { name: 'baz', source: 'local', kind: 'named' as const, location: { start: { line: 3, column: 1 }, end: { line: 3, column: 10 } } }
      ];
      
      const merged = merge_exports(generic, bespoke);
      
      expect(merged).toHaveLength(3);
      expect(merged.map(e => e.name)).toEqual(['foo', 'bar', 'baz']);
    });
  });
  
  describe('Bespoke Detection', () => {
    it('should detect CommonJS patterns', () => {
      expect(needs_bespoke_processing('module.exports = foo', 'javascript')).toBe(true);
      expect(needs_bespoke_processing('export default foo', 'javascript')).toBe(false);
    });
    
    it('should detect TypeScript type exports', () => {
      expect(needs_bespoke_processing('export type Foo = Bar', 'typescript')).toBe(true);
      expect(needs_bespoke_processing('export interface X {}', 'typescript')).toBe(false);
    });
    
    it('should detect Python __all__', () => {
      expect(needs_bespoke_processing('__all__ = ["foo"]', 'python')).toBe(true);
      expect(needs_bespoke_processing('def foo(): pass', 'python')).toBe(false);
    });
    
    it('should detect Rust visibility modifiers', () => {
      expect(needs_bespoke_processing('pub(crate) fn foo()', 'rust')).toBe(true);
      expect(needs_bespoke_processing('pub fn bar()', 'rust')).toBe(false);
    });
  });
  
  describe('Export Statistics', () => {
    it('should calculate correct statistics', () => {
      const exports = [
        { name: 'default', source: 'local', kind: 'default' as const, location: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } } },
        { name: 'foo', source: 'local', kind: 'named' as const, location: { start: { line: 2, column: 1 }, end: { line: 2, column: 10 } } },
        { name: 'bar', source: './other', kind: 'named' as const, location: { start: { line: 3, column: 1 }, end: { line: 3, column: 10 } } },
        { name: '*', source: './module', kind: 'namespace' as const, location: { start: { line: 4, column: 1 }, end: { line: 4, column: 10 } } }
      ];
      
      const stats = get_export_stats(exports);
      
      expect(stats.total).toBe(4);
      expect(stats.by_kind.default).toBe(1);
      expect(stats.by_kind.named).toBe(2);
      expect(stats.by_kind.namespace).toBe(1);
      expect(stats.by_source.local).toBe(2);
      expect(stats.by_source.external).toBe(2);
    });
  });
});