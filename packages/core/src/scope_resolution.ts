import { Tree, Query } from "tree-sitter";
import { ScopeGraph, Def, Scope, Ref, Import } from "./graph";
import { LanguageConfig } from "./types";
import { extract_function_metadata } from "./function_metadata";
import { get_symbol_id } from "./symbol_naming";

/**
 * The equivalent of `scope_res_generic`.
 * Takes a tree-sitter AST, a query string, and source code and builds a ScopeGraph for a single file.
 */
export function build_scope_graph(
  tree: Tree,
  config: LanguageConfig,
  file_path: string,
  source_code?: string
): ScopeGraph {
  if (!tree || !tree.rootNode) {
    throw new Error(
      `Failed to parse tree for language ${config.name}: tree or rootNode is undefined`
    );
  }

  const graph = new ScopeGraph(tree.rootNode, config.name);

  const query = new Query(config.parser.getLanguage(), config.scope_query);
  const matches = query.matches(tree.rootNode);

  // Collect all captures by type
  const scope_captures: Array<{ node: any }> = [];
  const def_captures: Array<{ node: any; scoping: string; kind: string }> = [];
  const import_captures: Array<{
    node: any;
    source_name?: string;
    module?: string;
    is_type_import?: boolean;
  }> = [];
  const ref_captures: Array<{ node: any; symbol_kind?: string }> = [];

  // First pass: categorize all captures
  for (const match of matches) {
    for (const capture of match.captures) {
      const capture_name = capture.name;
      const node = capture.node;
      const parts = capture_name.split(".");

      const scoping = parts[0];
      const node_type = parts[1];

      if (node_type === "scope") {
        scope_captures.push({ node });
      } else if (node_type === "definition") {
        const kind = parts[2] || "none"; // Default to 'none' if no kind specified
        def_captures.push({ node, scoping, kind });
      } else if (node_type === "import") {
        // Check if this is a renamed import by looking at the parent node
        let source_name: string | undefined;
        let module_path: string | undefined;
        let is_type_import = false;

        // Check if this is part of a renamed import
        if (node.parent && node.parent.type === "import_specifier") {
          const import_spec = node.parent;
          // Check if this import specifier has an 'as' keyword (renamed import)
          // Structure: import_specifier [name "as" alias]
          if (import_spec.childCount >= 3) {
            // Check if the current node is the alias (last child)
            const lastChild = import_spec.child(import_spec.childCount - 1);
            if (lastChild && lastChild.id === node.id) {
              // This is the alias, so get the source name (first child)
              source_name = import_spec.child(0)?.text;
            }
          }
          
          // Check if this is a type import specifier
          // In mixed imports like: import { type User, getName }
          // Each import_specifier can have a 'type' keyword
          for (let i = 0; i < import_spec.childCount; i++) {
            const child = import_spec.child(i);
            if (child && child.type === 'type') {
              is_type_import = true;
              break;
            }
          }
        }

        // Try to find the module path from the import statement
        let current = node.parent;
        while (current && current.type !== "import_statement" && current.type !== "import_from_statement") {
          current = current.parent;
        }
        if (current) {
          if (current.type === "import_statement") {
            // Check if this is a type-only import statement
            // Structure: import "type" { ... } from "module"
            // The 'type' keyword appears as child(1) if present
            const firstChild = current.child(1);
            if (firstChild && firstChild.type === 'type') {
              is_type_import = true;
            }
            
            // Find the string node (module path) - for JS/TS imports
            for (let i = 0; i < current.childCount; i++) {
              const child = current.child(i);
              if (child && child.type === "string") {
                // Remove quotes from the string
                module_path = child.text.slice(1, -1);
                break;
              }
            }
          } else if (current.type === "import_from_statement") {
            // For Python imports: from MODULE import NAME
            // Find the dotted_name after "from"
            let foundFrom = false;
            for (let i = 0; i < current.childCount; i++) {
              const child = current.child(i);
              if (child && child.type === "from") {
                foundFrom = true;
              } else if (foundFrom && child && child.type === "dotted_name") {
                module_path = child.text;
                break;
              }
            }
          }
        }

        import_captures.push({ node, source_name, module: module_path, is_type_import });
      } else if (node_type === "reference") {
        const symbol_kind = parts[2];
        ref_captures.push({ node, symbol_kind });
      }
    }
  }

  if (process.env.CI) {
    console.log(
      `ScopeGraph: Captures found - scopes: ${scope_captures.length}, defs: ${def_captures.length}, imports: ${import_captures.length}, refs: ${ref_captures.length}`
    );
  }

  // Track exported names for later marking definitions
  const exportedNames = new Set<string>();
  let pythonAllList: string[] | null = null;
  
  // First, find all exported names
  if (config.name === 'typescript' || config.name === 'javascript') {
    // Look for export statements in the tree
    findExportedNames(tree.rootNode, exportedNames);
  } else if (config.name === 'python') {
    // Look for __all__ definition
    pythonAllList = findPythonAllExports(tree.rootNode);
  }

  // Second pass: process captures in order (scopes, then defs, then imports, then refs)

  // 1. Process scopes first
  for (const { node } of scope_captures) {
    const new_scope: Scope = {
      id: graph.get_next_node_id(),
      kind: "scope",
      range: graph.node_to_simple_range(node),
    };
    graph.insert_local_scope(new_scope);
  }

  // 2. Process definitions
  for (const { node, scoping, kind } of def_captures) {
    // Check if symbol kind is valid
    let symbol_id: number[] | undefined;
    for (let i = 0; i < config.namespaces.length; i++) {
      const j = config.namespaces[i].indexOf(kind);
      if (j !== -1) {
        symbol_id = [i, j];
        break;
      }
    }

    // Create definition object (temporarily without symbol_id)
    const new_def: Def = {
      id: graph.get_next_node_id(),
      kind: "definition",
      name: node.text,
      symbol_kind: symbol_id ? kind : "none",
      range: graph.node_to_simple_range(node),
      file_path: file_path,
      symbol_id: "", // Will be computed after metadata is added
    };
    
    // Check if this definition is exported
    new_def.is_exported = isDefinitionExported(node, config.name, exportedNames, pythonAllList);

    // For function-like definitions, set enclosing_range to the parent node
    // which contains the full function body
    if (
      node.parent &&
      (kind === "function" || kind === "method" || kind === "generator") &&
      (node.type === "identifier" || node.type === "property_identifier" || node.type === "private_property_identifier")
    ) {
      const parent_node = node.parent;
      // Check if parent is a function-like node
      if (
        // JavaScript/TypeScript
        parent_node.type === "function_declaration" ||
        parent_node.type === "function_expression" ||
        parent_node.type === "arrow_function" ||
        parent_node.type === "method_definition" ||
        parent_node.type === "generator_function_declaration" ||
        // Python
        parent_node.type === "function_definition" ||
        // Rust
        parent_node.type === "function_item"
      ) {
        new_def.enclosing_range = graph.node_to_simple_range(parent_node);
      }
    }

    // Add function metadata if this is a function definition
    if (
      source_code &&
      (kind === "function" || kind === "method" || kind === "generator")
    ) {
      const parent_node = node.parent;
      new_def.metadata = extract_function_metadata(
        node,
        parent_node,
        config,
        source_code
      );
    }

    // Now compute the symbol ID with all information available
    new_def.symbol_id = get_symbol_id(new_def);

    // Insert definition based on scoping
    if (scoping === "local") {
      graph.insert_local_def(new_def);
    } else if (scoping === "hoist") {
      graph.insert_hoisted_def(new_def);
    } else if (scoping === "global") {
      graph.insert_global_def(new_def);
    }
  }

  // 3. Process imports
  for (const { node, source_name, module, is_type_import } of import_captures) {
    const new_import: Import = {
      id: graph.get_next_node_id(),
      kind: "import",
      name: node.text,
      source_name: source_name,
      source_module: module,
      is_type_import: is_type_import,
      range: graph.node_to_simple_range(node),
    };
    graph.insert_local_import(new_import);
  }

  // 4. Process references
  for (const { node, symbol_kind } of ref_captures) {
    const new_ref: Ref = {
      id: graph.get_next_node_id(),
      kind: "reference",
      name: node.text,
      symbol_kind: symbol_kind,
      range: graph.node_to_simple_range(node),
    };
    graph.insert_ref(new_ref);
  }

  return graph;
}

/**
 * Find all exported names in TypeScript/JavaScript code
 */
function findExportedNames(node: any, exportedNames: Set<string>) {
  // Handle module.exports and exports assignments
  if (node.type === 'assignment_expression') {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    
    if (left?.type === 'member_expression') {
      const object = left.childForFieldName('object');
      const property = left.childForFieldName('property');
      
      // module.exports = { func1, func2 }
      if (object?.text === 'module' && property?.text === 'exports') {
        if (right?.type === 'object') {
          // Extract all properties from the object
          for (let i = 0; i < right.childCount; i++) {
            const child = right.child(i);
            if (child?.type === 'pair') {
              const key = child.childForFieldName('key');
              if (key?.type === 'property_identifier') {
                exportedNames.add(key.text);
              }
            } else if (child?.type === 'shorthand_property_identifier') {
              exportedNames.add(child.text);
            }
          }
        } else if (right?.type === 'identifier') {
          // module.exports = functionName
          exportedNames.add(right.text);
        }
      }
      // exports.functionName = ...
      else if (object?.text === 'exports' && property?.type === 'property_identifier') {
        exportedNames.add(property.text);
      }
    }
  }
  
  if (node.type === 'export_statement') {
    // Direct exports: export function name() {}
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      
      if (child.type === 'function_declaration' || 
          child.type === 'class_declaration' ||
          child.type === 'interface_declaration' ||
          child.type === 'type_alias_declaration' ||
          child.type === 'enum_declaration') {
        // Find the identifier
        const nameNode = child.childForFieldName('name') || child.child(1);
        if (nameNode && nameNode.type === 'identifier' || nameNode?.type === 'type_identifier') {
          exportedNames.add(nameNode.text);
        }
      } else if (child.type === 'lexical_declaration' || child.type === 'variable_declaration') {
        // export const/let/var name = ...
        for (let j = 0; j < child.childCount; j++) {
          const declarator = child.child(j);
          if (declarator?.type === 'variable_declarator') {
            const nameNode = declarator.childForFieldName('name') || declarator.child(0);
            if (nameNode?.type === 'identifier') {
              exportedNames.add(nameNode.text);
            }
          }
        }
      } else if (child.type === 'export_clause') {
        // export { name1, name2 as alias }
        for (let j = 0; j < child.childCount; j++) {
          const specifier = child.child(j);
          if (specifier?.type === 'export_specifier') {
            // Get the local name (what's actually exported)
            const nameNode = specifier.childForFieldName('name') || specifier.child(0);
            if (nameNode?.type === 'identifier') {
              exportedNames.add(nameNode.text);
            }
          }
        }
      }
    }
  }
  
  // Recurse through children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      findExportedNames(child, exportedNames);
    }
  }
}

/**
 * Find Python __all__ exports
 */
function findPythonAllExports(node: any): string[] | null {
  // Check for expression_statement containing assignment
  if (node.type === 'expression_statement' && node.childCount > 0) {
    const assignment = node.child(0);
    if (assignment?.type === 'assignment') {
      return findPythonAllExports(assignment);
    }
  }
  
  if (node.type === 'assignment' && node.childCount >= 3) {
    const left = node.child(0);
    const right = node.child(2); // Skip the = operator
    
    if (left?.text === '__all__' && right?.type === 'list') {
      const exports: string[] = [];
      
      // Extract string literals from the list
      for (let i = 0; i < right.childCount; i++) {
        const child = right.child(i);
        if (child?.type === 'string') {
          // Extract the string content (remove quotes)
          let text = child.text;
          // Handle single and double quotes
          if ((text.startsWith("'") && text.endsWith("'")) ||
              (text.startsWith('"') && text.endsWith('"'))) {
            text = text.substring(1, text.length - 1);
          }
          exports.push(text);
        }
      }
      
      return exports;
    }
  }
  
  // Recurse through children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const result = findPythonAllExports(child);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Check if a definition node is exported based on language rules
 */
function isDefinitionExported(node: any, language: string, exportedNames: Set<string>, pythonAllList: string[] | null = null): boolean {
  const name = node.text;
  
  if (language === 'typescript' || language === 'javascript') {
    // Check if parent is export_statement
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'export_statement') {
        return true;
      }
      // Stop at certain boundaries
      if (parent.type === 'program' || 
          parent.type === 'statement_block' ||
          parent.type === 'class_body') {
        break;
      }
      parent = parent.parent;
    }
    
    // Check if name is in export list
    return exportedNames.has(name);
  } else if (language === 'python') {
    // For Python, check if the definition itself (not the identifier) is at root level
    let parent = node.parent;
    let inRootScope = false;
    
    // The node is the identifier, so check if its parent is a root-level definition
    if (parent && (parent.type === 'function_definition' || parent.type === 'class_definition')) {
      // Check if this definition's parent is the module
      const defParent = parent.parent;
      if (defParent && defParent.type === 'module') {
        inRootScope = true;
      }
    } else {
      // For other definitions (like variables), check normal way
      inRootScope = true;
      while (parent && parent.type !== 'module') {
        if (parent.type === 'function_definition' || 
            parent.type === 'class_definition') {
          inRootScope = false;
          break;
        }
        parent = parent.parent;
      }
    }
    
    
    if (!inRootScope) {
      return false; // Nested definitions are not exported
    }
    
    // If __all__ is defined, only names in it are exported
    if (pythonAllList !== null) {
      return pythonAllList.includes(name);
    }
    
    // Otherwise, follow Python conventions:
    // Names starting with _ are private (except __special__)
    if (name.startsWith('_') && !name.startsWith('__')) {
      return false;
    }
    
    return true;
  } else if (language === 'rust') {
    // Check for pub keyword
    let parent = node.parent;
    if (parent) {
      // Look for 'pub' among siblings before this node
      const parentChildren = [];
      for (let i = 0; i < parent.childCount; i++) {
        parentChildren.push(parent.child(i));
      }
      const nodeIndex = parentChildren.findIndex(child => child?.id === node.id);
      
      // Check previous siblings for 'pub'
      for (let i = 0; i < nodeIndex; i++) {
        const sibling = parentChildren[i];
        if (sibling?.type === 'visibility_modifier' && sibling.text === 'pub') {
          return true;
        }
      }
    }
    return false;
  }
  
  // Default: treat root-level definitions as exported
  return true;
}
