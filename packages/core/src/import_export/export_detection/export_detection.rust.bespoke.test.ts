/**
 * Tests for Rust-specific bespoke export detection
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import {
  handle_visibility_modifiers,
  handle_pub_use_reexports,
  handle_macro_exports,
  handle_trait_impl_exports,
  handle_module_exports
} from './export_detection.rust.bespoke';

describe('Rust bespoke export detection', () => {
  const parser = new Parser();
  parser.setLanguage(Rust);
  
  describe('handle_visibility_modifiers', () => {
    it('should detect pub(crate) visibility', () => {
      const code = `
pub(crate) fn crate_function() {}
pub(crate) struct CrateStruct;
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.map(e => e.name)).toContain('crate_function');
      expect(exports.map(e => e.name)).toContain('CrateStruct');
      expect(exports.every(e => e.visibility === 'pub(crate)')).toBe(true);
      expect(exports.every(e => e.restricted)).toBe(true);
    });
    
    it('should detect pub(super) visibility', () => {
      const code = `
pub(super) fn super_function() {}
pub(super) enum SuperEnum { A, B }
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.map(e => e.name)).toContain('super_function');
      expect(exports.map(e => e.name)).toContain('SuperEnum');
      expect(exports.every(e => e.visibility === 'pub(super)')).toBe(true);
    });
    
    it('should detect pub(in path) visibility', () => {
      const code = `
pub(in crate::module) fn restricted_function() {}
pub(in super::parent) struct RestrictedStruct;
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.every(e => e.visibility === 'pub(in path)')).toBe(true);
      expect(exports.every(e => e.restricted)).toBe(true);
    });
    
    it('should skip private items', () => {
      const code = `
fn private_function() {}
struct PrivateStruct;
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      expect(exports).toHaveLength(0);
    });
    
    it('should detect plain pub visibility', () => {
      const code = `
pub fn public_function() {}
pub struct PublicStruct;
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.every(e => e.visibility === 'pub')).toBe(true);
      expect(exports.every(e => !e.restricted)).toBe(true);
    });
  });
  
  describe('handle_pub_use_reexports', () => {
    it('should detect simple pub use', () => {
      const code = `
pub use crate::module::function;
pub use std::collections::HashMap;
      `;
      const tree = parser.parse(code);
      const exports = handle_pub_use_reexports(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.map(e => e.name)).toContain('function');
      expect(exports.map(e => e.name)).toContain('HashMap');
      expect(exports.every(e => e.is_reexport)).toBe(true);
    });
    
    it('should detect pub use with alias', () => {
      const code = `
pub use crate::module::LongName as Short;
pub use super::parent::Item as MyItem;
      `;
      const tree = parser.parse(code);
      const exports = handle_pub_use_reexports(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.map(e => e.name)).toContain('Short');
      expect(exports.map(e => e.name)).toContain('MyItem');
      expect(exports.find(e => e.name === 'Short')?.original_name).toBe('LongName');
      expect(exports.find(e => e.name === 'MyItem')?.original_name).toBe('Item');
    });
    
    it('should detect pub use with glob', () => {
      const code = `
pub use crate::prelude::*;
pub use module::exports::*;
      `;
      const tree = parser.parse(code);
      const exports = handle_pub_use_reexports(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.every(e => e.name === '*')).toBe(true);
      expect(exports.every(e => e.kind === 'namespace')).toBe(true);
    });
    
    it('should detect pub use with list', () => {
      const code = `
pub use crate::module::{Item1, Item2, Item3};
pub use std::{io, fs, path::Path};
      `;
      const tree = parser.parse(code);
      const exports = handle_pub_use_reexports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThan(0);
      expect(exports.some(e => e.name === 'Item1')).toBe(true);
      expect(exports.some(e => e.name === 'Item2')).toBe(true);
      expect(exports.some(e => e.name === 'Item3')).toBe(true);
    });
    
    it('should handle restricted visibility on reexports', () => {
      const code = `
pub(crate) use internal::Helper;
pub(super) use parent::Util;
      `;
      const tree = parser.parse(code);
      const exports = handle_pub_use_reexports(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.find(e => e.name === 'Helper')?.visibility).toBe('pub(crate)');
      expect(exports.find(e => e.name === 'Util')?.visibility).toBe('pub(super)');
    });
  });
  
  describe('handle_macro_exports', () => {
    it('should detect macro_export attribute', () => {
      const code = `
#[macro_export]
macro_rules! my_macro {
    () => {};
}
      `;
      const tree = parser.parse(code);
      const exports = handle_macro_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('my_macro');
      expect(exports[0].kind).toBe('macro');
      expect(exports[0].macro_export).toBe(true);
    });
    
    it('should skip macros without macro_export', () => {
      const code = `
macro_rules! internal_macro {
    () => {};
}
      `;
      const tree = parser.parse(code);
      const exports = handle_macro_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(0);
    });
    
    it('should handle multiple macro exports', () => {
      const code = `
#[macro_export]
macro_rules! first_macro {
    () => {};
}

#[macro_export]
macro_rules! second_macro {
    ($x:expr) => { $x };
}
      `;
      const tree = parser.parse(code);
      const exports = handle_macro_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.map(e => e.name)).toContain('first_macro');
      expect(exports.map(e => e.name)).toContain('second_macro');
    });
  });
  
  describe('handle_trait_impl_exports', () => {
    it('should detect public traits', () => {
      const code = `
pub trait MyTrait {
    fn method(&self);
}
      `;
      const tree = parser.parse(code);
      const exports = handle_trait_impl_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('MyTrait');
      expect(exports[0].kind).toBe('trait');
    });
    
    it('should detect public methods in impl blocks', () => {
      const code = `
impl MyStruct {
    pub fn public_method(&self) {}
    fn private_method(&self) {}
}
      `;
      const tree = parser.parse(code);
      const exports = handle_trait_impl_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('public_method');
      expect(exports[0].kind).toBe('method');
      expect(exports[0].impl_for).toContain('MyStruct');
    });
    
    it('should detect trait implementations', () => {
      const code = `
impl Display for MyStruct {
    pub fn fmt(&self, f: &mut Formatter) -> Result {
        Ok(())
    }
}
      `;
      const tree = parser.parse(code);
      const exports = handle_trait_impl_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThan(0);
      const method = exports.find(e => e.name === 'fmt');
      expect(method).toBeDefined();
      expect(method?.trait_impl).toContain('Display');
    });
    
    it('should handle restricted visibility traits', () => {
      const code = `
pub(crate) trait InternalTrait {
    fn internal_method(&self);
}
      `;
      const tree = parser.parse(code);
      const exports = handle_trait_impl_exports(tree.rootNode, code);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('InternalTrait');
      expect(exports[0].visibility).toBe('pub(crate)');
    });
  });
  
  describe('handle_module_exports', () => {
    it('should detect public modules', () => {
      const code = `
pub mod public_module {
    pub fn inner_function() {}
}
      `;
      const tree = parser.parse(code);
      const exports = handle_module_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThan(0);
      const module = exports.find(e => e.name === 'public_module');
      expect(module).toBeDefined();
      expect(module?.kind).toBe('module');
    });
    
    it('should detect nested module paths', () => {
      const code = `
pub mod outer {
    pub mod inner {
        pub mod deep {
            pub fn nested_function() {}
        }
    }
}
      `;
      const tree = parser.parse(code);
      const exports = handle_module_exports(tree.rootNode, code);
      
      const deep = exports.find(e => e.name === 'deep');
      expect(deep).toBeDefined();
      expect(deep?.module_path).toBe('outer::inner::deep');
    });
    
    it('should handle module declarations without body', () => {
      const code = `
pub mod external;
pub(crate) mod internal;
      `;
      const tree = parser.parse(code);
      const exports = handle_module_exports(tree.rootNode, code);
      
      expect(exports.length).toBeGreaterThanOrEqual(2);
      expect(exports.some(e => e.name === 'external')).toBe(true);
      expect(exports.some(e => e.name === 'internal')).toBe(true);
    });
    
    it('should skip private modules', () => {
      const code = `
mod private_module {
    pub fn public_in_private() {}
}
      `;
      const tree = parser.parse(code);
      const exports = handle_module_exports(tree.rootNode, code);
      
      // Should not export the module or its contents
      expect(exports.find(e => e.name === 'private_module')).toBeUndefined();
    });
  });
  
  describe('edge cases', () => {
    it('should handle complex visibility combinations', () => {
      const code = `
pub struct Struct {
    pub field: i32,
    pub(crate) internal: String,
    private: bool,
}
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      // Main struct should be exported
      expect(exports.some(e => e.name === 'Struct')).toBe(true);
    });
    
    it('should handle const and static items', () => {
      const code = `
pub const CONSTANT: i32 = 42;
pub static STATIC: &str = "hello";
pub(crate) static mut MUTABLE: i32 = 0;
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      expect(exports).toHaveLength(3);
      expect(exports.map(e => e.name)).toContain('CONSTANT');
      expect(exports.map(e => e.name)).toContain('STATIC');
      expect(exports.map(e => e.name)).toContain('MUTABLE');
    });
    
    it('should handle type aliases', () => {
      const code = `
pub type Result<T> = std::result::Result<T, Error>;
pub(crate) type InternalAlias = HashMap<String, Value>;
      `;
      const tree = parser.parse(code);
      const exports = handle_visibility_modifiers(tree.rootNode, code);
      
      expect(exports).toHaveLength(2);
      expect(exports.map(e => e.name)).toContain('Result');
      expect(exports.map(e => e.name)).toContain('InternalAlias');
    });
  });
});