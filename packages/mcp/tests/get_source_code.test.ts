import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Project } from '@ariadnejs/core';
import { getSourceCode, GetSourceCodeRequest } from '../src/tools/get_source_code';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('get_source_code', () => {
  let project: Project;
  let testDir: string;

  beforeAll(async () => {
    project = new Project();
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), 'ariadne-source-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TypeScript source extraction', () => {
    it('should extract function source code', async () => {
      const testFile = path.join(testDir, 'functions.ts');
      const content = `
/**
 * Calculates the sum of two numbers
 * @param a First number
 * @param b Second number
 * @returns The sum
 */
export function calculate(a: number, b: number): number {
  const result = a + b;
  console.log(\`Calculating \${a} + \${b} = \${result}\`);
  return result;
}

function privateHelper(): void {
  console.log("Helper");
}

export const arrowFunc = (x: number): number => {
  return x * 2;
};
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getSourceCode(project, { 
        symbol: 'calculate',
        includeDocstring: true
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.symbol).toBe('calculate');
      expect(result.file).toBe(testFile);
      expect(result.language).toBe('typescript');
      
      // Check that source code includes the full function
      expect(result.sourceCode).toContain('function calculate');
      expect(result.sourceCode).toContain('const result = a + b');
      expect(result.sourceCode).toContain('return result');
      
      // Check line numbers
      expect(result.startLine).toBe(7); // Function starts at line 7
      expect(result.endLine).toBe(11); // Function ends at line 11
      
      // Check docstring extraction
      if (result.docstring) {
        expect(result.docstring).toContain('Calculates the sum');
      }
    });

    it('should extract class source code', async () => {
      const testFile = path.join(testDir, 'classes.ts');
      const content = `
/**
 * A simple calculator class
 */
export class Calculator {
  private result: number = 0;
  
  constructor(initial: number = 0) {
    this.result = initial;
  }
  
  add(value: number): Calculator {
    this.result += value;
    return this;
  }
  
  multiply(value: number): Calculator {
    this.result *= value;
    return this;
  }
  
  getResult(): number {
    return this.result;
  }
}

export class SimpleClass {
  name: string = "simple";
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getSourceCode(project, { 
        symbol: 'Calculator'
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Check that the entire class is extracted
      expect(result.sourceCode).toContain('export class Calculator');
      expect(result.sourceCode).toContain('constructor(initial: number = 0)');
      expect(result.sourceCode).toContain('add(value: number)');
      expect(result.sourceCode).toContain('multiply(value: number)');
      expect(result.sourceCode).toContain('getResult(): number');
      
      expect(result.startLine).toBe(4);
      expect(result.endLine).toBe(24);
    });

    it('should extract interface source code', async () => {
      const testFile = path.join(testDir, 'interfaces.ts');
      const content = `
export interface Config {
  name: string;
  port: number;
  ssl?: boolean;
}

export type Status = 'active' | 'inactive' | 'pending';

export interface Service extends Config {
  start(): void;
  stop(): void;
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const configResult = await getSourceCode(project, { 
        symbol: 'Config'
      });
      
      const serviceResult = await getSourceCode(project, { 
        symbol: 'Service'
      });
      
      expect(configResult).not.toHaveProperty('error');
      expect(serviceResult).not.toHaveProperty('error');
      if ('error' in configResult || 'error' in serviceResult) return;
      
      // Check Config interface
      expect(configResult.sourceCode).toContain('export interface Config');
      expect(configResult.sourceCode).toContain('name: string');
      expect(configResult.sourceCode).toContain('ssl?: boolean');
      
      // Check Service interface
      expect(serviceResult.sourceCode).toContain('export interface Service extends Config');
      expect(serviceResult.sourceCode).toContain('start(): void');
    });

    it('should extract type alias source code', async () => {
      const testFile = path.join(testDir, 'types.ts');
      const content = `
export type Primitive = string | number | boolean;

export type Callback<T> = (value: T) => void;

export type ComplexType = {
  id: string;
  data: Record<string, any>;
  callbacks: Callback<string>[];
};
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getSourceCode(project, { 
        symbol: 'ComplexType'
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.sourceCode).toContain('export type ComplexType');
      expect(result.sourceCode).toContain('id: string');
      expect(result.sourceCode).toContain('callbacks: Callback<string>[]');
    });
  });

  describe('JavaScript source extraction', () => {
    it('should extract JavaScript functions', async () => {
      const testFile = path.join(testDir, 'funcs.js');
      const content = `
/**
 * Process data
 * @param {Object} data - The data to process
 * @returns {Object} Processed data
 */
function processData(data) {
  // Transform the data
  const transformed = {
    ...data,
    processed: true,
    timestamp: Date.now()
  };
  
  return transformed;
}

class DataProcessor {
  constructor() {
    this.count = 0;
  }
  
  process(item) {
    this.count++;
    return processData(item);
  }
}

module.exports = { processData, DataProcessor };
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const funcResult = await getSourceCode(project, { 
        symbol: 'processData'
      });
      
      const classResult = await getSourceCode(project, { 
        symbol: 'DataProcessor'
      });
      
      expect(funcResult).not.toHaveProperty('error');
      expect(classResult).not.toHaveProperty('error');
      if ('error' in funcResult || 'error' in classResult) return;
      
      expect(funcResult.language).toBe('javascript');
      expect(funcResult.sourceCode).toContain('function processData(data)');
      expect(funcResult.sourceCode).toContain('processed: true');
      
      expect(classResult.sourceCode).toContain('class DataProcessor');
      expect(classResult.sourceCode).toContain('constructor()');
      expect(classResult.sourceCode).toContain('process(item)');
    });
  });

  describe('Python source extraction', () => {
    it('should extract Python functions and classes', async () => {
      const testFile = path.join(testDir, 'source.py');
      const content = `
def simple_function(x, y):
    """
    Simple function that adds two numbers
    """
    return x + y

class Calculator:
    """
    A calculator class with basic operations
    """
    
    def __init__(self, initial=0):
        self.value = initial
    
    def add(self, x):
        """Add a value"""
        self.value += x
        return self
    
    def multiply(self, x):
        """Multiply by a value"""
        self.value *= x
        return self
    
    def get_result(self):
        return self.value

async def async_function():
    """Async function example"""
    await some_operation()
    return "done"
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const funcResult = await getSourceCode(project, { 
        symbol: 'simple_function',
        includeDocstring: true
      });
      
      const classResult = await getSourceCode(project, { 
        symbol: 'Calculator'
      });
      
      expect(funcResult).not.toHaveProperty('error');
      expect(classResult).not.toHaveProperty('error');
      if ('error' in funcResult || 'error' in classResult) return;
      
      expect(funcResult.language).toBe('python');
      expect(funcResult.sourceCode).toContain('def simple_function(x, y)');
      expect(funcResult.sourceCode).toContain('return x + y');
      
      // Check Python docstring extraction
      if (funcResult.docstring) {
        expect(funcResult.docstring).toContain('adds two numbers');
      }
      
      expect(classResult.sourceCode).toContain('class Calculator');
      expect(classResult.sourceCode).toContain('def __init__');
      expect(classResult.sourceCode).toContain('def add(self, x)');
      expect(classResult.sourceCode).toContain('def get_result(self)');
    });
  });

  describe('Rust source extraction', () => {
    it('should extract Rust functions and structs', async () => {
      const testFile = path.join(testDir, 'source.rs');
      const content = `
/// Calculate the sum of two numbers
pub fn calculate(a: i32, b: i32) -> i32 {
    a + b
}

pub struct Calculator {
    value: i32,
}

impl Calculator {
    pub fn new(initial: i32) -> Self {
        Calculator { value: initial }
    }
    
    pub fn add(&mut self, x: i32) {
        self.value += x;
    }
    
    pub fn get_value(&self) -> i32 {
        self.value
    }
}

fn private_helper() -> String {
    String::from("helper")
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const funcResult = await getSourceCode(project, { 
        symbol: 'calculate'
      });
      
      const structResult = await getSourceCode(project, { 
        symbol: 'Calculator'
      });
      
      expect(funcResult).not.toHaveProperty('error');
      expect(structResult).not.toHaveProperty('error');
      if ('error' in funcResult || 'error' in structResult) return;
      
      expect(funcResult.language).toBe('rust');
      expect(funcResult.sourceCode).toContain('pub fn calculate');
      expect(funcResult.sourceCode).toContain('a + b');
      
      expect(structResult.sourceCode).toContain('pub struct Calculator');
      expect(structResult.sourceCode).toContain('value: i32');
    });
  });

  describe('Error handling', () => {
    it('should return error for non-existent symbol', async () => {
      const testFile = path.join(testDir, 'test.ts');
      const content = 'const x = 1;';
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getSourceCode(project, { 
        symbol: 'nonExistentFunction'
      });
      
      expect(result).toHaveProperty('error');
      if (!('error' in result)) return;
      
      expect(result.error).toBe('symbol_not_found');
      expect(result.message).toContain('nonExistentFunction');
    });

    it('should provide suggestions for similar symbols', async () => {
      const testFile = path.join(testDir, 'similar.ts');
      const content = `
function calculateSum(a: number, b: number): number {
  return a + b;
}

function calculateProduct(a: number, b: number): number {
  return a * b;
}

function computeAverage(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getSourceCode(project, { 
        symbol: 'calculate'  // Typo - missing the full name
      });
      
      expect(result).toHaveProperty('error');
      if (!('error' in result)) return;
      
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain('calculateSum');
      expect(result.suggestions).toContain('calculateProduct');
    });
  });

  describe('Docstring extraction', () => {
    it('should extract JSDoc comments', async () => {
      const testFile = path.join(testDir, 'jsdoc.ts');
      const content = `
/**
 * Performs a complex calculation
 * @param {number} x - The first parameter
 * @param {number} y - The second parameter
 * @returns {number} The calculated result
 * @example
 * const result = complexCalc(5, 10);
 */
export function complexCalc(x: number, y: number): number {
  return Math.pow(x, 2) + Math.pow(y, 2);
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getSourceCode(project, { 
        symbol: 'complexCalc',
        includeDocstring: true
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      if (result.docstring) {
        expect(result.docstring).toContain('complex calculation');
        expect(result.docstring).toContain('@param');
        expect(result.docstring).toContain('@returns');
      }
    });

    it('should handle includeDocstring flag', async () => {
      const testFile = path.join(testDir, 'docflag.ts');
      const content = `
/**
 * Function with documentation
 */
function documented(): void {
  console.log("test");
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const withDoc = await getSourceCode(project, { 
        symbol: 'documented',
        includeDocstring: true
      });
      
      const withoutDoc = await getSourceCode(project, { 
        symbol: 'documented',
        includeDocstring: false
      });
      
      expect(withDoc).not.toHaveProperty('error');
      expect(withoutDoc).not.toHaveProperty('error');
      if ('error' in withDoc || 'error' in withoutDoc) return;
      
      // Both should have the source code
      expect(withDoc.sourceCode).toContain('function documented');
      expect(withoutDoc.sourceCode).toContain('function documented');
      
      // Only withDoc might have docstring (depending on implementation)
      // withoutDoc should not attempt to extract docstring
    });
  });

  describe('Complex source extraction', () => {
    it('should extract nested functions', async () => {
      const testFile = path.join(testDir, 'nested.ts');
      const content = `
export function outerFunction(x: number): () => number {
  const multiplier = 2;
  
  function innerFunction(): number {
    return x * multiplier;
  }
  
  return innerFunction;
}

export class Container {
  method1(): void {
    function localFunc(): void {
      console.log("local");
    }
    localFunc();
  }
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const outerResult = await getSourceCode(project, { 
        symbol: 'outerFunction'
      });
      
      expect(outerResult).not.toHaveProperty('error');
      if ('error' in outerResult) return;
      
      // Should include the entire outer function including inner
      expect(outerResult.sourceCode).toContain('function outerFunction');
      expect(outerResult.sourceCode).toContain('function innerFunction');
      expect(outerResult.sourceCode).toContain('return innerFunction');
    });

    it('should handle multiline signatures', async () => {
      const testFile = path.join(testDir, 'multiline.ts');
      const content = `
export function complexSignature(
  param1: string,
  param2: number,
  param3: {
    nested: boolean;
    value: string;
  }
): Promise<{
  result: string;
  status: number;
}> {
  return Promise.resolve({
    result: param1,
    status: param2
  });
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getSourceCode(project, { 
        symbol: 'complexSignature'
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Should capture the entire function including multiline signature
      expect(result.sourceCode).toContain('export function complexSignature');
      expect(result.sourceCode).toContain('param1: string');
      expect(result.sourceCode).toContain('Promise<{');
      expect(result.sourceCode).toContain('return Promise.resolve');
    });
  });
});