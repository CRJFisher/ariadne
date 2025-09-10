import { describe, it, expect, beforeEach } from 'vitest';
import { get_language_parser } from '../test_utils';
import {
  analyze_type_propagation,
  propagate_types_in_tree,
  find_all_propagation_paths,
  get_inferred_type,
  are_types_compatible,
  TypePropagationContext
} from './index';

describe('Type Propagation', () => {
  describe('JavaScript', () => {
    let parser: any;
    
    beforeEach(() => {
      parser = get_language_parser('javascript');
    });
    
    it('should propagate types through assignments', () => {
      const code = `
        const x = 42;
        let y = x;
        var z = y;
      `;
      
      const tree = parser.parse(code);
      const context: TypePropagationContext = {
        language: 'javascript',
        source_code: code,
        known_types: new Map()
      };
      const flows = propagate_types_in_tree(tree.rootNode, context);
      
      // Find flows for specific variables
      const xFlows = flows.filter(f => f.target_identifier === 'x');
      const yFlows = flows.filter(f => f.target_identifier === 'y');
      const zFlows = flows.filter(f => f.target_identifier === 'z');
      
      expect(xFlows.length).toBeGreaterThan(0);
      expect(xFlows[0].source_type).toBe('number');
      expect(xFlows[0].confidence).toBe('explicit');
      
      expect(yFlows.length).toBeGreaterThan(0);
      expect(zFlows.length).toBeGreaterThan(0);
    });
    
    it('should handle type conversion functions', () => {
      const code = `
        const str = String(42);
        const num = Number("123");
        const bool = Boolean(0);
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'javascript');
      
      expect(analysis.type_map.get('str')).toBe('string');
      expect(analysis.type_map.get('num')).toBe('number');
      expect(analysis.type_map.get('bool')).toBe('boolean');
    });
    
    it('should handle array methods', () => {
      const code = `
        const arr = [1, 2, 3];
        const doubled = arr.map(x => x * 2);
        const filtered = arr.filter(x => x > 1);
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'javascript');
      
      // Array methods should propagate array type
      expect(analysis.type_map.get('doubled')).toBe('Array');
      expect(analysis.type_map.get('filtered')).toBe('Array');
    });
    
    it('should handle type narrowing with typeof', () => {
      const code = `
        function process(value) {
          if (typeof value === 'string') {
            return value.toUpperCase();
          }
          return value;
        }
      `;
      
      const tree = parser.parse(code);
      const inferred = get_inferred_type('value', tree.rootNode, code, 'javascript');
      
      // In the narrowed context, value should be string
      expect(inferred).toBeDefined();
    });
    
    it('should handle instanceof checks', () => {
      const code = `
        function process(obj) {
          if (obj instanceof Array) {
            return obj.length;
          }
          return 0;
        }
      `;
      
      const tree = parser.parse(code);
      const inferred = get_inferred_type('obj', tree.rootNode, code, 'javascript');
      
      expect(inferred).toBeDefined();
    });
    
    it('should handle ternary expressions', () => {
      const code = `
        const x = condition ? 42 : "hello";
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'javascript');
      
      // Ternary can have multiple types
      expect(analysis.type_map.get('x')).toBe('number');
    });
  });
  
  describe('TypeScript', () => {
    let parser: any;
    
    beforeEach(() => {
      parser = get_language_parser('typescript');
    });
    
    it('should handle type annotations', () => {
      const code = `
        const x: number = 42;
        let y: string = "hello";
        var z: boolean = true;
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'typescript');
      
      expect(analysis.type_map.get('x')).toBe('number');
      expect(analysis.type_map.get('y')).toBe('string');
      expect(analysis.type_map.get('z')).toBe('boolean');
    });
    
    it('should handle type assertions', () => {
      const code = `
        const value = data as string;
        const num = <number>someValue;
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'typescript');
      
      expect(analysis.type_map.get('value')).toBe('string');
      expect(analysis.type_map.get('num')).toBe('number');
    });
    
    it('should handle generic types', () => {
      const code = `
        const arr: Array<string> = [];
        const map: Map<string, number> = new Map();
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'typescript');
      
      expect(analysis.type_map.get('arr')).toBe('Array<string>');
      expect(analysis.type_map.get('map')).toBe('Map<string, number>');
    });
    
    it('should handle union and intersection types', () => {
      const code = `
        let value: string | number = "hello";
        value = 42;
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'typescript');
      
      // Should track the union type
      expect(analysis.type_map.get('value')).toBe('string | number');
    });
    
    it('should handle satisfies operator', () => {
      const code = `
        const config = {
          name: "test",
          value: 42
        } satisfies Config;
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'typescript');
      
      // Config type should be tracked
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
  });
  
  describe('Python', () => {
    let parser: any;
    
    beforeEach(() => {
      parser = get_language_parser('python');
    });
    
    it('should handle basic assignments', () => {
      const code = `
x = 42
y = "hello"
z = [1, 2, 3]
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'python');
      
      expect(analysis.type_map.get('x')).toBe('int');
      expect(analysis.type_map.get('y')).toBe('str');
      expect(analysis.type_map.get('z')).toBe('list');
    });
    
    it('should handle type annotations', () => {
      const code = `
x: int = 42
y: str = "hello"
z: List[int] = [1, 2, 3]
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'python');
      
      expect(analysis.type_map.get('x')).toBe('int');
      expect(analysis.type_map.get('y')).toBe('str');
      expect(analysis.type_map.get('z')).toBe('List[int]');
    });
    
    it('should handle type constructors', () => {
      const code = `
x = int("42")
y = str(123)
z = list(range(10))
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'python');
      
      expect(analysis.type_map.get('x')).toBe('int');
      expect(analysis.type_map.get('y')).toBe('str');
      expect(analysis.type_map.get('z')).toBe('list');
    });
    
    it('should handle isinstance checks', () => {
      const code = `
def process(obj):
    if isinstance(obj, str):
        return obj.upper()
    return str(obj)
      `;
      
      const tree = parser.parse(code);
      const inferred = get_inferred_type('obj', tree.rootNode, code, 'python');
      
      expect(inferred).toBeDefined();
    });
    
    it('should handle lambda expressions', () => {
      const code = `
add = lambda x, y: x + y
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'python');
      
      // Lambda should be recognized as callable
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
    
    it('should handle comprehensions', () => {
      const code = `
squares = [x**2 for x in range(10)]
unique = {x for x in items}
mapping = {k: v for k, v in pairs}
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'python');
      
      // Comprehensions should have appropriate types
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
  });
  
  describe('Rust', () => {
    let parser: any;
    
    beforeEach(() => {
      parser = get_language_parser('rust');
    });
    
    it('should handle let declarations', () => {
      const code = `
let x = 42;
let y: String = String::from("hello");
let mut z = vec![1, 2, 3];
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'rust');
      
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
    
    it('should handle type constructors', () => {
      const code = `
let vec = Vec::new();
let map = HashMap::new();
let s = String::from("hello");
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'rust');
      
      expect(analysis.type_map.get('vec')).toBe('Vec');
      expect(analysis.type_map.get('map')).toBe('HashMap');
      expect(analysis.type_map.get('s')).toBe('String');
    });
    
    it('should handle collections', () => {
      const code = `
let vec = vec![1, 2, 3];
let arr = [1, 2, 3];
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'rust');
      
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
    
    it('should handle match expressions', () => {
      const code = `
match value {
    Some(x) => x,
    None => 0,
}
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'rust');
      
      // Match should provide type narrowing
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
    
    it('should handle if-let expressions', () => {
      const code = `
if let Some(x) = option {
    println!("{}", x);
}
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'rust');
      
      // If-let should provide type narrowing
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
    
    it('should handle ownership and borrowing', () => {
      const code = `
let x = 5;
let y = &x;
let z = &mut x;
      `;
      
      const tree = parser.parse(code);
      const analysis = analyze_type_propagation(tree.rootNode, code, 'rust');
      
      // References should be tracked
      expect(analysis.flows.length).toBeGreaterThan(0);
    });
  });
  
  describe('Type Compatibility', () => {
    it('should check JavaScript type compatibility', () => {
      // JavaScript is very permissive
      expect(are_types_compatible('string', 'number', 'javascript')).toBe(true);
      expect(are_types_compatible('any', 'string', 'javascript')).toBe(true);
    });
    
    it('should check TypeScript type compatibility', () => {
      // TypeScript is stricter
      expect(are_types_compatible('string', 'string', 'typescript')).toBe(true);
      expect(are_types_compatible('string', 'number', 'typescript')).toBe(false);
      expect(are_types_compatible('any', 'string', 'typescript')).toBe(true);
    });
    
    it('should check Python type compatibility', () => {
      // Python has duck typing
      expect(are_types_compatible('str', 'int', 'python')).toBe(true);
      expect(are_types_compatible('Any', 'str', 'python')).toBe(true);
    });
    
    it('should check Rust type compatibility', () => {
      // Rust is very strict
      expect(are_types_compatible('i32', 'i32', 'rust')).toBe(true);
      expect(are_types_compatible('i32', 'i64', 'rust')).toBe(false);
      expect(are_types_compatible('String', '&str', 'rust')).toBe(false);
    });
  });
  
  describe('Propagation Paths', () => {
    it('should find propagation paths in JavaScript', () => {
      const code = `
        const x = 42;
        const y = x;
        const z = y;
      `;
      
      const parser = get_language_parser('javascript');
      const tree = parser.parse(code);
      const paths = find_all_propagation_paths(tree.rootNode, code, 'javascript');
      
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].confidence).toBeDefined();
    });
    
    it('should find propagation paths in TypeScript', () => {
      const code = `
        const x: number = 42;
        const y = x as any;
        const z = y as string;
      `;
      
      const parser = get_language_parser('typescript');
      const tree = parser.parse(code);
      const paths = find_all_propagation_paths(tree.rootNode, code, 'typescript');
      
      expect(paths.length).toBeGreaterThan(0);
    });
  });
});