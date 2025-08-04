import { describe, it, expect, beforeEach } from 'vitest';
import {
  detect_file_exports,
  detect_file_imports,
  analyze_file_import_export,
  is_class_export,
  is_function_export,
  ExportDetectionResult,
  ImportDetectionResult
} from '../src/call_graph/import_export_detector';
import { ScopeGraph, Def, Ref, DefKind, RefKind } from '../src/graph';
import { FileCache } from '../src/file_cache';
import { TreeNode } from '../src/parse';

// Mock TreeNode for tests
function createMockTree(): TreeNode {
  return {
    type: 'program',
    start_position: { row: 0, column: 0 },
    end_position: { row: 10, column: 0 },
    children: []
  } as TreeNode;
}

// Create a mock graph with pre-populated nodes
function createMockGraph(nodes: (Def | Ref)[]): ScopeGraph {
  const mockRootNode = {
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 100, column: 0 },
    type: 'program',
    children: []
  };
  const graph = new ScopeGraph(mockRootNode as any);
  
  // Add definitions
  for (const node of nodes) {
    if (node.kind === 'definition') {
      graph.insert_global_def(node as Def);
    } else if (node.kind === 'reference') {
      graph.insert_ref(node as Ref);
    }
  }
  
  return graph;
}

describe('Immutable Import/Export Detection', () => {
  let mockFileCache: FileCache;

  beforeEach(() => {
    mockFileCache = {
      source_code: '',
      tree: createMockTree(),
      language: 'typescript'
    } as FileCache;
  });

  describe('detect_file_exports', () => {
    describe('Python exports', () => {
      it('should export all top-level non-private functions and classes', () => {
        const file_path = 'test.py';
        
        // Add mock definitions
        const publicClass: Def = {
          id: 1,
          kind: 'definition',
          name: 'MyClass',
          symbol_kind: 'class',
          symbol_id: 'test#MyClass',
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 7 } },
          file_path
        };
        
        const publicFunction: Def = {
          id: 2,
          kind: 'definition',
          name: 'my_function',
          symbol_kind: 'function',
          symbol_id: 'test#my_function',
          range: { start: { row: 5, column: 0 }, end: { row: 5, column: 11 } },
          file_path
        };
        
        const privateFunction: Def = {
          id: 3,
          kind: 'definition',
          name: '_private_func',
          symbol_kind: 'function',
          symbol_id: 'test#_private_func',
          range: { start: { row: 10, column: 0 }, end: { row: 10, column: 13 } },
          file_path
        };
        
        const mockGraph = createMockGraph([publicClass, publicFunction, privateFunction]);
        
        const exports = detect_file_exports(file_path, mockGraph, mockFileCache);
        
        expect(exports).toHaveLength(2);
        expect(exports[0]).toEqual({
          name: 'MyClass',
          exportName: 'MyClass',
          definition: publicClass,
          isDefault: false,
          range: publicClass.range
        });
        expect(exports[1]).toEqual({
          name: 'my_function',
          exportName: 'my_function',
          definition: publicFunction,
          isDefault: false,
          range: publicFunction.range
        });
      });
    });

    describe('Rust exports', () => {
      it('should export only pub items', () => {
        const file_path = 'test.rs';
        
        const pubStruct: Def = {
          id: 1,
          kind: 'definition',
          name: 'MyStruct',
          symbol_kind: 'struct',
          symbol_id: 'test#MyStruct',
          range: { start: { row: 1, column: 0 }, end: { row: 1, column: 8 } },
          file_path,
          is_exported: true
        };
        
        const privateStruct: Def = {
          id: 2,
          kind: 'definition',
          name: 'PrivateStruct',
          symbol_kind: 'struct',
          symbol_id: 'test#PrivateStruct',
          range: { start: { row: 5, column: 0 }, end: { row: 5, column: 13 } },
          file_path,
          is_exported: false
        };
        
        const mockGraph = createMockGraph([pubStruct, privateStruct]);
        
        const exports = detect_file_exports(file_path, mockGraph, mockFileCache);
        
        expect(exports).toHaveLength(1);
        expect(exports[0]).toEqual({
          name: 'MyStruct',
          exportName: 'MyStruct',
          definition: pubStruct,
          isDefault: false,
          range: pubStruct.range
        });
      });
    });

    describe('JavaScript CommonJS exports', () => {
      it('should detect module.exports = ClassName', () => {
        const file_path = 'test.js';
        mockFileCache.source_code = `
class MyClass {
  constructor() {}
}

module.exports = MyClass;
`;
        
        const classDef: Def = {
          id: 1,
          kind: 'definition',
          name: 'MyClass',
          symbol_kind: 'class',
          symbol_id: 'test#MyClass',
          range: { start: { row: 1, column: 6 }, end: { row: 1, column: 13 } },
          file_path
        };
        
        const mockGraph = createMockGraph([classDef]);
        
        const exports = detect_file_exports(file_path, mockGraph, mockFileCache);
        
        expect(exports).toHaveLength(1);
        expect(exports[0].name).toBe('MyClass');
        expect(exports[0].exportName).toBe('default');
        expect(exports[0].isDefault).toBe(true);
        expect(exports[0].definition).toEqual(classDef);
      });

      it('should detect module.exports = { func1, Class1 }', () => {
        const file_path = 'test.js';
        mockFileCache.source_code = `
function func1() {}
class Class1 {}

module.exports = { func1, Class1 };
`;
        
        const funcDef: Def = {
          id: 1,
          kind: 'definition',
          name: 'func1',
          symbol_kind: 'function',
          symbol_id: 'test#func1',
          range: { start: { row: 1, column: 9 }, end: { row: 1, column: 14 } },
          file_path
        };
        
        const classDef: Def = {
          id: 2,
          kind: 'definition',
          name: 'Class1',
          symbol_kind: 'class',
          symbol_id: 'test#Class1',
          range: { start: { row: 2, column: 6 }, end: { row: 2, column: 12 } },
          file_path
        };
        
        const mockGraph = createMockGraph([funcDef, classDef]);
        
        const exports = detect_file_exports(file_path, mockGraph, mockFileCache);
        
        expect(exports).toHaveLength(2);
        expect(exports.map(e => e.name)).toContain('func1');
        expect(exports.map(e => e.name)).toContain('Class1');
        expect(exports.every(e => !e.isDefault)).toBe(true);
      });

      it('should detect exports.name = value pattern', () => {
        const file_path = 'test.js';
        mockFileCache.source_code = `
function myFunc() {}
exports.myFunc = myFunc;
exports.renamed = myFunc;
`;
        
        const funcDef: Def = {
          id: 1,
          kind: 'definition',
          name: 'myFunc',
          symbol_kind: 'function',
          symbol_id: 'test#myFunc',
          range: { start: { row: 1, column: 9 }, end: { row: 1, column: 15 } },
          file_path
        };
        
        const mockGraph = createMockGraph([funcDef]);
        
        const exports = detect_file_exports(file_path, mockGraph, mockFileCache);
        
        expect(exports).toHaveLength(2);
        expect(exports[0].name).toBe('myFunc');
        expect(exports[0].exportName).toBe('myFunc');
        expect(exports[1].name).toBe('myFunc');
        expect(exports[1].exportName).toBe('renamed');
      });
    });

    describe('ES6 exports', () => {
      it('should detect export function/class declarations', () => {
        const file_path = 'test.ts';
        mockFileCache.source_code = `
export function myFunc() {}
export class MyClass {}
export default class DefaultClass {}
`;
        
        const funcDef: Def = {
          id: 1,
          kind: 'definition',
          name: 'myFunc',
          symbol_kind: 'function',
          symbol_id: 'test#myFunc',
          range: { start: { row: 1, column: 16 }, end: { row: 1, column: 22 } },
          file_path
        };
        
        const classDef: Def = {
          id: 2,
          kind: 'definition',
          name: 'MyClass',
          symbol_kind: 'class',
          symbol_id: 'test#MyClass',
          range: { start: { row: 2, column: 13 }, end: { row: 2, column: 20 } },
          file_path
        };
        
        const defaultClassDef: Def = {
          id: 3,
          kind: 'definition',
          name: 'DefaultClass',
          symbol_kind: 'class',
          symbol_id: 'test#DefaultClass',
          range: { start: { row: 3, column: 21 }, end: { row: 3, column: 33 } },
          file_path
        };
        
        const mockGraph = createMockGraph([funcDef, classDef, defaultClassDef]);
        
        const exports = detect_file_exports(file_path, mockGraph, mockFileCache);
        
        expect(exports).toHaveLength(3);
        
        const funcExport = exports.find(e => e.name === 'myFunc');
        expect(funcExport?.isDefault).toBe(false);
        expect(funcExport?.exportName).toBe('myFunc');
        
        const classExport = exports.find(e => e.name === 'MyClass');
        expect(classExport?.isDefault).toBe(false);
        expect(classExport?.exportName).toBe('MyClass');
        
        const defaultExport = exports.find(e => e.name === 'DefaultClass');
        expect(defaultExport?.isDefault).toBe(true);
        expect(defaultExport?.exportName).toBe('default');
      });
    });
  });

  describe('detect_file_imports', () => {
    describe('Python imports', () => {
      it('should detect simple imports', () => {
        const file_path = 'test.py';
        mockFileCache.source_code = `
import os
import sys
from pathlib import Path
from typing import List, Dict as DictType
`;
        
        const mockGraph = createMockGraph([]);
        const imports = detect_file_imports(file_path, mockGraph, mockFileCache);
        
        expect(imports).toHaveLength(5);
        
        // Simple imports
        expect(imports[0]).toMatchObject({
          localName: 'os',
          importedName: 'os',
          sourcePath: 'os',
          isNamespace: true
        });
        
        // From imports
        const pathImport = imports.find(i => i.localName === 'Path');
        expect(pathImport).toMatchObject({
          localName: 'Path',
          importedName: 'Path',
          sourcePath: 'pathlib',
          isNamespace: false
        });
        
        // Renamed import
        const dictImport = imports.find(i => i.localName === 'DictType');
        expect(dictImport).toMatchObject({
          localName: 'DictType',
          importedName: 'Dict',
          sourcePath: 'typing',
          isNamespace: false
        });
      });
    });

    describe('Rust imports', () => {
      it('should detect use statements', () => {
        const file_path = 'test.rs';
        mockFileCache.source_code = `
use std::collections::HashMap;
use crate::utils::helper;
use super::parent_module;
`;
        
        const mockGraph = createMockGraph([]);
        const imports = detect_file_imports(file_path, mockGraph, mockFileCache);
        
        expect(imports).toHaveLength(3);
        expect(imports[0]).toMatchObject({
          localName: 'HashMap',
          importedName: 'HashMap',
          sourcePath: 'std::collections::HashMap'
        });
        expect(imports[1]).toMatchObject({
          localName: 'helper',
          importedName: 'helper',
          sourcePath: 'crate::utils::helper'
        });
      });
    });

    describe('JavaScript CommonJS imports', () => {
      it('should detect require statements', () => {
        const file_path = 'test.js';
        mockFileCache.source_code = `
const fs = require('fs');
const { readFile } = require('fs/promises');
const MyClass = require('./myclass');
`;
        
        const mockGraph = createMockGraph([]);
        const imports = detect_file_imports(file_path, mockGraph, mockFileCache);
        
        expect(imports).toHaveLength(2); // fs and MyClass
        expect(imports[0]).toMatchObject({
          localName: 'fs',
          importedName: 'default',
          sourcePath: 'fs',
          isDefault: true
        });
        expect(imports[1]).toMatchObject({
          localName: 'MyClass',
          importedName: 'default',
          sourcePath: './myclass',
          isDefault: true
        });
      });
    });

    describe('ES6 imports', () => {
      it('should detect various import patterns', () => {
        const file_path = 'test.ts';
        mockFileCache.source_code = `
import React from 'react';
import { Component, useState as useStateHook } from 'react';
import * as lodash from 'lodash';
import './styles.css';
`;
        
        const mockGraph = createMockGraph([]);
        const imports = detect_file_imports(file_path, mockGraph, mockFileCache);
        
        expect(imports).toHaveLength(4);
        
        // Default import
        expect(imports[0]).toMatchObject({
          localName: 'React',
          importedName: 'default',
          sourcePath: 'react',
          isDefault: true,
          isNamespace: false
        });
        
        // Named imports
        const componentImport = imports.find(i => i.localName === 'Component');
        expect(componentImport).toMatchObject({
          localName: 'Component',
          importedName: 'Component',
          sourcePath: 'react',
          isDefault: false
        });
        
        // Renamed import
        const useStateImport = imports.find(i => i.localName === 'useStateHook');
        expect(useStateImport).toMatchObject({
          localName: 'useStateHook',
          importedName: 'useState',
          sourcePath: 'react',
          isDefault: false
        });
        
        // Namespace import
        const lodashImport = imports.find(i => i.localName === 'lodash');
        expect(lodashImport).toMatchObject({
          localName: 'lodash',
          importedName: '*',
          sourcePath: 'lodash',
          isNamespace: true
        });
      });
    });
  });

  describe('analyze_file_import_export', () => {
    it('should detect both imports and exports', () => {
      const file_path = 'test.ts';
      mockFileCache.source_code = `
import { BaseClass } from './base';

export class MyClass extends BaseClass {
  constructor() {
    super();
  }
}

export function helper() {
  return new MyClass();
}
`;
      
      const classDef: Def = {
        id: 1,
        kind: 'definition',
        name: 'MyClass',
        symbol_kind: 'class',
        symbol_id: 'test#MyClass',
        range: { start: { row: 3, column: 13 }, end: { row: 3, column: 20 } },
        file_path
      };
      
      const funcDef: Def = {
        id: 2,
        kind: 'definition',
        name: 'helper',
        symbol_kind: 'function',
        symbol_id: 'test#helper',
        range: { start: { row: 9, column: 16 }, end: { row: 9, column: 22 } },
        file_path
      };
      
      const mockGraph = createMockGraph([classDef, funcDef]);
      
      const result = analyze_file_import_export(file_path, mockGraph, mockFileCache);
      
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        localName: 'BaseClass',
        importedName: 'BaseClass',
        sourcePath: './base'
      });
      
      expect(result.exports).toHaveLength(2);
      expect(result.exports.map(e => e.name)).toContain('MyClass');
      expect(result.exports.map(e => e.name)).toContain('helper');
    });
  });

  describe('Helper functions', () => {
    it('should correctly identify class exports', () => {
      const classExport: ExportDetectionResult = {
        name: 'MyClass',
        exportName: 'MyClass',
        definition: {
          id: 1,
          kind: 'definition',
          name: 'MyClass',
          symbol_kind: 'class',
          symbol_id: 'test#MyClass',
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 7 } },
          file_path: 'test.ts'
        },
        isDefault: false,
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 7 } }
      };
      
      expect(is_class_export(classExport)).toBe(true);
      expect(is_function_export(classExport)).toBe(false);
    });

    it('should correctly identify function exports', () => {
      const funcExport: ExportDetectionResult = {
        name: 'myFunc',
        exportName: 'myFunc',
        definition: {
          id: 1,
          kind: 'definition',
          name: 'myFunc',
          symbol_kind: 'function',
          symbol_id: 'test#myFunc',
          range: { start: { row: 0, column: 0 }, end: { row: 0, column: 6 } },
          file_path: 'test.ts'
        },
        isDefault: false,
        range: { start: { row: 0, column: 0 }, end: { row: 0, column: 6 } }
      };
      
      expect(is_function_export(funcExport)).toBe(true);
      expect(is_class_export(funcExport)).toBe(false);
    });
  });
});