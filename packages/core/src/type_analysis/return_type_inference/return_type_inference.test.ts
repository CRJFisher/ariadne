import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import { Language, Def } from '@ariadnejs/types';
import {
  infer_function_return_type,
  extract_return_type_annotation,
  analyze_function_returns,
  analyze_return_statement,
  infer_expression_type,
  check_return_patterns,
  get_return_type_description,
  is_async_return_type,
  is_generator_return_type,
  ReturnTypeContext,
  ReturnTypeInfo
} from './index';

describe('return_type_inference', () => {
  describe('JavaScript return type inference', () => {
    it('should infer return type from literals', () => {
      const code = `
        function getString() {
          return "hello";
        }
        
        function getNumber() {
          return 42;
        }
        
        function getBoolean() {
          return true;
        }
        
        function getArray() {
          return [1, 2, 3];
        }
        
        function getObject() {
          return { key: "value" };
        }
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };
      
      // Find getString function
      const get_string_node = find_function_by_name(tree.rootNode, 'getString');
      expect(get_string_node).toBeDefined();
      if (get_string_node) {
        const def: Def = create_mock_def('getString', 'function');
        const return_type = infer_function_return_type(def, get_string_node, context);
        expect(return_type?.type_name).toBe('string');
        expect(return_type?.confidence).toBe('explicit');
      }
      
      // Find getNumber function
      const get_number_node = find_function_by_name(tree.rootNode, 'getNumber');
      if (get_number_node) {
        const def: Def = create_mock_def('getNumber', 'function');
        const return_type = infer_function_return_type(def, get_number_node, context);
        expect(return_type?.type_name).toBe('number');
      }
      
      // Find getBoolean function
      const get_boolean_node = find_function_by_name(tree.rootNode, 'getBoolean');
      if (get_boolean_node) {
        const def: Def = create_mock_def('getBoolean', 'function');
        const return_type = infer_function_return_type(def, get_boolean_node, context);
        expect(return_type?.type_name).toBe('boolean');
      }
      
      // Find getArray function
      const get_array_node = find_function_by_name(tree.rootNode, 'getArray');
      if (get_array_node) {
        const def: Def = create_mock_def('getArray', 'function');
        const return_type = infer_function_return_type(def, get_array_node, context);
        expect(return_type?.type_name).toBe('Array');
      }
      
      // Find getObject function
      const get_object_node = find_function_by_name(tree.rootNode, 'getObject');
      if (get_object_node) {
        const def: Def = create_mock_def('getObject', 'function');
        const return_type = infer_function_return_type(def, get_object_node, context);
        expect(return_type?.type_name).toBe('Object');
      }
    });

    it('should infer return type from constructor calls', () => {
      const code = `
        function createDate() {
          return new Date();
        }
        
        function createMap() {
          return new Map();
        }
        
        function createCustom() {
          return new MyClass();
        }
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };
      
      const create_date_node = find_function_by_name(tree.rootNode, 'createDate');
      if (create_date_node) {
        const def: Def = create_mock_def('createDate', 'function');
        const return_type = infer_function_return_type(def, create_date_node, context);
        expect(return_type?.type_name).toBe('Date');
      }
      
      const create_map_node = find_function_by_name(tree.rootNode, 'createMap');
      if (create_map_node) {
        const def: Def = create_mock_def('createMap', 'function');
        const return_type = infer_function_return_type(def, create_map_node, context);
        expect(return_type?.type_name).toBe('Map');
      }
      
      const create_custom_node = find_function_by_name(tree.rootNode, 'createCustom');
      if (create_custom_node) {
        const def: Def = create_mock_def('createCustom', 'function');
        const return_type = infer_function_return_type(def, create_custom_node, context);
        expect(return_type?.type_name).toBe('MyClass');
      }
    });

    it('should handle void/undefined returns', () => {
      const code = `
        function noReturn() {
          console.log("hello");
        }
        
        function emptyReturn() {
          return;
        }
        
        function undefinedReturn() {
          return undefined;
        }
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };
      
      const no_return_node = find_function_by_name(tree.rootNode, 'noReturn');
      if (no_return_node) {
        const def: Def = create_mock_def('noReturn', 'function');
        const return_type = infer_function_return_type(def, no_return_node, context);
        expect(return_type?.type_name).toBe('undefined');
      }
      
      const empty_return_node = find_function_by_name(tree.rootNode, 'emptyReturn');
      if (empty_return_node) {
        const def: Def = create_mock_def('emptyReturn', 'function');
        const return_type = infer_function_return_type(def, empty_return_node, context);
        expect(return_type?.type_name).toBe('undefined');
      }
      
      const undefined_return_node = find_function_by_name(tree.rootNode, 'undefinedReturn');
      if (undefined_return_node) {
        const def: Def = create_mock_def('undefinedReturn', 'function');
        const return_type = infer_function_return_type(def, undefined_return_node, context);
        expect(return_type?.type_name).toBe('undefined');
      }
    });

    it('should detect async functions', () => {
      const code = `
        async function fetchData() {
          return "data";
        }
        
        const asyncArrow = async () => {
          return 42;
        };
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };
      
      const fetch_data_node = find_function_by_name(tree.rootNode, 'fetchData');
      if (fetch_data_node) {
        const def: Def = create_mock_def('fetchData', 'function');
        const return_type = infer_function_return_type(def, fetch_data_node, context);
        expect(return_type?.type_name).toContain('Promise');
      }
    });

    it('should detect generator functions', () => {
      const code = `
        function* generator() {
          yield 1;
          yield 2;
          yield 3;
        }
      `;
      
      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };
      
      const generator_node = find_function_by_name(tree.rootNode, 'generator');
      if (generator_node) {
        const def: Def = create_mock_def('generator', 'function');
        const return_type = infer_function_return_type(def, generator_node, context);
        expect(return_type?.type_name).toBe('Generator');
      }
    });
  });

  describe('TypeScript return type inference', () => {
    it('should extract explicit return type annotations', () => {
      const code = `
        function getString(): string {
          return "hello";
        }
        
        function getNumber(): number {
          return 42;
        }
        
        function getArray(): string[] {
          return ["a", "b"];
        }
        
        function getPromise(): Promise<string> {
          return Promise.resolve("data");
        }
        
        function getUnion(): string | number {
          return Math.random() > 0.5 ? "text" : 123;
        }
      `;
      
      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };
      
      const get_string_node = find_function_by_name(tree.rootNode, 'getString');
      if (get_string_node) {
        const def: Def = create_mock_def('getString', 'function');
        const return_type = infer_function_return_type(def, get_string_node, context);
        expect(return_type?.type_name).toBe('string');
        expect(return_type?.confidence).toBe('explicit');
        expect(return_type?.source).toBe('annotation');
      }
      
      const get_number_node = find_function_by_name(tree.rootNode, 'getNumber');
      if (get_number_node) {
        const def: Def = create_mock_def('getNumber', 'function');
        const return_type = infer_function_return_type(def, get_number_node, context);
        expect(return_type?.type_name).toBe('number');
      }
      
      const get_array_node = find_function_by_name(tree.rootNode, 'getArray');
      if (get_array_node) {
        const def: Def = create_mock_def('getArray', 'function');
        const return_type = infer_function_return_type(def, get_array_node, context);
        expect(return_type?.type_name).toBe('string[]');
      }
      
      const get_promise_node = find_function_by_name(tree.rootNode, 'getPromise');
      if (get_promise_node) {
        const def: Def = create_mock_def('getPromise', 'function');
        const return_type = infer_function_return_type(def, get_promise_node, context);
        expect(return_type?.type_name).toBe('Promise<string>');
      }
      
      const get_union_node = find_function_by_name(tree.rootNode, 'getUnion');
      if (get_union_node) {
        const def: Def = create_mock_def('getUnion', 'function');
        const return_type = infer_function_return_type(def, get_union_node, context);
        expect(return_type?.type_name).toBe('string | number');
      }
    });

    it('should handle type guards', () => {
      const code = `
        function isString(value: unknown): value is string {
          return typeof value === "string";
        }
      `;
      
      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };
      
      const is_string_node = find_function_by_name(tree.rootNode, 'isString');
      if (is_string_node) {
        const def: Def = create_mock_def('isString', 'function');
        const return_type = infer_function_return_type(def, is_string_node, context);
        // Type guards return boolean
        expect(return_type?.type_name).toBe('boolean');
      }
    });
  });

  describe('Python return type inference', () => {
    it('should extract type hints', () => {
      const code = `
def get_string() -> str:
    return "hello"

def get_number() -> int:
    return 42

def get_list() -> List[str]:
    return ["a", "b", "c"]

def get_optional() -> Optional[str]:
    return None

def get_union() -> Union[str, int]:
    return "text"
      `;
      
      const parser = get_language_parser('python' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'python',
        source_code: code
      };
      
      const get_string_node = find_function_by_name(tree.rootNode, 'get_string');
      if (get_string_node) {
        const def: Def = create_mock_def('get_string', 'function');
        const return_type = infer_function_return_type(def, get_string_node, context);
        expect(return_type?.type_name).toBe('str');
      }
      
      const get_number_node = find_function_by_name(tree.rootNode, 'get_number');
      if (get_number_node) {
        const def: Def = create_mock_def('get_number', 'function');
        const return_type = infer_function_return_type(def, get_number_node, context);
        expect(return_type?.type_name).toBe('int');
      }
      
      const get_list_node = find_function_by_name(tree.rootNode, 'get_list');
      if (get_list_node) {
        const def: Def = create_mock_def('get_list', 'function');
        const return_type = infer_function_return_type(def, get_list_node, context);
        expect(return_type?.type_name).toBe('List[str]');
      }
    });

    it('should infer return type from literals', () => {
      const code = `
def get_string():
    return "hello"

def get_number():
    return 42

def get_float():
    return 3.14

def get_bool():
    return True

def get_list():
    return [1, 2, 3]

def get_dict():
    return {"key": "value"}

def get_none():
    return None
      `;
      
      const parser = get_language_parser('python' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'python',
        source_code: code
      };
      
      const get_string_node = find_function_by_name(tree.rootNode, 'get_string');
      if (get_string_node) {
        const def: Def = create_mock_def('get_string', 'function');
        const return_type = infer_function_return_type(def, get_string_node, context);
        expect(return_type?.type_name).toBe('str');
      }
      
      const get_number_node = find_function_by_name(tree.rootNode, 'get_number');
      if (get_number_node) {
        const def: Def = create_mock_def('get_number', 'function');
        const return_type = infer_function_return_type(def, get_number_node, context);
        expect(return_type?.type_name).toBe('int');
      }
      
      const get_float_node = find_function_by_name(tree.rootNode, 'get_float');
      if (get_float_node) {
        const def: Def = create_mock_def('get_float', 'function');
        const return_type = infer_function_return_type(def, get_float_node, context);
        expect(return_type?.type_name).toBe('float');
      }
      
      const get_bool_node = find_function_by_name(tree.rootNode, 'get_bool');
      if (get_bool_node) {
        const def: Def = create_mock_def('get_bool', 'function');
        const return_type = infer_function_return_type(def, get_bool_node, context);
        expect(return_type?.type_name).toBe('bool');
      }
      
      const get_none_node = find_function_by_name(tree.rootNode, 'get_none');
      if (get_none_node) {
        const def: Def = create_mock_def('get_none', 'function');
        const return_type = infer_function_return_type(def, get_none_node, context);
        expect(return_type?.type_name).toBe('None');
      }
    });

    it('should handle special methods', () => {
      const code = `
class MyClass:
    def __init__(self):
        pass
    
    def __str__(self):
        return "MyClass instance"
    
    def __len__(self):
        return 42
    
    def __bool__(self):
        return True
      `;
      
      const parser = get_language_parser('python' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'python',
        source_code: code,
        class_name: 'MyClass'
      };
      
      const init_node = find_function_by_name(tree.rootNode, '__init__');
      if (init_node) {
        const def: Def = create_mock_def('__init__', 'method');
        const return_type = infer_function_return_type(def, init_node, context);
        expect(return_type?.type_name).toBe('None');
      }
      
      const str_node = find_function_by_name(tree.rootNode, '__str__');
      if (str_node) {
        const def: Def = create_mock_def('__str__', 'method');
        const return_type = infer_function_return_type(def, str_node, context);
        expect(return_type?.type_name).toBe('str');
      }
      
      const len_node = find_function_by_name(tree.rootNode, '__len__');
      if (len_node) {
        const def: Def = create_mock_def('__len__', 'method');
        const return_type = infer_function_return_type(def, len_node, context);
        expect(return_type?.type_name).toBe('int');
      }
      
      const bool_node = find_function_by_name(tree.rootNode, '__bool__');
      if (bool_node) {
        const def: Def = create_mock_def('__bool__', 'method');
        const return_type = infer_function_return_type(def, bool_node, context);
        expect(return_type?.type_name).toBe('bool');
      }
    });
  });

  describe('Rust return type inference', () => {
    it('should extract explicit return types', () => {
      const code = `
fn get_string() -> String {
    String::from("hello")
}

fn get_number() -> i32 {
    42
}

fn get_vec() -> Vec<String> {
    vec!["a".to_string(), "b".to_string()]
}

fn get_result() -> Result<String, Error> {
    Ok("success".to_string())
}

fn get_option() -> Option<i32> {
    Some(42)
}

fn get_unit() -> () {
    println!("hello");
}
      `;
      
      const parser = get_language_parser('rust' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'rust',
        source_code: code
      };
      
      const get_string_node = find_function_by_name(tree.rootNode, 'get_string');
      if (get_string_node) {
        const def: Def = create_mock_def('get_string', 'function');
        const return_type = infer_function_return_type(def, get_string_node, context);
        expect(return_type?.type_name).toBe('String');
      }
      
      const get_number_node = find_function_by_name(tree.rootNode, 'get_number');
      if (get_number_node) {
        const def: Def = create_mock_def('get_number', 'function');
        const return_type = infer_function_return_type(def, get_number_node, context);
        expect(return_type?.type_name).toBe('i32');
      }
      
      const get_vec_node = find_function_by_name(tree.rootNode, 'get_vec');
      if (get_vec_node) {
        const def: Def = create_mock_def('get_vec', 'function');
        const return_type = infer_function_return_type(def, get_vec_node, context);
        expect(return_type?.type_name).toBe('Vec<String>');
      }
      
      const get_result_node = find_function_by_name(tree.rootNode, 'get_result');
      if (get_result_node) {
        const def: Def = create_mock_def('get_result', 'function');
        const return_type = infer_function_return_type(def, get_result_node, context);
        expect(return_type?.type_name).toBe('Result<String, Error>');
      }
      
      const get_option_node = find_function_by_name(tree.rootNode, 'get_option');
      if (get_option_node) {
        const def: Def = create_mock_def('get_option', 'function');
        const return_type = infer_function_return_type(def, get_option_node, context);
        expect(return_type?.type_name).toBe('Option<i32>');
      }
      
      const get_unit_node = find_function_by_name(tree.rootNode, 'get_unit');
      if (get_unit_node) {
        const def: Def = create_mock_def('get_unit', 'function');
        const return_type = infer_function_return_type(def, get_unit_node, context);
        expect(return_type?.type_name).toBe('()');
      }
    });

    it('should handle impl methods', () => {
      const code = `
impl MyStruct {
    fn new() -> Self {
        MyStruct { value: 0 }
    }
    
    fn clone(&self) -> Self {
        MyStruct { value: self.value }
    }
    
    fn default() -> Self {
        MyStruct { value: 0 }
    }
}
      `;
      
      const parser = get_language_parser('rust' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'rust',
        source_code: code,
        class_name: 'MyStruct'
      };
      
      const new_node = find_function_by_name(tree.rootNode, 'new');
      if (new_node) {
        const def: Def = create_mock_def('new', 'method');
        const return_type = infer_function_return_type(def, new_node, context);
        expect(return_type?.type_name).toBe('Self');
      }
      
      const clone_node = find_function_by_name(tree.rootNode, 'clone');
      if (clone_node) {
        const def: Def = create_mock_def('clone', 'method');
        const return_type = infer_function_return_type(def, clone_node, context);
        expect(return_type?.type_name).toBe('Self');
      }
      
      const default_node = find_function_by_name(tree.rootNode, 'default');
      if (default_node) {
        const def: Def = create_mock_def('default', 'method');
        const return_type = infer_function_return_type(def, default_node, context);
        expect(return_type?.type_name).toBe('Self');
      }
    });
  });

  describe('Utility functions', () => {
    it('should provide descriptive return type names', () => {
      const explicit_type: ReturnTypeInfo = {
        type_name: 'string',
        confidence: 'explicit',
        source: 'annotation'
      };
      
      const inferred_type: ReturnTypeInfo = {
        type_name: 'number',
        confidence: 'inferred',
        source: 'return_statement'
      };
      
      const heuristic_type: ReturnTypeInfo = {
        type_name: 'any',
        confidence: 'heuristic',
        source: 'pattern'
      };
      
      expect(get_return_type_description(explicit_type, 'typescript')).toBe('string');
      expect(get_return_type_description(inferred_type, 'typescript')).toBe('number (inferred)');
      expect(get_return_type_description(heuristic_type, 'typescript')).toBe('any (heuristic)');
    });

    it('should detect async return types', () => {
      const promise_type: ReturnTypeInfo = {
        type_name: 'Promise<string>',
        confidence: 'explicit',
        source: 'annotation'
      };
      
      const coroutine_type: ReturnTypeInfo = {
        type_name: 'Coroutine',
        confidence: 'inferred',
        source: 'pattern'
      };
      
      const future_type: ReturnTypeInfo = {
        type_name: 'impl Future<Output = String>',
        confidence: 'inferred',
        source: 'pattern'
      };
      
      expect(is_async_return_type(promise_type, 'typescript')).toBe(true);
      expect(is_async_return_type(coroutine_type, 'python')).toBe(true);
      expect(is_async_return_type(future_type, 'rust')).toBe(true);
    });

    it('should detect generator return types', () => {
      const js_generator: ReturnTypeInfo = {
        type_name: 'Generator',
        confidence: 'inferred',
        source: 'pattern'
      };
      
      const py_generator: ReturnTypeInfo = {
        type_name: 'Generator[int, None, None]',
        confidence: 'explicit',
        source: 'annotation'
      };
      
      const rust_iterator: ReturnTypeInfo = {
        type_name: 'impl Iterator<Item = String>',
        confidence: 'explicit',
        source: 'annotation'
      };
      
      expect(is_generator_return_type(js_generator, 'javascript')).toBe(true);
      expect(is_generator_return_type(py_generator, 'python')).toBe(true);
      expect(is_generator_return_type(rust_iterator, 'rust')).toBe(true);
    });
  });
});

// Helper functions for testing

function find_function_by_name(node: any, name: string): any {
  if (node.type === 'function_declaration' || 
      node.type === 'function_definition' ||
      node.type === 'function_item') {
    const name_node = node.childForFieldName('name');
    if (name_node && name_node.text === name) {
      return node;
    }
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const result = find_function_by_name(child, name);
      if (result) {
        return result;
      }
    }
  }
  
  return null;
}

function create_mock_def(name: string, type: 'function' | 'method'): Def {
  return {
    name,
    type,
    range: {
      start: { row: 0, column: 0 },
      end: { row: 0, column: 0 }
    }
  };
}