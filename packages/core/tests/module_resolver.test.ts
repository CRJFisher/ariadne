import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ModuleResolver } from '../src/module_resolver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ModuleResolver', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('TypeScript/JavaScript Resolution', () => {
    test('resolves relative imports with explicit extensions', () => {
      // Create test files
      const utilsPath = path.join(tempDir, 'utils.ts');
      const mainPath = path.join(tempDir, 'main.ts');
      
      fs.writeFileSync(utilsPath, 'export function util() {}');
      fs.writeFileSync(mainPath, 'import { util } from "./utils.ts"');
      
      const resolved = ModuleResolver.resolveModulePath(mainPath, './utils.ts');
      expect(resolved).toBe(utilsPath);
    });

    test('resolves relative imports without extensions', () => {
      // Create test files
      const utilsPath = path.join(tempDir, 'utils.ts');
      const mainPath = path.join(tempDir, 'main.ts');
      
      fs.writeFileSync(utilsPath, 'export function util() {}');
      fs.writeFileSync(mainPath, 'import { util } from "./utils"');
      
      const resolved = ModuleResolver.resolveModulePath(mainPath, './utils');
      expect(resolved).toBe(utilsPath);
    });

    test('resolves index files in directories', () => {
      // Create directory with index file
      const libDir = path.join(tempDir, 'lib');
      fs.mkdirSync(libDir);
      
      const indexPath = path.join(libDir, 'index.ts');
      const mainPath = path.join(tempDir, 'main.ts');
      
      fs.writeFileSync(indexPath, 'export function lib() {}');
      fs.writeFileSync(mainPath, 'import { lib } from "./lib"');
      
      const resolved = ModuleResolver.resolveModulePath(mainPath, './lib');
      expect(resolved).toBe(indexPath);
    });

    test('resolves parent directory imports', () => {
      // Create nested structure
      const srcDir = path.join(tempDir, 'src');
      const componentsDir = path.join(srcDir, 'components');
      fs.mkdirSync(srcDir);
      fs.mkdirSync(componentsDir);
      
      const utilsPath = path.join(srcDir, 'utils.ts');
      const componentPath = path.join(componentsDir, 'button.ts');
      
      fs.writeFileSync(utilsPath, 'export function util() {}');
      fs.writeFileSync(componentPath, 'import { util } from "../utils"');
      
      const resolved = ModuleResolver.resolveModulePath(componentPath, '../utils');
      expect(resolved).toBe(utilsPath);
    });

    test('tries multiple extensions in order', () => {
      // Create files with different extensions
      const jsPath = path.join(tempDir, 'config.js');
      const mainPath = path.join(tempDir, 'main.ts');
      
      fs.writeFileSync(jsPath, 'module.exports = {}');
      fs.writeFileSync(mainPath, 'import config from "./config"');
      
      const resolved = ModuleResolver.resolveModulePath(mainPath, './config');
      expect(resolved).toBe(jsPath);
    });

    test('returns null for external modules', () => {
      const mainPath = path.join(tempDir, 'main.ts');
      fs.writeFileSync(mainPath, 'import React from "react"');
      
      const resolved = ModuleResolver.resolveModulePath(mainPath, 'react');
      expect(resolved).toBeNull();
    });
  });

  describe('Python Resolution', () => {
    test('resolves simple relative imports', () => {
      const utilsPath = path.join(tempDir, 'utils.py');
      const mainPath = path.join(tempDir, 'main.py');
      
      fs.writeFileSync(utilsPath, 'def util(): pass');
      fs.writeFileSync(mainPath, 'from .utils import util');
      
      const resolved = ModuleResolver.resolvePythonImport(mainPath, '.utils');
      expect(resolved).toBe(utilsPath);
    });

    test('resolves package imports with __init__.py', () => {
      // Create package structure
      const packageDir = path.join(tempDir, 'mypackage');
      fs.mkdirSync(packageDir);
      
      const initPath = path.join(packageDir, '__init__.py');
      const mainPath = path.join(tempDir, 'main.py');
      
      fs.writeFileSync(initPath, '# Package init');
      fs.writeFileSync(mainPath, 'from .mypackage import something');
      
      const resolved = ModuleResolver.resolvePythonImport(mainPath, '.mypackage');
      expect(resolved).toBe(initPath);
    });

    test('resolves parent directory imports with multiple dots', () => {
      // Create nested structure
      const libDir = path.join(tempDir, 'lib');
      const subDir = path.join(libDir, 'sub');
      fs.mkdirSync(libDir);
      fs.mkdirSync(subDir);
      
      const utilsPath = path.join(tempDir, 'utils.py');
      const deepPath = path.join(subDir, 'deep.py');
      
      fs.writeFileSync(utilsPath, 'def util(): pass');
      fs.writeFileSync(deepPath, 'from ...utils import util');
      
      const resolved = ModuleResolver.resolvePythonImport(deepPath, '...utils');
      expect(resolved).toBe(utilsPath);
    });

    test('resolves package.module notation', () => {
      // Create package with submodule
      const packageDir = path.join(tempDir, 'mypackage');
      fs.mkdirSync(packageDir);
      
      const submodulePath = path.join(packageDir, 'submodule.py');
      const mainPath = path.join(tempDir, 'main.py');
      
      fs.writeFileSync(submodulePath, 'def func(): pass');
      fs.writeFileSync(mainPath, 'from mypackage.submodule import func');
      
      const resolved = ModuleResolver.resolvePythonImport(mainPath, 'mypackage.submodule');
      expect(resolved).toBe(submodulePath);
    });
  });

  describe('Rust Resolution', () => {
    test('resolves module files', () => {
      const utilsPath = path.join(tempDir, 'utils.rs');
      const mainPath = path.join(tempDir, 'main.rs');
      
      fs.writeFileSync(utilsPath, 'pub fn util() {}');
      fs.writeFileSync(mainPath, 'use crate::utils;');
      
      // For this test, we'll simulate being in src directory
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]');
      
      const resolved = ModuleResolver.resolveRustModule(mainPath, 'utils');
      expect(resolved).toBe(utilsPath);
    });

    test('resolves mod.rs in directories', () => {
      // Create module directory
      const utilsDir = path.join(tempDir, 'utils');
      fs.mkdirSync(utilsDir);
      
      const modPath = path.join(utilsDir, 'mod.rs');
      const mainPath = path.join(tempDir, 'main.rs');
      
      fs.writeFileSync(modPath, 'pub fn util() {}');
      fs.writeFileSync(mainPath, 'mod utils;');
      
      const resolved = ModuleResolver.resolveRustModule(mainPath, 'utils');
      expect(resolved).toBe(modPath);
    });

    test('resolves super:: paths', () => {
      const parentDir = path.join(tempDir, 'parent');
      const childDir = path.join(parentDir, 'child');
      fs.mkdirSync(parentDir);
      fs.mkdirSync(childDir);
      
      const utilsPath = path.join(parentDir, 'utils.rs');
      const childPath = path.join(childDir, 'module.rs');
      
      fs.writeFileSync(utilsPath, 'pub fn util() {}');
      fs.writeFileSync(childPath, 'use super::utils;');
      
      const resolved = ModuleResolver.resolveRustModule(childPath, 'super::utils');
      expect(resolved).toBe(utilsPath);
    });

    test('resolves crate:: paths from nested modules', () => {
      // Create crate structure
      const srcDir = path.join(tempDir, 'src');
      const nestedDir = path.join(srcDir, 'nested');
      fs.mkdirSync(srcDir);
      fs.mkdirSync(nestedDir);
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]');
      
      const utilsPath = path.join(srcDir, 'utils.rs');
      const nestedPath = path.join(nestedDir, 'module.rs');
      
      fs.writeFileSync(utilsPath, 'pub fn util() {}');
      fs.writeFileSync(nestedPath, 'use crate::utils;');
      
      const resolved = ModuleResolver.resolveRustModule(nestedPath, 'crate::utils');
      expect(resolved).toBe(utilsPath);
    });
  });
});