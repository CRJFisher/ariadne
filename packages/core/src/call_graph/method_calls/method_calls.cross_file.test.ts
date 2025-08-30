/**
 * Cross-file method resolution test
 * 
 * Tests that method calls can resolve methods on imported classes
 * using the enriched type map that includes import information.
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import { find_method_calls } from './index';
import { create_file_type_tracker, set_variable_type, set_imported_class } from '../../type_analysis/type_tracking';
import { merge_constructor_types } from '../constructor_calls';
import { TypeInfo } from '@ariadnejs/types';

describe('Cross-file Method Resolution', () => {
  const parser = new Parser();

  it('should resolve methods on imported JavaScript classes', () => {
    parser.setLanguage(JavaScript as any);
    const source = `
      import { UserService } from './services/user';
      
      const service = new UserService();
      service.getUser(123);
      service.updateUser({ id: 123, name: 'John' });
    `;
    
    const tree = parser.parse(source);
    
    // Create type tracker with imported class info
    const tracker = create_file_type_tracker();
    const enriched_tracker = set_imported_class(tracker, 'UserService', {
      class_name: 'UserService',
      source_module: './services/user',
      local_name: 'UserService',
      is_default: false,
      is_type_only: false
    });
    
    // Simulate constructor type discovery
    const constructor_types = new Map<string, TypeInfo[]>([
      ['service', [{
        type_name: './services/user#UserService',
        type_kind: 'class',
        position: { row: 3, column: 20 },
        confidence: 'explicit',
        source: 'constructor',
        is_imported: true
      }]]
    ]);
    
    // Merge to create enriched type map
    const enriched_type_map = merge_constructor_types(
      enriched_tracker.variable_types,
      constructor_types
    );
    
    // Find method calls with enriched types
    const context = {
      source_code: source,
      file_path: 'test.js',
      language: 'javascript' as const,
      ast_root: tree.rootNode
    };
    
    const method_calls = find_method_calls(context, enriched_type_map);
    
    // Verify methods are resolved with imported class
    expect(method_calls).toHaveLength(2);
    
    const getUserCall = method_calls.find(c => c.method_name === 'getUser');
    expect(getUserCall).toBeDefined();
    expect(getUserCall?.receiver_type).toBe('./services/user#UserService');
    
    const updateUserCall = method_calls.find(c => c.method_name === 'updateUser');
    expect(updateUserCall).toBeDefined();
    expect(updateUserCall?.receiver_type).toBe('./services/user#UserService');
  });

  it('should resolve methods on imported TypeScript classes with type annotations', () => {
    parser.setLanguage(TypeScript.typescript as any);
    const source = `
      import { DatabaseConnection } from '@db/connection';
      
      const db: DatabaseConnection = new DatabaseConnection();
      db.connect();
      db.query('SELECT * FROM users');
      db.close();
    `;
    
    const tree = parser.parse(source);
    
    // Create type tracker with imported class info
    const tracker = create_file_type_tracker();
    const enriched_tracker = set_imported_class(tracker, 'DatabaseConnection', {
      class_name: 'DatabaseConnection',
      source_module: '@db/connection',
      local_name: 'DatabaseConnection',
      is_default: false,
      is_type_only: false
    });
    
    // Add type annotation info
    const typed_tracker = set_variable_type(enriched_tracker, 'db', {
      type_name: '@db/connection#DatabaseConnection',
      type_kind: 'imported',
      position: { row: 3, column: 18 },
      confidence: 'explicit',
      source: 'annotation',
      is_imported: true
    });
    
    // Find method calls with typed tracker
    const context = {
      source_code: source,
      file_path: 'test.ts',
      language: 'typescript' as const,
      ast_root: tree.rootNode
    };
    
    const method_calls = find_method_calls(context, typed_tracker.variable_types);
    
    // Verify all three methods are resolved
    expect(method_calls).toHaveLength(3);
    
    const methods = method_calls.map(c => c.method_name);
    expect(methods).toContain('connect');
    expect(methods).toContain('query');
    expect(methods).toContain('close');
    
    // All should have the correct receiver type
    for (const call of method_calls) {
      expect(call.receiver_type).toBe('@db/connection#DatabaseConnection');
    }
  });

  it('should handle namespace imports in TypeScript', () => {
    parser.setLanguage(TypeScript.typescript as any);
    const source = `
      import * as utils from './utils';
      
      const formatter = new utils.Formatter();
      formatter.format('hello');
    `;
    
    const tree = parser.parse(source);
    
    // Create type tracker with namespace import
    const tracker = create_file_type_tracker();
    const enriched_tracker = set_imported_class(tracker, 'utils', {
      class_name: '*',
      source_module: './utils',
      local_name: 'utils',
      is_default: false,
      is_type_only: false
    });
    
    // Simulate type for formatter variable
    const typed_tracker = set_variable_type(enriched_tracker, 'formatter', {
      type_name: './utils#Formatter',
      type_kind: 'class',
      position: { row: 3, column: 21 },
      confidence: 'explicit',
      source: 'constructor',
      is_imported: true
    });
    
    const context = {
      source_code: source,
      file_path: 'test.ts',
      language: 'typescript' as const,
      ast_root: tree.rootNode
    };
    
    const method_calls = find_method_calls(context, typed_tracker.variable_types);
    
    expect(method_calls).toHaveLength(1);
    expect(method_calls[0].method_name).toBe('format');
    expect(method_calls[0].receiver_type).toBe('./utils#Formatter');
  });

  it('should distinguish between local and imported classes', () => {
    parser.setLanguage(JavaScript as any);
    const source = `
      import { RemoteAPI } from './api';
      
      class LocalAPI {
        fetch() {}
      }
      
      const remote = new RemoteAPI();
      const local = new LocalAPI();
      
      remote.fetch();  // Should resolve to ./api#RemoteAPI
      local.fetch();   // Should resolve to LocalAPI
    `;
    
    const tree = parser.parse(source);
    
    // Set up type tracker
    const tracker = create_file_type_tracker();
    
    // Add imported class
    const with_import = set_imported_class(tracker, 'RemoteAPI', {
      class_name: 'RemoteAPI',
      source_module: './api',
      local_name: 'RemoteAPI',
      is_default: false,
      is_type_only: false
    });
    
    // Add types for both variables
    const with_remote = set_variable_type(with_import, 'remote', {
      type_name: './api#RemoteAPI',
      type_kind: 'class',
      position: { row: 7, column: 19 },
      confidence: 'explicit',
      source: 'constructor',
      is_imported: true
    });
    
    const with_local = set_variable_type(with_remote, 'local', {
      type_name: 'LocalAPI',
      type_kind: 'class',
      position: { row: 8, column: 18 },
      confidence: 'explicit',
      source: 'constructor',
      is_imported: false
    });
    
    const context = {
      source_code: source,
      file_path: 'test.js',
      language: 'javascript' as const,
      ast_root: tree.rootNode
    };
    
    const method_calls = find_method_calls(context, with_local.variable_types);
    
    expect(method_calls).toHaveLength(2);
    
    // Find calls by line number to ensure correct association
    const remoteFetch = method_calls.find(c => c.location.line === 10);
    expect(remoteFetch?.receiver_type).toBe('./api#RemoteAPI');
    
    const localFetch = method_calls.find(c => c.location.line === 11);
    expect(localFetch?.receiver_type).toBe('LocalAPI');
  });
});