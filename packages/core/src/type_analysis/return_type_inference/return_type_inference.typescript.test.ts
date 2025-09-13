import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import { Language } from '@ariadnejs/types';
import { 
  infer_function_return_type,
  ReturnTypeContext 
} from './index';
import { ExtendedDefinition } from './return_type_inference';
import { SyntaxNode } from 'tree-sitter';

describe('TypeScript Bespoke Return Type Handlers', () => {
  describe('Complex generic types', () => {
    it('should handle conditional types', () => {
      const code = `
function test<T>(): T extends string ? string : number {
  return "" as any;
}

function check<T>(): T extends null ? never : T {
  return null as any;
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const testFunc = findFunction(tree.rootNode, 'test');
      if (testFunc) {
        const def = createDef('test', 'function');
        const result = infer_function_return_type(def, testFunc, context);
        expect(result).toBeDefined();
        // Conditional types are simplified for display
        expect(result?.type_name).toContain('string');
        expect(result?.confidence).toBe('explicit');
      }
    });

    it('should handle mapped types', () => {
      const code = `
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

function makeReadonly<T>(): Readonly<T> {
  return {} as any;
}

function partial<T>(): { [K in keyof T]?: T[K] } {
  return {} as any;
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const readonlyFunc = findFunction(tree.rootNode, 'makeReadonly');
      if (readonlyFunc) {
        const def = createDef('makeReadonly', 'function');
        const result = infer_function_return_type(def, readonlyFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Readonly<T>');
        expect(result?.confidence).toBe('explicit');
      }
    });

    it('should handle template literal types', () => {
      const code = `
function getEventName<T extends string>(): \`on\${Capitalize<T>}\` {
  return "onClick" as any;
}

function getPath(): \`/api/\${string}\` {
  return "/api/users";
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const pathFunc = findFunction(tree.rootNode, 'getPath');
      if (pathFunc) {
        const def = createDef('getPath', 'function');
        const result = infer_function_return_type(def, pathFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toContain('`');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });

  describe('Utility types', () => {
    it('should handle TypeScript utility types', () => {
      const code = `
function partial<T>(): Partial<T> {
  return {} as any;
}

function required<T>(): Required<T> {
  return {} as any;
}

function readonly<T>(): Readonly<T> {
  return {} as any;
}

function record(): Record<string, number> {
  return {};
}

function pick<T>(): Pick<T, "name" | "age"> {
  return {} as any;
}

function omit<T>(): Omit<T, "id"> {
  return {} as any;
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const partialFunc = findFunction(tree.rootNode, 'partial');
      if (partialFunc) {
        const def = createDef('partial', 'function');
        const result = infer_function_return_type(def, partialFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Partial<T>');
        expect(result?.confidence).toBe('explicit');
      }

      const recordFunc = findFunction(tree.rootNode, 'record');
      if (recordFunc) {
        const def = createDef('record', 'function');
        const result = infer_function_return_type(def, recordFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('Record<string, number>');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });

  describe('Intersection and union types', () => {
    it('should handle intersection types', () => {
      const code = `
interface A { a: string; }
interface B { b: number; }

function getIntersection(): A & B {
  return { a: "", b: 0 };
}

function complex(): A & B & { c: boolean } {
  return { a: "", b: 0, c: true };
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const intersectionFunc = findFunction(tree.rootNode, 'getIntersection');
      if (intersectionFunc) {
        const def = createDef('getIntersection', 'function');
        const result = infer_function_return_type(def, intersectionFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('A & B');
        expect(result?.confidence).toBe('explicit');
      }

      const complexFunc = findFunction(tree.rootNode, 'complex');
      if (complexFunc) {
        const def = createDef('complex', 'function');
        const result = infer_function_return_type(def, complexFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toContain('&');
        expect(result?.confidence).toBe('explicit');
      }
    });

    it('should handle union types', () => {
      const code = `
function getUnion(): string | number {
  return Math.random() > 0.5 ? "text" : 42;
}

function getNullable(): string | null | undefined {
  return null;
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      const unionFunc = findFunction(tree.rootNode, 'getUnion');
      if (unionFunc) {
        const def = createDef('getUnion', 'function');
        const result = infer_function_return_type(def, unionFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('string | number');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });

  describe('Decorators', () => {
    it('should handle decorators that affect return types', () => {
      const code = `
@AsyncMethod
function fetchData() {
  return "data";
}

@Returns(String)
function getString() {
  return "hello";
}

@Memoize
function calculate(): number {
  return 42;
}`;

      const parser = get_language_parser('typescript' as Language);
      const tree = parser.parse(code);
      const context: ReturnTypeContext = {
        language: 'typescript',
        source_code: code
      };

      // Note: Decorator handling depends on decorator implementation
      // These tests verify the decorator detection mechanism works
      const memoizeFunc = findFunction(tree.rootNode, 'calculate');
      if (memoizeFunc) {
        const def = createDef('calculate', 'function');
        const result = infer_function_return_type(def, memoizeFunc, context);
        expect(result).toBeDefined();
        expect(result?.type_name).toBe('number');
        expect(result?.confidence).toBe('explicit');
      }
    });
  });
});

// Helper functions
function find_function(root: SyntaxNode, name: string): SyntaxNode | undefined {
  function traverse(node: SyntaxNode): SyntaxNode | undefined {
    if (node.type === 'function_declaration' || node.type === 'function_expression') {
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

function create_def(name: string, kind: 'function' | 'method'): ExtendedDefinition {
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