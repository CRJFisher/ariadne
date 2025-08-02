import { Point, Def, Ref, FunctionCall, ImportInfo, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, SimpleRange } from './graph';
import { ScopeGraph } from './graph'; // Internal use only
import { LanguageConfig } from './types';
import { Tree } from 'tree-sitter';

/**
 * Tracks variable type information at the file level
 */
class FileTypeTracker {
  private variableTypes = new Map<string, { className: string; classDef?: Def & { enclosing_range?: SimpleRange } }>();
  private importedClasses = new Map<string, { className: string; classDef: Def & { enclosing_range?: SimpleRange }; sourceFile: string }>();
  
  /**
   * Set the type of a variable
   */
  setVariableType(varName: string, typeInfo: { className: string; classDef?: Def & { enclosing_range?: SimpleRange } }) {
    this.variableTypes.set(varName, typeInfo);
  }
  
  /**
   * Get the type of a variable
   */
  getVariableType(varName: string) {
    return this.variableTypes.get(varName);
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
   * Clear all type information for this file
   */
  clear() {
    this.variableTypes.clear();
    this.importedClasses.clear();
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
  private localTypes = new Map<string, { className: string; classDef?: Def & { enclosing_range?: SimpleRange } }>();
  
  constructor(private parent: FileTypeTracker) {}
  
  setVariableType(varName: string, typeInfo: { className: string; classDef?: Def & { enclosing_range?: SimpleRange } }) {
    this.localTypes.set(varName, typeInfo);
  }
  
  getVariableType(varName: string) {
    // First check local types, then parent
    return this.localTypes.get(varName) || this.parent.getVariableType(varName);
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
 * Handles call graph related operations for the Project class.
 * This class extracts call graph functionality to reduce the size of the Project class.
 */
export class ProjectCallGraph {
  private file_graphs: Map<string, ScopeGraph>;
  private file_cache: Map<string, FileCache>;
  private languages: Map<string, LanguageConfig>;
  private file_type_trackers: Map<string, FileTypeTracker>;

  constructor(
    file_graphs: Map<string, ScopeGraph>,
    file_cache: Map<string, FileCache>,
    languages: Map<string, LanguageConfig>
  ) {
    this.file_graphs = file_graphs;
    this.file_cache = file_cache;
    this.languages = languages;
    this.file_type_trackers = new Map();
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
  }
  
  /**
   * Initialize import information for a file
   */
  private initializeFileImports(file_path: string) {
    const tracker = this.getFileTypeTracker(file_path);
    const imports = this.get_imports_with_definitions(file_path);
    
    // Track all imported classes
    for (const importInfo of imports) {
      if (importInfo.imported_function.symbol_kind === 'class') {
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
              classDef: classDefWithRange
            });
            localTypeTracker.setVariableType('cls', {
              className: classDef.name,
              classDef: classDefWithRange
            });
          } else if (methodDef.file_path.match(/\.(js|jsx|ts|tsx)$/)) {
            // JavaScript/TypeScript: track 'this'
            localTypeTracker.setVariableType('this', {
              className: classDef.name,
              classDef: classDefWithRange
            });
          } else if (methodDef.file_path.endsWith('.rs')) {
            // Rust: track 'self' (various forms)
            localTypeTracker.setVariableType('self', {
              className: classDef.name,
              classDef: classDefWithRange
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
    console.log(`get_calls_from_definition called for: ${def.name}, kind: ${def.symbol_kind}`);
    
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
    
    // First pass: identify constructor calls and track variable types
    for (const ref of definitionRefs) {
      // Check if this reference is part of a new expression
      const astNode = fileCache.tree.rootNode.descendantForPosition(
        { row: ref.range.start.row, column: ref.range.start.column },
        { row: ref.range.end.row, column: ref.range.end.column }
      );
      
      if (astNode && astNode.parent && astNode.parent.type === 'new_expression') {
        // This is a constructor call
        const constructorName = ref.name;
        
        // First check if this is an imported class
        const importedClass = localTypeTracker.getImportedClass(constructorName);
        if (importedClass) {
          // This is an imported class - track the variable assignment
          let assignmentNode: any = astNode.parent;
          while (assignmentNode && assignmentNode.type !== 'variable_declarator' && 
                 assignmentNode.type !== 'assignment_expression') {
            assignmentNode = assignmentNode.parent;
          }
          
          if (assignmentNode) {
            let varNameNode: any = null;
            if (assignmentNode.type === 'variable_declarator') {
              varNameNode = assignmentNode.childForFieldName('name');
            } else if (assignmentNode.type === 'assignment_expression') {
              varNameNode = assignmentNode.childForFieldName('left');
            }
            
            if (varNameNode && varNameNode.type === 'identifier') {
              const varName = varNameNode.text;
              localTypeTracker.setVariableType(varName, {
                className: importedClass.className,
                classDef: importedClass.classDef
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
            
            // If it's a class, track the variable assignment
            if (final_resolved.symbol_kind === 'class') {
              // Look for the variable assignment pattern: const varName = new ClassName()
              let assignmentNode: any = astNode.parent;
              while (assignmentNode && assignmentNode.type !== 'variable_declarator' && 
                     assignmentNode.type !== 'assignment_expression') {
                assignmentNode = assignmentNode.parent;
              }
              
              if (assignmentNode) {
                let varNameNode: any = null;
                if (assignmentNode.type === 'variable_declarator') {
                  varNameNode = assignmentNode.childForFieldName('name');
                } else if (assignmentNode.type === 'assignment_expression') {
                  varNameNode = assignmentNode.childForFieldName('left');
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
                    classDef: classDefWithRange
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
        
        // Handle both JavaScript/TypeScript (member_expression) and Python (attribute)
        const parentNode = astNode?.parent;
        
        // Debug logging
        if (def.file_path.endsWith('.py') && ref.symbol_kind === 'method') {
          console.log(`Python method ref: ${ref.name}, parent type: ${parentNode?.type}`);
          if (parentNode) {
            console.log(`Parent children:`, parentNode.children.map((c: any) => ({ type: c.type, text: c.text })));
          }
        }
        
        if (parentNode && (parentNode.type === 'member_expression' || parentNode.type === 'attribute')) {
          const objectNode = parentNode.childForFieldName('object') || 
                            (parentNode.type === 'attribute' ? parentNode.children[0] : null);
          if (objectNode && objectNode.type === 'identifier') {
            const objName = objectNode.text;
            const typeInfo = localTypeTracker.getVariableType(objName);
            
            // Debug
            if (def.file_path.endsWith('.py')) {
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
              const method = classMethods.find((m: Def) => 
                m.name === methodName && 
                m.symbol_kind === 'method' &&
                // Ensure the method is within the class definition
                this.is_position_within_range(m.range.start, classRange) &&
                this.is_position_within_range(m.range.end, classRange)
              );
              
              if (method) {
                resolved = method;
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
        const is_constructor_call = !!(astNode && astNode.parent && astNode.parent.type === 'new_expression');
        
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
    
    // Get all functions based on file filter
    const functions_by_file = this.get_all_functions();
    
    // First pass: Create nodes for all functions
    for (const [file_path, functions] of Array.from(functions_by_file)) {
      // Apply file filter if specified
      if (opts.file_filter && !opts.file_filter(file_path)) {
        continue;
      }
      
      for (const func of functions) {
        const symbol = func.symbol_id
        
        // Check if function is exported
        // For now, we'll consider a function exported if it's in the root scope
        // and the file contains TypeScript/JavaScript (where we can check for export keyword)
        // This is a simplification - proper export tracking would require AST analysis
        const is_exported = false;
        
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
      
      for (const func of functions) {
        const caller_symbol = func.symbol_id;
        const caller_node = nodes.get(caller_symbol);
        
        if (!caller_node) continue;
        
        // Get all calls from this function
        const function_calls = this.get_calls_from_definition(func);
        
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