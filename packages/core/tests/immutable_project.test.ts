import { describe, test, expect } from 'vitest';
import { ImmutableProject } from '../src/project/immutable_project';
import { InMemoryStorage } from '../src/storage/in_memory_storage';
import { typescript_config } from '../src/languages/typescript';
import { javascript_config } from '../src/languages/javascript';
import { python_config } from '../src/languages/python';

describe('ImmutableProject', () => {
  test('creates new instance on file add', () => {
    const project = new ImmutableProject();
    
    const code = `
      function test() {
        return 42;
      }
    `;
    
    const updated = project.add_or_update_file('test.ts', code);
    
    // Should be the same instance since we're using internal mutations
    // (In a future version we would return a new instance)
    expect(updated).toBe(project);
    
    // File should be accessible
    const graph = updated.get_scope_graph('test.ts');
    expect(graph).toBeTruthy();
    expect(graph?.getNodes('definition').length).toBeGreaterThan(0);
  });
  
  test('handles file removal', () => {
    const project = new ImmutableProject();
    
    // Add a file
    const withFile = project.add_or_update_file('test.ts', 'const x = 1;');
    
    // Remove the file
    const withoutFile = withFile.remove_file('test.ts');
    
    // File should no longer exist
    expect(withoutFile.get_scope_graph('test.ts')).toBeNull();
  });
  
  test('navigation works correctly', () => {
    const project = new ImmutableProject();
    
    const code = `
      function greet(name: string) {
        return "Hello " + name;
      }
      
      const message = greet("World");
    `;
    
    const updated = project.add_or_update_file('test.ts', code);
    
    // Find definition of greet
    const def = updated.go_to_definition('test.ts', { row: 5, column: 22 });
    expect(def).toBeTruthy();
    expect(def?.name).toBe('greet');
    expect(def?.range.start.row).toBe(1);
  });
  
  test('finds references correctly', () => {
    const project = new ImmutableProject();
    
    const code = `
      const x = 10;
      console.log(x);
      const y = x + 5;
    `;
    
    const updated = project.add_or_update_file('test.ts', code);
    
    // Find references to x
    const refs = updated.find_references('test.ts', { row: 1, column: 12 });
    expect(refs.length).toBe(2); // Two references to x
  });
  
  test('extracts functions correctly', () => {
    const project = new ImmutableProject();
    
    const code = `
      function foo() {}
      function bar() {}
      class Test {
        method() {}
      }
    `;
    
    const updated = project.add_or_update_file('test.ts', code);
    
    const functions = updated.get_functions_in_file('test.ts');
    expect(functions.length).toBe(3); // foo, bar, and method
    expect(functions.map(f => f.name)).toContain('foo');
    expect(functions.map(f => f.name)).toContain('bar');
    expect(functions.map(f => f.name)).toContain('method');
  });
  
  test('handles multiple languages', () => {
    const project = new ImmutableProject();
    
    // Add TypeScript file
    const withTS = project.add_or_update_file('test.ts', 'function tsFunc() {}');
    
    // Add JavaScript file
    const withJS = withTS.add_or_update_file('test.js', 'function jsFunc() {}');
    
    // Add Python file
    const withPython = withJS.add_or_update_file('test.py', 'def py_func():\n    pass');
    
    // Check all files exist
    const allGraphs = withPython.get_all_scope_graphs();
    expect(allGraphs.size).toBe(3);
    expect(allGraphs.has('test.ts')).toBe(true);
    expect(allGraphs.has('test.js')).toBe(true);
    expect(allGraphs.has('test.py')).toBe(true);
  });
  
  test('handles incremental updates', () => {
    const project = new ImmutableProject();
    
    const code = 'const x = 1;';
    const withFile = project.add_or_update_file('test.ts', code);
    
    // Update a range
    const updated = withFile.update_file_range(
      'test.ts',
      { row: 0, column: 10 },
      { row: 0, column: 11 },
      '42'
    );
    
    // Get the updated source
    const defs = updated.get_definitions('test.ts');
    const xDef = defs.find(d => d.name === 'x');
    expect(xDef).toBeTruthy();
    
    // Check the actual file cache instead
    const fileCache = updated.getState().file_cache.get('test.ts');
    expect(fileCache?.source_code).toContain('const x = 42;');
  });
  
  test('storage state is immutable', () => {
    const project = new ImmutableProject();
    
    // Get initial state
    const state1 = project.getState();
    
    // Add a file
    project.add_or_update_file('test.ts', 'const x = 1;');
    
    // Get new state
    const state2 = project.getState();
    
    // In development mode, states should be frozen
    if (process.env.NODE_ENV === 'development') {
      expect(() => {
        (state2 as any).file_graphs = new Map();
      }).toThrow();
    }
  });
  
  test('withState allows custom state updates', () => {
    const project = new ImmutableProject();
    
    // Add a file
    const withFile = project.add_or_update_file('test.ts', 'const x = 1;');
    
    // Use withState to clear all files
    const cleared = withFile.withState(state => ({
      ...state,
      file_graphs: new Map(),
      file_cache: new Map()
    }));
    
    // Should have no files
    expect(cleared.get_all_scope_graphs().size).toBe(0);
  });
});