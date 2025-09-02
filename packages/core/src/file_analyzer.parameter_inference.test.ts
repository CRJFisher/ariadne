/**
 * Integration test for parameter type inference in file analyzer
 */

import { describe, it, expect } from 'vitest';
import { analyze_file } from './file_analyzer';
import { CodeFile } from './project/file_scanner';

describe('Parameter Type Inference Integration', () => {
  it('should infer parameter types from default values', async () => {
    const file: CodeFile = {
      file_path: '/test/example.js',
      language: 'javascript',
      source_code: `
        function greet(name = "World", times = 3) {
          for (let i = 0; i < times; i++) {
            console.log("Hello, " + name);
          }
        }
      `
    };

    const { analysis } = await analyze_file(file);
    
    // Find the greet function
    const greet_func = analysis.functions.find(f => f.name === 'greet');
    expect(greet_func).toBeDefined();
    
    // Check parameter types were inferred
    const params = greet_func?.signature.parameters;
    expect(params).toHaveLength(2);
    
    // Name parameter should be inferred as string from default "World"
    const name_param = params?.find(p => p.name === 'name');
    expect(name_param?.type).toBe('string');
    
    // Times parameter should be inferred as number from default 3
    const times_param = params?.find(p => p.name === 'times');
    expect(times_param?.type).toBe('number');
  });

  it('should use explicit type annotations in TypeScript', async () => {
    const file: CodeFile = {
      file_path: '/test/example.ts',
      language: 'typescript',
      source_code: `
        function calculate(value: number, multiplier: number = 2): number {
          return value * multiplier;
        }
      `
    };

    const { analysis } = await analyze_file(file);
    
    const calc_func = analysis.functions.find(f => f.name === 'calculate');
    expect(calc_func).toBeDefined();
    
    const params = calc_func?.signature.parameters;
    expect(params).toHaveLength(2);
    
    // Both should have explicit type annotations
    const value_param = params?.find(p => p.name === 'value');
    expect(value_param?.type).toBe('number');
    
    const mult_param = params?.find(p => p.name === 'multiplier');
    expect(mult_param?.type).toBe('number');
  });

  it('should infer parameter types for Python functions', async () => {
    const file: CodeFile = {
      file_path: '/test/example.py',
      language: 'python',
      source_code: `
def process_data(data, threshold=0.5, enabled=True):
    if enabled and data > threshold:
        return data * 2
    return data
      `
    };

    const { analysis } = await analyze_file(file);
    
    const process_func = analysis.functions.find(f => f.name === 'process_data');
    expect(process_func).toBeDefined();
    
    const params = process_func?.signature.parameters;
    expect(params).toHaveLength(3);
    
    // Threshold should be inferred as float
    const threshold_param = params?.find(p => p.name === 'threshold');
    expect(threshold_param?.type).toBe('float');
    
    // Enabled should be inferred as bool
    const enabled_param = params?.find(p => p.name === 'enabled');
    expect(enabled_param?.type).toBe('bool');
  });

  it('should handle Rust parameter types', async () => {
    const file: CodeFile = {
      file_path: '/test/example.rs',
      language: 'rust',
      source_code: `
fn add_numbers(a: i32, b: i32) -> i32 {
    a + b
}
      `
    };

    const { analysis } = await analyze_file(file);
    
    const add_func = analysis.functions.find(f => f.name === 'add_numbers');
    expect(add_func).toBeDefined();
    
    const params = add_func?.signature.parameters;
    expect(params).toHaveLength(2);
    
    // Both should have explicit type annotations
    const a_param = params?.find(p => p.name === 'a');
    expect(a_param?.type).toBe('i32');
    
    const b_param = params?.find(p => p.name === 'b');
    expect(b_param?.type).toBe('i32');
  });

  it('should infer method parameter types', async () => {
    const file: CodeFile = {
      file_path: '/test/example.js',
      language: 'javascript',
      source_code: `
class Calculator {
  multiply(x = 1, y = 1) {
    return x * y;
  }
}
      `
    };

    const { analysis } = await analyze_file(file);
    
    const calc_class = analysis.classes.find(c => c.name === 'Calculator');
    expect(calc_class).toBeDefined();
    
    const multiply_method = calc_class?.methods.find(m => m.name === 'multiply');
    expect(multiply_method).toBeDefined();
    
    const params = multiply_method?.signature.parameters;
    expect(params).toHaveLength(2);
    
    // Both parameters should be inferred as number from defaults
    const x_param = params?.find(p => p.name === 'x');
    expect(x_param?.type).toBe('number');
    
    const y_param = params?.find(p => p.name === 'y');
    expect(y_param?.type).toBe('number');
  });
});