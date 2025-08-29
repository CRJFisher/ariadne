/**
 * Tests for module graph functionality
 */

import { describe, it, expect } from 'vitest';
import { Language, ScopeGraph, Import } from '@ariadnejs/types';
import {
  build_module_graph,
  find_circular_dependencies,
  get_module_dependencies,
  get_module_dependents,
  calculate_module_importance,
  create_module_graph_builder,
  analyze_module_graph,
} from './index';

// Mock scope graph
function create_mock_scope_graph(imports: Import[]): ScopeGraph {
  return {
    getAllImports: () => imports,
    getNodes: () => [],
  } as any;
}

describe('module_graph', () => {
  describe('build_module_graph', () => {
    it('should build a simple module graph', () => {
      const imports_a: Import[] = [
        { name: 'funcB', source_module: 'b.js' }
      ];
      const imports_b: Import[] = [
        { name: 'funcC', source_module: 'c.js' }
      ];
      
      const graphs = new Map([
        ['a.js', create_mock_scope_graph(imports_a)],
        ['b.js', create_mock_scope_graph(imports_b)],
        ['c.js', create_mock_scope_graph([])]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path),
        resolve_module_path: (from: string, to: string) => to
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['a.js', 'b.js', 'c.js'], context);
      
      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.length).toBe(2);
      expect(graph.edges[0]).toMatchObject({
        from: 'a.js',
        to: 'b.js',
        type: 'import'
      });
    });
    
    it('should detect entry points', () => {
      const graphs = new Map([
        ['index.js', create_mock_scope_graph([])],
        ['util.js', create_mock_scope_graph([])]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path)
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['index.js', 'util.js'], context);
      
      expect(graph.entry_points.has('index.js')).toBe(true);
      expect(graph.entry_points.has('util.js')).toBe(false);
    });
    
    it('should detect external modules', () => {
      const imports: Import[] = [
        { name: 'React', source_module: 'react' },
        { name: 'local', source_module: './local.js' }
      ];
      
      const graphs = new Map([
        ['app.js', create_mock_scope_graph(imports)]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path),
        include_external: true
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['app.js'], context);
      
      expect(graph.external_modules.has('react')).toBe(true);
      expect(graph.external_modules.has('./local.js')).toBe(false);
    });
  });
  
  describe('find_circular_dependencies', () => {
    it('should detect circular dependencies', () => {
      // Create a graph with A -> B -> C -> A cycle
      const imports_a: Import[] = [{ name: 'b', source_module: 'b.js' }];
      const imports_b: Import[] = [{ name: 'c', source_module: 'c.js' }];
      const imports_c: Import[] = [{ name: 'a', source_module: 'a.js' }];
      
      const graphs = new Map([
        ['a.js', create_mock_scope_graph(imports_a)],
        ['b.js', create_mock_scope_graph(imports_b)],
        ['c.js', create_mock_scope_graph(imports_c)]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path)
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['a.js', 'b.js', 'c.js'], context);
      const cycles = find_circular_dependencies(graph);
      
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('a.js');
      expect(cycles[0]).toContain('b.js');
      expect(cycles[0]).toContain('c.js');
    });
    
    it('should not detect cycles in acyclic graph', () => {
      const imports_a: Import[] = [{ name: 'b', source_module: 'b.js' }];
      const imports_b: Import[] = [{ name: 'c', source_module: 'c.js' }];
      
      const graphs = new Map([
        ['a.js', create_mock_scope_graph(imports_a)],
        ['b.js', create_mock_scope_graph(imports_b)],
        ['c.js', create_mock_scope_graph([])]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path)
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['a.js', 'b.js', 'c.js'], context);
      const cycles = find_circular_dependencies(graph);
      
      expect(cycles).toHaveLength(0);
    });
  });
  
  describe('get_module_dependencies', () => {
    it('should get direct dependencies', () => {
      const imports_a: Import[] = [
        { name: 'b', source_module: 'b.js' },
        { name: 'c', source_module: 'c.js' }
      ];
      
      const graphs = new Map([
        ['a.js', create_mock_scope_graph(imports_a)],
        ['b.js', create_mock_scope_graph([])],
        ['c.js', create_mock_scope_graph([])]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path)
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['a.js', 'b.js', 'c.js'], context);
      const deps = get_module_dependencies('a.js', graph, false);
      
      expect(deps.size).toBe(2);
      expect(deps.has('b.js')).toBe(true);
      expect(deps.has('c.js')).toBe(true);
    });
    
    it('should get transitive dependencies', () => {
      const imports_a: Import[] = [{ name: 'b', source_module: 'b.js' }];
      const imports_b: Import[] = [{ name: 'c', source_module: 'c.js' }];
      
      const graphs = new Map([
        ['a.js', create_mock_scope_graph(imports_a)],
        ['b.js', create_mock_scope_graph(imports_b)],
        ['c.js', create_mock_scope_graph([])]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path)
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['a.js', 'b.js', 'c.js'], context);
      const deps = get_module_dependencies('a.js', graph, true);
      
      expect(deps.size).toBe(2);
      expect(deps.has('b.js')).toBe(true);
      expect(deps.has('c.js')).toBe(true);
    });
  });
  
  describe('analyze_module_graph', () => {
    it('should perform comprehensive analysis', () => {
      const imports_a: Import[] = [{ name: 'b', source_module: 'b.js' }];
      const imports_b: Import[] = [{ name: 'c', source_module: 'c.js' }];
      const imports_d: Import[] = [];  // Unused module
      
      const graphs = new Map([
        ['index.js', create_mock_scope_graph(imports_a)],
        ['b.js', create_mock_scope_graph(imports_b)],
        ['c.js', create_mock_scope_graph([])],
        ['d.js', create_mock_scope_graph(imports_d)]
      ]);
      
      const config = {
        get_scope_graph: (path: string) => graphs.get(path)
      };
      
      const context = {
        language: 'javascript' as Language,
        root_path: '/',
        config
      };
      
      const graph = build_module_graph(['index.js', 'b.js', 'c.js', 'd.js'], context);
      const analysis = analyze_module_graph(graph);
      
      expect(analysis.circular_dependencies).toHaveLength(0);
      expect(analysis.unused_modules).toContain('d.js');
      expect(analysis.most_imported.length).toBeGreaterThan(0);
      expect(analysis.module_importance.size).toBe(4);
    });
  });
  
});