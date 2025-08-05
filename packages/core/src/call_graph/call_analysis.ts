import { Def, Ref, ScopeGraph, Import, FunctionCall } from '../graph';
import { Tree } from 'tree-sitter';

// FileCache interface
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph;
}
import { 
  FileTypeTrackerData, 
  LocalTypeTrackerData,
  TypeInfo,
  get_local_variable_type,
  get_local_imported_class,
  get_imported_class,
  set_local_variable_type
} from './type_tracker';

// Re-export types we need
export type { FunctionCall } from '../graph';

/**
 * Result of analyzing calls from a definition
 */
export interface CallAnalysisResult {
  readonly calls: readonly FunctionCall[];
  readonly typeDiscoveries: readonly TypeDiscovery[];
}

/**
 * A discovered type assignment during call analysis
 */
export interface TypeDiscovery {
  readonly variableName: string;
  readonly typeInfo: TypeInfo;
  readonly scope: 'local' | 'file';
}

/**
 * Result of resolving a method call
 */
export interface MethodResolutionResult {
  readonly resolved?: Def;
  readonly typeDiscoveries: readonly TypeDiscovery[];
}

/**
 * Configuration for call analysis
 */
export interface CallAnalysisConfig {
  readonly file_path: string;
  readonly graph: ScopeGraph;
  readonly fileCache: FileCache;
  readonly fileTypeTracker: FileTypeTrackerData;
  readonly localTypeTracker: LocalTypeTrackerData;
  readonly go_to_definition: (file_path: string, position: { row: number; column: number }) => Def | undefined;
  readonly get_imports_with_definitions: (file_path: string) => Array<{
    import_statement: Import;
    local_name: string;
    imported_function: Def;
  }>;
  readonly get_file_graph?: (file_path: string) => ScopeGraph | undefined;
  readonly get_file_cache?: (file_path: string) => FileCache | undefined;
}

/**
 * Analyze calls from a definition using immutable state
 */
export function analyze_calls_from_definition(
  def: Def,
  config: CallAnalysisConfig
): CallAnalysisResult {
  const calls: FunctionCall[] = [];
  const typeDiscoveries: TypeDiscovery[] = [];
  
  const { graph, fileCache, localTypeTracker } = config;
  
  // Find the full definition body range
  const definitionRange = find_definition_range(def, fileCache);
  
  // Get all references in this file
  const refs = graph.getNodes<Ref>('reference');
  
  // Filter to only refs within this definition's range
  const definitionRefs = refs.filter(ref => 
    is_position_within_range(ref.range.start, definitionRange) &&
    is_position_within_range(ref.range.end, definitionRange)
  );
  
  
  // First pass: identify constructor calls and collect type discoveries
  for (const ref of definitionRefs) {
    const constructorAnalysis = analyze_constructor_call(ref, def, config);
    if (constructorAnalysis && constructorAnalysis.typeDiscoveries.length > 0) {
      typeDiscoveries.push(...constructorAnalysis.typeDiscoveries);
    }
  }
  
  // Second pass: resolve all references including method calls
  // Create an updated local type tracker with discovered types
  let currentLocalTracker = localTypeTracker;
  
  // Apply discovered types to the local tracker
  for (const discovery of typeDiscoveries) {
    if (discovery.scope === 'local') {
      currentLocalTracker = set_local_variable_type(
        currentLocalTracker,
        discovery.variableName,
        discovery.typeInfo
      );
    }
  }
  
  for (const ref of definitionRefs) {
    if (process.env.DEBUG_METHOD_CHAINS && ref.symbol_kind === 'method') {
      console.log(`\nAnalyzing reference: ${ref.name} (${ref.symbol_kind}) at ${ref.range.start.row}:${ref.range.start.column}`);
    }
    
    const resolved = resolve_reference(ref, def, config, currentLocalTracker);
    
    // Check if this reference is part of a call expression
    const isCallExpression = is_reference_called(ref, fileCache);
    
    if (resolved.resolved) {
      // Check if this is a callable symbol
      const callable_kinds = ['function', 'method', 'generator', 'class', 'constructor', 'struct'];
      if (callable_kinds.includes(resolved.resolved.symbol_kind)) {
        // Determine if this is a method call
        const is_method_call = ref.symbol_kind === 'method' || 
          is_method_call_pattern(ref, def.file_path, fileCache);
        
        const call: FunctionCall = {
          caller_def: def,
          called_def: resolved.resolved,
          call_location: ref.range.start,
          is_method_call,
          is_constructor_call: ref.symbol_kind === 'constructor'
        };
        calls.push(call);
      }
    } else if (isCallExpression) {
      // This is an unresolved call (likely a built-in)
      // Debug for generateLargeFile
      if (def.name === 'generateLargeFile' && (ref.name === 'push' || ref.name === 'join')) {
        console.log(`  Found built-in call: ${ref.name} at row ${ref.range.start.row}`);
      }
      // Create a synthetic definition for tracking
      const syntheticDef: Def = {
        id: -1, // Special ID for built-ins
        kind: 'definition',
        name: ref.name,
        symbol_id: `<builtin>#${ref.name}`,
        symbol_kind: ref.symbol_kind === 'method' ? 'method' : 'function',
        range: ref.range,
        file_path: '<builtin>'
      };
      
      const call: FunctionCall = {
        caller_def: def,
        called_def: syntheticDef,
        call_location: ref.range.start,
        is_method_call: ref.symbol_kind === 'method',
        is_constructor_call: false
      };
      calls.push(call);
    }
    
    // Collect any type discoveries from method resolution
    typeDiscoveries.push(...resolved.typeDiscoveries);
  }
  
  return {
    calls,
    typeDiscoveries
  };
}

/**
 * Analyze module-level calls (calls made outside any function/class)
 */
export function analyze_module_level_calls(
  file_path: string,
  config: CallAnalysisConfig
): CallAnalysisResult {
  const { graph, fileCache } = config;
  const calls: FunctionCall[] = [];
  const typeDiscoveries: TypeDiscovery[] = [];
  
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
      if (is_position_within_range(ref.range.start, defRange) &&
          is_position_within_range(ref.range.end, defRange)) {
        return false; // This ref is inside a definition
      }
    }
    return true; // This ref is at module level
  });
  
  // Create a pseudo-definition for the module
  const moduleDef: Def = {
    id: -1, // Special ID for module
    kind: 'definition',
    name: '<module>',
    symbol_id: `${file_path}#<module>`,
    symbol_kind: 'module' as any,
    range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } },
    file_path: file_path
  };
  
  // For each module-level reference, try to resolve it
  for (const ref of moduleLevelRefs) {
    const resolved = config.go_to_definition(file_path, ref.range.start);
    
    // Check if this reference is part of a call expression
    const isCallExpression = is_reference_called(ref, fileCache);
    
    if (resolved) {
      // If resolved to an import, try to resolve the import
      let final_resolved = resolved;
      if (resolved.symbol_kind === 'import') {
        const imports = config.get_imports_with_definitions(file_path);
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
        const is_method_call = ref.symbol_kind === 'method' || 
          is_method_call_pattern(ref, file_path, fileCache);
        
        const call: FunctionCall = {
          caller_def: moduleDef,
          called_def: final_resolved,
          call_location: ref.range.start,
          is_method_call,
          is_constructor_call: ref.symbol_kind === 'constructor' || final_resolved.symbol_kind === 'constructor'
        };
        calls.push(call);
      }
    } else if (isCallExpression) {
      // This is an unresolved call (likely a built-in)
      // Create a synthetic definition for tracking
      const syntheticDef: Def = {
        id: -1, // Special ID for built-ins
        kind: 'definition',
        name: ref.name,
        symbol_id: `<builtin>#${ref.name}`,
        symbol_kind: ref.symbol_kind === 'method' ? 'method' : 'function',
        range: ref.range,
        file_path: '<builtin>'
      };
      
      const call: FunctionCall = {
        caller_def: moduleDef,
        called_def: syntheticDef,
        call_location: ref.range.start,
        is_method_call: ref.symbol_kind === 'method',
        is_constructor_call: false
      };
      calls.push(call);
    }
  }
  
  return {
    calls,
    typeDiscoveries
  };
}

/**
 * Resolve a method call without mutations
 */
export function resolve_method_call_pure(
  ref: Ref,
  objectName: string,
  config: CallAnalysisConfig,
  localTypeTracker: LocalTypeTrackerData
): MethodResolutionResult {
  const typeDiscoveries: TypeDiscovery[] = [];
  
  // Get type information for the object
  const typeInfo = get_local_variable_type(localTypeTracker, objectName, ref.range.start);
  
  
  if (typeInfo && typeInfo.classDef) {
    // We have type information for this variable
    const methodName = ref.name;
    
    // Get all methods in the class file
    if (config.get_file_graph && typeInfo.classDef.file_path) {
      const classGraph = config.get_file_graph(typeInfo.classDef.file_path);
      const classDefs = classGraph ? classGraph.getNodes<Def>('definition') : [];
      
      // Compute enclosing_range if not available
      let classRange = typeInfo.classDef.enclosing_range;
      if (!classRange && config.get_file_cache) {
        const classFileCache = config.get_file_cache(typeInfo.classDef.file_path);
        if (classFileCache) {
          classRange = compute_class_enclosing_range(typeInfo.classDef, classFileCache.tree);
        }
      }
      // Fall back to range if still not available
      classRange = classRange || typeInfo.classDef.range;
      
      // Find method by checking if it's within the class range
      // This is more reliable than symbol_id matching
      const method = classDefs.find((m: Def) => 
        m.name === methodName && 
        (m.symbol_kind === 'method' || m.symbol_kind === 'function') &&
        is_position_within_range(m.range.start, classRange) &&
        is_position_within_range(m.range.end, classRange)
      );
      
      
      if (method) {
        return { resolved: method, typeDiscoveries };
      }
    }
  }
  
  return { typeDiscoveries };
}

// Helper functions

/**
 * Find the full definition range including body
 */
function find_definition_range(def: Def, fileCache: FileCache): { 
  start: { row: number; column: number }; 
  end: { row: number; column: number } 
} {
  // If the definition already has an enclosing_range, use it
  if ((def as any).enclosing_range) {
    return (def as any).enclosing_range;
  }
  
  let definitionRange = def.range;
  
  // Find the AST node for this definition
  const defNode = fileCache.tree.rootNode.descendantForPosition(
    { row: def.range.start.row, column: def.range.start.column },
    { row: def.range.end.row, column: def.range.end.column }
  );
  
  if (defNode) {
    // Walk up the tree to find the full definition node
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
      // Check for variable/const nodes
      else if (['variable', 'const', 'let', 'constant'].includes(def.symbol_kind)) {
        if (nodeType === 'variable_declarator' ||
            nodeType === 'variable_declaration' ||
            nodeType === 'lexical_declaration' ||
            nodeType === 'assignment' || // Python
            nodeType === 'let_declaration' || // Rust
            nodeType === 'const_item') { // Rust
          foundDefinitionNode = true;
        }
      }
      
      if (foundDefinitionNode) {
        definitionRange = {
          start: { row: current.startPosition.row, column: current.startPosition.column },
          end: { row: current.endPosition.row, column: current.endPosition.column }
        };
        break;
      }
      current = current.parent;
    }
  }
  
  return definitionRange;
}

/**
 * Check if a position is within a range
 */
function is_position_within_range(
  pos: { row: number; column: number },
  range: { start: { row: number; column: number }; end: { row: number; column: number } }
): boolean {
  if (pos.row < range.start.row || pos.row > range.end.row) {
    return false;
  }
  if (pos.row === range.start.row && pos.column < range.start.column) {
    return false;
  }
  if (pos.row === range.end.row && pos.column > range.end.column) {
    return false;
  }
  return true;
}

/**
 * Check if a reference is a method call pattern
 */
function is_method_call_pattern(ref: Ref, file_path: string, fileCache: FileCache): boolean {
  const lines = fileCache.source_code.split('\n');
  const refLine = lines[ref.range.start.row];
  if (!refLine) return false;
  
  const beforeRef = refLine.substring(0, ref.range.start.column);
  
  // Check for method call patterns in different languages
  if (file_path.endsWith('.py') && beforeRef.endsWith('.')) {
    return true;
  } else if ((file_path.endsWith('.ts') || file_path.endsWith('.js')) && 
             (beforeRef.endsWith('.') || beforeRef.endsWith('?.'))) {
    return true;
  } else if (file_path.endsWith('.rs') && 
             (beforeRef.endsWith('.') || beforeRef.endsWith('::'))) {
    return true;
  }
  
  return false;
}

/**
 * Check if a reference is part of a call expression
 */
function is_reference_called(ref: Ref, fileCache: FileCache): boolean {
  // Get the AST node for this reference
  const astNode = fileCache.tree.rootNode.descendantForPosition(
    { row: ref.range.start.row, column: ref.range.start.column },
    { row: ref.range.end.row, column: ref.range.end.column }
  );
  
  if (!astNode) return false;
  
  // Check if this node's parent is a call expression
  const parent = astNode.parent;
  if (!parent) return false;
  
  // Direct function call: func()
  if (parent.type === 'call_expression' && parent.childForFieldName('function') === astNode) {
    return true;
  }
  
  // Method call: obj.method() - the reference is the property of a member_expression
  if (parent.type === 'member_expression' && parent.childForFieldName('property') === astNode) {
    // Check if the member_expression is the function of a call_expression
    const grandparent = parent.parent;
    if (grandparent && grandparent.type === 'call_expression' && 
        grandparent.childForFieldName('function') === parent) {
      return true;
    }
  }
  
  // Handle nested identifiers in some languages
  if (parent.type === 'nested_identifier' || parent.type === 'scoped_identifier') {
    const grandparent = parent.parent;
    if (grandparent && grandparent.type === 'call_expression' && 
        grandparent.childForFieldName('function') === parent) {
      return true;
    }
  }
  
  return false;
}

/**
 * Analyze a potential constructor call
 */
function analyze_constructor_call(
  ref: Ref,
  def: Def,
  config: CallAnalysisConfig
): { typeDiscoveries: readonly TypeDiscovery[] } | null {
  const { fileCache, localTypeTracker } = config;
  const typeDiscoveries: TypeDiscovery[] = [];
  
  // Get AST node for the reference
  const astNode = fileCache.tree.rootNode.descendantForPosition(
    { row: ref.range.start.row, column: ref.range.start.column },
    { row: ref.range.end.row, column: ref.range.end.column }
  );
  
  
  // Check for constructor calls
  const isConstructorCall = astNode && astNode.parent && (
    astNode.parent.type === 'new_expression' ||  // JS/TS: new ClassName()
    (astNode.parent.type === 'call' && def.file_path.endsWith('.py')) ||  // Python: ClassName()
    (astNode.parent.type === 'scoped_identifier' && 
     astNode.parent.parent?.type === 'call_expression' &&
     ref.name === 'new' && def.file_path.endsWith('.rs'))  // Rust: Type::new()
  );
  
  
  if (!isConstructorCall) {
    return null;
  }
  
  let constructorName = ref.name;
  
  // For Rust Type::new() pattern, get the type name
  let rustTypeNode: any = null;
  if (def.file_path.endsWith('.rs') && ref.name === 'new' && astNode?.parent?.type === 'scoped_identifier') {
    const typeName = astNode.parent.childForFieldName('path')?.text || astNode.parent.children[0]?.text;
    if (typeName) {
      constructorName = typeName;
      // Also store the node for the type name for later resolution
      rustTypeNode = astNode.parent.childForFieldName('path') || astNode.parent.children[0];
    }
  }
  
  // Check if this is an imported class
  const importedClass = get_local_imported_class(localTypeTracker, constructorName);
  
  // Also check the file type tracker directly
  const fileImportedClass = importedClass || get_imported_class(config.fileTypeTracker, constructorName);
  
  
  // Find variable assignment
  let assignmentNode: any = astNode.parent;
  while (assignmentNode && 
         assignmentNode.type !== 'variable_declarator' && 
         assignmentNode.type !== 'assignment_expression' &&
         assignmentNode.type !== 'assignment' &&
         assignmentNode.type !== 'let_declaration') {
    assignmentNode = assignmentNode.parent;
  }
  
  
  if (assignmentNode) {
    let varNameNode: any = null;
    
    if (assignmentNode.type === 'variable_declarator') {
      varNameNode = assignmentNode.childForFieldName('name');
    } else if (assignmentNode.type === 'assignment_expression') {
      varNameNode = assignmentNode.childForFieldName('left');
    } else if (assignmentNode.type === 'assignment') {
      varNameNode = assignmentNode.children[0];
    } else if (assignmentNode.type === 'let_declaration') {
      varNameNode = assignmentNode.childForFieldName('pattern');
    }
    
    
    if (varNameNode && varNameNode.type === 'identifier') {
      const varName = varNameNode.text;
      const position = assignmentNode.startPosition ? 
        { row: assignmentNode.startPosition.row, column: assignmentNode.startPosition.column } : 
        ref.range.start;
      
      
      
      if (fileImportedClass) {
        // Type from imported class
        const discovery = {
          variableName: varName,
          typeInfo: {
            className: fileImportedClass.className,
            classDef: fileImportedClass.classDef,
            position
          },
          scope: 'local' as const
        };
        typeDiscoveries.push(discovery);
      } else {
        // Try to resolve the constructor
        // For Rust, use the type node position instead of the 'new' method position
        let resolvePosition = ref.range.start;
        if (rustTypeNode && rustTypeNode.startPosition) {
          resolvePosition = { row: rustTypeNode.startPosition.row, column: rustTypeNode.startPosition.column };
        }
        
        let resolved = config.go_to_definition(def.file_path, resolvePosition);
        
        // If we resolved to an import, follow it
        if (resolved && resolved.symbol_kind === 'import') {
          const imports = config.get_imports_with_definitions(def.file_path);
          const importInfo = imports.find(imp => 
            imp.import_statement.name === resolved!.name &&
            imp.import_statement.range.start.row === resolved!.range.start.row &&
            imp.import_statement.range.start.column === resolved!.range.start.column
          );
          
          if (importInfo && importInfo.imported_function) {
            resolved = importInfo.imported_function;
          }
        }
        
        if (resolved && (resolved.symbol_kind === 'class' || resolved.symbol_kind === 'struct')) {
          // Compute enclosing range if needed
          const classDefWithRange = {
            ...resolved,
            enclosing_range: (resolved as any).enclosing_range || 
              compute_class_enclosing_range(resolved, fileCache.tree)
          };
          
          const discovery = {
            variableName: varName,
            typeInfo: {
              className: resolved.name,
              classDef: classDefWithRange,
              position
            },
            scope: 'local' as const
          };
          typeDiscoveries.push(discovery);
        }
      }
    }
  }
  
  return { typeDiscoveries };
}

/**
 * Resolve a reference to a definition
 */
function resolve_reference(
  ref: Ref,
  def: Def,
  config: CallAnalysisConfig,
  localTypeTracker: LocalTypeTrackerData
): MethodResolutionResult {
  const typeDiscoveries: TypeDiscovery[] = [];
  let resolved = config.go_to_definition(def.file_path, ref.range.start);
  
  // If we can't resolve a method reference directly, check if it's a method call
  if (!resolved && (ref.symbol_kind === 'method' || ref.name === 'insert_global_def' || ref.name === 'insert_local_def')) {
    const astNode = config.fileCache.tree.rootNode.descendantForPosition(
      { row: ref.range.start.row, column: ref.range.start.column },
      { row: ref.range.end.row, column: ref.range.end.column }
    );
    
    const parentNode = astNode?.parent;
    
    if (parentNode && (parentNode.type === 'member_expression' || 
                       parentNode.type === 'attribute' || 
                       parentNode.type === 'field_expression' || 
                       parentNode.type === 'scoped_identifier')) {
      
      // Handle Rust Type::method() pattern
      if (parentNode.type === 'scoped_identifier') {
        const typeName = parentNode.childForFieldName('path')?.text || parentNode.children[0]?.text;
        if (typeName) {
          const imports = config.get_imports_with_definitions(def.file_path);
          const importInfo = imports.find(imp => imp.import_statement.name === typeName);
          
          if (importInfo && importInfo.imported_function && config.get_file_graph) {
            const targetGraph = config.get_file_graph(importInfo.imported_function.file_path);
            if (targetGraph) {
              const defs = targetGraph.getNodes<Def>('definition');
              const method = defs.find(d => 
                d.name === ref.name && 
                (d.symbol_kind === 'method' || d.symbol_kind === 'function')
              );
              
              if (method) {
                resolved = method;
              }
            }
          }
        }
      } 
      // Handle instance.method() patterns
      else {
        const objectNode = parentNode.childForFieldName('object') || 
                          parentNode.childForFieldName('value') ||
                          (parentNode.type === 'attribute' ? parentNode.children[0] : null);
        
        if (objectNode) {
          if (objectNode.type === 'identifier') {
            // Handle simple case: obj.method()
            const objName = objectNode.text;
            const methodResult = resolve_method_call_pure(ref, objName, config, localTypeTracker);
            
            if (methodResult.resolved) {
              resolved = methodResult.resolved;
            }
            typeDiscoveries.push(...methodResult.typeDiscoveries);
          } else if (objectNode.type === 'call_expression') {
            // Handle chained case: obj.getInner().method()
            // We need to resolve the return type of the call expression
            const returnType = resolve_call_return_type(objectNode, def, config, localTypeTracker);
            if (process.env.DEBUG_METHOD_CHAINS) {
              console.log(`\nResolving chained method ${ref.name} on call expression`);
              console.log(`  Return type from call: ${returnType}`);
            }
            if (returnType) {
              const methodResult = resolve_method_on_type(ref, returnType, config);
              if (methodResult) {
                resolved = methodResult;
              }
            }
          }
        }
      }
    }
  }
  
  // Resolve imports if needed
  if (resolved && resolved.symbol_kind === 'import') {
    const imports = config.get_imports_with_definitions(def.file_path);
    const import_info = imports.find(imp => 
      imp.import_statement.name === resolved!.name &&
      imp.import_statement.range.start.row === resolved!.range.start.row &&
      imp.import_statement.range.start.column === resolved!.range.start.column
    );
    
    if (import_info && import_info.imported_function) {
      resolved = import_info.imported_function;
    }
  }
  
  return { resolved, typeDiscoveries };
}

/**
 * Resolve the return type of a call expression
 */
function resolve_call_return_type(
  callNode: any,
  contextDef: Def,
  config: CallAnalysisConfig,
  localTypeTracker: LocalTypeTrackerData
): string | undefined {
  // Get the function being called
  const funcNode = callNode.childForFieldName('function');
  if (!funcNode) return undefined;
  
  if (process.env.DEBUG_METHOD_CHAINS) {
    console.log(`\n  resolve_call_return_type: funcNode type = ${funcNode.type}`);
  }

  // Handle method calls: obj.method()
  if (funcNode.type === 'member_expression' || 
      funcNode.type === 'field_expression' ||
      funcNode.type === 'attribute') {
    const propertyNode = funcNode.childForFieldName('property') || 
                        funcNode.childForFieldName('field') ||
                        funcNode.child(funcNode.childCount - 1);
    
    if (propertyNode) {
      // Create a ref-like object for the method
      const methodRef: Ref = {
        id: -1,
        kind: 'reference',
        name: propertyNode.text,
        symbol_kind: 'method',
        range: {
          start: { 
            row: propertyNode.startPosition.row, 
            column: propertyNode.startPosition.column 
          },
          end: { 
            row: propertyNode.endPosition.row, 
            column: propertyNode.endPosition.column 
          }
        }
      };
      
      // Resolve the method
      const result = resolve_reference(methodRef, contextDef, config, localTypeTracker);
      if (result.resolved && result.resolved.return_type) {
        return result.resolved.return_type;
      }
    }
  }
  
  // Handle direct function calls: func()
  else if (funcNode.type === 'identifier') {
    const funcDef = config.go_to_definition(contextDef.file_path, {
      row: funcNode.startPosition.row,
      column: funcNode.startPosition.column
    });
    
    if (funcDef && funcDef.return_type) {
      return funcDef.return_type;
    }
  }
  
  return undefined;
}

/**
 * Resolve a method on a specific type
 */
function resolve_method_on_type(
  methodRef: Ref,
  typeName: string,
  config: CallAnalysisConfig
): Def | undefined {
  // Try to find the type definition
  // This is simplified - in a real implementation we'd need to handle imports, namespaces, etc.
  
  // First, check if it's a class/struct in the current file
  const currentGraph = config.graph;
  const typeDef = currentGraph.getNodes<Def>('definition').find(d => 
    d.name === typeName && 
    (d.symbol_kind === 'class' || d.symbol_kind === 'struct')
  );
  
  if (typeDef && config.get_file_graph) {
    const typeGraph = config.get_file_graph(typeDef.file_path);
    if (typeGraph) {
      const classDefs = typeGraph.getNodes<Def>('definition');
      
      // Look for the method within the class
      const method = classDefs.find(d => 
        d.name === methodRef.name && 
        (d.symbol_kind === 'method' || d.symbol_kind === 'function') &&
        is_method_of_class(d, typeDef)
      );
      
      if (method) {
        return method;
      }
    }
  }
  
  return undefined;
}

/**
 * Check if a definition is a method of a specific class
 */
function is_method_of_class(
  methodDef: Def,
  classDef: Def
): boolean {
  // Check if the method is within the class's enclosing range
  const classRange = (classDef as any).enclosing_range || classDef.range;
  
  return is_position_within_range(methodDef.range.start, classRange) &&
         is_position_within_range(methodDef.range.end, classRange);
}

/**
 * Compute enclosing range for a class definition
 */
export function compute_class_enclosing_range(
  classDef: Def,
  tree: Tree
): { start: { row: number; column: number }; end: { row: number; column: number } } | undefined {
  if (!classDef || !classDef.range) {
    return undefined;
  }
  
  // Find the AST node for this class definition
  const classNode = tree.rootNode.descendantForPosition(
    { row: classDef.range.start.row, column: classDef.range.start.column },
    { row: classDef.range.end.row, column: classDef.range.end.column }
  );
  
  if (!classNode) {
    return classDef.range;
  }
  
  // Walk up to find the full class/struct definition node
  let current = classNode;
  while (current.parent) {
    const nodeType = current.parent.type;
    
    // Check for class-like definition nodes
    if (
      // JavaScript/TypeScript
      nodeType === 'class_declaration' ||
      nodeType === 'class' ||
      nodeType === 'interface_declaration' ||
      // Python
      nodeType === 'class_definition' ||
      // Rust
      nodeType === 'struct_item' ||
      nodeType === 'impl_item' ||
      nodeType === 'enum_item' ||
      nodeType === 'trait_item'
    ) {
      // Return the range of the full class node
      return {
        start: { 
          row: current.parent.startPosition.row, 
          column: current.parent.startPosition.column 
        },
        end: { 
          row: current.parent.endPosition.row, 
          column: current.parent.endPosition.column 
        }
      };
    }
    
    current = current.parent;
  }
  
  // Fallback to the definition range if we couldn't find a parent class node
  return classDef.range;
}