import { Project, get_definitions, Def } from './index';
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
    // Look for 'x' at position where it used to be, but now there's 'y'
    const oldDef = project.go_to_definition('test.ts', { row: 0, column: 6 });
    expect(oldDef?.name).toBe('y'); // Should find 'y' at this position, not 'x'
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

describe('Project - Function discovery APIs', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('get_functions_in_file returns all functions in a file', () => {
    const code = `
      function regularFunction() {}
      
      class MyClass {
        myMethod() {}
        static staticMethod() {}
      }
      
      const arrowFunc = () => {};
      
      function* generatorFunc() {}
    `;
    
    project.add_or_update_file('test.ts', code);
    const functions = project.get_functions_in_file('test.ts');
    
    expect(functions.length).toBeGreaterThan(0);
    
    // Verify we find different types of functions
    const funcNames = functions.map(f => f.name);
    expect(funcNames).toContain('regularFunction');
    expect(funcNames).toContain('myMethod');
    expect(funcNames).toContain('staticMethod');
    expect(funcNames).toContain('generatorFunc');
    
    // Verify symbol kinds
    functions.forEach(def => {
      expect(['function', 'method', 'generator']).toContain(def.symbol_kind);
    });
  });

  test('get_functions_in_file returns empty array for non-existent file', () => {
    const functions = project.get_functions_in_file('does-not-exist.ts');
    expect(functions).toEqual([]);
  });

  test('get_all_functions returns all functions across project', () => {
    project.add_or_update_file('file1.ts', `function func1() {}`);
    project.add_or_update_file('file2.js', `function func2() {}`);
    project.add_or_update_file('file3.py', `def func3(): pass`);
    
    const allFunctions = project.get_all_functions();
    
    expect(allFunctions).toBeInstanceOf(Map);
    expect(allFunctions.size).toBe(3);
    
    // Verify each file has its function
    expect(allFunctions.get('file1.ts')?.[0].name).toBe('func1');
    expect(allFunctions.get('file2.js')?.[0].name).toBe('func2');
    expect(allFunctions.get('file3.py')?.[0].name).toBe('func3');
  });

  test('get_all_functions filters private functions', () => {
    const code = `
      function publicFunc() {}
      function _privateFunc() {}
      function __doubleUnderscore() {}
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const withPrivate = project.get_all_functions({ include_private: true });
    const withoutPrivate = project.get_all_functions({ include_private: false });
    
    const withPrivateNames = withPrivate.get('test.ts')?.map(f => f.name) || [];
    const withoutPrivateNames = withoutPrivate.get('test.ts')?.map(f => f.name) || [];
    
    // With private should include all
    expect(withPrivateNames).toContain('publicFunc');
    expect(withPrivateNames).toContain('_privateFunc');
    expect(withPrivateNames).toContain('__doubleUnderscore');
    
    // Without private should exclude single underscore
    expect(withoutPrivateNames).toContain('publicFunc');
    expect(withoutPrivateNames).not.toContain('_privateFunc');
    expect(withoutPrivateNames).toContain('__doubleUnderscore'); // double underscore is not considered private
  });

  test('get_all_functions filters test functions', () => {
    const code = `
      function regularFunc() {}
      function testSomething() {}
      function test_another_thing() {}
      function something_test() {}
      function setup() {}
      function teardown() {}
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const withTests = project.get_all_functions({ include_tests: true });
    const withoutTests = project.get_all_functions({ include_tests: false });
    
    const withTestNames = withTests.get('test.ts')?.map(f => f.name) || [];
    const withoutTestNames = withoutTests.get('test.ts')?.map(f => f.name) || [];
    
    // With tests should include all
    expect(withTestNames.length).toBe(6);
    
    // Without tests should exclude test functions
    expect(withoutTestNames).toContain('regularFunc');
    expect(withoutTestNames).not.toContain('testSomething');
    expect(withoutTestNames).not.toContain('test_another_thing');
    expect(withoutTestNames).not.toContain('something_test');
    expect(withoutTestNames).not.toContain('setup');
    expect(withoutTestNames).not.toContain('teardown');
  });

  test('get_all_functions respects symbol_kinds filter', () => {
    const code = `
      function regularFunction() {}
      
      class MyClass {
        myMethod() {}
      }
      
      function* generatorFunc() {}
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const onlyFunctions = project.get_all_functions({ symbol_kinds: ['function'] });
    const onlyMethods = project.get_all_functions({ symbol_kinds: ['method'] });
    const onlyGenerators = project.get_all_functions({ symbol_kinds: ['generator'] });
    
    const functionNames = onlyFunctions.get('test.ts')?.map(f => f.name) || [];
    const methodNames = onlyMethods.get('test.ts')?.map(f => f.name) || [];
    const generatorNames = onlyGenerators.get('test.ts')?.map(f => f.name) || [];
    
    expect(functionNames).toContain('regularFunction');
    expect(functionNames).not.toContain('myMethod');
    
    expect(methodNames).toContain('myMethod');
    expect(methodNames).not.toContain('regularFunction');
    
    expect(generatorNames).toContain('generatorFunc');
    expect(generatorNames).not.toContain('regularFunction');
  });

  test('get_all_functions combines multiple filters', () => {
    const code = `
      function publicFunc() {}
      function _privateFunc() {}
      function testPublic() {}
      function _testPrivate() {}
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const filtered = project.get_all_functions({
      include_private: false,
      include_tests: false
    });
    
    const names = filtered.get('test.ts')?.map(f => f.name) || [];
    
    // Should only include publicFunc
    expect(names).toEqual(['publicFunc']);
  });

  test('get_all_functions returns empty map when no functions match', () => {
    const code = `
      const x = 1;
      const y = 2;
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const functions = project.get_all_functions();
    expect(functions.size).toBe(0);
  });
});

describe('get_definitions API', () => {
  test('should return all function definitions in a TypeScript file', () => {
    const code = `
      function func1() {
        return 1;
      }
      
      async function func2(x: number): Promise<number> {
        return x * 2;
      }
      
      const func3 = () => {
        return 3;
      };
      
      export function func4() {
        return 4;
      }
    `;
    
    const project = new Project();
    project.add_or_update_file('test.ts', code);
    const defs = project.get_definitions('test.ts');
    
    // get_definitions returns all definitions including variables
    const functionNames = ['func1', 'func2', 'func3', 'func4'];
    const functionDefs = defs.filter(d => functionNames.includes(d.name));
    
    expect(functionDefs.length).toBe(4);
    expect(functionDefs.map(d => d.name).sort()).toEqual(['func1', 'func2', 'func3', 'func4']);
    
    // Check symbol kinds
    expect(defs.find(d => d.name === 'func1')?.symbol_kind).toBe('function');
    expect(defs.find(d => d.name === 'func2')?.symbol_kind).toBe('function');
    expect(defs.find(d => d.name === 'func3')?.symbol_kind).toBe('constant'); // const variable
    expect(defs.find(d => d.name === 'func4')?.symbol_kind).toBe('function');
  });

  test('should return all method definitions in a TypeScript class', () => {
    const code = `
      class MyClass {
        constructor() {}
        
        method1() {
          return 1;
        }
        
        async method2(): Promise<void> {
          console.log('test');
        }
        
        private method3() {
          return 3;
        }
        
        static method4() {
          return 4;
        }
      }
    `;
    
    const project = new Project();
    project.add_or_update_file('test.ts', code);
    const defs = project.get_definitions('test.ts');
    
    const methods = defs.filter(d => d.symbol_kind === 'method');
    expect(methods.length).toBeGreaterThanOrEqual(4);
    
    const methodNames = methods.map(d => d.name);
    expect(methodNames).toContain('method1');
    expect(methodNames).toContain('method2');
    expect(methodNames).toContain('method3');
    expect(methodNames).toContain('method4');
  });

  test('should return class definitions', () => {
    const code = `
      class MyClass {
        prop: string;
      }
      
      export class ExportedClass {
        method() {}
      }
      
      abstract class AbstractClass {
        abstract method(): void;
      }
    `;
    
    const project = new Project();
    project.add_or_update_file('test.ts', code);
    const defs = project.get_definitions('test.ts');
    
    const classes = defs.filter(d => d.symbol_kind === 'class');
    expect(classes.length).toBe(3);
    expect(classes.map(d => d.name).sort()).toEqual(['AbstractClass', 'ExportedClass', 'MyClass']);
  });

  test('should work with JavaScript files', () => {
    const code = `
      function jsFunc() {
        return 'js';
      }
      
      class JsClass {
        jsMethod() {
          return 'method';
        }
      }
      
      const arrowFunc = () => 'arrow';
    `;
    
    const project = new Project();
    project.add_or_update_file('test.js', code);
    const defs = project.get_definitions('test.js');
    
    expect(defs.find(d => d.name === 'jsFunc')).toBeDefined();
    expect(defs.find(d => d.name === 'JsClass')).toBeDefined();
    expect(defs.find(d => d.name === 'jsMethod')).toBeDefined();
    expect(defs.find(d => d.name === 'arrowFunc')).toBeDefined();
    
    // Check symbol kinds
    expect(defs.find(d => d.name === 'jsFunc')?.symbol_kind).toBe('function');
    expect(defs.find(d => d.name === 'JsClass')?.symbol_kind).toBe('class');
    expect(defs.find(d => d.name === 'jsMethod')?.symbol_kind).toBe('method');
    expect(defs.find(d => d.name === 'arrowFunc')?.symbol_kind).toBe('constant');
  });

  test('should include enclosing ranges when available', () => {
    const code = `
      function funcWithBody() {
        const x = 1;
        const y = 2;
        return x + y;
      }
    `;
    
    const project = new Project();
    project.add_or_update_file('test.ts', code);
    const defs = project.get_definitions('test.ts');
    
    const func = defs.find(d => d.name === 'funcWithBody');
    expect(func).toBeDefined();
    // Enclosing range should exist if properly extracted
    if (func?.enclosing_range) {
      expect(func.enclosing_range.start.row).toBeLessThan(func.enclosing_range.end.row);
    }
  });

  test('should return empty array for non-existent file', () => {
    const project = new Project();
    const defs = project.get_definitions('non-existent.ts');
    expect(defs).toEqual([]);
  });

  test('should handle generator functions', () => {
    const code = `
      function* generator1() {
        yield 1;
      }
      
      async function* asyncGenerator() {
        yield 2;
      }
    `;
    
    const project = new Project();
    project.add_or_update_file('test.ts', code);
    const defs = project.get_definitions('test.ts');
    
    const generators = defs.filter(d => d.symbol_kind === 'generator');
    expect(generators.length).toBeGreaterThanOrEqual(1);
    expect(defs.find(d => d.name === 'generator1')).toBeDefined();
  });

  test('should handle TypeScript interfaces and types', () => {
    const code = `
      interface MyInterface {
        prop: string;
      }
      
      type MyType = {
        value: number;
      };
      
      function useTypes(x: MyInterface): MyType {
        return { value: 1 };
      }
    `;
    
    const project = new Project();
    project.add_or_update_file('test.ts', code);
    const defs = project.get_definitions('test.ts');
    
    // Should at least get the function
    expect(defs.find(d => d.name === 'useTypes')).toBeDefined();
  });
});

describe('get_definitions standalone function', () => {
  const tempFile = path.join(__dirname, 'temp-test-definitions.ts');
  
  afterEach(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  });
  
  test('should work as standalone function with file path', () => {
    const code = `
      export function standaloneFunc() {
        return 'test';
      }
      
      export class StandaloneClass {
        method() {
          return 'method';
        }
      }
    `;
    
    fs.writeFileSync(tempFile, code);
    const defs = get_definitions(tempFile);
    
    expect(defs.length).toBeGreaterThanOrEqual(2);
    expect(defs.find(d => d.name === 'standaloneFunc')).toBeDefined();
    expect(defs.find(d => d.name === 'StandaloneClass')).toBeDefined();
    
    // Check Def interface properties
    const funcDef = defs.find(d => d.name === 'standaloneFunc');
    expect(funcDef).toMatchObject({
      name: 'standaloneFunc',
      symbol_kind: 'function',
      file_path: tempFile,
      range: expect.objectContaining({
        start: expect.objectContaining({ row: expect.any(Number), column: expect.any(Number) }),
        end: expect.objectContaining({ row: expect.any(Number), column: expect.any(Number) })
      })
    });
  });
  
  test('should return empty array for non-existent file', () => {
    const defs = get_definitions('/non/existent/path.ts');
    expect(defs).toEqual([]);
  });
  
  test('should handle JavaScript files', () => {
    const jsFile = path.join(__dirname, 'temp-test-definitions.js');
    const code = `
      function jsStandaloneFunc() {
        return 'js';
      }
    `;
    
    fs.writeFileSync(jsFile, code);
    try {
      const defs = get_definitions(jsFile);
      expect(defs.find(d => d.name === 'jsStandaloneFunc')).toBeDefined();
    } finally {
      if (fs.existsSync(jsFile)) {
        fs.unlinkSync(jsFile);
      }
    }
  });
});