/**
 * Tests for JavaScript bespoke export detection
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import {
  handle_commonjs_exports,
  handle_complex_reexports,
  handle_dynamic_exports
} from './export_detection.javascript';

describe('JavaScript Bespoke Export Detection', () => {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  
  describe('CommonJS Exports', () => {
    it('should handle module.exports object', () => {
      const code = `
        module.exports = {
          foo: foo,
          bar,
          baz: 123
        };
      `;
      
      const tree = parser.parse(code);
      const exports = handle_commonjs_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThanOrEqual(2);
      expect(exports.map(e => e.name)).toContain('bar');
    });
    
    it('should handle module.exports default', () => {
      const code = `module.exports = MyClass;`;
      
      const tree = parser.parse(code);
      const exports = handle_commonjs_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].kind).toBe('default');
      expect(exports[0].original_name).toBe('MyClass');
    });
    
    it('should handle exports.name pattern', () => {
      const code = `
        exports.foo = function() {};
        exports.bar = 42;
        exports.baz = Bar;
      `;
      
      const tree = parser.parse(code);
      const exports = handle_commonjs_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      expect(exports.map(e => e.name)).toEqual(['foo', 'bar', 'baz']);
      expect(exports.every(e => e.kind === 'named')).toBe(true);
    });
  });
  
  describe('Complex Re-exports', () => {
    it('should handle default re-exports', () => {
      const code = `
        export { default } from './module';
        export { default as MyDefault } from './other';
      `;
      
      const tree = parser.parse(code);
      const exports = handle_complex_reexports(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports[0].name).toBe('default');
      expect(exports[0].source).toBe('./module');
      expect(exports[1].name).toBe('MyDefault');
      expect(exports[1].source).toBe('./other');
    });
  });
  
  describe('Dynamic Exports', () => {
    it('should detect dynamic export patterns', () => {
      const code = `
        const key = 'dynamicKey';
        exports[key] = value;
        exports[computeKey()] = otherValue;
      `;
      
      const tree = parser.parse(code);
      const exports = handle_dynamic_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThan(0);
      expect(exports.every(e => e.is_dynamic)).toBe(true);
      expect(exports.every(e => e.name === '<dynamic>')).toBe(true);
    });
  });
});