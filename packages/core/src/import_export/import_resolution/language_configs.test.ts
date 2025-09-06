/**
 * Tests for language configuration
 */

import { describe, it, expect } from 'vitest';
import {
  get_import_config,
  is_relative_path,
  has_special_prefix,
  get_possible_file_paths,
  is_namespace_marker,
  module_path_to_file_path
} from './language_configs';

describe('language_configs', () => {
  describe('get_import_config', () => {
    it('should return JavaScript configuration', () => {
      const config = get_import_config('javascript');
      expect(config.import_statement_types).toContain('import_statement');
      expect(config.supports_commonjs).toBe(true);
      expect(config.file_extensions).toContain('.js');
      expect(config.index_files).toContain('index.js');
    });
    
    it('should return TypeScript configuration', () => {
      const config = get_import_config('typescript');
      expect(config.import_statement_types).toContain('import_statement');
      expect(config.supports_type_only_import).toBe(true);
      expect(config.file_extensions).toContain('.ts');
      expect(config.index_files).toContain('index.ts');
    });
    
    it('should return Python configuration', () => {
      const config = get_import_config('python');
      expect(config.from_import_types).toContain('import_from_statement');
      expect(config.relative_prefixes).toContain('...');
      expect(config.file_extensions).toContain('.py');
      expect(config.index_files).toContain('__init__.py');
      expect(config.export_list_var).toBe('__all__');
    });
    
    it('should return Rust configuration', () => {
      const config = get_import_config('rust');
      expect(config.import_statement_types).toContain('use_declaration');
      expect(config.special_prefixes).toContain('crate::');
      expect(config.module_separator).toBe('::');
      expect(config.file_extensions).toContain('.rs');
      expect(config.index_files).toContain('mod.rs');
      expect(config.public_modifier).toBe('pub');
    });
    
    it('should throw for unsupported language', () => {
      expect(() => get_import_config('unknown' as any)).toThrow('Unsupported language');
    });
  });
  
  describe('is_relative_path', () => {
    it('should detect JavaScript relative paths', () => {
      const config = get_import_config('javascript');
      expect(is_relative_path('./module', config)).toBe(true);
      expect(is_relative_path('../module', config)).toBe(true);
      expect(is_relative_path('module', config)).toBe(false);
      expect(is_relative_path('@org/package', config)).toBe(false);
    });
    
    it('should detect Python relative paths', () => {
      const config = get_import_config('python');
      expect(is_relative_path('.module', config)).toBe(true);
      expect(is_relative_path('..module', config)).toBe(true);
      expect(is_relative_path('...package.module', config)).toBe(true);
      expect(is_relative_path('module', config)).toBe(false);
    });
    
    it('should handle Rust paths (no relative prefixes)', () => {
      const config = get_import_config('rust');
      expect(is_relative_path('crate::module', config)).toBe(false);
      expect(is_relative_path('super::module', config)).toBe(false);
    });
  });
  
  describe('has_special_prefix', () => {
    it('should detect Rust special prefixes', () => {
      const config = get_import_config('rust');
      expect(has_special_prefix('crate::module', config)).toBe(true);
      expect(has_special_prefix('super::module', config)).toBe(true);
      expect(has_special_prefix('self::module', config)).toBe(true);
      expect(has_special_prefix('std::collections', config)).toBe(true);
      expect(has_special_prefix('module', config)).toBe(false);
    });
    
    it('should handle languages without special prefixes', () => {
      const jsConfig = get_import_config('javascript');
      expect(has_special_prefix('any::path', jsConfig)).toBe(false);
      
      const pyConfig = get_import_config('python');
      expect(has_special_prefix('any.path', pyConfig)).toBe(false);
    });
  });
  
  describe('get_possible_file_paths', () => {
    it('should generate JavaScript file paths', () => {
      const config = get_import_config('javascript');
      const paths = get_possible_file_paths('src/module', config);
      
      expect(paths).toContain('src/module.js');
      expect(paths).toContain('src/module.jsx');
      expect(paths).toContain('src/module.mjs');
      expect(paths).toContain('src/module/index.js');
      expect(paths).toContain('src/module');
    });
    
    it('should generate TypeScript file paths', () => {
      const config = get_import_config('typescript');
      const paths = get_possible_file_paths('src/module', config);
      
      expect(paths).toContain('src/module.ts');
      expect(paths).toContain('src/module.tsx');
      expect(paths).toContain('src/module.d.ts');
      expect(paths).toContain('src/module/index.ts');
    });
    
    it('should generate Python file paths', () => {
      const config = get_import_config('python');
      const paths = get_possible_file_paths('package/module', config);
      
      expect(paths).toContain('package/module.py');
      expect(paths).toContain('package/module/__init__.py');
      expect(paths).toContain('package/module');
    });
    
    it('should generate Rust file paths', () => {
      const config = get_import_config('rust');
      const paths = get_possible_file_paths('src/module', config);
      
      expect(paths).toContain('src/module.rs');
      expect(paths).toContain('src/module/mod.rs');
      expect(paths).toContain('src/module/lib.rs');
    });
  });
  
  describe('is_namespace_marker', () => {
    it('should detect namespace markers', () => {
      const jsConfig = get_import_config('javascript');
      expect(is_namespace_marker('*', jsConfig)).toBe(true);
      expect(is_namespace_marker('foo', jsConfig)).toBe(false);
      
      const pyConfig = get_import_config('python');
      expect(is_namespace_marker('*', pyConfig)).toBe(true);
      
      const rustConfig = get_import_config('rust');
      expect(is_namespace_marker('*', rustConfig)).toBe(true);
    });
  });
  
  describe('module_path_to_file_path', () => {
    it('should convert Python module paths', () => {
      const config = get_import_config('python');
      expect(module_path_to_file_path('package.subpackage.module', config))
        .toBe('package/subpackage/module');
    });
    
    it('should convert Rust module paths', () => {
      const config = get_import_config('rust');
      expect(module_path_to_file_path('crate::module::submodule', config))
        .toBe('crate/module/submodule');
    });
    
    it('should preserve JavaScript paths', () => {
      const config = get_import_config('javascript');
      expect(module_path_to_file_path('path/to/module', config))
        .toBe('path/to/module');
    });
  });
});