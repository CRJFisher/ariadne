/**
 * Tests for Python-specific bespoke namespace resolution
 */

import { describe, it, expect } from 'vitest';
import {
  handle_package_imports,
  handle_all_exports,
  handle_relative_imports,
  handle_dynamic_attribute_access,
  handle_star_import_restrictions,
  handle_module_getattr
} from './namespace_resolution.python.bespoke';

describe('Python Bespoke Namespace Handlers', () => {
  describe('handle_package_imports', () => {
    it('should detect package imports with __init__.py', () => {
      const mockFileSystem = {
        exists: (path: string) => {
          return path.includes('__init__.py');
        }
      };

      const imports = handle_package_imports('mypackage.py', mockFileSystem);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].namespace_name).toBe('mypackage');
      expect(imports[0].source_module).toBe('mypackage/__init__.py');
      expect(imports[0].is_package).toBe(true);
    });

    it('should return empty for non-package modules', () => {
      const mockFileSystem = {
        exists: (path: string) => false
      };

      const imports = handle_package_imports('simple_module.py', mockFileSystem);
      
      expect(imports).toHaveLength(0);
    });

    it('should handle nested package paths', () => {
      const mockFileSystem = {
        exists: (path: string) => path === 'parent/child/__init__.py'
      };

      const imports = handle_package_imports('parent/child.py', mockFileSystem);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].namespace_name).toBe('child');
      expect(imports[0].source_module).toBe('parent/child/__init__.py');
    });
  });

  describe('handle_all_exports', () => {
    it('should filter exports based on __all__', () => {
      const exports = new Map();
      exports.set('public1', { name: 'public1' });
      exports.set('public2', { name: 'public2' });
      exports.set('private', { name: 'private' });
      exports.set('_internal', { name: '_internal' });
      
      const code = `
        __all__ = ['public1', 'public2']
      `;

      handle_all_exports(exports, code);
      
      expect(exports.size).toBe(2);
      expect(exports.has('public1')).toBe(true);
      expect(exports.has('public2')).toBe(true);
      expect(exports.has('private')).toBe(false);
      expect(exports.has('_internal')).toBe(false);
    });

    it('should handle __all__ with different quote styles', () => {
      const exports = new Map();
      exports.set('single', { name: 'single' });
      exports.set('double', { name: 'double' });
      exports.set('mixed', { name: 'mixed' });
      
      const code = `
        __all__ = ['single', "double", 'mixed']
      `;

      handle_all_exports(exports, code);
      
      expect(exports.size).toBe(3);
      expect(exports.has('single')).toBe(true);
      expect(exports.has('double')).toBe(true);
      expect(exports.has('mixed')).toBe(true);
    });

    it('should handle multiline __all__ definitions', () => {
      const exports = new Map();
      exports.set('export1', { name: 'export1' });
      exports.set('export2', { name: 'export2' });
      exports.set('export3', { name: 'export3' });
      
      const code = `
        __all__ = [
          'export1',
          'export2',
          'export3'
        ]
      `;

      handle_all_exports(exports, code);
      
      expect(exports.size).toBe(3);
    });

    it('should handle empty __all__', () => {
      const exports = new Map();
      exports.set('func1', { name: 'func1' });
      exports.set('func2', { name: 'func2' });
      
      const code = `
        __all__ = []
      `;

      handle_all_exports(exports, code);
      
      expect(exports.size).toBe(0);
    });
  });

  describe('handle_relative_imports', () => {
    it('should handle single dot relative imports', () => {
      const result = handle_relative_imports(
        'from . import module',
        '/project/package/submodule.py'
      );
      
      expect(result.level).toBe(1);
      expect(result.resolved_path).toBe('/project/package');
    });

    it('should handle multiple dot relative imports', () => {
      const result = handle_relative_imports(
        'from ... import module',
        '/project/package/sub/deep/module.py'
      );
      
      expect(result.level).toBe(3);
      expect(result.resolved_path).toBe('/project');
    });

    it('should handle relative imports with package names', () => {
      const result = handle_relative_imports(
        'from ..sibling import something',
        '/project/package/current/module.py'
      );
      
      expect(result.level).toBe(2);
      expect(result.resolved_path).toBe('/project/sibling');
    });

    it('should return level 0 for absolute imports', () => {
      const result = handle_relative_imports(
        'from package import module',
        '/project/file.py'
      );
      
      expect(result.level).toBe(0);
      expect(result.resolved_path).toBeUndefined();
    });
  });

  describe('handle_dynamic_attribute_access', () => {
    it('should detect getattr patterns', () => {
      const code = `
        value1 = getattr(mymodule, 'attribute1')
        value2 = getattr(mymodule, "attribute2")
        value3 = getattr(mymodule, 'method')
      `;

      const members = handle_dynamic_attribute_access('mymodule', code);
      
      expect(members).toHaveLength(3);
      expect(members).toContain('attribute1');
      expect(members).toContain('attribute2');
      expect(members).toContain('method');
    });

    it('should detect __dict__ access patterns', () => {
      const code = `
        val1 = namespace.__dict__['member1']
        val2 = namespace.__dict__["member2"]
      `;

      const members = handle_dynamic_attribute_access('namespace', code);
      
      expect(members).toHaveLength(2);
      expect(members).toContain('member1');
      expect(members).toContain('member2');
    });

    it('should handle both getattr and __dict__ patterns', () => {
      const code = `
        a = getattr(module, 'attr1')
        b = module.__dict__['attr2']
        c = getattr(module, 'attr3')
      `;

      const members = handle_dynamic_attribute_access('module', code);
      
      expect(members).toHaveLength(3);
      expect(members).toContain('attr1');
      expect(members).toContain('attr2');
      expect(members).toContain('attr3');
    });

    it('should only match specified namespace', () => {
      const code = `
        a = getattr(module1, 'attr1')
        b = getattr(module2, 'attr2')
        c = getattr(module1, 'attr3')
      `;

      const members1 = handle_dynamic_attribute_access('module1', code);
      const members2 = handle_dynamic_attribute_access('module2', code);
      
      expect(members1).toHaveLength(2);
      expect(members1).toContain('attr1');
      expect(members1).toContain('attr3');
      
      expect(members2).toHaveLength(1);
      expect(members2).toContain('attr2');
    });
  });

  describe('handle_star_import_restrictions', () => {
    it('should detect __all__ restrictions for star imports', () => {
      const importText = 'from module import *';
      const targetCode = `
        __all__ = ['allowed1', 'allowed2', 'allowed3']
        
        def allowed1(): pass
        def allowed2(): pass
        def allowed3(): pass
        def _private(): pass
      `;

      const result = handle_star_import_restrictions(importText, targetCode);
      
      expect(result.restricted).toBe(true);
      expect(result.allowed_members).toEqual(['allowed1', 'allowed2', 'allowed3']);
    });

    it('should handle no restrictions when __all__ is absent', () => {
      const importText = 'from module import *';
      const targetCode = `
        def public_func(): pass
        def _private_func(): pass
        class PublicClass: pass
      `;

      const result = handle_star_import_restrictions(importText, targetCode);
      
      expect(result.restricted).toBe(false);
      expect(result.allowed_members).toBeUndefined();
    });

    it('should only check star imports', () => {
      const importText = 'from module import specific';
      const targetCode = `
        __all__ = ['allowed']
      `;

      const result = handle_star_import_restrictions(importText, targetCode);
      
      expect(result.restricted).toBe(false);
    });

    it('should handle empty __all__', () => {
      const importText = 'from module import *';
      const targetCode = `
        __all__ = []
      `;

      const result = handle_star_import_restrictions(importText, targetCode);
      
      expect(result.restricted).toBe(true);
      expect(result.allowed_members).toEqual([]);
    });
  });

  describe('handle_module_getattr', () => {
    it('should detect module-level __getattr__', () => {
      const code = `
        def __getattr__(name):
            if name == 'lazy1':
                import lazy1
                return lazy1
            if name == 'lazy2':
                import lazy2
                return lazy2
      `;

      const result = handle_module_getattr(code);
      
      expect(result.has_getattr).toBe(true);
      expect(result.lazy_imports).toEqual(['lazy1', 'lazy2']);
    });

    it('should handle different quote styles in lazy imports', () => {
      const code = `
        def __getattr__(name):
            if name == "single": import single
            if name == 'double': import double
      `;

      const result = handle_module_getattr(code);
      
      expect(result.has_getattr).toBe(true);
      expect(result.lazy_imports).toContain('single');
      expect(result.lazy_imports).toContain('double');
    });

    it('should detect absence of __getattr__', () => {
      const code = `
        def regular_function(name):
            return name
        
        def another_function():
            pass
      `;

      const result = handle_module_getattr(code);
      
      expect(result.has_getattr).toBe(false);
      expect(result.lazy_imports).toBeUndefined();
    });

    it('should handle __getattr__ without lazy imports', () => {
      const code = `
        def __getattr__(name):
            raise AttributeError(f"Module has no attribute {name}")
      `;

      const result = handle_module_getattr(code);
      
      expect(result.has_getattr).toBe(true);
      expect(result.lazy_imports).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty source code', () => {
      const exports = new Map();
      exports.set('test', { name: 'test' });
      
      handle_all_exports(exports, '');
      expect(exports.size).toBe(1); // No __all__ found, exports unchanged
      
      const members = handle_dynamic_attribute_access('module', '');
      expect(members).toHaveLength(0);
      
      const getattr = handle_module_getattr('');
      expect(getattr.has_getattr).toBe(false);
    });

    it('should handle Unicode in Python identifiers', () => {
      const code = `
        __all__ = ['函数', 'クラス', 'función']
      `;

      const exports = new Map();
      exports.set('函数', { name: '函数' });
      exports.set('クラス', { name: 'クラス' });
      exports.set('función', { name: 'función' });
      exports.set('not_exported', { name: 'not_exported' });
      
      handle_all_exports(exports, code);
      
      expect(exports.size).toBe(3);
      expect(exports.has('函数')).toBe(true);
      expect(exports.has('クラス')).toBe(true);
      expect(exports.has('función')).toBe(true);
    });

    it('should handle deeply nested relative imports', () => {
      const result = handle_relative_imports(
        'from .....parent import module',
        '/a/b/c/d/e/f/current.py'
      );
      
      expect(result.level).toBe(5);
      expect(result.resolved_path).toBe('/a/b/parent');
    });
  });
});