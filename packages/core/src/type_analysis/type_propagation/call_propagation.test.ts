/**
 * Tests for call graph type propagation
 */

import { describe, it, expect } from 'vitest';
import {
  propagate_function_call_types,
  propagate_method_call_types,
  propagate_constructor_call_types,
  merge_call_type_flows
} from './call_propagation';
import { TypePropagationContext } from './type_propagation';
import { FunctionCallInfo, MethodCallInfo, ConstructorCallInfo, TypeInfo } from '@ariadnejs/types';

describe('Call Graph Type Propagation', () => {
  describe('Function Call Propagation', () => {
    it('should propagate types through function arguments', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: 'processUser("John", 25)',
        known_types: new Map([
          ['name', 'string'],
          ['age', 'number']
        ])
      };
      
      const function_calls: FunctionCallInfo[] = [{
        function_name: 'processUser',
        arguments: ['"John"', '25'],
        location: {
          file_path: 'test.js',
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 24
        }
      }];
      
      const flows = propagate_function_call_types(function_calls, context);
      
      expect(flows).toHaveLength(2);
      expect(flows[0].source_type).toBe('string');
      expect(flows[0].target_identifier).toBe('processUser#param0');
      expect(flows[1].source_type).toBe('number');
      expect(flows[1].target_identifier).toBe('processUser#param1');
    });
  });
  
  describe('Method Call Propagation', () => {
    it('should propagate receiver types through method calls', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: 'user.getName()',
        known_types: new Map()
      };
      
      const method_calls: MethodCallInfo[] = [{
        receiver: 'user',
        method_name: 'getName',
        receiver_type: './models#User',
        arguments: [],
        location: {
          file_path: 'test.js',
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 14
        }
      }];
      
      const flows = propagate_method_call_types(method_calls, context);
      
      expect(flows.length).toBeGreaterThan(0);
      const thisFlow = flows.find(f => f.target_identifier.includes('#this'));
      expect(thisFlow).toBeDefined();
      expect(thisFlow?.source_type).toBe('./models#User');
    });
    
    it('should handle array method return types', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: 'items.filter(x => x > 0)',
        known_types: new Map()
      };
      
      const method_calls: MethodCallInfo[] = [{
        receiver: 'items',
        method_name: 'filter',
        receiver_type: 'Array',
        arguments: ['x => x > 0'],
        location: {
          file_path: 'test.js',
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 24
        }
      }];
      
      const flows = propagate_method_call_types(method_calls, context);
      
      const returnFlow = flows.find(f => f.flow_kind === 'return');
      expect(returnFlow).toBeDefined();
      expect(returnFlow?.source_type).toBe('Array');
    });
  });
  
  describe('Constructor Call Propagation', () => {
    it('should propagate constructed types', () => {
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: 'new User("Alice")',
        known_types: new Map()
      };
      
      const constructor_calls: ConstructorCallInfo[] = [{
        class_name: 'User',
        arguments: ['"Alice"'],
        location: {
          file_path: 'test.js',
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 17
        }
      }];
      
      const flows = propagate_constructor_call_types(constructor_calls, context);
      
      expect(flows.length).toBeGreaterThan(0);
      
      // Check instance type flow
      const instanceFlow = flows.find(f => f.flow_kind === 'assignment');
      expect(instanceFlow).toBeDefined();
      expect(instanceFlow?.source_type).toBe('User');
      
      // Check parameter flow
      const paramFlow = flows.find(f => f.flow_kind === 'parameter');
      expect(paramFlow).toBeDefined();
      expect(paramFlow?.source_type).toBe('string');
    });
  });
  
  describe('Flow Merging', () => {
    it('should merge flows from different call types', () => {
      const functionFlows = [{
        source_type: 'string',
        target_identifier: 'func#param0',
        flow_kind: 'parameter' as const,
        confidence: 'inferred' as const,
        position: { row: 1, column: 0 }
      }];
      
      const methodFlows = [{
        source_type: 'User',
        target_identifier: 'method#this',
        flow_kind: 'parameter' as const,
        confidence: 'explicit' as const,
        position: { row: 2, column: 0 }
      }];
      
      const constructorFlows = [{
        source_type: 'Database',
        target_identifier: 'new_Database',
        flow_kind: 'assignment' as const,
        confidence: 'explicit' as const,
        position: { row: 3, column: 0 }
      }];
      
      const merged = merge_call_type_flows(functionFlows, methodFlows, constructorFlows);
      
      expect(merged).toHaveLength(3);
      expect(merged.some(f => f.source_type === 'string')).toBe(true);
      expect(merged.some(f => f.source_type === 'User')).toBe(true);
      expect(merged.some(f => f.source_type === 'Database')).toBe(true);
    });
    
    it('should prefer explicit confidence when merging duplicates', () => {
      const flow1 = {
        source_type: 'string',
        target_identifier: 'x',
        flow_kind: 'assignment' as const,
        confidence: 'inferred' as const,
        position: { row: 1, column: 0 }
      };
      
      const flow2 = {
        source_type: 'String',
        target_identifier: 'x',
        flow_kind: 'assignment' as const,
        confidence: 'explicit' as const,
        position: { row: 1, column: 0 }
      };
      
      const merged = merge_call_type_flows([flow1], [flow2], []);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].source_type).toBe('String');
      expect(merged[0].confidence).toBe('explicit');
    });
  });
});