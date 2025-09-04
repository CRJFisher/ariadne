/**
 * Tests for language configuration definitions
 */

import { describe, it, expect } from 'vitest';
import {
  LANGUAGE_CONFIGS,
  getLanguageConfig,
  isCallExpression,
  isMethodExpression,
  isFunctionDefinition
} from './language_configs';
import { Language } from '@ariadnejs/types';

describe('Language Configurations', () => {
  
  describe('Configuration structure', () => {
    const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];
    
    it('should have configurations for all supported languages', () => {
      languages.forEach(lang => {
        expect(LANGUAGE_CONFIGS[lang]).toBeDefined();
      });
    });
    
    it('should have required fields in all configurations', () => {
      languages.forEach(lang => {
        const config = LANGUAGE_CONFIGS[lang];
        
        // Core fields
        expect(config.call_expression_types).toBeDefined();
        expect(Array.isArray(config.call_expression_types)).toBe(true);
        expect(config.function_field).toBeDefined();
        expect(typeof config.function_field).toBe('string');
        expect(config.arguments_field).toBeDefined();
        expect(typeof config.arguments_field).toBe('string');
        
        // Method call fields
        expect(config.method_expression_types).toBeDefined();
        expect(Array.isArray(config.method_expression_types)).toBe(true);
        expect(config.method_object_field).toBeDefined();
        expect(config.method_property_field).toBeDefined();
        
        // Function definition fields
        expect(config.function_definition_types).toBeDefined();
        expect(Array.isArray(config.function_definition_types)).toBe(true);
        expect(config.function_name_fields).toBeDefined();
        expect(Array.isArray(config.function_name_fields)).toBe(true);
        
        // Constructor patterns
        expect(config.constructor_patterns).toBeDefined();
        expect(typeof config.constructor_patterns.capitalized_convention).toBe('boolean');
      });
    });
  });
  
  describe('JavaScript configuration', () => {
    const config = LANGUAGE_CONFIGS.javascript;
    
    it('should have correct call expression types', () => {
      expect(config.call_expression_types).toContain('call_expression');
      expect(config.call_expression_types).toContain('new_expression');
    });
    
    it('should have correct field names', () => {
      expect(config.function_field).toBe('function');
      expect(config.arguments_field).toBe('arguments');
      expect(config.method_property_field).toBe('property');
    });
    
    it('should have new_expression constructor pattern', () => {
      expect(config.constructor_patterns.new_expression_type).toBe('new_expression');
      expect(config.constructor_patterns.capitalized_convention).toBe(true);
    });
    
    it('should have function definition types', () => {
      expect(config.function_definition_types).toContain('function_declaration');
      expect(config.function_definition_types).toContain('arrow_function');
      expect(config.function_definition_types).toContain('method_definition');
    });
  });
  
  describe('TypeScript configuration', () => {
    const config = LANGUAGE_CONFIGS.typescript;
    
    it('should extend JavaScript configuration', () => {
      expect(config.call_expression_types).toEqual(LANGUAGE_CONFIGS.javascript.call_expression_types);
      expect(config.function_field).toBe(LANGUAGE_CONFIGS.javascript.function_field);
    });
    
    it('should have TypeScript-specific features', () => {
      expect(config.function_definition_types).toContain('method_signature');
      expect(config.special_types?.decorator).toBe('decorator');
    });
  });
  
  describe('Python configuration', () => {
    const config = LANGUAGE_CONFIGS.python;
    
    it('should have Python-specific node types', () => {
      expect(config.call_expression_types).toContain('call');
      expect(config.function_field).toBe('function');
      expect(config.method_expression_types).toContain('attribute');
    });
    
    it('should have correct field names', () => {
      expect(config.method_property_field).toBe('attribute');
      expect(config.method_object_field).toBe('object');
    });
    
    it('should only use capitalization for constructors', () => {
      expect(config.constructor_patterns.new_expression_type).toBeUndefined();
      expect(config.constructor_patterns.capitalized_convention).toBe(true);
    });
    
    it('should have Python-specific special types', () => {
      expect(config.special_types?.decorator).toBe('decorator');
      expect(config.special_types?.comprehension_types).toContain('list_comprehension');
      expect(config.special_types?.comprehension_types).toContain('dictionary_comprehension');
    });
  });
  
  describe('Rust configuration', () => {
    const config = LANGUAGE_CONFIGS.rust;
    
    it('should have Rust-specific node types', () => {
      expect(config.call_expression_types).toContain('call_expression');
      expect(config.method_expression_types).toContain('field_expression');
      expect(config.method_expression_types).toContain('scoped_identifier');
    });
    
    it('should have Rust-specific field names', () => {
      expect(config.method_object_field).toBe('value');
      expect(config.method_property_field).toBe('field');
    });
    
    it('should have macro invocation support', () => {
      expect(config.special_types?.macro_invocation).toBe('macro_invocation');
    });
    
    it('should have struct literal constructor pattern', () => {
      expect(config.constructor_patterns.struct_literal_type).toBe('struct_expression');
      expect(config.constructor_patterns.capitalized_convention).toBe(true);
    });
  });
  
  describe('Helper functions', () => {
    
    describe('getLanguageConfig', () => {
      it('should return configuration for valid languages', () => {
        expect(getLanguageConfig('javascript')).toBe(LANGUAGE_CONFIGS.javascript);
        expect(getLanguageConfig('python')).toBe(LANGUAGE_CONFIGS.python);
      });
      
      it('should throw for unsupported languages', () => {
        expect(() => getLanguageConfig('unknown' as Language)).toThrow('Unsupported language');
      });
    });
    
    describe('isCallExpression', () => {
      it('should identify JavaScript call expressions', () => {
        expect(isCallExpression('call_expression', 'javascript')).toBe(true);
        expect(isCallExpression('new_expression', 'javascript')).toBe(true);
        expect(isCallExpression('identifier', 'javascript')).toBe(false);
      });
      
      it('should identify Python call expressions', () => {
        expect(isCallExpression('call', 'python')).toBe(true);
        expect(isCallExpression('identifier', 'python')).toBe(false);
      });
    });
    
    describe('isMethodExpression', () => {
      it('should identify JavaScript method expressions', () => {
        expect(isMethodExpression('member_expression', 'javascript')).toBe(true);
        expect(isMethodExpression('identifier', 'javascript')).toBe(false);
      });
      
      it('should identify Python method expressions', () => {
        expect(isMethodExpression('attribute', 'python')).toBe(true);
        expect(isMethodExpression('identifier', 'python')).toBe(false);
      });
      
      it('should identify Rust method expressions', () => {
        expect(isMethodExpression('field_expression', 'rust')).toBe(true);
        expect(isMethodExpression('scoped_identifier', 'rust')).toBe(true);
      });
    });
    
    describe('isFunctionDefinition', () => {
      it('should identify JavaScript function definitions', () => {
        expect(isFunctionDefinition('function_declaration', 'javascript')).toBe(true);
        expect(isFunctionDefinition('arrow_function', 'javascript')).toBe(true);
        expect(isFunctionDefinition('call_expression', 'javascript')).toBe(false);
      });
      
      it('should identify Python function definitions', () => {
        expect(isFunctionDefinition('function_definition', 'python')).toBe(true);
        expect(isFunctionDefinition('call', 'python')).toBe(false);
      });
      
      it('should identify Rust function definitions', () => {
        expect(isFunctionDefinition('function_item', 'rust')).toBe(true);
        expect(isFunctionDefinition('closure_expression', 'rust')).toBe(true);
      });
    });
  });
  
  describe('Configuration completeness', () => {
    const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];
    
    it('should have non-empty arrays for all required fields', () => {
      languages.forEach(lang => {
        const config = LANGUAGE_CONFIGS[lang];
        
        expect(config.call_expression_types.length).toBeGreaterThan(0);
        expect(config.method_expression_types.length).toBeGreaterThan(0);
        expect(config.function_definition_types.length).toBeGreaterThan(0);
        expect(config.function_name_fields.length).toBeGreaterThan(0);
      });
    });
    
    it('should not have overlapping types between categories', () => {
      languages.forEach(lang => {
        const config = LANGUAGE_CONFIGS[lang];
        
        // Call expressions and function definitions should not overlap
        const callTypes = new Set(config.call_expression_types);
        const defTypes = new Set(config.function_definition_types);
        
        const intersection = [...callTypes].filter(x => defTypes.has(x));
        expect(intersection).toHaveLength(0);
      });
    });
  });
});