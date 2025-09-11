import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import { Language } from '@ariadnejs/types';
import {
  infer_function_return_type,
  get_return_type_description,
  is_async_return_type,
  is_generator_return_type,
  ReturnTypeContext,
  ReturnTypeInfo
} from './index';
import { ExtendedDefinition } from './return_type_inference';
import { SyntaxNode } from 'tree-sitter';

describe('Return Type Inference - Comprehensive Tests', () => {
  describe('JavaScript', () => {
    it('should infer literal return types', () => {
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

function getNull() {
  return null;
}

function getUndefined() {
  return undefined;
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      // Test string literal
      const stringFunc = findFunction(tree.rootNode, 'getString');
      if (stringFunc) {
        const def = createDef('getString', 'function');
        const result = infer_function_return_type(def, stringFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('string');
        expect(result?.confidence).toBe('inferred');
      }

      // Test number literal
      const numberFunc = findFunction(tree.rootNode, 'getNumber');
      if (numberFunc) {
        const def = createDef('getNumber', 'function');
        const result = infer_function_return_type(def, numberFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('number');
        expect(result?.confidence).toBe('inferred');
      }

      // Test boolean literal
      const boolFunc = findFunction(tree.rootNode, 'getBoolean');
      if (boolFunc) {
        const def = createDef('getBoolean', 'function');
        const result = infer_function_return_type(def, boolFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('boolean');
        expect(result?.confidence).toBe('inferred');
      }

      // Test null literal
      const nullFunc = findFunction(tree.rootNode, 'getNull');
      if (nullFunc) {
        const def = createDef('getNull', 'function');
        const result = infer_function_return_type(def, nullFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('null');
        expect(result?.confidence).toBe('inferred');
      }

      // Test undefined literal
      const undefFunc = findFunction(tree.rootNode, 'getUndefined');
      if (undefFunc) {
        const def = createDef('getUndefined', 'function');
        const result = infer_function_return_type(def, undefFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('undefined');
        expect(result?.confidence).toBe('inferred');
      }
    });

    it('should infer collection types', () => {
      const code = `
function getArray() {
  return [1, 2, 3];
}

function getObject() {
  return { key: "value" };
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const arrayFunc = findFunction(tree.rootNode, 'getArray');
      if (arrayFunc) {
        const def = createDef('getArray', 'function');
        const result = infer_function_return_type(def, arrayFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Array');
      }

      const objectFunc = findFunction(tree.rootNode, 'getObject');
      if (objectFunc) {
        const def = createDef('getObject', 'function');
        const result = infer_function_return_type(def, objectFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Object');
      }
    });

    it('should infer constructor return types', () => {
      const code = `
function createDate() {
  return new Date();
}

function createCustom() {
  return new MyClass();
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const dateFunc = findFunction(tree.rootNode, 'createDate');
      if (dateFunc) {
        const def = createDef('createDate', 'function');
        const result = infer_function_return_type(def, dateFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Date');
        expect(result?.confidence).toBe('inferred');
      }

      const customFunc = findFunction(tree.rootNode, 'createCustom');
      if (customFunc) {
        const def = createDef('createCustom', 'function');
        const result = infer_function_return_type(def, customFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('MyClass');
      }
    });

    it('should handle void functions', () => {
      const code = `
function noReturn() {
  console.log("hello");
}

function emptyReturn() {
  return;
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const noReturnFunc = findFunction(tree.rootNode, 'noReturn');
      if (noReturnFunc) {
        const def = createDef('noReturn', 'function');
        const result = infer_function_return_type(def, noReturnFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('undefined');
        expect(result?.confidence).toBe('heuristic');
      }

      const emptyReturnFunc = findFunction(tree.rootNode, 'emptyReturn');
      if (emptyReturnFunc) {
        const def = createDef('emptyReturn', 'function');
        const result = infer_function_return_type(def, emptyReturnFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('undefined');
        expect(result?.confidence).toBe('explicit');  // Empty return is explicit undefined
      }
    });

    it('should handle async functions', () => {
      const code = `
async function fetchData() {
  return "data";
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const asyncFunc = findFunction(tree.rootNode, 'fetchData');
      if (asyncFunc) {
        const def = createDef('fetchData', 'function');
        const result = infer_function_return_type(def, asyncFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toContain('Promise');
        expect(is_async_return_type(result!, 'javascript')).toBe(true);
      }
    });

    it('should handle generator functions', () => {
      const code = `
function* generateNumbers() {
  yield 1;
  yield 2;
  yield 3;
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const genFunc = findFunction(tree.rootNode, 'generateNumbers');
      if (genFunc) {
        const def = createDef('generateNumbers', 'function');
        const result = infer_function_return_type(def, genFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Generator');
        expect(is_generator_return_type(result!, 'javascript')).toBe(true);
      }
    });
  });

  describe('TypeScript', () => {
    it('should extract explicit return type annotations', () => {
      const code = `
function getString(): string {
  return "hello";
}

function getNumber(): number {
  return 42;
}

function getVoid(): void {
  console.log("hello");
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const stringFunc = findFunction(tree.rootNode, 'getString');
      if (stringFunc) {
        const def = createDef('getString', 'function');
        const result = infer_function_return_type(def, stringFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('string');
        expect(result?.confidence).toBe('explicit');
      }

      const numberFunc = findFunction(tree.rootNode, 'getNumber');
      if (numberFunc) {
        const def = createDef('getNumber', 'function');
        const result = infer_function_return_type(def, numberFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('number');
        expect(result?.confidence).toBe('explicit');
      }

      const voidFunc = findFunction(tree.rootNode, 'getVoid');
      if (voidFunc) {
        const def = createDef('getVoid', 'function');
        const result = infer_function_return_type(def, voidFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('void');
        expect(result?.confidence).toBe('explicit');
      }
    });

    it('should handle generic return types', () => {
      const code = `
function getArray<T>(): T[] {
  return [];
}

function getPromise<T>(): Promise<T> {
  return Promise.resolve();
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const arrayFunc = findFunction(tree.rootNode, 'getArray');
      if (arrayFunc) {
        const def = createDef('getArray', 'function');
        const result = infer_function_return_type(def, arrayFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('T[]');
        expect(result?.confidence).toBe('explicit');
      }

      const promiseFunc = findFunction(tree.rootNode, 'getPromise');
      if (promiseFunc) {
        const def = createDef('getPromise', 'function');
        const result = infer_function_return_type(def, promiseFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Promise<T>');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });

  describe('Python', () => {
    it('should extract type hints', () => {
      const code = `
def get_string() -> str:
    return "hello"

def get_int() -> int:
    return 42

def get_none() -> None:
    print("hello")`;

      const parser = get_language_parser('python' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'python',
        source_code: code
      };

      const stringFunc = findFunction(tree.rootNode, 'get_string');
      if (stringFunc) {
        const def = createDef('get_string', 'function');
        const result = infer_function_return_type(def, stringFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('str');
        expect(result?.confidence).toBe('explicit');
      }

      const intFunc = findFunction(tree.rootNode, 'get_int');
      if (intFunc) {
        const def = createDef('get_int', 'function');
        const result = infer_function_return_type(def, intFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('int');
        expect(result?.confidence).toBe('explicit');
      }

      const noneFunc = findFunction(tree.rootNode, 'get_none');
      if (noneFunc) {
        const def = createDef('get_none', 'function');
        const result = infer_function_return_type(def, noneFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('None');
        expect(result?.confidence).toBe('explicit');
      }
    });

    it('should infer from literals', () => {
      const code = `
def get_string():
    return "hello"

def get_int():
    return 42

def get_list():
    return [1, 2, 3]`;

      const parser = get_language_parser('python' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'python',
        source_code: code
      };

      const stringFunc = findFunction(tree.rootNode, 'get_string');
      if (stringFunc) {
        const def = createDef('get_string', 'function');
        const result = infer_function_return_type(def, stringFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('string');
        expect(result?.confidence).toBe('inferred');
      }

      const intFunc = findFunction(tree.rootNode, 'get_int');
      if (intFunc) {
        const def = createDef('get_int', 'function');
        const result = infer_function_return_type(def, intFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('number');
        expect(result?.confidence).toBe('inferred');
      }

      const listFunc = findFunction(tree.rootNode, 'get_list');
      if (listFunc) {
        const def = createDef('get_list', 'function');
        const result = infer_function_return_type(def, listFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Array');
        expect(result?.confidence).toBe('inferred');
      }
    });

    it('should handle special methods', () => {
      const code = `
class MyClass:
    def __init__(self):
        self.value = 0
    
    def __str__(self):
        return str(self.value)
    
    def __len__(self):
        return 1`;

      const parser = get_language_parser('python' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'python',
        source_code: code,
        class_name: 'MyClass'
      };

      // Find __init__ method
      const initMethod = findMethod(tree.rootNode, '__init__');
      if (initMethod) {
        const def = createDef('__init__', 'method');
        const result = infer_function_return_type(def, initMethod, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('None');
        expect(result?.confidence).toBe('explicit');
      }

      // Find __str__ method
      const strMethod = findMethod(tree.rootNode, '__str__');
      if (strMethod) {
        const def = createDef('__str__', 'method');
        const result = infer_function_return_type(def, strMethod, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('str');
        expect(result?.confidence).toBe('explicit');
      }

      // Find __len__ method
      const lenMethod = findMethod(tree.rootNode, '__len__');
      if (lenMethod) {
        const def = createDef('__len__', 'method');
        const result = infer_function_return_type(def, lenMethod, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('int');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });

  describe('Rust', () => {
    it('should extract explicit return types', () => {
      const code = `
fn get_string() -> String {
    String::from("hello")
}

fn get_i32() -> i32 {
    42
}

fn get_unit() -> () {
    println!("hello");
}`;

      const parser = get_language_parser('rust' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'rust',
        source_code: code
      };

      const stringFunc = findFunction(tree.rootNode, 'get_string');
      if (stringFunc) {
        const def = createDef('get_string', 'function');
        const result = infer_function_return_type(def, stringFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('String');
        expect(result?.confidence).toBe('explicit');
      }

      const i32Func = findFunction(tree.rootNode, 'get_i32');
      if (i32Func) {
        const def = createDef('get_i32', 'function');
        const result = infer_function_return_type(def, i32Func, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('i32');
        expect(result?.confidence).toBe('explicit');
      }

      const unitFunc = findFunction(tree.rootNode, 'get_unit');
      if (unitFunc) {
        const def = createDef('get_unit', 'function');
        const result = infer_function_return_type(def, unitFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('()');
        expect(result?.confidence).toBe('explicit');
      }
    });

    it('should handle Result and Option types', () => {
      const code = `
fn get_result() -> Result<String, Error> {
    Ok(String::from("success"))
}

fn get_option() -> Option<i32> {
    Some(42)
}`;

      const parser = get_language_parser('rust' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'rust',
        source_code: code
      };

      const resultFunc = findFunction(tree.rootNode, 'get_result');
      if (resultFunc) {
        const def = createDef('get_result', 'function');
        const result = infer_function_return_type(def, resultFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Result<String, Error>');
        expect(result?.confidence).toBe('explicit');
      }

      const optionFunc = findFunction(tree.rootNode, 'get_option');
      if (optionFunc) {
        const def = createDef('get_option', 'function');
        const result = infer_function_return_type(def, optionFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Option<i32>');
        expect(result?.confidence).toBe('explicit');
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
}`;

      const parser = get_language_parser('rust' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'rust',
        source_code: code,
        class_name: 'MyStruct'
      };

      const newMethod = findMethod(tree.rootNode, 'new');
      if (newMethod) {
        const def = createDef('new', 'method');
        const result = infer_function_return_type(def, newMethod, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Self');
        expect(result?.confidence).toBe('explicit');
      }

      const cloneMethod = findMethod(tree.rootNode, 'clone');
      if (cloneMethod) {
        const def = createDef('clone', 'method');
        const result = infer_function_return_type(def, cloneMethod, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Self');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });

  describe('Utility Functions', () => {
    it('should provide descriptive return type names', () => {
      const explicitType: ReturnTypeInfo = {
        type_name: 'string',
        confidence: 'explicit',
        source: 'annotation'
      };
      expect(get_return_type_description(explicitType, 'typescript')).toBe('string');

      const inferredType: ReturnTypeInfo = {
        type_name: 'number',
        confidence: 'inferred',
        source: 'return_statement'
      };
      expect(get_return_type_description(inferredType, 'javascript')).toBe('number (inferred)');
    });

    it('should detect async return types', () => {
      const promiseType: ReturnTypeInfo = {
        type_name: 'Promise<string>',
        confidence: 'explicit',
        source: 'annotation'
      };
      expect(is_async_return_type(promiseType, 'typescript')).toBe(true);

      const normalType: ReturnTypeInfo = {
        type_name: 'string',
        confidence: 'explicit',
        source: 'annotation'
      };
      expect(is_async_return_type(normalType, 'typescript')).toBe(false);
    });

    it('should detect generator return types', () => {
      const generatorType: ReturnTypeInfo = {
        type_name: 'Generator<number>',
        confidence: 'explicit',
        source: 'annotation'
      };
      expect(is_generator_return_type(generatorType, 'typescript')).toBe(true);

      const normalType: ReturnTypeInfo = {
        type_name: 'number',
        confidence: 'explicit',
        source: 'annotation'
      };
      expect(is_generator_return_type(normalType, 'typescript')).toBe(false);
    });
  });
});

// Helper functions
function findFunction(root: SyntaxNode, name: string): SyntaxNode | undefined {
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child && (child.type === 'function_declaration' || 
                  child.type === 'function_definition' ||
                  child.type === 'function_item')) {
      const nameNode = child.childForFieldName('name');
      if (nameNode && nameNode.text === name) {
        return child;
      }
    }
    // Recursively search in child nodes
    if (child) {
      const found = findFunction(child, name);
      if (found) return found;
    }
  }
  return undefined;
}

function findMethod(root: SyntaxNode, name: string): SyntaxNode | undefined {
  function traverse(node: SyntaxNode): SyntaxNode | undefined {
    if (node.type === 'function_definition' || node.type === 'function_item') {
      const nameNode = node.childForFieldName('name');
      if (nameNode && nameNode.text === name) {
        return node;
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = traverse(child);
        if (result) return result;
      }
    }
    
    return undefined;
  }
  
  return traverse(root);
}

function createDef(name: string, kind: 'function' | 'method'): ExtendedDefinition {
  return {
    name,
    location: {
      file_path: 'test.ts' as any,
      line: 0,
      column: 0,
      end_line: 10,
      end_column: 0
    },
    symbol_kind: kind,
    range: {
      start: { row: 0, column: 0 },
      end: { row: 10, column: 0 }
    }
  };
}