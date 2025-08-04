import { Tree, Query } from "tree-sitter";
import { ScopeGraph, Def, Scope, Ref, Import } from "./graph";
import { LanguageConfig } from "./types";
import { extract_function_metadata } from "./function_metadata";
import { get_symbol_id } from "./symbol_naming";
import { analyze_return_type } from "./call_graph/return_type_analyzer";

/**
 * Determines if a JavaScript/TypeScript variable declaration should be hoisted.
 * In JavaScript, 'var' declarations are hoisted to the function scope, but only
 * if they're inside a nested block (not at the top level of the function).
 */
function shouldHoistVarDeclaration(node: any, config: LanguageConfig): boolean {
  // Only process JavaScript/TypeScript var declarations
  if (config.name !== 'javascript' && config.name !== 'typescript') {
    return false;
  }
  
  // Check if this is a var declaration
  let parent = node.parent;
  while (parent && parent.type !== 'variable_declaration') {
    parent = parent.parent;
  }
  
  if (!parent) return false;
  
  // Check if it's actually a 'var' (not let/const)
  const firstChild = parent.firstChild;
  if (!firstChild || firstChild.text !== 'var') {
    return false;
  }
  
  // Now check if the var is inside a block that's not directly in a function
  let current = parent.parent;
  let inNestedBlock = false;
  
  while (current) {
    // If we're in a block statement (but not a function body directly)
    if (current.type === 'statement_block') {
      // Check if the parent is a function - if so, this is the function body
      if (current.parent && (
        current.parent.type === 'function_declaration' || 
        current.parent.type === 'function_expression' ||
        current.parent.type === 'arrow_function' ||
        current.parent.type === 'method_definition')) {
        // This block is the function body, no hoisting needed if we haven't seen a nested block
        return inNestedBlock;
      } else {
        // This is a nested block
        inNestedBlock = true;
      }
    }
    
    // If we're in a control flow statement, we're in a nested block
    if (current.type === 'if_statement' ||
        current.type === 'for_statement' ||
        current.type === 'while_statement' ||
        current.type === 'do_statement' ||
        current.type === 'switch_statement' ||
        current.type === 'try_statement') {
      inNestedBlock = true;
    }
    
    // If we hit a function-like node, we're done checking
    if (current.type === 'function_declaration' || 
        current.type === 'function_expression' ||
        current.type === 'arrow_function' ||
        current.type === 'method_definition') {
      return inNestedBlock;
    }
    
    current = current.parent;
  }
  
  return false;
}

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
  const def_captures: Array<{ node: any; scoping: string; kind: string; isExported?: boolean }> = [];
  const import_captures: Array<{
    node: any;
    source_name?: string;
    module?: string;
    is_type_import?: boolean;
  }> = [];
  const ref_captures: Array<{ node: any; symbol_kind?: string; isExported?: boolean }> = [];

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
        const isExported = parts[parts.length - 1] === "exported";
        def_captures.push({ node, scoping, kind, isExported });
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
        while (current && current.type !== "import_statement" && current.type !== "import_from_statement" && current.type !== "variable_declarator" && current.type !== "use_declaration") {
          current = current.parent;
        }
        if (current) {
          if (current.type === "variable_declarator") {
            // CommonJS require pattern: const name = require('module')
            const valueNode = current.childForFieldName('value');
            if (valueNode && valueNode.type === 'call_expression') {
              const functionNode = valueNode.childForFieldName('function');
              if (functionNode && functionNode.text === 'require') {
                // Get the argument (module path)
                const argsNode = valueNode.childForFieldName('arguments');
                if (argsNode) {
                  for (let i = 0; i < argsNode.childCount; i++) {
                    const arg = argsNode.child(i);
                    if (arg && arg.type === 'string') {
                      // Remove quotes from the string
                      module_path = arg.text.slice(1, -1);
                      break;
                    }
                  }
                }
              }
            }
          } else if (current.type === "import_statement") {
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
          } else if (current.type === "use_declaration") {
            // For Rust imports: use crate::module::Type
            // The structure is use_declaration -> scoped_identifier or use_declaration -> use_as_clause -> scoped_identifier
            let scopedIdent = null;
            
            
            // First check if there's a use_as_clause child
            for (let i = 0; i < current.childCount; i++) {
              const child = current.child(i);
              if (child && child.type === "use_as_clause") {
                // Look for scoped_identifier within use_as_clause
                for (let j = 0; j < child.childCount; j++) {
                  const grandchild = child.child(j);
                  if (grandchild && grandchild.type === "scoped_identifier") {
                    scopedIdent = grandchild;
                    break;
                  }
                }
                break;
              } else if (child && child.type === "scoped_identifier") {
                scopedIdent = child;
                break;
              }
            }
            
            if (scopedIdent) {
              // Extract the module path (everything before the last ::)
              const fullPath = scopedIdent.text;
              const lastDoubleColon = fullPath.lastIndexOf("::");
              if (lastDoubleColon > 0) {
                module_path = fullPath.substring(0, lastDoubleColon);
              } else {
                module_path = fullPath;
              }
            }
          } else if (current.type === "use_as_clause") {
            // This case is handled by the parent use_declaration
            let parent = current.parent;
            if (parent && parent.type === "use_declaration") {
              // Already handled above
            }
          }
        }

        import_captures.push({ node, source_name, module: module_path, is_type_import });
      } else if (node_type === "reference") {
        const symbol_kind = parts[2];
        const isExported = parts[parts.length - 1] === "exported";
        ref_captures.push({ node, symbol_kind, isExported });
      }
    }
  }

  if (process.env.CI) {
    console.log(
      `ScopeGraph: Captures found - scopes: ${scope_captures.length}, defs: ${def_captures.length}, imports: ${import_captures.length}, refs: ${ref_captures.length}`
    );
  }

  // Collect exported names from export lists (for references in export clauses)
  const exportedNames = new Set<string>();
  for (const { node, isExported } of ref_captures) {
    if (isExported) {
      exportedNames.add(node.text);
    }
  }
  
  // For Python, handle __all__ - find the definition and extract the list
  let pythonAllList: Set<string> | null = null;
  if (config.name === 'python') {
    // Look for __all__ definition in the captures
    const allDef = def_captures.find(d => d.node.text === '__all__');
    if (allDef) {
      // Find the assignment node containing this definition
      let parent = allDef.node.parent;
      while (parent && parent.type !== 'assignment') {
        parent = parent.parent;
      }
      
      if (parent && parent.type === 'assignment') {
        const right = parent.child(2); // Skip the = operator
        if (right && right.type === 'list') {
          pythonAllList = new Set<string>();
          // Extract string literals from the list
          for (let i = 0; i < right.childCount; i++) {
            const child = right.child(i);
            if (child && child.type === 'string') {
              // Extract the string content (remove quotes)
              let text = child.text;
              // Handle triple quotes
              if ((text.startsWith('"""') && text.endsWith('"""')) ||
                  (text.startsWith("'''") && text.endsWith("'''"))) {
                text = text.substring(3, text.length - 3);
              }
              // Handle single/double quotes
              else if ((text.startsWith("'") && text.endsWith("'")) ||
                       (text.startsWith('"') && text.endsWith('"'))) {
                text = text.substring(1, text.length - 1);
              }
              pythonAllList.add(text);
            }
          }
        }
      }
    }
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
  if (process.env.DEBUG_RUST_DEFS) {
    console.log(`Processing ${def_captures.length} definitions for ${config.name} file ${file_path}`);
    def_captures.forEach(d => console.log(`  ${d.kind}: ${d.node.text} at ${d.node.startPosition.row}:${d.node.startPosition.column}`));
  }
  for (const { node, scoping, kind, isExported } of def_captures) {
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
    if (isExported === true) {
      // Directly captured as exported in scope queries
      new_def.is_exported = true;
    } else if (exportedNames.has(node.text)) {
      // Exported via export list (e.g., export { func1, func2 })
      new_def.is_exported = true;
    } else if (config.name === 'python') {
      // For Python, apply export conventions
      new_def.is_exported = isPythonExported(node, new_def, pythonAllList);
    } else if (config.name === 'rust') {
      // For Rust, check for pub keyword
      new_def.is_exported = isRustPublic(node);
    } else {
      // Default: not exported unless explicitly marked
      new_def.is_exported = false;
    }

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
    
    // Add return type analysis for functions/methods (after symbol_id is set)
    if (kind === "function" || kind === "method") {
      const returnType = analyze_return_type(new_def, graph, tree, source_code || '');
      if (returnType) {
        new_def.return_type = returnType;
      }
      if (process.env.DEBUG_RETURN_TYPES) {
        console.log(`Return type for ${new_def.name}: ${returnType}`);
      }
    }

    // Check for duplicate definitions at the same location
    // This can happen when multiple scope patterns match the same node
    const existingDefs = graph.getNodes<Def>('definition');
    const isDuplicate = existingDefs.some(def => 
      def.name === new_def.name &&
      def.range.start.row === new_def.range.start.row &&
      def.range.start.column === new_def.range.start.column
    );
    
    if (isDuplicate) {
      // Skip this duplicate definition
      if (process.env.DEBUG_RUST_DEFS || process.env.DEBUG_DEFS) {
        console.log(`Skipping duplicate definition '${new_def.name}' (${kind}) at ${new_def.range.start.row}:${new_def.range.start.column}`);
      }
      continue;
    }

    // Insert definition based on scoping
    if (scoping === "local") {
      // Check if this is a JavaScript/TypeScript var that should be hoisted
      if (kind === "variable" && shouldHoistVarDeclaration(node, config)) {
        graph.insert_hoisted_def(new_def);
      } else {
        graph.insert_local_def(new_def);
      }
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

  // 4. Process references (with deduplication for overlapping patterns)
  const processedRefs = new Map<string, Ref>();
  
  for (const { node, symbol_kind } of ref_captures) {
    const range = graph.node_to_simple_range(node);
    const refKey = `${node.text}:${range.start.row}:${range.start.column}`;
    
    // Check if we already have a reference at this location
    const existing = processedRefs.get(refKey);
    if (existing) {
      // If the existing ref has a more specific symbol_kind (like 'method'), keep it
      // Otherwise, update with the new one if it's more specific
      if (!existing.symbol_kind && symbol_kind) {
        existing.symbol_kind = symbol_kind;
      }
      continue; // Skip adding duplicate
    }
    
    const new_ref: Ref = {
      id: graph.get_next_node_id(),
      kind: "reference",
      name: node.text,
      symbol_kind: symbol_kind,
      range: range,
    };
    
    processedRefs.set(refKey, new_ref);
    graph.insert_ref(new_ref);
  }

  return graph;
}

/**
 * Check if a Python definition is exported based on conventions
 */
function isPythonExported(node: any, def: Def, pythonAllList: Set<string> | null): boolean {
  const name = def.name;
  
  // Check if the definition is at root level by looking at the scope depth
  // A root-level definition should have no parent function/class definitions
  let parent = node.parent;
  let isNested = false;
  
  while (parent && parent.type !== 'module') {
    if (parent.type === 'function_definition' || parent.type === 'class_definition') {
      // Check if this is the definition node itself
      if (parent === node.parent) {
        // This is the immediate parent, check its parent
        const grandparent = parent.parent;
        if (grandparent && grandparent.type !== 'module') {
          isNested = true;
          break;
        }
      } else {
        // This is a containing function/class
        isNested = true;
        break;
      }
    }
    parent = parent.parent;
  }
  
  if (isNested) {
    return false;
  }
  
  // If __all__ is defined, only names in it are exported
  if (pythonAllList !== null) {
    return pythonAllList.has(name);
  }
  
  // Otherwise, follow Python conventions:
  // Names starting with _ are private (except __special__)
  if (name.startsWith('_') && !name.startsWith('__')) {
    return false;
  }
  
  return true;
}

/**
 * Check if a Rust definition has pub keyword
 */
function isRustPublic(node: any): boolean {
  // For Rust, the pub keyword should be captured in the scope query
  // This is a fallback for cases not covered by scope queries
  let parent = node.parent;
  if (parent) {
    // Look for visibility_modifier among previous siblings
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

