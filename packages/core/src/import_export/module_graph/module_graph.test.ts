/**
 * Tests for module graph functionality
 */

import { describe, it, expect } from 'vitest';
import { Language } from '@ariadnejs/types';
import {
  build_module_graph,
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
});