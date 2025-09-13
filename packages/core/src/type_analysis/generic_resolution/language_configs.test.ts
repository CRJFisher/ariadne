/**
 * Tests for generic resolution language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_language_config,
  is_generic_parameter
} from './language_configs';

describe('Generic Resolution Language Configurations', () => {
  describe('TypeScript Configuration', () => {
    const language = 'typescript';
    
    it('should get TypeScript configuration', () => {
      const config = get_language_config(language);
      expect(config).toBeDefined();
      expect(config.type_parameter_nodes).toContain('type_parameter');
      expect(config.type_parameter_fields).toContain('type_parameters');
      expect(config.parameter_name_field).toBe('name');
      expect(config.has_lifetime_parameters).toBe(false);
    });
    
    it('should identify common generic parameter names', () => {
      expect(is_generic_parameter('T', language)).toBe(true);
      expect(is_generic_parameter('K', language)).toBe(true);
      expect(is_generic_parameter('V', language)).toBe(true);
      expect(is_generic_parameter('E', language)).toBe(true);
      expect(is_generic_parameter('R', language)).toBe(true);
      expect(is_generic_parameter('TKey', language)).toBe(true);
      expect(is_generic_parameter('TValue', language)).toBe(true);
    });
    
    it('should identify generic patterns', () => {
      // Single uppercase letters
      expect(is_generic_parameter('A', language)).toBe(true);
      expect(is_generic_parameter('B', language)).toBe(true);
      expect(is_generic_parameter('Z', language)).toBe(true);
      
      // T-prefixed patterns
      expect(is_generic_parameter('TUser', language)).toBe(true);
      expect(is_generic_parameter('TResponse', language)).toBe(true);
      
      // Not generic
      expect(is_generic_parameter('string', language)).toBe(false);
      expect(is_generic_parameter('User', language)).toBe(false);
      expect(is_generic_parameter('lowercase', language)).toBe(false);
    });
    
    it('should have proper type parameter configuration', () => {
      const config = get_language_config(language);
      expect(config.parameter_constraint_field).toBe('constraint');
      expect(config.parameter_default_field).toBe('default');
      expect(config.has_variance_annotations).toBe(false);
      expect(config.has_associated_types).toBe(false);
    });
  });

  describe('JavaScript Configuration', () => {
    const language = 'javascript';
    
    it('should get JavaScript configuration', () => {
      const config = get_language_config(language);
      expect(config).toBeDefined();
      // JavaScript should have minimal generic support
      expect(config.type_parameter_nodes.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle generic patterns for JSDoc', () => {
      // JavaScript might support some generic patterns for JSDoc
      expect(is_generic_parameter('T', language)).toBeDefined();
      expect(typeof is_generic_parameter('T', language)).toBe('boolean');
    });
  });

  describe('Python Configuration', () => {
    const language = 'python';
    
    it('should get Python configuration', () => {
      const config = get_language_config(language);
      expect(config).toBeDefined();
      expect(config.type_parameter_nodes).toBeDefined();
      expect(config.generic_patterns).toBeDefined();
    });
    
    it('should identify Python generic patterns', () => {
      // Python typically uses TypeVar patterns
      expect(is_generic_parameter('T', language)).toBeDefined();
      
      // Python might have different common names
      const config = get_language_config(language);
      expect(config.common_generic_names).toBeDefined();
    });
    
    it('should not have lifetime parameters', () => {
      const config = get_language_config(language);
      expect(config.has_lifetime_parameters).toBe(false);
    });
  });

  describe('Rust Configuration', () => {
    const language = 'rust';
    
    it('should get Rust configuration', () => {
      const config = get_language_config(language);
      expect(config).toBeDefined();
      expect(config.type_parameter_nodes).toBeDefined();
      expect(config.parameter_name_field).toBeDefined();
    });
    
    it('should support lifetime parameters', () => {
      const config = get_language_config(language);
      expect(config.has_lifetime_parameters).toBe(true);
    });
    
    it('should support associated types', () => {
      const config = get_language_config(language);
      expect(config.has_associated_types).toBe(true);
    });
    
    it('should identify Rust generic patterns', () => {
      // Rust uses similar patterns to TypeScript
      expect(is_generic_parameter('T', language)).toBe(true);
      expect(is_generic_parameter('K', language)).toBe(true);
      expect(is_generic_parameter('V', language)).toBe(true);
    });
    
    it('should have proper parameter field configuration', () => {
      const config = get_language_config(language);
      expect(config.parameter_name_field).toBeDefined();
      expect(config.parameter_constraint_field).toBeDefined();
    });
  });

  describe('Cross-Language Patterns', () => {
    it('should have consistent basic generic parameter recognition', () => {
      const languages = ['typescript', 'javascript', 'python', 'rust'];
      
      languages.forEach(lang => {
        // All languages should at least recognize 'T' as a potential generic
        const result = is_generic_parameter('T', lang as any);
        expect(typeof result).toBe('boolean');
        
        // All languages should have a valid config
        const config = get_language_config(lang as any);
        expect(config).toBeDefined();
        expect(Array.isArray(config.type_parameter_nodes)).toBe(true);
        expect(Array.isArray(config.generic_patterns)).toBe(true);
      });
    });
    
    it('should have different capabilities per language', () => {
      // TypeScript and JavaScript should not have lifetime parameters
      expect(get_language_config('typescript').has_lifetime_parameters).toBe(false);
      expect(get_language_config('javascript').has_lifetime_parameters).toBe(false);
      
      // Rust should have lifetime parameters
      expect(get_language_config('rust').has_lifetime_parameters).toBe(true);
      
      // Only Rust should have associated types
      expect(get_language_config('rust').has_associated_types).toBe(true);
      expect(get_language_config('typescript').has_associated_types).toBe(false);
    });
  });

  describe('Generic Pattern Validation', () => {
    it('should correctly distinguish generic from concrete types', () => {
      const language = 'typescript';
      
      // Definitely generic
      expect(is_generic_parameter('T', language)).toBe(true);
      expect(is_generic_parameter('U', language)).toBe(true);
      expect(is_generic_parameter('TUser', language)).toBe(true);
      
      // Definitely not generic
      expect(is_generic_parameter('string', language)).toBe(false);
      expect(is_generic_parameter('number', language)).toBe(false);
      expect(is_generic_parameter('User', language)).toBe(false);
      expect(is_generic_parameter('userType', language)).toBe(false);
      expect(is_generic_parameter('', language)).toBe(false);
    });
    
    it('should handle edge cases', () => {
      const language = 'typescript';
      
      // Edge cases that should not be generic
      expect(is_generic_parameter('a', language)).toBe(false); // lowercase
      expect(is_generic_parameter('1', language)).toBe(false); // number
      expect(is_generic_parameter('_', language)).toBe(false); // underscore
    });
  });

  describe('Default Language Handling', () => {
    it('should default to JavaScript config for unknown languages', () => {
      const unknownLanguage = 'unknown' as any;
      const jsConfig = get_language_config('javascript');
      const unknownConfig = get_language_config(unknownLanguage);
      
      expect(unknownConfig).toEqual(jsConfig);
    });
    
    it('should handle generic parameter checking for unknown languages', () => {
      const unknownLanguage = 'unknown' as any;
      
      // Should not throw, should return same as JavaScript
      expect(() => is_generic_parameter('T', unknownLanguage)).not.toThrow();
      
      const jsResult = is_generic_parameter('T', 'javascript');
      const unknownResult = is_generic_parameter('T', unknownLanguage);
      expect(unknownResult).toBe(jsResult);
    });
  });
});