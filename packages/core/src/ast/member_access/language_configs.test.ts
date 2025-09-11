/**
 * Tests for member access language configurations
 */

import { describe, it, expect } from 'vitest';
import { ASTNodeType } from '@ariadnejs/types';
import {
  getMemberAccessConfig,
  isMemberAccessNode,
  getMemberAccessFields,
  shouldSkipNode
} from './language_configs';

describe('Member Access Language Configurations', () => {
  describe('JavaScript/TypeScript Configuration', () => {
    const language = 'javascript';
    
    it('should identify member access nodes', () => {
      expect(isMemberAccessNode('member_expression' as ASTNodeType, language)).toBe(true);
      expect(isMemberAccessNode('nested_type_identifier' as ASTNodeType, language)).toBe(true);
      expect(isMemberAccessNode('function_declaration' as ASTNodeType, language)).toBe(false);
    });
    
    it('should get correct field mappings', () => {
      const memberFields = getMemberAccessFields('member_expression' as ASTNodeType, language);
      expect(memberFields).toEqual({
        object_field: 'object',
        member_field: 'property'
      });
      
      const nestedFields = getMemberAccessFields('nested_type_identifier' as ASTNodeType, language);
      expect(nestedFields).toEqual({
        object_field: 'module',
        member_field: 'name'
      });
      
      expect(getMemberAccessFields('unknown_node' as ASTNodeType, language)).toBeNull();
    });
    
    it('should identify skip nodes', () => {
      expect(shouldSkipNode('comment' as ASTNodeType, language)).toBe(true);
      expect(shouldSkipNode('string' as ASTNodeType, language)).toBe(true);
      expect(shouldSkipNode('template_string' as ASTNodeType, language)).toBe(true);
      expect(shouldSkipNode('member_expression' as ASTNodeType, language)).toBe(false);
    });
    
    it('should support optional chaining and computed access', () => {
      const config = getMemberAccessConfig(language);
      expect(config?.special_patterns?.optional_chaining?.supported).toBe(true);
      expect(config?.special_patterns?.optional_chaining?.operator).toBe('?.');
      expect(config?.special_patterns?.computed_access?.supported).toBe(true);
      expect(config?.special_patterns?.computed_access?.node_type).toBe('subscript_expression');
    });
  });

  describe('TypeScript Configuration', () => {
    const language = 'typescript';
    
    it('should reuse JavaScript configuration', () => {
      const jsConfig = getMemberAccessConfig('javascript');
      const tsConfig = getMemberAccessConfig('typescript');
      expect(tsConfig).toEqual(jsConfig);
    });
  });

  describe('Python Configuration', () => {
    const language = 'python';
    
    it('should identify attribute nodes', () => {
      expect(isMemberAccessNode('attribute' as ASTNodeType, language)).toBe(true);
      expect(isMemberAccessNode('member_expression' as ASTNodeType, language)).toBe(false);
    });
    
    it('should get attribute field mappings', () => {
      const fields = getMemberAccessFields('attribute' as ASTNodeType, language);
      expect(fields).toEqual({
        object_field: 'object',
        member_field: 'attribute'
      });
    });
    
    it('should identify skip nodes', () => {
      expect(shouldSkipNode('comment' as ASTNodeType, language)).toBe(true);
      expect(shouldSkipNode('string' as ASTNodeType, language)).toBe(true);
      expect(shouldSkipNode('attribute' as ASTNodeType, language)).toBe(false);
    });
    
    it('should support getattr for computed access', () => {
      const config = getMemberAccessConfig(language);
      expect(config?.special_patterns?.computed_access?.supported).toBe(true);
      expect(config?.special_patterns?.computed_access?.node_type).toBe('call');
    });
  });

  describe('Rust Configuration', () => {
    const language = 'rust';
    
    it('should identify Rust member access nodes', () => {
      expect(isMemberAccessNode('scoped_identifier' as ASTNodeType, language)).toBe(true);
      expect(isMemberAccessNode('field_expression' as ASTNodeType, language)).toBe(true);
      expect(isMemberAccessNode('attribute' as ASTNodeType, language)).toBe(false);
    });
    
    it('should get correct field mappings', () => {
      const scopedFields = getMemberAccessFields('scoped_identifier' as ASTNodeType, language);
      expect(scopedFields).toEqual({
        object_field: 'path',
        member_field: 'name'
      });
      
      const fieldFields = getMemberAccessFields('field_expression' as ASTNodeType, language);
      expect(fieldFields).toEqual({
        object_field: 'value',
        member_field: 'field'
      });
    });
    
    it('should identify skip nodes', () => {
      expect(shouldSkipNode('comment' as ASTNodeType, language)).toBe(true);
      expect(shouldSkipNode('string_literal' as ASTNodeType, language)).toBe(true);
      expect(shouldSkipNode('scoped_identifier' as ASTNodeType, language)).toBe(false);
    });
    
    it('should not support optional chaining', () => {
      const config = getMemberAccessConfig(language);
      expect(config?.special_patterns?.optional_chaining?.supported).toBe(false);
    });
  });

  describe('Unknown Language', () => {
    const language = 'unknown' as any;
    
    it('should return null for unknown language', () => {
      expect(getMemberAccessConfig(language)).toBeNull();
      expect(isMemberAccessNode('member_expression' as ASTNodeType, language)).toBe(false);
      expect(getMemberAccessFields('member_expression' as ASTNodeType, language)).toBeNull();
      expect(shouldSkipNode('comment' as ASTNodeType, language)).toBe(false);
    });
  });
});