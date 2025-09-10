/**
 * Tests for JavaScript-specific bespoke type propagation features
 */

import { describe, it, expect } from 'vitest';
import * as Parser from 'tree-sitter';
import * as JavaScript from 'tree-sitter-javascript';
import { handle_closure_capture, handle_type_narrowing } from './type_propagation.javascript';
import type { TypePropagationContext } from './type_propagation';

const parser = new (Parser as any)();
parser.setLanguage(JavaScript);

function createContext(source_code: string): TypePropagationContext {
  return {
    language: 'javascript',
    source_code,
    known_types: new Map(),
    debug: false
  };
}

describe('handle_closure_capture', () => {
  it('should capture types from outer scope in closure', () => {
    const code = `
      function outer() {
        const myVar = "hello";
        function inner() {
          console.log(myVar);
        }
      }
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    context.known_types?.set('myVar', 'string');
    
    // Find the inner function
    let innerFunc: any = null;
    tree.rootNode.descendantsOfType('function_declaration').forEach((node: any) => {
      if ((node as any).text.includes('inner')) {
        innerFunc = node;
      }
    });
    
    const flows = handle_closure_capture(innerFunc, context);
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('string');
    expect(flows[0].target_identifier).toBe('myVar');
    expect(flows[0].flow_kind).toBe('closure_capture');
  });

  it('should handle arrow function closures', () => {
    const code = `
      const outer = () => {
        const data = 42;
        const inner = () => data;
      }
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    context.known_types?.set('data', 'number');
    
    // Find the inner arrow function
    const arrowFunctions = tree.rootNode.descendantsOfType('arrow_function');
    const innerArrow = arrowFunctions[arrowFunctions.length - 1];
    
    const flows = handle_closure_capture(innerArrow, context);
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('number');
    expect(flows[0].target_identifier).toBe('data');
  });

  it('should return empty flows for non-function nodes', () => {
    const code = `const x = 5;`;
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const flows = handle_closure_capture(tree.rootNode, context);
    expect(flows).toHaveLength(0);
  });
});

describe('handle_type_narrowing', () => {
  it('should narrow type with typeof check', () => {
    const code = `
      if (typeof value === 'string') {
        value.toLowerCase();
      }
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifStatement = tree.rootNode.descendantsOfType('if_statement')[0];
    const flows = handle_type_narrowing(ifStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('string');
    expect(flows[0].target_identifier).toBe('value');
    expect(flows[0].flow_kind).toBe('narrowing');
  });

  it('should narrow type with instanceof check', () => {
    const code = `
      if (obj instanceof Array) {
        obj.push(1);
      }
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifStatement = tree.rootNode.descendantsOfType('if_statement')[0];
    const flows = handle_type_narrowing(ifStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Array');
    expect(flows[0].target_identifier).toBe('obj');
    expect(flows[0].flow_kind).toBe('narrowing');
  });

  it('should narrow type with null check', () => {
    const code = `
      if (value !== null) {
        value.toString();
      }
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifStatement = tree.rootNode.descendantsOfType('if_statement')[0];
    const flows = handle_type_narrowing(ifStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('non-null');
    expect(flows[0].target_identifier).toBe('value');
  });

  it('should handle truthiness check', () => {
    const code = `
      if (data) {
        data.process();
      }
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifStatement = tree.rootNode.descendantsOfType('if_statement')[0];
    const flows = handle_type_narrowing(ifStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('truthy');
    expect(flows[0].target_identifier).toBe('data');
  });

  it('should return empty flows for non-if statements', () => {
    const code = `const x = 5;`;
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const flows = handle_type_narrowing(tree.rootNode, context);
    expect(flows).toHaveLength(0);
  });
});

describe('integration', () => {
  it('should handle complex closure with type narrowing', () => {
    const code = `
      function process(value) {
        const handler = () => {
          if (typeof value === 'string') {
            return value.toUpperCase();
          }
          return value;
        };
        return handler;
      }
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const arrowFunction = tree.rootNode.descendantsOfType('arrow_function')[0];
    const closureFlows = handle_closure_capture(arrowFunction, context);
    
    const ifStatement = tree.rootNode.descendantsOfType('if_statement')[0];
    const narrowingFlows = handle_type_narrowing(ifStatement, context);
    
    expect(closureFlows.length).toBeGreaterThanOrEqual(0);
    expect(narrowingFlows).toHaveLength(1);
    expect(narrowingFlows[0].source_type).toBe('string');
  });
});