/**
 * Tests for language configuration definitions
 */

import { describe, it, expect } from 'vitest';
import { get_language_config, LANGUAGE_CONFIGS } from './language_configs';
import { Language } from '@ariadnejs/types';

describe('language_configs', () => {
  describe('get_language_config', () => {
    it('should return configuration for JavaScript', () => {
      const config = get_language_config('javascript');
      expect(config).toBeDefined();
      expect(config.class_node_types).toContain('class_declaration');
      expect(config.class_node_types).toContain('class');
      expect(config.patterns.supports_decorators).toBe(false);
      expect(config.patterns.constructor_name).toBe('constructor');
    });
    
    it('should return configuration for TypeScript', () => {
      const config = get_language_config('typescript');
      expect(config).toBeDefined();
      expect(config.class_node_types).toContain('class_declaration');
      expect(config.patterns.supports_decorators).toBe(true);
      expect(config.patterns.supports_generics).toBe(true);
      expect(config.access_modifiers.private_keyword).toContain('private');
    });
    
    it('should return configuration for Python', () => {
      const config = get_language_config('python');
      expect(config).toBeDefined();
      expect(config.class_node_types).toContain('class_definition');
      expect(config.fields.superclasses).toBe('superclasses');
      expect(config.patterns.supports_multiple_inheritance).toBe(true);
      expect(config.patterns.constructor_name).toBe('__init__');
    });
    
    it('should return configuration for Rust', () => {
      const config = get_language_config('rust');
      expect(config).toBeDefined();
      expect(config.class_node_types).toContain('struct_item');
      expect(config.class_node_types).toContain('impl_item');
      expect(config.patterns.requires_impl_blocks).toBe(true);
      expect(config.patterns.constructor_name).toBe('new');
    });
    
    it('should throw error for unsupported language', () => {
      expect(() => get_language_config('unknown' as Language))
        .toThrow('No class detection configuration for language: unknown');
    });
  });
  
  describe('configuration structure', () => {
    const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];
    
    languages.forEach(lang => {
      describe(`${lang} configuration`, () => {
        const config = LANGUAGE_CONFIGS[lang];
        
        it('should have required class_node_types', () => {
          expect(config.class_node_types).toBeDefined();
          expect(Array.isArray(config.class_node_types)).toBe(true);
          expect(config.class_node_types.length).toBeGreaterThan(0);
        });
        
        it('should have required fields', () => {
          expect(config.fields).toBeDefined();
          expect(config.fields.name).toBeDefined();
          expect(config.fields.body).toBeDefined();
        });
        
        it('should have member_types configuration', () => {
          expect(config.member_types).toBeDefined();
          expect(Array.isArray(config.member_types.method)).toBe(true);
          expect(Array.isArray(config.member_types.property)).toBe(true);
        });
        
        it('should have method_config', () => {
          expect(config.method_config).toBeDefined();
          expect(config.method_config.name_field).toBeDefined();
          expect(config.method_config.params_field).toBeDefined();
        });
        
        it('should have property_config', () => {
          expect(config.property_config).toBeDefined();
        });
        
        it('should have parameter_types', () => {
          expect(config.parameter_types).toBeDefined();
          expect(Array.isArray(config.parameter_types.regular)).toBe(true);
        });
        
        it('should have access_modifiers', () => {
          expect(config.access_modifiers).toBeDefined();
        });
        
        it('should have patterns', () => {
          expect(config.patterns).toBeDefined();
        });
      });
    });
  });
  
  describe('language-specific features', () => {
    it('JavaScript should have class expression support', () => {
      const config = get_language_config('javascript');
      expect(config.patterns.class_expression).toBe(true);
      expect(config.access_modifiers.private_prefix).toBe('#');
    });
    
    it('TypeScript should have type annotations and generics', () => {
      const config = get_language_config('typescript');
      expect(config.fields.type_parameters).toBe('type_parameters');
      expect(config.fields.heritage).toBe('heritage');
      expect(config.method_config.return_type_field).toBe('return_type');
      expect(config.patterns.supports_generics).toBe(true);
    });
    
    it('Python should have multiple inheritance support', () => {
      const config = get_language_config('python');
      expect(config.fields.superclasses).toBe('superclasses');
      expect(config.patterns.supports_multiple_inheritance).toBe(true);
      expect(config.access_modifiers.private_prefix).toBe('_');
    });
    
    it('Rust should have impl blocks configuration', () => {
      const config = get_language_config('rust');
      expect(config.patterns.requires_impl_blocks).toBe(true);
      expect(config.access_modifiers.public_keyword).toContain('pub');
      expect(config.patterns.supports_generics).toBe(true);
    });
  });
});