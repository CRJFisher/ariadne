/**
 * Comprehensive tests for language-specific bespoke member access handlers
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';

// Import bespoke handlers
import { 
  handle_javascript_optional_chaining, 
  handle_javascript_computed_access 
} from './member_access.javascript';
import { handle_python_getattr } from './member_access.python';
import { handle_rust_field_expression } from './member_access.rust';

import { FilePath, NamespaceName } from '@ariadnejs/types';
import { MemberAccessContext } from './types';

// Helper to create parser for language
function create_parser(language: string): Parser {
  const parser = new Parser();
  
  switch (language) {
    case 'javascript':
      parser.setLanguage(JavaScript);
      break;
    case 'typescript':
      parser.setLanguage(TypeScript.typescript);
      break;
    case 'python':
      parser.setLanguage(Python);
      break;
    case 'rust':
      parser.setLanguage(Rust);
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
  
  return parser;
}

// Helper to parse code and find specific node type
function find_node_of_type(code: string, language: string, node_type: string) {
  const parser = create_parser(language);
  const tree = parser.parse(code);
  
  function traverse(node: any): any {
    if (node.type === node_type) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const found = traverse(node.child(i));
      if (found) return found;
    }
    return null;
  }
  
  return traverse(tree.rootNode);
}

// Helper to create test context
function create_test_context(namespace_imports: string[] = []): MemberAccessContext {
  return {
    file_path: '/test/file.ts' as FilePath,
    namespace_imports: new Set(namespace_imports.map(ns => ns as NamespaceName))
  };
}

describe('JavaScript/TypeScript Bespoke Handler Tests', () => {
  describe('Optional Chaining Handler', () => {
    it('should detect optional chaining member access', () => {
      const code = 'api?.getData';
      const member_node = find_node_of_type(code, 'javascript', 'member_expression');
      const context = create_test_context(['api']);
      
      expect(member_node).not.toBeNull();
      
      const result = handle_javascript_optional_chaining(member_node, context);
      expect(result).toMatchObject({
        namespace: 'api',
        member: 'getData'
      });
      expect(result?.location).toBeDefined();
    });

    it('should detect optional chaining method calls', () => {
      const code = 'namespace?.method()';
      const member_node = find_node_of_type(code, 'javascript', 'member_expression');
      const context = create_test_context(['namespace']);
      
      expect(member_node).not.toBeNull();
      
      const result = handle_javascript_optional_chaining(member_node, context);
      expect(result).toMatchObject({
        namespace: 'namespace',
        member: 'method'
      });
    });

    it('should not detect regular member access', () => {
      const code = 'api.getData';
      const member_node = find_node_of_type(code, 'javascript', 'member_expression');
      const context = create_test_context(['api']);
      
      expect(member_node).not.toBeNull();
      
      const result = handle_javascript_optional_chaining(member_node, context);
      expect(result).toBeNull();
    });

    it('should not detect optional chaining for non-namespace objects', () => {
      const code = 'obj?.property';
      const member_node = find_node_of_type(code, 'javascript', 'member_expression');
      const context = create_test_context(['api']); // 'obj' is not a namespace
      
      expect(member_node).not.toBeNull();
      
      const result = handle_javascript_optional_chaining(member_node, context);
      expect(result).toBeNull();
    });

    it('should handle malformed optional chaining gracefully', () => {
      // This should not crash even with malformed input
      const code = 'api?.';
      const member_node = find_node_of_type(code, 'javascript', 'member_expression');
      const context = create_test_context(['api']);
      
      if (member_node) {
        expect(() => handle_javascript_optional_chaining(member_node, context)).not.toThrow();
      }
    });

    it('should handle wrong node type gracefully', () => {
      const code = 'api.getData';
      const identifier_node = find_node_of_type(code, 'javascript', 'identifier');
      const context = create_test_context(['api']);
      
      expect(identifier_node).not.toBeNull();
      
      const result = handle_javascript_optional_chaining(identifier_node, context);
      expect(result).toBeNull();
    });
  });

  describe('Computed Access Handler', () => {
    it('should detect computed property access with string literals', () => {
      const code = 'types["User"]';
      const subscript_node = find_node_of_type(code, 'javascript', 'subscript_expression');
      const context = create_test_context(['types']);
      
      expect(subscript_node).not.toBeNull();
      
      const result = handle_javascript_computed_access(subscript_node, context);
      expect(result).toMatchObject({
        namespace: 'types',
        member: 'User'
      });
      expect(result?.location).toBeDefined();
    });

    it('should detect computed property access with single quotes', () => {
      const code = "types['User']";
      const subscript_node = find_node_of_type(code, 'javascript', 'subscript_expression');
      const context = create_test_context(['types']);
      
      expect(subscript_node).not.toBeNull();
      
      const result = handle_javascript_computed_access(subscript_node, context);
      expect(result).toMatchObject({
        namespace: 'types',
        member: 'User'
      });
    });

    it('should handle computed access with variables', () => {
      const code = 'types[variable]';
      const subscript_node = find_node_of_type(code, 'javascript', 'subscript_expression');
      const context = create_test_context(['types']);
      
      expect(subscript_node).not.toBeNull();
      
      const result = handle_javascript_computed_access(subscript_node, context);
      expect(result).toMatchObject({
        namespace: 'types',
        member: '[variable]'
      });
    });

    it('should handle computed access with complex expressions', () => {
      const code = 'types[prop.key]';
      const subscript_node = find_node_of_type(code, 'javascript', 'subscript_expression');
      const context = create_test_context(['types']);
      
      expect(subscript_node).not.toBeNull();
      
      const result = handle_javascript_computed_access(subscript_node, context);
      // Should extract the complex expression text
      expect(result?.namespace).toBe('types');
      expect(result?.member).toBeDefined();
    });

    it('should not detect computed access for non-namespace objects', () => {
      const code = 'obj["property"]';
      const subscript_node = find_node_of_type(code, 'javascript', 'subscript_expression');
      const context = create_test_context(['types']); // 'obj' is not a namespace
      
      expect(subscript_node).not.toBeNull();
      
      const result = handle_javascript_computed_access(subscript_node, context);
      expect(result).toBeNull();
    });

    it('should handle malformed subscript expressions gracefully', () => {
      const code = 'types[';
      const subscript_node = find_node_of_type(code, 'javascript', 'subscript_expression');
      const context = create_test_context(['types']);
      
      if (subscript_node) {
        expect(() => handle_javascript_computed_access(subscript_node, context)).not.toThrow();
      }
    });

    it('should handle wrong node type gracefully', () => {
      const code = 'types["User"]';
      const string_node = find_node_of_type(code, 'javascript', 'string');
      const context = create_test_context(['types']);
      
      if (string_node) {
        const result = handle_javascript_computed_access(string_node, context);
        expect(result).toBeNull();
      }
    });
  });
});

describe('Python Bespoke Handler Tests', () => {
  describe('getattr Handler', () => {
    it('should detect getattr calls with string literals', () => {
      const code = 'getattr(utils, "process_data")';
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']);
      
      expect(call_node).not.toBeNull();
      
      const result = handle_python_getattr(call_node, context);
      expect(result).toMatchObject({
        namespace: 'utils',
        member: 'process_data'
      });
      expect(result?.location).toBeDefined();
    });

    it('should detect getattr calls with single quotes', () => {
      const code = "getattr(utils, 'process_data')";
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']);
      
      expect(call_node).not.toBeNull();
      
      const result = handle_python_getattr(call_node, context);
      expect(result).toMatchObject({
        namespace: 'utils',
        member: 'process_data'
      });
    });

    it('should handle getattr with default values', () => {
      const code = 'getattr(utils, "process_data", None)';
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']);
      
      expect(call_node).not.toBeNull();
      
      const result = handle_python_getattr(call_node, context);
      expect(result).toMatchObject({
        namespace: 'utils',
        member: 'process_data'
      });
    });

    it('should handle getattr with variable attribute names', () => {
      const code = 'getattr(utils, attr_name)';
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']);
      
      expect(call_node).not.toBeNull();
      
      const result = handle_python_getattr(call_node, context);
      expect(result).toMatchObject({
        namespace: 'utils',
        member: 'attr_name'
      });
    });

    it('should not detect non-getattr function calls', () => {
      const code = 'other_func(utils, "process_data")';
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']);
      
      expect(call_node).not.toBeNull();
      
      const result = handle_python_getattr(call_node, context);
      expect(result).toBeNull();
    });

    it('should not detect getattr on non-namespace objects', () => {
      const code = 'getattr(obj, "property")';
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']); // 'obj' is not a namespace
      
      expect(call_node).not.toBeNull();
      
      const result = handle_python_getattr(call_node, context);
      expect(result).toBeNull();
    });

    it('should handle getattr with insufficient arguments gracefully', () => {
      const code = 'getattr(utils)';
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']);
      
      expect(call_node).not.toBeNull();
      
      const result = handle_python_getattr(call_node, context);
      expect(result).toBeNull();
    });

    it('should handle getattr with too many arguments gracefully', () => {
      const code = 'getattr(utils, "attr", default, extra)';
      const call_node = find_node_of_type(code, 'python', 'call');
      const context = create_test_context(['utils']);
      
      expect(call_node).not.toBeNull();
      
      // Should still work - just ignore extra args
      const result = handle_python_getattr(call_node, context);
      expect(result).toMatchObject({
        namespace: 'utils',
        member: 'attr'
      });
    });

    it('should handle wrong node type gracefully', () => {
      const code = 'getattr(utils, "process_data")';
      const identifier_node = find_node_of_type(code, 'python', 'identifier');
      const context = create_test_context(['utils']);
      
      if (identifier_node) {
        const result = handle_python_getattr(identifier_node, context);
        expect(result).toBeNull();
      }
    });
  });
});

describe('Rust Bespoke Handler Tests', () => {
  describe('Field Expression Handler', () => {
    it('should detect field access on namespace objects', () => {
      const code = 'helpers.process_data';
      const field_node = find_node_of_type(code, 'rust', 'field_expression');
      const context = create_test_context(['helpers']);
      
      expect(field_node).not.toBeNull();
      
      const result = handle_rust_field_expression(field_node, context);
      expect(result).toMatchObject({
        namespace: 'helpers',
        member: 'process_data'
      });
      expect(result?.location).toBeDefined();
    });

    it('should handle complex field names', () => {
      const code = 'helpers.complex_field_name';
      const field_node = find_node_of_type(code, 'rust', 'field_expression');
      const context = create_test_context(['helpers']);
      
      expect(field_node).not.toBeNull();
      
      const result = handle_rust_field_expression(field_node, context);
      expect(result).toMatchObject({
        namespace: 'helpers',
        member: 'complex_field_name'
      });
    });

    it('should not detect field access on non-namespace objects', () => {
      const code = 'obj.field';
      const field_node = find_node_of_type(code, 'rust', 'field_expression');
      const context = create_test_context(['helpers']); // 'obj' is not a namespace
      
      expect(field_node).not.toBeNull();
      
      const result = handle_rust_field_expression(field_node, context);
      expect(result).toBeNull();
    });

    it('should handle nested field access correctly (only first level)', () => {
      const code = 'helpers.module.field';
      // This should parse as nested field_expressions
      const field_node = find_node_of_type(code, 'rust', 'field_expression');
      const context = create_test_context(['helpers']);
      
      if (field_node) {
        const result = handle_rust_field_expression(field_node, context);
        // Should only detect the first level as namespace access
        if (result) {
          expect(result.namespace).toBe('helpers');
          expect(result.member).toBe('module');
        }
      }
    });

    it('should handle malformed field expressions gracefully', () => {
      const code = 'helpers.';
      const field_node = find_node_of_type(code, 'rust', 'field_expression');
      const context = create_test_context(['helpers']);
      
      if (field_node) {
        expect(() => handle_rust_field_expression(field_node, context)).not.toThrow();
      }
    });

    it('should handle wrong node type gracefully', () => {
      const code = 'helpers.field';
      const identifier_node = find_node_of_type(code, 'rust', 'identifier');
      const context = create_test_context(['helpers']);
      
      if (identifier_node) {
        const result = handle_rust_field_expression(identifier_node, context);
        expect(result).toBeNull();
      }
    });

    it('should handle empty namespace imports gracefully', () => {
      const code = 'helpers.field';
      const field_node = find_node_of_type(code, 'rust', 'field_expression');
      const context = create_test_context([]); // No namespace imports
      
      if (field_node) {
        const result = handle_rust_field_expression(field_node, context);
        expect(result).toBeNull();
      }
    });
  });
});