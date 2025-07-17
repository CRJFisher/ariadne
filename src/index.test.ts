import { Project } from './index';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PROJECT_DIR = path.join(__dirname, '../__fixtures__/test-project');

describe('Project - Basic Operations', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('should initialize without errors', () => {
    expect(project).toBeDefined();
  });

  test('should add and parse TypeScript files', () => {
    const code = `
      function testFunction(x: number): number {
        return x * 2;
      }
      
      const result = testFunction(21);
    `;
    
    project.add_or_update_file('test.ts', code);
    
    // Verify definition can be found
    const def = project.go_to_definition('test.ts', { row: 5, column: 21 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('testFunction');
  });

  test('should add and parse JavaScript files', () => {
    const code = `
      function jsFunction(x) {
        return x * 2;
      }
      
      const result = jsFunction(21);
    `;
    
    project.add_or_update_file('test.js', code);
    
    // Verify definition can be found
    const def = project.go_to_definition('test.js', { row: 5, column: 21 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('jsFunction');
  });

  test('should add and parse Python files', () => {
    const code = `
def py_function(x):
    return x * 2

result = py_function(21)
    `;
    
    project.add_or_update_file('test.py', code);
    
    // Verify definition can be found
    const def = project.go_to_definition('test.py', { row: 4, column: 9 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('py_function');
  });

  test('should handle file updates', () => {
    const code1 = `const x = 1;`;
    const code2 = `const y = 2;`;
    
    project.add_or_update_file('test.ts', code1);
    project.add_or_update_file('test.ts', code2);
    
    // Verify the file was updated (old symbol should not be found)
    const oldDef = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(oldDef).toBeNull();
  });

  test('should remove files', () => {
    const code = `const x = 1;`;
    project.add_or_update_file('test.ts', code);
    
    // Verify file exists
    const def1 = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(def1).not.toBeNull();
    
    // Remove file
    project.remove_file('test.ts');
    
    // Verify file is removed
    const def2 = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(def2).toBeNull();
  });
});

describe('Project - Go to Definition', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('should find local variable definitions', () => {
    const code = `
      function test() {
        const localVar = 42;
        console.log(localVar);
      }
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const def = project.go_to_definition('test.ts', { row: 3, column: 20 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('localVar');
    expect(def?.file_path).toBe('test.ts');
    expect(def?.range.start.row).toBe(2);
  });

  test('should find function definitions', () => {
    const code = `
      function myFunction() {
        return 'hello';
      }
      
      myFunction();
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const def = project.go_to_definition('test.ts', { row: 5, column: 6 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('myFunction');
    expect(def?.symbol_kind).toBe('function');
  });

  test('should find class definitions', () => {
    const code = `
      class MyClass {
        constructor() {}
      }
      
      const instance = new MyClass();
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const def = project.go_to_definition('test.ts', { row: 5, column: 27 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('MyClass');
    expect(def?.symbol_kind).toBe('class');
  });

  test('should find method definitions', () => {
    const code = `
      class MyClass {
        myMethod() {
          return 'hello';
        }
      }
      
      const instance = new MyClass();
      instance.myMethod();
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const def = project.go_to_definition('test.ts', { row: 8, column: 15 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('myMethod');
    expect(def?.symbol_kind).toBe('method');
  });

  test('should return null for undefined symbols', () => {
    const code = `const x = undefinedSymbol;`;
    project.add_or_update_file('test.ts', code);
    
    const def = project.go_to_definition('test.ts', { row: 0, column: 15 });
    expect(def).toBeNull();
  });

  test('should handle imports', () => {
    const libCode = `export function exportedFunction() { return 42; }`;
    const mainCode = `
      import { exportedFunction } from './lib';
      exportedFunction();
    `;
    
    project.add_or_update_file('lib.ts', libCode);
    project.add_or_update_file('main.ts', mainCode);
    
    // Try to find definition of imported function
    const def = project.go_to_definition('main.ts', { row: 2, column: 6 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('exportedFunction');
    // Since we don't have cross-file resolution yet, it should find the import
    expect(def?.symbol_kind).toBe('import');
  });
});

describe('Project - Find All References', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('should find all references to a variable', () => {
    const code = `
      const myVar = 42;
      console.log(myVar);
      const result = myVar + 1;
      return myVar;
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const refs = project.find_all_references('test.ts', { row: 1, column: 12 });
    expect(refs.length).toBe(3); // 3 references (excluding the definition)
    
    // Verify reference locations
    expect(refs[0].range.start.row).toBe(2);
    expect(refs[1].range.start.row).toBe(3);
    expect(refs[2].range.start.row).toBe(4);
  });

  test('should find references to functions', () => {
    const code = `
      function testFunc() {
        return 42;
      }
      
      testFunc();
      const x = testFunc();
      const fn = testFunc;
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const refs = project.find_all_references('test.ts', { row: 1, column: 15 });
    expect(refs.length).toBe(3);
  });

  test('should find references within class methods', () => {
    const code = `
      class MyClass {
        private value = 10;
        
        getValue() {
          return this.value;
        }
        
        setValue(newValue: number) {
          this.value = newValue;
        }
      }
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const refs = project.find_all_references('test.ts', { row: 2, column: 16 });
    expect(refs.length).toBe(2); // Referenced in getValue and setValue
  });

  test('should return empty array for symbols with no references', () => {
    const code = `const unusedVar = 42;`;
    project.add_or_update_file('test.ts', code);
    
    const refs = project.find_all_references('test.ts', { row: 0, column: 6 });
    expect(refs).toEqual([]);
  });

  test('should handle references in different scopes', () => {
    const code = `
      const globalVar = 'global';
      
      function func1() {
        console.log(globalVar);
      }
      
      function func2() {
        const localVar = globalVar;
        return localVar;
      }
      
      class MyClass {
        method() {
          return globalVar;
        }
      }
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const refs = project.find_all_references('test.ts', { row: 1, column: 12 });
    expect(refs.length).toBe(3); // Used in func1, func2, and MyClass.method
  });
});

describe('Project - Edge Cases', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('should handle empty files', () => {
    project.add_or_update_file('empty.ts', '');
    
    const def = project.go_to_definition('empty.ts', { row: 0, column: 0 });
    expect(def).toBeNull();
    
    const refs = project.find_all_references('empty.ts', { row: 0, column: 0 });
    expect(refs).toEqual([]);
  });

  test('should handle positions outside file bounds', () => {
    const code = `const x = 1;`;
    project.add_or_update_file('test.ts', code);
    
    const def = project.go_to_definition('test.ts', { row: 100, column: 100 });
    expect(def).toBeNull();
    
    const refs = project.find_all_references('test.ts', { row: 100, column: 100 });
    expect(refs).toEqual([]);
  });

  test('should handle syntax errors gracefully', () => {
    const code = `const x = ;`; // Syntax error
    project.add_or_update_file('test.ts', code);
    
    // Should still be able to find the definition of x
    const def = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('x');
  });

  test('should handle rapid file updates', () => {
    const versions = [
      `const a = 1;`,
      `const b = 2;`,
      `const c = 3;`,
      `const d = 4;`,
    ];
    
    // Rapidly update the same file
    versions.forEach(code => {
      project.add_or_update_file('test.ts', code);
    });
    
    // Should have the latest version
    const def = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('d');
  });

  test('should handle file removal and re-addition', () => {
    const code = `const x = 1;`;
    
    // Add file
    project.add_or_update_file('test.ts', code);
    const def1 = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(def1).not.toBeNull();
    
    // Remove file
    project.remove_file('test.ts');
    const def2 = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(def2).toBeNull();
    
    // Re-add file
    project.add_or_update_file('test.ts', code);
    const def3 = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(def3).not.toBeNull();
    expect(def3?.name).toBe('x');
  });
});

describe('Project - Multi-language Support', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('should handle mixed TypeScript and JavaScript files', () => {
    const tsCode = `export function tsFunction() { return 'ts'; }`;
    const jsCode = `function jsFunction() { return 'js'; }`;
    
    project.add_or_update_file('file.ts', tsCode);
    project.add_or_update_file('file.js', jsCode);
    
    const tsDef = project.go_to_definition('file.ts', { row: 0, column: 16 });
    expect(tsDef).not.toBeNull();
    expect(tsDef?.name).toBe('tsFunction');
    
    const jsDef = project.go_to_definition('file.js', { row: 0, column: 9 });
    expect(jsDef).not.toBeNull();
    expect(jsDef?.name).toBe('jsFunction');
  });

  test('should handle Python alongside JS/TS', () => {
    const pyCode = `
def python_function():
    return "python"
    
result = python_function()
`;
    
    project.add_or_update_file('file.py', pyCode);
    
    const def = project.go_to_definition('file.py', { row: 4, column: 9 });
    expect(def).not.toBeNull();
    expect(def?.name).toBe('python_function');
  });

  test('should handle files with same name but different extensions', () => {
    const codes = {
      'test.ts': `const tsVar = 'typescript';`,
      'test.js': `const jsVar = 'javascript';`,
      'test.py': `py_var = 'python'`,
    };
    
    Object.entries(codes).forEach(([filename, code]) => {
      project.add_or_update_file(filename, code);
    });
    
    // Each file should maintain its own scope
    const tsDef = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(tsDef?.name).toBe('tsVar');
    
    const jsDef = project.go_to_definition('test.js', { row: 0, column: 6 });
    expect(jsDef?.name).toBe('jsVar');
    
    const pyDef = project.go_to_definition('test.py', { row: 0, column: 0 });
    expect(pyDef?.name).toBe('py_var');
  });
});

describe('Project - Public ScopeGraph access', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('get_scope_graph returns graph for existing file', () => {
    const code = `
function testFunction(): void {
  const x = 42;
  console.log(x);
}
`;
    project.add_or_update_file('test.ts', code);

    const graph = project.get_scope_graph('test.ts');
    expect(graph).not.toBeNull();
    
    // Verify it's actually a ScopeGraph instance
    const defs = graph!.getNodes('definition');
    const scopes = graph!.getNodes('scope');
    expect(defs.length + scopes.length).toBeGreaterThan(0);
    
    // Should have at least a root scope and some definitions
    expect(scopes.length).toBeGreaterThan(0);
    expect(defs.length).toBeGreaterThan(0);
    
    // Verify the function definition exists
    const funcDef = defs.find(d => d.name === 'testFunction');
    expect(funcDef).toBeDefined();
    expect(funcDef?.symbol_kind).toBe('function');
  });

  test('get_scope_graph returns null for non-existent file', () => {
    const graph = project.get_scope_graph('non-existent.ts');
    expect(graph).toBeNull();
  });

  test('get_all_scope_graphs returns all file graphs', () => {
    const code1 = `const x = 1;`;
    const code2 = `const y = 2;`;
    const code3 = `const z = 3;`;

    project.add_or_update_file('file1.ts', code1);
    project.add_or_update_file('file2.ts', code2);
    project.add_or_update_file('file3.js', code3);

    const allGraphs = project.get_all_scope_graphs();
    
    // Should have 3 graphs
    expect(allGraphs.size).toBe(3);
    
    // Verify all files are present
    expect(allGraphs.has('file1.ts')).toBe(true);
    expect(allGraphs.has('file2.ts')).toBe(true);
    expect(allGraphs.has('file3.js')).toBe(true);
    
    // Verify each graph has expected content
    const graph1 = allGraphs.get('file1.ts');
    const defs1 = graph1!.getNodes('definition');
    expect(defs1.find(d => d.name === 'x')).toBeDefined();
    
    const graph2 = allGraphs.get('file2.ts');
    const defs2 = graph2!.getNodes('definition');
    expect(defs2.find(d => d.name === 'y')).toBeDefined();
    
    const graph3 = allGraphs.get('file3.js');
    const defs3 = graph3!.getNodes('definition');
    expect(defs3.find(d => d.name === 'z')).toBeDefined();
  });

  test('get_all_scope_graphs returns a copy to prevent external modifications', () => {
    const code = `const x = 1;`;
    project.add_or_update_file('test.ts', code);
    
    const graphs1 = project.get_all_scope_graphs();
    const graphs2 = project.get_all_scope_graphs();
    
    // Should be different Map instances
    expect(graphs1).not.toBe(graphs2);
    
    // But contain the same data
    expect(graphs1.size).toBe(graphs2.size);
    expect(graphs1.get('test.ts')).toBe(graphs2.get('test.ts'));
    
    // Modifying returned map should not affect internal state
    graphs1.clear();
    const graphs3 = project.get_all_scope_graphs();
    expect(graphs3.size).toBe(1);
    expect(graphs3.has('test.ts')).toBe(true);
  });

  test('scope graphs update when files are modified', () => {
    const code1 = `const oldVar = 1;`;
    const code2 = `const newVar = 2;`;
    
    project.add_or_update_file('test.ts', code1);
    const graph1 = project.get_scope_graph('test.ts');
    const defs1 = graph1!.getNodes('definition');
    expect(defs1.find(d => d.name === 'oldVar')).toBeDefined();
    expect(defs1.find(d => d.name === 'newVar')).toBeUndefined();
    
    project.add_or_update_file('test.ts', code2);
    const graph2 = project.get_scope_graph('test.ts');
    const defs2 = graph2!.getNodes('definition');
    expect(defs2.find(d => d.name === 'oldVar')).toBeUndefined();
    expect(defs2.find(d => d.name === 'newVar')).toBeDefined();
  });

  test('removed files are not included in get_all_scope_graphs', () => {
    project.add_or_update_file('file1.ts', `const x = 1;`);
    project.add_or_update_file('file2.ts', `const y = 2;`);
    
    let allGraphs = project.get_all_scope_graphs();
    expect(allGraphs.size).toBe(2);
    
    project.remove_file('file1.ts');
    
    allGraphs = project.get_all_scope_graphs();
    expect(allGraphs.size).toBe(1);
    expect(allGraphs.has('file1.ts')).toBe(false);
    expect(allGraphs.has('file2.ts')).toBe(true);
  });
});