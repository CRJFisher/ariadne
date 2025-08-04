import { test } from 'vitest';
import { Project } from '../src/index';

test('detects method calls on built-in types', () => {
  const project = new Project();
  
  const code = `
function testArrayMethods() {
  const arr = [];
  arr.push(1);
  arr.pop();
  arr.shift();
  arr.unshift(0);
  arr.join(',');
  arr.filter(x => x > 0);
  arr.map(x => x * 2);
  arr.reduce((a, b) => a + b);
  return arr;
}

function testMapMethods() {
  const map = new Map();
  map.set('key', 'value');
  map.get('key');
  map.has('key');
  map.delete('key');
  map.clear();
  return map;
}

function testSetMethods() {
  const set = new Set();
  set.add(1);
  set.has(1);
  set.delete(1);
  set.clear();
  return set;
}

function testStringMethods() {
  const str = "hello";
  str.toUpperCase();
  str.toLowerCase();
  str.split(',');
  str.trim();
  str.substring(0, 2);
  return str;
}

function testObjectMethods() {
  const obj = { a: 1 };
  Object.keys(obj);
  Object.values(obj);
  Object.entries(obj);
  return obj;
}
  `;
  
  project.add_or_update_file('test.ts', code);
  const callGraph = project.get_call_graph({ include_external: false });
  
  // Get each function node
  const arrayFunc = callGraph.nodes.get('test.ts#testArrayMethods');
  const mapFunc = callGraph.nodes.get('test.ts#testMapMethods');
  const setFunc = callGraph.nodes.get('test.ts#testSetMethods');
  const stringFunc = callGraph.nodes.get('test.ts#testStringMethods');
  const objectFunc = callGraph.nodes.get('test.ts#testObjectMethods');
  
  // Check that method calls are detected
  expect(arrayFunc?.calls.length).toBeGreaterThan(0);
  expect(arrayFunc?.calls.some(c => c.name.includes('push'))).toBe(true);
  expect(arrayFunc?.calls.some(c => c.name.includes('pop'))).toBe(true);
  expect(arrayFunc?.calls.some(c => c.name.includes('filter'))).toBe(true);
  
  expect(mapFunc?.calls.length).toBeGreaterThan(0);
  expect(mapFunc?.calls.some(c => c.name.includes('set'))).toBe(true);
  expect(mapFunc?.calls.some(c => c.name.includes('get'))).toBe(true);
  
  expect(setFunc?.calls.length).toBeGreaterThan(0);
  expect(setFunc?.calls.some(c => c.name.includes('add'))).toBe(true);
  expect(setFunc?.calls.some(c => c.name.includes('has'))).toBe(true);
  
  expect(stringFunc?.calls.length).toBeGreaterThan(0);
  expect(stringFunc?.calls.some(c => c.name.includes('toUpperCase'))).toBe(true);
  expect(stringFunc?.calls.some(c => c.name.includes('split'))).toBe(true);
  
  expect(objectFunc?.calls.length).toBeGreaterThan(0);
  expect(objectFunc?.calls.some(c => c.name.includes('keys'))).toBe(true);
});

test('counts nodes with calls accurately', () => {
  const project = new Project();
  
  const code = `
// Function with no calls
function noCallsFunc() {
  const x = 1 + 2;
  return x;
}

// Function with method calls
function methodCallsFunc() {
  const arr = [1, 2, 3];
  return arr.map(x => x * 2).filter(x => x > 2);
}

// Function with direct function calls
function directCallsFunc() {
  noCallsFunc();
  methodCallsFunc();
  return true;
}
  `;
  
  project.add_or_update_file('test.ts', code);
  const callGraph = project.get_call_graph({ include_external: false });
  
  // Count nodes with outgoing calls
  let nodesWithCalls = 0;
  for (const node of callGraph.nodes.values()) {
    if (node.calls.length > 0) {
      nodesWithCalls++;
    }
  }
  
  const totalNodes = callGraph.nodes.size;
  const percentageWithCalls = (nodesWithCalls / totalNodes) * 100;
  
  // With proper method call detection, at least 2 out of 3 functions should have calls
  expect(percentageWithCalls).toBeGreaterThanOrEqual(66);
});

test('tracks incoming calls from large files', () => {
  const project = new Project();
  
  // Create a utility file
  const utilCode = `
export function utilityFunc() {
  return "utility";
}

export function helperFunc() {
  return "helper";
}
  `;
  
  // Create a large file that calls these utilities
  // Generate content that exceeds 32KB
  let largeFileContent = `
import { utilityFunc, helperFunc } from './util';

function mainFunction() {
  utilityFunc();
  helperFunc();
}
`;
  
  // Pad the file to exceed 32KB
  const padding = '// ' + 'x'.repeat(500) + '\n';
  while (largeFileContent.length < 33 * 1024) {
    largeFileContent += padding;
  }
  
  project.add_or_update_file('util.ts', utilCode);
  project.add_or_update_file('large.ts', largeFileContent);
  
  const callGraph = project.get_call_graph({ include_external: false });
  
  // Check that utility functions are marked as being called
  const utilityNode = callGraph.nodes.get('util.ts#utilityFunc');
  const helperNode = callGraph.nodes.get('util.ts#helperFunc');
  
  // These should have incoming calls from the large file
  const utilityIncoming = callGraph.edges.filter(e => e.to === 'util.ts#utilityFunc');
  const helperIncoming = callGraph.edges.filter(e => e.to === 'util.ts#helperFunc');
  
  expect(utilityIncoming.length).toBeGreaterThan(0);
  expect(helperIncoming.length).toBeGreaterThan(0);
  
  // Verify nodes are not incorrectly marked as top-level
  expect(callGraph.top_level_nodes.includes('util.ts#utilityFunc')).toBe(false);
  expect(callGraph.top_level_nodes.includes('util.ts#helperFunc')).toBe(false);
});