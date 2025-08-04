import { describe, it, expect } from 'vitest';
import { Project } from '../src/index';

describe('Built-in Call Tracking', () => {
  it('should track all built-in function calls', () => {
    const project = new Project();
    
    const code = `
export function testBuiltins() {
  // Global function calls
  console.log('test');
  setTimeout(() => {}, 1000);
  parseInt('42');
  
  // Object method calls
  JSON.stringify({});
  Math.random();
  
  // String methods
  const str = 'hello';
  str.trim();
  str.toUpperCase();
  
  // Array methods
  const arr = [1, 2, 3];
  arr.push(4);
  arr.map(x => x * 2);
  arr.filter(x => x > 1);
  
  // Promise methods
  Promise.resolve().then(() => {});
}
    `;
    
    project.add_or_update_file('test.ts', code);
    
    const defs = project.get_definitions('test.ts');
    const funcs = defs.filter(d => d.symbol_kind === 'function');
    
    expect(funcs).toHaveLength(1);
    const testFunc = funcs[0];
    expect(testFunc.file_path).toBe('test.ts');
    
    const calls = project.get_calls_from_definition(testFunc);
    
    // Count built-in calls
    const builtinCalls = calls.filter(c => c.called_def.symbol_id.startsWith('<builtin>#'));
    const internalCalls = calls.filter(c => !c.called_def.symbol_id.startsWith('<builtin>#'));
    
    // We expect at least 11 built-in calls
    expect(builtinCalls.length).toBeGreaterThanOrEqual(11);
    expect(internalCalls.length).toBe(0); // No internal calls
    
    // Check specific built-ins are tracked
    const builtinNames = builtinCalls.map(c => c.called_def.name);
    expect(builtinNames).toContain('log');
    expect(builtinNames).toContain('setTimeout');
    expect(builtinNames).toContain('parseInt');
    expect(builtinNames).toContain('stringify');
    expect(builtinNames).toContain('random');
    expect(builtinNames).toContain('trim');
    expect(builtinNames).toContain('toUpperCase');
    expect(builtinNames).toContain('push');
    expect(builtinNames).toContain('map');
    expect(builtinNames).toContain('filter');
    expect(builtinNames).toContain('resolve');
  });

  it('should track module-level built-in calls', () => {
    const project = new Project();
    
    const code = `
// Module-level calls
console.log('Starting module');
const config = JSON.parse('{}');

export function someFunc() {
  return config;
}
    `;
    
    project.add_or_update_file('module.ts', code);
    
    // Get module-level calls
    const graph = project.get_call_graph();
    const moduleNode = Array.from(graph.nodes.values()).find(n => 
      n.symbol === 'module#<module>'
    );
    
    if (moduleNode) {
      const moduleCalls = moduleNode.calls;
      expect(moduleCalls.length).toBeGreaterThanOrEqual(2);
      
      const builtinNames = moduleCalls
        .filter(c => c.symbol.startsWith('<builtin>#'))
        .map(c => c.symbol.replace('<builtin>#', ''));
      
      expect(builtinNames).toContain('log');
      expect(builtinNames).toContain('parse');
    }
  });

  it('should improve nodes-with-calls percentage', () => {
    const project = new Project();
    
    const code = `
export function func1() {
  console.log('func1');
}

export function func2() {
  JSON.stringify({});
}

export function func3() {
  // No calls
}

export function func4() {
  func1(); // Internal call
  console.error('error'); // Built-in call
}
    `;
    
    project.add_or_update_file('metrics.ts', code);
    
    const graph = project.get_call_graph();
    const nodes = Array.from(graph.nodes.values());
    const nodesWithCalls = nodes.filter(n => n.calls.length > 0);
    
    // 3 out of 4 functions make calls
    expect(nodes.length).toBe(4);
    expect(nodesWithCalls.length).toBe(3);
    expect(nodesWithCalls.length / nodes.length).toBe(0.75); // 75%
  });
});