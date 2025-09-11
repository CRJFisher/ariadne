/**
 * Tests for generic class detection processor
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import {
  find_classes_generic,
  extract_class_generic,
  extract_method_generic,
  extract_property_generic,
  extract_parameters_generic,
  walk_tree
} from './class_detection';
import { get_language_config } from './language_configs';
import { ClassDetectionContext } from './index';

function parse_code(code: string, language: 'javascript' | 'typescript' | 'python' | 'rust'): Parser.Tree {
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
  }
  
  return parser.parse(code);
}

describe('class_detection', () => {
  describe('find_classes_generic', () => {
    it('should find JavaScript classes', () => {
      const code = `
        class MyClass {
          constructor(name) {
            this.name = name;
          }
          
          greet() {
            return "Hello";
          }
        }
        
        class AnotherClass extends MyClass {
          static count = 0;
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const classes = find_classes_generic(context);
      expect(classes).toHaveLength(2);
      expect(classes[0].name).toBe('MyClass');
      expect(classes[1].name).toBe('AnotherClass');
      // Note: JavaScript extends is in a child node, not a field, so generic processor can't extract it
      // The bespoke handler in class_detection.javascript.bespoke.ts handles this
      expect(classes[1].extends).toBeUndefined();
    });
    
    it('should find Python classes', () => {
      const code = `
class BaseClass:
    def __init__(self, value):
        self.value = value
    
    def method(self):
        pass

class DerivedClass(BaseClass):
    def another_method(self):
        return self.value
      `;
      
      const tree = parse_code(code, 'python');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const classes = find_classes_generic(context);
      expect(classes).toHaveLength(2);
      expect(classes[0].name).toBe('BaseClass');
      expect(classes[1].name).toBe('DerivedClass');
      expect(classes[1].extends).toEqual(['BaseClass']);
    });
  });
  
  describe('extract_method_generic', () => {
    it('should extract JavaScript method', () => {
      const code = `
        class Test {
          static async fetchData() {
            return data;
          }
          
          #privateMethod() {}
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const config = get_language_config('javascript');
      let method_node: Parser.SyntaxNode | null = null;
      
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'method_definition' && !method_node) {
          method_node = node;
        }
      });
      
      if (method_node) {
        const method = extract_method_generic(method_node, context, config);
        expect(method).toBeDefined();
        expect(method?.name).toBe('fetchData');
        expect(method?.is_static).toBe(true);
        expect(method?.is_async).toBe(true);
      }
    });
    
    it('should extract Python method with parameters', () => {
      const code = `
class Test:
    def method(self, arg1, arg2=None, *args, **kwargs):
        pass
      `;
      
      const tree = parse_code(code, 'python');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const config = get_language_config('python');
      let method_node: Parser.SyntaxNode | null = null;
      
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'function_definition') {
          method_node = node;
        }
      });
      
      if (method_node) {
        const method = extract_method_generic(method_node, context, config);
        expect(method).toBeDefined();
        expect(method?.name).toBe('method');
        // self should be filtered out, leaving: arg1, arg2, *args, **kwargs
        expect(method?.parameters).toHaveLength(4);
      }
    });
  });
  
  describe('extract_property_generic', () => {
    it('should extract JavaScript class field', () => {
      const code = `
        class Test {
          static count = 0;
          #privateField = "secret";
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const config = get_language_config('javascript');
      let field_node: Parser.SyntaxNode | null = null;
      
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'field_definition' && !field_node) {
          field_node = node;
        }
      });
      
      if (field_node) {
        const property = extract_property_generic(field_node, context, config);
        expect(property).toBeDefined();
        expect(property?.name).toBe('count');
        expect(property?.is_static).toBe(true);
        expect(property?.initial_value).toBe('0');
      }
    });
  });
  
  describe('walk_tree', () => {
    it('should visit all nodes in the tree', () => {
      const code = `
        class A {
          method() {}
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const visited_types: string[] = [];
      
      walk_tree(tree.rootNode, (node) => {
        visited_types.push(node.type);
      });
      
      expect(visited_types).toContain('program');
      expect(visited_types).toContain('class_declaration');
      expect(visited_types).toContain('class_body');
      expect(visited_types).toContain('method_definition');
    });
  });
  
  describe('access modifier detection', () => {
    it('should detect private fields in JavaScript', () => {
      const code = `
        class Test {
          #privateField = 1;
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const classes = find_classes_generic(context);
      expect(classes[0].properties[0].is_private).toBe(true);
    });
    
    it('should detect Python privacy conventions', () => {
      const code = `
class Test:
    def _protected(self):
        pass
    
    def __private(self):
        pass
      `;
      
      const tree = parse_code(code, 'python');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const classes = find_classes_generic(context);
      const methods = classes[0].methods;
      
      const protectedMethod = methods.find(m => m.name === '_protected');
      const privateMethod = methods.find(m => m.name === '__private');
      
      expect(protectedMethod?.is_protected).toBe(true);
      expect(privateMethod?.is_private).toBe(true);
    });
  });
  
  describe('parameter extraction', () => {
    it('should extract optional and rest parameters', () => {
      const code = `
        class Test {
          method(required, optional = 5, ...rest) {}
        }
      `;
      
      const tree = parse_code(code, 'javascript');
      const context: ClassDetectionContext = {
        source_code: code,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const config = get_language_config('javascript');
      let params_node: Parser.SyntaxNode | null = null;
      
      walk_tree(tree.rootNode, (node) => {
        if (node.type === 'formal_parameters') {
          params_node = node;
        }
      });
      
      if (params_node) {
        const params = extract_parameters_generic(params_node, context, config);
        expect(params).toHaveLength(3);
        expect(params[0].is_optional).toBe(false);
        expect(params[1].is_optional).toBe(true);
        expect(params[1].default_value).toBe('5');
        expect(params[2].is_rest).toBe(true);
      }
    });
  });
});