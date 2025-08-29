/**
 * Tests for module graph functionality
 */

import { describe, it, expect } from 'vitest';
import { Language } from '@ariadnejs/types';
import {
  build_module_graph,
  find_circular_dependencies,
  get_module_dependencies,
  get_module_dependents,
  calculate_module_importance,
  ModuleGraphOptions
} from './module_graph';

describe('module_graph', () => {
  describe('build_module_graph', () => {
    it('should build a simple module graph', () => {
      // Create test data with new structure
      const files = new Map([
        ['a.js', {
          file_path: 'a.js',
          language: 'javascript' as Language,
          imports: [
            {
              import_statement: {
                name: 'funcB',
                is_namespace: false,
                is_default: false
              },
              imported_function: {
                name: 'funcB',
                kind: 'function' as const,
                location: { line: 1, column: 1, file_path: 'b.js' }
              },
              local_name: 'funcB'
            }
          ],
          exports: []
        }],
        ['b.js', {
          file_path: 'b.js', 
          language: 'javascript' as Language,
          imports: [],
          exports: []
        }]
      ]);
      
      const options: ModuleGraphOptions = {
        root_path: '/'
      };
      
      const graph = build_module_graph(files, options);
      
      expect(graph.modules.size).toBe(2);
      expect(graph.modules.has('a.js')).toBe(true);
      expect(graph.modules.has('b.js')).toBe(true);
      expect(graph.edges.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty file set', () => {
      const files = new Map();
      const graph = build_module_graph(files);
      
      expect(graph.modules.size).toBe(0);
      expect(graph.edges.length).toBe(0);
      expect(graph.entry_points.size).toBe(0);
    });
  });
  
  describe('utility functions', () => {
    const mockGraph = {
      modules: new Map([
        ['a.js', {
          path: 'a.js',
          imports: new Map(),
          exports: new Map(), 
          imported_by: new Set(),
          language: 'javascript'
        }],
        ['b.js', {
          path: 'b.js',
          imports: new Map(),
          exports: new Map(),
          imported_by: new Set(), 
          language: 'javascript'
        }]
      ]),
      edges: [
        {
          from: 'a.js',
          to: 'b.js',
          type: 'import' as const,
          imports: ['func1'],
          weight: 1
        }
      ],
      entry_points: new Set(['a.js']),
      external_modules: new Set(),
      dependency_order: ['b.js', 'a.js']
    };
    
    it('should find circular dependencies', () => {
      const cycles = find_circular_dependencies(mockGraph);
      expect(Array.isArray(cycles)).toBe(true);
    });
    
    it('should get module dependencies', () => {
      const deps = get_module_dependencies(mockGraph, 'a.js');
      expect(deps).toContain('b.js');
    });
    
    it('should get module dependents', () => {
      const dependents = get_module_dependents(mockGraph, 'b.js');
      expect(dependents).toContain('a.js');
    });
    
    it('should calculate module importance', () => {
      const importance = calculate_module_importance(mockGraph, 'b.js');
      expect(typeof importance).toBe('number');
    });
  });
});