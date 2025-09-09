import { describe, it, expect } from 'vitest';
import { resolve_overload_parameters } from './parameter_type_inference.typescript';
import { get_language_parser } from '../../scope_queries/loader';
import { ParameterInfo, ParameterInferenceContext } from './parameter_type_inference';
import { FunctionDefinition, Location } from '@ariadnejs/types';

describe('TypeScript bespoke parameter type inference', () => {
  function create_mock_def(name: string): FunctionDefinition {
    const location: Location = {
      file_path: 'test.ts',
      start: { row: 0, column: 0 },
      end: { row: 1, column: 0 }
    };
    
    return {
      name,
      location,
      signature: `function ${name}()`,
      is_exported: false
    };
  }

  describe('resolve_overload_parameters', () => {
    it('should handle function with no overloads', () => {
      const code = `
function test(x: string, y: number): void {
  console.log(x, y);
}
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'typescript',
        source_code: code
      };
      
      const func_node = tree.rootNode.descendantsOfType('function_declaration')[0];
      const func_def = create_mock_def('test');
      const parameters: ParameterInfo[] = [
        { name: 'x', position: 0, type_annotation: 'string' },
        { name: 'y', position: 1, type_annotation: 'number' }
      ];
      
      const result = resolve_overload_parameters(func_def, func_node, parameters, context);
      
      expect(result).toEqual(parameters);
      expect(result.length).toBe(2);
    });
    
    it('should merge parameter info from function overloads', () => {
      const code = `
function test(x: string): void;
function test(x: number): void;
function test(x: string | number): void {
  console.log(x);
}
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'typescript',
        source_code: code
      };
      
      const func_nodes = tree.rootNode.descendantsOfType('function_declaration');
      const impl_node = func_nodes[func_nodes.length - 1]; // Last one is the implementation
      const func_def = create_mock_def('test');
      const parameters: ParameterInfo[] = [
        { name: 'x', position: 0 } // No type initially
      ];
      
      const result = resolve_overload_parameters(func_def, impl_node, parameters, context);
      
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('x');
      // Should have picked up type from overload signatures
      expect(result[0].type_annotation).toBeDefined();
    });
    
    it('should handle method overloads in classes', () => {
      const code = `
class Test {
  method(x: string, y: number): void;
  method(x: number, y: string): void;
  method(x: string | number, y: string | number): void {
    console.log(x, y);
  }
}
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'typescript',
        source_code: code
      };
      
      const method_nodes = tree.rootNode.descendantsOfType('method_definition');
      const impl_node = method_nodes[method_nodes.length - 1]; // Last one is the implementation
      const func_def = create_mock_def('method');
      const parameters: ParameterInfo[] = [
        { name: 'x', position: 0 },
        { name: 'y', position: 1 }
      ];
      
      const result = resolve_overload_parameters(func_def, impl_node, parameters, context);
      
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('x');
      expect(result[1].name).toBe('y');
    });
    
    it('should preserve existing type annotations', () => {
      const code = `
function test(x: any): void;
function test(x: string | number): void {
  console.log(x);
}
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'typescript',
        source_code: code
      };
      
      const func_nodes = tree.rootNode.descendantsOfType('function_declaration');
      const impl_node = func_nodes[func_nodes.length - 1];
      const func_def = create_mock_def('test');
      const parameters: ParameterInfo[] = [
        { name: 'x', position: 0, type_annotation: 'string | number' } // Already has type
      ];
      
      const result = resolve_overload_parameters(func_def, impl_node, parameters, context);
      
      expect(result[0].type_annotation).toBe('string | number'); // Should preserve existing
    });
    
    it('should handle optional parameters in overloads', () => {
      const code = `
function test(x: string): void;
function test(x: string, y?: number): void;
function test(x: string, y?: number): void {
  console.log(x, y);
}
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser!.parse(code);
      const context: ParameterInferenceContext = {
        language: 'typescript',
        source_code: code
      };
      
      const func_nodes = tree.rootNode.descendantsOfType('function_declaration');
      const impl_node = func_nodes[func_nodes.length - 1];
      const func_def = create_mock_def('test');
      const parameters: ParameterInfo[] = [
        { name: 'x', position: 0 },
        { name: 'y', position: 1, is_optional: true }
      ];
      
      const result = resolve_overload_parameters(func_def, impl_node, parameters, context);
      
      expect(result.length).toBe(2);
      expect(result[1].is_optional).toBe(true);
    });
  });
});