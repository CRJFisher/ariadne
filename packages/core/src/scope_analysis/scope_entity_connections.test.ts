/**
 * Tests for scope-entity connections
 * 
 * Verifies that entities are properly connected to their scopes
 * and that visibility checking works correctly.
 */

import { describe, it, expect } from 'vitest';
import { generate_code_graph } from '../src/code_graph';
import {
  get_scope_contents,
  get_visible_entities,
  is_entity_visible_from_scope,
  get_entity_scope,
  get_scope_entity,
  get_entity_defining_scope,
  get_parent_entity,
  is_top_level_entity,
  get_child_entities
} from '../src/scope_analysis/scope_entity_connections';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Scope-Entity Connections', () => {
  it('should connect functions to their scopes', async () => {
    // Create a test file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-'));
    const testFile = path.join(tempDir, 'test.js');
    
    fs.writeFileSync(testFile, `
      function outerFunction() {
        function innerFunction() {
          return 42;
        }
        return innerFunction();
      }
      
      class MyClass {
        myMethod() {
          return "hello";
        }
      }
    `);
    
    // Generate code graph
    const graph = await generate_code_graph({
      root_path: tempDir,
      include_patterns: ['*.js']
    });
    
    // Get the file analysis
    const analysis = graph.files.get(testFile);
    expect(analysis).toBeDefined();
    
    // Access the connections (extended property)
    const connections = (analysis as any).scope_entity_connections;
    expect(connections).toBeDefined();
    
    // Check that we have the expected number of functions
    expect(analysis!.functions.length).toBe(2); // outerFunction and innerFunction
    
    // Check that we have the expected number of classes
    expect(analysis!.classes.length).toBe(1); // MyClass
    
    // Check that methods are connected to their class
    const myClass = analysis!.classes[0];
    expect(myClass.methods.length).toBe(1); // myMethod
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true });
  });
  
  it('should track scope contents correctly', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-'));
    const testFile = path.join(tempDir, 'test.ts');
    
    fs.writeFileSync(testFile, `
      let globalVar = 1;
      
      function topLevelFunc() {
        let localVar = 2;
        
        function nestedFunc() {
          let innerVar = 3;
        }
      }
      
      class TestClass {
        property = 4;
        
        constructor() {
          let constructorVar = 5;
        }
        
        method() {
          let methodVar = 6;
        }
      }
    `);
    
    // Generate code graph
    const graph = await generate_code_graph({
      root_path: tempDir,
      include_patterns: ['*.ts']
    });
    
    const analysis = graph.files.get(testFile);
    const connections = (analysis as any).scope_entity_connections;
    const scopes = analysis!.scopes;
    
    // Find the global scope
    const globalScope = scopes.nodes.get(scopes.root_id);
    expect(globalScope).toBeDefined();
    
    // Check global scope contents
    const globalContents = get_scope_contents(scopes.root_id, connections);
    expect(globalContents.functions.size).toBeGreaterThan(0); // Should have topLevelFunc
    expect(globalContents.classes.size).toBe(1); // Should have TestClass
    expect(globalContents.variables.size).toBeGreaterThan(0); // Should have globalVar
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true });
  });
  
  it('should check visibility correctly', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-'));
    const testFile = path.join(tempDir, 'test.js');
    
    fs.writeFileSync(testFile, `
      let outerVar = 1;
      
      function outerFunc() {
        let middleVar = 2;
        
        function innerFunc() {
          let innerVar = 3;
          // outerVar and middleVar should be visible here
          // but not vice versa
        }
      }
    `);
    
    // Generate code graph
    const graph = await generate_code_graph({
      root_path: tempDir,
      include_patterns: ['*.js']
    });
    
    const analysis = graph.files.get(testFile);
    const connections = (analysis as any).scope_entity_connections;
    const registry = (analysis as any).symbol_registry;
    const scopes = analysis!.scopes;
    
    // Find the innerFunc scope
    let innerFuncScope: any = null;
    for (const [id, scope] of scopes.nodes) {
      if (scope.metadata?.name === 'innerFunc') {
        innerFuncScope = scope;
        break;
      }
    }
    expect(innerFuncScope).toBeDefined();
    
    // Get visible entities from inner function
    const visibleFromInner = get_visible_entities(
      innerFuncScope.id,
      connections,
      scopes
    );
    
    // Should see variables from parent scopes
    expect(visibleFromInner.variables.size).toBeGreaterThan(0);
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true });
  });
  
  it('should identify top-level entities', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-'));
    const testFile = path.join(tempDir, 'test.js');
    
    fs.writeFileSync(testFile, `
      function topLevel() {}
      
      function parent() {
        function nested() {}
      }
      
      class TopClass {
        method() {}
      }
    `);
    
    // Generate code graph
    const graph = await generate_code_graph({
      root_path: tempDir,
      include_patterns: ['*.js']
    });
    
    const analysis = graph.files.get(testFile);
    const connections = (analysis as any).scope_entity_connections;
    const registry = (analysis as any).symbol_registry;
    const scopes = analysis!.scopes;
    
    // Find top-level function
    const topLevelFunc = analysis!.functions.find(f => f.name === 'topLevel');
    expect(topLevelFunc).toBeDefined();
    
    const topLevelSymbol = registry.get(topLevelFunc);
    expect(topLevelSymbol).toBeDefined();
    
    // Check if it's top-level
    const isTopLevel = is_top_level_entity(topLevelSymbol, connections, scopes);
    expect(isTopLevel).toBe(true);
    
    // Find nested function
    const nestedFunc = analysis!.functions.find(f => f.name === 'nested');
    if (nestedFunc) {
      const nestedSymbol = registry.get(nestedFunc);
      const isNested = is_top_level_entity(nestedSymbol, connections, scopes);
      expect(isNested).toBe(false);
    }
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true });
  });
  
  it('should navigate between entities and scopes', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-'));
    const testFile = path.join(tempDir, 'test.js');
    
    fs.writeFileSync(testFile, `
      class Container {
        method1() {
          return 1;
        }
        
        method2() {
          return 2;
        }
      }
    `);
    
    // Generate code graph
    const graph = await generate_code_graph({
      root_path: tempDir,
      include_patterns: ['*.js']
    });
    
    const analysis = graph.files.get(testFile);
    const connections = (analysis as any).scope_entity_connections;
    const registry = (analysis as any).symbol_registry;
    
    // Find the class
    const containerClass = analysis!.classes.find(c => c.name === 'Container');
    expect(containerClass).toBeDefined();
    
    const classSymbol = registry.get(containerClass);
    expect(classSymbol).toBeDefined();
    
    // Get child entities of the class
    const children = get_child_entities(classSymbol, connections);
    expect(children.methods.size).toBe(2); // Should have both methods
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true });
  });
});