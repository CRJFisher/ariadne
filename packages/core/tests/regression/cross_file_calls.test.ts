import { Project } from '../../src/index';
import { describe, it, expect } from 'vitest';

describe('Cross-file function calls', () => {
  it('should track calls to imported functions', () => {
    const project = new Project();
    
    // Add library file with exported function
    project.add_or_update_file('lib.ts', `
export function libraryFunction() {
  console.log("Library function");
}

export function anotherFunction() {
  console.log("Another function");
}
    `);
    
    // Add main file that imports and calls the function
    project.add_or_update_file('main.ts', `
import { libraryFunction, anotherFunction } from './lib';

function mainFunction() {
  libraryFunction(); // Cross-file call
  anotherFunction(); // Another cross-file call
}

mainFunction();
    `);
    
    // Get the call graph
    const callGraph = project.get_call_graph({
      include_external: false
    });
    
    // Check that nodes exist
    const nodes = Array.from(callGraph.nodes.keys());
    expect(nodes).toContain('lib#libraryFunction');
    expect(nodes).toContain('lib#anotherFunction');
    expect(nodes).toContain('main#mainFunction');
    
    // Check that cross-file calls are tracked
    const edges = callGraph.edges;
    
    // Find the edge from mainFunction to libraryFunction
    const crossFileCall1 = edges.find(e => 
      e.from.includes('mainFunction') && e.to.includes('libraryFunction')
    );
    
    // Find the edge from mainFunction to anotherFunction
    const crossFileCall2 = edges.find(e => 
      e.from.includes('mainFunction') && e.to.includes('anotherFunction')
    );
    
    // Both cross-file calls should be tracked
    expect(crossFileCall1).toBeDefined();
    expect(crossFileCall2).toBeDefined();
    
    // Log for debugging
    if (!crossFileCall1 || !crossFileCall2) {
      console.log('Nodes:', nodes);
      console.log('Edges:', edges.map(e => `${e.from} -> ${e.to}`));
    }
  });
  
  it('should track calls to default exports', () => {
    const project = new Project();
    
    // Add library file with default export
    project.add_or_update_file('lib.ts', `
export default function defaultFunction() {
  console.log("Default function");
}
    `);
    
    // Add main file that imports and calls the default export
    project.add_or_update_file('main.ts', `
import defaultFunction from './lib';

function mainFunction() {
  defaultFunction(); // Cross-file call to default export
}

mainFunction();
    `);
    
    // Get the call graph
    const callGraph = project.get_call_graph({
      include_external: false
    });
    
    const edges = callGraph.edges;
    
    // Find the edge from mainFunction to defaultFunction
    const crossFileCall = edges.find(e => 
      e.from.includes('mainFunction') && e.to.includes('defaultFunction')
    );
    
    // Cross-file call to default export should be tracked
    expect(crossFileCall).toBeDefined();
  });
  
  it('should track calls with renamed imports', () => {
    const project = new Project();
    
    // Add library file
    project.add_or_update_file('lib.ts', `
export function originalName() {
  console.log("Original function");
}
    `);
    
    // Add main file with renamed import
    project.add_or_update_file('main.ts', `
import { originalName as renamedFunction } from './lib';

function mainFunction() {
  renamedFunction(); // Call with renamed import
}

mainFunction();
    `);
    
    // Get the call graph
    const callGraph = project.get_call_graph({
      include_external: false
    });
    
    const edges = callGraph.edges;
    
    // Find the edge from mainFunction to originalName
    const crossFileCall = edges.find(e => 
      e.from.includes('mainFunction') && e.to.includes('originalName')
    );
    
    // Renamed import call should be tracked
    expect(crossFileCall).toBeDefined();
  });
});