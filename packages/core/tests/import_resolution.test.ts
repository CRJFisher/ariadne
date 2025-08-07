import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { Project } from '../src/index';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Import Resolution in Project', () => {
  let tempDir: string;
  let project: Project;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-'));
    project = new Project();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('resolves TypeScript imports with module paths', () => {
    // Create test files
    const utilsContent = `
export function formatString(str: string): string {
  return str.toUpperCase();
}

export class StringUtils {
  static reverse(str: string): string {
    return str.split('').reverse().join('');
  }
}
`;

    const mainContent = `
import { formatString, StringUtils } from "./utils";

export function processText(text: string): string {
  const formatted = formatString(text);
  return StringUtils.reverse(formatted);
}
`;

    const utilsPath = path.join(tempDir, 'utils.ts');
    const mainPath = path.join(tempDir, 'main.ts');
    
    fs.writeFileSync(utilsPath, utilsContent);
    fs.writeFileSync(mainPath, mainContent);
    
    // Add files to project
    project.add_or_update_file(utilsPath, utilsContent);
    project.add_or_update_file(mainPath, mainContent);
    
    // Get imports with definitions
    const imports = project.get_imports_with_definitions(mainPath);
    
    // Debug: log what we found
    console.log('Imports found:', imports.map(i => ({
      local: i.local_name,
      imported: i.imported_function.name,
      from: i.imported_function.file_path,
      source_module: i.import_statement.source_module
    })));
    
    // Should find both imports
    expect(imports.length).toBe(2);
    
    // Check formatString import
    const formatImport = imports.find(i => i.local_name === 'formatString');
    expect(formatImport).toBeDefined();
    expect(formatImport!.imported_function.name).toBe('formatString');
    expect(formatImport!.imported_function.file_path).toBe(utilsPath);
    
    // Check StringUtils import
    const utilsImport = imports.find(i => i.local_name === 'StringUtils');
    expect(utilsImport).toBeDefined();
    expect(utilsImport!.imported_function.name).toBe('StringUtils');
    expect(utilsImport!.imported_function.file_path).toBe(utilsPath);
  });
});