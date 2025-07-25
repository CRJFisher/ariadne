/**
 * Type compilation tests for @ariadne/types
 * This file verifies that all exported types compile correctly
 */

import {
  // Common types
  Point,
  SimpleRange,
  Scoping,
  FunctionMetadata,
  Edit,
  ExtractedContext,
  LanguageConfig,
  SymbolKind,
  
  // Definition types
  Def,
  Ref,
  Import,
  Scope,
  Node,
  FunctionCall,
  ImportInfo,
  
  // Edge types
  DefToScope,
  RefToDef,
  ScopeToScope,
  ImportToScope,
  RefToImport,
  Edge,
  
  // Graph types
  Call,
  CallGraphOptions,
  CallGraphNode,
  CallGraphEdge,
  CallGraph
} from '../index';

// Test Point interface
const point: Point = {
  row: 0,
  column: 0
};

// Test SimpleRange interface
const range: SimpleRange = {
  start: { row: 0, column: 0 },
  end: { row: 10, column: 20 }
};

// Test Scoping enum
const scopingLocal: Scoping = Scoping.Local;
const scopingHoisted: Scoping = Scoping.Hoisted;
const scopingGlobal: Scoping = Scoping.Global;

// Test FunctionMetadata
const metadata: FunctionMetadata = {
  is_async: true,
  is_test: false,
  is_private: false,
  complexity: 5,
  line_count: 100,
  parameter_names: ['arg1', 'arg2'],
  has_decorator: true,
  class_name: 'MyClass'
};

// Test Edit interface
const edit: Edit = {
  start_byte: 0,
  old_end_byte: 100,
  new_end_byte: 150,
  start_position: { row: 0, column: 0 },
  old_end_position: { row: 5, column: 10 },
  new_end_position: { row: 7, column: 15 }
};

// Test Def interface
const def: Def = {
  kind: 'definition',
  id: 1,
  name: 'myFunction',
  symbol_kind: 'function',
  file_path: '/path/to/file.ts',
  symbol_id: 'module#myFunction',
  range: range,
  metadata: metadata,
  enclosing_range: range,
  signature: 'function myFunction(arg1: string, arg2: number): void',
  docstring: 'This is a function'
};

// Test Ref interface
const ref: Ref = {
  kind: 'reference',
  id: 2,
  name: 'myFunction',
  symbol_kind: 'function',
  range: range
};

// Test Import interface
const importNode: Import = {
  kind: 'import',
  id: 3,
  name: 'imported',
  source_name: 'original',
  source_module: './module',
  range: range
};

// Test Scope interface
const scope: Scope = {
  kind: 'scope',
  id: 4,
  range: range
};

// Test Node union type
const nodes: Node[] = [def, ref, importNode, scope];

// Test FunctionCall interface
const functionCall: FunctionCall = {
  caller_def: def,
  called_def: def,
  call_location: point,
  is_method_call: false
};

// Test Call interface
const call: Call = {
  symbol: 'module#function',
  range: range,
  kind: 'function',
  resolved_definition: def
};

// Test CallGraphOptions
const options: CallGraphOptions = {
  include_external: true,
  max_depth: 10,
  file_filter: (path: string) => path.endsWith('.ts')
};

// Test CallGraphNode
const callGraphNode: CallGraphNode = {
  symbol: 'module#function',
  definition: def,
  calls: [call],
  called_by: ['module#caller']
};

// Test CallGraphEdge
const edge: CallGraphEdge = {
  from: 'module#caller',
  to: 'module#callee',
  location: range
};

// Test CallGraph
const callGraph: CallGraph = {
  nodes: new Map([['module#function', callGraphNode]]),
  edges: [edge],
  top_level_nodes: ['module#main']
};

// Test Edge types
const defToScope: DefToScope = {
  kind: 'def_to_scope',
  source_id: 1,
  target_id: 2
};

const refToDef: RefToDef = {
  kind: 'ref_to_def',
  source_id: 3,
  target_id: 4
};

// Test SymbolKind type
const symbolKinds: SymbolKind[] = [
  'function',
  'method',
  'generator',
  'class',
  'variable',
  'const',
  'let',
  'constant',
  'import',
  'constructor'
];

// Test LanguageConfig
const languageConfig: LanguageConfig = {
  name: 'typescript',
  file_extensions: ['.ts', '.tsx'],
  scope_query: 'query',
  namespaces: [['namespace']],
  extract_context: (node, source_lines, start_line) => ({
    docstring: 'docs',
    decorators: ['@decorator']
  })
};

console.log('Type tests compiled successfully!');