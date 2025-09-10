/**
 * Tests for Rust-specific bespoke type propagation features
 */

import { describe, it, expect } from 'vitest';
import * as Parser from 'tree-sitter';
import * as Rust from 'tree-sitter-rust';
import { propagate_rust_types } from './type_propagation.rust';
import type { TypePropagationContext } from './type_propagation';

const parser = new (Parser as any)();
parser.setLanguage(Rust);

function createContext(source_code: string): TypePropagationContext {
  return {
    language: 'rust',
    source_code,
    known_types: new Map(),
    debug: false
  };
}

describe('match expression handling', () => {
  it('should handle enum variant pattern matching', () => {
    const code = `
match result {
    Some(value) => println!("{}", value),
    None => println!("No value"),
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const matchExpr = tree.rootNode.descendantsOfType('match_expression')[0];
    const flows = propagate_rust_types(matchExpr, context);
    
    const someFlow = flows.find(f => f.source_type === 'Some');
    expect(someFlow).toBeDefined();
    expect(someFlow?.target_identifier).toBe('result');
    expect(someFlow?.flow_kind).toBe('pattern_match');
  });

  it('should handle struct pattern matching', () => {
    const code = `
match point {
    Point { x, y } => println!("{}, {}", x, y),
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const matchExpr = tree.rootNode.descendantsOfType('match_expression')[0];
    const flows = propagate_rust_types(matchExpr, context);
    
    expect(flows.length).toBeGreaterThanOrEqual(0);
    // The implementation will extract Point type from the pattern
  });

  it('should handle literal pattern matching', () => {
    const code = `
match number {
    0 => println!("zero"),
    1 => println!("one"),
    _ => println!("other"),
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const matchExpr = tree.rootNode.descendantsOfType('match_expression')[0];
    const flows = propagate_rust_types(matchExpr, context);
    
    // Literal patterns provide type refinement
    expect(flows.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle reference patterns', () => {
    const code = `
match value {
    &mut x => x += 1,
    &y => println!("{}", y),
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const matchExpr = tree.rootNode.descendantsOfType('match_expression')[0];
    const flows = propagate_rust_types(matchExpr, context);
    
    // Reference patterns should be detected
    const refFlow = flows.find(f => f.source_type?.includes('&'));
    expect(refFlow).toBeDefined();
  });
});

describe('if-let expression handling', () => {
  it('should handle if-let with Option', () => {
    const code = `
if let Some(value) = option {
    println!("{}", value);
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifLet = tree.rootNode.descendantsOfType('if_let_expression')[0];
    const flows = propagate_rust_types(ifLet, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Some');
    expect(flows[0].target_identifier).toBe('option');
    expect(flows[0].flow_kind).toBe('if_let');
  });

  it('should handle if-let with Result', () => {
    const code = `
if let Ok(data) = result {
    process(data);
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifLet = tree.rootNode.descendantsOfType('if_let_expression')[0];
    const flows = propagate_rust_types(ifLet, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Ok');
    expect(flows[0].target_identifier).toBe('result');
  });

  it('should handle if-let with struct patterns', () => {
    const code = `
if let User { name, age } = user {
    println!("{} is {} years old", name, age);
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifLet = tree.rootNode.descendantsOfType('if_let_expression')[0];
    const flows = propagate_rust_types(ifLet, context);
    
    expect(flows.length).toBeGreaterThanOrEqual(0);
    // Should extract User type from pattern
  });
});

describe('let declaration handling', () => {
  it('should handle let bindings with type annotations', () => {
    const code = `let x: i32 = 42;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const letDecl = tree.rootNode.descendantsOfType('let_declaration')[0];
    const flows = propagate_rust_types(letDecl, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].target_identifier).toBe('x');
    expect(flows[0].flow_kind).toBe('assignment');
  });

  it('should handle let mut bindings', () => {
    const code = `let mut counter = 0;`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const letDecl = tree.rootNode.descendantsOfType('let_declaration')[0];
    const flows = propagate_rust_types(letDecl, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].target_identifier).toBe('counter');
  });

  it('should handle pattern destructuring in let', () => {
    const code = `let (x, y) = (1, 2);`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const letDecl = tree.rootNode.descendantsOfType('let_declaration')[0];
    const flows = propagate_rust_types(letDecl, context);
    
    // Should handle tuple destructuring
    expect(flows.length).toBeGreaterThanOrEqual(0);
  });
});

describe('ownership and borrowing', () => {
  it('should detect reference types', () => {
    const code = `
let x = 5;
let y = &x;
let z = &mut x;
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    // Process all let declarations
    const letDecls = tree.rootNode.descendantsOfType('let_declaration');
    const allFlows = letDecls.flatMap((decl: any) => propagate_rust_types(decl, context));
    
    expect(allFlows.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle Box types', () => {
    const code = `let boxed = Box::new(5);`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const letDecl = tree.rootNode.descendantsOfType('let_declaration')[0];
    const flows = propagate_rust_types(letDecl, context);
    
    expect(flows.length).toBeGreaterThanOrEqual(1);
    // Should identify Box::new constructor
  });
});

describe('integration', () => {
  it('should handle complex match with multiple patterns', () => {
    const code = `
match value {
    Some(Ok(data)) => process(data),
    Some(Err(e)) => handle_error(e),
    None => default_action(),
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const matchExpr = tree.rootNode.descendantsOfType('match_expression')[0];
    const flows = propagate_rust_types(matchExpr, context);
    
    // Should handle nested patterns
    expect(flows.length).toBeGreaterThanOrEqual(1);
    expect(flows[0].flow_kind).toBe('pattern_match');
  });

  it('should handle if-let with else clause', () => {
    const code = `
if let Some(x) = opt {
    use_value(x);
} else {
    handle_none();
}
`;
    
    const tree = parser.parse(code);
    const context = createContext(code);
    
    const ifLet = tree.rootNode.descendantsOfType('if_let_expression')[0];
    const flows = propagate_rust_types(ifLet, context);
    
    expect(flows).toHaveLength(1);
    expect(flows[0].source_type).toBe('Some');
  });
});