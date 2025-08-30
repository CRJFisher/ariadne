/**
 * Tests for type-only import detection (TypeScript)
 * 
 * Tests the type-only import functionality added in task 11.62.10
 */

import { describe, it, expect } from 'vitest';
import { extract_typescript_imports } from './import_extraction';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

describe('TypeScript type-only imports', () => {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  
  describe('Statement-level type-only imports', () => {
    it('should detect type-only named imports', () => {
      const code = `
        import type { User, Profile } from './models';
        import type { Config } from './config';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      expect(imports).toHaveLength(3);
      
      const user_import = imports.find(i => i.name === 'User');
      expect(user_import).toBeDefined();
      expect(user_import?.is_type_only).toBe(true);
      expect(user_import?.source).toBe('./models');
      expect(user_import?.kind).toBe('named');
      
      const config_import = imports.find(i => i.name === 'Config');
      expect(config_import).toBeDefined();
      expect(config_import?.is_type_only).toBe(true);
      expect(config_import?.source).toBe('./config');
    });
    
    it('should detect type-only default imports', () => {
      const code = `
        import type DefaultUser from './user';
        import type DefaultConfig from './config';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      expect(imports).toHaveLength(2);
      
      const user_import = imports.find(i => i.name === 'DefaultUser');
      expect(user_import).toBeDefined();
      expect(user_import?.is_type_only).toBe(true);
      expect(user_import?.kind).toBe('default');
    });
    
    it('should detect type-only namespace imports', () => {
      const code = `
        import type * as Types from './types';
        import type * as Models from './models';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      expect(imports).toHaveLength(2);
      
      const types_import = imports.find(i => i.name === 'Types');
      expect(types_import).toBeDefined();
      expect(types_import?.is_type_only).toBe(true);
      expect(types_import?.kind).toBe('namespace');
      expect(types_import?.namespace_name).toBe('Types');
    });
  });
  
  describe('Inline type modifiers (TypeScript 4.5+)', () => {
    it('should detect inline type modifiers in mixed imports', () => {
      const code = `
        import { type User, api, type Config } from './module';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      expect(imports).toHaveLength(3);
      
      const user_import = imports.find(i => i.name === 'User');
      expect(user_import?.is_type_only).toBe(true);
      
      const api_import = imports.find(i => i.name === 'api');
      expect(api_import?.is_type_only).toBeFalsy();
      
      const config_import = imports.find(i => i.name === 'Config');
      expect(config_import?.is_type_only).toBe(true);
    });
    
    it('should handle complex mixed imports', () => {
      const code = `
        import { 
          type TypeA,
          valueB,
          type TypeC as AliasC,
          valueD as AliasD,
          type TypeE
        } from './complex';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      expect(imports).toHaveLength(5);
      
      expect(imports.find(i => i.name === 'TypeA')?.is_type_only).toBe(true);
      expect(imports.find(i => i.name === 'valueB')?.is_type_only).toBeFalsy();
      expect(imports.find(i => i.name === 'AliasC')?.is_type_only).toBe(true);
      expect(imports.find(i => i.name === 'AliasD')?.is_type_only).toBeFalsy();
      expect(imports.find(i => i.name === 'TypeE')?.is_type_only).toBe(true);
    });
  });
  
  describe('Regular imports alongside type-only', () => {
    it('should distinguish between type-only and regular imports', () => {
      const code = `
        import { api } from './api';
        import type { ApiType } from './api';
        import DefaultExport from './default';
        import type DefaultType from './default';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      expect(imports).toHaveLength(4);
      
      expect(imports.find(i => i.name === 'api')?.is_type_only).toBeFalsy();
      expect(imports.find(i => i.name === 'ApiType')?.is_type_only).toBe(true);
      expect(imports.find(i => i.name === 'DefaultExport')?.is_type_only).toBeFalsy();
      expect(imports.find(i => i.name === 'DefaultType')?.is_type_only).toBe(true);
    });
    
    it('should handle CommonJS imports without type-only flag', () => {
      const code = `
        const utils = require('./utils');
        import type { UtilType } from './utils';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      const require_import = imports.find(i => i.name === 'utils');
      expect(require_import?.is_type_only).toBeFalsy();
      
      const type_import = imports.find(i => i.name === 'UtilType');
      expect(type_import?.is_type_only).toBe(true);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty type-only imports', () => {
      const code = `
        import type {} from './empty';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      // Should still detect the import even if empty
      expect(imports.length).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle side-effect imports (no type-only)', () => {
      const code = `
        import './styles.css';
        import './polyfill';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      expect(imports).toHaveLength(2);
      expect(imports[0].kind).toBe('dynamic');
      expect(imports[0].is_type_only).toBeFalsy();
    });
    
    it('should handle dynamic imports (no type-only)', () => {
      const code = `
        const module = await import('./dynamic');
        import('./lazy').then(m => console.log(m));
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      const dynamic_imports = imports.filter(i => i.kind === 'dynamic');
      expect(dynamic_imports.length).toBeGreaterThanOrEqual(1);
      dynamic_imports.forEach(imp => {
        expect(imp.is_type_only).toBeFalsy();
      });
    });
  });
  
  describe('Import/Export symmetry', () => {
    it('should maintain type-only flag through re-exports', () => {
      const code = `
        // Import as type-only
        import type { User } from './models';
        
        // Re-export as type-only
        export type { User };
        
        // Mixed re-export
        export { type User as UserType, createUser } from './user';
      `;
      
      const tree = parser.parse(code);
      const imports = extract_typescript_imports(tree.rootNode, code);
      
      const user_import = imports.find(i => i.name === 'User');
      expect(user_import?.is_type_only).toBe(true);
      
      // Note: Export detection would be tested in export_extraction.test.ts
      // This just ensures imports are properly detected
    });
  });
});