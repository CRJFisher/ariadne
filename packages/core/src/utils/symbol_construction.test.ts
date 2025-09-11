/**
 * Tests for symbol construction utility
 */

import { describe, it, expect } from 'vitest';
import {
  construct_symbol,
  parse_symbol,
  construct_function_symbol,
  construct_method_symbol,
  construct_variable_symbol,
  construct_class_symbol,
  construct_module_symbol,
  construct_language_symbol,
  is_anonymous_symbol,
  is_constructor_symbol,
  get_symbol_file,
  get_symbol_name,
  get_symbol_parent,
  create_relative_symbol,
  compare_symbols,
  SPECIAL_SYMBOLS
} from './symbol_construction';

describe('Symbol Construction', () => {
  describe('construct_symbol', () => {
    it('should construct a simple function symbol', () => {
      const symbol = construct_symbol({
        file_path: 'src/utils.ts',
        name: 'processData'
      });
      expect(symbol).toBe('src/utils.ts#processData');
    });

    it('should construct a method symbol', () => {
      const symbol = construct_symbol({
        file_path: 'src/models/user.ts',
        scope_path: ['User'],
        name: 'validate'
      });
      expect(symbol).toBe('src/models/user.ts#User:validate');
    });

    it('should construct a nested function symbol', () => {
      const symbol = construct_symbol({
        file_path: 'src/utils.ts',
        scope_path: ['processData'],
        name: 'validateInput'
      });
      expect(symbol).toBe('src/utils.ts#processData:validateInput');
    });

    it('should construct an anonymous function symbol', () => {
      const symbol = construct_symbol({
        file_path: 'src/utils.ts',
        name: 'anonymous',
        is_anonymous: true,
        location: { file_path: 'src/utils.ts' as any, line: 12, column: 5, end_line: 12, end_column: 5 }
      });
      expect(symbol).toBe('src/utils.ts#<anonymous>:12:5');
    });

    it('should normalize backslashes in file paths', () => {
      const symbol = construct_symbol({
        file_path: 'src\\windows\\path.ts',
        name: 'func'
      });
      expect(symbol).toBe('src/windows/path.ts#func');
    });
  });

  describe('parse_symbol', () => {
    it('should parse a simple function symbol', () => {
      const parsed = parse_symbol('src/utils.ts#processData');
      expect(parsed).toEqual({
        file_path: 'src/utils.ts',
        scope_path: [],
        name: 'processData',
        full_symbol: 'src/utils.ts#processData'
      });
    });

    it('should parse a method symbol', () => {
      const parsed = parse_symbol('src/models/user.ts#User:validate');
      expect(parsed).toEqual({
        file_path: 'src/models/user.ts',
        scope_path: ['User'],
        name: 'validate',
        full_symbol: 'src/models/user.ts#User:validate'
      });
    });

    it('should parse a deeply nested symbol', () => {
      const parsed = parse_symbol('src/app.ts#App:Router:handleRequest:validateParams');
      expect(parsed).toEqual({
        file_path: 'src/app.ts',
        scope_path: ['App', 'Router', 'handleRequest'],
        name: 'validateParams',
        full_symbol: 'src/app.ts#App:Router:handleRequest:validateParams'
      });
    });
  });

  describe('Specific symbol constructors', () => {
    it('should construct a function symbol', () => {
      const symbol = construct_function_symbol(
        'src/utils.ts',
        'processData'
      );
      expect(symbol).toBe('src/utils.ts#processData');
    });

    it('should construct a function symbol with parent scope', () => {
      const symbol = construct_function_symbol(
        'src/utils.ts',
        'validate',
        'processData'
      );
      expect(symbol).toBe('src/utils.ts#processData:validate');
    });

    it('should construct a method symbol', () => {
      const symbol = construct_method_symbol(
        'src/models/user.ts',
        'User',
        'validate'
      );
      expect(symbol).toBe('src/models/user.ts#User:validate');
    });

    it('should construct a static method symbol', () => {
      const symbol = construct_method_symbol(
        'src/models/user.ts',
        'User',
        'fromJSON',
        true
      );
      expect(symbol).toBe('src/models/user.ts#User:static:fromJSON');
    });

    it('should construct a constructor symbol', () => {
      const symbol = construct_method_symbol(
        'src/models/user.ts',
        'User',
        'constructor'
      );
      expect(symbol).toBe('src/models/user.ts#User:<constructor>');
    });

    it('should construct a variable symbol', () => {
      const symbol = construct_variable_symbol(
        'src/config.ts',
        'API_KEY',
        ['Config']
      );
      expect(symbol).toBe('src/config.ts#Config:API_KEY');
    });

    it('should construct a class symbol', () => {
      const symbol = construct_class_symbol(
        'src/models/user.ts',
        'User'
      );
      expect(symbol).toBe('src/models/user.ts#User');
    });

    it('should construct a module symbol', () => {
      const symbol = construct_module_symbol('src/utils.ts');
      expect(symbol).toBe('src/utils.ts#<module>');
    });
  });

  describe('Symbol queries', () => {
    const test_symbol = 'src/models/user.ts#User:validate';

    it('should identify anonymous symbols', () => {
      expect(is_anonymous_symbol('src/utils.ts#<anonymous>:12:5')).toBe(true);
      expect(is_anonymous_symbol(test_symbol)).toBe(false);
    });

    it('should identify constructor symbols', () => {
      expect(is_constructor_symbol('src/models/user.ts#User:<constructor>')).toBe(true);
      expect(is_constructor_symbol(test_symbol)).toBe(false);
    });

    it('should extract file path from symbol', () => {
      expect(get_symbol_file(test_symbol)).toBe('src/models/user.ts');
    });

    it('should extract name from symbol', () => {
      expect(get_symbol_name(test_symbol)).toBe('validate');
    });

    it('should extract parent scope from symbol', () => {
      expect(get_symbol_parent(test_symbol)).toBe('src/models/user.ts#User');
      expect(get_symbol_parent('src/utils.ts#func')).toBeUndefined();
    });
  });

  describe('Symbol utilities', () => {
    it('should create relative symbols', () => {
      const symbol = 'project/src/models/user.ts#User:validate';
      const relative = create_relative_symbol(symbol, 'project');
      expect(relative).toBe('src/models/user.ts#User:validate');
    });

    it('should compare symbols for sorting', () => {
      const symbols = [
        'src/b.ts#func',
        'src/a.ts#func',
        'src/a.ts#Class:method',
        'src/a.ts#Class:anotherMethod'
      ];

      const sorted = [...symbols].sort(compare_symbols);
      expect(sorted).toEqual([
        'src/a.ts#func',
        'src/a.ts#Class:anotherMethod',
        'src/a.ts#Class:method',
        'src/b.ts#func'
      ]);
    });
  });

  describe('Language-specific symbols', () => {
    it('should construct Python decorator symbol', () => {
      const symbol = construct_language_symbol(
        'src/decorators.py',
        'python',
        'decorator',
        'cached',
        []
      );
      expect(symbol).toBe('src/decorators.py#@cached');
    });

    it('should construct Rust macro symbol', () => {
      const symbol = construct_language_symbol(
        'src/macros.rs',
        'rust',
        'macro',
        'println',
        []
      );
      expect(symbol).toBe('src/macros.rs#!println');
    });

    it('should construct TypeScript interface symbol', () => {
      const symbol = construct_language_symbol(
        'src/types.ts',
        'typescript',
        'interface',
        'User',
        []
      );
      expect(symbol).toBe('src/types.ts#interface:User');
    });
  });

  describe('Symbol uniqueness', () => {
    it('should create unique symbols for same-named functions in different files', () => {
      const symbol1 = construct_function_symbol('src/auth.ts', 'validate');
      const symbol2 = construct_function_symbol('src/utils.ts', 'validate');
      
      expect(symbol1).not.toBe(symbol2);
      expect(symbol1).toBe('src/auth.ts#validate');
      expect(symbol2).toBe('src/utils.ts#validate');
    });

    it('should create unique symbols for same-named methods in different classes', () => {
      const symbol1 = construct_method_symbol('src/models.ts', 'User', 'save');
      const symbol2 = construct_method_symbol('src/models.ts', 'Post', 'save');
      
      expect(symbol1).not.toBe(symbol2);
      expect(symbol1).toBe('src/models.ts#User:save');
      expect(symbol2).toBe('src/models.ts#Post:save');
    });

    it('should create unique symbols for nested functions with same name', () => {
      const symbol1 = construct_symbol({
        file_path: 'src/app.ts',
        scope_path: ['handleRequest'],
        name: 'validate'
      });
      const symbol2 = construct_symbol({
        file_path: 'src/app.ts',
        scope_path: ['processData'],
        name: 'validate'
      });
      
      expect(symbol1).not.toBe(symbol2);
      expect(symbol1).toBe('src/app.ts#handleRequest:validate');
      expect(symbol2).toBe('src/app.ts#processData:validate');
    });

    it('should create unique symbols for anonymous functions at different locations', () => {
      const symbol1 = construct_symbol({
        file_path: 'src/utils.ts',
        name: 'anonymous',
        is_anonymous: true,
        location: { file_path: 'src/utils.ts' as any, line: 10, column: 5, end_line: 10, end_column: 5 }
      });
      const symbol2 = construct_symbol({
        file_path: 'src/utils.ts',
        name: 'anonymous',
        is_anonymous: true,
        location: { file_path: 'src/utils.ts' as any, line: 20, column: 10, end_line: 20, end_column: 10 }
      });
      
      expect(symbol1).not.toBe(symbol2);
      expect(symbol1).toBe('src/utils.ts#<anonymous>:10:5');
      expect(symbol2).toBe('src/utils.ts#<anonymous>:20:10');
    });
  });
});