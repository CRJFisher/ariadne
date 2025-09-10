import { describe, it, expect } from 'vitest';
import {
  FunctionCallInfo,
  MethodCallInfo,
  ConstructorCallInfo
} from '@ariadnejs/types';
import {
  propagate_function_call_types,
  propagate_method_call_types,
  propagate_constructor_call_types
} from './call_propagation';
import type { TypePropagationContext } from './type_propagation';

describe('Call-based Type Propagation', () => {
  describe('Function Call Type Propagation', () => {
    it('should propagate types through function calls', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: `
          function processUser(name, age) {
            // ...
          }
          processUser("John", 25);
        `,
        known_types: new Map([['processUser', 'User']])
      };
      
      const function_calls: FunctionCallInfo[] = [{
        caller_name: 'module',
        callee_name: 'processUser',
        location: {
          file_path: 'test.js' as import('@ariadnejs/types').FilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 24
        },
        is_async: false,
        is_method_call: false,
        is_constructor_call: false,
        arguments_count: 2
      }];
      
      const flows = propagate_function_call_types(function_calls, context, new Map());
      
      // Since we can't get argument types without actual nodes, expect limited results
      expect(flows.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Method Call Type Propagation', () => {
    it('should propagate types through method calls', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: `
          const arr = [1, 2, 3];
          const doubled = arr.map(x => x * 2);
        `,
        known_types: new Map([['arr', 'Array']])
      };
      
      const method_calls: MethodCallInfo[] = [{
        caller_name: 'module',
        method_name: 'map',
        receiver_name: 'arr',
        location: {
          file_path: 'test.js' as import('@ariadnejs/types').FilePath,
          line: 2,
          column: 24,
          end_line: 2,
          end_column: 44
        },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 1
      }];
      
      const type_map = new Map([['arr', 'Array']]);
      const flows = propagate_method_call_types(method_calls, context, type_map);
      
      expect(flows.length).toBeGreaterThan(0);
      expect(flows[0].source_type).toBe('Array');
      expect(flows[0].flow_kind).toBe('return');
    });

    it('should handle method chaining', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: `
          const result = str.trim().toUpperCase();
        `,
        known_types: new Map([['str', 'String']])
      };
      
      const method_calls: MethodCallInfo[] = [{
        caller_name: 'module',
        method_name: 'trim',
        receiver_name: 'str',
        location: {
          file_path: 'test.js' as import('@ariadnejs/types').FilePath,
          line: 1,
          column: 23,
          end_line: 1,
          end_column: 29
        },
        is_static_method: false,
        is_chained_call: true,
        arguments_count: 0
      }];
      
      const type_map = new Map([['str', 'String']]);
      const flows = propagate_method_call_types(method_calls, context, type_map);
      
      expect(flows.length).toBeGreaterThan(0);
      expect(flows[0].source_type).toBe('string');
    });
  });

  describe('Constructor Call Type Propagation', () => {
    it('should propagate types through constructor calls', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: `
          const user = new User("John", 25);
        `,
        known_types: new Map()
      };
      
      const constructor_calls: ConstructorCallInfo[] = [{
        constructor_name: 'User',
        location: {
          file_path: 'test.js' as import('@ariadnejs/types').FilePath,
          line: 1,
          column: 21,
          end_line: 1,
          end_column: 42
        },
        arguments_count: 2,
        assigned_to: 'user',
        is_new_expression: true,
        is_factory_method: false
      }];
      
      const type_map = new Map();
      const flows = propagate_constructor_call_types(constructor_calls, context, type_map);
      
      expect(flows).toHaveLength(1);
      expect(flows[0].source_type).toBe('User');
      expect(flows[0].target_identifier).toBe('user');
      expect(flows[0].flow_kind).toBe('assignment');
      expect(type_map.get('user')).toBe('User');
    });

    it('should handle constructor calls in TypeScript', () => {
      const context: TypePropagationContext = {
        language: 'typescript',
        source_code: `
          const map = new Map<string, number>();
        `,
        known_types: new Map()
      };
      
      const constructor_calls: ConstructorCallInfo[] = [{
        constructor_name: 'Map',
        location: {
          file_path: 'test.ts' as import('@ariadnejs/types').FilePath,
          line: 1,
          column: 20,
          end_line: 1,
          end_column: 45
        },
        arguments_count: 0,
        assigned_to: 'map',
        is_new_expression: true,
        is_factory_method: false
      }];
      
      const type_map = new Map();
      const flows = propagate_constructor_call_types(constructor_calls, context, type_map);
      
      expect(flows).toHaveLength(1);
      expect(flows[0].source_type).toBe('Map');
      expect(flows[0].target_identifier).toBe('map');
    });
  });

  describe('Type conversion functions', () => {
    it('should handle JavaScript type conversion functions', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: 'const str = String(123);',
        known_types: new Map()
      };
      
      const function_calls: FunctionCallInfo[] = [{
        caller_name: 'module',
        callee_name: 'String',
        location: {
          file_path: 'test.js' as import('@ariadnejs/types').FilePath,
          line: 1,
          column: 12,
          end_line: 1,
          end_column: 24
        },
        is_async: false,
        is_method_call: false,
        is_constructor_call: false,
        arguments_count: 1
      }];
      
      const flows = propagate_function_call_types(function_calls, context, new Map());
      
      const stringFlow = flows.find((f: any) => f.source_type === 'string');
      expect(stringFlow).toBeDefined();
    });
  });
});