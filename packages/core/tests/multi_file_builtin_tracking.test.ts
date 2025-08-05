import { describe, it, expect } from 'vitest';
import { Project } from '../src/index';
import { CallGraphService } from '../src/project/call_graph_service';

describe('Multi-file Built-in Call Tracking', () => {
  it('debug find_definition_range', () => {
    const project = new Project();
    
    // Add test file
    const code = `
function test() {
  console.log("test");
  arr.push(4);
}`;
    
    project.add_or_update_file('file1.ts', code);
    
    // Get the definition and check its expanded range
    const state = (project as any).storage.getState();
    const service = new CallGraphService();
    const fileCache = state.file_cache.get('file1.ts');
    const fileGraph = state.file_graphs.get('file1.ts');
    
    if (fileCache && fileGraph) {
      const testDef = fileGraph.getNodes('definition').find(d => d.name === 'test');
      if (testDef) {
        console.log('Original def range:', testDef.range);
        
        // Manually call find_definition_range
        const { find_definition_range } = require('../src/call_graph/call_analysis');
        const expandedRange = find_definition_range(testDef, fileCache);
        console.log('Expanded range:', expandedRange);
        
        // Check if references fall within expanded range
        const refs = fileGraph.getNodes('reference');
        const refsInFunction = refs.filter(r => 
          r.range.start.row >= expandedRange.start.row &&
          r.range.start.row <= expandedRange.end.row
        );
        console.log('References in expanded range:', refsInFunction.length);
      }
    }
    
    // Now add another file and check again
    project.add_or_update_file('file2.ts', 'function other() {}');
    
    const state2 = (project as any).storage.getState();
    const fileCache2 = state2.file_cache.get('file1.ts');
    const fileGraph2 = state2.file_graphs.get('file1.ts');
    
    if (fileCache2 && fileGraph2) {
      const testDef2 = fileGraph2.getNodes('definition').find(d => d.name === 'test');
      if (testDef2) {
        console.log('\\nAfter adding file2:');
        console.log('Original def range:', testDef2.range);
        
        const { find_definition_range } = require('../src/call_graph/call_analysis');
        const expandedRange2 = find_definition_range(testDef2, fileCache2);
        console.log('Expanded range:', expandedRange2);
      }
    }
  });
  
  it('test with module-level code and imports', () => {
    const project = new Project();
    
    // File with module-level code like benchmark-incremental.ts
    const benchmarkLike = `
import { Project } from './index';

console.log('Starting benchmark');

function generateLargeFile(count: number): string {
  const lines: string[] = [];
  lines.push('test');
  return lines.join('\\n');
}

// Module-level code
const project = new Project();
const result = generateLargeFile(10);
console.log(result);
`;
    
    project.add_or_update_file('src/benchmark.ts', benchmarkLike);
    let callGraph = project.get_call_graph({ include_external: false });
    let funcNode = Array.from(callGraph.nodes.values()).find(n => 
      n.definition.name === 'generateLargeFile' && n.definition.file_path === 'src/benchmark.ts'
    );
    console.log('Before adding index.ts - generateLargeFile calls:', funcNode?.calls.length);
    
    // Now add the imported file
    project.add_or_update_file('src/index.ts', 'export class Project { constructor() {} }');
    
    callGraph = project.get_call_graph({ include_external: false });
    funcNode = Array.from(callGraph.nodes.values()).find(n => 
      n.definition.name === 'generateLargeFile' && n.definition.file_path === 'src/benchmark.ts'
    );
    console.log('After adding index.ts - generateLargeFile calls:', funcNode?.calls.length);
    console.log('Calls:', funcNode?.calls.map(c => c.symbol));
    
    // Check module-level calls
    const moduleNode = Array.from(callGraph.nodes.values()).find(n => 
      n.definition.name === '<module>' && n.definition.file_path === 'src/benchmark.ts'
    );
    console.log('Module-level calls:', moduleNode?.calls.length ?? 0);
    
    expect(funcNode).toBeDefined();
    expect(funcNode!.calls.length).toBe(2); // push and join
  });
  
  it('test complex function like generateLargeFile', () => {
    const project = new Project();
    
    // Simplified version of generateLargeFile
    const file1 = `
function generateLargeFile(functionCount: number): string {
  const lines: string[] = [];
  
  // Add imports
  lines.push(\`import { Something } from './module';\`);
  lines.push('');
  
  // Add interfaces
  for (let i = 0; i < 10; i++) {
    lines.push(\`interface Interface\${i} {\`);
    lines.push(\`  prop\${i}: string;\`);
    lines.push(\`}\`);
    lines.push('');
  }
  
  return lines.join('\\n');
}`;
    
    project.add_or_update_file('src/test.ts', file1);
    let callGraph = project.get_call_graph({ include_external: false });
    let funcNode = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
    console.log('Before adding other files - calls:', funcNode?.calls.length);
    console.log('Calls:', funcNode?.calls.map(c => c.symbol));
    
    // Add other files
    project.add_or_update_file('src/index.ts', 'export class Project {}');
    project.add_or_update_file('src/graph.ts', 'export class Graph {}');
    
    callGraph = project.get_call_graph({ include_external: false });
    funcNode = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
    console.log('After adding other files - calls:', funcNode?.calls.length);
    console.log('Calls:', funcNode?.calls.map(c => c.symbol));
    
    expect(funcNode).toBeDefined();
    expect(funcNode!.calls.length).toBeGreaterThan(0);
  });
  
  it('test file update vs add', () => {
    const project = new Project();
    
    // Add initial file
    project.add_or_update_file('test.ts', `
function test() {
  console.log("v1");
}`);
    
    let callGraph = project.get_call_graph({ include_external: false });
    let testNode = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'test');
    console.log('Initial version - calls:', testNode?.calls.length);
    
    // Update the same file
    project.add_or_update_file('test.ts', `
function test() {
  console.log("v2");
  const arr = [1, 2, 3];
  arr.push(4);
}`);
    
    callGraph = project.get_call_graph({ include_external: false });
    testNode = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'test');
    console.log('After update - calls:', testNode?.calls.length);
    console.log('Call symbols:', testNode?.calls.map(c => c.symbol));
    
    // Add another file  
    project.add_or_update_file('other.ts', 'function other() {}');
    
    callGraph = project.get_call_graph({ include_external: false });
    testNode = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'test' && n.definition.file_path === 'test.ts');
    console.log('After adding other file - calls:', testNode?.calls.length);
    
    expect(testNode!.calls.length).toBe(2);
  });
  
  it('isolate import resolution issue', () => {
    const project = new Project();
    
    // Test with import that resolves
    const file1 = `
import { Project } from './index';

function test() {
  console.log("test");
  const arr = [1, 2, 3];
  arr.push(4);
}`;
    
    // First without index.ts
    project.add_or_update_file('src/file1.ts', file1);
    let callGraph = project.get_call_graph({ include_external: false });
    let testNode = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'test');
    console.log('Without index.ts - test() calls:', testNode?.calls.length ?? 0);
    
    // Now add index.ts
    project.add_or_update_file('src/index.ts', 'export class Project {}');
    callGraph = project.get_call_graph({ include_external: false });
    testNode = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'test');
    console.log('With index.ts - test() calls:', testNode?.calls.length ?? 0);
    console.log('Call symbols:', testNode?.calls.map(c => c.symbol) ?? []);
    
    // Check the internal state
    const state = (project as any).storage.getState();
    const fileGraph = state.file_graphs.get('src/file1.ts');
    if (fileGraph) {
      const refs = fileGraph.getNodes('reference');
      console.log('Total references in file1.ts:', refs.length);
      console.log('References:', refs.map(r => ({ name: r.name, kind: r.symbol_kind })));
    }
    
    expect(testNode).toBeDefined();
    expect(testNode!.calls.length).toBe(2); // console.log and push
  });
  
  it('debug extractCallGraph issue', () => {
    const project = new Project();
    
    // Simple test case
    const file1 = `
function test1() {
  console.log("test1");
  const arr = [1, 2, 3];
  arr.push(4);
}`;
    
    const file2 = `
function test2() {
  console.log("test2");
}`;
    
    // First add just file1
    project.add_or_update_file('file1.ts', file1);
    
    // Get internal state to debug
    const state1 = (project as any).storage.getState();
    const service = new CallGraphService();
    
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => {
      return (project as any).navigationService.goToDefinition(state1, filePath, position);
    };
    
    const getImportsWithDefinitions = (filePath: string) => {
      return (project as any).navigationService.getImportsWithDefinitions(state1, filePath);
    };
    
    const getAllFunctions = () => {
      return (project as any).navigationService.getAllFunctionsFlat(state1);
    };
    
    // Extract call graph for single file
    const result1 = service.extractCallGraph(state1, goToDefinition, getImportsWithDefinitions, getAllFunctions);
    console.log('Single file - functions:', result1.functions.length);
    console.log('Single file - calls:', result1.calls.length);
    console.log('Single file - call details:', result1.calls.map(c => ({
      from: c.caller_def.name,
      to: c.called_def.name,
      builtin: c.called_def.symbol_id.startsWith('<builtin>')
    })));
    
    // Now add file2
    project.add_or_update_file('file2.ts', file2);
    
    const state2 = (project as any).storage.getState();
    
    // Need to recreate functions with new state
    const goToDefinition2 = (filePath: string, position: { row: number; column: number }) => {
      return (project as any).navigationService.goToDefinition(state2, filePath, position);
    };
    
    const getImportsWithDefinitions2 = (filePath: string) => {
      return (project as any).navigationService.getImportsWithDefinitions(state2, filePath);
    };
    
    const getAllFunctions2 = () => {
      return (project as any).navigationService.getAllFunctionsFlat(state2);
    };
    
    const result2 = service.extractCallGraph(state2, goToDefinition2, getImportsWithDefinitions2, getAllFunctions2);
    console.log('\\nTwo files - functions:', result2.functions.length);
    console.log('Two files - calls:', result2.calls.length);
    console.log('Two files - call details:', result2.calls.map(c => ({
      from: c.caller_def.name,
      to: c.called_def.name,
      builtin: c.called_def.symbol_id.startsWith('<builtin>')
    })));
    
    // Check if test1's calls are preserved
    const test1Calls = result2.calls.filter(c => c.caller_def.name === 'test1');
    console.log('\\ntest1 calls after adding file2:', test1Calls.length);
    
    expect(test1Calls.length).toBe(2); // Should still have console.log and push
  });
  
  it('should track built-in calls in benchmark-incremental.ts', () => {
    const project = new Project();
    
    // Add the actual benchmark file content
    const benchmarkFile = `#!/usr/bin/env node

import { Project } from './index';

console.log('Ariadne Incremental Parsing Benchmark\\n');

// Create a large TypeScript file for benchmarking
function generateLargeFile(functionCount: number): string {
  const lines: string[] = [];
  
  // Add imports
  lines.push(\`import { Something } from './module';\`);
  lines.push('');
  
  // Add interfaces
  for (let i = 0; i < 10; i++) {
    lines.push(\`interface Interface\${i} {\`);
    lines.push(\`  prop\${i}: string;\`);
    lines.push(\`  method\${i}(): void;\`);
    lines.push(\`}\`);
    lines.push('');
  }
  
  // Add functions
  for (let i = 0; i < functionCount; i++) {
    lines.push(\`function function_\${i}(param\${i}: number): number {\`);
    lines.push(\`  const result = param\${i} * 2;\`);
    lines.push(\`  return result + \${i};\`);
    lines.push(\`}\`);
    lines.push('');
  }
  
  // Add a class
  lines.push('class LargeClass {');
  for (let i = 0; i < 20; i++) {
    lines.push(\`  method\${i}() {\`);
    lines.push(\`    return function_\${i % functionCount}(\${i});\`);
    lines.push(\`  }\`);
    lines.push('');
  }
  lines.push('}');
  
  return lines.join('\\n');
}

// Benchmark function
function benchmark(name: string, fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / 1000000; // Convert to milliseconds
}`;

    // Add just the benchmark file first
    project.add_or_update_file('src/benchmark-incremental.ts', benchmarkFile);
    
    let callGraph = project.get_call_graph();
    const generateLargeFileSingle = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
    
    expect(generateLargeFileSingle).toBeDefined();
    const singleFileCalls = generateLargeFileSingle!.calls.length;
    console.log('Single file - generateLargeFile calls:', singleFileCalls);
    console.log('Single file - calls:', generateLargeFileSingle!.calls.map(c => c.symbol));
    
    // Now add more files like in the validation
    project.add_or_update_file('src/graph.ts', 'export class Graph {}');
    project.add_or_update_file('src/index.ts', 'export class Project {}');
    
    callGraph = project.get_call_graph();
    const generateLargeFileMulti = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
    
    expect(generateLargeFileMulti).toBeDefined();
    const multiFileCalls = generateLargeFileMulti!.calls.length;
    console.log('Multi file - generateLargeFile calls:', multiFileCalls);
    console.log('Multi file - calls:', generateLargeFileMulti!.calls.map(c => c.symbol));
    
    // Calls should be the same
    expect(multiFileCalls).toBe(singleFileCalls);
    expect(singleFileCalls).toBeGreaterThan(0); // Should have push and join calls at minimum
  });
  
  it('should track built-in calls with get_call_graph options', () => {
    const project = new Project();
    
    // Simple test with include_external: false (like validation uses)
    project.add_or_update_file('test.ts', `
      function test() {
        console.log("test");
        const arr = [1, 2, 3];
        arr.push(4);
      }
    `);
    
    const callGraph = project.get_call_graph({ include_external: false });
    const testFunc = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'test');
    
    expect(testFunc).toBeDefined();
    console.log('With include_external: false - calls:', testFunc!.calls.length);
    console.log('Calls:', testFunc!.calls.map(c => c.symbol));
    expect(testFunc!.calls.length).toBe(2); // console.log and push
  });
  
  it('debug build_call_graph_for_display', () => {
    const project = new Project();
    
    // Add files
    project.add_or_update_file('file1.ts', `
function test1() {
  console.log("test1");
  arr.push(4);
}`);
    project.add_or_update_file('file2.ts', `
function test2() {
  console.log("test2");
}`);
    
    // Get the raw extraction result first
    const state = (project as any).storage.getState();
    const service = new CallGraphService();
    
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => {
      return (project as any).navigationService.goToDefinition(state, filePath, position);
    };
    
    const getImportsWithDefinitions = (filePath: string) => {
      return (project as any).navigationService.getImportsWithDefinitions(state, filePath);
    };
    
    const getAllFunctions = () => {
      return (project as any).navigationService.getAllFunctionsFlat(state);
    };
    
    const extracted = service.extractCallGraph(state, goToDefinition, getImportsWithDefinitions, getAllFunctions);
    console.log('Extracted calls:', extracted.calls.length);
    console.log('Built-in calls:', extracted.calls.filter(c => c.called_def.symbol_id.startsWith('<builtin>')).length);
    
    // Now get the display graph
    const callGraph = project.get_call_graph({ include_external: false });
    console.log('Display graph nodes:', callGraph.nodes.size);
    
    let totalBuiltinCalls = 0;
    for (const node of callGraph.nodes.values()) {
      const builtinCalls = node.calls.filter(c => c.symbol.startsWith('<builtin>'));
      if (builtinCalls.length > 0) {
        console.log(`${node.definition.name} has ${builtinCalls.length} built-in calls:`, builtinCalls.map(c => c.symbol));
      }
      totalBuiltinCalls += builtinCalls.length;
    }
    console.log('Total built-in calls in display graph:', totalBuiltinCalls);
    
    expect(totalBuiltinCalls).toBe(3); // test1: log, push; test2: log
  });
  
  it('should match validation scenario exactly', () => {
    const project = new Project();
    
    // Add files exactly as validation does
    const benchmarkFile = require('fs').readFileSync('/Users/chuck/workspace/ariadne/packages/core/src/benchmark-incremental.ts', 'utf8');
    const graphFile = require('fs').readFileSync('/Users/chuck/workspace/ariadne/packages/core/src/graph.ts', 'utf8');
    const indexFile = require('fs').readFileSync('/Users/chuck/workspace/ariadne/packages/core/src/index.ts', 'utf8');
    
    // First test with just benchmark file
    project.add_or_update_file('src/benchmark-incremental.ts', benchmarkFile);
    let callGraph = project.get_call_graph({ include_external: false });
    let generateLargeFile = Array.from(callGraph.nodes.values()).find(n => 
      n.definition.name === 'generateLargeFile' && n.definition.file_path === 'src/benchmark-incremental.ts'
    );
    console.log('After adding only benchmark - generateLargeFile calls:', generateLargeFile?.calls.length ?? 0);
    
    // Now add the other files
    project.add_or_update_file('src/graph.ts', graphFile);
    project.add_or_update_file('src/index.ts', indexFile);
    
    callGraph = project.get_call_graph({ include_external: false });
    generateLargeFile = Array.from(callGraph.nodes.values()).find(n => 
      n.definition.name === 'generateLargeFile' && n.definition.file_path === 'src/benchmark-incremental.ts'
    );
    
    console.log('After adding all files - generateLargeFile calls:', generateLargeFile?.calls.length ?? 0);
    if (generateLargeFile) {
      console.log('Call symbols:', generateLargeFile.calls.map(c => c.symbol));
    }
    
    // Check all nodes
    const nodesWithCalls = Array.from(callGraph.nodes.values()).filter(n => n.calls.length > 0);
    console.log('Total nodes with calls:', nodesWithCalls.length, 'out of', callGraph.nodes.size);
    console.log('Percentage:', ((nodesWithCalls.length / callGraph.nodes.size) * 100).toFixed(1) + '%');
    
    // Check the raw extraction too
    const stateForExtraction = (project as any).storage.getState();
    const service = new CallGraphService();
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => {
      return (project as any).navigationService.goToDefinition(stateForExtraction, filePath, position);
    };
    const getImportsWithDefinitions = (filePath: string) => {
      return (project as any).navigationService.getImportsWithDefinitions(stateForExtraction, filePath);
    };
    const getAllFunctions = () => {
      return (project as any).navigationService.getAllFunctionsFlat(stateForExtraction);
    };
    
    const extracted = service.extractCallGraph(stateForExtraction, goToDefinition, getImportsWithDefinitions, getAllFunctions);
    const generateLargeCalls = extracted.calls.filter(c => c.caller_def.name === 'generateLargeFile');
    console.log('\\nRaw extraction - generateLargeFile calls:', generateLargeCalls.length);
    if (generateLargeCalls.length > 0) {
      console.log('Call targets:', generateLargeCalls.map(c => c.called_def.name));
    }
    
    // Debug: check internal state
    const state = (project as any).storage.getState();
    const benchmarkGraph = state.file_graphs.get('src/benchmark-incremental.ts');
    if (benchmarkGraph) {
      const refs = benchmarkGraph.getNodes('reference');
      const generateLargeDef = benchmarkGraph.getNodes('definition').find(d => d.name === 'generateLargeFile');
      if (generateLargeDef) {
        console.log('generateLargeFile definition:', {
          range: generateLargeDef.range,
          enclosing_range: (generateLargeDef as any).enclosing_range
        });
        
        // Test find_definition_range
        const fileCache = state.file_cache.get('src/benchmark-incremental.ts');
        if (fileCache) {
          // Since find_definition_range is not exported, let's use enclosing_range
          const expandedRange = (generateLargeDef as any).enclosing_range || generateLargeDef.range;
          console.log('Using enclosing_range:', expandedRange);
          
          // Count refs in the expanded range
          const refsInExpandedRange = refs.filter(r => 
            r.range.start.row >= expandedRange.start.row &&
            r.range.start.row <= expandedRange.end.row
          );
          console.log('References in expanded range:', refsInExpandedRange.length);
          console.log('First few refs in range:', refsInExpandedRange.slice(0, 5).map(r => ({
            name: r.name,
            row: r.range.start.row
          })));
        }
      }
    }
    
    expect(generateLargeFile).toBeDefined();
    expect(generateLargeFile!.calls.length).toBeGreaterThan(0);
  });
  
  it('should track built-in calls consistently across multiple files', () => {
    const project = new Project();
    
    // Add first file
    const file1 = `
export function func1() {
  console.log("Hello from func1");
  const arr = [1, 2, 3];
  arr.push(4);
  return arr;
}`;
    
    // Add second file
    const file2 = `
export function func2() {
  console.log("Hello from func2");
  const obj = { a: 1 };
  Object.keys(obj);
  return obj;
}`;
    
    // Add files
    project.add_or_update_file('file1.ts', file1);
    project.add_or_update_file('file2.ts', file2);
    
    // Get call graph
    const callGraph = project.get_call_graph();
    
    // Find the functions
    const func1 = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'func1');
    const func2 = Array.from(callGraph.nodes.values()).find(n => n.definition.name === 'func2');
    
    expect(func1).toBeDefined();
    expect(func2).toBeDefined();
    
    // Both should have built-in calls
    expect(func1!.calls.length).toBe(2); // console.log and push
    expect(func2!.calls.length).toBe(2); // console.log and keys
    
    // Check specific calls
    const func1Calls = func1!.calls.map(c => c.symbol);
    expect(func1Calls).toContain('<builtin>#log');
    expect(func1Calls).toContain('<builtin>#push');
    
    const func2Calls = func2!.calls.map(c => c.symbol);
    expect(func2Calls).toContain('<builtin>#log');
    expect(func2Calls).toContain('<builtin>#keys');
  });
  
  it('should not lose calls when adding more files', () => {
    const project = new Project();
    
    // Add first file and check
    project.add_or_update_file('test1.ts', 'function f1() { console.log("1"); }');
    let graph = project.get_call_graph();
    let f1 = Array.from(graph.nodes.values()).find(n => n.definition.name === 'f1');
    expect(f1!.calls.length).toBe(1);
    
    // Add second file and check both
    project.add_or_update_file('test2.ts', 'function f2() { console.log("2"); }');
    graph = project.get_call_graph();
    f1 = Array.from(graph.nodes.values()).find(n => n.definition.name === 'f1');
    const f2 = Array.from(graph.nodes.values()).find(n => n.definition.name === 'f2');
    
    // f1 should still have its call
    expect(f1!.calls.length).toBe(1);
    expect(f2!.calls.length).toBe(1);
    
    // Add third file and check all
    project.add_or_update_file('test3.ts', 'function f3() { JSON.stringify({}); }');
    graph = project.get_call_graph();
    f1 = Array.from(graph.nodes.values()).find(n => n.definition.name === 'f1');
    const f3 = Array.from(graph.nodes.values()).find(n => n.definition.name === 'f3');
    
    // All should maintain their calls
    expect(f1!.calls.length).toBe(1);
    expect(f3!.calls.length).toBe(1);
  });
  
  it('should track the same percentage of nodes with calls regardless of file count', () => {
    // Single file project
    const project1 = new Project();
    project1.add_or_update_file('single.ts', `
      function hasCall() { console.log("test"); }
      function noCall() { return 42; }
    `);
    const graph1 = project1.get_call_graph();
    const nodesWithCalls1 = Array.from(graph1.nodes.values()).filter(n => n.calls.length > 0);
    const percentage1 = (nodesWithCalls1.length / graph1.nodes.size) * 100;
    
    // Multi-file project with same functions
    const project2 = new Project();
    project2.add_or_update_file('file1.ts', 'function hasCall() { console.log("test"); }');
    project2.add_or_update_file('file2.ts', 'function noCall() { return 42; }');
    const graph2 = project2.get_call_graph();
    const nodesWithCalls2 = Array.from(graph2.nodes.values()).filter(n => n.calls.length > 0);
    const percentage2 = (nodesWithCalls2.length / graph2.nodes.size) * 100;
    
    // Percentages should be the same
    expect(percentage1).toBe(percentage2);
    expect(percentage1).toBe(50); // 1 out of 2 functions has calls
  });
});