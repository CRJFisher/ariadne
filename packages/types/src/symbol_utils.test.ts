/**
 * Tests for Symbol Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  SymbolId,
  SymbolName,
  symbol_string,
  symbol_from_string,
  variable_symbol,
  function_symbol,
  class_symbol,
  method_symbol,
  property_symbol,
  module_symbol,
  parameter_symbol,
  interface_symbol,
  type_symbol,
  enum_symbol,
  namespace_symbol,
  import_symbol,
  export_symbol
} from './symbol_utils';
import { Location, FilePath } from './common';

describe('Symbol Utilities', () => {
  const test_location: Location = {
    file_path: 'src/test.ts' as FilePath,
    line: 10,
    column: 5,
    end_line: 15,
    end_column: 10
  };

  describe('symbol_string and symbol_from_string', () => {
    it('should convert Symbol to SymbolId and back', () => {
      const symbol: SymbolDefinition = {
        kind: 'function',
        name: 'processData' as SymbolName,
        location: test_location
      };

      const symbol_id = symbol_string(symbol);
      const parsed = symbol_from_string(symbol_id);

      expect(parsed.kind).toBe(symbol.kind);
      expect(parsed.name).toBe(symbol.name);
      expect(parsed.location).toEqual(symbol.location);
    });

    it('should handle qualified symbols (methods)', () => {
      const symbol: SymbolDefinition = {
        kind: 'method',
        name: 'getValue' as SymbolName,
        qualifier: 'MyClass' as SymbolName,
        location: test_location
      };

      const symbol_id = symbol_string(symbol);
      const parsed = symbol_from_string(symbol_id);

      expect(parsed.kind).toBe('method');
      expect(parsed.name).toBe('getValue');
      expect(parsed.qualifier).toBe('MyClass');
    });

    it('should throw error for invalid SymbolId format', () => {
      const invalid_id = 'invalid:format' as SymbolId;
      expect(() => symbol_from_string(invalid_id)).toThrow('Invalid SymbolId format');
    });
  });

  describe('Factory Functions', () => {
    describe('variable_symbol', () => {
      it('should create a variable symbol', () => {
        const var_symbol_result = variable_symbol('myVar', test_location);
        const parsed = symbol_from_string(var_symbol_result);

        expect(parsed.kind).toBe('variable');
        expect(parsed.name).toBe('myVar');
        expect(parsed.location).toEqual(test_location);
      });
    });

    describe('function_symbol', () => {
      it('should create a function symbol', () => {
        const func_symbol_result = function_symbol('processData', test_location);
        const parsed = symbol_from_string(func_symbol_result);

        expect(parsed.kind).toBe('function');
        expect(parsed.name).toBe('processData');
        expect(parsed.location).toEqual(test_location);
      });
    });

    describe('class_symbol', () => {
      it('should create a class symbol', () => {
        const class_symbol_result = class_symbol('MyClass', 'src/class.ts' as FilePath, test_location);
        const parsed = symbol_from_string(class_symbol_result);

        expect(parsed.kind).toBe('class');
        expect(parsed.name).toBe('MyClass');
        expect(parsed.location).toEqual(test_location);
      });
    });

    describe('method_symbol', () => {
      it('should create a method symbol', () => {
        const method_symbol_result = method_symbol('getValue', 'MyClass', test_location);
        const parsed = symbol_from_string(method_symbol_result);

        expect(parsed.kind).toBe('method');
        expect(parsed.name).toBe('getValue');
        expect(parsed.qualifier).toBe('MyClass');
        expect(parsed.location).toEqual(test_location);
      });
    });

    describe('property_symbol', () => {
      it('should create a property symbol', () => {
        const prop_symbol_result = property_symbol('isActive', 'User', test_location);
        const parsed = symbol_from_string(prop_symbol_result);

        expect(parsed.kind).toBe('property');
        expect(parsed.name).toBe('isActive');
        expect(parsed.qualifier).toBe('User');
        expect(parsed.location).toEqual(test_location);
      });
    });

    describe('module_symbol', () => {
      it('should create a module symbol', () => {
        const mod_symbol = module_symbol('<module>', 'src/index.ts', test_location);
        const parsed = symbol_from_string(mod_symbol);

        expect(parsed.kind).toBe('module');
        expect(parsed.name).toBe('<module>');
        expect(parsed.location.file_path).toBe('src/index.ts');
      });
    });

    describe('parameter_symbol', () => {
      it('should create a parameter symbol', () => {
        const param_symbol_result = parameter_symbol('userId', 'getUserById', test_location);
        const parsed = symbol_from_string(param_symbol_result);

        expect(parsed.kind).toBe('parameter');
        expect(parsed.name).toBe('userId');
        expect(parsed.qualifier).toBe('getUserById');
        expect(parsed.location).toEqual(test_location);
      });
    });

    describe('interface_symbol', () => {
      it('should create an interface symbol', () => {
        const interface_symbol_result = interface_symbol('IUser', 'src/types.ts' as FilePath, test_location);
        const parsed = symbol_from_string(interface_symbol_result);

        expect(parsed.kind).toBe('interface');
        expect(parsed.name).toBe('IUser');
        expect(parsed.location).toEqual(test_location);
      });
    });

    describe('type_symbol', () => {
      it('should create a type symbol', () => {
        const type_symbol_result = type_symbol('UserType', 'src/types.ts' as FilePath, test_location);
        const parsed = symbol_from_string(type_symbol_result);

        expect(parsed.kind).toBe('type');
        expect(parsed.name).toBe('UserType');
        expect(parsed.location).toEqual(test_location);
      });
    });
  });

  // Utility functions tests removed as most of these functions don't exist in the current implementation
  // The existing functions in symbol_utils.ts are:
  // - get_symbol_display_name
  // - is_symbol_kind 
  // - is_symbol_id
  // - is_symbol
  // - extract_names
  // Tests can be added when the implementation is verified

  // Special symbols tests removed as these functions don't exist in the current implementation

  describe('Symbol Format', () => {
    it('should maintain consistent format', () => {
      const func_symbol_result = function_symbol('processData', test_location);
      const expectedFormat = 'function:src/test.ts:10:5:15:10:processData';
      
      expect(func_symbol_result).toBe(expectedFormat);
    });

    it('should handle qualified symbols correctly', () => {
      const method_symbol_result = method_symbol('getValue', 'MyClass', test_location);
      // Format: kind:file_path:line:column:end_line:end_column:name:qualifier
      const expectedFormat = 'method:src/test.ts:10:5:15:10:getValue:MyClass';

      expect(method_symbol_result).toBe(expectedFormat);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty names gracefully', () => {
      const empty_symbol = function_symbol('', test_location);
      const parsed = symbol_from_string(empty_symbol);
      expect(parsed.name).toBe('');
    });

    it('should handle special characters in names', () => {
      const special_symbol = function_symbol('$special_name-123', test_location);
      const parsed = symbol_from_string(special_symbol);
      expect(parsed.name).toBe('$special_name-123');
    });

    it('should handle very long file paths', () => {
      const long_path = 'src/very/deep/nested/structure/with/many/folders/file.ts' as FilePath;
      const long_location: Location = { ...test_location, file_path: long_path };
      const symbol = function_symbol('func', long_location);
      const parsed = symbol_from_string(symbol);
      
      expect(parsed.location.file_path).toBe(long_path);
    });
  });

  describe('Performance Considerations', () => {
    it('should use SymbolId directly for comparisons', () => {
      const symbol_1 = function_symbol('func', test_location);
      const symbol_2 = function_symbol('func', test_location);
      
      // Direct comparison (fast)
      const direct_comparison = symbol_1 === symbol_2;
      expect(direct_comparison).toBe(true);
    });

    it('should cache symbols for reuse', () => {
      // Simulate caching pattern
      const symbol_cache = new Map<string, SymbolId>();
      const key = 'myFunc';
      
      if (!symbol_cache.has(key)) {
        symbol_cache.set(key, function_symbol(key, test_location));
      }
      
      const cached = symbol_cache.get(key);
      expect(cached).toBeDefined();
    });
  });
});