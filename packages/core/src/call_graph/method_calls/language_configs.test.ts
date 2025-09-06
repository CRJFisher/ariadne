/**
 * Tests for language configuration
 */

import { describe, it, expect } from 'vitest';
import { 
  get_method_call_config,
  is_call_node_type,
  is_member_access_type,
  get_function_field_name,
  get_member_field_names,
  is_static_receiver
} from './language_configs';
import { Language } from '@ariadnejs/types';

describe('language_configs', () => {
  describe('get_method_call_config', () => {
    it('should return JavaScript configuration', () => {
      const config = get_method_call_config('javascript');
      expect(config.call_node_types).toContain('call_expression');
      expect(config.function_field).toBe('function');
      expect(config.member_access_types).toContain('member_expression');
      expect(config.member_fields.receiver).toBe('object');
      expect(config.member_fields.method).toBe('property');
    });

    it('should return TypeScript configuration', () => {
      const config = get_method_call_config('typescript');
      // TypeScript inherits JavaScript config
      expect(config.call_node_types).toContain('call_expression');
      expect(config.member_access_types).toContain('member_expression');
    });

    it('should return Python configuration', () => {
      const config = get_method_call_config('python');
      expect(config.call_node_types).toContain('call');
      expect(config.function_field).toBe('function');
      expect(config.member_access_types).toContain('attribute');
      expect(config.member_fields.receiver).toBe('object');
      expect(config.member_fields.method).toBe('attribute');
      expect(config.static_receiver_indicators).toContain('cls');
    });

    it('should return Rust configuration', () => {
      const config = get_method_call_config('rust');
      expect(config.call_node_types).toContain('call_expression');
      expect(config.member_access_types).toContain('field_expression');
      expect(config.member_access_types).toContain('scoped_identifier');
      expect(config.member_fields.receiver).toBe('value');
      expect(config.member_fields.method).toBe('field');
      
      // Check alternate fields for scoped_identifier
      expect(config.alternate_member_fields).toBeDefined();
      const scopedField = config.alternate_member_fields?.find(
        f => f.node_type === 'scoped_identifier'
      );
      expect(scopedField?.receiver).toBe('path');
      expect(scopedField?.method).toBe('name');
    });

    it('should throw error for unsupported language', () => {
      expect(() => get_method_call_config('unknown' as Language))
        .toThrow('No method call configuration for language: unknown');
    });
  });

  describe('is_call_node_type', () => {
    it('should identify JavaScript call nodes', () => {
      expect(is_call_node_type('call_expression', 'javascript')).toBe(true);
      expect(is_call_node_type('identifier', 'javascript')).toBe(false);
    });

    it('should identify Python call nodes', () => {
      expect(is_call_node_type('call', 'python')).toBe(true);
      expect(is_call_node_type('call_expression', 'python')).toBe(false);
    });

    it('should identify Rust call nodes', () => {
      expect(is_call_node_type('call_expression', 'rust')).toBe(true);
      expect(is_call_node_type('field_expression', 'rust')).toBe(false);
    });
  });

  describe('is_member_access_type', () => {
    it('should identify JavaScript member access', () => {
      expect(is_member_access_type('member_expression', 'javascript')).toBe(true);
      expect(is_member_access_type('call_expression', 'javascript')).toBe(false);
    });

    it('should identify Python member access', () => {
      expect(is_member_access_type('attribute', 'python')).toBe(true);
      expect(is_member_access_type('member_expression', 'python')).toBe(false);
    });

    it('should identify Rust member access', () => {
      expect(is_member_access_type('field_expression', 'rust')).toBe(true);
      expect(is_member_access_type('scoped_identifier', 'rust')).toBe(true);
      expect(is_member_access_type('member_expression', 'rust')).toBe(false);
    });
  });

  describe('get_function_field_name', () => {
    it('should return correct field name for JavaScript', () => {
      expect(get_function_field_name('javascript')).toBe('function');
    });

    it('should return correct field name for TypeScript', () => {
      expect(get_function_field_name('typescript')).toBe('function');
    });

    it('should return correct field name for Python', () => {
      expect(get_function_field_name('python')).toBe('function');
    });

    it('should return correct field name for Rust', () => {
      expect(get_function_field_name('rust')).toBe('function');
    });
  });

  describe('get_member_field_names', () => {
    it('should return JavaScript member fields', () => {
      const fields = get_member_field_names('member_expression', 'javascript');
      expect(fields).toEqual({ receiver: 'object', method: 'property' });
    });

    it('should return Python member fields', () => {
      const fields = get_member_field_names('attribute', 'python');
      expect(fields).toEqual({ receiver: 'object', method: 'attribute' });
    });

    it('should return Rust field_expression fields', () => {
      const fields = get_member_field_names('field_expression', 'rust');
      expect(fields).toEqual({ receiver: 'value', method: 'field' });
    });

    it('should return Rust scoped_identifier fields', () => {
      const fields = get_member_field_names('scoped_identifier', 'rust');
      expect(fields).toEqual({ receiver: 'path', method: 'name' });
    });

    it('should return null for non-member types', () => {
      expect(get_member_field_names('identifier', 'javascript')).toBeNull();
      expect(get_member_field_names('call_expression', 'python')).toBeNull();
    });
  });

  describe('is_static_receiver', () => {
    it('should identify static receivers in JavaScript', () => {
      expect(is_static_receiver('Math', 'javascript')).toBe(true);
      expect(is_static_receiver('Console', 'javascript')).toBe(true);
      expect(is_static_receiver('myObject', 'javascript')).toBe(false);
    });

    it('should identify static receivers in Python', () => {
      expect(is_static_receiver('MyClass', 'python')).toBe(true);
      expect(is_static_receiver('cls', 'python')).toBe(true);
      expect(is_static_receiver('self', 'python')).toBe(false);
      expect(is_static_receiver('instance', 'python')).toBe(false);
    });

    it('should not use uppercase convention for Rust', () => {
      // Rust uses :: for associated functions, not uppercase convention
      expect(is_static_receiver('String', 'rust')).toBe(false);
      expect(is_static_receiver('Vec', 'rust')).toBe(false);
    });
  });
});