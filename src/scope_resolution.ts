import { Tree, Query } from "tree-sitter";
import { ScopeGraph, Def, Scope, Ref, Import } from "./graph";
import { LanguageConfig } from "./types";

/**
 * The equivalent of `scope_res_generic`.
 * Takes a tree-sitter AST, a query string, and source code and builds a ScopeGraph for a single file.
 */
export function build_scope_graph(
  tree: Tree,
  config: LanguageConfig
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
        }

        // Try to find the module path from the import statement
        let current = node.parent;
        while (current && current.type !== "import_statement") {
          current = current.parent;
        }
        if (current && current.type === "import_statement") {
          // Find the string node (module path)
          for (let i = 0; i < current.childCount; i++) {
            const child = current.child(i);
            if (child && child.type === "string") {
              // Remove quotes from the string
              module_path = child.text.slice(1, -1);
              break;
            }
          }
        }

        import_captures.push({ node, source_name, module: module_path });
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

    if (!symbol_id) {
      // Some definitions like type parameters don't have a specific symbol kind
      // Still create the definition with 'none' as the kind
      const new_def: Def = {
        id: graph.get_next_node_id(),
        kind: "definition",
        name: node.text,
        symbol_kind: "none",
        range: graph.node_to_simple_range(node),
      };

      if (scoping === "local") {
        graph.insert_local_def(new_def);
      } else if (scoping === "hoist") {
        graph.insert_hoisted_def(new_def);
      } else if (scoping === "global") {
        graph.insert_global_def(new_def);
      }
      continue;
    }

    const new_def: Def = {
      id: graph.get_next_node_id(),
      kind: "definition",
      name: node.text,
      symbol_kind: kind,
      range: graph.node_to_simple_range(node),
    };

    if (scoping === "local") {
      graph.insert_local_def(new_def);
    } else if (scoping === "hoist") {
      graph.insert_hoisted_def(new_def);
    } else if (scoping === "global") {
      graph.insert_global_def(new_def);
    }
  }

  // 3. Process imports
  for (const { node, source_name, module } of import_captures) {
    const new_import: Import = {
      id: graph.get_next_node_id(),
      kind: "import",
      name: node.text,
      source_name: source_name,
      source_module: module,
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
