/**
 * Tests for language-specific export configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_export_config,
  is_export_node,
  is_exportable_definition,
  matches_export_pattern,
  is_private_symbol,
  get_export_list_identifier,
  has_implicit_exports,
  supports_commonjs,
  supports_type_exports,
  has_visibility_modifiers
} from './language_configs';

describe('Language Configurations', () => {
  describe('JavaScript Configuration', () => {
    const language = 'javascript';
    
    it('should identify export nodes', () => {
      expect(is_export_node('export_statement', language)).toBe(true);
      expect(is_export_node('export_clause', language)).toBe(true);
      expect(is_export_node('export_specifier', language)).toBe(true);
      expect(is_export_node('function_declaration', language)).toBe(false);
    });
    
    it('should identify exportable definitions', () => {
      expect(is_exportable_definition('function_declaration', language)).toBe(true);
      expect(is_exportable_definition('class_declaration', language)).toBe(true);
      expect(is_exportable_definition('variable_declaration', language)).toBe(true);
      expect(is_exportable_definition('if_statement', language)).toBe(false);
    });
    
    it('should match export patterns', () => {
      expect(matches_export_pattern('export default class', 'default_export', language)).toBe(true);
      expect(matches_export_pattern('module.exports = foo', 'default_export', language)).toBe(true);
      expect(matches_export_pattern('export { foo }', 'named_export', language)).toBe(true);
      expect(matches_export_pattern('exports.bar = baz', 'named_export', language)).toBe(true);
      expect(matches_export_pattern('export * from "mod"', 'reexport', language)).toBe(true);
    });
    
    it('should support CommonJS but not type exports', () => {
      expect(supports_commonjs(language)).toBe(true);
      expect(supports_type_exports(language)).toBe(false);
      expect(has_implicit_exports(language)).toBe(false);
    });
  });
  
  describe('TypeScript Configuration', () => {
    const language = 'typescript';
    
    it('should include JavaScript nodes plus TypeScript-specific', () => {
      expect(is_exportable_definition('function_declaration', language)).toBe(true);
      expect(is_exportable_definition('interface_declaration', language)).toBe(true);
      expect(is_exportable_definition('type_alias_declaration', language)).toBe(true);
      expect(is_exportable_definition('enum_declaration', language)).toBe(true);
    });
    
    it('should match type export patterns', () => {
      expect(matches_export_pattern('export type { Foo }', 'custom', language)).toBe(true);
      expect(matches_export_pattern('export interface Bar', 'named_export', language)).toBe(true);
    });
    
    it('should support type exports', () => {
      expect(supports_type_exports(language)).toBe(true);
      expect(supports_commonjs(language)).toBe(true);
    });
  });
  
  describe('Python Configuration', () => {
    const language = 'python';
    
    it('should identify Python export nodes', () => {
      expect(is_export_node('assignment', language)).toBe(true);
      expect(is_export_node('function_definition', language)).toBe(true);
      expect(is_export_node('class_definition', language)).toBe(true);
    });
    
    it('should match __all__ pattern', () => {
      expect(matches_export_pattern('__all__ = ["foo"]', 'named_export', language)).toBe(true);
      expect(matches_export_pattern('exports = []', 'named_export', language)).toBe(false);
    });
    
    it('should identify private symbols', () => {
      expect(is_private_symbol('_private', language)).toBe(true);
      expect(is_private_symbol('__dunder__', language)).toBe(true);
      expect(is_private_symbol('public', language)).toBe(false);
    });
    
    it('should have implicit exports and __all__ identifier', () => {
      expect(has_implicit_exports(language)).toBe(true);
      expect(get_export_list_identifier(language)).toBe('__all__');
      expect(supports_commonjs(language)).toBe(false);
    });
  });
  
  describe('Rust Configuration', () => {
    const language = 'rust';
    
    it('should identify Rust exportable definitions', () => {
      // Rust doesn't have export nodes - items are exportable based on visibility
      expect(is_export_node('function_item', language)).toBe(false);
      expect(is_exportable_definition('function_item', language)).toBe(true);
      expect(is_exportable_definition('struct_item', language)).toBe(true);
      expect(is_exportable_definition('trait_item', language)).toBe(true);
    });
    
    it('should match pub patterns', () => {
      expect(matches_export_pattern('pub fn foo()', 'named_export', language)).toBe(true);
      expect(matches_export_pattern('pub use crate::bar', 'reexport', language)).toBe(true);
      expect(matches_export_pattern('fn private()', 'named_export', language)).toBe(false);
    });
    
    it('should have visibility modifiers', () => {
      expect(has_visibility_modifiers(language)).toBe(true);
      expect(has_implicit_exports(language)).toBe(false);
      expect(supports_type_exports(language)).toBe(false);
    });
    
    it('should have pub in export keywords', () => {
      const config = get_export_config(language);
      expect(config.export_keywords).toContain('pub');
      expect(config.visibility_keywords).toContain('pub(crate)');
    });
  });
  
  describe('Configuration Utilities', () => {
    it('should throw for unsupported language', () => {
      expect(() => get_export_config('unknown' as any)).toThrow();
    });
    
    it('should return undefined for languages without export list', () => {
      expect(get_export_list_identifier('javascript')).toBeUndefined();
      expect(get_export_list_identifier('rust')).toBeUndefined();
    });
    
    it('should correctly identify private symbols', () => {
      expect(is_private_symbol('_internal', 'python')).toBe(true);
      expect(is_private_symbol('_internal', 'javascript')).toBe(false);
      expect(is_private_symbol('normal', 'python')).toBe(false);
    });
  });
  
  describe('Pattern Matching', () => {
    it('should match complex JavaScript patterns', () => {
      expect(matches_export_pattern(
        'export { foo as bar } from "./mod"',
        'reexport',
        'javascript'
      )).toBe(true);
      
      expect(matches_export_pattern(
        'export * as ns from "./mod"',
        'reexport',
        'javascript'
      )).toBe(true);
      
      // CommonJS object export
      expect(matches_export_pattern(
        'module.exports = { foo, bar }',
        'custom',
        'javascript'
      )).toBe(true);
    });
    
    it('should match Rust visibility patterns', () => {
      const config = get_export_config('rust');
      const patterns = config.patterns.custom?.visibility;
      
      if (patterns) {
        expect(patterns[0].test('pub(crate)')).toBe(true);
        expect(patterns[1].test('pub(super)')).toBe(true);
        expect(patterns[2].test('pub(in crate::module)')).toBe(true);
      }
    });
    
    it('should not match invalid patterns', () => {
      expect(matches_export_pattern(
        'const foo = bar',
        'named_export',
        'javascript'
      )).toBe(false);
      
      expect(matches_export_pattern(
        'import { foo } from "./mod"',
        'reexport',
        'javascript'
      )).toBe(false);
    });
  });
  
  describe('Field Names Configuration', () => {
    it('should have proper field names for JavaScript', () => {
      const config = get_export_config('javascript');
      expect(config.field_names.declaration).toBe('declaration');
      expect(config.field_names.specifiers).toBe('specifiers');
      expect(config.field_names.source).toBe('source');
      expect(config.field_names.name).toBe('name');
    });
    
    it('should have proper field names for Python', () => {
      const config = get_export_config('python');
      expect(config.field_names.left).toBe('left');
      expect(config.field_names.right).toBe('right');
      expect(config.field_names.name).toBe('name');
    });
    
    it('should have proper field names for Rust', () => {
      const config = get_export_config('rust');
      expect(config.field_names.name).toBe('name');
      expect(config.field_names.value).toBe('value');
      expect(config.field_names.declaration).toBe('declaration');
    });
  });
  
  describe('Feature Flags', () => {
    it('should have correct feature flags for each language', () => {
      // JavaScript
      const jsConfig = get_export_config('javascript');
      expect(jsConfig.features.implicit_exports).toBe(false);
      expect(jsConfig.features.commonjs_support).toBe(true);
      expect(jsConfig.features.type_exports).toBe(false);
      expect(jsConfig.features.visibility_modifiers).toBe(false);
      expect(jsConfig.features.visibility_on_item).toBeUndefined();
      
      // TypeScript
      const tsConfig = get_export_config('typescript');
      expect(tsConfig.features.type_exports).toBe(true);
      expect(tsConfig.features.commonjs_support).toBe(true);
      expect(tsConfig.features.visibility_on_item).toBeUndefined();
      
      // Python
      const pyConfig = get_export_config('python');
      expect(pyConfig.features.implicit_exports).toBe(true);
      expect(pyConfig.features.export_list_identifier).toBe('__all__');
      expect(pyConfig.features.private_prefix).toBe('_');
      expect(pyConfig.features.visibility_on_item).toBeUndefined();
      
      // Rust
      const rustConfig = get_export_config('rust');
      expect(rustConfig.features.visibility_modifiers).toBe(true);
      expect(rustConfig.features.visibility_on_item).toBe(true);
      expect(rustConfig.features.implicit_exports).toBe(false);
    });
  });
  
  describe('Export Node Types', () => {
    it('should have proper export node types for JavaScript/TypeScript', () => {
      const jsConfig = get_export_config('javascript');
      expect(jsConfig.export_node_types).toContain('export_statement');
      expect(jsConfig.export_node_types).toContain('export_clause');
      expect(jsConfig.export_node_types).toContain('export_specifier');
    });
    
    it('should have proper export node types for Python', () => {
      const pyConfig = get_export_config('python');
      expect(pyConfig.export_node_types).toContain('assignment');
      expect(pyConfig.export_node_types).toContain('function_definition');
      expect(pyConfig.export_node_types).toContain('class_definition');
    });
    
    it('should have use_declaration for Rust', () => {
      const rustConfig = get_export_config('rust');
      expect(rustConfig.export_node_types).toContain('use_declaration');
    });
  });
  
  describe('Exportable Definition Types', () => {
    it('should include all JavaScript exportable types', () => {
      const jsConfig = get_export_config('javascript');
      expect(jsConfig.exportable_definition_types).toContain('function_declaration');
      expect(jsConfig.exportable_definition_types).toContain('class_declaration');
      expect(jsConfig.exportable_definition_types).toContain('variable_declaration');
      expect(jsConfig.exportable_definition_types).toContain('lexical_declaration');
    });
    
    it('should include TypeScript-specific types', () => {
      const tsConfig = get_export_config('typescript');
      expect(tsConfig.exportable_definition_types).toContain('interface_declaration');
      expect(tsConfig.exportable_definition_types).toContain('type_alias_declaration');
      expect(tsConfig.exportable_definition_types).toContain('enum_declaration');
      expect(tsConfig.exportable_definition_types).toContain('namespace_declaration');
    });
    
    it('should include Rust-specific types', () => {
      const rustConfig = get_export_config('rust');
      expect(rustConfig.exportable_definition_types).toContain('function_item');
      expect(rustConfig.exportable_definition_types).toContain('struct_item');
      expect(rustConfig.exportable_definition_types).toContain('enum_item');
      expect(rustConfig.exportable_definition_types).toContain('trait_item');
      expect(rustConfig.exportable_definition_types).toContain('impl_item');
      expect(rustConfig.exportable_definition_types).toContain('mod_item');
      expect(rustConfig.exportable_definition_types).toContain('type_item');
      expect(rustConfig.exportable_definition_types).toContain('const_item');
      expect(rustConfig.exportable_definition_types).toContain('static_item');
      expect(rustConfig.exportable_definition_types).toContain('macro_definition');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle namespace export patterns', () => {
      expect(matches_export_pattern(
        'export * as Utils',
        'namespace_export',
        'javascript'
      )).toBe(true);
      
      expect(matches_export_pattern(
        'pub use module::*',
        'namespace_export',
        'rust'
      )).toBe(true);
    });
    
    it('should handle empty custom patterns gracefully', () => {
      // Python has no custom patterns
      const pyConfig = get_export_config('python');
      expect(matches_export_pattern(
        'anything',
        'custom',
        'python'
      )).toBe(false);
    });
    
    it('should handle re-export patterns', () => {
      // Python re-exports through imports
      expect(matches_export_pattern(
        'from module import something',
        'reexport',
        'python'
      )).toBe(true);
      
      // Rust pub use
      expect(matches_export_pattern(
        'pub use crate::module::Type',
        'reexport',
        'rust'
      )).toBe(true);
    });
  });
});