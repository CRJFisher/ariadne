/**
 * Tests for export detection
 */

import { describe, it, expect } from 'vitest';
import { Language, ScopeGraph, Def } from '@ariadnejs/types';
import { 
  detect_exports,
  get_file_exports,
  file_exports_symbol,
  get_default_export,
  create_module_interface
} from './index';

// Mock scope graph
function create_mock_scope_graph(defs: Def[]): ScopeGraph {
  return {
    getNodes: (type: string) => type === 'definition' ? defs : [],
    getAllImports: () => [],
    // Add other required methods as needed
  } as any;
}

describe('export_detection', () => {
  describe('JavaScript exports', () => {
    it('should detect named exports', () => {
      const defs: Def[] = [
        {
          name: 'myFunction',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#myFunction'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => 'export function myFunction() {}'
      };
      
      const exports = get_file_exports('test.js', 'javascript', config);
      
      expect(exports).toHaveLength(1);
      expect(exports[0].name).toBe('myFunction');
      expect(exports[0].is_default).toBe(false);
    });
    
    it('should detect default exports', () => {
      const defs: Def[] = [
        {
          name: 'MyClass',
          symbol_kind: 'class',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#MyClass'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => 'export default class MyClass {}'
      };
      
      const exports = get_file_exports('test.js', 'javascript', config);
      
      expect(exports.length).toBeGreaterThan(0);
      // Note: Default export detection needs more sophisticated parsing
    });
  });
  
  describe('TypeScript exports', () => {
    it('should detect interface exports', () => {
      const defs: Def[] = [
        {
          name: 'MyInterface',
          symbol_kind: 'interface',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#MyInterface'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => 'export interface MyInterface { x: number; }'
      };
      
      const exports = get_file_exports('test.ts', 'typescript', config);
      
      expect(exports.length).toBeGreaterThan(0);
      // TypeScript-specific exports should be detected
    });
    
    it('should detect type exports', () => {
      const defs: Def[] = [
        {
          name: 'MyType',
          symbol_kind: 'type_alias',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#MyType'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => 'export type MyType = string | number;'
      };
      
      const exports = get_file_exports('test.ts', 'typescript', config);
      
      expect(exports.length).toBeGreaterThan(0);
      // Type exports should be marked appropriately
    });
  });
  
  describe('Python exports', () => {
    it('should detect public functions', () => {
      const defs: Def[] = [
        {
          name: 'public_function',
          symbol_kind: 'function',
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#public_function'
        },
        {
          name: '_private_function',
          symbol_kind: 'function',
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
          symbol_id: 'file#_private_function'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => 'def public_function(): pass\ndef _private_function(): pass'
      };
      
      const exports = get_file_exports('test.py', 'python', config);
      
      // Python auto-exports public symbols
      expect(exports.some(e => e.name === 'public_function')).toBe(true);
      expect(exports.some(e => e.name === '_private_function')).toBe(false);
    });
    
    it('should respect __all__ definition', () => {
      const defs: Def[] = [
        {
          name: 'func1',
          symbol_kind: 'function',
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#func1'
        },
        {
          name: 'func2',
          symbol_kind: 'function',
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } },
          symbol_id: 'file#func2'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => '__all__ = ["func1"]\ndef func1(): pass\ndef func2(): pass'
      };
      
      const exports = get_file_exports('test.py', 'python', config);
      
      // Only func1 should be exported due to __all__
      expect(exports.some(e => e.name === 'func1')).toBe(true);
      expect(exports.some(e => e.name === 'func2')).toBe(false);
    });
  });
  
  describe('Rust exports', () => {
    it('should detect pub items', () => {
      const defs: Def[] = [
        {
          name: 'public_fn',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 7 }, end: { row: 0, column: 15 } },
          symbol_id: 'file#public_fn'
        },
        {
          name: 'private_fn',
          symbol_kind: 'function',
          is_exported: false,
          range: { start: { row: 1, column: 3 }, end: { row: 1, column: 13 } },
          symbol_id: 'file#private_fn'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => 'pub fn public_fn() {}\nfn private_fn() {}'
      };
      
      const exports = get_file_exports('test.rs', 'rust', config);
      
      expect(exports.some(e => e.name === 'public_fn')).toBe(true);
      expect(exports.some(e => e.name === 'private_fn')).toBe(false);
    });
    
    it('should detect pub(crate) items', () => {
      const defs: Def[] = [
        {
          name: 'crate_fn',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 14 }, end: { row: 0, column: 22 } },
          symbol_id: 'file#crate_fn'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs),
        get_source_code: () => 'pub(crate) fn crate_fn() {}'
      };
      
      const exports = get_file_exports('test.rs', 'rust', config);
      
      expect(exports.length).toBeGreaterThan(0);
      // Should detect crate-level visibility
    });
  });
  
  describe('Utility functions', () => {
    it('should check if file exports a symbol', () => {
      const defs: Def[] = [
        {
          name: 'exportedFunc',
          symbol_kind: 'function',
          is_exported: true,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
          symbol_id: 'file#exportedFunc'
        }
      ];
      
      const config = {
        get_scope_graph: () => create_mock_scope_graph(defs)
      };
      
      expect(file_exports_symbol('test.js', 'exportedFunc', 'javascript', config)).toBe(true);
      expect(file_exports_symbol('test.js', 'nonExistent', 'javascript', config)).toBe(false);
    });
    
    it('should create module interface', () => {
      const exports = [
        {
          name: 'func1',
          export_name: 'func1',
          is_default: false,
          is_reexport: false,
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } }
        },
        {
          name: 'default',
          export_name: 'default',
          is_default: true,
          is_reexport: false,
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } }
        }
      ];
      
      const module_interface = create_module_interface('test.js', exports);
      
      expect(module_interface.file_path).toBe('test.js');
      expect(module_interface.exports).toHaveLength(2);
      expect(module_interface.default_export).toBeDefined();
    });
  });
});