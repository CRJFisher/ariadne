import { Def, Ref, ScopeGraph, Import } from '../graph';
import { FileCache } from '../file_cache';
import { TreeNode } from '../parse';
import { FunctionCall } from '../graph';
import { 
  FileTypeTrackerData, 
  LocalTypeTrackerData,
  TypeInfo,
  ImportedClassInfo,
  get_variable_type as get_variable_type_immutable,
  get_local_variable_type,
  get_local_imported_class
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
    if (constructorAnalysis) {
      typeDiscoveries.push(...constructorAnalysis.typeDiscoveries);
    }
  }
  
  // Second pass: resolve all references including method calls
  // Create an updated local type tracker with discovered types
  let currentLocalTracker = localTypeTracker;
  for (const discovery of typeDiscoveries) {
    if (discovery.scope === 'local') {
      // In a real implementation, we'd update the local tracker
      // For now, we'll use the existing one
      // This is where the caller would apply the type updates
    }
  }
  
  for (const ref of definitionRefs) {
    const resolved = resolve_reference(ref, def, config, currentLocalTracker);
    
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
        
        calls.push({
          caller_def: moduleDef,
          function_ref: ref,
          resolved_definition: final_resolved,
          kind: is_method_call ? 'method' : 'function'
        });
      }
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
    if (config.get_file_graph) {
      const classGraph = config.get_file_graph(typeInfo.classDef.file_path);
      const classDefs = classGraph ? classGraph.getNodes<Def>('definition') : [];
      
      // For class definitions, use enclosing_range if available
      const classRange = (typeInfo.classDef as any).enclosing_range || typeInfo.classDef.range;
      
      // Find method within the class range
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
  if (def.file_path.endsWith('.rs') && ref.name === 'new' && astNode?.parent?.type === 'scoped_identifier') {
    const typeName = astNode.parent.childForFieldName('path')?.text || astNode.parent.children[0]?.text;
    if (typeName) {
      constructorName = typeName;
    }
  }
  
  // Check if this is an imported class
  const importedClass = get_local_imported_class(localTypeTracker, constructorName);
  
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
      
      if (importedClass) {
        // Type from imported class
        typeDiscoveries.push({
          variableName: varName,
          typeInfo: {
            className: importedClass.className,
            classDef: importedClass.classDef,
            position
          },
          scope: 'local'
        });
      } else {
        // Try to resolve the constructor
        const resolved = config.go_to_definition(def.file_path, ref.range.start);
        if (resolved && (resolved.symbol_kind === 'class' || resolved.symbol_kind === 'struct')) {
          // Compute enclosing range if needed
          const classDefWithRange = {
            ...resolved,
            enclosing_range: (resolved as any).enclosing_range || 
              compute_class_enclosing_range(resolved, fileCache.tree)
          };
          
          typeDiscoveries.push({
            variableName: varName,
            typeInfo: {
              className: resolved.name,
              classDef: classDefWithRange,
              position
            },
            scope: 'local'
          });
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
  if (!resolved && ref.symbol_kind === 'method') {
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
        
        if (objectNode && objectNode.type === 'identifier') {
          const objName = objectNode.text;
          const methodResult = resolve_method_call_pure(ref, objName, config, localTypeTracker);
          
          if (methodResult.resolved) {
            resolved = methodResult.resolved;
          }
          typeDiscoveries.push(...methodResult.typeDiscoveries);
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
 * Compute enclosing range for a class definition
 */
function compute_class_enclosing_range(
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