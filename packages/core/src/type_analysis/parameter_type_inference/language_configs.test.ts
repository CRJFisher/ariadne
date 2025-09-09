import { describe, it, expect } from 'vitest';
import {
  getLanguageConfig,
  isParameterNode,
  isTypedParameterNode,
  isRestParameterNode,
  getSpecialParameterType,
  normalizeType,
  getDefaultTypes
} from './language_configs';
import { Language } from '@ariadnejs/types';

describe('language_configs', () => {
  describe('getLanguageConfig', () => {
    it('should return configuration for each language', () => {
      const jsConfig = getLanguageConfig('javascript');
      expect(jsConfig).toBeDefined();
      expect(jsConfig.parameter_node_types).toContain('identifier');
      expect(jsConfig.defaults.any_type).toBe('any');
      
      const tsConfig = getLanguageConfig('typescript');
      expect(tsConfig).toBeDefined();
      expect(tsConfig.parameter_node_types).toContain('required_parameter');
      expect(tsConfig.defaults.any_type).toBe('any');
      
      const pyConfig = getLanguageConfig('python');
      expect(pyConfig).toBeDefined();
      expect(pyConfig.parameter_node_types).toContain('typed_parameter');
      expect(pyConfig.defaults.any_type).toBe('Any');
      
      const rustConfig = getLanguageConfig('rust');
      expect(rustConfig).toBeDefined();
      expect(rustConfig.parameter_node_types).toContain('parameter');
      expect(rustConfig.defaults.any_type).toBe('dyn Any');
    });
  });
  
  describe('isParameterNode', () => {
    it('should identify parameter nodes for JavaScript', () => {
      expect(isParameterNode('identifier', 'javascript')).toBe(true);
      expect(isParameterNode('assignment_pattern', 'javascript')).toBe(true);
      expect(isParameterNode('rest_pattern', 'javascript')).toBe(true);
      expect(isParameterNode('function', 'javascript')).toBe(false);
    });
    
    it('should identify parameter nodes for TypeScript', () => {
      expect(isParameterNode('required_parameter', 'typescript')).toBe(true);
      expect(isParameterNode('optional_parameter', 'typescript')).toBe(true);
      expect(isParameterNode('identifier', 'typescript')).toBe(true);
      expect(isParameterNode('class', 'typescript')).toBe(false);
    });
    
    it('should identify parameter nodes for Python', () => {
      expect(isParameterNode('typed_parameter', 'python')).toBe(true);
      expect(isParameterNode('default_parameter', 'python')).toBe(true);
      expect(isParameterNode('list_splat_pattern', 'python')).toBe(true);
      expect(isParameterNode('class_definition', 'python')).toBe(false);
    });
    
    it('should identify parameter nodes for Rust', () => {
      expect(isParameterNode('parameter', 'rust')).toBe(true);
      expect(isParameterNode('self_parameter', 'rust')).toBe(true);
      expect(isParameterNode('struct', 'rust')).toBe(false);
    });
  });
  
  describe('isTypedParameterNode', () => {
    it('should identify typed parameter nodes', () => {
      // JavaScript has no typed parameters
      expect(isTypedParameterNode('identifier', 'javascript')).toBe(false);
      
      // TypeScript typed parameters
      expect(isTypedParameterNode('required_parameter', 'typescript')).toBe(true);
      expect(isTypedParameterNode('optional_parameter', 'typescript')).toBe(true);
      expect(isTypedParameterNode('identifier', 'typescript')).toBe(false);
      
      // Python typed parameters
      expect(isTypedParameterNode('typed_parameter', 'python')).toBe(true);
      expect(isTypedParameterNode('identifier', 'python')).toBe(false);
      
      // Rust always has types
      expect(isTypedParameterNode('parameter', 'rust')).toBe(true);
      expect(isTypedParameterNode('self_parameter', 'rust')).toBe(false);
    });
  });
  
  describe('isRestParameterNode', () => {
    it('should identify rest parameter nodes', () => {
      // JavaScript/TypeScript rest
      expect(isRestParameterNode('rest_pattern', 'javascript')).toBe(true);
      expect(isRestParameterNode('rest_pattern', 'typescript')).toBe(true);
      expect(isRestParameterNode('identifier', 'javascript')).toBe(false);
      
      // Python splat patterns
      expect(isRestParameterNode('list_splat_pattern', 'python')).toBe(true);
      expect(isRestParameterNode('dictionary_splat_pattern', 'python')).toBe(true);
      expect(isRestParameterNode('identifier', 'python')).toBe(false);
      
      // Rust has no rest parameters
      expect(isRestParameterNode('parameter', 'rust')).toBe(false);
    });
  });
  
  describe('getSpecialParameterType', () => {
    it('should return special parameter types for Python', () => {
      expect(getSpecialParameterType('self', 'python', 'MyClass')).toBe('MyClass');
      expect(getSpecialParameterType('cls', 'python', 'MyClass')).toBe('Type[MyClass]');
      expect(getSpecialParameterType('self', 'python')).toBe('Self');
      expect(getSpecialParameterType('other', 'python')).toBeUndefined();
    });
    
    it('should return special parameter types for Rust', () => {
      expect(getSpecialParameterType('self', 'rust')).toBe('Self');
      expect(getSpecialParameterType('other', 'rust')).toBeUndefined();
    });
    
    it('should return undefined for JavaScript/TypeScript', () => {
      expect(getSpecialParameterType('self', 'javascript')).toBeUndefined();
      expect(getSpecialParameterType('this', 'typescript')).toBeUndefined();
    });
  });
  
  describe('normalizeType', () => {
    it('should normalize Python types', () => {
      expect(normalizeType('str', 'python')).toBe('str');
      expect(normalizeType('list', 'python')).toBe('List');
      expect(normalizeType('dict', 'python')).toBe('Dict');
      expect(normalizeType('CustomType', 'python')).toBe('CustomType');
    });
    
    it('should normalize Rust types', () => {
      expect(normalizeType('&self', 'rust')).toBe('&Self');
      expect(normalizeType('&mut self', 'rust')).toBe('&mut Self');
      expect(normalizeType('self', 'rust')).toBe('Self');
      expect(normalizeType('i32', 'rust')).toBe('i32');
    });
    
    it('should pass through types for other languages', () => {
      expect(normalizeType('string', 'javascript')).toBe('string');
      expect(normalizeType('number', 'typescript')).toBe('number');
    });
  });
  
  describe('getDefaultTypes', () => {
    it('should return correct default types for each language', () => {
      const jsDefaults = getDefaultTypes('javascript');
      expect(jsDefaults.any_type).toBe('any');
      expect(jsDefaults.void_type).toBe('undefined');
      expect(jsDefaults.array_type).toBe('Array');
      
      const tsDefaults = getDefaultTypes('typescript');
      expect(tsDefaults.any_type).toBe('any');
      expect(tsDefaults.void_type).toBe('void');
      expect(tsDefaults.array_type).toBe('Array<any>');
      
      const pyDefaults = getDefaultTypes('python');
      expect(pyDefaults.any_type).toBe('Any');
      expect(pyDefaults.void_type).toBe('None');
      expect(pyDefaults.array_type).toBe('List');
      
      const rustDefaults = getDefaultTypes('rust');
      expect(rustDefaults.any_type).toBe('dyn Any');
      expect(rustDefaults.void_type).toBe('()');
      expect(rustDefaults.array_type).toBe('Vec<T>');
    });
  });
});