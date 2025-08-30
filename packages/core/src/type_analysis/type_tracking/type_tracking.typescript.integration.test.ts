/**
 * Integration test for TypeScript type tracking with imports
 * 
 * Verifies that imported types are properly resolved and qualified
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import { ImportInfo } from '@ariadnejs/types';
import { process_file_for_types } from './index';
import { get_variable_type } from './type_tracking';

describe('TypeScript Type Tracking with Imports', () => {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript as any);

  it('should resolve imported types in variable declarations', () => {
    const source = `
      import { User } from './models/user';
      import React from 'react';
      
      const user: User = { name: 'John' };
      const component: React.Component = new Component();
    `;
    
    const tree = parser.parse(source);
    
    // Simulate imports from import_resolution layer
    const imports: ImportInfo[] = [
      {
        name: 'User',
        source: './models/user',
        kind: 'named',
        is_default: false,
        is_namespace: false,
        is_type_only: false
      },
      {
        name: 'React',
        source: 'react',
        kind: 'default',
        is_default: true,
        is_namespace: false,
        is_type_only: false
      }
    ];
    
    const context = {
      language: 'typescript' as const,
      file_path: 'test.ts',
      debug: false
    };
    
    const tracker = process_file_for_types(
      source,
      tree.rootNode,
      context,
      undefined, // scope_tree
      imports,    // imports from Layer 2
      []          // classes
    );
    
    // Check that imported type is qualified
    const userType = get_variable_type(tracker, 'user');
    expect(userType).toBeDefined();
    expect(userType?.type_name).toBe('./models/user#User');
    expect(userType?.is_imported).toBe(true);
    
    // Check namespace type resolution
    const componentType = get_variable_type(tracker, 'component');
    expect(componentType).toBeDefined();
    // Should recognize React.Component as from the React import
  });

  it('should handle type-only imports', () => {
    const source = `
      import type { UserType } from './types';
      
      let user: UserType;
    `;
    
    const tree = parser.parse(source);
    
    const imports: ImportInfo[] = [
      {
        name: 'UserType',
        source: './types',
        kind: 'named',
        is_default: false,
        is_namespace: false,
        is_type_only: true
      }
    ];
    
    const context = {
      language: 'typescript' as const,
      file_path: 'test.ts',
      debug: false
    };
    
    const tracker = process_file_for_types(
      source,
      tree.rootNode,
      context,
      undefined,
      imports,
      []
    );
    
    const userType = get_variable_type(tracker, 'user');
    expect(userType).toBeDefined();
    expect(userType?.type_name).toBe('./types#UserType');
    expect(userType?.is_imported).toBe(true);
  });

  it('should handle namespace imports', () => {
    const source = `
      import * as models from './models';
      
      const user: models.User = {};
    `;
    
    const tree = parser.parse(source);
    
    const imports: ImportInfo[] = [
      {
        name: '*',
        source: './models',
        kind: 'namespace',
        namespace_name: 'models',
        is_default: false,
        is_namespace: true,
        is_type_only: false
      }
    ];
    
    const context = {
      language: 'typescript' as const,
      file_path: 'test.ts',
      debug: false
    };
    
    const tracker = process_file_for_types(
      source,
      tree.rootNode,
      context,
      undefined,
      imports,
      []
    );
    
    const userType = get_variable_type(tracker, 'user');
    expect(userType).toBeDefined();
    // Namespace imports need special handling for member access
    // This test documents the expected behavior
  });

  it('should handle imported types in function parameters', () => {
    const source = `
      import { User } from './models/user';
      
      function processUser(user: User): void {
        // Process user
      }
    `;
    
    const tree = parser.parse(source);
    
    const imports: ImportInfo[] = [
      {
        name: 'User',
        source: './models/user',
        kind: 'named',
        is_default: false,
        is_namespace: false,
        is_type_only: false
      }
    ];
    
    const context = {
      language: 'typescript' as const,
      file_path: 'test.ts',
      debug: false
    };
    
    const tracker = process_file_for_types(
      source,
      tree.rootNode,
      context,
      undefined,
      imports,
      []
    );
    
    const userType = get_variable_type(tracker, 'user');
    expect(userType).toBeDefined();
    expect(userType?.type_name).toBe('./models/user#User');
    expect(userType?.is_imported).toBe(true);
  });

  it('should distinguish between imported and local types', () => {
    const source = `
      import { RemoteUser } from './api';
      
      interface LocalUser {
        name: string;
      }
      
      const remote: RemoteUser = {};
      const local: LocalUser = {};
    `;
    
    const tree = parser.parse(source);
    
    const imports: ImportInfo[] = [
      {
        name: 'RemoteUser',
        source: './api',
        kind: 'named',
        is_default: false,
        is_namespace: false,
        is_type_only: false
      }
    ];
    
    const context = {
      language: 'typescript' as const,
      file_path: 'test.ts',
      debug: false
    };
    
    const tracker = process_file_for_types(
      source,
      tree.rootNode,
      context,
      undefined,
      imports,
      []
    );
    
    const remoteType = get_variable_type(tracker, 'remote');
    expect(remoteType).toBeDefined();
    expect(remoteType?.type_name).toBe('./api#RemoteUser');
    expect(remoteType?.is_imported).toBe(true);
    
    const localType = get_variable_type(tracker, 'local');
    expect(localType).toBeDefined();
    expect(localType?.type_name).toBe('LocalUser');
    expect(localType?.is_imported).toBeFalsy();
  });
});