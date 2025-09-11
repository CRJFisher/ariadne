/**
 * Comprehensive tests for TypeScript-specific generic resolution features
 */

import { describe, it, expect } from 'vitest';
import {
  resolve_typescript_utility_type,
  resolve_typescript_conditional,
  resolve_typescript_mapped_type,
  resolve_typescript_template_literal
} from './generic_resolution.typescript';
import { create_generic_context } from './generic_resolution';

describe('TypeScript Generic Resolution', () => {
  describe('Utility Types', () => {
    it('should resolve Partial<T>', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'User');
      
      const result = resolve_typescript_utility_type('Partial<T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Partial<User>');
      expect(result?.confidence).toBe('exact');
    });

    it('should resolve Required<T>', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'User');
      
      const result = resolve_typescript_utility_type('Required<T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Required<User>');
    });

    it('should resolve Pick<T, K>', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'K' }]);
      context.type_arguments.set('T', 'User');
      context.type_arguments.set('K', '"name" | "email"');
      
      const result = resolve_typescript_utility_type('Pick<T, K>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Pick<User, "name" | "email">');
    });

    it('should resolve Omit<T, K>', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'K' }]);
      context.type_arguments.set('T', 'User');
      context.type_arguments.set('K', '"id"');
      
      const result = resolve_typescript_utility_type('Omit<T, K>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Omit<User, "id">');
    });

    it('should resolve Record<K, T>', () => {
      const context = create_generic_context([{ name: 'K' }, { name: 'T' }]);
      context.type_arguments.set('K', 'string');
      context.type_arguments.set('T', 'number');
      
      const result = resolve_typescript_utility_type('Record<K, T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Record<string, number>');
    });

    it('should resolve Exclude<T, U>', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'string | number | boolean');
      context.type_arguments.set('U', 'boolean');
      
      const result = resolve_typescript_utility_type('Exclude<T, U>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Exclude<string | number | boolean, boolean>');
    });

    it('should resolve Extract<T, U>', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'string | number | boolean');
      context.type_arguments.set('U', 'string | boolean');
      
      const result = resolve_typescript_utility_type('Extract<T, U>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Extract<string | number | boolean, string | boolean>');
    });

    it('should resolve ReturnType<T>', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', '() => string');
      
      const result = resolve_typescript_utility_type('ReturnType<T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('ReturnType<() => string>');
    });

    it('should resolve Parameters<T>', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', '(a: string, b: number) => void');
      
      const result = resolve_typescript_utility_type('Parameters<T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Parameters<(a: string, b: number) => void>');
    });

    it('should return null for non-utility types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_typescript_utility_type('Array<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Conditional Types', () => {
    it('should resolve simple conditional type', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'string');
      
      const result = resolve_typescript_conditional('T extends string ? number : boolean', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('string extends string ? number : boolean');
    });

    it('should resolve complex conditional type with infer', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Array<string>');
      
      const result = resolve_typescript_conditional('T extends Array<infer U> ? U : never', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Array<string> extends Array<infer U> ? U : never');
    });

    it('should resolve nested conditional types', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'string');
      context.type_arguments.set('U', 'number');
      
      const result = resolve_typescript_conditional('T extends string ? U extends number ? true : false : false', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('string extends string ? number extends number ? true : false : false');
    });

    it('should return null for non-conditional types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_typescript_conditional('Array<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Mapped Types', () => {
    it('should resolve simple mapped type', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'User');
      
      const result = resolve_typescript_mapped_type('{ [K in keyof T]: string }', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('{ [K in keyof User]: string }');
    });

    it('should resolve mapped type with modifiers', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'User');
      
      const result = resolve_typescript_mapped_type('{ readonly [K in keyof T]?: T[K] }', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('{ readonly [K in keyof User]?: User[K] }');
    });

    it('should resolve mapped type with as clause', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'User');
      
      const result = resolve_typescript_mapped_type('{ [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] }', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('{ [K in keyof User as `get${Capitalize<string & K>}`]: () => User[K] }');
    });

    it('should return null for non-mapped types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_typescript_mapped_type('Array<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Template Literal Types', () => {
    it('should resolve simple template literal type', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'user');
      
      const result = resolve_typescript_template_literal('`get${Capitalize<T>}`', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('`get${Capitalize<user>}`');
    });

    it('should resolve template literal with multiple placeholders', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'user');
      context.type_arguments.set('U', 'name');
      
      const result = resolve_typescript_template_literal('`${T}_${U}_suffix`', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('`${user}_${name}_suffix`');
    });

    it('should resolve template literal with intrinsic string manipulation', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'hello world');
      
      const result = resolve_typescript_template_literal('`prefix_${Uppercase<T>}_suffix`', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('`prefix_${Uppercase<hello world>}_suffix`');
    });

    it('should return null for non-template-literal types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_typescript_template_literal('Array<T>', context);
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context', () => {
      const context = create_generic_context([]);
      
      const result = resolve_typescript_utility_type('Partial<T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Partial<T>');
      expect(result?.confidence).toBe('partial');
    });

    it('should handle unbound type parameters', () => {
      const context = create_generic_context([{ name: 'T' }, { name: 'U' }]);
      context.type_arguments.set('T', 'string');
      
      const result = resolve_typescript_utility_type('Pick<T, U>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Pick<string, U>');
      expect(result?.confidence).toBe('partial');
    });

    it('should handle nested generic types in utility types', () => {
      const context = create_generic_context([{ name: 'T' }]);
      context.type_arguments.set('T', 'Array<User>');
      
      const result = resolve_typescript_utility_type('Partial<T>', context);
      expect(result).toBeDefined();
      expect(result?.resolved_type).toBe('Partial<Array<User>>');
    });

    it('should handle malformed conditional types gracefully', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_typescript_conditional('T extends ? number', context);
      expect(result).toBeNull();
    });

    it('should handle malformed mapped types gracefully', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_typescript_mapped_type('{ [K in]: string }', context);
      expect(result).toBeNull();
    });

    it('should handle malformed template literals gracefully', () => {
      const context = create_generic_context([{ name: 'T' }]);
      
      const result = resolve_typescript_template_literal('`unclosed template', context);
      expect(result).toBeNull();
    });
  });
});