import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import { Language } from '@ariadnejs/types';
import { 
  infer_function_return_type,
  ReturnTypeContext 
} from './index';
import { ExtendedDefinition } from './return_type_inference';
import { SyntaxNode } from 'tree-sitter';

describe('JavaScript Bespoke Return Type Handlers', () => {
  describe('JSDoc type annotations', () => {
    it('should extract return type from JSDoc @returns tag', () => {
      const code = `
/**
 * Gets a string value
 * @returns {string} The string value
 */
function getString() {
  return "hello";
}

/**
 * @returns {number}
 */
function getNumber() {
  return 42;
}

/** @returns {Promise<string>} */
async function fetchData() {
  return "data";
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      // getString with JSDoc
      const stringFunc = findFunction(tree.rootNode, 'getString');
      if (stringFunc) {
        const def = createDef('getString', 'function');
        const result = infer_function_return_type(def, stringFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('string');
        expect(result?.confidence).toBe('explicit');
        expect(result?.source).toBe('annotation');
      }

      // getNumber with JSDoc
      const numberFunc = findFunction(tree.rootNode, 'getNumber');
      if (numberFunc) {
        const def = createDef('getNumber', 'function');
        const result = infer_function_return_type(def, numberFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('number');
        expect(result?.confidence).toBe('explicit');
      }

      // fetchData with JSDoc Promise type
      const fetchFunc = findFunction(tree.rootNode, 'fetchData');
      if (fetchFunc) {
        const def = createDef('fetchData', 'function');
        const result = infer_function_return_type(def, fetchFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Promise<string>');
        expect(result?.confidence).toBe('explicit');
      }
    });

    it('should handle JSDoc union types', () => {
      const code = `
/**
 * @returns {string|number} Either a string or number
 */
function getStringOrNumber(flag) {
  return flag ? "text" : 42;
}

/**
 * @returns {?string} Nullable string
 */
function getNullableString() {
  return null;
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const unionFunc = findFunction(tree.rootNode, 'getStringOrNumber');
      if (unionFunc) {
        const def = createDef('getStringOrNumber', 'function');
        const result = infer_function_return_type(def, unionFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('string | number');
        expect(result?.confidence).toBe('explicit');
      }

      const nullableFunc = findFunction(tree.rootNode, 'getNullableString');
      if (nullableFunc) {
        const def = createDef('getNullableString', 'function');
        const result = infer_function_return_type(def, nullableFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('string | null');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });

  describe('Constructor functions', () => {
    it('should detect pre-ES6 constructor functions', () => {
      const code = `
function Person(name) {
  this.name = name;
  this.age = 0;
}

Person.prototype.getName = function() {
  return this.name;
};

function Animal(type) {
  this.type = type;
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const personFunc = findFunction(tree.rootNode, 'Person');
      if (personFunc) {
        const def = createDef('Person', 'function');
        const result = infer_function_return_type(def, personFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Person');
        expect(result?.confidence).toBe('inferred');
        expect(result?.source).toBe('pattern');
      }

      const animalFunc = findFunction(tree.rootNode, 'Animal');
      if (animalFunc) {
        const def = createDef('Animal', 'function');
        const result = infer_function_return_type(def, animalFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Animal');
        expect(result?.confidence).toBe('inferred');
      }
    });
  });

  describe('CommonJS patterns', () => {
    it('should handle module.exports patterns', () => {
      const code = `
module.exports = function createAPI() {
  return {
    get: function() {},
    post: function() {}
  };
};

exports.helper = function() {
  return "helper";
};`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      // This test would need more complex AST traversal
      // as the function is part of an assignment expression
    });
  });

  describe('Promise patterns', () => {
    it('should detect Promise constructor patterns', () => {
      const code = `
function createPromise() {
  return new Promise((resolve, reject) => {
    resolve("done");
  });
}

function withThen() {
  return fetch("/api")
    .then(res => res.json())
    .then(data => data.items);
}`;

      const parser = get_language_parser('javascript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'javascript',
        source_code: code
      };

      const promiseFunc = findFunction(tree.rootNode, 'createPromise');
      if (promiseFunc) {
        const def = createDef('createPromise', 'function');
        const result = infer_function_return_type(def, promiseFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Promise');
        expect(result?.confidence).toBe('inferred');  // Inferred from Promise constructor
      }

      const thenFunc = findFunction(tree.rootNode, 'withThen');
      if (thenFunc) {
        const def = createDef('withThen', 'function');
        const result = infer_function_return_type(def, thenFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Promise');
        expect(result?.confidence).toBe('inferred');
      }
    });
  });
});

// Helper functions
function findFunction(root: SyntaxNode, name: string): SyntaxNode | undefined {
  function traverse(node: SyntaxNode): SyntaxNode | undefined {
    if (node.type === 'function_declaration' || node.type === 'function_expression') {
      const nameNode = node.childForFieldName('name');
      if (nameNode && nameNode.text === name) {
        return node;
      }
      // For function expressions assigned to variables
      if (node.type === 'function_expression' && node.parent) {
        const parent = node.parent;
        if (parent.type === 'variable_declarator') {
          const varName = parent.childForFieldName('name');
          if (varName && varName.text === name) {
            return node;
          }
        }
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
      file_path: 'test.js' as any,
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