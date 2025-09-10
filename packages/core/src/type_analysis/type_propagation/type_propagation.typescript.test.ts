/**
 * Tests for TypeScript-specific bespoke type propagation features
 */

import { describe, it, expect } from 'vitest';
import * as Parser from 'tree-sitter';
const TypeScript = require('tree-sitter-typescript/typescript');
import { handle_type_assertion, handle_utility_types } from './type_propagation.typescript';
import type { TypePropagationContext } from './type_propagation';

const parser = new (Parser as any)();
parser.setLanguage(TypeScript);

function createContext(source_code: string): TypePropagationContext {
  return {
    language: 'typescript',
    source_code,
    known_types: new Map(),
    debug: false
  };
}

describe('handle_type_assertion', () => {
  it('should handle as-expression type assertions', () => {
    const code = `const value = data as string;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const asExpression = tree.rootNode.descendantsOfType('as_expression')[0];
    const flows = handle_type_assertion(asExpression, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('string');
    expect(flows[0].target_identifier).toBe('data');
    expect(flows[0].flow_kind).toBe('type_assertion');
    expect(flows[0].confidence).toBe('explicit');
  });

  it('should handle angle-bracket type assertions', () => {
    const code = `const value = <number>data;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAssertion = tree.rootNode.descendantsOfType('type_assertion')[0];
    const flows = handle_type_assertion(typeAssertion, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('number');
    expect(flows[0].target_identifier).toBe('data');
    expect(flows[0].flow_kind).toBe('type_assertion');
  });

  it('should handle satisfies operator', () => {
    const code = `const config = { foo: 'bar' } satisfies Config;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const satisfies = tree.rootNode.descendantsOfType('satisfies_expression')[0];
    if (satisfies) {
      const flows = handle_type_assertion(satisfies, context);
      
      expect(flows).toHaveLength(1);
      expect(flows[0].source_type).toBe('Config');
      expect(flows[0].flow_kind).toBe('assertion');
    }
  });

  it('should handle complex type assertions', () => {
    const code = `const handler = func as EventHandler<MouseEvent>;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const asExpression = tree.rootNode.descendantsOfType('as_expression')[0];
    const flows = handle_type_assertion(asExpression, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('EventHandler<MouseEvent>');
    expect(flows[0].target_identifier).toBe('func');
  });

  it('should return empty flows for non-assertion nodes', () => {
    const code = `const x = 5;`;
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const flows = handle_type_assertion(tree.rootNode, context);
    expect(flows).toHaveLength(0);
  });
});

describe('handle_utility_types', () => {
  it('should handle Partial utility type', () => {
    const code = `type PartialUser = Partial<User>;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const flows = handle_utility_types(typeAlias, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Partial<User>');
    expect(flows[0].target_identifier).toBe('PartialUser');
    expect(flows[0].flow_kind).toBe('utility_type');
  });

  it('should handle Required utility type', () => {
    const code = `type RequiredConfig = Required<Config>;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const flows = handle_utility_types(typeAlias, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Required<Config>');
    expect(flows[0].target_identifier).toBe('RequiredConfig');
  });

  it('should handle Pick utility type', () => {
    const code = `type UserName = Pick<User, 'name'>;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const flows = handle_utility_types(typeAlias, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Pick<User, \'name\'>');
    expect(flows[0].target_identifier).toBe('UserName');
  });

  it('should handle Omit utility type', () => {
    const code = `type PublicUser = Omit<User, 'password'>;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const flows = handle_utility_types(typeAlias, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Omit<User, \'password\'>');
    expect(flows[0].target_identifier).toBe('PublicUser');
  });

  it('should handle Record utility type', () => {
    const code = `type StringMap = Record<string, string>;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const flows = handle_utility_types(typeAlias, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Record<string, string>');
    expect(flows[0].target_identifier).toBe('StringMap');
  });

  it('should handle ReturnType utility type', () => {
    const code = `type Result = ReturnType<typeof myFunction>;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const flows = handle_utility_types(typeAlias, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('ReturnType<typeof myFunction>');
    expect(flows[0].target_identifier).toBe('Result');
  });

  it('should return empty flows for non-utility types', () => {
    const code = `type SimpleType = string;`;
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const flows = handle_utility_types(typeAlias, context);
    
    expect(flows).toHaveLength(0);
  });
});

describe('integration', () => {
  it('should handle type assertion with utility type', () => {
    const code = `
      type PartialConfig = Partial<Config>;
      const config = data as PartialConfig;
    `;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const typeAlias = tree.rootNode.descendantsOfType('type_alias_declaration')[0];
    const utilityFlows = handle_utility_types(typeAlias, context);
    
    const asExpression = tree.rootNode.descendantsOfType('as_expression')[0];
    const assertionFlows = handle_type_assertion(asExpression, context);
    
    expect(utilityFlows).toHaveLength(1);
    expect(utilityFlows[0].source_type).toBe('Partial<Config>');
    
    expect(assertionFlows).toHaveLength(1);
    expect(assertionFlows[0].source_type).toBe('PartialConfig');
  });
});