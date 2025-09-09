import { describe, it, expect } from 'vitest';
import {
  extract_jsdoc_parameter_types,
  analyze_javascript_parameter_usage
} from './parameter_type_inference.javascript';
import { get_language_parser } from '../../scope_queries/loader';
import { ParameterInfo, ParameterInferenceContext } from './parameter_type_inference';

describe('JavaScript bespoke parameter type inference', () => {
  describe('extract_jsdoc_parameter_types', () => {
    it('should extract types from JSDoc comments', () => {
      const code = `
        /**
         * @param {string} name - The name
         * @param {number} age - The age
         * @param {boolean} active - Is active
         */
        function test(name, age, active) {}
      `;
      
      const parser = get_language_parser('javascript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      // Find the function node
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const parameters: ParameterInfo[] = [
        { name: 'name', position: 0 },
        { name: 'age', position: 1 },
        { name: 'active', position: 2 }
      ];
      
      const types = extract_jsdoc_parameter_types(func_node, parameters, context);
      
      expect(types.get('name')?.inferred_type).toBe('string');
      expect(types.get('age')?.inferred_type).toBe('number');
      expect(types.get('active')?.inferred_type).toBe('boolean');
      expect(types.get('name')?.confidence).toBe('explicit');
    });
    
    it('should handle missing JSDoc', () => {
      const code = `function test(name, age) {}`;
      
      const parser = get_language_parser('javascript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const parameters: ParameterInfo[] = [
        { name: 'name', position: 0 },
        { name: 'age', position: 1 }
      ];
      
      const types = extract_jsdoc_parameter_types(func_node, parameters, context);
      
      expect(types.size).toBe(0);
    });
  });
  
  describe('analyze_javascript_parameter_usage', () => {
    it('should infer array type from array access', () => {
      const code = `
        function test(items) {
          return items[0];
        }
      `;
      
      const parser = get_language_parser('javascript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const result = analyze_javascript_parameter_usage('items', func_node, context);
      
      expect(result?.inferred_type).toBe('Array');
      expect(result?.source).toBe('usage');
    });
    
    it('should infer object type from property access', () => {
      const code = `
        function test(obj) {
          return obj.name;
        }
      `;
      
      const parser = get_language_parser('javascript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const result = analyze_javascript_parameter_usage('obj', func_node, context);
      
      expect(result?.inferred_type).toBe('Object');
      expect(result?.source).toBe('usage');
    });
    
    it('should infer function type from function call', () => {
      const code = `
        function test(callback) {
          return callback();
        }
      `;
      
      const parser = get_language_parser('javascript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const result = analyze_javascript_parameter_usage('callback', func_node, context);
      
      expect(result?.inferred_type).toBe('Function');
      expect(result?.source).toBe('usage');
    });
    
    it('should infer string type from string methods', () => {
      const code = `
        function test(text) {
          return text.toLowerCase();
        }
      `;
      
      const parser = get_language_parser('javascript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const result = analyze_javascript_parameter_usage('text', func_node, context);
      
      expect(result?.inferred_type).toBe('string');
      expect(result?.source).toBe('usage');
    });
    
    it('should infer number type from numeric operations', () => {
      const code = `
        function test(x) {
          return x + 5;
        }
      `;
      
      const parser = get_language_parser('javascript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'javascript',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const result = analyze_javascript_parameter_usage('x', func_node, context);
      
      expect(result?.inferred_type).toBe('number');
      expect(result?.source).toBe('usage');
    });
  });
  
  // infer_from_javascript_call_sites is not exported as it's not used by the main module
  // These tests are commented out since the function is internal and not part of the public API
});