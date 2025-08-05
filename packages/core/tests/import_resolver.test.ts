import { describe, it, expect } from 'vitest';
import { ImportResolver } from '../src/project/import_resolver';
import { ProjectState } from '../src/storage/storage_interface';
import { ScopeGraph } from '../src/graph';
import { Import, Def } from '@ariadnejs/types';

describe('ImportResolver', () => {
  const createMockState = (): ProjectState => {
    const libGraph = new ScopeGraph('typescript', 'lib.ts');
    const mainGraph = new ScopeGraph('typescript', 'main.ts');
    
    // Add a function definition to lib.ts
    const libFunc: Def = {
      id: 1,
      kind: 'definition',
      name: 'libraryFunction',
      symbol_id: 'lib#libraryFunction',
      symbol_kind: 'function',
      range: {
        start: { row: 0, column: 0 },
        end: { row: 2, column: 1 }
      },
      file_path: 'lib.ts',
      is_exported: true
    };
    libGraph.insert('definition', libFunc);
    
    // Add an import to main.ts
    const importStatement: Import = {
      id: 2,
      kind: 'import',
      name: 'libraryFunction',
      source_module: './lib',
      range: {
        start: { row: 0, column: 9 },
        end: { row: 0, column: 24 }
      }
    };
    mainGraph.insert('import', importStatement);
    
    return {
      file_graphs: new Map([
        ['lib.ts', libGraph],
        ['main.ts', mainGraph]
      ]),
      file_cache: new Map(),
      call_graph_data: {
        fileGraphs: new Map(),
        fileCache: new Map(),
        fileTypeTrackers: new Map(),
        projectTypeRegistry: new Map(),
        languages: new Map()
      },
      inheritance_map: new Map(),
      languages: new Map()
    };
  };
  
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
        range: {
          start: { row: 0, column: 9 },
          end: { row: 0, column: 24 }
        },
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
        range: {
          start: { row: 5, column: 0 },
          end: { row: 7, column: 1 }
        },
        file_path: 'main.ts'
      };
      
      const resolved = resolver.resolveImport(funcDef, 'main.ts', state);
      
      expect(resolved).toBe(funcDef);
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
      
      // Mock the necessary methods on ScopeGraph
      const mainGraph = state.file_graphs.get('main.ts');
      if (mainGraph) {
        mainGraph.getAllImports = () => [{
          id: 2,
          kind: 'import',
          name: 'libraryFunction',
          source_module: './lib',
          range: {
            start: { row: 0, column: 9 },
            end: { row: 0, column: 24 }
          }
        }];
        
        const libGraph = state.file_graphs.get('lib.ts');
        if (libGraph) {
          libGraph.findExportedDef = (name: string) => {
            if (name === 'libraryFunction') {
              return {
                id: 1,
                kind: 'definition',
                name: 'libraryFunction',
                symbol_id: 'lib#libraryFunction',
                symbol_kind: 'function',
                range: {
                  start: { row: 0, column: 0 },
                  end: { row: 2, column: 1 }
                },
                file_path: 'lib.ts',
                is_exported: true
              } as Def;
            }
            return undefined;
          };
        }
      }
      
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
      
      const resolved = resolver.resolveModulePath('src/main.ts', './lib');
      
      expect(resolved).toBe('src/lib.ts');
    });
    
    it('should resolve Python imports', () => {
      const resolver = new ImportResolver();
      
      const resolved = resolver.resolveModulePath('src/main.py', 'lib');
      
      expect(resolved).toBe('src/lib.py');
    });
    
    it('should resolve Rust module paths', () => {
      const resolver = new ImportResolver();
      
      const resolved = resolver.resolveModulePath('src/main.rs', 'lib');
      
      expect(resolved).toBe('src/lib.rs');
    });
  });
});