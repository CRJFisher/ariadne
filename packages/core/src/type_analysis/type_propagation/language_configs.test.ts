/**
 * Tests for type propagation language configurations
 */

import { describe, it, expect } from 'vitest';
import {
  getTypePropagationConfig,
  isAssignmentNode,
  isDeclarationNode,
  isCallNode,
  isMemberAccessNode,
  getFieldName,
  getConstructorType,
  getTypeConversionFunction
} from './language_configs';
import type { Language } from '@ariadnejs/types';

type ExtendedLanguage = Language | 'jsx' | 'tsx';

describe('getTypePropagationConfig', () => {
  it('should return configuration for JavaScript', () => {
    const config = getTypePropagationConfig('javascript');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
    expect(config.declaration_nodes).toContain('variable_declarator');
    expect(config.call_nodes).toContain('call_expression');
    expect(config.member_access_nodes).toContain('member_expression');
  });

  it('should return configuration for TypeScript', () => {
    const config = getTypePropagationConfig('typescript');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
    expect(config.declaration_nodes).toContain('variable_declarator');
    expect(config.type_annotation_nodes).toContain('type_annotation');
  });

  it('should return configuration for Python', () => {
    const config = getTypePropagationConfig('python');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment');
    expect(config.declaration_nodes).toContain('assignment');
    expect(config.call_nodes).toContain('call');
  });

  it('should return configuration for Rust', () => {
    const config = getTypePropagationConfig('rust');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
    expect(config.declaration_nodes).toContain('let_declaration');
    expect(config.call_nodes).toContain('call_expression');
  });

  it('should handle JSX as JavaScript', () => {
    const config = getTypePropagationConfig('jsx');
    expect(config).toBeDefined();
    expect(config.assignment_nodes).toContain('assignment_expression');
  });

  it('should handle TSX as TypeScript', () => {
    const config = getTypePropagationConfig('tsx');
    expect(config).toBeDefined();
    expect(config.type_annotation_nodes).toContain('type_annotation');
  });
});

describe('isAssignmentNode', () => {
  it('should identify JavaScript assignment nodes', () => {
    expect(isAssignmentNode('assignment_expression', 'javascript')).toBe(true);
    expect(isAssignmentNode('augmented_assignment_expression', 'javascript')).toBe(true);
    expect(isAssignmentNode('identifier', 'javascript')).toBe(false);
  });

  it('should identify TypeScript assignment nodes', () => {
    expect(isAssignmentNode('assignment_expression', 'typescript')).toBe(true);
    expect(isAssignmentNode('augmented_assignment_expression', 'typescript')).toBe(true);
    expect(isAssignmentNode('type_annotation', 'typescript')).toBe(false);
  });

  it('should identify Python assignment nodes', () => {
    expect(isAssignmentNode('assignment', 'python')).toBe(true);
    expect(isAssignmentNode('augmented_assignment', 'python')).toBe(true);
    expect(isAssignmentNode('function_definition', 'python')).toBe(false);
  });

  it('should identify Rust assignment nodes', () => {
    expect(isAssignmentNode('assignment_expression', 'rust')).toBe(true);
    expect(isAssignmentNode('compound_assignment_expr', 'rust')).toBe(true);
    expect(isAssignmentNode('struct_expression', 'rust')).toBe(false);
  });
});

describe('isDeclarationNode', () => {
  it('should identify JavaScript declaration nodes', () => {
    expect(isDeclarationNode('variable_declarator', 'javascript')).toBe(true);
    expect(isDeclarationNode('lexical_declaration', 'javascript')).toBe(true);
    expect(isDeclarationNode('assignment_expression', 'javascript')).toBe(false);
  });

  it('should identify TypeScript declaration nodes', () => {
    expect(isDeclarationNode('variable_declarator', 'typescript')).toBe(true);
    expect(isDeclarationNode('lexical_declaration', 'typescript')).toBe(true);
    expect(isDeclarationNode('interface_declaration', 'typescript')).toBe(false);
  });

  it('should identify Python declaration nodes', () => {
    expect(isDeclarationNode('assignment', 'python')).toBe(true);
    expect(isDeclarationNode('annotated_assignment', 'python')).toBe(true);
    expect(isDeclarationNode('function_definition', 'python')).toBe(false);
  });

  it('should identify Rust declaration nodes', () => {
    expect(isDeclarationNode('let_declaration', 'rust')).toBe(true);
    expect(isDeclarationNode('const_item', 'rust')).toBe(true);
    expect(isDeclarationNode('static_item', 'rust')).toBe(true);
    expect(isDeclarationNode('assignment_expression', 'rust')).toBe(false);
  });
});

describe('isCallNode', () => {
  it('should identify JavaScript call nodes', () => {
    expect(isCallNode('call_expression', 'javascript')).toBe(true);
    expect(isCallNode('new_expression', 'javascript')).toBe(true);
    expect(isCallNode('member_expression', 'javascript')).toBe(false);
  });

  it('should identify TypeScript call nodes', () => {
    expect(isCallNode('call_expression', 'typescript')).toBe(true);
    expect(isCallNode('new_expression', 'typescript')).toBe(true);
    expect(isCallNode('type_arguments', 'typescript')).toBe(false);
  });

  it('should identify Python call nodes', () => {
    expect(isCallNode('call', 'python')).toBe(true);
    expect(isCallNode('decorator', 'python')).toBe(true);
    expect(isCallNode('attribute', 'python')).toBe(false);
  });

  it('should identify Rust call nodes', () => {
    expect(isCallNode('call_expression', 'rust')).toBe(true);
    expect(isCallNode('macro_invocation', 'rust')).toBe(true);
    expect(isCallNode('field_expression', 'rust')).toBe(false);
  });
});

describe('isMemberAccessNode', () => {
  it('should identify JavaScript member access nodes', () => {
    expect(isMemberAccessNode('member_expression', 'javascript')).toBe(true);
    expect(isMemberAccessNode('subscript_expression', 'javascript')).toBe(true);
    expect(isMemberAccessNode('call_expression', 'javascript')).toBe(false);
  });

  it('should identify TypeScript member access nodes', () => {
    expect(isMemberAccessNode('member_expression', 'typescript')).toBe(true);
    expect(isMemberAccessNode('subscript_expression', 'typescript')).toBe(true);
    expect(isMemberAccessNode('optional_chain', 'typescript')).toBe(true);
    expect(isMemberAccessNode('type_query', 'typescript')).toBe(false);
  });

  it('should identify Python member access nodes', () => {
    expect(isMemberAccessNode('attribute', 'python')).toBe(true);
    expect(isMemberAccessNode('subscript', 'python')).toBe(true);
    expect(isMemberAccessNode('call', 'python')).toBe(false);
  });

  it('should identify Rust member access nodes', () => {
    expect(isMemberAccessNode('field_expression', 'rust')).toBe(true);
    expect(isMemberAccessNode('index_expression', 'rust')).toBe(true);
    expect(isMemberAccessNode('call_expression', 'rust')).toBe(false);
  });
});

describe('getFieldName', () => {
  it('should return primary field name for JavaScript', () => {
    expect(getFieldName('left', 'javascript')).toBe('left');
    expect(getFieldName('right', 'javascript')).toBe('right');
    expect(getFieldName('name', 'javascript')).toBe('name');
  });

  it('should return primary field name for TypeScript', () => {
    expect(getFieldName('left', 'typescript')).toBe('left');
    expect(getFieldName('right', 'typescript')).toBe('right');
    expect(getFieldName('value', 'typescript')).toBe('value');
  });

  it('should return primary field name for Python', () => {
    expect(getFieldName('left', 'python')).toBe('left');
    expect(getFieldName('right', 'python')).toBe('right');
    expect(getFieldName('target', 'python')).toBe('left'); // Python uses 'left' for 'target'
  });

  it('should return primary field name for Rust', () => {
    expect(getFieldName('left', 'rust')).toBe('left');
    expect(getFieldName('right', 'rust')).toBe('right');
    expect(getFieldName('pattern', 'rust')).toBe('pattern');
  });
});

describe('getConstructorType', () => {
  it('should identify JavaScript built-in constructors', () => {
    expect(getConstructorType('Array', 'javascript')).toBe('Array');
    expect(getConstructorType('Object', 'javascript')).toBe('Object');
    expect(getConstructorType('Map', 'javascript')).toBe('Map');
    expect(getConstructorType('Set', 'javascript')).toBe('Set');
    expect(getConstructorType('Promise', 'javascript')).toBe('Promise');
  });

  it('should identify TypeScript built-in constructors', () => {
    expect(getConstructorType('Array', 'typescript')).toBe('Array');
    expect(getConstructorType('Map', 'typescript')).toBe('Map');
    expect(getConstructorType('WeakMap', 'typescript')).toBe('WeakMap');
    expect(getConstructorType('Date', 'typescript')).toBe('Date');
  });

  it('should identify Python built-in constructors', () => {
    expect(getConstructorType('list', 'python')).toBe('list');
    expect(getConstructorType('dict', 'python')).toBe('dict');
    expect(getConstructorType('set', 'python')).toBe('set');
    expect(getConstructorType('tuple', 'python')).toBe('tuple');
    expect(getConstructorType('frozenset', 'python')).toBe('frozenset');
  });

  it('should identify Rust built-in constructors', () => {
    expect(getConstructorType('Vec', 'rust')).toBe('Vec');
    expect(getConstructorType('HashMap', 'rust')).toBe('HashMap');
    expect(getConstructorType('HashSet', 'rust')).toBe('HashSet');
    expect(getConstructorType('Option', 'rust')).toBe('Option');
    expect(getConstructorType('Result', 'rust')).toBe('Result');
  });

  it('should return undefined for unknown constructors', () => {
    expect(getConstructorType('UnknownClass', 'javascript')).toBeUndefined();
    expect(getConstructorType('CustomType', 'python')).toBeUndefined();
    expect(getConstructorType('MyStruct', 'rust')).toBeUndefined();
  });
});

describe('getTypeConversionFunction', () => {
  it('should identify JavaScript type conversion functions', () => {
    expect(getTypeConversionFunction('String', 'javascript')).toBe('string');
    expect(getTypeConversionFunction('Number', 'javascript')).toBe('number');
    expect(getTypeConversionFunction('Boolean', 'javascript')).toBe('boolean');
    expect(getTypeConversionFunction('parseInt', 'javascript')).toBe('number');
    expect(getTypeConversionFunction('parseFloat', 'javascript')).toBe('number');
  });

  it('should identify TypeScript type conversion functions', () => {
    expect(getTypeConversionFunction('String', 'typescript')).toBe('string');
    expect(getTypeConversionFunction('Number', 'typescript')).toBe('number');
    expect(getTypeConversionFunction('Boolean', 'typescript')).toBe('boolean');
    expect(getTypeConversionFunction('BigInt', 'typescript')).toBe('bigint');
  });

  it('should identify Python type conversion functions', () => {
    expect(getTypeConversionFunction('str', 'python')).toBe('str');
    expect(getTypeConversionFunction('int', 'python')).toBe('int');
    expect(getTypeConversionFunction('float', 'python')).toBe('float');
    expect(getTypeConversionFunction('bool', 'python')).toBe('bool');
    expect(getTypeConversionFunction('bytes', 'python')).toBe('bytes');
  });

  it('should identify Rust type conversion functions', () => {
    expect(getTypeConversionFunction('to_string', 'rust')).toBe('String');
    expect(getTypeConversionFunction('to_owned', 'rust')).toBe('String');
    expect(getTypeConversionFunction('parse', 'rust')).toBe('Result');
    expect(getTypeConversionFunction('into', 'rust')).toBe('T');
    expect(getTypeConversionFunction('from', 'rust')).toBe('T');
  });

  it('should return undefined for non-conversion functions', () => {
    expect(getTypeConversionFunction('myFunction', 'javascript')).toBeUndefined();
    expect(getTypeConversionFunction('process', 'python')).toBeUndefined();
    expect(getTypeConversionFunction('custom_fn', 'rust')).toBeUndefined();
  });
});

describe('edge cases', () => {
  it('should handle jsx as javascript', () => {
    const config = getTypePropagationConfig('jsx');
    expect(config.assignment_nodes).toEqual(getTypePropagationConfig('javascript').assignment_nodes);
    expect(isAssignmentNode('assignment_expression', 'jsx')).toBe(true);
    expect(isCallNode('call_expression', 'jsx')).toBe(true);
  });

  it('should handle tsx as typescript', () => {
    const config = getTypePropagationConfig('tsx');
    expect(config.type_annotation_nodes).toEqual(getTypePropagationConfig('typescript').type_annotation_nodes);
    expect(isDeclarationNode('variable_declarator', 'tsx')).toBe(true);
    expect(isMemberAccessNode('member_expression', 'tsx')).toBe(true);
  });

  it('should handle all supported languages', () => {
    const languages: ExtendedLanguage[] = ['javascript', 'jsx', 'typescript', 'tsx', 'python', 'rust'];
    
    for (const lang of languages) {
      const config = getTypePropagationConfig(lang);
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
      const config = getTypePropagationConfig(lang);
      expect(config.fields.left).toBeDefined();
      expect(config.fields.right).toBeDefined();
      expect(config.fields.function).toBeDefined();
      expect(config.fields.property).toBeDefined();
    }
  });
});