/**
 * Tests for member access language configurations
 */

import { describe, it, expect } from 'vitest';
import { ASTNodeType } from '@ariadnejs/types';
import {
  get_member_access_config,
  is_member_access_node,
  get_member_access_fields,
  should_skip_node
} from './language_configs';

describe('Member Access Language Configurations', () => {
  describe('JavaScript/TypeScript Configuration', () => {
    const language = 'javascript';
    
    it('should identify member access nodes', () => {
      expect(is_member_access_node('member_expression' as ASTNodeType, language)).toBe(true);
      expect(is_member_access_node('nested_type_identifier' as ASTNodeType, language)).toBe(true);
      expect(is_member_access_node('function_declaration' as ASTNodeType, language)).toBe(false);
    });
    
    it('should get correct field mappings', () => {
      const memberFields = get_member_access_fields('member_expression' as ASTNodeType, language);
      expect(memberFields).toEqual({
        object_field: 'object',
        member_field: 'property'
      });
      
      const nestedFields = get_member_access_fields('nested_type_identifier' as ASTNodeType, language);
      expect(nestedFields).toEqual({
        object_field: 'module',
        member_field: 'name'
      });
      
      expect(get_member_access_fields('unknown_node' as ASTNodeType, language)).toBeNull();
    });
    
    it('should identify skip nodes', () => {
      expect(should_skip_node('comment' as ASTNodeType, language)).toBe(true);
      expect(should_skip_node('string' as ASTNodeType, language)).toBe(true);
      expect(should_skip_node('template_string' as ASTNodeType, language)).toBe(true);
      expect(should_skip_node('member_expression' as ASTNodeType, language)).toBe(false);
    });
    
    it('should support optional chaining and computed access', () => {
      const config = get_member_access_config(language);
      expect(config?.special_patterns?.optional_chaining?.supported).toBe(true);
      expect(config?.special_patterns?.optional_chaining?.operator).toBe('?.');
      expect(config?.special_patterns?.computed_access?.supported).toBe(true);
      expect(config?.special_patterns?.computed_access?.node_type).toBe('subscript_expression');
    });
  });

  describe('TypeScript Configuration', () => {
    const language = 'typescript';
    
    it('should reuse JavaScript configuration', () => {
      const jsConfig = get_member_access_config('javascript');
      const tsConfig = get_member_access_config('typescript');
      expect(tsConfig).toEqual(jsConfig);
    });
  });

  describe('Python Configuration', () => {
    const language = 'python';
    
    it('should identify attribute nodes', () => {
      expect(is_member_access_node('attribute' as ASTNodeType, language)).toBe(true);
      expect(is_member_access_node('member_expression' as ASTNodeType, language)).toBe(false);
    });
    
    it('should get attribute field mappings', () => {
      const fields = get_member_access_fields('attribute' as ASTNodeType, language);
      expect(fields).toEqual({
        object_field: 'object',
        member_field: 'attribute'
      });
    });
    
    it('should identify skip nodes', () => {
      expect(should_skip_node('comment' as ASTNodeType, language)).toBe(true);
      expect(should_skip_node('string' as ASTNodeType, language)).toBe(true);
      expect(should_skip_node('attribute' as ASTNodeType, language)).toBe(false);
    });
    
    it('should support getattr for computed access', () => {
      const config = get_member_access_config(language);
      expect(config?.special_patterns?.computed_access?.supported).toBe(true);
      expect(config?.special_patterns?.computed_access?.node_type).toBe('call');
    });
  });

  describe('Rust Configuration', () => {
    const language = 'rust';
    
    it('should identify Rust member access nodes', () => {
      expect(is_member_access_node('scoped_identifier' as ASTNodeType, language)).toBe(true);
      expect(is_member_access_node('field_expression' as ASTNodeType, language)).toBe(true);
      expect(is_member_access_node('attribute' as ASTNodeType, language)).toBe(false);
    });
    
    it('should get correct field mappings', () => {
      const scopedFields = get_member_access_fields('scoped_identifier' as ASTNodeType, language);
      expect(scopedFields).toEqual({
        object_field: 'path',
        member_field: 'name'
      });
      
      const fieldFields = get_member_access_fields('field_expression' as ASTNodeType, language);
      expect(fieldFields).toEqual({
        object_field: 'value',
        member_field: 'field'
      });
    });
    
    it('should identify skip nodes', () => {
      expect(should_skip_node('comment' as ASTNodeType, language)).toBe(true);
      expect(should_skip_node('string_literal' as ASTNodeType, language)).toBe(true);
      expect(should_skip_node('scoped_identifier' as ASTNodeType, language)).toBe(false);
    });
    
    it('should not support optional chaining', () => {
      const config = get_member_access_config(language);
      expect(config?.special_patterns?.optional_chaining?.supported).toBe(false);
    });
  });

  describe('Unknown Language', () => {
    const language = 'unknown' as any;
    
    it('should return null for unknown language', () => {
      expect(get_member_access_config(language)).toBeNull();
      expect(is_member_access_node('member_expression' as ASTNodeType, language)).toBe(false);
      expect(get_member_access_fields('member_expression' as ASTNodeType, language)).toBeNull();
      expect(should_skip_node('comment' as ASTNodeType, language)).toBe(false);
    });
  });
});