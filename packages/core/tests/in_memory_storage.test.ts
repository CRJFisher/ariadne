import { describe, test, expect } from 'vitest';
import { InMemoryStorage } from '../src/storage/in_memory_storage';
import { build_scope_graph } from '../src/scope_resolution';
import { typescript_config } from '../src/languages/typescript';

describe('InMemoryStorage', () => {
  test('stores and retrieves file data', () => {
    const languages = new Map([['typescript', typescript_config]]);
    const storage = new InMemoryStorage(languages);
    
    storage.initialize();
    
    // Parse a simple file
    const sourceCode = 'function test() { return 42; }';
    const tree = typescript_config.parser.parse(sourceCode);
    const graph = build_scope_graph(tree, typescript_config, 'test.ts', sourceCode);
    
    // Store the file
    storage.updateFile('test.ts', {
      tree,
      source_code: sourceCode,
      graph
    }, graph);
    
    // Retrieve and verify
    expect(storage.hasFile('test.ts')).toBe(true);
    expect(storage.getFilePaths()).toEqual(['test.ts']);
    
    const fileCache = storage.getFileCache('test.ts');
    expect(fileCache).toBeDefined();
    expect(fileCache?.source_code).toBe(sourceCode);
    
    const fileGraph = storage.getFileGraph('test.ts');
    expect(fileGraph).toBeDefined();
    expect(fileGraph?.getNodes('definition').length).toBeGreaterThan(0);
  });
  
  test('handles transactions correctly', () => {
    const languages = new Map([['typescript', typescript_config]]);
    const storage = new InMemoryStorage(languages);
    
    storage.initialize();
    
    // Add initial file
    const sourceCode1 = 'const x = 1;';
    const tree1 = typescript_config.parser.parse(sourceCode1);
    const graph1 = build_scope_graph(tree1, typescript_config, 'file1.ts', sourceCode1);
    
    storage.updateFile('file1.ts', {
      tree: tree1,
      source_code: sourceCode1,
      graph: graph1
    }, graph1);
    
    // Start transaction
    const tx = storage.beginTransaction();
    
    // Add another file in transaction
    const sourceCode2 = 'const y = 2;';
    const tree2 = typescript_config.parser.parse(sourceCode2);
    const graph2 = build_scope_graph(tree2, typescript_config, 'file2.ts', sourceCode2);
    
    tx.updateFile('file2.ts', {
      tree: tree2,
      source_code: sourceCode2,
      graph: graph2
    }, graph2);
    
    // File should not be visible yet
    expect(storage.hasFile('file2.ts')).toBe(false);
    expect(storage.getFilePaths()).toEqual(['file1.ts']);
    
    // Commit transaction
    tx.commit();
    
    // Now file should be visible
    expect(storage.hasFile('file2.ts')).toBe(true);
    expect(storage.getFilePaths().sort()).toEqual(['file1.ts', 'file2.ts']);
  });
  
  test('rollback transaction discards changes', () => {
    const languages = new Map([['typescript', typescript_config]]);
    const storage = new InMemoryStorage(languages);
    
    storage.initialize();
    
    // Add initial file
    const sourceCode = 'const x = 1;';
    const tree = typescript_config.parser.parse(sourceCode);
    const graph = build_scope_graph(tree, typescript_config, 'test.ts', sourceCode);
    
    storage.updateFile('test.ts', {
      tree,
      source_code: sourceCode,
      graph
    }, graph);
    
    // Start transaction and remove file
    const tx = storage.beginTransaction();
    tx.removeFile('test.ts');
    
    // File should still be visible in main storage
    expect(storage.hasFile('test.ts')).toBe(true);
    
    // Rollback
    tx.rollback();
    
    // File should still exist
    expect(storage.hasFile('test.ts')).toBe(true);
  });
  
  test('clear removes all data', () => {
    const languages = new Map([['typescript', typescript_config]]);
    const storage = new InMemoryStorage(languages);
    
    storage.initialize();
    
    // Add a file
    const sourceCode = 'const x = 1;';
    const tree = typescript_config.parser.parse(sourceCode);
    const graph = build_scope_graph(tree, typescript_config, 'test.ts', sourceCode);
    
    storage.updateFile('test.ts', {
      tree,
      source_code: sourceCode,
      graph
    }, graph);
    
    expect(storage.hasFile('test.ts')).toBe(true);
    
    // Clear storage
    storage.clear();
    
    expect(storage.hasFile('test.ts')).toBe(false);
    expect(storage.getFilePaths()).toEqual([]);
  });
});