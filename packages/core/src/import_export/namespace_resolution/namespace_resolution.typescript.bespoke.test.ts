/**
 * Tests for TypeScript-specific bespoke namespace resolution
 */

import { describe, it, expect } from 'vitest';
import {
  handle_namespace_declarations,
  handle_export_equals,
  handle_triple_slash_directives,
  handle_ambient_modules,
  handle_namespace_value_merging,
  handle_type_only_imports
} from './namespace_resolution.typescript.bespoke';
import { SyntaxNode } from 'tree-sitter';

describe('TypeScript Bespoke Namespace Handlers', () => {
  const mockNode = {} as SyntaxNode;

  describe('handle_namespace_declarations', () => {
    it('should detect exported namespace declarations', () => {
      const code = `
        export namespace Utils {
          export function helper() {}
        }
        export module Helpers {
          export class HelperClass {}
        }
      `;

      const imports = handle_namespace_declarations(mockNode, code);
      
      expect(imports).toHaveLength(2);
      expect(imports[0].namespace_name).toBe('Utils');
      expect(imports[0].source_module).toBe('__local__');
      expect(imports[0].is_namespace).toBe(true);
      
      expect(imports[1].namespace_name).toBe('Helpers');
    });

    it('should ignore non-exported namespaces', () => {
      const code = `
        namespace Internal {
          export function func() {}
        }
        module Private {
          export class Class {}
        }
      `;

      const imports = handle_namespace_declarations(mockNode, code);
      
      expect(imports).toHaveLength(0); // Only exported namespaces
    });

    it('should handle nested namespaces', () => {
      const code = `
        export namespace Outer {
          export namespace Inner {
            export function func() {}
          }
        }
      `;

      const imports = handle_namespace_declarations(mockNode, code);
      
      expect(imports.some(i => i.namespace_name === 'Outer')).toBe(true);
    });
  });

  describe('handle_export_equals', () => {
    it('should detect export = syntax', () => {
      const exports = new Map();
      exports.set('func1', { name: 'func1' });
      exports.set('func2', { name: 'func2' });
      
      const code = `
        class MyClass {}
        export = MyClass;
      `;

      handle_export_equals(exports, code);
      
      expect(exports.size).toBe(1);
      expect(exports.has('__export_equals__')).toBe(true);
      const exportEquals = exports.get('__export_equals__');
      expect(exportEquals?.name).toBe('MyClass');
    });

    it('should handle different export = values', () => {
      const testCases = [
        { code: 'export = myFunction;', expected: 'myFunction' },
        { code: 'export = MyNamespace;', expected: 'MyNamespace' },
        { code: 'export = { prop: value };', expected: '{ prop: value }' },
        { code: 'export = require("./module");', expected: 'require("./module")' }
      ];

      for (const testCase of testCases) {
        const exports = new Map();
        handle_export_equals(exports, testCase.code);
        
        const exportEquals = exports.get('__export_equals__');
        expect(exportEquals?.name).toBe(testCase.expected);
      }
    });

    it('should clear other exports when using export =', () => {
      const exports = new Map();
      exports.set('existing1', { name: 'existing1' });
      exports.set('existing2', { name: 'existing2' });
      
      const code = 'export = defaultExport;';
      
      handle_export_equals(exports, code);
      
      expect(exports.size).toBe(1);
      expect(exports.has('existing1')).toBe(false);
      expect(exports.has('existing2')).toBe(false);
    });
  });

  describe('handle_triple_slash_directives', () => {
    it('should detect reference types directives', () => {
      const code = `
        /// <reference types="node" />
        /// <reference types="jest" />
        /// <reference types="@types/react" />
      `;

      const refs = handle_triple_slash_directives(code);
      
      expect(refs).toHaveLength(3);
      expect(refs).toContain('node');
      expect(refs).toContain('jest');
      expect(refs).toContain('@types/react');
    });

    it('should detect reference path directives', () => {
      const code = `
        /// <reference path="./types.d.ts" />
        /// <reference path="../shared/global.d.ts" />
      `;

      const refs = handle_triple_slash_directives(code);
      
      expect(refs).toHaveLength(2);
      expect(refs).toContain('./types.d.ts');
      expect(refs).toContain('../shared/global.d.ts');
    });

    it('should handle mixed directive types', () => {
      const code = `
        /// <reference types="node" />
        /// <reference path="./local.d.ts" />
        /// <reference types="lodash" />
      `;

      const refs = handle_triple_slash_directives(code);
      
      expect(refs).toHaveLength(3);
      expect(refs).toContain('node');
      expect(refs).toContain('./local.d.ts');
      expect(refs).toContain('lodash');
    });

    it('should ignore malformed directives', () => {
      const code = `
        // <reference types="not-a-directive" />
        /// <reference type="wrong-attribute" />
        /// <reference />
      `;

      const refs = handle_triple_slash_directives(code);
      
      expect(refs).toHaveLength(0);
    });
  });

  describe('handle_ambient_modules', () => {
    it('should detect ambient module declarations', () => {
      const code = `
        declare module "my-module" {
          export const value: string;
          export function func(): void;
          export class MyClass {}
        }
      `;

      const modules = handle_ambient_modules(mockNode, code);
      
      expect(modules.size).toBe(1);
      expect(modules.has('my-module')).toBe(true);
      
      const exports = modules.get('my-module');
      expect(exports).toHaveLength(3);
      expect(exports?.some(e => e.name === 'value')).toBe(true);
      expect(exports?.some(e => e.name === 'func')).toBe(true);
      expect(exports?.some(e => e.name === 'MyClass')).toBe(true);
    });

    it('should handle multiple ambient modules', () => {
      const code = `
        declare module "module1" {
          export interface Interface1 {}
        }
        declare module 'module2' {
          export type Type2 = string;
        }
      `;

      const modules = handle_ambient_modules(mockNode, code);
      
      expect(modules.size).toBe(2);
      expect(modules.has('module1')).toBe(true);
      expect(modules.has('module2')).toBe(true);
    });

    it('should detect various export types', () => {
      const code = `
        declare module "test" {
          export const constant: number;
          export let variable: string;
          export var oldVar: boolean;
          export function func(): void;
          export class Class {}
          export interface Interface {}
          export type TypeAlias = string;
          export enum Enum { A, B }
        }
      `;

      const modules = handle_ambient_modules(mockNode, code);
      const exports = modules.get('test');
      
      expect(exports).toHaveLength(8);
      
      const exportNames = exports?.map(e => e.name) || [];
      expect(exportNames).toContain('constant');
      expect(exportNames).toContain('variable');
      expect(exportNames).toContain('oldVar');
      expect(exportNames).toContain('func');
      expect(exportNames).toContain('Class');
      expect(exportNames).toContain('Interface');
      expect(exportNames).toContain('TypeAlias');
      expect(exportNames).toContain('Enum');
    });
  });

  describe('handle_namespace_value_merging', () => {
    it('should detect namespace merged with class', () => {
      const code = `
        class MyClass {}
        namespace MyClass {
          export const helper = true;
        }
      `;

      const result = handle_namespace_value_merging('MyClass', code);
      
      expect(result.is_merged).toBe(true);
      expect(result.value_type).toBe('class');
    });

    it('should detect namespace merged with function', () => {
      const code = `
        function MyFunction() {}
        namespace MyFunction {
          export const property = 'value';
        }
      `;

      const result = handle_namespace_value_merging('MyFunction', code);
      
      expect(result.is_merged).toBe(true);
      expect(result.value_type).toBe('function');
    });

    it('should detect namespace merged with enum', () => {
      const code = `
        enum MyEnum { A, B, C }
        namespace MyEnum {
          export function isValid(value: MyEnum): boolean {
            return true;
          }
        }
      `;

      const result = handle_namespace_value_merging('MyEnum', code);
      
      expect(result.is_merged).toBe(true);
      expect(result.value_type).toBe('enum');
    });

    it('should detect namespace merged with const', () => {
      const code = `
        const MyConst = {};
        namespace MyConst {
          export const nested = 'value';
        }
      `;

      const result = handle_namespace_value_merging('MyConst', code);
      
      expect(result.is_merged).toBe(true);
      expect(result.value_type).toBe('const');
    });

    it('should return not merged for standalone namespace', () => {
      const code = `
        namespace Standalone {
          export const value = true;
        }
      `;

      const result = handle_namespace_value_merging('Standalone', code);
      
      expect(result.is_merged).toBe(false);
      expect(result.value_type).toBeUndefined();
    });
  });

  describe('handle_type_only_imports', () => {
    it('should detect type-only named imports', () => {
      const importText = "import type { Type1, Type2, Type3 } from './types'";
      
      const result = handle_type_only_imports(importText);
      
      expect(result.is_type_only).toBe(true);
      expect(result.imported_types).toEqual(['Type1', 'Type2', 'Type3']);
    });

    it('should detect type-only namespace imports', () => {
      const importText = "import type * as Types from './types'";
      
      const result = handle_type_only_imports(importText);
      
      expect(result.is_type_only).toBe(true);
      expect(result.imported_types).toBeUndefined();
    });

    it('should handle imports with spaces and formatting', () => {
      const importText = "import type {  Type1 , Type2  ,  Type3  } from './types'";
      
      const result = handle_type_only_imports(importText);
      
      expect(result.is_type_only).toBe(true);
      expect(result.imported_types).toEqual(['Type1', 'Type2', 'Type3']);
    });

    it('should return false for regular imports', () => {
      const testCases = [
        "import { func } from './module'",
        "import * as utils from './utils'",
        "import MyClass from './class'",
        "const module = require('./module')"
      ];

      for (const importText of testCases) {
        const result = handle_type_only_imports(importText);
        expect(result.is_type_only).toBe(false);
        expect(result.imported_types).toBeUndefined();
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty source code', () => {
      const imports = handle_namespace_declarations(mockNode, '');
      const refs = handle_triple_slash_directives('');
      const modules = handle_ambient_modules(mockNode, '');
      
      expect(imports).toHaveLength(0);
      expect(refs).toHaveLength(0);
      expect(modules.size).toBe(0);
    });

    it('should handle Unicode identifiers', () => {
      const code = `
        export namespace 日本語 {
          export const 値 = 'value';
        }
        declare module "émoji" {
          export const 😀: string;
        }
      `;

      const imports = handle_namespace_declarations(mockNode, code);
      const modules = handle_ambient_modules(mockNode, code);
      
      expect(imports.some(i => i.namespace_name === '日本語')).toBe(true);
      expect(modules.has('émoji')).toBe(true);
    });
  });
});