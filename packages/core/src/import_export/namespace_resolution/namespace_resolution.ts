/**
 * Generic namespace resolution processor
 *
 * Configuration-driven namespace resolution that handles ~80% of namespace
 * resolution logic across all languages using language configurations.
 */

import {
  FileAnalysis,
  FilePath,
  NamespaceInfo,
  NamespaceExportInfo,
  ResolvedNamespaceType,
  Location,
  ModuleGraph,
  SymbolId,
  function_symbol,
  class_symbol,
  TypeIndex,
  TypeFlow,
} from "@ariadnejs/types";
import Parser from "tree-sitter";
import { find_member_access_expressions } from "../../ast/member_access";


/**
 * Resolve namespaces across files
 */
export async function resolve_namespaces_across_files(
  analyses: FileAnalysis[],
  module_graph: ModuleGraph,
  type_registry: TypeIndex,
  propagated_types: TypeFlow[],
  file_name_to_tree: Map<FilePath, Parser.Tree>
): Promise<Map<FilePath, NamespaceInfo>> {
  const namespace_map = new Map<FilePath, NamespaceInfo>();
  const resolved_members = new Map<Location, ResolvedNamespaceType>();

  // Build namespace import map from all files
  for (const analysis of analyses) {
    for (const import_stmt of analysis.imports) {
      // Check if this is a namespace import
      if (import_stmt.kind === "namespace") {
        const namespace_key = `${analysis.file_path}:${import_stmt.namespace_name}`;

        const source_module_path = import_stmt.source;

        if (source_module_path) {
          // TODO: file path needs to be converted to module path. But is this language-specific?
          // -- we'd like the ModulePath to be 
          const source_analysis = analyses.find(
            (a) => a.file_path === source_module_path
          );
          if (source_analysis) {
            const namespace_exports =
              collect_namespace_exports(source_analysis);

            namespace_map.set(namespace_key, {
              name: import_stmt.namespace_name,
              source: import_stmt.source,
              source_path: source_module_path,
              exports: namespace_exports,
              location: import_stmt.location,
              file_path: analysis.file_path,
            });
          }
        }
      }
    }
  }

  // Resolve namespace member accesses
  for (const analysis of analyses) {
    // Get the AST for this file
    const tree = file_name_to_tree.get(analysis.file_path);
    if (!tree) continue;

    // Find member access expressions in the AST
    const member_accesses = find_member_access_expressions(
      analysis,
      tree.rootNode
    );

    for (const access of member_accesses) {
      const namespace_key = `${analysis.file_path}:${access.namespace}`;
      const namespace_info = namespace_map.get(namespace_key);

      if (namespace_info) {
        const resolved_member = namespace_info.exports.get(access.member);
        if (resolved_member) {
          resolved_members.set(access.location, {
            name: access.member,
            qualified_name: `${access.namespace}.${access.member}`,
            source_module: namespace_info.source_path,
            kind: resolved_member.kind,
            location: resolved_member.location,
          });
        }
      }
    }
  }

  // Note: Type registry is now immutable, namespace-qualified types
  // should be handled during the registry build phase if needed

  return namespace_map;
}

/**
 * Collect namespace exports from a file analysis
 */
export function collect_namespace_exports(
  analysis: FileAnalysis
): Map<SymbolId, NamespaceExportInfo> {
  const exports = new Map<SymbolId, NamespaceExportInfo>();

  // Collect named exports
  for (const export_stmt of analysis.exports) {
    if (export_stmt.kind === "named") {
      const export_symbol = export_stmt.symbol;
      exports.set(export_symbol, {
        name: export_stmt.symbol_name,
        kind: "export",
        location: export_stmt.location,
      });
    }
  }

  // Collect exported functions
  for (const func of analysis.functions) {
    const func_symbol = function_symbol(func.name, func.location);
    exports.set(func_symbol, {
      name: func.name,
      kind: "function",
      location: func.location,
    });
  }

  // Collect exported classes
  for (const cls of analysis.classes) {
    const class_symbol_id = class_symbol(
      cls.symbol,
      analysis.file_path,
      cls.location
    );
    exports.set(class_symbol_id, {
      name: cls.symbol,
      kind: "class",
      location: cls.location,
    });
  }

  return exports;
}
