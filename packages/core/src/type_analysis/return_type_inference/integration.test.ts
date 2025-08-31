/**
 * Integration test for return type inference in code_graph
 */

import { describe, it, expect } from 'vitest';
import { analyze_file } from '../../code_graph';
import { CodeFile } from '../../project/file_scanner';

describe('Return Type Inference Integration', () => {
  it('should infer explicit return type annotations', async () => {
    const file: CodeFile = {
      file_path: 'test.ts',
      source_code: `
        function getString(): string {
          return "hello";
        }
        
        function getNumber(): number {
          return 42;
        }
      `,
      language: 'typescript'
    };
    
    const analysis = await analyze_file(file);
    
    expect(analysis.functions).toHaveLength(2);
    
    const getString = analysis.functions.find(f => f.name === 'getString');
    expect(getString?.signature.return_type).toBe('string');
    
    const getNumber = analysis.functions.find(f => f.name === 'getNumber');
    expect(getNumber?.signature.return_type).toBe('number');
  });
  
  it('should infer return types from return statements', async () => {
    const file: CodeFile = {
      file_path: 'test.js',
      source_code: `
        function getStringLiteral() {
          return "hello";
        }
        
        function getNumberLiteral() {
          return 42;
        }
        
        function getBooleanLiteral() {
          return true;
        }
      `,
      language: 'javascript'
    };
    
    const analysis = await analyze_file(file);
    
    expect(analysis.functions).toHaveLength(3);
    
    const getStringLiteral = analysis.functions.find(f => f.name === 'getStringLiteral');
    expect(getStringLiteral?.signature.return_type).toBe('string');
    
    const getNumberLiteral = analysis.functions.find(f => f.name === 'getNumberLiteral');
    expect(getNumberLiteral?.signature.return_type).toBe('number');
    
    const getBooleanLiteral = analysis.functions.find(f => f.name === 'getBooleanLiteral');
    expect(getBooleanLiteral?.signature.return_type).toBe('boolean');
  });
  
  it('should handle async functions', async () => {
    const file: CodeFile = {
      file_path: 'test.ts',
      source_code: `
        async function fetchData(): Promise<string> {
          return "data";
        }
        
        async function fetchNumber() {
          return 123;
        }
      `,
      language: 'typescript'
    };
    
    const analysis = await analyze_file(file);
    
    expect(analysis.functions).toHaveLength(2);
    
    const fetchData = analysis.functions.find(f => f.name === 'fetchData');
    expect(fetchData?.signature.return_type).toBe('Promise<string>');
    expect(fetchData?.signature.is_async).toBe(true);
    
    const fetchNumber = analysis.functions.find(f => f.name === 'fetchNumber');
    expect(fetchNumber?.signature.return_type).toBe('Promise<number>');
    expect(fetchNumber?.signature.is_async).toBe(true);
  });
  
  it('should handle generator functions', async () => {
    const file: CodeFile = {
      file_path: 'test.js',
      source_code: `
        function* generateNumbers() {
          yield 1;
          yield 2;
          yield 3;
        }
      `,
      language: 'javascript'
    };
    
    const analysis = await analyze_file(file);
    
    expect(analysis.functions).toHaveLength(1);
    
    const generateNumbers = analysis.functions[0];
    expect(generateNumbers.name).toBe('generateNumbers');
    expect(generateNumbers.signature.is_generator).toBe(true);
    expect(generateNumbers.signature.return_type).toContain('Generator');
  });
  
  it('should handle void functions', async () => {
    const file: CodeFile = {
      file_path: 'test.ts',
      source_code: `
        function doNothing(): void {
          console.log("side effect");
        }
        
        function implicitVoid() {
          console.log("no return");
        }
      `,
      language: 'typescript'
    };
    
    const analysis = await analyze_file(file);
    
    expect(analysis.functions).toHaveLength(2);
    
    const doNothing = analysis.functions.find(f => f.name === 'doNothing');
    expect(doNothing?.signature.return_type).toBe('void');
    
    const implicitVoid = analysis.functions.find(f => f.name === 'implicitVoid');
    expect(implicitVoid?.signature.return_type).toBe('void');
  });
  
  it('should handle multiple return paths', async () => {
    const file: CodeFile = {
      file_path: 'test.js',
      source_code: `
        function getStringOrNumber(flag) {
          if (flag) {
            return "text";
          }
          return 100;
        }
      `,
      language: 'javascript'
    };
    
    const analysis = await analyze_file(file);
    
    expect(analysis.functions).toHaveLength(1);
    
    const func = analysis.functions[0];
    expect(func.name).toBe('getStringOrNumber');
    // Should infer union type or 'any' for mixed types
    expect(func.signature.return_type).toMatch(/string|number|any/);
  });
});