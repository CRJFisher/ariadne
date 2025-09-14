import { describe, it, expect } from 'vitest';
import { 
  extract_parameters,
  ParameterAnalysis,
  ParameterInferenceContext
} from './index';
// Import internal functions directly for testing
import {
  infer_parameter_types,
  infer_type_from_default,
  check_parameter_patterns,
} from './parameter_type_inference';
import { get_language_parser } from '../../scope_analysis/scope_tree/loader';
import { Language, FunctionDefinition, Location, DocString } from '@ariadnejs/types';

function create_mock_def(name: string, kind: string): FunctionDefinition {
  const location: Location = {
    file_path: 'test.ts',
    start: { row: 0, column: 0 },
    end: { row: 1, column: 0 }
  };
  
  return {
    name,
    location,
    signature: {
      signature: `function ${name}()`,
      parameters: [],
      return_type: "void",
      is_async: false,
      is_generator: false,
      type_parameters: [],
    },
    metadata: {
      is_async: false,
      is_generator: false,
      is_exported: false,
      is_test: false,
      is_private: false,
      complexity: 0,
      line_count: 1,
      parameter_names: [],
      has_decorator: false,
    },
    docstring: "" as DocString,
    decorators: [],
    is_exported: false,
    is_arrow_function: false,
    is_anonymous: false,
    closure_captures: [],
  };
}

function find_function_by_name(root: any, name: string): any {
  const queue = [root];
  while (queue.length > 0) {
    const node = queue.shift();
    if ((node.type === 'function_declaration' || 
         node.type === 'function_definition' ||
         node.type === 'function_item') && 
        node.childForFieldName('name')?.text === name) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) queue.push(child);
    }
  }
  return null;
}

describe('parameter_type_inference', () => {
  describe('JavaScript parameter type inference', () => {
    it('should infer types from default values', () => {
      const code = `
        function test(
          str = "hello",
          num = 42,
          bool = true,
          arr = [],
          obj = {}
        ) {}
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      expect(func_node).toBeDefined();
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.parameters).toHaveLength(5);
        expect(analysis.inferred_types.get('str')?.inferred_type).toBe('string');
        expect(analysis.inferred_types.get('num')?.inferred_type).toBe('number');
        expect(analysis.inferred_types.get('bool')?.inferred_type).toBe('boolean');
        expect(analysis.inferred_types.get('arr')?.inferred_type).toBe('Array');
        expect(analysis.inferred_types.get('obj')?.inferred_type).toBe('Object');
      }
    });

    it('should detect common parameter patterns', () => {
      const code = `
        function test(
          callback,
          options,
          isEnabled,
          count,
          message
        ) {}
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('callback')?.inferred_type).toBe('Function');
        expect(analysis.inferred_types.get('options')?.inferred_type).toBe('Object');
        expect(analysis.inferred_types.get('isEnabled')?.inferred_type).toBe('boolean');
        expect(analysis.inferred_types.get('count')?.inferred_type).toBe('number');
        expect(analysis.inferred_types.get('message')?.inferred_type).toBe('string');
      }
    });

    it('should infer types from parameter usage', () => {
      const code = `
        function test(arr, obj, func, str, num) {
          arr.push(1);
          obj.property = 'value';
          func();
          str.toLowerCase();
          num + 10;
        }
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('arr')?.inferred_type).toBe('Array');
        expect(analysis.inferred_types.get('obj')?.inferred_type).toBe('Object');
        expect(analysis.inferred_types.get('func')?.inferred_type).toBe('Function');
        expect(analysis.inferred_types.get('str')?.inferred_type).toBe('string');
        expect(analysis.inferred_types.get('num')?.inferred_type).toBe('number');
      }
    });

    it('should handle rest parameters', () => {
      const code = `
        function test(first, ...rest) {}
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const params = extract_parameters(func_node, context);
        expect(params).toHaveLength(2);
        expect(params[1].name).toBe('rest');
        expect(params[1].is_rest).toBe(true);
      }
    });
  });

  describe('TypeScript parameter type inference', () => {
    it('should extract explicit type annotations', () => {
      const code = `
        function test(
          str: string,
          num: number,
          bool: boolean,
          arr: string[],
          obj: { key: string }
        ) {}
      `;
      
      const parser = get_language_parser('typescript' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'typescript',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('str')?.inferred_type).toBe('string');
        expect(analysis.inferred_types.get('str')?.confidence).toBe('explicit');
        expect(analysis.inferred_types.get('num')?.inferred_type).toBe('number');
        expect(analysis.inferred_types.get('bool')?.inferred_type).toBe('boolean');
        expect(analysis.inferred_types.get('arr')?.inferred_type).toBe('string[]');
        expect(analysis.inferred_types.get('obj')?.inferred_type).toBe('{ key: string }');
      }
    });

    it('should handle optional parameters', () => {
      const code = `
        function test(
          required: string,
          optional?: number,
          withDefault: boolean = false
        ) {}
      `;
      
      const parser = get_language_parser('typescript' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'typescript',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const params = extract_parameters(func_node, context);
        expect(params).toHaveLength(3);
        expect(params[1].is_optional).toBe(true);
        expect(params[2].default_value).toBe('false');
      }
    });


  describe('Python parameter type inference', () => {
    it('should extract type hints', () => {
      const code = `
def test(
    name: str,
    age: int,
    active: bool,
    tags: list[str]
):
    pass
      `;
      
      const parser = get_language_parser('python' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('name')?.inferred_type).toBe('str');
        expect(analysis.inferred_types.get('age')?.inferred_type).toBe('int');
        expect(analysis.inferred_types.get('active')?.inferred_type).toBe('bool');
        expect(analysis.inferred_types.get('tags')?.inferred_type).toBe('list[str]');
      }
    });

    it('should handle self and cls parameters', () => {
      const code = `
class TestClass:
    def instance_method(self, value):
        pass
    
    @classmethod
    def class_method(cls, value):
        pass
      `;
      
      const parser = get_language_parser('python' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code,
        class_name: 'TestClass'
      };
      
      // Find instance_method
      let func_node = null;
      function findMethod(node: any, name: string): any {
        if (node.type === 'function_definition' && 
            node.childForFieldName('name')?.text === name) {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findMethod(child, name);
            if (result) return result;
          }
        }
        return null;
      }
      
      func_node = findMethod(tree.rootNode, 'instance_method');
      if (func_node) {
        const def = create_mock_def('instance_method', 'method');
        const analysis = infer_parameter_types(def, func_node, context);
        expect(analysis.inferred_types.get('self')?.inferred_type).toBe('TestClass');
      }
      
      func_node = findMethod(tree.rootNode, 'class_method');
      if (func_node) {
        const def = create_mock_def('class_method', 'method');
        const analysis = infer_parameter_types(def, func_node, context);
        expect(analysis.inferred_types.get('cls')?.inferred_type).toBe('Type[TestClass]');
      }
    });

    it('should handle *args and **kwargs', () => {
      const code = `
def test(regular, *args, **kwargs):
    pass
      `;
      
      const parser = get_language_parser('python' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('args')?.inferred_type).toBe('tuple');
        expect(analysis.inferred_types.get('kwargs')?.inferred_type).toBe('dict');
      }
    });

    it('should infer types from default values', () => {
      const code = `
def test(
    name="Alice",
    age=30,
    active=True,
    tags=[],
    data={}
):
    pass
      `;
      
      const parser = get_language_parser('python' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'python',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('name')?.inferred_type).toBe('str');
        expect(analysis.inferred_types.get('age')?.inferred_type).toBe('int');
        expect(analysis.inferred_types.get('active')?.inferred_type).toBe('bool');
        expect(analysis.inferred_types.get('tags')?.inferred_type).toBe('list');
        expect(analysis.inferred_types.get('data')?.inferred_type).toBe('dict');
      }
    });
  });

  describe('Rust parameter type inference', () => {
    it('should extract explicit type annotations', () => {
      const code = `
fn test(
    name: String,
    age: u32,
    active: bool,
    tags: Vec<String>
) {}
      `;
      
      const parser = get_language_parser('rust' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('name')?.inferred_type).toBe('String');
        expect(analysis.inferred_types.get('age')?.inferred_type).toBe('u32');
        expect(analysis.inferred_types.get('active')?.inferred_type).toBe('bool');
        expect(analysis.inferred_types.get('tags')?.inferred_type).toBe('Vec<String>');
      }
    });

    it('should handle self parameters', () => {
      const code = `
impl TestStruct {
    fn by_ref(&self) {}
    fn by_mut_ref(&mut self) {}
    fn by_value(self) {}
}
      `;
      
      const parser = get_language_parser('rust' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      // Find methods
      function findMethod(node: any, name: string): any {
        if (node.type === 'function_item' && 
            node.childForFieldName('name')?.text === name) {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findMethod(child, name);
            if (result) return result;
          }
        }
        return null;
      }
      
      let func_node = findMethod(tree.rootNode, 'by_ref');
      if (func_node) {
        const def = create_mock_def('by_ref', 'method');
        const analysis = infer_parameter_types(def, func_node, context);
        expect(analysis.inferred_types.get('self')?.inferred_type).toBe('&Self');
      }
      
      func_node = findMethod(tree.rootNode, 'by_mut_ref');
      if (func_node) {
        const def = create_mock_def('by_mut_ref', 'method');
        const analysis = infer_parameter_types(def, func_node, context);
        expect(analysis.inferred_types.get('self')?.inferred_type).toBe('&mut Self');
      }
      
      func_node = findMethod(tree.rootNode, 'by_value');
      if (func_node) {
        const def = create_mock_def('by_value', 'method');
        const analysis = infer_parameter_types(def, func_node, context);
        expect(analysis.inferred_types.get('self')?.inferred_type).toBe('Self');
      }
    });

    it('should handle reference types', () => {
      const code = `
fn test(
    string_ref: &str,
    mut_vec: &mut Vec<i32>,
    slice: &[u8]
) {}
      `;
      
      const parser = get_language_parser('rust' as Language);
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = find_function_by_name(tree.rootNode, 'test');
      if (func_node) {
        const def = create_mock_def('test', 'function');
        const analysis = infer_parameter_types(def, func_node, context);
        
        expect(analysis.inferred_types.get('string_ref')?.inferred_type).toBe('&str');
        expect(analysis.inferred_types.get('mut_vec')?.inferred_type).toBe('&mut Vec<i32>');
        expect(analysis.inferred_types.get('slice')?.inferred_type).toBe('&[u8]');
      }
    });
  });

  describe('Utility functions', () => {
    it('should infer type from default values', () => {
      expect(infer_type_from_default('true', 'javascript')?.inferred_type).toBe('boolean');
      expect(infer_type_from_default('"hello"', 'javascript')?.inferred_type).toBe('string');
      expect(infer_type_from_default('42', 'javascript')?.inferred_type).toBe('number');
      expect(infer_type_from_default('[]', 'javascript')?.inferred_type).toBe('Array');
      expect(infer_type_from_default('{}', 'javascript')?.inferred_type).toBe('Object');
      
      expect(infer_type_from_default('True', 'python')?.inferred_type).toBe('bool');
      expect(infer_type_from_default('None', 'python')?.inferred_type).toBe('None');
      expect(infer_type_from_default('3.14', 'python')?.inferred_type).toBe('float');
    });

    it('should check parameter patterns', () => {
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: ''
      };
      
      expect(check_parameter_patterns({ name: 'callback', position: 0 }, context)?.inferred_type)
        .toBe('Function');
      expect(check_parameter_patterns({ name: 'isEnabled', position: 0 }, context)?.inferred_type)
        .toBe('boolean');
      expect(check_parameter_patterns({ name: 'count', position: 0 }, context)?.inferred_type)
        .toBe('number');
      expect(check_parameter_patterns({ name: 'message', position: 0 }, context)?.inferred_type)
        .toBe('string');
      expect(check_parameter_patterns({ name: 'items', position: 0 }, context)?.inferred_type)
        .toBe('Array');
    });

  });
  });
});