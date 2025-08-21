import { describe, it, expect } from 'vitest';
import { get_language_parser } from '../../scope_queries/loader';
import { build_language_scope_tree, find_scope_at_position, get_visible_symbols } from './index';

describe('Scope Tree', () => {
  const clean_files: string[] = [];
  
  afterAll(() => {
    // Clean up test files
    clean_files.forEach(file => {
      try {
        require('fs').unlinkSync(file);
      } catch {}
    });
  });
  describe('JavaScript', () => {
    it('should build basic scope tree', () => {
      const parser = get_language_parser('javascript');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
        function outer() {
          const x = 1;
          function inner() {
            const y = 2;
            return x + y;
          }
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'javascript');
      
      expect(scope_tree).toBeDefined();
      expect(scope_tree.nodes.size).toBeGreaterThan(1);
    });
    
    it('should handle var hoisting', () => {
      const parser = get_language_parser('javascript');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
        function test() {
          console.log(x); // Should see hoisted var
          if (true) {
            var x = 10;
          }
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'javascript');
      
      // Find function scope
      let function_scope = null;
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'function') {
          function_scope = node;
          break;
        }
      }
      
      expect(function_scope).toBeDefined();
      expect(function_scope!.symbols.has('x')).toBe(true);
    });
    
    it('should handle block scopes', () => {
      const parser = get_language_parser('javascript');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
        {
          let x = 1;
          const y = 2;
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'javascript');
      
      // Should have global and block scope
      expect(scope_tree.nodes.size).toBe(2);
    });
  });
  
  describe('Scope navigation', () => {
    it('should find scope at position', () => {
      const parser = get_language_parser('javascript');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
        function test() {
          const x = 1;
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'javascript');
      
      // Position inside function
      const scope = find_scope_at_position(scope_tree, { row: 2, column: 10 });
      expect(scope).toBeDefined();
      expect(scope!.type).toBe('function');
    });
    
    it('should get visible symbols', () => {
      const parser = get_language_parser('javascript');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
        const global = 1;
        function test() {
          const local = 2;
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'javascript');
      
      // Find function scope
      let function_scope_id = '';
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'function') {
          function_scope_id = id;
          break;
        }
      }
      
      const visible = get_visible_symbols(scope_tree, function_scope_id);
      expect(visible.has('global')).toBe(true);
      expect(visible.has('local')).toBe(true);
    });
  });
  
  describe('TypeScript', () => {
    it('should handle TypeScript-specific scopes', () => {
      const parser = get_language_parser('typescript');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
        interface User {
          name: string;
        }
        
        namespace MyNamespace {
          export class MyClass {
            method(): void {}
          }
        }
        
        enum Status {
          Active,
          Inactive
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'typescript');
      
      // Should have scopes for namespace and class
      let namespace_count = 0;
      let class_count = 0;
      
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'module') namespace_count++;
        if (node.type === 'class') class_count++;
      }
      
      expect(namespace_count).toBeGreaterThan(0);
      expect(class_count).toBeGreaterThan(0);
    });
    
    it('should handle type parameters', () => {
      const parser = get_language_parser('typescript');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
        function identity<T>(value: T): T {
          return value;
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'typescript');
      
      // Find function scope
      let function_scope = null;
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'function') {
          function_scope = node;
          break;
        }
      }
      
      expect(function_scope).toBeDefined();
      // Type parameter T should be in scope
      expect(function_scope!.symbols.has('T')).toBe(true);
    });
  });
  
  describe('Python', () => {
    it('should handle Python scopes', () => {
      const parser = get_language_parser('python');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
class MyClass:
    def method(self):
        local_var = 1
        
def function():
    x = 1
    def nested():
        nonlocal x
        x = 2
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'python');
      
      // Should have class and function scopes
      let class_count = 0;
      let function_count = 0;
      
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'class') class_count++;
        if (node.type === 'function') function_count++;
      }
      
      expect(class_count).toBe(1);
      expect(function_count).toBe(3); // method, function, nested
    });
    
    it('should handle comprehension scopes', () => {
      const parser = get_language_parser('python');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
result = [x * 2 for x in range(10)]
gen = (x for x in items)
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'python');
      
      // Should have local scopes for comprehensions
      let local_count = 0;
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'local') local_count++;
      }
      
      expect(local_count).toBeGreaterThan(0);
    });
    
    it('should handle global and nonlocal', () => {
      const parser = get_language_parser('python');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
global_var = 0

def outer():
    x = 1
    def inner():
        global global_var
        nonlocal x
        global_var = 2
        x = 3
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'python');
      
      // Global var should be in root scope
      const root_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(root_scope).toBeDefined();
      expect(root_scope!.symbols.has('global_var')).toBe(true);
    });
  });
  
  describe('Rust', () => {
    it('should handle Rust scopes', () => {
      const parser = get_language_parser('rust');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
mod my_module {
    pub struct MyStruct {
        field: i32,
    }
    
    impl MyStruct {
        fn method(&self) -> i32 {
            self.field
        }
    }
}

fn main() {
    let x = 42;
    {
        let y = x;
    }
}
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'rust');
      
      // Should have module, impl, function, and block scopes
      let module_count = 0;
      let class_count = 0;
      let function_count = 0;
      let block_count = 0;
      
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'module') module_count++;
        if (node.type === 'class') class_count++; // impl blocks
        if (node.type === 'function') function_count++;
        if (node.type === 'block') block_count++;
      }
      
      expect(module_count).toBeGreaterThanOrEqual(1); // Root is also a module in Rust
      expect(class_count).toBe(1); // impl block
      expect(function_count).toBe(2); // method and main
      expect(block_count).toBeGreaterThan(0);
    });
    
    it('should handle pattern matching scopes', () => {
      const parser = get_language_parser('rust');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
fn test(opt: Option<i32>) {
    match opt {
        Some(x) => println!("{}", x),
        None => {},
    }
    
    if let Some(y) = opt {
        println!("{}", y);
    }
}
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'rust');
      
      // Should create scopes for match and if let
      let block_count = 0;
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'block') block_count++;
      }
      
      expect(block_count).toBeGreaterThan(0);
    });
    
    it('should handle closures', () => {
      const parser = get_language_parser('rust');
      if (!parser) throw new Error('Parser not found');
      
      const code = `
fn main() {
    let closure = |x: i32| -> i32 {
        x * 2
    };
    
    let result = closure(5);
}
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_language_scope_tree(tree.rootNode, code, 'rust');
      
      // Should have scope for closure
      let function_count = 0;
      for (const [id, node] of scope_tree.nodes) {
        if (node.type === 'function') function_count++;
      }
      
      expect(function_count).toBe(2); // main and closure
    });
  });
});