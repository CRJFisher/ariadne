/**
 * Tests for type propagation language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  get_type_propagation_config,
  is_assignment_node,
  is_declaration_node,
  is_call_node,
  is_member_access_node,
  get_field_name,
  get_constructor_type,
  get_type_conversion_function
} from './language_configs';
import type { Language } from '@ariadnejs/types';

type ExtendedLanguage = Language | 'jsx' | 'tsx';

describe('get_type_propagation_config', () => {
  it('should return configuration for JavaScript', () => {
    const config = get_type_propagation_config('javascript');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
    expect(config.declaration_nodes).toContain('variable_declarator');
    expect(config.call_nodes).toContain('call_expression');
    expect(config.member_access_nodes).toContain('member_expression');
  });

  it('should return configuration for TypeScript', () => {
    const config = get_type_propagation_config('typescript');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
    expect(config.declaration_nodes).toContain('variable_declarator');
    expect(config.type_annotation_nodes).toContain('type_annotation');
  });

  it('should return configuration for Python', () => {
    const config = get_type_propagation_config('python');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment');
    expect(config.declaration_nodes).toContain('assignment');
    expect(config.call_nodes).toContain('call');
  });

  it('should return configuration for Rust', () => {
    const config = get_type_propagation_config('rust');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
    expect(config.declaration_nodes).toContain('let_declaration');
    expect(config.call_nodes).toContain('call_expression');
  });

  it('should handle JSX as JavaScript', () => {
    const config = get_type_propagation_config('jsx');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
  });

  it('should handle TSX as TypeScript', () => {
    const config = get_type_propagation_config('tsx');
    expect(config).toBeDefined();
    expect(config.type_annotation_nodes).toContain('type_annotation');
  });
});

describe('is_assignment_node', () => {
  it('should identify JavaScript assignment nodes', () => {
    expect(is_assignment_node('assignment_expression', 'javascript')).toBe(true);
    expect(is_assignment_node('augmented_assignment_expression', 'javascript')).toBe(true);
    expect(is_assignment_node('identifier', 'javascript')).toBe(false);
  });

  it('should identify TypeScript assignment nodes', () => {
    expect(is_assignment_node('assignment_expression', 'typescript')).toBe(true);
    expect(is_assignment_node('augmented_assignment_expression', 'typescript')).toBe(true);
    expect(is_assignment_node('type_annotation', 'typescript')).toBe(false);
  });

  it('should identify Python assignment nodes', () => {
    expect(is_assignment_node('assignment', 'python')).toBe(true);
    expect(is_assignment_node('augmented_assignment', 'python')).toBe(true);
    expect(is_assignment_node('function_definition', 'python')).toBe(false);
  });

  it('should identify Rust assignment nodes', () => {
    expect(is_assignment_node('assignment_expression', 'rust')).toBe(true);
    expect(is_assignment_node('compound_assignment_expr', 'rust')).toBe(true);
    expect(is_assignment_node('struct_expression', 'rust')).toBe(false);
  });
});

describe('is_declaration_node', () => {
  it('should identify JavaScript declaration nodes', () => {
    expect(is_declaration_node('variable_declarator', 'javascript')).toBe(true);
    expect(is_declaration_node('lexical_declaration', 'javascript')).toBe(true);
    expect(is_declaration_node('assignment_expression', 'javascript')).toBe(false);
  });

  it('should identify TypeScript declaration nodes', () => {
    expect(is_declaration_node('variable_declarator', 'typescript')).toBe(true);
    expect(is_declaration_node('lexical_declaration', 'typescript')).toBe(true);
    expect(is_declaration_node('interface_declaration', 'typescript')).toBe(false);
  });

  it('should identify Python declaration nodes', () => {
    expect(is_declaration_node('assignment', 'python')).toBe(true);
    expect(is_declaration_node('annotated_assignment', 'python')).toBe(true);
    expect(is_declaration_node('function_definition', 'python')).toBe(false);
  });

  it('should identify Rust declaration nodes', () => {
    expect(is_declaration_node('let_declaration', 'rust')).toBe(true);
    expect(is_declaration_node('const_item', 'rust')).toBe(true);
    expect(is_declaration_node('static_item', 'rust')).toBe(true);
    expect(is_declaration_node('assignment_expression', 'rust')).toBe(false);
  });
});

describe('is_call_node', () => {
  it('should identify JavaScript call nodes', () => {
    expect(is_call_node('call_expression', 'javascript')).toBe(true);
    expect(is_call_node('new_expression', 'javascript')).toBe(true);
    expect(is_call_node('member_expression', 'javascript')).toBe(false);
  });

  it('should identify TypeScript call nodes', () => {
    expect(is_call_node('call_expression', 'typescript')).toBe(true);
    expect(is_call_node('new_expression', 'typescript')).toBe(true);
    expect(is_call_node('type_arguments', 'typescript')).toBe(false);
  });

  it('should identify Python call nodes', () => {
    expect(is_call_node('call', 'python')).toBe(true);
    expect(is_call_node('decorator', 'python')).toBe(true);
    expect(is_call_node('attribute', 'python')).toBe(false);
  });

  it('should identify Rust call nodes', () => {
    expect(is_call_node('call_expression', 'rust')).toBe(true);
    expect(is_call_node('macro_invocation', 'rust')).toBe(true);
    expect(is_call_node('field_expression', 'rust')).toBe(false);
  });
});

describe('is_member_access_node', () => {
  it('should identify JavaScript member access nodes', () => {
    expect(is_member_access_node('member_expression', 'javascript')).toBe(true);
    expect(is_member_access_node('subscript_expression', 'javascript')).toBe(true);
    expect(is_member_access_node('call_expression', 'javascript')).toBe(false);
  });

  it('should identify TypeScript member access nodes', () => {
    expect(is_member_access_node('member_expression', 'typescript')).toBe(true);
    expect(is_member_access_node('subscript_expression', 'typescript')).toBe(true);
    expect(is_member_access_node('optional_chain', 'typescript')).toBe(true);
    expect(is_member_access_node('type_query', 'typescript')).toBe(false);
  });

  it('should identify Python member access nodes', () => {
    expect(is_member_access_node('attribute', 'python')).toBe(true);
    expect(is_member_access_node('subscript', 'python')).toBe(true);
    expect(is_member_access_node('call', 'python')).toBe(false);
  });

  it('should identify Rust member access nodes', () => {
    expect(is_member_access_node('field_expression', 'rust')).toBe(true);
    expect(is_member_access_node('index_expression', 'rust')).toBe(true);
    expect(is_member_access_node('call_expression', 'rust')).toBe(false);
  });
});

describe('get_field_name', () => {
  it('should return primary field name for JavaScript', () => {
    expect(get_field_name('left', 'javascript')).toBe('left');
    expect(get_field_name('right', 'javascript')).toBe('right');
    expect(get_field_name('name', 'javascript')).toBe('name');
  });

  it('should return primary field name for TypeScript', () => {
    expect(get_field_name('left', 'typescript')).toBe('left');
    expect(get_field_name('right', 'typescript')).toBe('right');
    expect(get_field_name('value', 'typescript')).toBe('value');
  });

  it('should return primary field name for Python', () => {
    expect(get_field_name('left', 'python')).toBe('left');
    expect(get_field_name('right', 'python')).toBe('right');
    expect(get_field_name('target', 'python')).toBe('left'); // Python uses 'left' for 'target'
  });

  it('should return primary field name for Rust', () => {
    expect(get_field_name('left', 'rust')).toBe('left');
    expect(get_field_name('right', 'rust')).toBe('right');
    expect(get_field_name('pattern', 'rust')).toBe('pattern');
  });
});

describe('get_constructor_type', () => {
  it('should identify JavaScript built-in constructors', () => {
    expect(get_constructor_type('Array', 'javascript')).toBe('Array');
    expect(get_constructor_type('Object', 'javascript')).toBe('Object');
    expect(get_constructor_type('Map', 'javascript')).toBe('Map');
    expect(get_constructor_type('Set', 'javascript')).toBe('Set');
    expect(get_constructor_type('Promise', 'javascript')).toBe('Promise');
  });

  it('should identify TypeScript built-in constructors', () => {
    expect(get_constructor_type('Array', 'typescript')).toBe('Array');
    expect(get_constructor_type('Map', 'typescript')).toBe('Map');
    expect(get_constructor_type('WeakMap', 'typescript')).toBe('WeakMap');
    expect(get_constructor_type('Date', 'typescript')).toBe('Date');
  });

  it('should identify Python built-in constructors', () => {
    expect(get_constructor_type('list', 'python')).toBe('list');
    expect(get_constructor_type('dict', 'python')).toBe('dict');
    expect(get_constructor_type('set', 'python')).toBe('set');
    expect(get_constructor_type('tuple', 'python')).toBe('tuple');
    expect(get_constructor_type('frozenset', 'python')).toBe('frozenset');
  });

  it('should identify Rust built-in constructors', () => {
    expect(get_constructor_type('Vec', 'rust')).toBe('Vec');
    expect(get_constructor_type('HashMap', 'rust')).toBe('HashMap');
    expect(get_constructor_type('HashSet', 'rust')).toBe('HashSet');
    expect(get_constructor_type('Option', 'rust')).toBe('Option');
    expect(get_constructor_type('Result', 'rust')).toBe('Result');
  });

  it('should return undefined for unknown constructors', () => {
    expect(get_constructor_type('UnknownClass', 'javascript')).toBeUndefined();
    expect(get_constructor_type('CustomType', 'python')).toBeUndefined();
    expect(get_constructor_type('MyStruct', 'rust')).toBeUndefined();
  });
});

describe('get_type_conversion_function', () => {
  it('should identify JavaScript type conversion functions', () => {
    expect(get_type_conversion_function('String', 'javascript')).toBe('string');
    expect(get_type_conversion_function('Number', 'javascript')).toBe('number');
    expect(get_type_conversion_function('Boolean', 'javascript')).toBe('boolean');
    expect(get_type_conversion_function('parseInt', 'javascript')).toBe('number');
    expect(get_type_conversion_function('parseFloat', 'javascript')).toBe('number');
  });

  it('should identify TypeScript type conversion functions', () => {
    expect(get_type_conversion_function('String', 'typescript')).toBe('string');
    expect(get_type_conversion_function('Number', 'typescript')).toBe('number');
    expect(get_type_conversion_function('Boolean', 'typescript')).toBe('boolean');
    expect(get_type_conversion_function('BigInt', 'typescript')).toBe('bigint');
  });

  it('should identify Python type conversion functions', () => {
    expect(get_type_conversion_function('str', 'python')).toBe('str');
    expect(get_type_conversion_function('int', 'python')).toBe('int');
    expect(get_type_conversion_function('float', 'python')).toBe('float');
    expect(get_type_conversion_function('bool', 'python')).toBe('bool');
    expect(get_type_conversion_function('bytes', 'python')).toBe('bytes');
  });

  it('should identify Rust type conversion functions', () => {
    expect(get_type_conversion_function('to_string', 'rust')).toBe('String');
    expect(get_type_conversion_function('to_owned', 'rust')).toBe('String');
    expect(get_type_conversion_function('parse', 'rust')).toBe('Result');
    expect(get_type_conversion_function('into', 'rust')).toBe('T');
    expect(get_type_conversion_function('from', 'rust')).toBe('T');
  });

  it('should return undefined for non-conversion functions', () => {
    expect(get_type_conversion_function('myFunction', 'javascript')).toBeUndefined();
    expect(get_type_conversion_function('process', 'python')).toBeUndefined();
    expect(get_type_conversion_function('custom_fn', 'rust')).toBeUndefined();
  });
});

describe('edge cases', () => {
  it('should handle jsx as javascript', () => {
    const config = get_type_propagation_config('jsx');
    expect(config.assignment_nodes).toEqual(get_type_propagation_config('javascript').assignment_nodes);
    expect(is_assignment_node('assignment_expression', 'jsx')).toBe(true);
    expect(is_call_node('call_expression', 'jsx')).toBe(true);
  });

  it('should handle tsx as typescript', () => {
    const config = get_type_propagation_config('tsx');
    expect(config.type_annotation_nodes).toEqual(get_type_propagation_config('typescript').type_annotation_nodes);
    expect(is_declaration_node('variable_declarator', 'tsx')).toBe(true);
    expect(is_member_access_node('member_expression', 'tsx')).toBe(true);
  });

  it('should handle all supported languages', () => {
    const languages: ExtendedLanguage[] = ['javascript', 'jsx', 'typescript', 'tsx', 'python', 'rust'];
    
    for (const lang of languages) {
      const config = get_type_propagation_config(lang);
      expect(config).toBeDefined();
      expect(config.assignment_nodes).toBeDefined();
      expect(config.assignment_nodes.length).toBeGreaterThan(0);
      expect(config.fields).toBeDefined();
      expect(config.literal_nodes).toBeDefined();
    }
  });

  it('should have consistent field configurations', () => {
    const languages: ExtendedLanguage[] = ['javascript', 'typescript', 'python', 'rust'];
    
    for (const lang of languages) {
      const config = get_type_propagation_config(lang);
      expect(config.fields.left).toBeDefined();
      expect(config.fields.right).toBeDefined();
      expect(config.fields.function).toBeDefined();
      expect(config.fields.property).toBeDefined();
    }
  });
});