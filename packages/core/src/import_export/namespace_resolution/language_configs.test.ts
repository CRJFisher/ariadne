/**
 * Tests for namespace resolution language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_namespace_config,
  is_namespace_import_pattern,
  get_member_separator,
  is_private_member,
  supports_namespace_feature,
  get_namespace_node_types,
  supports_reexports,
  get_visibility_keywords,
  has_default_public_exports,
  get_export_list_name
} from './language_configs';

describe('Namespace Resolution Language Configurations', () => {
  describe('JavaScript Configuration', () => {
    const language = 'javascript';
    
    it('should get JavaScript configuration', () => {
      const config = get_namespace_config(language);
      expect(config).toBeDefined();
      expect(config.namespace_style).toBe('object_property');
      expect(config.member_separator).toBe('.');
    });
    
    it('should identify namespace import patterns', () => {
      expect(is_namespace_import_pattern('import * as', language)).toBe(true);
      expect(is_namespace_import_pattern('const module = require', language)).toBe(true);
      expect(is_namespace_import_pattern('import default', language)).toBe(false);
    });
    
    it('should get correct member separator', () => {
      expect(get_member_separator(language)).toBe('.');
    });
    
    it('should handle private members', () => {
      expect(is_private_member('_private', language)).toBe(true);
      expect(is_private_member('__private', language)).toBe(true);
      expect(is_private_member('public', language)).toBe(false);
    });
    
    it('should support namespace features', () => {
      expect(supports_namespace_feature('commonjs', language)).toBe(true);
      expect(supports_namespace_feature('dynamic_imports', language)).toBe(true);
      expect(supports_namespace_feature('relative_imports', language)).toBe(true);
      expect(supports_namespace_feature('namespace_declarations', language)).toBe(false);
    });
    
    it('should get namespace node types', () => {
      const nodeTypes = get_namespace_node_types(language);
      expect(nodeTypes).toContain('import_statement');
      expect(nodeTypes).toContain('variable_declaration');
      expect(nodeTypes).toContain('call_expression');
    });
    
    it('should support reexports', () => {
      expect(supports_reexports(language)).toBe(true);
    });
    
    it('should have default public exports', () => {
      expect(has_default_public_exports(language)).toBe(true);
    });
  });

  describe('TypeScript Configuration', () => {
    const language = 'typescript';
    
    it('should extend JavaScript configuration', () => {
      const jsConfig = get_namespace_config('javascript');
      const tsConfig = get_namespace_config(language);
      
      expect(tsConfig.member_separator).toBe(jsConfig.member_separator);
      expect(tsConfig.namespace_style).toBe(jsConfig.namespace_style);
    });
    
    it('should support namespace declarations', () => {
      expect(supports_namespace_feature('namespace_declarations', language)).toBe(true);
    });
    
    it('should include TypeScript-specific node types', () => {
      const nodeTypes = get_namespace_node_types(language);
      expect(nodeTypes).toContain('namespace_declaration');
    });
    
    it('should include namespace keyword', () => {
      expect(is_namespace_import_pattern('namespace', language)).toBe(true);
    });
  });

  describe('Python Configuration', () => {
    const language = 'python';
    
    it('should get Python configuration', () => {
      const config = get_namespace_config(language);
      expect(config.namespace_style).toBe('module_import');
      expect(config.member_separator).toBe('.');
    });
    
    it('should identify Python import patterns', () => {
      expect(is_namespace_import_pattern('import', language)).toBe(true);
      expect(is_namespace_import_pattern('from', language)).toBe(true);
      expect(is_namespace_import_pattern('require', language)).toBe(false);
    });
    
    it('should handle Python private members', () => {
      expect(is_private_member('_private', language)).toBe(true);
      expect(is_private_member('__private__', language)).toBe(true);
      expect(is_private_member('public', language)).toBe(false);
    });
    
    it('should get Python node types', () => {
      const nodeTypes = get_namespace_node_types(language);
      expect(nodeTypes).toContain('import_statement');
      expect(nodeTypes).toContain('import_from_statement');
    });
    
    it('should not have default public exports', () => {
      expect(has_default_public_exports(language)).toBe(false);
    });
  });

  describe('Rust Configuration', () => {
    const language = 'rust';
    
    it('should get Rust configuration', () => {
      const config = get_namespace_config(language);
      expect(config.namespace_style).toBe('path_based');
      expect(config.member_separator).toBe('::');
    });
    
    it('should use double colon separator', () => {
      expect(get_member_separator(language)).toBe('::');
    });
    
    it('should identify Rust import patterns', () => {
      expect(is_namespace_import_pattern('use', language)).toBe(true);
      expect(is_namespace_import_pattern('mod', language)).toBe(true);
      expect(is_namespace_import_pattern('import', language)).toBe(false);
    });
    
    it('should handle Rust visibility', () => {
      const visibilityKeywords = get_visibility_keywords(language);
      expect(visibilityKeywords).toContain('pub');
      expect(visibilityKeywords).toContain('pub(crate)');
      expect(visibilityKeywords).toContain('pub(super)');
    });
    
    it('should get Rust node types', () => {
      const nodeTypes = get_namespace_node_types(language);
      expect(nodeTypes).toContain('use_declaration');
      expect(nodeTypes).toContain('mod_item');
    });
    
    it('should not have default public exports', () => {
      expect(has_default_public_exports(language)).toBe(false);
    });
  });

  describe('Feature Support', () => {
    it('should correctly identify language capabilities', () => {
      // CommonJS support
      expect(supports_namespace_feature('commonjs', 'javascript')).toBe(true);
      expect(supports_namespace_feature('commonjs', 'typescript')).toBe(true);
      expect(supports_namespace_feature('commonjs', 'python')).toBe(false);
      expect(supports_namespace_feature('commonjs', 'rust')).toBe(false);
      
      // Relative imports
      expect(supports_namespace_feature('relative_imports', 'javascript')).toBe(true);
      expect(supports_namespace_feature('relative_imports', 'python')).toBe(true);
      expect(supports_namespace_feature('relative_imports', 'rust')).toBe(true);
    });
    
    it('should handle export list names', () => {
      expect(get_export_list_name('python')).toBe('__all__');
      expect(get_export_list_name('javascript')).toBeUndefined();
      expect(get_export_list_name('rust')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown languages gracefully', () => {
      const unknownLanguage = 'unknown' as any;
      
      // Should not throw, but return reasonable defaults
      expect(() => get_namespace_config(unknownLanguage)).not.toThrow();
      expect(supports_namespace_feature('commonjs', unknownLanguage)).toBe(false);
      expect(get_member_separator(unknownLanguage)).toBe('.');
      expect(supports_reexports(unknownLanguage)).toBe(false);
    });
  });
});