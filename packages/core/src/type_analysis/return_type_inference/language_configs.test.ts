/**
 * Tests for return type language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_return_type_config,
  is_type_node,
  get_expression_category,
  ReturnTypeLanguageConfig
} from './language_configs';

describe('Return Type Language Configurations', () => {
  describe('get_return_type_config', () => {
    it('should return TypeScript configuration', () => {
      const config = get_return_type_config('typescript');
      expect(config).toBeDefined();
      expect(config.return_type_field).toBe('return_type');
      expect(config.patterns.has_explicit_annotations).toBe(true);
      expect(config.defaults.void_type).toBe('void');
      expect(config.defaults.async_wrapper).toBe('Promise');
    });

    it('should return JavaScript configuration', () => {
      const config = get_return_type_config('javascript');
      expect(config).toBeDefined();
      expect(config.return_type_field).toBe('');
      expect(config.patterns.has_explicit_annotations).toBe(false);
      expect(config.patterns.has_jsdoc_types).toBe(true);
      expect(config.defaults.void_type).toBe('undefined');
    });

    it('should return Python configuration', () => {
      const config = get_return_type_config('python');
      expect(config).toBeDefined();
      expect(config.return_type_field).toBe('return_type');
      expect(config.patterns.has_explicit_annotations).toBe(true);
      expect(config.patterns.has_docstring_types).toBe(true);
      expect(config.defaults.void_type).toBe('None');
      expect(config.defaults.constructor_type).toBe('None');
    });

    it('should return Rust configuration', () => {
      const config = get_return_type_config('rust');
      expect(config).toBeDefined();
      expect(config.return_type_field).toBe('return_type');
      expect(config.patterns.requires_return_type).toBe(true);
      expect(config.patterns.implicit_returns).toBe(true);
      expect(config.defaults.void_type).toBe('()');
      expect(config.defaults.constructor_type).toBe('Self');
    });
  });

  describe('is_type_node', () => {
    it('should identify TypeScript type nodes', () => {
      const config = get_return_type_config('typescript');
      
      expect(is_type_node('predefined_type', config)).toBe(true);
      expect(is_type_node('type_identifier', config)).toBe(true);
      expect(is_type_node('generic_type', config)).toBe(true);
      expect(is_type_node('array_type', config)).toBe(true);
      expect(is_type_node('union_type', config)).toBe(true);
      expect(is_type_node('object_type', config)).toBe(true);
      
      expect(is_type_node('identifier', config)).toBe(false);
      expect(is_type_node('string', config)).toBe(false);
    });

    it('should identify Python type nodes', () => {
      const config = get_return_type_config('python');
      
      expect(is_type_node('type', config)).toBe(true);
      expect(is_type_node('identifier', config)).toBe(true);
      expect(is_type_node('subscript', config)).toBe(true);
      expect(is_type_node('tuple', config)).toBe(true);
      
      expect(is_type_node('string', config)).toBe(false);
      expect(is_type_node('integer', config)).toBe(false);
    });

    it('should identify Rust type nodes', () => {
      const config = get_return_type_config('rust');
      
      expect(is_type_node('primitive_type', config)).toBe(true);
      expect(is_type_node('type_identifier', config)).toBe(true);
      expect(is_type_node('scoped_type_identifier', config)).toBe(true);
      expect(is_type_node('array_type', config)).toBe(true);
      
      expect(is_type_node('identifier', config)).toBe(false);
      expect(is_type_node('string_literal', config)).toBe(false);
    });
  });

  describe('get_expression_category', () => {
    it('should categorize TypeScript expressions', () => {
      const config = get_return_type_config('typescript');
      
      // Literals
      let result = get_expression_category('string', config);
      expect(result).toEqual({ category: 'literal', type: 'string' });
      
      result = get_expression_category('number', config);
      expect(result).toEqual({ category: 'literal', type: 'number' });
      
      result = get_expression_category('true', config);
      expect(result).toEqual({ category: 'literal', type: 'boolean' });
      
      result = get_expression_category('null', config);
      expect(result).toEqual({ category: 'literal', type: 'null' });
      
      // Collections
      result = get_expression_category('array', config);
      expect(result).toEqual({ category: 'collection', type: 'array' });
      
      result = get_expression_category('object', config);
      expect(result).toEqual({ category: 'collection', type: 'object' });
      
      // Special
      result = get_expression_category('new_expression', config);
      expect(result).toEqual({ category: 'special', type: 'new_expression' });
      
      result = get_expression_category('await_expression', config);
      expect(result).toEqual({ category: 'special', type: 'await_expression' });
      
      // Unknown
      result = get_expression_category('identifier', config);
      expect(result).toBeUndefined();
    });

    it('should categorize Python expressions', () => {
      const config = get_return_type_config('python');
      
      // Literals
      let result = get_expression_category('string', config);
      expect(result).toEqual({ category: 'literal', type: 'string' });
      
      result = get_expression_category('integer', config);
      expect(result).toEqual({ category: 'literal', type: 'number' });
      
      result = get_expression_category('float', config);
      expect(result).toEqual({ category: 'literal', type: 'number' });
      
      result = get_expression_category('none', config);
      expect(result).toEqual({ category: 'literal', type: 'null' });
      
      // Collections
      result = get_expression_category('list', config);
      expect(result).toEqual({ category: 'collection', type: 'array' });
      
      result = get_expression_category('dictionary', config);
      expect(result).toEqual({ category: 'collection', type: 'object' });
      
      result = get_expression_category('set', config);
      expect(result).toEqual({ category: 'collection', type: 'set' });
      
      // Special
      result = get_expression_category('call', config);
      expect(result).toEqual({ category: 'special', type: 'new_expression' });
      
      result = get_expression_category('await', config);
      expect(result).toEqual({ category: 'special', type: 'await_expression' });
    });

    it('should categorize Rust expressions', () => {
      const config = get_return_type_config('rust');
      
      // Literals
      let result = get_expression_category('string_literal', config);
      expect(result).toEqual({ category: 'literal', type: 'string' });
      
      result = get_expression_category('integer_literal', config);
      expect(result).toEqual({ category: 'literal', type: 'number' });
      
      result = get_expression_category('boolean_literal', config);
      expect(result).toEqual({ category: 'literal', type: 'boolean' });
      
      // Collections
      result = get_expression_category('array_expression', config);
      expect(result).toEqual({ category: 'collection', type: 'array' });
      
      result = get_expression_category('struct_expression', config);
      expect(result).toEqual({ category: 'collection', type: 'object' });
      
      // Special
      result = get_expression_category('call_expression', config);
      expect(result).toEqual({ category: 'special', type: 'call_expression' });
    });
  });

  describe('Configuration completeness', () => {
    it('TypeScript config should have all required fields', () => {
      const config = get_return_type_config('typescript');
      validateConfigCompleteness(config);
    });

    it('JavaScript config should have all required fields', () => {
      const config = get_return_type_config('javascript');
      validateConfigCompleteness(config);
    });

    it('Python config should have all required fields', () => {
      const config = get_return_type_config('python');
      validateConfigCompleteness(config);
    });

    it('Rust config should have all required fields', () => {
      const config = get_return_type_config('rust');
      validateConfigCompleteness(config);
    });
  });

  describe('Function modifiers', () => {
    it('should have async keywords configured', () => {
      const tsConfig = get_return_type_config('typescript');
      expect(tsConfig.function_modifiers.async_keywords).toContain('async');
      
      const pyConfig = get_return_type_config('python');
      expect(pyConfig.function_modifiers.async_keywords).toContain('async');
      
      const rustConfig = get_return_type_config('rust');
      expect(rustConfig.function_modifiers.async_keywords).toContain('async');
    });

    it('should have constructor names configured', () => {
      const tsConfig = get_return_type_config('typescript');
      expect(tsConfig.function_modifiers.constructor_names).toContain('constructor');
      
      const pyConfig = get_return_type_config('python');
      expect(pyConfig.function_modifiers.constructor_names).toContain('__init__');
      
      const rustConfig = get_return_type_config('rust');
      expect(rustConfig.function_modifiers.constructor_names).toContain('new');
    });

    it('should have generator indicators where applicable', () => {
      const tsConfig = get_return_type_config('typescript');
      expect(tsConfig.function_modifiers.generator_indicators).toContain('yield');
      
      const pyConfig = get_return_type_config('python');
      expect(pyConfig.function_modifiers.generator_indicators).toContain('yield');
      
      const rustConfig = get_return_type_config('rust');
      expect(rustConfig.function_modifiers.generator_indicators).toHaveLength(0);
    });
  });
});

// Helper function to validate config completeness
function validateConfigCompleteness(config: ReturnTypeLanguageConfig) {
  // Check main fields
  expect(config.return_type_field).toBeDefined();
  expect(config.type_node_types).toBeDefined();
  expect(config.expression_types).toBeDefined();
  expect(config.defaults).toBeDefined();
  expect(config.patterns).toBeDefined();
  expect(config.function_modifiers).toBeDefined();
  
  // Check type_node_types structure
  expect(config.type_node_types.primitive).toBeDefined();
  expect(config.type_node_types.identifier).toBeDefined();
  expect(config.type_node_types.generic).toBeDefined();
  expect(config.type_node_types.array).toBeDefined();
  expect(config.type_node_types.tuple).toBeDefined();
  expect(config.type_node_types.union).toBeDefined();
  expect(config.type_node_types.optional).toBeDefined();
  expect(config.type_node_types.function).toBeDefined();
  expect(config.type_node_types.object).toBeDefined();
  
  // Check expression_types structure
  expect(config.expression_types.literals).toBeDefined();
  expect(config.expression_types.literals.string).toBeDefined();
  expect(config.expression_types.literals.number).toBeDefined();
  expect(config.expression_types.literals.boolean).toBeDefined();
  expect(config.expression_types.literals.null).toBeDefined();
  expect(config.expression_types.literals.undefined).toBeDefined();
  
  expect(config.expression_types.collections).toBeDefined();
  expect(config.expression_types.collections.array).toBeDefined();
  expect(config.expression_types.collections.object).toBeDefined();
  expect(config.expression_types.collections.map).toBeDefined();
  expect(config.expression_types.collections.set).toBeDefined();
  
  expect(config.expression_types.special).toBeDefined();
  expect(config.expression_types.special.new_expression).toBeDefined();
  expect(config.expression_types.special.call_expression).toBeDefined();
  expect(config.expression_types.special.await_expression).toBeDefined();
  expect(config.expression_types.special.yield_expression).toBeDefined();
  
  // Check defaults
  expect(config.defaults.void_type).toBeDefined();
  expect(config.defaults.constructor_type).toBeDefined();
  expect(config.defaults.async_wrapper).toBeDefined();
  expect(config.defaults.generator_wrapper).toBeDefined();
  
  // Check patterns
  expect(typeof config.patterns.has_explicit_annotations).toBe('boolean');
  expect(typeof config.patterns.has_docstring_types).toBe('boolean');
  expect(typeof config.patterns.has_jsdoc_types).toBe('boolean');
  expect(typeof config.patterns.requires_return_type).toBe('boolean');
  expect(typeof config.patterns.implicit_returns).toBe('boolean');
  
  // Check function_modifiers
  expect(config.function_modifiers.async_keywords).toBeDefined();
  expect(config.function_modifiers.generator_indicators).toBeDefined();
  expect(config.function_modifiers.constructor_names).toBeDefined();
}