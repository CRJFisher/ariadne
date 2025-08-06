import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportResolver } from '../src/project/import_resolver';
import { ProjectState } from '../src/storage/storage_interface';
import { Import, Def } from '@ariadnejs/types';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs');

describe('ImportResolver', () => {
  // Create a minimal mock state for testing
  const createMockState = (): ProjectState => {
    const mockFileGraphs = new Map();
    
    // Create mock graphs with necessary methods
    const libGraph = {
      findExportedDef: (name: string) => {
        if (name === 'libraryFunction') {
          return {
            id: 1,
            kind: 'definition',
            name: 'libraryFunction',
            symbol_id: 'lib#libraryFunction',
            symbol_kind: 'function',
            range: { start: { row: 0, column: 0 }, end: { row: 2, column: 1 } },
            file_path: 'lib.ts',
            is_exported: true
          } as Def;
        }
        return null;
      },
      getAllImports: () => [],
      getNodes: (kind: string) => {
        if (kind === 'definition') {
          return [{
            id: 1,
            kind: 'definition',
            name: 'libraryFunction',
            symbol_id: 'lib#libraryFunction',
            symbol_kind: 'function',
            range: { start: { row: 0, column: 0 }, end: { row: 2, column: 1 } },
            file_path: 'lib.ts',
            is_exported: true
          }];
        }
        if (kind === 'import') {
          return [];
        }
        return [];
      }
    };
    
    const mainGraph = {
      findExportedDef: (name: string) => null,
      getAllImports: () => [{
        id: 2,
        kind: 'import',
        name: 'libraryFunction',
        source_module: './lib',
        range: { start: { row: 0, column: 9 }, end: { row: 0, column: 24 } }
      }],
      getNodes: (kind: string) => {
        if (kind === 'import') {
          return [{
            id: 2,
            kind: 'import',
            name: 'libraryFunction',
            source_module: './lib',
            range: { start: { row: 0, column: 9 }, end: { row: 0, column: 24 } }
          }];
        }
        return [];
      }
    };
    
    mockFileGraphs.set('lib.ts', libGraph);
    mockFileGraphs.set('main.ts', mainGraph);
    
    return {
      file_graphs: mockFileGraphs,
      file_cache: new Map(),
      call_graph_data: {
        fileGraphs: new Map(),
        fileCache: new Map(),
        fileTypeTrackers: new Map(),
        projectTypeRegistry: {
          exportedTypes: new Map(),
          fileExports: new Map()
        },
        languages: new Map()
      },
      inheritance_map: new Map(),
      languages: new Map()
    };
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('resolveImport', () => {
    it('should resolve an import to its definition', () => {
      const state = createMockState();
      const resolver = new ImportResolver();
      
      const importDef: Def = {
        id: 3,
        kind: 'definition',
        name: 'libraryFunction',
        symbol_id: 'main#libraryFunction',
        symbol_kind: 'import',
        range: { start: { row: 0, column: 9 }, end: { row: 0, column: 24 } },
        file_path: 'main.ts'
      };
      
      const resolved = resolver.resolveImport(importDef, 'main.ts', state);
      
      expect(resolved).toBeDefined();
      expect(resolved?.name).toBe('libraryFunction');
      expect(resolved?.file_path).toBe('lib.ts');
      expect(resolved?.symbol_kind).toBe('function');
    });
    
    it('should return non-import definitions as-is', () => {
      const state = createMockState();
      const resolver = new ImportResolver();
      
      const funcDef: Def = {
        id: 4,
        kind: 'definition',
        name: 'localFunction',
        symbol_id: 'main#localFunction',
        symbol_kind: 'function',
        range: { start: { row: 5, column: 0 }, end: { row: 7, column: 1 } },
        file_path: 'main.ts'
      };
      
      const resolved = resolver.resolveImport(funcDef, 'main.ts', state);
      
      expect(resolved).toBe(funcDef);
      expect(resolved?.symbol_kind).toBe('function');
    });
  });
  
  describe('getImportsWithDefinitions', () => {
    it('should return empty array for file with no imports', () => {
      const state = createMockState();
      const resolver = new ImportResolver();
      
      const imports = resolver.getImportsWithDefinitions(state, 'lib.ts');
      
      expect(imports).toEqual([]);
    });
    
    it('should resolve imports to their definitions', () => {
      const state = createMockState();
      const resolver = new ImportResolver();
      
      const imports = resolver.getImportsWithDefinitions(state, 'main.ts');
      
      expect(imports).toHaveLength(1);
      expect(imports[0].local_name).toBe('libraryFunction');
      expect(imports[0].imported_function.name).toBe('libraryFunction');
      expect(imports[0].imported_function.file_path).toBe('lib.ts');
    });
  });
  
  describe('resolveModulePath', () => {
    it('should resolve TypeScript relative imports', () => {
      const resolver = new ImportResolver();
      
      // Mock fs functions for TypeScript
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        if (path === '/Users/test/src/lib.ts') return true;
        if (path === '/Users/test/src/lib') return false;
        return false;
      });
      
      const resolved = resolver.resolveModulePath('/Users/test/src/main.ts', './lib');
      
      expect(resolved).toBe('/Users/test/src/lib.ts');
    });
    
    it('should resolve Python imports', () => {
      const resolver = new ImportResolver();
      
      // Mock fs functions for Python
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        if (path === '/Users/test/src/lib.py') return true;
        if (path === '/Users/test/src/lib') return false;
        return false;
      });
      
      const resolved = resolver.resolveModulePath('/Users/test/src/main.py', 'lib');
      
      expect(resolved).toBe('/Users/test/src/lib.py');
    });
    
    it('should resolve Rust module paths', () => {
      const resolver = new ImportResolver();
      
      // Mock fs functions for Rust
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        if (path === '/Users/test/src/lib.rs') return true;
        if (path === '/Users/test/src/lib') return false;
        return false;
      });
      
      const resolved = resolver.resolveModulePath('/Users/test/src/main.rs', 'lib');
      
      expect(resolved).toBe('/Users/test/src/lib.rs');
    });
  });
});