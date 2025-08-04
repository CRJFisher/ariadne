import { Point, Def, Ref, FunctionCall, ImportInfo, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, SimpleRange } from './graph';
import { ScopeGraph } from './graph'; // Internal use only
import { LanguageConfig } from './types';
import { Tree } from 'tree-sitter';
import { normalize_module_path } from './symbol_naming';

/**
 * Tracks variable type information at the file level
 */
class FileTypeTracker {
  // Track variable types with position information
  private variableTypes = new Map<string, Array<{ 
    className: string; 
    classDef?: Def & { enclosing_range?: SimpleRange };
    position: { row: number; column: number }; // Position where the assignment happens
  }>>();
  private importedClasses = new Map<string, { className: string; classDef: Def & { enclosing_range?: SimpleRange }; sourceFile: string }>();
  private exportedDefinitions = new Set<string>(); // Track which definitions are exported
  
  /**
   * Set the type of a variable at a specific position
   */
  setVariableType(varName: string, typeInfo: { 
    className: string; 
    classDef?: Def & { enclosing_range?: SimpleRange };
    position: { row: number; column: number };
  }) {
    const types = this.variableTypes.get(varName) || [];
    types.push(typeInfo);
    // Sort by position (row, then column) so we can find the right type for a given position
    types.sort((a, b) => {
      if (a.position.row !== b.position.row) {
        return a.position.row - b.position.row;
      }
      return a.position.column - b.position.column;
    });
    this.variableTypes.set(varName, types);
  }
  
  /**
   * Get the type of a variable at a specific position
   */
  getVariableType(varName: string, position?: { row: number; column: number }) {
    const types = this.variableTypes.get(varName);
    if (!types || types.length === 0) return undefined;
    
    // If no position specified, return the last type (backward compatibility)
    if (!position) {
      return types[types.length - 1];
    }
    
    // Find the type that was assigned before this position
    let lastType = undefined;
    for (const typeInfo of types) {
      // If this assignment is after the position we're checking, stop
      if (typeInfo.position.row > position.row || 
          (typeInfo.position.row === position.row && typeInfo.position.column > position.column)) {
        break;
      }
      lastType = typeInfo;
    }
    
    return lastType;
  }
  
  /**
   * Track an imported class
   */
  setImportedClass(localName: string, classInfo: { className: string; classDef: Def & { enclosing_range?: SimpleRange }; sourceFile: string }) {
    this.importedClasses.set(localName, classInfo);
  }
  
  /**
   * Get imported class information
   */
  getImportedClass(localName: string) {
    return this.importedClasses.get(localName);
  }
  
  /**
   * Mark a definition as exported
   */
  markAsExported(defName: string) {
    this.exportedDefinitions.add(defName);
  }
  
  /**
   * Check if a definition is exported
   */
  isExported(defName: string): boolean {
    return this.exportedDefinitions.has(defName);
  }
  
  /**
   * Get all exported definitions
   */
  getExportedDefinitions(): Set<string> {
    return this.exportedDefinitions;
  }
  
  /**
   * Clear all type information for this file
   */
  clear() {
    this.variableTypes.clear();
    this.importedClasses.clear();
    this.exportedDefinitions.clear();
  }
  
  /**
   * Get all variable types (for debugging/testing)
   */
  getAllTypes() {
    return new Map(this.variableTypes);
  }
}

/**
 * Local type tracker that inherits from a parent tracker
 */
class LocalTypeTracker {
  private localTypes = new Map<string, Array<{
    className: string;
    classDef?: Def & { enclosing_range?: SimpleRange };
    position: { row: number; column: number };
  }>>();
  
  constructor(private parent: FileTypeTracker) {}
  
  setVariableType(varName: string, typeInfo: { 
    className: string; 
    classDef?: Def & { enclosing_range?: SimpleRange };
    position: { row: number; column: number };
  }) {
    const types = this.localTypes.get(varName) || [];
    types.push(typeInfo);
    // Sort by position (row, then column)
    types.sort((a, b) => {
      if (a.position.row !== b.position.row) {
        return a.position.row - b.position.row;
      }
      return a.position.column - b.position.column;
    });
    this.localTypes.set(varName, types);
  }
  
  getVariableType(varName: string, position?: { row: number; column: number }) {
    // First check local types
    const localTypes = this.localTypes.get(varName);
    if (localTypes && localTypes.length > 0) {
      if (!position) {
        return localTypes[localTypes.length - 1];
      }
      
      // Find the type that was assigned before this position
      let lastType = undefined;
      for (const typeInfo of localTypes) {
        if (typeInfo.position.row > position.row || 
            (typeInfo.position.row === position.row && typeInfo.position.column > position.column)) {
          break;
        }
        lastType = typeInfo;
      }
      
      if (lastType) return lastType;
    }
    
    // Then check parent
    return this.parent.getVariableType(varName, position);
  }
  
  getImportedClass(localName: string) {
    // Imported classes are always at file level
    return this.parent.getImportedClass(localName);
  }
}

/**
 * Cached file data for incremental parsing
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph; // Internal use - not exposed in public API
}

/**
 * Registry for tracking type information across files in a project
 */
class ProjectTypeRegistry {
  // Map of exported symbols to their type information
  private exportedTypes = new Map<string, {
    className: string;
    classDef: Def & { enclosing_range?: SimpleRange };
    sourceFile: string;
  }>();
  
  // Map of file paths to their exported symbols
  private fileExports = new Map<string, Set<string>>();
  
  /**
   * Register an exported type from a file
   */
  registerExport(
    file_path: string,
    exportName: string,
    className: string,
    classDef: Def & { enclosing_range?: SimpleRange }
  ) {
    const symbol = `${normalize_module_path(file_path)}#${exportName}`;
    
    this.exportedTypes.set(symbol, {
      className,
      classDef,
      sourceFile: file_path
    });
    
    // Track which file exports this symbol
    if (!this.fileExports.has(file_path)) {
      this.fileExports.set(file_path, new Set());
    }
    this.fileExports.get(file_path)!.add(symbol);
  }
  
  /**
   * Get type information for an imported symbol
   */
  getImportedType(
    importedFrom: string,
    importName: string
  ): { className: string; classDef: Def & { enclosing_range?: SimpleRange }; sourceFile: string } | undefined {
    const symbol = `${normalize_module_path(importedFrom)}#${importName}`;
    return this.exportedTypes.get(symbol);
  }
  
  /**
   * Clear type information for a specific file (when file is updated)
   */
  clearFileExports(file_path: string) {
    const exports = this.fileExports.get(file_path);
    if (exports) {
      for (const symbol of exports) {
        this.exportedTypes.delete(symbol);
      }
      this.fileExports.delete(file_path);
    }
  }
  
  /**
   * Get all exported types (for debugging)
   */
  getAllExports() {
    return new Map(this.exportedTypes);
  }
}

/**
 * Handles call graph related operations for the Project class.
 * This class extracts call graph functionality to reduce the size of the Project class.
 */
export class ProjectCallGraph {
  private file_graphs: Map<string, ScopeGraph>;
  private file_cache: Map<string, FileCache>;
  private languages: Map<string, LanguageConfig>;
  private file_type_trackers: Map<string, FileTypeTracker>;
  private project_type_registry: ProjectTypeRegistry;

  constructor(
    file_graphs: Map<string, ScopeGraph>,
    file_cache: Map<string, FileCache>,
    languages: Map<string, LanguageConfig>
  ) {
    this.file_graphs = file_graphs;
    this.file_cache = file_cache;
    this.languages = languages;
    this.file_type_trackers = new Map();
    this.project_type_registry = new ProjectTypeRegistry();
  }
  
  /**
   * Get or create a FileTypeTracker for a given file
   */
  private getFileTypeTracker(file_path: string): FileTypeTracker {
    let tracker = this.file_type_trackers.get(file_path);
    if (!tracker) {
      tracker = new FileTypeTracker();
      this.file_type_trackers.set(file_path, tracker);
    }
    return tracker;
  }
  
  /**
   * Clear type tracker for a file (should be called when file is updated)
   */
  clearFileTypeTracker(file_path: string) {
    const tracker = this.file_type_trackers.get(file_path);
    if (tracker) {
      tracker.clear();
    }
    // Also clear from project registry
    this.project_type_registry.clearFileExports(file_path);
  }
  
  /**
   * Check if a definition in a file is exported
   */
  isDefinitionExported(file_path: string, def_name: string): boolean {
    const tracker = this.file_type_trackers.get(file_path);
    return tracker ? tracker.isExported(def_name) : false;
  }
  
  /**
   * Initialize import information for a file
   */
  private initializeFileImports(file_path: string) {
    const tracker = this.getFileTypeTracker(file_path);
    const imports = this.get_imports_with_definitions(file_path);
    
    
    // First detect exports in the imported files
    const processedFiles = new Set<string>();
    for (const importInfo of imports) {
      const sourceFile = importInfo.imported_function.file_path;
      if (!processedFiles.has(sourceFile)) {
        this.detectFileExports(sourceFile);
        processedFiles.add(sourceFile);
      }
    }
    
    // Track all imported classes
    for (const importInfo of imports) {
      
      // Check if we can get the type from project registry
      const projectType = this.project_type_registry.getImportedType(
        importInfo.imported_function.file_path,
        importInfo.imported_function.name
      );
      
      if (projectType) {
        // Use type from project registry
        tracker.setImportedClass(importInfo.local_name, projectType);
      } else if (importInfo.imported_function.symbol_kind === 'class') {
        // Fallback to direct import resolution
        const classDef = importInfo.imported_function;
        const fileCache = this.file_cache.get(classDef.file_path);
        
        // Compute enclosing range if needed
        const classDefWithRange = {
          ...classDef,
          enclosing_range: (classDef as any).enclosing_range || 
            (fileCache ? this.computeClassEnclosingRange(classDef, fileCache.tree) : undefined)
        };
        
        tracker.setImportedClass(importInfo.local_name, {
          className: importInfo.imported_function.name,
          classDef: classDefWithRange,
          sourceFile: importInfo.imported_function.file_path
        });
      }
    }
  }
  
  /**
   * Detect and track exported definitions in a file
   */
  private detectFileExports(file_path: string) {
    const tracker = this.getFileTypeTracker(file_path);
    const graph = this.file_graphs.get(file_path);
    if (!graph) return;
    
    
    // Get all references in the file
    const refs = graph.getNodes<Ref>('reference');
    const defs = graph.getNodes<Def>('definition');
    
    // For JavaScript/TypeScript, exports create references
    // Look for references that appear directly after "export" keyword
    const fileCache = this.file_cache.get(file_path);
    if (!fileCache) return;
    
    // Handle Python files differently - all top-level definitions are implicitly exported
    if (file_path.endsWith('.py')) {
      for (const def of defs) {
        // In Python, all top-level definitions are exported unless they start with underscore
        // or are explicitly excluded by __all__
        if (def.is_exported !== false && 
            (def.symbol_kind === 'class' || def.symbol_kind === 'function') &&
            !def.name.startsWith('_')) {
          tracker.markAsExported(def.name);
          
          if (def.symbol_kind === 'class') {
            const defWithRange = {
              ...def,
              enclosing_range: (def as any).enclosing_range || 
                (fileCache ? this.computeClassEnclosingRange(def, fileCache.tree) : undefined)
            };
            this.project_type_registry.registerExport(file_path, def.name, def.name, defWithRange);
          }
        }
      }
      return;
    }
    
    // Handle Rust files - check for pub keyword
    if (file_path.endsWith('.rs')) {
      for (const def of defs) {
        // In Rust, items marked with 'pub' are exported
        if (def.is_exported === true && 
            (def.symbol_kind === 'struct' || def.symbol_kind === 'enum' || 
             def.symbol_kind === 'function' || def.symbol_kind === 'trait')) {
          tracker.markAsExported(def.name);
          
          if (def.symbol_kind === 'struct') {
            const defWithRange = {
              ...def,
              enclosing_range: (def as any).enclosing_range || 
                (fileCache ? this.computeClassEnclosingRange(def, fileCache.tree) : undefined)
            };
            this.project_type_registry.registerExport(file_path, def.name, def.name, defWithRange);
          }
        }
      }
      return;
    }
    
    const sourceLines = fileCache.source_code.split('\n');
    
    // For JavaScript files, also check for CommonJS exports
    if (file_path.endsWith('.js')) {
      // Check for module.exports = ClassName or module.exports = { ... }
      const moduleExportsMatch = fileCache.source_code.match(/module\.exports\s*=\s*(\w+|\{[^}]+\})/);
      if (moduleExportsMatch) {
        const exportedValue = moduleExportsMatch[1];
        
        // Single export: module.exports = ClassName
        if (!exportedValue.startsWith('{')) {
          const exportedDef = defs.find(d => d.name === exportedValue);
          if (exportedDef) {
            tracker.markAsExported(exportedDef.name);
            
            if (exportedDef.symbol_kind === 'class') {
              const defWithRange = {
                ...exportedDef,
                enclosing_range: (exportedDef as any).enclosing_range || 
                  (fileCache ? this.computeClassEnclosingRange(exportedDef, fileCache.tree) : undefined)
              };
              this.project_type_registry.registerExport(file_path, exportedDef.name, exportedDef.name, defWithRange);
            }
          }
        } else {
          // Object export: module.exports = { func1, Class1 }
          const exportedNames = exportedValue.match(/\w+/g) || [];
          for (const name of exportedNames) {
            const def = defs.find(d => d.name === name);
            if (def) {
              tracker.markAsExported(def.name);
              
              if (def.symbol_kind === 'class') {
                const defWithRange = {
                  ...def,
                  enclosing_range: (def as any).enclosing_range || 
                    (fileCache ? this.computeClassEnclosingRange(def, fileCache.tree) : undefined)
                };
                this.project_type_registry.registerExport(file_path, def.name, def.name, defWithRange);
              }
            }
          }
        }
      }
      
      // Check for exports.name = value pattern
      const exportsAssignments = fileCache.source_code.matchAll(/exports\.(\w+)\s*=\s*(\w+)/g);
      for (const match of exportsAssignments) {
        const [, exportName, valueName] = match;
        const def = defs.find(d => d.name === valueName);
        if (def) {
          tracker.markAsExported(def.name);
          
          if (def.symbol_kind === 'class') {
            const defWithRange = {
              ...def,
              enclosing_range: (def as any).enclosing_range || 
                (fileCache ? this.computeClassEnclosingRange(def, fileCache.tree) : undefined)
            };
            this.project_type_registry.registerExport(file_path, def.name, exportName, defWithRange);
          }
        }
      }
    }
    
    // Check for ES6 export statements
    for (const ref of refs) {
      const line = sourceLines[ref.range.start.row];
      if (line) {
        // Check if this reference is part of an export statement
        const beforeRef = line.substring(0, ref.range.start.column);
        if (beforeRef.match(/export\s*(default\s*)?$/)) {
          // This is an exported reference
          tracker.markAsExported(ref.name);
          
          
          // If it's a class or function, register with project registry
          const def = defs.find(d => d.name === ref.name && (d.symbol_kind === 'class' || d.symbol_kind === 'function'));
          if (def && def.symbol_kind === 'class') {
            const defWithRange = {
              ...def,
              enclosing_range: (def as any).enclosing_range || 
                (fileCache ? this.computeClassEnclosingRange(def, fileCache.tree) : undefined)
            };
            this.project_type_registry.registerExport(file_path, def.name, def.name, defWithRange);
          }
        }
      }
    }
    
    // Also check for export declarations (export function/class)
    for (const def of defs) {
      if (def.symbol_kind === 'class' || def.symbol_kind === 'function' || def.symbol_kind === 'method') {
        const line = sourceLines[def.range.start.row];
        if (line) {
          const beforeDef = line.substring(0, def.range.start.column);
          if (beforeDef.match(/export\s*(default\s*)?$/)) {
            tracker.markAsExported(def.name);
            
            if (def.symbol_kind === 'class') {
              const defWithRange = {
                ...def,
                enclosing_range: (def as any).enclosing_range || 
                  (fileCache ? this.computeClassEnclosingRange(def, fileCache.tree) : undefined)
              };
              this.project_type_registry.registerExport(file_path, def.name, def.name, defWithRange);
            }
          }
        }
      }
    }
  }
  
  /**
   * Create a local type tracker that inherits from file-level tracker
   */
  private createLocalTypeTracker(fileTypeTracker: FileTypeTracker): LocalTypeTracker {
    return new LocalTypeTracker(fileTypeTracker);
  }
  
  /**
   * Track implicit instance parameter for methods (self, this, etc.)
   */
  private trackImplicitInstanceParameter(methodDef: Def, localTypeTracker: LocalTypeTracker, fileCache: FileCache) {
    console.log(`Tracking implicit parameter for method: ${methodDef.name} in ${methodDef.file_path}`);
    
    // Find the containing class
    const allDefs = this.file_graphs.get(methodDef.file_path)?.getNodes<Def>('definition') || [];
    console.log(`Found ${allDefs.length} definitions in file`);
    
    // Look for a class definition that contains this method
    for (const def of allDefs) {
      if (def.symbol_kind === 'class') {
        const classDef = def;
        const classRange = (classDef as any).enclosing_range || this.computeClassEnclosingRange(classDef, fileCache.tree);
        
        console.log(`Checking if method is in class ${classDef.name}, classRange:`, classRange);
        
        if (classRange && 
            this.is_position_within_range(methodDef.range.start, classRange) &&
            this.is_position_within_range(methodDef.range.end, classRange)) {
          // This method is inside this class
          console.log(`Method ${methodDef.name} is inside class ${classDef.name}`);
          const classDefWithRange = {
            ...classDef,
            enclosing_range: classRange
          };
          
          // Track the implicit parameter based on language
          if (methodDef.file_path.endsWith('.py')) {
            // Python: track 'self' or 'cls'
            console.log(`Setting Python self type to ${classDef.name}`);
            localTypeTracker.setVariableType('self', {
              className: classDef.name,
              classDef: classDefWithRange,
              position: methodDef.range.start
            });
            localTypeTracker.setVariableType('cls', {
              className: classDef.name,
              classDef: classDefWithRange,
              position: methodDef.range.start
            });
          } else if (methodDef.file_path.match(/\.(js|jsx|ts|tsx)$/)) {
            // JavaScript/TypeScript: track 'this'
            localTypeTracker.setVariableType('this', {
              className: classDef.name,
              classDef: classDefWithRange,
              position: methodDef.range.start
            });
          } else if (methodDef.file_path.endsWith('.rs')) {
            // Rust: track 'self' (various forms)
            localTypeTracker.setVariableType('self', {
              className: classDef.name,
              classDef: classDefWithRange,
              position: methodDef.range.start
            });
          }
          
          break; // Found the containing class
        }
      }
    }
  }

  /**
   * Get all module-level calls (calls made outside any function/class definition).
   * 
   * @param file_path - The file to analyze
   * @returns Array of FunctionCall objects representing module-level calls
   */
  get_module_level_calls(file_path: string): FunctionCall[] {
    const graph = this.file_graphs.get(file_path);
    const fileCache = this.file_cache.get(file_path);
    if (!graph || !fileCache) return [];
    
    const calls: FunctionCall[] = [];
    
    // Get all references in the file
    const refs = graph.getNodes<Ref>('reference');
    
    // Get all definitions to check ranges
    const defs = graph.getNodes<Def>('definition');
    
    // Filter to only references that are NOT within any definition
    const moduleLevelRefs = refs.filter(ref => {
      // Check if this ref is inside any definition
      for (const def of defs) {
        // Use enclosing_range if available, otherwise use range
        const defRange = (def as any).enclosing_range || def.range;
        if (this.is_position_within_range(ref.range.start, defRange) &&
            this.is_position_within_range(ref.range.end, defRange)) {
          return false; // This ref is inside a definition
        }
      }
      return true; // This ref is at module level
    });
    
    // For each module-level reference, try to resolve it
    for (const ref of moduleLevelRefs) {
      const resolved = this.go_to_definition(file_path, ref.range.start);
      if (resolved) {
        // If resolved to an import, try to resolve the import to its actual definition
        let final_resolved = resolved;
        if (resolved.symbol_kind === 'import') {
          // Get all imports with their resolved definitions
          const imports = this.get_imports_with_definitions(file_path);
          const import_info = imports.find(imp => 
            imp.import_statement.name === resolved.name &&
            imp.import_statement.range.start.row === resolved.range.start.row &&
            imp.import_statement.range.start.column === resolved.range.start.column
          );
          
          if (import_info && import_info.imported_function) {
            final_resolved = import_info.imported_function;
          }
        }
        
        // Include all callable symbol kinds
        const callable_kinds = ['function', 'method', 'generator', 'class', 'constructor'];
        if (callable_kinds.includes(final_resolved.symbol_kind)) {
          // Check if this is a method call
          let is_method_call = ref.symbol_kind === 'method';
          
          // Additional check for method calls in different languages
          if (!is_method_call) {
            const lines = fileCache.source_code.split('\n');
            const refLine = lines[ref.range.start.row];
            const beforeRef = refLine.substring(0, ref.range.start.column);
            
            // Check for method call patterns
            if (file_path.endsWith('.py') && beforeRef.endsWith('.')) {
              is_method_call = true;
            } else if ((file_path.endsWith('.ts') || file_path.endsWith('.js')) && 
                       (beforeRef.endsWith('.') || beforeRef.endsWith('?.'))) {
              is_method_call = true;
            } else if (file_path.endsWith('.rs') && 
                       (beforeRef.endsWith('.') || beforeRef.endsWith('::'))) {
              is_method_call = true;
            }
          }
          
          // Create a pseudo-definition for the module
          const moduleDef: Def = {
            id: -1, // Special ID for module
            kind: 'definition',
            name: '<module>',
            symbol_id: `${file_path}#<module>`,
            symbol_kind: 'module' as any, // Module is a special case
            range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } },
            file_path: file_path
          };
          
          const call = {
            caller_def: moduleDef,
            called_def: final_resolved,
            call_location: ref.range.start,
            is_method_call
          };
          calls.push(call);
        }
      }
    }
    
    return calls;
  }

  /**
   * Get all calls (function, method, and constructor) made from within a definition's body.
   * Works with any definition type including functions, methods, classes, and blocks.
   * 
   * @param def - The definition to analyze
   * @returns Array of FunctionCall objects representing calls made within this definition
   */
  get_calls_from_definition(def: Def): FunctionCall[] {
    const graph = this.file_graphs.get(def.file_path);
    const fileCache = this.file_cache.get(def.file_path);
    if (!graph || !fileCache) return [];
    
    const calls: FunctionCall[] = [];
    
    // Get file-level type tracker for variable types
    const fileTypeTracker = this.getFileTypeTracker(def.file_path);
    
    // Initialize import information for this file
    this.initializeFileImports(def.file_path);
    
    // Create a local type tracker that inherits from file-level tracker
    // This allows method-specific types (like self/this) without polluting file scope
    const localTypeTracker = this.createLocalTypeTracker(fileTypeTracker);
    
    // If this is a method, track implicit instance parameter
    if (def.symbol_kind === 'method') {
      this.trackImplicitInstanceParameter(def, localTypeTracker, fileCache);
    }
    
    // Find the full definition body range using AST traversal
    let definitionRange = def.range;
    
    // Find the AST node for this definition
    const defNode = fileCache.tree.rootNode.descendantForPosition(
      { row: def.range.start.row, column: def.range.start.column },
      { row: def.range.end.row, column: def.range.end.column }
    );
    
    if (defNode) {
      // Walk up the tree to find the full definition node based on symbol_kind
      let current = defNode.parent;
      while (current) {
        const nodeType = current.type;
        let foundDefinitionNode = false;
        
        // Check for function/method nodes
        if (['function', 'method', 'generator'].includes(def.symbol_kind)) {
          if (nodeType === 'function_declaration' ||
              nodeType === 'method_definition' ||
              nodeType === 'generator_function_declaration' ||
              nodeType === 'function_expression' ||
              nodeType === 'arrow_function' ||
              nodeType === 'function_definition' || // Python
              nodeType === 'decorated_definition' || // Python with decorators
              nodeType === 'function_item') { // Rust
            foundDefinitionNode = true;
          }
        }
        // Check for class nodes
        else if (def.symbol_kind === 'class') {
          if (nodeType === 'class_declaration' ||
              nodeType === 'class_definition' || // Python
              nodeType === 'struct_item' || // Rust
              nodeType === 'impl_item') { // Rust
            foundDefinitionNode = true;
          }
        }
        // Check for variable/const nodes that might have initializers
        else if (['variable', 'const', 'let', 'constant'].includes(def.symbol_kind)) {
          if (nodeType === 'variable_declarator') {
            // For variable declarator, use its range which includes the initializer
            foundDefinitionNode = true;
          } else if (nodeType === 'variable_declaration' ||
                     nodeType === 'lexical_declaration' ||
                     nodeType === 'assignment' || // Python
                     nodeType === 'let_declaration' || // Rust
                     nodeType === 'const_item') { // Rust
            foundDefinitionNode = true;
          }
        }
        
        if (foundDefinitionNode) {
          // Found the definition node, use its range
          definitionRange = {
            start: { row: current.startPosition.row, column: current.startPosition.column },
            end: { row: current.endPosition.row, column: current.endPosition.column }
          };
          break;
        }
        current = current.parent;
      }
    }
    
    // Get all references in this file
    const refs = graph.getNodes<Ref>('reference');
    
    // Filter to only refs within this definition's range
    const definitionRefs = refs.filter(ref => 
      this.is_position_within_range(ref.range.start, definitionRange) &&
      this.is_position_within_range(ref.range.end, definitionRange)
    );
    
    if (def.name === 'run_logging') {
      console.log(`Found ${definitionRefs.length} refs in run_logging, definitionRange:`, definitionRange);
      definitionRefs.forEach(r => {
        console.log(`  Ref: ${r.name}, kind: ${r.symbol_kind}, row: ${r.range.start.row}`);
      });
    }
    
    // First pass: identify constructor calls and track variable types
    for (const ref of definitionRefs) {
      // Check if this reference is part of a new expression
      const astNode = fileCache.tree.rootNode.descendantForPosition(
        { row: ref.range.start.row, column: ref.range.start.column },
        { row: ref.range.end.row, column: ref.range.end.column }
      );
      
      // Check for constructor calls - new Expression in JS/TS or just ClassName() in Python
      const isConstructorCall = astNode && astNode.parent && (
        astNode.parent.type === 'new_expression' ||  // JS/TS: new ClassName()
        (astNode.parent.type === 'call' && def.file_path.endsWith('.py')) ||  // Python: ClassName()
        (astNode.parent.type === 'scoped_identifier' && 
         astNode.parent.parent?.type === 'call_expression' &&
         ref.name === 'new' && def.file_path.endsWith('.rs'))  // Rust: Type::new()
      );
      
      if (isConstructorCall) {
        // This is a constructor call
        let constructorName = ref.name;
        
        
        // For Rust Type::new() pattern, the constructor is the Type part
        if (def.file_path.endsWith('.rs') && ref.name === 'new' && astNode?.parent?.type === 'scoped_identifier') {
          const typeName = astNode.parent.childForFieldName('path')?.text || astNode.parent.children[0]?.text;
          if (typeName) {
            constructorName = typeName;
          }
        }
        
        // First check if this is an imported class
        const importedClass = localTypeTracker.getImportedClass(constructorName);
        if (importedClass) {
          // This is an imported class - track the variable assignment
          let assignmentNode: any = astNode.parent;
          while (assignmentNode && assignmentNode.type !== 'variable_declarator' && 
                 assignmentNode.type !== 'assignment_expression' &&
                 assignmentNode.type !== 'assignment' &&
                 assignmentNode.type !== 'let_declaration') {  // Rust
            assignmentNode = assignmentNode.parent;
          }
          
          if (assignmentNode) {
            let varNameNode: any = null;
            if (assignmentNode.type === 'variable_declarator') {
              varNameNode = assignmentNode.childForFieldName('name');
            } else if (assignmentNode.type === 'assignment_expression') {
              varNameNode = assignmentNode.childForFieldName('left');
            } else if (assignmentNode.type === 'assignment') {
              // Python assignment: varName = ClassName()
              varNameNode = assignmentNode.children[0];
            } else if (assignmentNode.type === 'let_declaration') {
              // Rust let declaration: let mut varName = Type::new()
              varNameNode = assignmentNode.childForFieldName('pattern');
            }
            
            if (varNameNode && varNameNode.type === 'identifier') {
              const varName = varNameNode.text;
              localTypeTracker.setVariableType(varName, {
                className: importedClass.className,
                classDef: importedClass.classDef,
                position: assignmentNode.startPosition ? 
                  { row: assignmentNode.startPosition.row, column: assignmentNode.startPosition.column } : 
                  ref.range.start
              });
            }
          }
        } else {
          // Fall back to the original resolution logic
          const resolved = this.go_to_definition(def.file_path, ref.range.start);
          if (resolved) {
            let final_resolved = resolved;
            
            // Resolve imports
            if (resolved.symbol_kind === 'import') {
              const imports = this.get_imports_with_definitions(def.file_path);
              const import_info = imports.find(imp => 
                imp.import_statement.name === resolved.name &&
                imp.import_statement.range.start.row === resolved.range.start.row &&
                imp.import_statement.range.start.column === resolved.range.start.column
              );
              
              if (import_info && import_info.imported_function) {
                final_resolved = import_info.imported_function;
              }
            }
            
            // If it's a class or struct (Rust), track the variable assignment
            if (final_resolved.symbol_kind === 'class' || final_resolved.symbol_kind === 'struct') {
              // Look for the variable assignment pattern: const varName = new ClassName()
              let assignmentNode: any = astNode.parent;
              while (assignmentNode && assignmentNode.type !== 'variable_declarator' && 
                     assignmentNode.type !== 'assignment_expression' &&
                     assignmentNode.type !== 'assignment' &&
                     assignmentNode.type !== 'let_declaration') {  // Rust
                assignmentNode = assignmentNode.parent;
              }
              
              if (assignmentNode) {
                let varNameNode: any = null;
                if (assignmentNode.type === 'variable_declarator') {
                  varNameNode = assignmentNode.childForFieldName('name');
                } else if (assignmentNode.type === 'assignment_expression') {
                  varNameNode = assignmentNode.childForFieldName('left');
                } else if (assignmentNode.type === 'assignment') {
                  // Python assignment: varName = ClassName()
                  varNameNode = assignmentNode.children[0];
                } else if (assignmentNode.type === 'let_declaration') {
                  // Rust let declaration: let mut varName = Type::new()
                  varNameNode = assignmentNode.childForFieldName('pattern');
                }
                
                if (varNameNode && varNameNode.type === 'identifier') {
                  const varName = varNameNode.text;
                  // Store class def with computed enclosing range
                  const classDefWithRange = {
                    ...final_resolved,
                    // For class definitions, compute enclosing_range based on AST if not already set
                    enclosing_range: (final_resolved as any).enclosing_range || this.computeClassEnclosingRange(final_resolved, fileCache.tree)
                  };
                  localTypeTracker.setVariableType(varName, {
                    className: final_resolved.name,
                    classDef: classDefWithRange,
                    position: assignmentNode.startPosition ? 
                      { row: assignmentNode.startPosition.row, column: assignmentNode.startPosition.column } : 
                      ref.range.start
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Second pass: resolve all references including method calls
    for (const ref of definitionRefs) {
      let resolved = this.go_to_definition(def.file_path, ref.range.start);
      
      
      
      // If we can't resolve a method reference directly, check if it's a method call on a typed variable
      if (!resolved && ref.symbol_kind === 'method') {
        // This might be a method call like obj.method()
        // Find the object name by looking at the AST
        const astNode = fileCache.tree.rootNode.descendantForPosition(
          { row: ref.range.start.row, column: ref.range.start.column },
          { row: ref.range.end.row, column: ref.range.end.column }
        );
        
        if (def.name === 'run_logging') {
          console.log(`  Method ref ${ref.name} AST node: type=${astNode?.type}, parent=${astNode?.parent?.type}`);
          if (astNode?.parent) {
            console.log(`    Parent text: ${astNode.parent.text}`);
          }
        }
        
        // Handle both JavaScript/TypeScript (member_expression) and Python (attribute)
        const parentNode = astNode?.parent;
        
        // Debug logging
        if (def.file_path.endsWith('.py') && ref.symbol_kind === 'method') {
          console.log(`Python method ref: ${ref.name}, parent type: ${parentNode?.type}`);
          if (parentNode) {
            console.log(`Parent children:`, parentNode.children.map((c: any) => ({ type: c.type, text: c.text })));
          }
        }
        
        if (parentNode && (parentNode.type === 'member_expression' || parentNode.type === 'attribute' || 
                           parentNode.type === 'field_expression' || parentNode.type === 'scoped_identifier')) {
          
          // Handle Rust Type::method() pattern
          if (parentNode.type === 'scoped_identifier') {
            // For Logger::new, we need to resolve Logger to the type, then find new in that type
            const typeName = parentNode.childForFieldName('path')?.text || parentNode.children[0]?.text;
            if (typeName) {
              console.log(`  Rust Type::method pattern - type: ${typeName}, method: ${ref.name}`);
              
              // For cross-file resolution, always check imports
              console.log(`  Checking imports for ${typeName}`);
              try {
                  const imports = this.get_imports_with_definitions(def.file_path);
                  console.log(`  Looking for import ${typeName}, found ${imports.length} imports`);
                  imports.forEach(imp => {
                    console.log(`    Import: ${imp.import_statement.name}`);
                  });
                  const importInfo = imports.find(imp => imp.import_statement.name === typeName);
                
                if (importInfo && importInfo.imported_function) {
                  // We found the imported type
                  const importedType = importInfo.imported_function;
                  console.log(`  Found imported type: ${importedType.name} from ${importedType.file_path}`);
                  
                  // Now find the method in that file
                  const targetGraph = this.file_graphs.get(importedType.file_path);
                  if (targetGraph) {
                    const defs = targetGraph.getNodes<Def>('definition');
                    const method = defs.find(d => 
                      d.name === ref.name && 
                      (d.symbol_kind === 'method' || d.symbol_kind === 'function')
                    );
                    
                    if (method) {
                      resolved = method;
                      console.log(`  Resolved to method: ${method.symbol_id}`);
                    }
                  }
                }
                } catch (e) {
                  console.log(`  Error getting imports: ${e}`);
                }
            }
          } 
          // Handle instance.method() patterns (all languages)
          else {
            const objectNode = parentNode.childForFieldName('object') || 
                              parentNode.childForFieldName('value') ||  // Rust field_expression uses 'value'
                              (parentNode.type === 'attribute' ? parentNode.children[0] : null);
            if (objectNode && objectNode.type === 'identifier') {
              const objName = objectNode.text;
              const typeInfo = localTypeTracker.getVariableType(objName, ref.range.start);
              
              // Debug
              if (def.file_path.endsWith('.py') || def.file_path.endsWith('.rs')) {
                console.log(`Looking up type for: ${objName}, found:`, typeInfo);
              }
              
              if (typeInfo && typeInfo.classDef) {
              // We have type information for this variable
              // Now find the method in the class definition
              const methodName = ref.name;
              
              // Get all methods in the class file
              // We need to get the functions from the project, but we only have file-level access
              // Use the file graph to get all definitions in the class file
              const classGraph = this.file_graphs.get(typeInfo.classDef.file_path);
              const classDefs = classGraph ? classGraph.getNodes<Def>('definition') : [];
              
              // For class definitions, we need to use enclosing_range if available
              const classRange = (typeInfo.classDef as any).enclosing_range || typeInfo.classDef.range;
              
              const classMethods = classDefs;
              
              // Debug logging
              if (def.file_path.endsWith('.rs') && def.name === 'run_logging') {
                console.log(`  Looking for method ${methodName} in ${typeInfo.classDef.file_path}`);
                console.log(`  Class range:`, classRange);
                const methods = classMethods.filter((m: Def) => m.symbol_kind === 'method');
                console.log(`  Found ${methods.length} methods in file`);
                methods.forEach(m => {
                  console.log(`    Method: ${m.name}, range: ${m.range.start.row}-${m.range.end.row}`);
                });
              }
              
              // For Rust, methods are in impl blocks, not in the struct definition
              // So we need to look for methods with the same struct name
              let method = null;
              if (def.file_path.endsWith('.rs')) {
                // For Rust, just find the method by name and type
                method = classMethods.find((m: Def) => 
                  m.name === methodName && 
                  m.symbol_kind === 'method'
                );
              } else {
                // For other languages, ensure the method is within the class definition
                method = classMethods.find((m: Def) => 
                  m.name === methodName && 
                  m.symbol_kind === 'method' &&
                  this.is_position_within_range(m.range.start, classRange) &&
                  this.is_position_within_range(m.range.end, classRange)
                );
              }
              
              if (method) {
                resolved = method;
                if (def.file_path.endsWith('.rs') && def.name === 'run_logging') {
                  console.log(`  Resolved method ${methodName} to ${method.symbol_id}`);
                }
              }
            }
            }
          }
        }
      }
      
      if (resolved) {
        // If resolved to an import, try to resolve the import to its actual definition
        let final_resolved = resolved;
        if (resolved.symbol_kind === 'import') {
          // Get all imports with their resolved definitions
          const imports = this.get_imports_with_definitions(def.file_path);
          const import_info = imports.find(imp => 
            imp.import_statement.name === resolved.name &&
            imp.import_statement.range.start.row === resolved.range.start.row &&
            imp.import_statement.range.start.column === resolved.range.start.column
          );
          
          if (import_info && import_info.imported_function) {
            final_resolved = import_info.imported_function;
          }
        }
        
        // Check if this is a constructor call
        const astNode = fileCache.tree.rootNode.descendantForPosition(
          { row: ref.range.start.row, column: ref.range.start.column },
          { row: ref.range.end.row, column: ref.range.end.column }
        );
        const is_constructor_call = !!(astNode && astNode.parent && (
          astNode.parent.type === 'new_expression' ||  // JS/TS: new ClassName()
          (astNode.parent.type === 'call' && def.file_path.endsWith('.py') && final_resolved.symbol_kind === 'class')  // Python: ClassName()
        ));
        
        // Include all callable symbol kinds
        const callable_kinds = ['function', 'method', 'generator', 'class', 'constructor'];
        if (callable_kinds.includes(final_resolved.symbol_kind)) {
          // Check if this is a method call
          let is_method_call = ref.symbol_kind === 'method';
          
          // Additional check for method calls in different languages
          if (!is_method_call) {
            const file_cache = this.file_cache.get(def.file_path);
            if (file_cache) {
              const lines = file_cache.source_code.split('\n');
              const refLine = lines[ref.range.start.row];
              const beforeRef = refLine.substring(0, ref.range.start.column);
              
              // Check for method call patterns
              if (def.file_path.endsWith('.py') && beforeRef.endsWith('.')) {
                is_method_call = true;
              } else if ((def.file_path.endsWith('.ts') || def.file_path.endsWith('.js')) && 
                         (beforeRef.endsWith('.') || beforeRef.endsWith('?.'))) {
                is_method_call = true;
              } else if (def.file_path.endsWith('.rs') && 
                         (beforeRef.endsWith('.') || beforeRef.endsWith('::'))) {
                is_method_call = true;
              }
            }
          }
          
          calls.push({
            caller_def: def,
            called_def: final_resolved,
            call_location: ref.range.start,
            is_method_call,
            is_constructor_call
          });
        }
      }
    }
    
    return calls;
  }

  /**
   * Get all function call relationships in the project.
   * 
   * @returns Object containing all functions and their call relationships
   */
  extract_call_graph(): {
    functions: Def[];
    calls: FunctionCall[];
  } {
    const allFunctions: Def[] = [];
    const allCalls: FunctionCall[] = [];
    
    // Get all functions in the project
    const functionsByFile = this.get_all_functions();
    
    // Collect all functions and their calls
    for (const [file_path, functions] of Array.from(functionsByFile)) {
      allFunctions.push(...functions);
      
      // Get calls from within functions
      for (const func of functions) {
        const calls = this.get_function_calls(func);
        allCalls.push(...calls);
      }
      
      // Get module-level calls
      const moduleCalls = this.get_module_level_calls(file_path);
      allCalls.push(...moduleCalls);
    }
    
    return {
      functions: allFunctions,
      calls: allCalls
    };
  }

  /**
   * Build a complete call graph for the project.
   * 
   * This high-level API constructs a full call graph with nodes representing
   * functions/methods and edges representing call relationships. It handles
   * cross-file imports and provides various filtering options.
   * 
   * @param options - Options to control call graph generation
   * @returns Complete call graph with nodes, edges, and top-level functions
   */
  get_call_graph(options?: CallGraphOptions): CallGraph {
    const nodes = new Map<string, CallGraphNode>();
    const edges: CallGraphEdge[] = [];
    const called_symbols = new Set<string>();
    
    // Default options
    const opts: CallGraphOptions = {
      include_external: options?.include_external ?? false,
      max_depth: options?.max_depth ?? undefined,
      file_filter: options?.file_filter ?? undefined
    };
    
    // First, detect exports for all files
    for (const file_path of this.file_graphs.keys()) {
      this.detectFileExports(file_path);
    }
    
    // Get all functions based on file filter
    // Include private functions for now, we'll filter them later if they're not called
    const functions_by_file = this.get_all_functions({
      include_private: true
    });
    
    // First pass: Create nodes for all functions
    for (const [file_path, functions] of Array.from(functions_by_file)) {
      // Apply file filter if specified
      if (opts.file_filter && !opts.file_filter(file_path)) {
        continue;
      }
      
      for (const func of functions) {
        const symbol = func.symbol_id
        
        // Check if function is exported
        // Use the export status from the function definition
        const is_exported = func.is_exported || this.isDefinitionExported(file_path, func.name);
        
        // Initialize node with empty calls and called_by arrays
        nodes.set(symbol, {
          symbol,
          definition: func,
          calls: [],
          called_by: [],
          is_exported
        });
      }
    }
    
    // Second pass: Build edges and populate calls
    for (const [file_path, functions] of Array.from(functions_by_file)) {
      // Apply file filter if specified
      if (opts.file_filter && !opts.file_filter(file_path)) {
        continue;
      }
      
      if (file_path === 'main.rs') {
        console.log(`Processing ${functions.length} functions from ${file_path}`);
        functions.forEach(f => console.log(`  - ${f.name} (${f.symbol_kind})`));
      }
      
      for (const func of functions) {
        const caller_symbol = func.symbol_id;
        const caller_node = nodes.get(caller_symbol);
        
        if (!caller_node) continue;
        
        // Get all calls from this function
        const function_calls = this.get_calls_from_definition(func);
        
        if (func.name === 'run_logging') {
          console.log(`extract_call_graph: Processing ${func.name}, found ${function_calls.length} calls`);
          function_calls.forEach((fc, i) => {
            console.log(`  Call ${i}: ${fc.called_def.symbol_id}`);
          });
        }
        
        for (const call of function_calls) {
          if (!call.called_def) continue;
          
          const callee_symbol = call.called_def.symbol_id;
          
          // Apply file filter if specified
          if (opts.file_filter && !opts.file_filter(call.called_def.file_path)) {
            continue;
          }
          
          // Skip external calls if not included
          if (!opts.include_external && !nodes.has(callee_symbol)) {
            continue;
          }
          
          // Create Call object
          const call_obj: Call = {
            symbol: callee_symbol,
            range: {
              start: call.call_location,
              end: call.call_location
            },
            kind: call.is_method_call ? 'method' : 'function',
            resolved_definition: call.called_def
          };
          
          // Add to caller's calls
          caller_node.calls.push(call_obj);
          
          // Determine call type
          let call_type: 'direct' | 'method' | 'constructor' = 'direct';
          if (call.is_constructor_call) {
            call_type = 'constructor';
          } else if (call.is_method_call) {
            call_type = 'method';
          }
          
          // Create edge
          edges.push({
            from: caller_symbol,
            to: callee_symbol,
            location: {
              start: call.call_location,
              end: call.call_location
            },
            call_type
          });
          
          // Track that this symbol is called
          called_symbols.add(callee_symbol);
          
          // Update callee's called_by if it's in our nodes
          const callee_node = nodes.get(callee_symbol);
          if (callee_node && !callee_node.called_by.includes(caller_symbol)) {
            callee_node.called_by.push(caller_symbol);
          }
        }
      }
      
      // Process module-level calls
      const module_calls = this.get_module_level_calls(file_path);
      for (const call of module_calls) {
        if (!call.called_def) continue;
        
        const callee_symbol = call.called_def.symbol_id;
        
        // Apply file filter if specified
        if (opts.file_filter && !opts.file_filter(call.called_def.file_path)) {
          continue;
        }
        
        // Skip external calls if not included
        if (!opts.include_external && !nodes.has(callee_symbol)) {
          continue;
        }
        
        // Determine call type
        let call_type: 'direct' | 'method' | 'constructor' = 'direct';
        if (call.is_constructor_call) {
          call_type = 'constructor';
        } else if (call.is_method_call) {
          call_type = 'method';
        }
        
        // Create edge from module to called function
        const edge = {
          from: `${file_path}#<module>`,
          to: callee_symbol,
          location: {
            start: call.call_location,
            end: call.call_location
          },
          call_type
        };
        edges.push(edge);
        
        // Track that this symbol is called
        called_symbols.add(callee_symbol);
        
        // Update callee's called_by if it's in our nodes
        const callee_node = nodes.get(callee_symbol);
        if (callee_node && !callee_node.called_by.includes(`${file_path}#<module>`)) {
          callee_node.called_by.push(`${file_path}#<module>`);
        }
      }
    }
    
    // Apply max_depth if specified
    let final_nodes = nodes;
    if (opts.max_depth !== undefined) {
      final_nodes = this.apply_max_depth_filter(nodes, edges, opts.max_depth);
    }
    
    // Filter out private uncalled functions
    // For Rust: Only exclude private methods that are both uncalled and make no calls
    // For other languages: Include all methods and functions (they might be entry points)
    const filtered_nodes = new Map<string, CallGraphNode>();
    for (const [symbol, node] of Array.from(final_nodes)) {
      const def = node.definition;
      
      // Special handling for Rust
      if (def.file_path.endsWith('.rs')) {
        // For Rust, exclude private methods that are isolated (not called and make no calls)
        // Check if this is a method by looking at the symbol pattern (contains Class.method)
        const is_method = symbol.includes('.') && !symbol.includes('#<module>');
        const is_private = !def.is_exported;
        const is_uncalled = !called_symbols.has(symbol);
        const makes_no_calls = node.calls.length === 0;
        
        // Exclude if it's a private method that's both uncalled and makes no calls
        if (is_method && is_private && is_uncalled && makes_no_calls) {
          continue;
        }
      }
      
      // Include all other nodes
      filtered_nodes.set(symbol, node);
    }
    final_nodes = filtered_nodes;
    
    // Identify top-level nodes (not called by any other node in the graph)
    const top_level_nodes: string[] = [];
    for (const [symbol,] of Array.from(final_nodes)) {
      if (!called_symbols.has(symbol)) {
        top_level_nodes.push(symbol);
      }
    }
    
    return {
      nodes: final_nodes,
      edges: edges.filter(edge => 
        (edge.from.includes("#<module>") || final_nodes.has(edge.from)) && final_nodes.has(edge.to)
      ),
      top_level_nodes
    };
  }

  /**
   * Apply max depth filtering to the call graph.
   * Returns a new set of nodes that are within max_depth from top-level nodes.
   */
  private apply_max_depth_filter(
    nodes: Map<string, CallGraphNode>,
    edges: CallGraphEdge[],
    max_depth: number
  ): Map<string, CallGraphNode> {
    const filtered_nodes = new Map<string, CallGraphNode>();
    const visited = new Set<string>();
    
    // Find top-level nodes
    const called_symbols = new Set(edges.map(e => e.to));
    const top_level_symbols = Array.from(nodes.keys()).filter(s => !called_symbols.has(s));
    
    // BFS from each top-level node
    const queue: Array<{ symbol: string; depth: number }> = 
      top_level_symbols.map(s => ({ symbol: s, depth: 0 }));
    
    while (queue.length > 0) {
      const { symbol, depth } = queue.shift()!;
      
      if (visited.has(symbol) || depth > max_depth) continue;
      visited.add(symbol);
      
      const node = nodes.get(symbol);
      if (!node) continue;
      
      filtered_nodes.set(symbol, node);
      
      // Add called functions to queue
      for (const call of node.calls) {
        if (!visited.has(call.symbol)) {
          queue.push({ symbol: call.symbol, depth: depth + 1 });
        }
      }
    }
    
    return filtered_nodes;
  }

  /**
   * Check if a position is within a range.
   */
  private is_position_within_range(pos: Point, range: { start: Point; end: Point }): boolean {
    // Check if position is after or at start
    if (pos.row < range.start.row) return false;
    if (pos.row === range.start.row && pos.column < range.start.column) return false;
    
    // Check if position is before or at end
    if (pos.row > range.end.row) return false;
    if (pos.row === range.end.row && pos.column > range.end.column) return false;
    
    return true;
  }

  /**
   * Compute the enclosing range for a class definition by finding its full AST node
   */
  private computeClassEnclosingRange(classDef: Def, tree: Tree): SimpleRange | undefined {
    if (classDef.symbol_kind !== 'class') return undefined;
    
    // Find the AST node for this class definition
    const classNode = tree.rootNode.descendantForPosition(
      { row: classDef.range.start.row, column: classDef.range.start.column },
      { row: classDef.range.end.row, column: classDef.range.end.column }
    );
    
    if (classNode) {
      // Walk up to find the class declaration node
      let current = classNode.parent;
      while (current) {
        if (current.type === 'class_declaration' ||  // JS/TS
            current.type === 'class_definition' ||   // Python
            current.type === 'struct_item' ||         // Rust
            current.type === 'impl_item') {           // Rust
          return {
            start: { row: current.startPosition.row, column: current.startPosition.column },
            end: { row: current.endPosition.row, column: current.endPosition.column }
          };
        }
        current = current.parent;
      }
    }
    
    return undefined;
  }

  // Helper methods that need to be delegated from Project class
  private go_to_definition(_file_path: string, _position: Point): Def | null {
    // This will be handled by delegation from the Project class
    throw new Error('go_to_definition should be called through Project class delegation');
  }

  private get_imports_with_definitions(_file_path: string): ImportInfo[] {
    // This will be handled by delegation from the Project class
    throw new Error('get_imports_with_definitions should be called through Project class delegation');
  }

  private get_all_functions(_options?: {
    include_private?: boolean;
    include_tests?: boolean;
    symbol_kinds?: string[];
  }): Map<string, Def[]> {
    // This will be handled by delegation from the Project class
    throw new Error('get_all_functions should be called through Project class delegation');
  }

  private get_function_calls(def: Def): FunctionCall[] {
    if (!['function', 'method', 'generator'].includes(def.symbol_kind)) {
      return [];
    }
    
    // Use get_calls_from_definition and filter to only function/method/generator calls
    return this.get_calls_from_definition(def).filter(call => 
      ['function', 'method', 'generator'].includes(call.called_def.symbol_kind)
    );
  }

  // Methods to set the delegation functions from Project class
  set_go_to_definition_delegate(delegate: (file_path: string, position: Point) => Def | null) {
    this.go_to_definition = delegate;
  }

  set_get_imports_with_definitions_delegate(delegate: (file_path: string) => ImportInfo[]) {
    this.get_imports_with_definitions = delegate;
  }

  set_get_all_functions_delegate(delegate: (options?: {
    include_private?: boolean;
    include_tests?: boolean;
    symbol_kinds?: string[];
  }) => Map<string, Def[]>) {
    this.get_all_functions = delegate;
  }
}