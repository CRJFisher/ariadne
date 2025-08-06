/**
 * Constructor analysis for tracking object instantiation and type discovery
 * 
 * This module handles detection of constructor calls and tracks the types
 * of variables assigned from constructor calls. This is essential for
 * method resolution on objects.
 */

import { Def, Ref } from '../../graph';
import { Tree } from 'tree-sitter';
import { TypeDiscovery, TypeInfo } from '@ariadnejs/types';
import { 
  get_local_imported_class,
  get_imported_class,
  LocalTypeTrackerData,
  FileTypeTrackerData
} from '../type_tracker';
import { compute_class_enclosing_range } from './range_utils';

/**
 * File cache interface
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: any; // ScopeGraph
}

// Re-export TypeDiscovery for convenience
export type { TypeDiscovery } from '@ariadnejs/types';

/**
 * Configuration for constructor analysis
 */
export interface ConstructorAnalysisConfig {
  readonly file_path: string;
  readonly fileCache: FileCache;
  readonly fileTypeTracker: FileTypeTrackerData;
  readonly localTypeTracker: LocalTypeTrackerData;
  readonly go_to_definition: (file_path: string, position: { row: number; column: number }) => Def | undefined;
  readonly get_imports_with_definitions: (file_path: string) => Array<{
    import_statement: any; // Import
    local_name: string;
    imported_function: Def;
  }>;
}

/**
 * Analyze a potential constructor call and track type assignments
 * 
 * This function detects constructor calls in different languages:
 * - JavaScript/TypeScript: new ClassName()
 * - Python: ClassName()
 * - Rust: Type::new()
 * 
 * When a constructor is detected and assigned to a variable, it creates
 * a TypeDiscovery that tracks the variable's type for later method resolution.
 * 
 * @returns TypeDiscoveries if this is a constructor call, null otherwise
 */
export function analyze_constructor_call(
  ref: Ref,
  def: Def,
  config: ConstructorAnalysisConfig
): { typeDiscoveries: readonly TypeDiscovery[] } | null {
  const { fileCache, localTypeTracker } = config;
  const typeDiscoveries: TypeDiscovery[] = [];
  
  // Get AST node for the reference
  const astNode = fileCache.tree.rootNode.descendantForPosition(
    { row: ref.range.start.row, column: ref.range.start.column },
    { row: ref.range.end.row, column: ref.range.end.column }
  );
  
  // Check for constructor calls in different languages
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
      // Store the node for the type name for later resolution
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