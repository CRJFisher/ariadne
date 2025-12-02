/**
 * Rust Import Extraction
 *
 * Functions for extracting import information from Rust use declarations
 * and extern crate statements.
 */
import type { SyntaxNode } from "tree-sitter";
import type { SymbolName, ModulePath } from "@ariadnejs/types";
import { create_module_path, create_symbol_name } from "@ariadnejs/types";

export interface ImportInfo {
  name: SymbolName;
  module_path?: ModulePath;
  original_name?: SymbolName;
  is_wildcard?: boolean;
}

/**
 * Extract scoped path from scoped_identifier node
 * Traverses the tree to build full path like "std::fmt"
 */
function extract_scoped_path(node: SyntaxNode): string {
  const parts: string[] = [];
  let current: SyntaxNode | null = node;

  while (current && current.type === "scoped_identifier") {
    const name = current.childForFieldName?.("name");
    if (name) parts.unshift(name.text);

    const path = current.childForFieldName?.("path");
    if (path) {
      if (path.type === "scoped_identifier") {
        current = path;
      } else {
        // Base identifier
        parts.unshift(path.text);
        break;
      }
    } else {
      break;
    }
  }

  return parts.join("::");
}

/**
 * Extract imports from complete use_declaration node
 * Handles all use patterns: simple, scoped, aliased, lists, wildcards
 */
export function extract_imports_from_use_declaration(
  node: SyntaxNode
): ImportInfo[] {
  const imports: ImportInfo[] = [];

  if (node.type !== "use_declaration") {
    return imports;
  }

  const argument = node.childForFieldName?.("argument");
  if (!argument) {
    return imports;
  }

  // Handle different use patterns by argument type
  switch (argument.type) {
    case "identifier": {
      // Simple: use foo
      const name = argument.text as SymbolName;
      imports.push({
        name,
        module_path: create_module_path(name),
      });
      break;
    }

    case "scoped_identifier": {
      // Scoped: use std::fmt::Display
      const full_path = extract_scoped_path(argument);
      const name = argument.childForFieldName?.("name");
      if (name) {
        imports.push({
          name: name.text as SymbolName,
          module_path: create_module_path(full_path),
        });
      }
      break;
    }

    case "use_list": {
      // List: use {Display, Debug}
      for (let i = 0; i < argument.childCount; i++) {
        const item = argument.child(i);
        if (!item) continue;

        if (item.type === "identifier") {
          imports.push({
            name: item.text as SymbolName,
            module_path: create_module_path(item.text),
          });
        } else if (item.type === "use_as_clause") {
          const original = item.children?.find(
            (c) => c.type === "identifier" || c.type === "scoped_identifier"
          );
          const alias_parts = item.children || [];
          let alias: SyntaxNode | undefined;
          let found_as = false;
          for (const part of alias_parts) {
            if (part.text === "as") {
              found_as = true;
            } else if (found_as && part.type === "identifier") {
              alias = part;
              break;
            }
          }
          if (original && alias) {
            imports.push({
              name: alias.text as SymbolName,
              module_path: create_module_path(original.text),
              original_name: original.text as SymbolName,
            });
          }
        }
      }
      break;
    }

    case "scoped_use_list": {
      // List with path: use std::fmt::{Display, Debug}
      // Also handles nested lists: use std::{cmp::Ordering, collections::{HashMap, HashSet}}
      const path = argument.childForFieldName?.("path");
      const list = argument.childForFieldName?.("list");

      if (path && list) {
        const base_path = path.type === "scoped_identifier"
          ? extract_scoped_path(path)
          : path.text;

        // Process items in the list recursively
        const process_use_list_items = (list_node: SyntaxNode, prefix: string) => {
          for (let i = 0; i < list_node.childCount; i++) {
            const item = list_node.child(i);
            if (!item) continue;

            if (item.type === "identifier") {
              const full_path = `${prefix}::${item.text}`;
              imports.push({
                name: item.text as SymbolName,
                module_path: create_module_path(full_path),
              });
            } else if (item.type === "scoped_identifier") {
              const item_path = extract_scoped_path(item);
              const name = item.childForFieldName?.("name");
              if (name) {
                const full_path = `${prefix}::${item_path}`;
                imports.push({
                  name: name.text as SymbolName,
                  module_path: create_module_path(full_path),
                });
              }
            } else if (item.type === "scoped_use_list") {
              // Nested list: collections::{HashMap, HashSet}
              const nested_path = item.childForFieldName?.("path");
              const nested_list = item.childForFieldName?.("list");
              if (nested_path && nested_list) {
                const nested_prefix = nested_path.type === "scoped_identifier"
                  ? extract_scoped_path(nested_path)
                  : nested_path.text;
                const full_prefix = `${prefix}::${nested_prefix}`;
                process_use_list_items(nested_list, full_prefix);
              }
            } else if (item.type === "use_as_clause") {
              const original = item.children?.find(
                (c) => c.type === "identifier" || c.type === "scoped_identifier"
              );
              const alias_parts = item.children || [];
              let alias: SyntaxNode | undefined;
              let found_as = false;
              for (const part of alias_parts) {
                if (part.text === "as") {
                  found_as = true;
                } else if (found_as && part.type === "identifier") {
                  alias = part;
                  break;
                }
              }
              if (original && alias) {
                const original_path = original.type === "scoped_identifier"
                  ? extract_scoped_path(original)
                  : original.text;
                const full_path = `${prefix}::${original_path}`;
                imports.push({
                  name: alias.text as SymbolName,
                  module_path: create_module_path(full_path),
                  original_name: create_symbol_name(full_path),
                });
              }
            }
          }
        };

        process_use_list_items(list, base_path);
      }
      break;
    }

    case "use_as_clause": {
      // Alias: use foo as bar or use self::math::add as add_numbers
      const original = argument.children?.find(
        (c) => c.type === "identifier" || c.type === "scoped_identifier"
      );
      const alias_parts = argument.children || [];
      let alias: SyntaxNode | undefined;
      let found_as = false;
      for (const part of alias_parts) {
        if (part.text === "as") {
          found_as = true;
        } else if (found_as && part.type === "identifier") {
          alias = part;
          break;
        }
      }

      if (original && alias) {
        const module_path = original.type === "scoped_identifier"
          ? extract_scoped_path(original)
          : original.text;
        // For aliased imports, original_name should be the full path
        imports.push({
          name: alias.text as SymbolName,
          module_path: create_module_path(module_path),
          original_name: create_symbol_name(module_path),
        });
      }
      break;
    }

    case "use_wildcard": {
      // Wildcard: use foo::*
      const path = argument.children?.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier"
      );
      if (path) {
        const module_path = path.type === "scoped_identifier"
          ? extract_scoped_path(path)
          : path.text;
        imports.push({
          name: "*" as SymbolName,
          module_path: create_module_path(module_path),
          is_wildcard: true,
        });
      }
      break;
    }
  }

  return imports;
}

/**
 * Extract import from complete extern_crate_declaration node
 * Handles: extern crate foo; and extern crate foo as bar;
 */
export function extract_import_from_extern_crate(
  node: SyntaxNode
): ImportInfo | undefined {
  if (node.type !== "extern_crate_declaration") {
    return undefined;
  }

  const children = node.children || [];
  let crate_name: string | undefined;
  let alias: string | undefined;
  let found_as = false;

  for (const child of children) {
    if (child.type === "identifier") {
      if (!found_as && !crate_name) {
        crate_name = child.text;
      } else if (found_as) {
        alias = child.text;
        break;
      }
    } else if (child.text === "as") {
      found_as = true;
    }
  }

  if (!crate_name) {
    return undefined;
  }

  return {
    name: (alias || crate_name) as SymbolName,
    module_path: create_module_path(crate_name),
    original_name: alias ? (crate_name as SymbolName) : undefined,
  };
}
