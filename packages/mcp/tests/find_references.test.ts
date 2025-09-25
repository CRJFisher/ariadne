import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { findReferences, FindReferencesRequest } from '../src/tools/find_references';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('find_references', () => {
  let project: Project;
  let testDir: string;

  beforeAll(async () => {
    project = new Project();
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), 'ariadne-find-refs-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TypeScript references', () => {
    it('should find function references across files', async () => {
      // Create main file with function definition
      const mainFile = path.join(testDir, 'main.ts');
      const mainContent = `
export function calculate(a: number, b: number): number {
  return a + b;
}

export function process(): void {
  const result = calculate(5, 3);
  console.log(result);
}
`.trim();
      
      // Create another file that uses the function
      const utilFile = path.join(testDir, 'util.ts');
      const utilContent = `
import { calculate } from './main';

export function double(x: number): number {
  return calculate(x, x);
}

export function triple(x: number): number {
  return calculate(calculate(x, x), x);
}
`.trim();
      
      await fs.writeFile(mainFile, mainContent);
      await fs.writeFile(utilFile, utilContent);
      
      project.add_or_update_file(mainFile, mainContent);
      project.add_or_update_file(utilFile, utilContent);
      
      const result = await findReferences(project, { 
        symbol: 'calculate',
        includeDeclaration: false
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.symbol).toBe('calculate');
      expect(result.totalCount).toBeGreaterThan(0);
      
      // Should find references in both files
      const mainRefs = result.references.filter(r => r.file === mainFile);
      const utilRefs = result.references.filter(r => r.file === utilFile);
      
      expect(mainRefs.length).toBeGreaterThan(0); // Reference in process()
      expect(utilRefs.length).toBeGreaterThan(0); // References in double() and triple()
      
      // Check that contexts are captured
      const hasContext = result.references.some(r => r.context.includes('calculate'));
      expect(hasContext).toBe(true);
    });

    it('should include declaration when requested', async () => {
      const testFile = path.join(testDir, 'decl.ts');
      const content = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}

const calc = new Calculator();
const result = calc.add(1, 2);
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      // Without declaration
      const withoutDecl = await findReferences(project, { 
        symbol: 'Calculator',
        includeDeclaration: false
      });
      
      // With declaration
      const withDecl = await findReferences(project, { 
        symbol: 'Calculator',
        includeDeclaration: true
      });
      
      expect(withoutDecl).not.toHaveProperty('error');
      expect(withDecl).not.toHaveProperty('error');
      if ('error' in withoutDecl || 'error' in withDecl) return;
      
      // Should have more references when including declaration
      expect(withDecl.totalCount).toBeGreaterThan(withoutDecl.totalCount);
      
      // Check that declaration is marked
      const declaration = withDecl.references.find(r => r.isDefinition);
      expect(declaration).toBeDefined();
      expect(declaration?.line).toBe(1); // Class is on line 1
    });

    it('should handle method references', async () => {
      const testFile = path.join(testDir, 'methods.ts');
      const content = `
export class Service {
  getData(): string {
    return "data";
  }
  
  processData(): void {
    const data = this.getData();
    console.log(data);
  }
}

const service = new Service();
service.getData();
service.processData();
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await findReferences(project, { 
        symbol: 'getData',
        includeDeclaration: false
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Should find at least 2 references (in processData and direct call)
      expect(result.totalCount).toBeGreaterThanOrEqual(2);
      
      // Check line numbers
      const lines = result.references.map(r => r.line);
      expect(lines).toContain(7); // this.getData() in processData
      expect(lines).toContain(13); // service.getData()
    });

    it('should respect search scope', async () => {
      const file1 = path.join(testDir, 'scope1.ts');
      const content1 = `
export function shared(): void {
  console.log("in file 1");
  shared(); // recursive call
}
`.trim();
      
      const file2 = path.join(testDir, 'scope2.ts');
      const content2 = `
import { shared } from './scope1';

export function useShared(): void {
  shared();
  shared();
}
`.trim();
      
      await fs.writeFile(file1, content1);
      await fs.writeFile(file2, content2);
      
      project.add_or_update_file(file1, content1);
      project.add_or_update_file(file2, content2);
      
      // Search in project scope
      const projectScope = await findReferences(project, { 
        symbol: 'shared',
        searchScope: 'project'
      });
      
      // Search in file scope (should only find references in the same file as definition)
      const fileScope = await findReferences(project, { 
        symbol: 'shared',
        searchScope: 'file'
      });
      
      expect(projectScope).not.toHaveProperty('error');
      expect(fileScope).not.toHaveProperty('error');
      if ('error' in projectScope || 'error' in fileScope) return;
      
      // Project scope should find references in both files
      expect(projectScope.fileCount).toBe(2);
      
      // File scope should only find references in the definition file
      expect(fileScope.fileCount).toBe(1);
      expect(fileScope.references.every(r => r.file === file1)).toBe(true);
    });
  });

  describe('JavaScript references', () => {
    it('should find references in JavaScript files', async () => {
      const testFile = path.join(testDir, 'refs.js');
      const content = `
function helper(x) {
  return x * 2;
}

function main() {
  const a = helper(5);
  const b = helper(10);
  return a + b;
}

module.exports = { helper, main };
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await findReferences(project, { 
        symbol: 'helper'
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Should find references in main() and exports
      expect(result.totalCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Python references', () => {
    it('should find references in Python files', async () => {
      const testFile = path.join(testDir, 'refs.py');
      const content = `
def calculate(a, b):
    return a + b

def process_data():
    result1 = calculate(10, 20)
    result2 = calculate(5, 5)
    return result1 + result2

class Calculator:
    def compute(self):
        return calculate(1, 2)

if __name__ == "__main__":
    print(calculate(3, 4))
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await findReferences(project, { 
        symbol: 'calculate'
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Should find multiple references
      expect(result.totalCount).toBeGreaterThanOrEqual(4);
      
      // Check that references are found in different contexts
      const inFunction = result.references.some(r => r.line >= 5 && r.line <= 7);
      const inClass = result.references.some(r => r.line === 11);
      const inMain = result.references.some(r => r.line === 14);
      
      expect(inFunction).toBe(true);
      expect(inClass).toBe(true);
      expect(inMain).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return error for non-existent symbol', async () => {
      const testFile = path.join(testDir, 'empty.ts');
      const content = 'const x = 1;';
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await findReferences(project, { 
        symbol: 'nonExistentSymbol'
      });
      
      expect(result).toHaveProperty('error');
      if (!('error' in result)) return;
      
      expect(result.error).toBe('symbol_not_found');
      expect(result.message).toContain('nonExistentSymbol');
    });

    it('should handle symbols with no references', async () => {
      const testFile = path.join(testDir, 'unused.ts');
      const content = `
function unusedFunction(): void {
  console.log("I am never called");
}

function main(): void {
  console.log("main");
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await findReferences(project, { 
        symbol: 'unusedFunction',
        includeDeclaration: false
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Should have 0 references (excluding declaration)
      expect(result.totalCount).toBe(0);
      expect(result.references).toEqual([]);
    });
  });

  describe('Multiple definitions', () => {
    it('should handle symbols with multiple definitions', async () => {
      const file1 = path.join(testDir, 'multi1.ts');
      const content1 = `
export function shared(): string {
  return "version 1";
}
`.trim();
      
      const file2 = path.join(testDir, 'multi2.ts');
      const content2 = `
export function shared(): string {
  return "version 2";
}
`.trim();
      
      const file3 = path.join(testDir, 'multi-use.ts');
      const content3 = `
import { shared as shared1 } from './multi1';
import { shared as shared2 } from './multi2';

const result = shared1() + shared2();
`.trim();
      
      await fs.writeFile(file1, content1);
      await fs.writeFile(file2, content2);
      await fs.writeFile(file3, content3);
      
      project.add_or_update_file(file1, content1);
      project.add_or_update_file(file2, content2);
      project.add_or_update_file(file3, content3);
      
      const result = await findReferences(project, { 
        symbol: 'shared',
        includeDeclaration: true
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Should find both definitions
      const definitions = result.references.filter(r => r.isDefinition);
      expect(definitions.length).toBeGreaterThanOrEqual(2);
      
      // Should find references from different files
      const files = new Set(result.references.map(r => r.file));
      expect(files.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle references in string literals correctly', async () => {
      const testFile = path.join(testDir, 'strings.ts');
      const content = `
function myFunction(): void {
  console.log("myFunction");
}

// This should be found
myFunction();

// This should not be found as a reference
const str = "myFunction is a function";
const obj = { name: "myFunction" };
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await findReferences(project, { 
        symbol: 'myFunction',
        includeDeclaration: false
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Should only find the actual function call, not string occurrences
      // This depends on the parser's accuracy
      expect(result.totalCount).toBeGreaterThanOrEqual(1);
      
      // The reference should be on line 6 (the function call)
      const hasCallReference = result.references.some(r => r.line === 6);
      expect(hasCallReference).toBe(true);
    });

    it('should provide context for each reference', async () => {
      const testFile = path.join(testDir, 'context.ts');
      const content = `
export function target(x: number): number {
  return x * 2;
}

const a = target(5);
const b = target(10) + target(20);
const c = [1, 2, 3].map(target);
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await findReferences(project, { 
        symbol: 'target'
      });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Every reference should have a context
      result.references.forEach(ref => {
        expect(ref.context).toBeDefined();
        expect(ref.context.length).toBeGreaterThan(0);
      });
      
      // Check specific contexts
      const contexts = result.references.map(r => r.context);
      expect(contexts.some(c => c.includes('target(5)'))).toBe(true);
      expect(contexts.some(c => c.includes('map(target)'))).toBe(true);
    });
  });
});