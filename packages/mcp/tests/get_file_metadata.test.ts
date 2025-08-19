import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Project } from '@ariadnejs/core';
import { getFileMetadata, GetFileMetadataRequest } from '../src/tools/get_file_metadata';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('get_file_metadata', () => {
  let project: Project;
  let testDir: string;

  beforeAll(async () => {
    project = new Project();
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), 'ariadne-mcp-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TypeScript files', () => {
    it('should extract function metadata correctly', async () => {
      const testFile = path.join(testDir, 'functions.ts');
      const content = `
export function parseFile(path: string, options?: ParseOptions): Tree {
  return new Tree();
}

function privateHelper(data: any): void {
  console.log(data);
}

export const arrowFunc = (x: number, y: number): number => x + y;

export async function fetchData(url: string): Promise<Response> {
  return fetch(url);
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.language).toBe('typescript');
      expect(result.symbolCount).toBeGreaterThan(0);
      
      // Check for exported functions
      const parseFileSymbol = result.symbols.find(s => s.name === 'parseFile');
      expect(parseFileSymbol).toBeDefined();
      expect(parseFileSymbol?.type).toBe('function');
      expect(parseFileSymbol?.line).toBe(1);
      expect(parseFileSymbol?.signature).toContain('parseFile');
      expect(parseFileSymbol?.signature).toContain('ParseOptions');
      expect(parseFileSymbol?.exported).toBe(true);
      
      // Check for private functions
      const privateHelper = result.symbols.find(s => s.name === 'privateHelper');
      expect(privateHelper).toBeDefined();
      expect(privateHelper?.exported).toBe(false);
      
      // Check exports list
      expect(result.exports).toContain('parseFile');
      expect(result.exports).toContain('arrowFunc');
      expect(result.exports).toContain('fetchData');
      expect(result.exports).not.toContain('privateHelper');
    });

    it('should extract class and interface metadata', async () => {
      const testFile = path.join(testDir, 'classes.ts');
      const content = `
export interface Config {
  name: string;
  port: number;
}

export class Server implements Config {
  name: string;
  port: number;
  
  constructor(config: Config) {
    this.name = config.name;
    this.port = config.port;
  }
  
  start(): void {
    console.log(\`Starting \${this.name}\`);
  }
}

type ConnectionStatus = 'connected' | 'disconnected';

export type ServerOptions = Config & {
  ssl?: boolean;
};
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Check interface
      const configInterface = result.symbols.find(s => s.name === 'Config');
      expect(configInterface).toBeDefined();
      expect(configInterface?.type).toBe('interface');
      expect(configInterface?.exported).toBe(true);
      
      // Check class
      const serverClass = result.symbols.find(s => s.name === 'Server');
      expect(serverClass).toBeDefined();
      expect(serverClass?.type).toBe('class');
      expect(serverClass?.exported).toBe(true);
      expect(serverClass?.signature).toContain('Server');
      
      // Check type aliases
      const connectionStatus = result.symbols.find(s => s.name === 'ConnectionStatus');
      expect(connectionStatus).toBeDefined();
      expect(connectionStatus?.type).toBe('type');
      expect(connectionStatus?.exported).toBe(false);
      
      const serverOptions = result.symbols.find(s => s.name === 'ServerOptions');
      expect(serverOptions).toBeDefined();
      expect(serverOptions?.type).toBe('type');
      expect(serverOptions?.exported).toBe(true);
    });

    it('should extract import statements', async () => {
      const testFile = path.join(testDir, 'imports.ts');
      const content = `
import { readFile } from 'fs/promises';
import * as path from 'path';
import type { Config } from './config';
import Server from './server';
import { parse, stringify } from 'json5';

export function processFile(filePath: string): void {
  const content = readFile(filePath);
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Check imports
      expect(result.imports).toContain('fs/promises');
      expect(result.imports).toContain('path');
      expect(result.imports).toContain('./config');
      expect(result.imports).toContain('./server');
      expect(result.imports).toContain('json5');
    });
  });

  describe('JavaScript files', () => {
    it('should handle JavaScript functions and classes', async () => {
      const testFile = path.join(testDir, 'example.js');
      const content = `
export function calculate(a, b) {
  return a + b;
}

export class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(value) {
    this.result += value;
    return this;
  }
}

const helper = () => {
  return 'helper';
};

module.exports.legacy = function() {
  return 'legacy export';
};
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.language).toBe('javascript');
      
      const calculate = result.symbols.find(s => s.name === 'calculate');
      expect(calculate).toBeDefined();
      expect(calculate?.type).toBe('function');
      expect(calculate?.exported).toBe(true);
      
      const calculator = result.symbols.find(s => s.name === 'Calculator');
      expect(calculator).toBeDefined();
      expect(calculator?.type).toBe('class');
      expect(calculator?.exported).toBe(true);
    });
  });

  describe('Python files', () => {
    it('should handle Python functions and classes', async () => {
      const testFile = path.join(testDir, 'example.py');
      const content = `
import os
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class Config:
    name: str
    port: int
    
def parse_config(path: str) -> Config:
    """Parse configuration from file."""
    return Config("test", 8080)

async def fetch_data(url: str) -> dict:
    return {"data": "test"}

class Server:
    def __init__(self, config: Config):
        self.config = config
    
    def start(self) -> None:
        print(f"Starting {self.config.name}")

_private_var = "hidden"
PUBLIC_CONSTANT = 42
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.language).toBe('python');
      
      // Check imports
      expect(result.imports).toContain('os');
      expect(result.imports).toContain('typing');
      expect(result.imports).toContain('dataclasses');
      
      // Check class
      const configClass = result.symbols.find(s => s.name === 'Config');
      expect(configClass).toBeDefined();
      expect(configClass?.type).toBe('class');
      
      // Check functions
      const parseConfig = result.symbols.find(s => s.name === 'parse_config');
      expect(parseConfig).toBeDefined();
      expect(parseConfig?.type).toBe('function');
      expect(parseConfig?.signature).toContain('parse_config');
      expect(parseConfig?.signature).toContain('Config');
      
      const fetchData = result.symbols.find(s => s.name === 'fetch_data');
      expect(fetchData).toBeDefined();
      expect(fetchData?.signature).toContain('async');
    });
  });

  describe('Rust files', () => {
    it('should handle Rust functions and structs', async () => {
      const testFile = path.join(testDir, 'example.rs');
      const content = `
use std::io::{self, Read};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone)]
pub struct Config {
    pub name: String,
    port: u16,
}

impl Config {
    pub fn new(name: String, port: u16) -> Self {
        Config { name, port }
    }
    
    fn validate(&self) -> bool {
        self.port > 0
    }
}

pub fn parse_config(path: &str) -> Result<Config, io::Error> {
    Ok(Config::new("test".to_string(), 8080))
}

fn private_helper() -> i32 {
    42
}

pub trait Server {
    fn start(&self);
    fn stop(&self);
}
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.language).toBe('rust');
      
      // Check imports (use statements)
      expect(result.imports.some(i => i.includes('std::io'))).toBe(true);
      expect(result.imports.some(i => i.includes('serde'))).toBe(true);
      
      // Check struct
      const configStruct = result.symbols.find(s => s.name === 'Config');
      expect(configStruct).toBeDefined();
      // Note: Rust structs might be detected as 'class' or 'type' depending on parser
      
      // Check functions
      const parseConfig = result.symbols.find(s => s.name === 'parse_config');
      expect(parseConfig).toBeDefined();
      expect(parseConfig?.type).toBe('function');
      
      // Check methods
      const newMethod = result.symbols.find(s => s.name === 'new');
      if (newMethod) {
        expect(newMethod.type).toBe('method');
      }
    });
  });

  describe('Error handling', () => {
    it('should return error for non-existent file', async () => {
      const result = await getFileMetadata(project, { 
        filePath: '/non/existent/file.ts' 
      });
      
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('message');
      if ('error' in result) {
        expect(result.error).toBe('file_not_found');
        expect(result.message).toContain('File not found');
      }
    });

    it('should handle empty files', async () => {
      const testFile = path.join(testDir, 'empty.ts');
      await fs.writeFile(testFile, '');
      project.add_or_update_file(testFile, '');
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.symbols).toEqual([]);
      expect(result.symbolCount).toBe(0);
      expect(result.lineCount).toBe(1); // Empty file has 1 line
    });

    it('should handle files with only comments', async () => {
      const testFile = path.join(testDir, 'comments.ts');
      const content = `
// This is a comment
/* 
 * Multi-line comment
 * with no code
 */
// Another comment
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.symbols).toEqual([]);
      expect(result.imports).toEqual([]);
      expect(result.exports).toEqual([]);
    });
  });

  describe('Path handling', () => {
    it('should handle relative paths', async () => {
      const testFile = path.join(testDir, 'relative.ts');
      const content = 'export const test = 123;';
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      // Use relative path from cwd
      const relativePath = path.relative(process.cwd(), testFile);
      const result = await getFileMetadata(project, { filePath: relativePath });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.filePath).toBe(testFile);
      expect(result.symbols.length).toBeGreaterThan(0);
    });

    it('should handle absolute paths', async () => {
      const testFile = path.join(testDir, 'absolute.ts');
      const content = 'export const test = 456;';
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      expect(result.filePath).toBe(testFile);
      expect(result.symbols.length).toBeGreaterThan(0);
    });
  });

  describe('Signature extraction', () => {
    it('should extract clean signatures without braces', async () => {
      const testFile = path.join(testDir, 'signatures.ts');
      const content = `
export function simpleFunc() {
  return 'test';
}

export function withParams(a: string, b: number): void {
  console.log(a, b);
}

export class MyClass {
  constructor(public name: string) {}
}

export interface MyInterface {
  prop: string;
}

export const arrowFunc = (x: number): number => {
  return x * 2;
};
`.trim();
      
      await fs.writeFile(testFile, content);
      project.add_or_update_file(testFile, content);
      
      const result = await getFileMetadata(project, { filePath: testFile });
      
      expect(result).not.toHaveProperty('error');
      if ('error' in result) return;
      
      // Check that signatures don't include opening braces
      result.symbols.forEach(symbol => {
        expect(symbol.signature).not.toContain('{');
        expect(symbol.signature).not.toContain(';');
      });
      
      // Check specific signatures
      const simpleFunc = result.symbols.find(s => s.name === 'simpleFunc');
      expect(simpleFunc?.signature).toBe('export function simpleFunc()');
      
      const withParams = result.symbols.find(s => s.name === 'withParams');
      expect(withParams?.signature).toContain('withParams(a: string, b: number): void');
    });
  });
});