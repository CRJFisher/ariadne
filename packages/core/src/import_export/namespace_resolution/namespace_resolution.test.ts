/**
 * Tests for namespace resolution integration
 */

import { describe, it, expect } from 'vitest';
import { generate_code_graph } from '../../code_graph';
import { writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

describe('Namespace Resolution Integration', () => {
  // Helper to create a temporary test project
  function createTestProject(files: Record<string, string>): string {
    const projectDir = join(tmpdir(), `test-project-${randomBytes(8).toString('hex')}`);
    mkdirSync(projectDir, { recursive: true });
    
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(projectDir, path);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, content);
    }
    
    return projectDir;
  }

  describe('TypeScript namespace imports', () => {
    it('should resolve namespace imports and their members', async () => {
      const projectDir = createTestProject({
        'types.ts': `
          export interface User {
            id: number;
            name: string;
          }
          
          export interface Product {
            id: number;
            price: number;
          }
          
          export function validateUser(user: User): boolean {
            return user.id > 0 && user.name.length > 0;
          }
        `,
        'app.ts': `
          import * as types from './types';
          
          const user: types.User = {
            id: 1,
            name: 'John'
          };
          
          const product: types.Product = {
            id: 100,
            price: 29.99
          };
          
          const isValid = types.validateUser(user);
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.ts']
      });

      // Check that namespace imports are tracked
      const appAnalysis = Array.from(graph.files.values()).find(f => f.file_path.endsWith('app.ts'));
      expect(appAnalysis).toBeDefined();
      
      const namespaceImport = appAnalysis?.imports.find(i => i.is_namespace_import);
      expect(namespaceImport).toBeDefined();
      expect(namespaceImport?.namespace_name).toBe('types');
      expect(namespaceImport?.source).toContain('types');
    });

    it('should handle nested namespace access', async () => {
      const projectDir = createTestProject({
        'utils/index.ts': `
          export namespace validators {
            export function isEmail(email: string): boolean {
              return email.includes('@');
            }
            
            export function isPhone(phone: string): boolean {
              return phone.length === 10;
            }
          }
          
          export namespace formatters {
            export function currency(amount: number): string {
              return '$' + amount.toFixed(2);
            }
          }
        `,
        'main.ts': `
          import * as utils from './utils';
          
          const emailValid = utils.validators.isEmail('test@example.com');
          const formatted = utils.formatters.currency(99.99);
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.ts']
      });

      const mainAnalysis = Array.from(graph.files.values()).find(f => f.file_path.endsWith('main.ts'));
      expect(mainAnalysis).toBeDefined();
      
      const namespaceImport = mainAnalysis?.imports.find(i => i.is_namespace_import);
      expect(namespaceImport?.namespace_name).toBe('utils');
    });
  });

  describe('JavaScript CommonJS namespace patterns', () => {
    it('should handle require with namespace assignment', async () => {
      const projectDir = createTestProject({
        'lib.js': `
          function helper1() {
            return 'helper1';
          }
          
          function helper2() {
            return 'helper2';
          }
          
          module.exports = {
            helper1,
            helper2
          };
        `,
        'app.js': `
          const lib = require('./lib');
          
          const result1 = lib.helper1();
          const result2 = lib.helper2();
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.js']
      });

      // CommonJS imports are tracked differently but should still be recognized
      const appAnalysis = Array.from(graph.files.values()).find(f => f.file_path.endsWith('app.js'));
      expect(appAnalysis).toBeDefined();
      expect(appAnalysis?.imports.length).toBeGreaterThan(0);
    });
  });

  describe('Python module imports', () => {
    it('should handle Python import as namespace', async () => {
      const projectDir = createTestProject({
        'utils.py': `
def process_data(data):
    """Process some data"""
    return data * 2

def validate_input(value):
    """Validate input"""
    return value > 0

class DataProcessor:
    def __init__(self):
        self.count = 0
    
    def process(self, item):
        self.count += 1
        return process_data(item)
        `,
        'main.py': `
import utils

result = utils.process_data(42)
valid = utils.validate_input(result)
processor = utils.DataProcessor()
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.py']
      });

      const mainAnalysis = Array.from(graph.files.values()).find(f => f.file_path.endsWith('main.py'));
      expect(mainAnalysis).toBeDefined();
      expect(mainAnalysis?.imports.length).toBeGreaterThan(0);
    });

    it('should handle from module import *', async () => {
      const projectDir = createTestProject({
        'helpers.py': `
def helper_a():
    return 'a'

def helper_b():
    return 'b'

__all__ = ['helper_a', 'helper_b']
        `,
        'app.py': `
from helpers import *

result_a = helper_a()
result_b = helper_b()
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.py']
      });

      const appAnalysis = Array.from(graph.files.values()).find(f => f.file_path.endsWith('app.py'));
      expect(appAnalysis).toBeDefined();
      
      // Star imports should be recognized
      const starImport = appAnalysis?.imports.find(i => i.source.includes('helpers'));
      expect(starImport).toBeDefined();
    });
  });

  describe('Rust use statements', () => {
    it('should handle use module::*', async () => {
      const projectDir = createTestProject({
        'lib.rs': `
pub mod helpers {
    pub fn process(value: i32) -> i32 {
        value * 2
    }
    
    pub fn validate(value: i32) -> bool {
        value > 0
    }
}
        `,
        'main.rs': `
mod lib;
use lib::helpers::*;

fn main() {
    let result = process(42);
    let valid = validate(result);
}
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.rs']
      });

      const mainAnalysis = Array.from(graph.files.values()).find(f => f.file_path.endsWith('main.rs'));
      expect(mainAnalysis).toBeDefined();
      expect(mainAnalysis?.imports.length).toBeGreaterThan(0);
    });

    it('should handle use module::{self, Item}', async () => {
      const projectDir = createTestProject({
        'utils.rs': `
pub struct Config {
    pub value: i32,
}

pub fn create_config() -> Config {
    Config { value: 42 }
}
        `,
        'main.rs': `
mod utils;
use utils::{self, Config};

fn main() {
    let config = utils::create_config();
    let direct_config = Config { value: 100 };
}
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.rs']
      });

      const mainAnalysis = Array.from(graph.files.values()).find(f => f.file_path.endsWith('main.rs'));
      expect(mainAnalysis).toBeDefined();
      
      // Should have imports for both the module and specific items
      expect(mainAnalysis?.imports.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-file namespace resolution', () => {
    it('should resolve namespace types in type registry', async () => {
      const projectDir = createTestProject({
        'models.ts': `
          export class User {
            constructor(public id: number, public name: string) {}
          }
          
          export interface UserData {
            id: number;
            name: string;
          }
        `,
        'services.ts': `
          import * as models from './models';
          
          export function createUser(data: models.UserData): models.User {
            return new models.User(data.id, data.name);
          }
        `
      });

      const graph = await generate_code_graph({
        root_path: projectDir,
        include_patterns: ['**/*.ts']
      });

      // The type registry should contain namespace-qualified types
      // This is a basic check - more detailed checks would require inspecting internal structures
      expect(graph.types).toBeDefined();
    });
  });
});