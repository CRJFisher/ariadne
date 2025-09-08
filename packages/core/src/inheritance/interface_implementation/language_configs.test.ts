/**
 * Tests for Interface Implementation Language Configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_interface_config,
  is_interface_node,
  is_member_node,
  INTERFACE_IMPLEMENTATION_CONTEXT
} from './language_configs';

describe('Interface Implementation Language Configurations', () => {
  describe('get_interface_config', () => {
    it('should return JavaScript config for JavaScript language', () => {
      const config = get_interface_config('javascript');
      expect(config).toBeDefined();
      expect(config?.interface_node_types).toContain('interface_declaration');
      expect(config?.implementation_patterns.implementor_node_types).toContain('class_declaration');
    });
    
    it('should return TypeScript config for TypeScript language', () => {
      const config = get_interface_config('typescript');
      expect(config).toBeDefined();
      expect(config?.interface_node_types).toContain('interface_declaration');
      expect(config?.interface_node_types).toContain('abstract_class_declaration');
    });
    
    it('should return Python config for Python language', () => {
      const config = get_interface_config('python');
      expect(config).toBeDefined();
      expect(config?.interface_node_types).toContain('class_definition');
      expect(config?.special_patterns?.protocol_base_names).toContain('Protocol');
      expect(config?.special_patterns?.protocol_base_names).toContain('ABC');
    });
    
    it('should return Rust config for Rust language', () => {
      const config = get_interface_config('rust');
      expect(config).toBeDefined();
      expect(config?.interface_node_types).toContain('trait_item');
      expect(config?.implementation_patterns.implementor_node_types).toContain('impl_item');
      expect(config?.special_patterns?.trait_impl_syntax).toBe(true);
    });
    
    it('should return null for unsupported language', () => {
      const config = get_interface_config('go' as any);
      expect(config).toBeNull();
    });
  });
  
  describe('is_interface_node', () => {
    it('should identify TypeScript interface nodes', () => {
      expect(is_interface_node('interface_declaration', 'typescript')).toBe(true);
      expect(is_interface_node('abstract_class_declaration', 'typescript')).toBe(true);
      expect(is_interface_node('class_declaration', 'typescript')).toBe(false);
    });
    
    it('should identify Python interface nodes', () => {
      expect(is_interface_node('class_definition', 'python')).toBe(true);
      expect(is_interface_node('function_definition', 'python')).toBe(false);
    });
    
    it('should identify Rust trait nodes', () => {
      expect(is_interface_node('trait_item', 'rust')).toBe(true);
      expect(is_interface_node('impl_item', 'rust')).toBe(false);
      expect(is_interface_node('struct_item', 'rust')).toBe(false);
    });
    
    it('should return false for unsupported language', () => {
      expect(is_interface_node('interface_declaration', 'go' as any)).toBe(false);
    });
  });
  
  describe('is_member_node', () => {
    it('should identify TypeScript member nodes', () => {
      expect(is_member_node('method_signature', 'typescript')).toBe('method');
      expect(is_member_node('abstract_method_signature', 'typescript')).toBe('method');
      expect(is_member_node('property_signature', 'typescript')).toBe('property');
      expect(is_member_node('identifier', 'typescript')).toBeNull();
    });
    
    it('should identify Python member nodes', () => {
      expect(is_member_node('function_definition', 'python')).toBe('method');
      expect(is_member_node('expression_statement', 'python')).toBe('property');
      expect(is_member_node('class_definition', 'python')).toBeNull();
    });
    
    it('should identify Rust member nodes', () => {
      expect(is_member_node('function_signature_item', 'rust')).toBe('method');
      expect(is_member_node('function_item', 'rust')).toBe('method');
      expect(is_member_node('associated_type', 'rust')).toBe('property');
      expect(is_member_node('use_declaration', 'rust')).toBeNull();
    });
  });
  
  describe('Configuration Structure Validation', () => {
    it('should have valid JavaScript/TypeScript config structure', () => {
      const config = get_interface_config('javascript');
      expect(config).toBeDefined();
      
      // Check required fields
      expect(config?.interface_name_field).toBe('name');
      expect(config?.interface_body_field).toBe('body');
      expect(config?.member_patterns.name_field).toBe('name');
      expect(config?.implementation_patterns.implementor_name_field).toBe('name');
      expect(config?.implementation_patterns.implementor_body_field).toBe('body');
      
      // Check implementation indicators
      expect(config?.implementation_patterns.implementation_indicators).toHaveLength(1);
      const indicator = config?.implementation_patterns.implementation_indicators[0];
      expect(indicator?.type).toBe('keyword');
      expect(indicator?.keyword).toBe('implements');
    });
    
    it('should have valid Python config structure with special patterns', () => {
      const config = get_interface_config('python');
      expect(config).toBeDefined();
      
      // Check Python-specific patterns
      expect(config?.check_base_classes).toBe(true);
      expect(config?.special_patterns?.abstract_method_decorator).toBe('abstractmethod');
      expect(config?.special_patterns?.protocol_base_names).toContain('typing.Protocol');
      
      // Check base class indicator
      const indicator = config?.implementation_patterns.implementation_indicators[0];
      expect(indicator?.type).toBe('base_class');
      expect(indicator?.field_name).toBe('superclasses');
    });
    
    it('should have valid Rust config structure with trait patterns', () => {
      const config = get_interface_config('rust');
      expect(config).toBeDefined();
      
      // Check Rust-specific patterns
      expect(config?.special_patterns?.trait_impl_syntax).toBe(true);
      expect(config?.member_patterns.property_node_types).toContain('associated_type');
      
      // Check impl block indicator
      const indicator = config?.implementation_patterns.implementation_indicators[0];
      expect(indicator?.type).toBe('impl_block');
      expect(indicator?.trait_field).toBe('trait');
      expect(indicator?.type_field).toBe('type');
    });
  });
  
  describe('INTERFACE_IMPLEMENTATION_CONTEXT', () => {
    it('should have correct context metadata', () => {
      expect(INTERFACE_IMPLEMENTATION_CONTEXT.module).toBe('interface_implementation');
      expect(INTERFACE_IMPLEMENTATION_CONTEXT.version).toBe('2.0.0');
      expect(INTERFACE_IMPLEMENTATION_CONTEXT.supports).toContain('javascript');
      expect(INTERFACE_IMPLEMENTATION_CONTEXT.supports).toContain('typescript');
      expect(INTERFACE_IMPLEMENTATION_CONTEXT.supports).toContain('python');
      expect(INTERFACE_IMPLEMENTATION_CONTEXT.supports).toContain('rust');
      expect(INTERFACE_IMPLEMENTATION_CONTEXT.supports).toHaveLength(4);
    });
  });
  
  describe('Cross-language Consistency', () => {
    it('should have consistent field names across configs', () => {
      const languages = ['javascript', 'typescript', 'python', 'rust'] as const;
      
      for (const lang of languages) {
        const config = get_interface_config(lang);
        expect(config).toBeDefined();
        
        // All configs should have these fields
        expect(config?.interface_node_types).toBeDefined();
        expect(config?.interface_name_field).toBeDefined();
        expect(config?.interface_body_field).toBeDefined();
        expect(config?.member_patterns).toBeDefined();
        expect(config?.member_patterns.method_node_types).toBeDefined();
        expect(config?.member_patterns.property_node_types).toBeDefined();
        expect(config?.member_patterns.name_field).toBeDefined();
        expect(config?.implementation_patterns).toBeDefined();
        expect(config?.implementation_patterns.implementor_node_types).toBeDefined();
        expect(config?.implementation_patterns.implementation_indicators).toBeDefined();
        expect(config?.implementation_patterns.implementor_name_field).toBeDefined();
        expect(config?.implementation_patterns.implementor_body_field).toBeDefined();
      }
    });
    
    it('should have at least one interface node type per language', () => {
      const languages = ['javascript', 'typescript', 'python', 'rust'] as const;
      
      for (const lang of languages) {
        const config = get_interface_config(lang);
        expect(config?.interface_node_types.length).toBeGreaterThan(0);
      }
    });
    
    it('should have at least one implementation indicator per language', () => {
      const languages = ['javascript', 'typescript', 'python', 'rust'] as const;
      
      for (const lang of languages) {
        const config = get_interface_config(lang);
        expect(config?.implementation_patterns.implementation_indicators.length).toBeGreaterThan(0);
      }
    });
  });
});