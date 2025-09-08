/**
 * Tests for method override language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_language_config,
  has_override_marker,
  has_abstract_marker,
  is_static_method,
  should_skip_method
} from './language_configs';

describe('Method Override Language Configurations', () => {
  describe('get_language_config', () => {
    it('should return TypeScript configuration', () => {
      const config = get_language_config('typescript');
      expect(config).toBeDefined();
      expect(config?.features.has_explicit_override).toBe(true);
      expect(config?.features.has_interfaces).toBe(true);
      expect(config?.override_markers.keywords).toContain('override');
    });
    
    it('should return JavaScript configuration', () => {
      const config = get_language_config('javascript');
      expect(config).toBeDefined();
      expect(config?.features.has_explicit_override).toBe(false);
      expect(config?.features.has_interfaces).toBe(false);
      expect(config?.override_markers.keywords).toBeUndefined();
    });
    
    it('should return Python configuration', () => {
      const config = get_language_config('python');
      expect(config).toBeDefined();
      expect(config?.features.has_multiple_inheritance).toBe(true);
      expect(config?.override_markers.decorators).toContain('override');
      expect(config?.abstract_markers.decorators).toContain('abstractmethod');
    });
    
    it('should return Rust configuration', () => {
      const config = get_language_config('rust');
      expect(config).toBeDefined();
      expect(config?.features.has_traits).toBe(true);
      expect(config?.class_types).toContain('impl_item');
    });
    
    it('should return undefined for unsupported language', () => {
      const config = get_language_config('unknown');
      expect(config).toBeUndefined();
    });
  });
  
  describe('has_override_marker', () => {
    it('should detect TypeScript override keyword', () => {
      const config = get_language_config('typescript')!;
      const node = {
        children: [
          { type: 'override' }
        ]
      };
      expect(has_override_marker(node, config)).toBe(true);
    });
    
    it('should detect Python override decorator', () => {
      const config = get_language_config('python')!;
      const node = {
        children: [
          { 
            type: 'decorator',
            childForFieldName: (name: string) => 
              name === 'name' ? { text: 'override' } : null
          }
        ]
      };
      expect(has_override_marker(node, config)).toBe(true);
    });
    
    it('should return false when no markers present', () => {
      const config = get_language_config('javascript')!;
      const node = { children: [] };
      expect(has_override_marker(node, config)).toBe(false);
    });
  });
  
  describe('has_abstract_marker', () => {
    it('should detect TypeScript abstract keyword', () => {
      const config = get_language_config('typescript')!;
      const node = {
        children: [
          { type: 'abstract' }
        ]
      };
      expect(has_abstract_marker(node, config)).toBe(true);
    });
    
    it('should detect Python abstractmethod decorator', () => {
      const config = get_language_config('python')!;
      const node = {
        children: [
          { 
            type: 'decorator',
            childForFieldName: (name: string) => 
              name === 'name' ? { text: 'abstractmethod' } : null
          }
        ]
      };
      expect(has_abstract_marker(node, config)).toBe(true);
    });
  });
  
  describe('is_static_method', () => {
    it('should detect TypeScript static keyword', () => {
      const config = get_language_config('typescript')!;
      const node = {
        children: [
          { type: 'static' }
        ]
      };
      expect(is_static_method(node, config)).toBe(true);
    });
    
    it('should detect Python staticmethod decorator', () => {
      const config = get_language_config('python')!;
      const node = {
        children: [
          { 
            type: 'decorator',
            childForFieldName: (name: string) => 
              name === 'name' ? { text: 'staticmethod' } : null
          }
        ]
      };
      expect(is_static_method(node, config)).toBe(true);
    });
    
    it('should detect Python classmethod decorator', () => {
      const config = get_language_config('python')!;
      const node = {
        children: [
          { 
            type: 'decorator',
            childForFieldName: (name: string) => 
              name === 'name' ? { text: 'classmethod' } : null
          }
        ]
      };
      expect(is_static_method(node, config)).toBe(true);
    });
  });
  
  describe('should_skip_method', () => {
    it('should skip Python magic methods except __init__', () => {
      const config = get_language_config('python')!;
      
      expect(should_skip_method('__str__', config)).toBe(true);
      expect(should_skip_method('__repr__', config)).toBe(true);
      expect(should_skip_method('__eq__', config)).toBe(true);
      expect(should_skip_method('__init__', config)).toBe(false);
    });
    
    it('should not skip regular methods', () => {
      const config = get_language_config('python')!;
      
      expect(should_skip_method('method_name', config)).toBe(false);
      expect(should_skip_method('_private', config)).toBe(false);
      expect(should_skip_method('public', config)).toBe(false);
    });
    
    it('should handle languages without skip patterns', () => {
      const config = get_language_config('typescript')!;
      
      expect(should_skip_method('anything', config)).toBe(false);
    });
  });
});