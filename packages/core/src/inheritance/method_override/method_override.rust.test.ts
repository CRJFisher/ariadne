/**
 * Tests for Rust-specific method override handling
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import { handle_rust_trait_implementations } from './method_override.rust';
import { MethodOverrideContext } from './method_override';
import { get_language_config } from './language_configs';

describe('Rust Method Override Bespoke Handler', () => {
  it('should detect trait implementations', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);
    const config = get_language_config('rust')!;
    
    const code = `
      trait Display {
        fn fmt(&self) -> String;
      }
      
      struct Point {
        x: i32,
        y: i32,
      }
      
      impl Display for Point {
        fn fmt(&self) -> String {
          format!("({}, {})", self.x, self.y)
        }
      }
    `;
    
    const tree = parser.parse(code);
    
    const context: MethodOverrideContext = {
      config,
      hierarchy: {
        classes: new Map(),
        edges: [],
        roots: [],
        language: 'rust'
      },
      all_methods: new Map(),
      overrides: new Map(),
      override_edges: [],
      leaf_methods: [],
      abstract_methods: []
    };
    
    handle_rust_trait_implementations(tree.rootNode, 'test.rs', parser, context);
    
    // Should create override edge for trait implementation
    expect(context.override_edges).toHaveLength(1);
    expect(context.override_edges[0].method.name).toBe('fmt');
    expect(context.override_edges[0].is_explicit).toBe(true);
    expect(context.override_edges[0].language).toBe('rust');
  });
  
  it('should handle inherent impl blocks', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);
    const config = get_language_config('rust')!;
    
    const code = `
      struct Point {
        x: i32,
        y: i32,
      }
      
      impl Point {
        fn new(x: i32, y: i32) -> Self {
          Point { x, y }
        }
        
        fn distance(&self) -> f64 {
          ((self.x * self.x + self.y * self.y) as f64).sqrt()
        }
      }
    `;
    
    const tree = parser.parse(code);
    
    const context: MethodOverrideContext = {
      config,
      hierarchy: {
        classes: new Map(),
        edges: [],
        roots: [],
        language: 'rust'
      },
      all_methods: new Map(),
      overrides: new Map(),
      override_edges: [],
      leaf_methods: [],
      abstract_methods: []
    };
    
    handle_rust_trait_implementations(tree.rootNode, 'test.rs', parser, context);
    
    // Inherent impl blocks don't create override edges
    expect(context.override_edges).toHaveLength(0);
  });
  
  it('should handle multiple trait implementations', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);
    const config = get_language_config('rust')!;
    
    const code = `
      trait Display {
        fn fmt(&self) -> String;
      }
      
      trait Debug {
        fn debug(&self) -> String;
      }
      
      struct Point {
        x: i32,
        y: i32,
      }
      
      impl Display for Point {
        fn fmt(&self) -> String {
          format!("({}, {})", self.x, self.y)
        }
      }
      
      impl Debug for Point {
        fn debug(&self) -> String {
          format!("Point {{ x: {}, y: {} }}", self.x, self.y)
        }
      }
    `;
    
    const tree = parser.parse(code);
    
    const context: MethodOverrideContext = {
      config,
      hierarchy: {
        classes: new Map(),
        edges: [],
        roots: [],
        language: 'rust'
      },
      all_methods: new Map(),
      overrides: new Map(),
      override_edges: [],
      leaf_methods: [],
      abstract_methods: []
    };
    
    handle_rust_trait_implementations(tree.rootNode, 'test.rs', parser, context);
    
    // Should create override edges for both trait implementations
    expect(context.override_edges).toHaveLength(2);
    
    const fmt_edge = context.override_edges.find(e => e.method.name === 'fmt');
    const debug_edge = context.override_edges.find(e => e.method.name === 'debug');
    
    expect(fmt_edge).toBeDefined();
    expect(debug_edge).toBeDefined();
    expect(fmt_edge?.is_explicit).toBe(true);
    expect(debug_edge?.is_explicit).toBe(true);
  });
});