import { describe, it, expect } from 'vitest';
import { handle_pattern_parameters } from './parameter_type_inference.rust';
import { get_language_parser } from '../../scope_analysis/scope_tree/loader';
import { ParameterInferenceContext } from './parameter_type_inference';

describe('Rust bespoke parameter type inference', () => {
  describe('handle_pattern_parameters', () => {
    it('should handle simple tuple patterns', () => {
      const code = `fn test((x, y): (i32, i32)) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1); // Skip opening paren
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('x');
        expect(result[0].type_annotation).toBe('i32');
        expect(result[1].name).toBe('y');
        expect(result[1].type_annotation).toBe('i32');
      }
    });
    
    it('should handle nested tuple patterns', () => {
      const code = `fn test(((a, b), c): ((u8, u16), u32)) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(3);
        expect(result[0].name).toBe('a');
        expect(result[0].type_annotation).toBe('u8');
        expect(result[1].name).toBe('b');
        expect(result[1].type_annotation).toBe('u16');
        expect(result[2].name).toBe('c');
        expect(result[2].type_annotation).toBe('u32');
      }
    });
    
    it('should handle struct patterns', () => {
      const code = `fn test(Point { x, y }: Point) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('x');
        expect(result[0].type_annotation).toBe('Point');
        expect(result[1].name).toBe('y');
        expect(result[1].type_annotation).toBe('Point');
      }
    });
    
    it('should handle struct patterns with renamed fields', () => {
      const code = `fn test(Point { x: x_val, y: y_val }: Point) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('x_val');
        expect(result[0].type_annotation).toBe('Point');
        expect(result[1].name).toBe('y_val');
        expect(result[1].type_annotation).toBe('Point');
      }
    });
    
    it('should handle slice patterns', () => {
      const code = `fn test([first, second, third]: [i32; 3]) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(3);
        expect(result[0].name).toBe('first');
        expect(result[0].type_annotation).toBe('i32');
        expect(result[1].name).toBe('second');
        expect(result[1].type_annotation).toBe('i32');
        expect(result[2].name).toBe('third');
        expect(result[2].type_annotation).toBe('i32');
      }
    });
    
    it('should handle reference patterns', () => {
      const code = `fn test(&Point { x, y }: &Point) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('x');
        expect(result[0].type_annotation).toBe('&Point');
        expect(result[1].name).toBe('y');
        expect(result[1].type_annotation).toBe('&Point');
      }
    });
    
    it('should handle mutable reference patterns', () => {
      const code = `fn test(&mut Point { x, y }: &mut Point) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('x');
        expect(result[0].type_annotation).toBe('&mut Point');
        expect(result[1].name).toBe('y');
        expect(result[1].type_annotation).toBe('&mut Point');
      }
    });
    
    it('should handle enum variant patterns', () => {
      const code = `fn test(Option::Some(value): Option<i32>) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('value');
        expect(result[0].type_annotation).toBe('i32');
      }
    });
    
    it('should handle wildcard patterns', () => {
      const code = `fn test((x, _): (i32, i32)) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        // Should only include named parameters, not wildcards
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('x');
        expect(result[0].type_annotation).toBe('i32');
      }
    });
    
    it('should handle simple parameters', () => {
      const code = `fn test(x: i32) {}`;
      
      const parser = get_language_parser('rust');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'rust',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_item')[0];
      const params_node = func_node.childForFieldName('parameters');
      const param_node = params_node?.child(1);
      
      if (param_node) {
        const result = handle_pattern_parameters(param_node, context);
        
        // Simple parameters with identifier patterns should be handled
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('x');
        expect(result[0].type_annotation).toBe('i32');
      }
    });
  });
});