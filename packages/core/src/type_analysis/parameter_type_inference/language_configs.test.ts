import { describe, it, expect } from 'vitest';
import {
  get_language_config,
  is_parameter_node,
  is_typed_parameter_node,
  is_rest_parameter_node,
  get_special_parameter_type,
  normalize_type,
  get_default_types
} from './language_configs';
import { Language } from '@ariadnejs/types';

describe('language_configs', () => {
  describe('get_language_config', () => {
    it('should return configuration for each language', () => {
      const jsConfig = get_language_config('javascript');
      expect(jsConfig).toBeDefined();
      expect(jsConfig.parameter_node_types).toContain('identifier');
      expect(jsConfig.defaults.any_type).toBe('any');
      
      const tsConfig = get_language_config('typescript');
      expect(tsConfig).toBeDefined();
      expect(tsConfig.parameter_node_types).toContain('required_parameter');
      expect(tsConfig.defaults.any_type).toBe('any');
      
      const pyConfig = get_language_config('python');
      expect(pyConfig).toBeDefined();
      expect(pyConfig.parameter_node_types).toContain('typed_parameter');
      expect(pyConfig.defaults.any_type).toBe('Any');
      
      const rustConfig = get_language_config('rust');
      expect(rustConfig).toBeDefined();
      expect(rustConfig.parameter_node_types).toContain('parameter');
      expect(rustConfig.defaults.any_type).toBe('dyn Any');
    });
  });
  
  describe('is_parameter_node', () => {
    it('should identify parameter nodes for JavaScript', () => {
      expect(is_parameter_node('identifier', 'javascript')).toBe(true);
      expect(is_parameter_node('assignment_pattern', 'javascript')).toBe(true);
      expect(is_parameter_node('rest_pattern', 'javascript')).toBe(true);
      expect(is_parameter_node('function', 'javascript')).toBe(false);
    });
    
    it('should identify parameter nodes for TypeScript', () => {
      expect(is_parameter_node('required_parameter', 'typescript')).toBe(true);
      expect(is_parameter_node('optional_parameter', 'typescript')).toBe(true);
      expect(is_parameter_node('identifier', 'typescript')).toBe(true);
      expect(is_parameter_node('class', 'typescript')).toBe(false);
    });
    
    it('should identify parameter nodes for Python', () => {
      expect(is_parameter_node('typed_parameter', 'python')).toBe(true);
      expect(is_parameter_node('default_parameter', 'python')).toBe(true);
      expect(is_parameter_node('list_splat_pattern', 'python')).toBe(true);
      expect(is_parameter_node('class_definition', 'python')).toBe(false);
    });
    
    it('should identify parameter nodes for Rust', () => {
      expect(is_parameter_node('parameter', 'rust')).toBe(true);
      expect(is_parameter_node('self_parameter', 'rust')).toBe(true);
      expect(is_parameter_node('struct', 'rust')).toBe(false);
    });
  });
  
  describe('is_typed_parameter_node', () => {
    it('should identify typed parameter nodes', () => {
      // JavaScript has no typed parameters
      expect(is_typed_parameter_node('identifier', 'javascript')).toBe(false);
      
      // TypeScript typed parameters
      expect(is_typed_parameter_node('required_parameter', 'typescript')).toBe(true);
      expect(is_typed_parameter_node('optional_parameter', 'typescript')).toBe(true);
      expect(is_typed_parameter_node('identifier', 'typescript')).toBe(false);
      
      // Python typed parameters
      expect(is_typed_parameter_node('typed_parameter', 'python')).toBe(true);
      expect(is_typed_parameter_node('identifier', 'python')).toBe(false);
      
      // Rust always has types
      expect(is_typed_parameter_node('parameter', 'rust')).toBe(true);
      expect(is_typed_parameter_node('self_parameter', 'rust')).toBe(false);
    });
  });
  
  describe('is_rest_parameter_node', () => {
    it('should identify rest parameter nodes', () => {
      // JavaScript/TypeScript rest
      expect(is_rest_parameter_node('rest_pattern', 'javascript')).toBe(true);
      expect(is_rest_parameter_node('rest_pattern', 'typescript')).toBe(true);
      expect(is_rest_parameter_node('identifier', 'javascript')).toBe(false);
      
      // Python splat patterns
      expect(is_rest_parameter_node('list_splat_pattern', 'python')).toBe(true);
      expect(is_rest_parameter_node('dictionary_splat_pattern', 'python')).toBe(true);
      expect(is_rest_parameter_node('identifier', 'python')).toBe(false);
      
      // Rust has no rest parameters
      expect(is_rest_parameter_node('parameter', 'rust')).toBe(false);
    });
  });
  
  describe('get_special_parameter_type', () => {
    it('should return special parameter types for Python', () => {
      expect(get_special_parameter_type('self', 'python', 'MyClass')).toBe('MyClass');
      expect(get_special_parameter_type('cls', 'python', 'MyClass')).toBe('Type[MyClass]');
      expect(get_special_parameter_type('self', 'python')).toBe('Self');
      expect(get_special_parameter_type('other', 'python')).toBeUndefined();
    });
    
    it('should return special parameter types for Rust', () => {
      expect(get_special_parameter_type('self', 'rust')).toBe('Self');
      expect(get_special_parameter_type('other', 'rust')).toBeUndefined();
    });
    
    it('should return undefined for JavaScript/TypeScript', () => {
      expect(get_special_parameter_type('self', 'javascript')).toBeUndefined();
      expect(get_special_parameter_type('this', 'typescript')).toBeUndefined();
    });
  });
  
  describe('normalize_type', () => {
    it('should normalize Python types', () => {
      expect(normalize_type('str', 'python')).toBe('str');
      expect(normalize_type('list', 'python')).toBe('List');
      expect(normalize_type('dict', 'python')).toBe('Dict');
      expect(normalize_type('CustomType', 'python')).toBe('CustomType');
    });
    
    it('should normalize Rust types', () => {
      expect(normalize_type('&self', 'rust')).toBe('&Self');
      expect(normalize_type('&mut self', 'rust')).toBe('&mut Self');
      expect(normalize_type('self', 'rust')).toBe('Self');
      expect(normalize_type('i32', 'rust')).toBe('i32');
    });
    
    it('should pass through types for other languages', () => {
      expect(normalize_type('string', 'javascript')).toBe('string');
      expect(normalize_type('number', 'typescript')).toBe('number');
    });
  });
  
  describe('get_default_types', () => {
    it('should return correct default types for each language', () => {
      const jsDefaults = get_default_types('javascript');
      expect(jsDefaults.any_type).toBe('any');
      expect(jsDefaults.void_type).toBe('undefined');
      expect(jsDefaults.array_type).toBe('Array');
      
      const tsDefaults = get_default_types('typescript');
      expect(tsDefaults.any_type).toBe('any');
      expect(tsDefaults.void_type).toBe('void');
      expect(tsDefaults.array_type).toBe('Array<any>');
      
      const pyDefaults = get_default_types('python');
      expect(pyDefaults.any_type).toBe('Any');
      expect(pyDefaults.void_type).toBe('None');
      expect(pyDefaults.array_type).toBe('List');
      
      const rustDefaults = get_default_types('rust');
      expect(rustDefaults.any_type).toBe('dyn Any');
      expect(rustDefaults.void_type).toBe('()');
      expect(rustDefaults.array_type).toBe('Vec<T>');
    });
  });
});