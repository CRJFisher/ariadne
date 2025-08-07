import { describe, it, expect } from 'vitest';
import { Project } from '../../src/index';

describe('Built-in calls in multi-file projects', () => {
  it('should preserve built-in calls when multiple files are loaded', () => {
    const project = new Project();
    
    // Add a file with built-in calls
    const code1 = `
function processData() {
  const arr = [];
  arr.push(1);
  arr.push(2);
  console.log(arr);
  JSON.stringify(arr);
}`;
    
    project.add_or_update_file('file1.ts', code1);
    
    // Get initial call graph
    let graph = project.get_call_graph({ include_external: false });
    let processData = Array.from(graph.nodes.values()).find(n => n.definition.name === 'processData');
    const initialBuiltinCalls = processData?.calls.filter(c => c.resolved_definition?.file_path === '<builtin>').length ?? 0;
    
    expect(initialBuiltinCalls).toBe(4); // push, push, log, stringify
    
    // Add more files to trigger potential AST reparsing issues
    for (let i = 2; i <= 30; i++) {
      const code = `
function file${i}Func() {
  const x = ${i};
  return x * 2;
}`;
      project.add_or_update_file(`file${i}.ts`, code);
    }
    
    // Get call graph after adding many files
    graph = project.get_call_graph({ include_external: false });
    processData = Array.from(graph.nodes.values()).find(n => n.definition.name === 'processData');
    const finalBuiltinCalls = processData?.calls.filter(c => c.resolved_definition?.file_path === '<builtin>').length ?? 0;
    
    // Built-in calls should be preserved
    expect(finalBuiltinCalls).toBe(4);
  });
  
  it('should handle object identity comparison failures in AST nodes', () => {
    const project = new Project();
    
    // Add code with built-in method calls
    const code = `
function processArray() {
  const items = [];
  items.push(1); // Built-in method call
  items.push(2);
  items.push(3);
  
  items.forEach(item => {
    console.log(item); // Built-in function call
  });
  
  return items;
}

function useBuiltins() {
  const data = { foo: 'bar' };
  const json = JSON.stringify(data);
  console.error('JSON:', json);
  return json;
}
`;
    
    project.add_or_update_file('builtins.ts', code);
    
    // Get initial analysis
    let graph = project.get_call_graph({ include_external: false });
    let processArray = Array.from(graph.nodes.values()).find(n => n.definition.name === 'processArray');
    let useBuiltins = Array.from(graph.nodes.values()).find(n => n.definition.name === 'useBuiltins');
    
    const initialProcessArrayBuiltins = processArray?.calls.filter(c => c.resolved_definition?.file_path === '<builtin>').length ?? 0;
    const initialUseBuiltinsBuiltins = useBuiltins?.calls.filter(c => c.resolved_definition?.file_path === '<builtin>').length ?? 0;
    
    expect(initialProcessArrayBuiltins).toBeGreaterThan(0);
    expect(initialUseBuiltinsBuiltins).toBeGreaterThan(0);
    
    // Add a large file that might trigger AST reparsing
    const largeCode = Array(50).fill(0).map((_, i) => `
function func${i}() {
  const x${i} = ${i};
  return x${i} * 2;
}
`).join('\n');
    
    project.add_or_update_file('large.ts', largeCode);
    
    // Verify built-in calls are still detected
    graph = project.get_call_graph({ include_external: false });
    processArray = Array.from(graph.nodes.values()).find(n => n.definition.name === 'processArray');
    useBuiltins = Array.from(graph.nodes.values()).find(n => n.definition.name === 'useBuiltins');
    
    const finalProcessArrayBuiltins = processArray?.calls.filter(c => c.resolved_definition?.file_path === '<builtin>').length ?? 0;
    const finalUseBuiltinsBuiltins = useBuiltins?.calls.filter(c => c.resolved_definition?.file_path === '<builtin>').length ?? 0;
    
    expect(finalProcessArrayBuiltins).toBe(initialProcessArrayBuiltins);
    expect(finalUseBuiltinsBuiltins).toBe(initialUseBuiltinsBuiltins);
  });
});