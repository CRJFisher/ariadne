/**
 * Tests for generic resolution language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  getLanguageConfig,
  isGenericParameter
} from './language_configs';

describe('Generic Resolution Language Configurations', () => {
  describe('TypeScript Configuration', () => {
    const language = 'typescript';
    
    it('should get TypeScript configuration', () => {
      const config = getLanguageConfig(language);
      expect(config).toBeDefined();
      expect(config.type_parameter_nodes).toContain('type_parameter');
      expect(config.type_parameter_fields).toContain('type_parameters');
      expect(config.parameter_name_field).toBe('name');
      expect(config.has_lifetime_parameters).toBe(false);
    });
    
    it('should identify common generic parameter names', () => {
      expect(isGenericParameter('T', language)).toBe(true);
      expect(isGenericParameter('K', language)).toBe(true);
      expect(isGenericParameter('V', language)).toBe(true);
      expect(isGenericParameter('E', language)).toBe(true);
      expect(isGenericParameter('R', language)).toBe(true);
      expect(isGenericParameter('TKey', language)).toBe(true);
      expect(isGenericParameter('TValue', language)).toBe(true);
    });
    
    it('should identify generic patterns', () => {
      // Single uppercase letters
      expect(isGenericParameter('A', language)).toBe(true);
      expect(isGenericParameter('B', language)).toBe(true);
      expect(isGenericParameter('Z', language)).toBe(true);
      
      // T-prefixed patterns
      expect(isGenericParameter('TUser', language)).toBe(true);
      expect(isGenericParameter('TResponse', language)).toBe(true);
      
      // Not generic
      expect(isGenericParameter('string', language)).toBe(false);
      expect(isGenericParameter('User', language)).toBe(false);
      expect(isGenericParameter('lowercase', language)).toBe(false);
    });
    
    it('should have proper type parameter configuration', () => {
      const config = getLanguageConfig(language);
      expect(config.parameter_constraint_field).toBe('constraint');
      expect(config.parameter_default_field).toBe('default');
      expect(config.has_variance_annotations).toBe(false);
      expect(config.has_associated_types).toBe(false);
    });
  });

  describe('JavaScript Configuration', () => {
    const language = 'javascript';
    
    it('should get JavaScript configuration', () => {
      const config = getLanguageConfig(language);
      expect(config).toBeDefined();
      // JavaScript should have minimal generic support
      expect(config.type_parameter_nodes.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle generic patterns for JSDoc', () => {
      // JavaScript might support some generic patterns for JSDoc
      expect(isGenericParameter('T', language)).toBeDefined();
      expect(typeof isGenericParameter('T', language)).toBe('boolean');
    });
  });

  describe('Python Configuration', () => {
    const language = 'python';
    
    it('should get Python configuration', () => {
      const config = getLanguageConfig(language);
      expect(config).toBeDefined();
      expect(config.type_parameter_nodes).toBeDefined();
      expect(config.generic_patterns).toBeDefined();
    });
    
    it('should identify Python generic patterns', () => {
      // Python typically uses TypeVar patterns
      expect(isGenericParameter('T', language)).toBeDefined();
      
      // Python might have different common names
      const config = getLanguageConfig(language);
      expect(config.common_generic_names).toBeDefined();
    });
    
    it('should not have lifetime parameters', () => {
      const config = getLanguageConfig(language);
      expect(config.has_lifetime_parameters).toBe(false);
    });
  });

  describe('Rust Configuration', () => {
    const language = 'rust';
    
    it('should get Rust configuration', () => {
      const config = getLanguageConfig(language);
      expect(config).toBeDefined();
      expect(config.type_parameter_nodes).toBeDefined();
      expect(config.parameter_name_field).toBeDefined();
    });
    
    it('should support lifetime parameters', () => {
      const config = getLanguageConfig(language);
      expect(config.has_lifetime_parameters).toBe(true);
    });
    
    it('should support associated types', () => {
      const config = getLanguageConfig(language);
      expect(config.has_associated_types).toBe(true);
    });
    
    it('should identify Rust generic patterns', () => {
      // Rust uses similar patterns to TypeScript
      expect(isGenericParameter('T', language)).toBe(true);
      expect(isGenericParameter('K', language)).toBe(true);
      expect(isGenericParameter('V', language)).toBe(true);
    });
    
    it('should have proper parameter field configuration', () => {
      const config = getLanguageConfig(language);
      expect(config.parameter_name_field).toBeDefined();
      expect(config.parameter_constraint_field).toBeDefined();
    });
  });

  describe('Cross-Language Patterns', () => {
    it('should have consistent basic generic parameter recognition', () => {
      const languages = ['typescript', 'javascript', 'python', 'rust'];
      
      languages.forEach(lang => {
        // All languages should at least recognize 'T' as a potential generic
        const result = isGenericParameter('T', lang as any);
        expect(typeof result).toBe('boolean');
        
        // All languages should have a valid config
        const config = getLanguageConfig(lang as any);
        expect(config).toBeDefined();
        expect(Array.isArray(config.type_parameter_nodes)).toBe(true);
        expect(Array.isArray(config.generic_patterns)).toBe(true);
      });
    });
    
    it('should have different capabilities per language', () => {
      // TypeScript and JavaScript should not have lifetime parameters
      expect(getLanguageConfig('typescript').has_lifetime_parameters).toBe(false);
      expect(getLanguageConfig('javascript').has_lifetime_parameters).toBe(false);
      
      // Rust should have lifetime parameters
      expect(getLanguageConfig('rust').has_lifetime_parameters).toBe(true);
      
      // Only Rust should have associated types
      expect(getLanguageConfig('rust').has_associated_types).toBe(true);
      expect(getLanguageConfig('typescript').has_associated_types).toBe(false);
    });
  });

  describe('Generic Pattern Validation', () => {
    it('should correctly distinguish generic from concrete types', () => {
      const language = 'typescript';
      
      // Definitely generic
      expect(isGenericParameter('T', language)).toBe(true);
      expect(isGenericParameter('U', language)).toBe(true);
      expect(isGenericParameter('TUser', language)).toBe(true);
      
      // Definitely not generic
      expect(isGenericParameter('string', language)).toBe(false);
      expect(isGenericParameter('number', language)).toBe(false);
      expect(isGenericParameter('User', language)).toBe(false);
      expect(isGenericParameter('userType', language)).toBe(false);
      expect(isGenericParameter('', language)).toBe(false);
    });
    
    it('should handle edge cases', () => {
      const language = 'typescript';
      
      // Edge cases that should not be generic
      expect(isGenericParameter('a', language)).toBe(false); // lowercase
      expect(isGenericParameter('1', language)).toBe(false); // number
      expect(isGenericParameter('_', language)).toBe(false); // underscore
    });
  });

  describe('Default Language Handling', () => {
    it('should default to JavaScript config for unknown languages', () => {
      const unknownLanguage = 'unknown' as any;
      const jsConfig = getLanguageConfig('javascript');
      const unknownConfig = getLanguageConfig(unknownLanguage);
      
      expect(unknownConfig).toEqual(jsConfig);
    });
    
    it('should handle generic parameter checking for unknown languages', () => {
      const unknownLanguage = 'unknown' as any;
      
      // Should not throw, should return same as JavaScript
      expect(() => isGenericParameter('T', unknownLanguage)).not.toThrow();
      
      const jsResult = isGenericParameter('T', 'javascript');
      const unknownResult = isGenericParameter('T', unknownLanguage);
      expect(unknownResult).toBe(jsResult);
    });
  });
});