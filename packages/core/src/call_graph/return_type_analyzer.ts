import { Def, ScopeGraph } from '../graph';
import { Tree } from 'tree-sitter';

/**
 * Analyzes function/method bodies to infer return types
 */
export function analyze_return_type(
  def: Def,
  scopeGraph: ScopeGraph,
  tree: Tree,
  sourceCode: string
): string | undefined {
  // Only analyze functions and methods
  if (def.symbol_kind !== 'function' && def.symbol_kind !== 'method') {
    return undefined;
  }

  if (process.env.DEBUG_RETURN_TYPES) {
    console.log(`\nAnalyzing return type for ${def.name} at ${def.range.start.row}:${def.range.start.column}`);
  }

  // Get the AST node for the function
  const defNode = tree.rootNode.descendantForPosition(
    { row: def.range.start.row, column: def.range.start.column },
    { row: def.range.end.row, column: def.range.end.column }
  );

  if (!defNode) {
    if (process.env.DEBUG_RETURN_TYPES) {
      console.log(`  No AST node found`);
    }
    return undefined;
  }

  // Find the function/method declaration node
  let funcNode = defNode;
  while (funcNode && !isFunctionNode(funcNode)) {
    funcNode = funcNode.parent;
  }

  if (!funcNode) {
    if (process.env.DEBUG_RETURN_TYPES) {
      console.log(`  No function node found`);
    }
    return undefined;
  }

  if (process.env.DEBUG_RETURN_TYPES) {
    console.log(`  Found function node: ${funcNode.type}`);
  }

  // Language-specific return type extraction
  const lang = scopeGraph.lang;
  
  if (process.env.DEBUG_RETURN_TYPES) {
    console.log(`  Language: ${lang}`);
  }
  
  if (lang === 'typescript' || lang === 'javascript') {
    return analyze_typescript_return_type(funcNode, def, scopeGraph);
  } else if (lang === 'python') {
    return analyze_python_return_type(funcNode, def, scopeGraph, sourceCode);
  } else if (lang === 'rust') {
    return analyze_rust_return_type(funcNode, def, scopeGraph);
  }

  return undefined;
}

function isFunctionNode(node: any): boolean {
  const functionTypes = [
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
    'function_definition', // Python
    'function_item', // Rust
  ];
  return functionTypes.includes(node.type);
}

/**
 * Analyze TypeScript/JavaScript return types
 */
function analyze_typescript_return_type(
  funcNode: any,
  def: Def,
  scopeGraph: ScopeGraph
): string | undefined {
  // First check for explicit return type annotation
  const returnType = funcNode.childForFieldName('return_type');
  
  if (process.env.DEBUG_RETURN_TYPES) {
    console.log(`  TypeScript - checking return type for ${def.name}`);
    console.log(`  Return type node: ${returnType ? returnType.type : 'null'}`);
  }
  
  if (returnType && returnType.type === 'type_annotation') {
    // The type_annotation node contains the actual type as its child
    // Skip the ':' if present
    for (let i = 0; i < returnType.childCount; i++) {
      const child = returnType.child(i);
      if (child && child.type !== ':') {
        if (process.env.DEBUG_RETURN_TYPES) {
          console.log(`  Found return type: ${child.text}`);
        }
        return child.text;
      }
    }
  }

  // For methods, check if it's a getter that returns a property
  if (def.symbol_kind === 'method' && def.name.startsWith('get')) {
    // Simple heuristic: getXxx() often returns this.xxx
    const propertyName = def.name.substring(3).toLowerCase();
    
    // Look for return statements in the function body
    const body = funcNode.childForFieldName('body');
    if (body) {
      const returnStatements = findReturnStatements(body);
      
      // Check if any return statement returns 'this.propertyName'
      for (const retStmt of returnStatements) {
        const returnExpr = retStmt.childForFieldName('expression') || retStmt.child(1);
        if (returnExpr && returnExpr.type === 'member_expression') {
          const object = returnExpr.childForFieldName('object');
          const property = returnExpr.childForFieldName('property');
          
          if (object && object.type === 'this' && property) {
            // This returns a property - we could track the property type
            // For now, just indicate it returns the same type as the class
            return def.name.replace(/^get/, '');
          }
        }
      }
    }
  }

  // Check for constructor patterns
  if (def.name === 'constructor' || def.name === 'new') {
    // Constructor returns instance of the class
    const className = getEnclosingClassName(funcNode);
    if (className) {
      return className;
    }
  }

  return undefined;
}

/**
 * Analyze Python return types
 */
function analyze_python_return_type(
  funcNode: any,
  def: Def,
  scopeGraph: ScopeGraph,
  sourceCode: string
): string | undefined {
  // Check for type annotation (Python 3.5+)
  const returnType = funcNode.childForFieldName('return_type');
  if (returnType) {
    return returnType.text;
  }

  // Check docstring for type hints
  const body = funcNode.childForFieldName('body');
  if (body && body.childCount > 0) {
    const firstStmt = body.child(0);
    if (firstStmt && firstStmt.type === 'expression_statement') {
      const expr = firstStmt.child(0);
      if (expr && expr.type === 'string') {
        // Parse docstring for returns section
        const docstring = expr.text;
        const returnsMatch = docstring.match(/Returns?:\s*(?:[\r\n]+\s+)?(\w+)/);
        if (returnsMatch) {
          return returnsMatch[1];
        }
      }
    }
  }

  // Special case for __init__
  if (def.name === '__init__') {
    return 'None';
  }

  return undefined;
}

/**
 * Analyze Rust return types
 */
function analyze_rust_return_type(
  funcNode: any,
  def: Def,
  scopeGraph: ScopeGraph
): string | undefined {
  // Rust has explicit return types after ->
  const returnType = funcNode.childForFieldName('return_type');
  if (returnType) {
    // Skip the '->' and get the actual type
    for (let i = 0; i < returnType.childCount; i++) {
      const child = returnType.child(i);
      if (child && child.type !== '->') {
        return child.text;
      }
    }
  }

  // Check if it's a constructor pattern (usually returns Self)
  if (def.name === 'new') {
    const impl_block = findEnclosingImplBlock(funcNode);
    if (impl_block) {
      const typeNode = impl_block.childForFieldName('type');
      if (typeNode) {
        return typeNode.text;
      }
    }
    return 'Self';
  }

  return undefined;
}

/**
 * Find all return statements in a node
 */
function findReturnStatements(node: any): any[] {
  const returns: any[] = [];
  
  function traverse(n: any) {
    if (n.type === 'return_statement') {
      returns.push(n);
    }
    
    // Don't traverse into nested functions
    if (!isFunctionNode(n) || n === node) {
      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) {
          traverse(child);
        }
      }
    }
  }
  
  traverse(node);
  return returns;
}

/**
 * Get the class name that encloses a method
 */
function getEnclosingClassName(node: any): string | undefined {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'class_declaration' || current.type === 'class_definition') {
      const nameNode = current.childForFieldName('name');
      if (nameNode) {
        return nameNode.text;
      }
    }
    current = current.parent;
  }
  
  return undefined;
}

/**
 * Find enclosing impl block for Rust
 */
function findEnclosingImplBlock(node: any): any | undefined {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'impl_item') {
      return current;
    }
    current = current.parent;
  }
  
  return undefined;
}