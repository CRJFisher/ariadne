/**
 * Tests for Rust-specific bespoke namespace resolution
 */

import { describe, it, expect } from 'vitest';
import {
  handle_visibility_modifiers,
  handle_complex_use_statements,
  handle_extern_crate,
  handle_trait_imports,
  handle_macro_namespace,
  handle_path_keywords
} from './namespace_resolution.rust.bespoke';
import { SyntaxNode } from 'tree-sitter';

describe('Rust Bespoke Namespace Handlers', () => {
  const mockNode = {
    startIndex: 0,
    endIndex: 100
  } as SyntaxNode;

  describe('handle_visibility_modifiers', () => {
    it('should detect pub(crate) visibility', () => {
      const sourceCode = 'pub(crate) fn my_function() {}';
      const node = { ...mockNode, endIndex: sourceCode.length } as SyntaxNode;
      
      const result = handle_visibility_modifiers(node, sourceCode);
      
      expect(result.visibility).toBe('crate');
      expect(result.path).toBeUndefined();
    });

    it('should detect pub(super) visibility', () => {
      const sourceCode = 'pub(super) struct MyStruct {}';
      const node = { ...mockNode, endIndex: sourceCode.length } as SyntaxNode;
      
      const result = handle_visibility_modifiers(node, sourceCode);
      
      expect(result.visibility).toBe('super');
    });

    it('should detect pub(in path) visibility', () => {
      const sourceCode = 'pub(in crate::module::submodule) fn func() {}';
      const node = { ...mockNode, endIndex: sourceCode.length } as SyntaxNode;
      
      const result = handle_visibility_modifiers(node, sourceCode);
      
      expect(result.visibility).toBe('in_path');
      expect(result.path).toBe('crate::module::submodule');
    });

    it('should detect public visibility', () => {
      const sourceCode = 'pub fn public_function() {}';
      const node = { ...mockNode, endIndex: sourceCode.length } as SyntaxNode;
      
      const result = handle_visibility_modifiers(node, sourceCode);
      
      expect(result.visibility).toBe('public');
    });

    it('should detect private visibility', () => {
      const sourceCode = 'fn private_function() {}';
      const node = { ...mockNode, endIndex: sourceCode.length } as SyntaxNode;
      
      const result = handle_visibility_modifiers(node, sourceCode);
      
      expect(result.visibility).toBe('private');
    });
  });

  describe('handle_complex_use_statements', () => {
    it('should handle simple use statements', () => {
      const imports = handle_complex_use_statements('use std::collections::HashMap;');
      
      expect(imports).toHaveLength(1);
      expect(imports[0].namespace_name).toBe('HashMap');
      expect(imports[0].source_module).toBe('std::collections::HashMap');
    });

    it('should handle use statements with aliases', () => {
      const imports = handle_complex_use_statements('use std::collections::HashMap as Map;');
      
      expect(imports).toHaveLength(1);
      expect(imports[0].namespace_name).toBe('Map');
      expect(imports[0].source_module).toBe('std::collections::HashMap');
    });

    it('should handle nested braces', () => {
      const useText = 'use std::collections::{HashMap, HashSet, BTreeMap};';
      const imports = handle_complex_use_statements(useText);
      
      expect(imports).toHaveLength(3);
      expect(imports.some(i => i.namespace_name === 'HashMap')).toBe(true);
      expect(imports.some(i => i.namespace_name === 'HashSet')).toBe(true);
      expect(imports.some(i => i.namespace_name === 'BTreeMap')).toBe(true);
    });

    it('should handle aliases within braces', () => {
      const useText = 'use std::{io as io_mod, fs as filesystem};';
      const imports = handle_complex_use_statements(useText);
      
      expect(imports).toHaveLength(2);
      expect(imports.some(i => i.namespace_name === 'io_mod')).toBe(true);
      expect(imports.some(i => i.namespace_name === 'filesystem')).toBe(true);
    });

    it('should handle deeply nested use statements', () => {
      const useText = 'use a::b::c::d::e::Item;';
      const imports = handle_complex_use_statements(useText);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].namespace_name).toBe('Item');
      expect(imports[0].source_module).toBe('a::b::c::d::e::Item');
    });

    it('should handle self in use statements', () => {
      const useText = 'use super::{self, OtherItem};';
      const imports = handle_complex_use_statements(useText);
      
      expect(imports.length).toBeGreaterThan(0);
      // Self imports are handled specially
    });
  });

  describe('handle_extern_crate', () => {
    it('should detect simple extern crate declarations', () => {
      const code = `
        extern crate serde;
        extern crate tokio;
      `;

      const imports = handle_extern_crate(code);
      
      expect(imports).toHaveLength(2);
      expect(imports[0].namespace_name).toBe('serde');
      expect(imports[0].source_module).toBe('crate::serde');
      expect(imports[0].is_extern_crate).toBe(true);
      
      expect(imports[1].namespace_name).toBe('tokio');
    });

    it('should handle extern crate with aliases', () => {
      const code = `
        extern crate serde_json as json;
        extern crate async_std as async;
      `;

      const imports = handle_extern_crate(code);
      
      expect(imports).toHaveLength(2);
      expect(imports[0].namespace_name).toBe('json');
      expect(imports[0].source_module).toBe('crate::serde_json');
      
      expect(imports[1].namespace_name).toBe('async');
      expect(imports[1].source_module).toBe('crate::async_std');
    });

    it('should handle crates with underscores and numbers', () => {
      const code = `
        extern crate my_crate_2;
        extern crate another_crate_v3;
      `;

      const imports = handle_extern_crate(code);
      
      expect(imports).toHaveLength(2);
      expect(imports[0].namespace_name).toBe('my_crate_2');
      expect(imports[1].namespace_name).toBe('another_crate_v3');
    });
  });

  describe('handle_trait_imports', () => {
    it('should detect trait imports with implementations', () => {
      const useText = 'use std::fmt::Display;';
      const sourceCode = `
        use std::fmt::Display;
        
        impl Display for MyStruct {
          fn fmt(&self, f: &mut Formatter) -> Result {
            write!(f, "MyStruct")
          }
        }
      `;

      const result = handle_trait_imports(useText, sourceCode);
      
      expect(result.trait_name).toBe('Display');
      expect(result.methods).toContain('fmt');
    });

    it('should handle traits with multiple methods', () => {
      const useText = 'use std::ops::Add;';
      const sourceCode = `
        impl Add for Vector {
          fn add(self, other: Vector) -> Vector {
            Vector { x: self.x + other.x }
          }
          
          fn add_assign(&mut self, other: Vector) {
            self.x += other.x;
          }
        }
      `;

      const result = handle_trait_imports(useText, sourceCode);
      
      expect(result.trait_name).toBe('Add');
      expect(result.methods).toContain('add');
      expect(result.methods).toContain('add_assign');
    });

    it('should handle generic trait implementations', () => {
      const useText = 'use std::convert::From;';
      const sourceCode = `
        impl<T> From<T> for Wrapper<T> {
          fn from(value: T) -> Self {
            Wrapper(value)
          }
        }
      `;

      const result = handle_trait_imports(useText, sourceCode);
      
      expect(result.trait_name).toBe('From');
      expect(result.methods).toContain('from');
    });

    it('should return empty methods when no implementation found', () => {
      const useText = 'use std::clone::Clone;';
      const sourceCode = 'use std::clone::Clone;';

      const result = handle_trait_imports(useText, sourceCode);
      
      expect(result.trait_name).toBe('Clone');
      expect(result.methods).toHaveLength(0);
    });
  });

  describe('handle_macro_namespace', () => {
    it('should detect exported macros', () => {
      const code = `
        #[macro_export]
        macro_rules! my_macro {
          () => {};
        }
        
        #[macro_export]
        macro_rules! another_macro {
          ($x:expr) => { $x * 2 };
        }
      `;

      const result = handle_macro_namespace(code);
      
      expect(result.exported_macros).toHaveLength(2);
      expect(result.exported_macros).toContain('my_macro');
      expect(result.exported_macros).toContain('another_macro');
    });

    it('should detect macro_use imports', () => {
      const code = `
        #[macro_use]
        extern crate serde_derive;
        
        #[macro_use]
        extern crate lazy_static;
      `;

      const result = handle_macro_namespace(code);
      
      expect(result.imported_macros).toHaveLength(2);
      expect(result.imported_macros).toContain('serde_derive::*');
      expect(result.imported_macros).toContain('lazy_static::*');
    });

    it('should handle macro imports from specific modules', () => {
      const code = `
        use some_crate::macros::*;
        use another_crate::proc_macros::*;
      `;

      const result = handle_macro_namespace(code);
      
      expect(result.imported_macros.some(m => m.includes('macros::*'))).toBe(true);
    });

    it('should handle code without macros', () => {
      const code = `
        fn regular_function() {}
        struct RegularStruct {}
      `;

      const result = handle_macro_namespace(code);
      
      expect(result.exported_macros).toHaveLength(0);
      expect(result.imported_macros).toHaveLength(0);
    });
  });

  describe('handle_path_keywords', () => {
    it('should resolve self:: paths', () => {
      const result = handle_path_keywords('self::submodule', 'crate::module');
      
      expect(result).toBe('crate::module::submodule');
    });

    it('should resolve super:: paths', () => {
      const result = handle_path_keywords('super::sibling', 'crate::parent::child');
      
      expect(result).toBe('crate::parent::sibling');
    });

    it('should handle multiple super:: levels', () => {
      const result = handle_path_keywords('super::super::ancestor', 'crate::a::b::c');
      
      expect(result).toBe('crate::a::ancestor');
    });

    it('should preserve crate:: paths', () => {
      const result = handle_path_keywords('crate::module', 'anywhere::else');
      
      expect(result).toBe('crate::module');
    });

    it('should resolve relative paths from current module', () => {
      const result = handle_path_keywords('submodule', 'crate::current');
      
      expect(result).toBe('crate::current::submodule');
    });

    it('should handle root module correctly', () => {
      const result = handle_path_keywords('super::module', 'crate');
      
      expect(result).toBe('module'); // At crate root, super goes nowhere
    });

    it('should handle complex paths', () => {
      const result = handle_path_keywords(
        'self::sub::super::other',
        'crate::module'
      );
      
      expect(result).toBe('crate::module::sub::super::other');
      // Note: super as part of path, not keyword
    });
  });

  describe('Edge cases', () => {
    it('should handle empty source code', () => {
      const imports1 = handle_complex_use_statements('');
      const imports2 = handle_extern_crate('');
      const macros = handle_macro_namespace('');
      
      expect(imports1).toHaveLength(0);
      expect(imports2).toHaveLength(0);
      expect(macros.exported_macros).toHaveLength(0);
      expect(macros.imported_macros).toHaveLength(0);
    });

    it('should handle malformed use statements gracefully', () => {
      const testCases = [
        'use',
        'use ;',
        'use ::;',
        'use {',
      ];

      for (const useText of testCases) {
        const imports = handle_complex_use_statements(useText);
        // Should not crash, may return empty or partial results
        expect(Array.isArray(imports)).toBe(true);
      }
    });

    it('should handle Unicode in Rust identifiers', () => {
      const code = `
        extern crate 日本語_crate as 日本;
        #[macro_export]
        macro_rules! 你好 {
          () => {};
        }
      `;

      const imports = handle_extern_crate(code);
      const macros = handle_macro_namespace(code);
      
      expect(imports.some(i => i.namespace_name === '日本')).toBe(true);
      expect(macros.exported_macros).toContain('你好');
    });
  });
});