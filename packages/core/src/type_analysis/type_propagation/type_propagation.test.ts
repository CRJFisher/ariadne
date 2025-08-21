import { describe, it, expect, beforeEach } from 'vitest';
import { SyntaxNode } from 'tree-sitter';
import { get_language_parser } from '../../scope_queries/loader';
import {
  analyze_type_propagation,
  propagate_types_in_tree,
  find_all_propagation_paths,
  get_inferred_type,
  are_types_compatible,
  TypeFlow,
  PropagationPath
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
      const flows = propagate_types_in_tree(tree.rootNode, code, 'javascript');
      
      expect(flows.get('x')).toBeDefined();
      expect(flows.get('x')![0].source_type).toBe('number');
      expect(flows.get('x')![0].confidence).toBe('explicit');
      
      expect(flows.get('y')).toBeDefined();
      expect(flows.get('z')).toBeDefined();
    });
    
    it('should handle type conversion functions', () => {
      const code = `
        const str = String(123);
        const num = Number("456");
        const bool = Boolean(0);
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'javascript');
      
      expect(get_inferred_type('str', flows)).toBe('string');
      expect(get_inferred_type('num', flows)).toBe('number');
      expect(get_inferred_type('bool', flows)).toBe('boolean');
    });
    
    it('should handle array methods', () => {
      const code = `
        const arr = [1, 2, 3];
        const mapped = arr.map(x => x * 2);
        const filtered = arr.filter(x => x > 1);
        const found = arr.find(x => x === 2);
        const hasAny = arr.some(x => x > 0);
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'javascript');
      
      expect(get_inferred_type('arr', flows)).toBe('Array');
      expect(get_inferred_type('mapped', flows)).toBe('Array');
      expect(get_inferred_type('filtered', flows)).toBe('Array');
      expect(get_inferred_type('hasAny', flows)).toBe('boolean');
    });
    
    it('should handle type narrowing with typeof', () => {
      const code = `
        function test(value) {
          if (typeof value === 'string') {
            // value is string here
            return value;
          }
        }
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'javascript');
      
      const valueFlows = flows.get('value') || [];
      const narrowingFlow = valueFlows.find(f => f.flow_kind === 'narrowing');
      expect(narrowingFlow).toBeDefined();
      expect(narrowingFlow!.source_type).toBe('string');
    });
    
    it('should handle instanceof checks', () => {
      const code = `
        function test(obj) {
          if (obj instanceof Array) {
            // obj is Array here
            return obj;
          }
        }
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'javascript');
      
      const objFlows = flows.get('obj') || [];
      const narrowingFlow = objFlows.find(f => f.flow_kind === 'narrowing');
      expect(narrowingFlow).toBeDefined();
      expect(narrowingFlow!.source_type).toBe('Array');
    });
    
    it('should handle ternary expressions', () => {
      const code = `
        const x = true ? 42 : 42;
        const y = condition ? "a" : "b";
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'javascript');
      
      expect(get_inferred_type('x', flows)).toBe('number');
      expect(get_inferred_type('y', flows)).toBe('string');
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
      const flows = propagate_types_in_tree(tree.rootNode, code, 'typescript');
      
      expect(get_inferred_type('x', flows)).toBe('number');
      expect(get_inferred_type('y', flows)).toBe('string');
      expect(get_inferred_type('z', flows)).toBe('boolean');
    });
    
    it('should handle type assertions', () => {
      const code = `
        const x = value as string;
        const y = <number>value;
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'typescript');
      
      expect(get_inferred_type('x', flows)).toBe('string');
      expect(get_inferred_type('y', flows)).toBe('number');
    });
    
    it('should handle generic types', () => {
      const code = `
        const arr: Array<string> = [];
        const map: Map<string, number> = new Map();
        const promise: Promise<void> = Promise.resolve();
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'typescript');
      
      expect(get_inferred_type('arr', flows)).toBe('Array<string>');
      expect(get_inferred_type('map', flows)).toBe('Map<string, number>');
      expect(get_inferred_type('promise', flows)).toBe('Promise<void>');
    });
    
    it('should handle union and intersection types', () => {
      const code = `
        const union: string | number = "hello";
        const intersection: Foo & Bar = obj;
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'typescript');
      
      expect(get_inferred_type('union', flows)).toBe('string | number');
      expect(get_inferred_type('intersection', flows)).toBe('Foo & Bar');
    });
    
    it('should handle satisfies operator', () => {
      const code = `
        const config = {
          name: "test",
          value: 123
        } satisfies Config;
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'typescript');
      
      const configFlows = flows.get('config') || [];
      expect(configFlows.length).toBeGreaterThan(0);
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
z = True
arr = [1, 2, 3]
dict_var = {"key": "value"}
set_var = {1, 2, 3}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'python');
      
      expect(get_inferred_type('x', flows)).toBe('int');
      expect(get_inferred_type('y', flows)).toBe('str');
      expect(get_inferred_type('z', flows)).toBe('bool');
      expect(get_inferred_type('arr', flows)).toBe('list');
      expect(get_inferred_type('dict_var', flows)).toBe('dict');
      expect(get_inferred_type('set_var', flows)).toBe('set');
    });
    
    it('should handle type annotations', () => {
      const code = `
x: int = 42
y: str = "hello"
z: List[int] = [1, 2, 3]
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'python');
      
      expect(get_inferred_type('x', flows)).toBe('int');
      expect(get_inferred_type('y', flows)).toBe('str');
      expect(get_inferred_type('z', flows)).toBe('List[int]');
    });
    
    it('should handle type constructors', () => {
      const code = `
x = int("123")
y = str(456)
z = list(range(10))
w = dict(a=1, b=2)
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'python');
      
      expect(get_inferred_type('x', flows)).toBe('int');
      expect(get_inferred_type('y', flows)).toBe('str');
      expect(get_inferred_type('z', flows)).toBe('list');
      expect(get_inferred_type('w', flows)).toBe('dict');
    });
    
    it('should handle isinstance checks', () => {
      const code = `
def test(obj):
    if isinstance(obj, str):
        # obj is str here
        return obj
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'python');
      
      const objFlows = flows.get('obj') || [];
      const narrowingFlow = objFlows.find(f => f.flow_kind === 'narrowing');
      expect(narrowingFlow).toBeDefined();
      expect(narrowingFlow!.source_type).toBe('str');
    });
    
    it('should handle lambda expressions', () => {
      const code = `
func = lambda x: x * 2
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'python');
      
      expect(get_inferred_type('func', flows)).toBe('Callable');
    });
    
    it('should handle comprehensions', () => {
      const code = `
list_comp = [x * 2 for x in range(10)]
dict_comp = {x: x**2 for x in range(5)}
set_comp = {x for x in range(10) if x % 2 == 0}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'python');
      
      expect(get_inferred_type('list_comp', flows)).toBe('list');
      expect(get_inferred_type('dict_comp', flows)).toBe('dict');
      expect(get_inferred_type('set_comp', flows)).toBe('set');
    });
  });
  
  describe('Rust', () => {
    let parser: any;
    
    beforeEach(() => {
      parser = get_language_parser('rust');
    });
    
    it('should handle let declarations', () => {
      const code = `
fn main() {
    let x = 42;
    let y: String = String::new();
    let z: bool = true;
}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'rust');
      
      expect(get_inferred_type('x', flows)).toBe('i32');
      expect(get_inferred_type('y', flows)).toBe('String');
      expect(get_inferred_type('z', flows)).toBe('bool');
    });
    
    it('should handle type constructors', () => {
      const code = `
fn main() {
    let vec = Vec::new();
    let string = String::new();
    let option = Some(42);
    let result = Ok("success");
}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'rust');
      
      expect(get_inferred_type('vec', flows)).toBe('Vec');
      expect(get_inferred_type('string', flows)).toBe('String');
      expect(get_inferred_type('option', flows)).toBe('Option');
      expect(get_inferred_type('result', flows)).toBe('Result');
    });
    
    it('should handle collections', () => {
      const code = `
fn main() {
    let arr = [1, 2, 3];
    let vec = vec![1, 2, 3];
    let tuple = (1, "hello", true);
}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'rust');
      
      expect(get_inferred_type('arr', flows)).toBe('[T]');
      expect(get_inferred_type('vec', flows)).toBe('Vec<T>');
      expect(get_inferred_type('tuple', flows)).toBe('(T, T, T)');
    });
    
    it('should handle pattern matching', () => {
      const code = `
fn test(x: Option<i32>) {
    if let Some(value) = x {
        // value is i32 here
    }
}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'rust');
      
      const valueFlows = flows.get('value') || [];
      expect(valueFlows.length).toBeGreaterThan(0);
      expect(valueFlows[0].flow_kind).toBe('narrowing');
    });
    
    it('should handle closures', () => {
      const code = `
fn main() {
    let closure = |x| x + 1;
}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'rust');
      
      expect(get_inferred_type('closure', flows)).toBe('Fn');
    });
    
    it('should handle struct expressions', () => {
      const code = `
fn main() {
    let point = Point { x: 10, y: 20 };
}
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'rust');
      
      expect(get_inferred_type('point', flows)).toBe('Point');
    });
  });
  
  describe('Cross-cutting features', () => {
    it('should find propagation paths', () => {
      const parser = get_language_parser('javascript');
      const code = `
        const x = 42;
        const y = x;
        const z = y;
      `;
      
      const tree = parser.parse(code);
      const paths = find_all_propagation_paths('x', 'z', tree.rootNode, code, 'javascript');
      
      expect(paths.length).toBeGreaterThan(0);
    });
    
    it('should check type compatibility', () => {
      // JavaScript - loose typing
      expect(are_types_compatible('string', 'number', 'javascript')).toBe(true);
      
      // TypeScript - strict typing with unions
      expect(are_types_compatible('string', 'string', 'typescript')).toBe(true);
      expect(are_types_compatible('string', 'number', 'typescript')).toBe(false);
      expect(are_types_compatible('string | number', 'string', 'typescript')).toBe(true);
      
      // Python - duck typing
      expect(are_types_compatible('str', 'int', 'python')).toBe(true);
      
      // Rust - strict typing
      expect(are_types_compatible('i32', 'i32', 'rust')).toBe(true);
      expect(are_types_compatible('i32', 'u32', 'rust')).toBe(false);
      expect(are_types_compatible('&str', '&str', 'rust')).toBe(true);
    });
    
    it('should handle confidence levels correctly', () => {
      const parser = get_language_parser('typescript');
      const code = `
        const x: number = 42;  // explicit
        const y = x;           // inferred
        const z = unknownFunc(); // assumed
      `;
      
      const tree = parser.parse(code);
      const flows = propagate_types_in_tree(tree.rootNode, code, 'typescript');
      
      const xFlows = flows.get('x') || [];
      expect(xFlows[0]?.confidence).toBe('explicit');
      
      const yFlows = flows.get('y') || [];
      expect(yFlows[0]?.confidence).toBe('inferred');
    });
  });
});