/**
 * Tests for Python-specific bespoke export detection
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import {
  handle_all_exports,
  handle_conditional_exports,
  handle_star_import_exports,
  handle_decorated_exports
} from './export_detection.python.bespoke';

describe('Python bespoke export detection', () => {
  const parser = new Parser();
  parser.setLanguage(Python);
  
  describe('handle_all_exports', () => {
    it('should detect simple __all__ list', () => {
      const code = `__all__ = ['foo', 'bar', 'baz']`;
      const tree = parser.parse(code);
      const exports = handle_all_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      expect(exports.map(e => e.name)).toEqual(['foo', 'bar', 'baz']);
      expect(exports.every(e => e.from_all)).toBe(true);
    });
    
    it('should detect __all__.append() calls', () => {
      const code = `
__all__ = ['foo']
__all__.append('bar')
__all__.append('baz')
      `;
      const tree = parser.parse(code);
      const exports = handle_all_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      expect(exports.map(e => e.name)).toContain('foo');
      expect(exports.map(e => e.name)).toContain('bar');
      expect(exports.map(e => e.name)).toContain('baz');
      
      const appendExports = exports.filter(e => e.dynamic_append);
      expect(appendExports).toHaveLength(2);
    });
    
    it('should detect __all__.extend() calls', () => {
      const code = `
__all__ = ['foo']
__all__.extend(['bar', 'baz'])
      `;
      const tree = parser.parse(code);
      const exports = handle_all_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      expect(exports.map(e => e.name)).toContain('foo');
      expect(exports.map(e => e.name)).toContain('bar');
      expect(exports.map(e => e.name)).toContain('baz');
      
      const extendExports = exports.filter(e => e.dynamic_extend);
      expect(extendExports).toHaveLength(2);
    });
    
    it('should handle dynamic __all__ with list comprehension', () => {
      const code = `
__all__ = [name for name in dir() if not name.startswith('_')]
      `;
      const tree = parser.parse(code);
      const exports = handle_all_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('<dynamic>');
    });
    
    it('should handle concatenated strings in __all__', () => {
      const code = `
__all__ = [
    'foo' 'bar',  # Concatenated string
    'baz'
]
      `;
      const tree = parser.parse(code);
      const exports = handle_all_exports(tree.rootNode, code);
      
      expect(exports.map(e => e.name)).toContain('foo');
      expect(exports.map(e => e.name)).toContain('bar');
      expect(exports.map(e => e.name)).toContain('baz');
    });
  });
  
  describe('handle_conditional_exports', () => {
    it('should detect exports in if statements', () => {
      const code = `
if sys.version_info >= (3, 8):
    def new_feature():
        pass
      `;
      const tree = parser.parse(code);
      const exports = handle_conditional_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('new_feature');
      expect(exports[0].conditional).toBe(true);
    });
    
    it('should skip __main__ guard blocks', () => {
      const code = `
if __name__ == '__main__':
    def main():
        pass
      `;
      const tree = parser.parse(code);
      const exports = handle_conditional_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(0);
    });
    
    it('should detect conditional class definitions', () => {
      const code = `
if HAS_NUMPY:
    class NumpyWrapper:
        pass
      `;
      const tree = parser.parse(code);
      const exports = handle_conditional_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('NumpyWrapper');
      expect(exports[0].kind).toBe('named');
      expect(exports[0].conditional).toBe(true);
    });
    
    it('should skip private conditional definitions', () => {
      const code = `
if DEBUG:
    def _debug_helper():
        pass
      `;
      const tree = parser.parse(code);
      const exports = handle_conditional_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(0);
    });
  });
  
  describe('handle_star_import_exports', () => {
    it('should detect star imports', () => {
      const code = `from module import *`;
      const tree = parser.parse(code);
      const exports = handle_star_import_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('*');
      expect(exports[0].source).toBe('module');
      expect(exports[0].kind).toBe('namespace');
      expect(exports[0].star_import).toBe(true);
    });
    
    it('should detect multiple star imports', () => {
      const code = `
from foo import *
from bar.baz import *
      `;
      const tree = parser.parse(code);
      const exports = handle_star_import_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.map(e => e.source)).toContain('foo');
      expect(exports.map(e => e.source)).toContain('bar.baz');
    });
    
    it('should handle star imports with aliases', () => {
      const code = `from .submodule import *`;
      const tree = parser.parse(code);
      const exports = handle_star_import_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].source).toBe('.submodule');
    });
  });
  
  describe('handle_decorated_exports', () => {
    it('should detect decorated functions', () => {
      const code = `
@export
def my_function():
    pass
      `;
      const tree = parser.parse(code);
      const exports = handle_decorated_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('my_function');
      expect(exports[0].decorated).toBe(true);
      expect(exports[0].explicit_export).toBe(true);
    });
    
    it('should detect decorated classes', () => {
      const code = `
@public
class MyClass:
    pass
      `;
      const tree = parser.parse(code);
      const exports = handle_decorated_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('MyClass');
      expect(exports[0].decorated).toBe(true);
      expect(exports[0].explicit_export).toBe(true);
    });
    
    it('should detect API decorators', () => {
      const code = `
@api
def public_api():
    pass
      `;
      const tree = parser.parse(code);
      const exports = handle_decorated_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('public_api');
      expect(exports[0].explicit_export).toBe(true);
    });
    
    it('should handle multiple decorators', () => {
      const code = `
@cached
@export
@validate
def complex_function():
    pass
      `;
      const tree = parser.parse(code);
      const exports = handle_decorated_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('complex_function');
      expect(exports[0].decorated).toBe(true);
      expect(exports[0].explicit_export).toBe(true);
    });
    
    it('should skip private decorated definitions', () => {
      const code = `
@internal
def _private_function():
    pass
      `;
      const tree = parser.parse(code);
      const exports = handle_decorated_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(0);
    });
    
    it('should detect non-export decorators', () => {
      const code = `
@property
def getter():
    pass
      `;
      const tree = parser.parse(code);
      const exports = handle_decorated_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('getter');
      expect(exports[0].decorated).toBe(true);
      expect(exports[0].explicit_export).toBe(false);
    });
  });
  
  describe('edge cases', () => {
    it('should handle empty __all__', () => {
      const code = `__all__ = []`;
      const tree = parser.parse(code);
      const exports = handle_all_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(0);
    });
    
    it('should handle nested conditionals', () => {
      const code = `
if PLATFORM == 'linux':
    if HAS_GTK:
        class GtkWidget:
            pass
      `;
      const tree = parser.parse(code);
      const exports = handle_conditional_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('GtkWidget');
      expect(exports[0].conditional).toBe(true);
    });
    
    it('should handle complex __all__ manipulations', () => {
      const code = `
__all__ = ['base']
if HAS_OPTIONAL:
    __all__.append('optional')
__all__ += ['extra1', 'extra2']
      `;
      const tree = parser.parse(code);
      const exports = handle_all_exports(tree.rootNode, code);
      
      const names = exports.map(e => e.name);
      expect(names).toContain('base');
      expect(names).toContain('optional');
    });
  });
});