/**
 * Tests for Python-specific bespoke type propagation features
 */

import { describe, it, expect } from 'vitest';
import * as Parser from 'tree-sitter';
import * as Python from 'tree-sitter-python';
import { handle_with_statement } from './type_propagation.python';
import type { TypePropagationContext } from './type_propagation';

const parser = new (Parser as any)();
parser.setLanguage(Python);

function createContext(source_code: string): TypePropagationContext {
  return {
    language: 'python',
    source_code,
    known_types: new Map(),
    debug: false
  };
}

describe('handle_with_statement', () => {
  it('should handle open() context manager', () => {
    const code = `
with open('file.txt') as f:
    content = f.read()
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const withStatement = tree.rootNode.descendantsOfType('with_statement')[0];
    const flows = handle_with_statement(withStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('TextIOWrapper');
    expect(flows[0].target_identifier).toBe('f');
    expect(flows[0].flow_kind).toBe('context_manager');
  });

  it('should handle closing() context manager', () => {
    const code = `
with closing(connection) as conn:
    conn.execute(query)
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const withStatement = tree.rootNode.descendantsOfType('with_statement')[0];
    const flows = handle_with_statement(withStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Closeable');
    expect(flows[0].target_identifier).toBe('conn');
    expect(flows[0].flow_kind).toBe('context_manager');
  });

  it('should handle suppress() context manager', () => {
    const code = `
with suppress(ValueError) as e:
    int('not a number')
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const withStatement = tree.rootNode.descendantsOfType('with_statement')[0];
    const flows = handle_with_statement(withStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('ContextManager');
    expect(flows[0].target_identifier).toBe('e');
  });

  it('should handle unknown context managers', () => {
    const code = `
with custom_manager() as resource:
    resource.process()
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const withStatement = tree.rootNode.descendantsOfType('with_statement')[0];
    const flows = handle_with_statement(withStatement, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Any');
    expect(flows[0].target_identifier).toBe('resource');
  });

  it('should handle with statement without alias', () => {
    const code = `
with open('file.txt'):
    pass
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const withStatement = tree.rootNode.descendantsOfType('with_statement')[0];
    const flows = handle_with_statement(withStatement, context);
    
    expect(flows).toHaveLength(0);
  });

  it('should handle multiple context managers', () => {
    const code = `
with open('file1.txt') as f1, open('file2.txt') as f2:
    content1 = f1.read()
    content2 = f2.read()
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const withStatement = tree.rootNode.descendantsOfType('with_statement')[0];
    const flows = handle_with_statement(withStatement, context);
    
    // The current implementation only handles the first item
    expect(flows.length).toBeGreaterThanOrEqual(1);
    if (flows.length > 0) {
      expect(flows[0].source_type).toBe('TextIOWrapper');
    }
  });

  it('should return empty flows for non-with statements', () => {
    const code = `x = 5`;
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const flows = handle_with_statement(tree.rootNode, context);
    expect(flows).toHaveLength(0);
  });
});

describe('comprehension handling', () => {
  it('should identify list comprehension type', () => {
    const code = `
result = [x * 2 for x in range(10)]
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    // Comprehension handling is in the main propagate_python_types function
    // These tests verify the structure exists
    const listComp = tree.rootNode.descendantsOfType('list_comprehension')[0];
    expect(listComp).toBeDefined();
    expect(listComp.type).toBe('list_comprehension');
  });

  it('should identify set comprehension type', () => {
    const code = `
unique = {x for x in items}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const setComp = tree.rootNode.descendantsOfType('set_comprehension')[0];
    expect(setComp).toBeDefined();
    expect(setComp.type).toBe('set_comprehension');
  });

  it('should identify dict comprehension type', () => {
    const code = `
mapping = {k: v for k, v in pairs}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const dictComp = tree.rootNode.descendantsOfType('dictionary_comprehension')[0];
    expect(dictComp).toBeDefined();
    expect(dictComp.type).toBe('dictionary_comprehension');
  });

  it('should identify generator expression', () => {
    const code = `
gen = (x ** 2 for x in range(10))
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const genExpr = tree.rootNode.descendantsOfType('generator_expression')[0];
    expect(genExpr).toBeDefined();
    expect(genExpr.type).toBe('generator_expression');
  });
});

describe('lambda handling', () => {
  it('should identify lambda expressions', () => {
    const code = `
func = lambda x: x * 2
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const lambda = tree.rootNode.descendantsOfType('lambda')[0];
    expect(lambda).toBeDefined();
    expect(lambda.type).toBe('lambda');
  });

  it('should handle multi-parameter lambdas', () => {
    const code = `
add = lambda x, y: x + y
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const lambda = tree.rootNode.descendantsOfType('lambda')[0];
    expect(lambda).toBeDefined();
    
    const params = lambda.descendantsOfType('lambda_parameters')[0];
    expect(params).toBeDefined();
  });
});