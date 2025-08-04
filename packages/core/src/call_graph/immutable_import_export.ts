import { Def, Ref, ScopeGraph } from '../graph';
import { FileCache } from '../file_cache';
import { TreeNode } from '../parse';

// Re-export types we need
export type { Def, Ref } from '../graph';

/**
 * Result of export detection for a single export
 */
export interface ExportDetectionResult {
  readonly name: string;           // Local name of the exported item
  readonly exportName: string;     // Name it's exported as (may differ for renamed exports)
  readonly definition?: Def;       // The definition being exported
  readonly isDefault: boolean;     // Whether this is a default export
  readonly range: { start: { row: number; column: number }; end: { row: number; column: number } };
}

/**
 * Result of import detection for a single import
 */
export interface ImportDetectionResult {
  readonly localName: string;      // Name used locally in this file
  readonly importedName: string;   // Original name in source file
  readonly sourcePath: string;     // Path to the file being imported from
  readonly isDefault: boolean;     // Whether this is a default import
  readonly isNamespace: boolean;   // Whether this is a namespace import (import * as)
  readonly range: { start: { row: number; column: number }; end: { row: number; column: number } };
}

/**
 * Complete results from analyzing a file's imports and exports
 */
export interface FileImportExportData {
  readonly imports: readonly ImportDetectionResult[];
  readonly exports: readonly ExportDetectionResult[];
}

/**
 * Detect all exports in a file
 */
export function detect_file_exports(
  file_path: string,
  graph: ScopeGraph,
  fileCache: FileCache
): readonly ExportDetectionResult[] {
  const exports: ExportDetectionResult[] = [];
  const defs = graph.getNodes<Def>('definition');
  const refs = graph.getNodes<Ref>('reference');
  const sourceLines = fileCache.source_code.split('\n');
  
  // Handle Python files - all top-level non-private definitions are exported
  if (file_path.endsWith('.py')) {
    for (const def of defs) {
      if (def.is_exported !== false && 
          (def.symbol_kind === 'class' || def.symbol_kind === 'function') &&
          !def.name.startsWith('_')) {
        exports.push({
          name: def.name,
          exportName: def.name,
          definition: def,
          isDefault: false,
          range: def.range
        });
      }
    }
    return exports;
  }
  
  // Handle Rust files - check for pub keyword
  if (file_path.endsWith('.rs')) {
    for (const def of defs) {
      if (def.is_exported === true && 
          (def.symbol_kind === 'struct' || def.symbol_kind === 'enum' || 
           def.symbol_kind === 'function' || def.symbol_kind === 'trait')) {
        exports.push({
          name: def.name,
          exportName: def.name,
          definition: def,
          isDefault: false,
          range: def.range
        });
      }
    }
    return exports;
  }
  
  // Handle JavaScript/TypeScript files
  
  // Check for CommonJS exports in .js files
  if (file_path.endsWith('.js')) {
    // module.exports = ClassName or module.exports = { ... }
    const moduleExportsMatch = fileCache.source_code.match(/module\.exports\s*=\s*(\w+|\{[^}]+\})/);
    if (moduleExportsMatch) {
      const exportedValue = moduleExportsMatch[1];
      const matchStart = moduleExportsMatch.index || 0;
      const lineNum = fileCache.source_code.substring(0, matchStart).split('\n').length - 1;
      const colNum = fileCache.source_code.split('\n')[lineNum].indexOf('module.exports');
      
      // Single export: module.exports = ClassName
      if (!exportedValue.startsWith('{')) {
        const exportedDef = defs.find(d => d.name === exportedValue);
        if (exportedDef) {
          exports.push({
            name: exportedDef.name,
            exportName: 'default',
            definition: exportedDef,
            isDefault: true,
            range: { 
              start: { row: lineNum, column: colNum },
              end: { row: lineNum, column: colNum + moduleExportsMatch[0].length }
            }
          });
        }
      } else {
        // Object export: module.exports = { func1, Class1 }
        const exportedNames = exportedValue.match(/\w+/g) || [];
        for (const name of exportedNames) {
          const def = defs.find(d => d.name === name);
          if (def) {
            exports.push({
              name: def.name,
              exportName: def.name,
              definition: def,
              isDefault: false,
              range: { 
                start: { row: lineNum, column: colNum },
                end: { row: lineNum, column: colNum + moduleExportsMatch[0].length }
              }
            });
          }
        }
      }
    }
    
    // Check for exports.name = value pattern
    const exportsAssignments = Array.from(fileCache.source_code.matchAll(/exports\.(\w+)\s*=\s*(\w+)/g));
    for (const match of exportsAssignments) {
      const [fullMatch, exportName, valueName] = match;
      const def = defs.find(d => d.name === valueName);
      if (def) {
        const matchStart = match.index || 0;
        const lineNum = fileCache.source_code.substring(0, matchStart).split('\n').length - 1;
        const colNum = fileCache.source_code.split('\n')[lineNum].indexOf(fullMatch);
        
        exports.push({
          name: valueName,
          exportName: exportName,
          definition: def,
          isDefault: false,
          range: { 
            start: { row: lineNum, column: colNum },
            end: { row: lineNum, column: colNum + fullMatch.length }
          }
        });
      }
    }
  }
  
  // Check for ES6 export statements
  
  // First check references (export { name })
  for (const ref of refs) {
    const line = sourceLines[ref.range.start.row];
    if (line) {
      const beforeRef = line.substring(0, ref.range.start.column);
      if (beforeRef.match(/export\s*(default\s*)?$/)) {
        const isDefault = beforeRef.includes('default');
        const def = defs.find(d => d.name === ref.name);
        
        exports.push({
          name: ref.name,
          exportName: isDefault ? 'default' : ref.name,
          definition: def,
          isDefault,
          range: ref.range
        });
      }
    }
  }
  
  // Check for export declarations (export function/class)
  for (const def of defs) {
    if (def.symbol_kind === 'class' || def.symbol_kind === 'function') {
      const line = sourceLines[def.range.start.row];
      if (line) {
        // For ES6 exports, check if 'export' appears before the definition
        // This regex matches 'export' or 'export default' at the beginning of the line
        const exportMatch = line.match(/^\s*export(\s+default)?\s+/);
        if (exportMatch) {
          const isDefault = !!exportMatch[1]; // Check if 'default' is present
          
          // Check if we already have this export
          const exists = exports.some(e => 
            e.name === def.name && 
            e.range.start.row === def.range.start.row
          );
          
          if (!exists) {
            exports.push({
              name: def.name,
              exportName: isDefault ? 'default' : def.name,
              definition: def,
              isDefault,
              range: def.range
            });
          }
        }
      }
    }
  }
  
  return exports;
}

/**
 * Detect all imports in a file
 */
export function detect_file_imports(
  file_path: string,
  graph: ScopeGraph,
  fileCache: FileCache
): readonly ImportDetectionResult[] {
  const imports: ImportDetectionResult[] = [];
  const refs = graph.getNodes<Ref>('reference');
  const sourceLines = fileCache.source_code.split('\n');
  
  // For Python files, look for import statements
  if (file_path.endsWith('.py')) {
    // import module
    const importMatches = Array.from(fileCache.source_code.matchAll(/^import\s+(\w+)$/gm));
    for (const match of importMatches) {
      const [fullMatch, moduleName] = match;
      const matchStart = match.index || 0;
      const lineNum = fileCache.source_code.substring(0, matchStart).split('\n').length - 1;
      
      imports.push({
        localName: moduleName,
        importedName: moduleName,
        sourcePath: moduleName,
        isDefault: false,
        isNamespace: true,
        range: {
          start: { row: lineNum, column: 0 },
          end: { row: lineNum, column: fullMatch.length }
        }
      });
    }
    
    // from module import name
    const fromImportMatches = Array.from(fileCache.source_code.matchAll(/^from\s+([\w.]+)\s+import\s+(.+)$/gm));
    for (const match of fromImportMatches) {
      const [fullMatch, modulePath, importList] = match;
      const matchStart = match.index || 0;
      const lineNum = fileCache.source_code.substring(0, matchStart).split('\n').length - 1;
      
      // Parse import list (can be "name", "name as alias", or multiple)
      const importItems = importList.split(',').map(s => s.trim());
      for (const item of importItems) {
        const asMatch = item.match(/(\w+)\s+as\s+(\w+)/);
        if (asMatch) {
          const [, importedName, localName] = asMatch;
          imports.push({
            localName,
            importedName,
            sourcePath: modulePath,
            isDefault: false,
            isNamespace: false,
            range: {
              start: { row: lineNum, column: 0 },
              end: { row: lineNum, column: fullMatch.length }
            }
          });
        } else {
          const name = item.trim();
          imports.push({
            localName: name,
            importedName: name,
            sourcePath: modulePath,
            isDefault: false,
            isNamespace: false,
            range: {
              start: { row: lineNum, column: 0 },
              end: { row: lineNum, column: fullMatch.length }
            }
          });
        }
      }
    }
    
    return imports;
  }
  
  // For Rust files, look for use statements
  if (file_path.endsWith('.rs')) {
    const useMatches = Array.from(fileCache.source_code.matchAll(/^use\s+(.+);$/gm));
    for (const match of useMatches) {
      const [fullMatch, usePath] = match;
      const matchStart = match.index || 0;
      const lineNum = fileCache.source_code.substring(0, matchStart).split('\n').length - 1;
      
      // Extract the last part as the local name
      const parts = usePath.split('::');
      const localName = parts[parts.length - 1];
      
      imports.push({
        localName,
        importedName: localName,
        sourcePath: usePath,
        isDefault: false,
        isNamespace: false,
        range: {
          start: { row: lineNum, column: 0 },
          end: { row: lineNum, column: fullMatch.length }
        }
      });
    }
    
    return imports;
  }
  
  // For JavaScript/TypeScript files
  
  // CommonJS require
  if (file_path.endsWith('.js')) {
    const requireMatches = Array.from(fileCache.source_code.matchAll(/const\s+(\w+)\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g));
    for (const match of requireMatches) {
      const [fullMatch, localName, sourcePath] = match;
      const matchStart = match.index || 0;
      const lineNum = fileCache.source_code.substring(0, matchStart).split('\n').length - 1;
      const colNum = fileCache.source_code.split('\n')[lineNum].indexOf(fullMatch);
      
      imports.push({
        localName,
        importedName: 'default',
        sourcePath,
        isDefault: true,
        isNamespace: false,
        range: {
          start: { row: lineNum, column: colNum },
          end: { row: lineNum, column: colNum + fullMatch.length }
        }
      });
    }
  }
  
  // ES6 imports
  const importStatements = Array.from(fileCache.source_code.matchAll(/^import\s+(.+?)\s+from\s+['"`]([^'"`]+)['"`]/gm));
  for (const match of importStatements) {
    const [fullMatch, importClause, sourcePath] = match;
    const matchStart = match.index || 0;
    const lineNum = fileCache.source_code.substring(0, matchStart).split('\n').length - 1;
    
    // Parse import clause
    // Default import: import Foo from 'foo'
    if (!importClause.includes('{') && !importClause.includes('*')) {
      imports.push({
        localName: importClause.trim(),
        importedName: 'default',
        sourcePath,
        isDefault: true,
        isNamespace: false,
        range: {
          start: { row: lineNum, column: 0 },
          end: { row: lineNum, column: fullMatch.length }
        }
      });
    }
    // Namespace import: import * as Foo from 'foo'
    else if (importClause.includes('*')) {
      const namespaceMatch = importClause.match(/\*\s+as\s+(\w+)/);
      if (namespaceMatch) {
        imports.push({
          localName: namespaceMatch[1],
          importedName: '*',
          sourcePath,
          isDefault: false,
          isNamespace: true,
          range: {
            start: { row: lineNum, column: 0 },
            end: { row: lineNum, column: fullMatch.length }
          }
        });
      }
    }
    // Named imports: import { Foo, Bar as Baz } from 'foo'
    else {
      const namedMatch = importClause.match(/\{([^}]+)\}/);
      if (namedMatch) {
        const namedImports = namedMatch[1].split(',').map(s => s.trim());
        for (const namedImport of namedImports) {
          const asMatch = namedImport.match(/(\w+)\s+as\s+(\w+)/);
          if (asMatch) {
            const [, importedName, localName] = asMatch;
            imports.push({
              localName,
              importedName,
              sourcePath,
              isDefault: false,
              isNamespace: false,
              range: {
                start: { row: lineNum, column: 0 },
                end: { row: lineNum, column: fullMatch.length }
              }
            });
          } else {
            const name = namedImport.trim();
            imports.push({
              localName: name,
              importedName: name,
              sourcePath,
              isDefault: false,
              isNamespace: false,
              range: {
                start: { row: lineNum, column: 0 },
                end: { row: lineNum, column: fullMatch.length }
              }
            });
          }
        }
      }
    }
  }
  
  return imports;
}

/**
 * Analyze a file for both imports and exports
 */
export function analyze_file_import_export(
  file_path: string,
  graph: ScopeGraph,
  fileCache: FileCache
): FileImportExportData {
  return {
    imports: detect_file_imports(file_path, graph, fileCache),
    exports: detect_file_exports(file_path, graph, fileCache)
  };
}

/**
 * Helper to check if an export is a class export
 */
export function is_class_export(exportResult: ExportDetectionResult): boolean {
  return exportResult.definition?.symbol_kind === 'class';
}

/**
 * Helper to check if an export is a function export
 */
export function is_function_export(exportResult: ExportDetectionResult): boolean {
  return exportResult.definition?.symbol_kind === 'function';
}

/**
 * Compute enclosing range for a class definition
 * This is a pure function version of the method in ProjectCallGraph
 */
export function compute_class_enclosing_range(
  classDef: Def,
  tree: TreeNode
): { start: { row: number; column: number }; end: { row: number; column: number } } | undefined {
  // Find the class node in the tree
  function findClassNode(node: TreeNode): TreeNode | undefined {
    if (node.start_position.row === classDef.range.start.row &&
        node.start_position.column === classDef.range.start.column &&
        (node.type === 'class_definition' || node.type === 'class_declaration' || 
         node.type === 'struct_item' || node.type === 'impl_item')) {
      return node;
    }
    
    for (const child of node.children) {
      const found = findClassNode(child);
      if (found) return found;
    }
    
    return undefined;
  }
  
  const classNode = findClassNode(tree);
  if (!classNode) return undefined;
  
  return {
    start: { row: classNode.start_position.row, column: classNode.start_position.column },
    end: { row: classNode.end_position.row, column: classNode.end_position.column }
  };
}