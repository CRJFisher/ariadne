/**
 * Tests for class hierarchy language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_class_hierarchy_config,
  is_class_node,
  is_interface_node,
  is_type_reference_node
} from './language_configs';

describe('Class Hierarchy Language Configurations', () => {
  describe('JavaScript Configuration', () => {
    const language = 'javascript';
    
    it('should get JavaScript configuration', () => {
      const config = get_class_hierarchy_config(language);
      expect(config).toBeDefined();
      expect(config.class_node_types).toBeDefined();
      expect(config.inheritance_patterns).toBeDefined();
    });
    
    it('should identify class nodes', () => {
      expect(is_class_node('class_declaration', language)).toBe(true);
      expect(is_class_node('function_declaration', language)).toBe(false);
    });
    
    it('should identify interface nodes', () => {
      // JavaScript config includes interface_declaration for JSDoc/Flow compatibility
      expect(is_interface_node('interface_declaration', language)).toBe(true);
      expect(is_interface_node('class_declaration', language)).toBe(false);
    });
    
    it('should identify type reference nodes', () => {
      expect(is_type_reference_node('identifier', language)).toBe(true);
      expect(is_type_reference_node('member_expression', language)).toBe(true);
      expect(is_type_reference_node('string', language)).toBe(false);
    });
    
    it('should support extends patterns', () => {
      const config = get_class_hierarchy_config(language);
      expect(config.inheritance_patterns.extends_patterns.length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript Configuration', () => {
    const language = 'typescript';
    
    it('should get TypeScript configuration', () => {
      const config = get_class_hierarchy_config(language);
      expect(config).toBeDefined();
      expect(config.interface_node_types.length).toBeGreaterThan(0);
    });
    
    it('should identify class nodes', () => {
      expect(is_class_node('class_declaration', language)).toBe(true);
      expect(is_class_node('abstract_class_declaration', language)).toBe(true);
      expect(is_class_node('function_declaration', language)).toBe(false);
    });
    
    it('should identify interface nodes', () => {
      expect(is_interface_node('interface_declaration', language)).toBe(true);
      expect(is_interface_node('class_declaration', language)).toBe(false);
    });
    
    it('should identify type reference nodes', () => {
      expect(is_type_reference_node('identifier', language)).toBe(true);
      expect(is_type_reference_node('type_identifier', language)).toBe(true);
      expect(is_type_reference_node('generic_type', language)).toBe(true);
    });
    
    it('should support both extends and implements patterns', () => {
      const config = get_class_hierarchy_config(language);
      expect(config.inheritance_patterns.extends_patterns.length).toBeGreaterThan(0);
      expect(config.inheritance_patterns.implements_patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Python Configuration', () => {
    const language = 'python';
    
    it('should get Python configuration', () => {
      const config = get_class_hierarchy_config(language);
      expect(config).toBeDefined();
      expect(config.class_node_types).toContain('class_definition');
    });
    
    it('should identify class nodes', () => {
      expect(is_class_node('class_definition', language)).toBe(true);
      expect(is_class_node('function_definition', language)).toBe(false);
    });
    
    it('should handle Python inheritance patterns', () => {
      const config = get_class_hierarchy_config(language);
      // Python has empty extends_patterns, uses multiple_inheritance instead
      expect(config.inheritance_patterns.extends_patterns.length).toBe(0);
      
      // Python uses multiple inheritance with argument_list
      expect(config.inheritance_patterns.multiple_inheritance).toBeDefined();
      expect(config.inheritance_patterns.multiple_inheritance?.container_type).toBe('argument_list');
    });
    
    it('should support multiple inheritance', () => {
      const config = get_class_hierarchy_config(language);
      expect(config.inheritance_patterns.multiple_inheritance).toBeDefined();
    });
  });

  describe('Rust Configuration', () => {
    const language = 'rust';
    
    it('should get Rust configuration', () => {
      const config = get_class_hierarchy_config(language);
      expect(config).toBeDefined();
      expect(config.class_node_types).toContain('struct_item');
      expect(config.class_node_types).toContain('enum_item');
    });
    
    it('should identify struct and enum nodes', () => {
      expect(is_class_node('struct_item', language)).toBe(true);
      expect(is_class_node('enum_item', language)).toBe(true);
      expect(is_class_node('union_item', language)).toBe(true);
      expect(is_class_node('function_item', language)).toBe(false);
    });
    
    it('should identify trait nodes', () => {
      expect(is_interface_node('trait_item', language)).toBe(true);
      expect(is_interface_node('struct_item', language)).toBe(false);
    });
    
    it('should handle Rust trait implementation patterns', () => {
      const config = get_class_hierarchy_config(language);
      
      // Rust implements_patterns is empty (handled specially by impl blocks)
      expect(config.inheritance_patterns.implements_patterns.length).toBe(0);
      
      // But it has extends_patterns for trait bounds
      expect(config.inheritance_patterns.extends_patterns.length).toBeGreaterThan(0);
    });
    
    it('should support type references', () => {
      expect(is_type_reference_node('identifier', language)).toBe(true);
      expect(is_type_reference_node('type_identifier', language)).toBe(true);
      expect(is_type_reference_node('generic_type', language)).toBe(true);
    });
  });

  describe('Cross-Language Patterns', () => {
    it('should have consistent class node identification', () => {
      const languages = ['javascript', 'typescript', 'python', 'rust'];
      
      languages.forEach(lang => {
        const config = get_class_hierarchy_config(lang as any);
        expect(config.class_node_types.length).toBeGreaterThan(0);
      });
    });
    
    it('should have inheritance patterns defined', () => {
      const languages = ['javascript', 'typescript', 'python', 'rust'];
      
      languages.forEach(lang => {
        const config = get_class_hierarchy_config(lang as any);
        expect(config.inheritance_patterns).toBeDefined();
        expect(config.inheritance_patterns.extends_patterns).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw for unknown languages', () => {
      const unknownLanguage = 'unknown' as any;
      
      // Should throw an error for unknown language
      expect(() => get_class_hierarchy_config(unknownLanguage)).toThrow('Unsupported language: unknown');
    });
  });
});