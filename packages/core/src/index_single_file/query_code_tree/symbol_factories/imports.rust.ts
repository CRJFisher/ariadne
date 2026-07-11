import type { SyntaxNode } from "tree-sitter";
import type { SymbolName, ModulePath } from "@ariadnejs/types";
import { create_module_path, create_symbol_name } from "@ariadnejs/types";

export interface ImportInfo {
  name: SymbolName;
  module_path?: ModulePath;
  original_name?: SymbolName;
  is_wildcard?: boolean;
}

// Rebuilds "std::fmt::Display" from the nested scoped_identifier tree, whose
// `path` field points at the next segment inward until a non-scoped base node.
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
        parts.unshift(path.text);
        break;
      }
    } else {
      break;
    }
  }

  return parts.join("::");
}

// Normalizes every `use` form so `module_path` names the module and `name` the
// imported item — the item, glob, alias, and group braces are stripped here, which
// is the shape the downstream Rust import resolver relies on. A leading `pub`
// visibility_modifier is ignored: re-export visibility is handled by the caller.
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

  switch (argument.type) {
    case "identifier": {
      // use foo
      const name = argument.text as SymbolName;
      imports.push({
        name,
        module_path: create_module_path(name),
      });
      break;
    }

    case "scoped_identifier": {
      // use std::fmt::Display — module_path is the path minus the item name
      const name = argument.childForFieldName?.("name");
      const path_node = argument.childForFieldName?.("path");
      if (name && path_node) {
        const module_path = path_node.type === "scoped_identifier"
          ? extract_scoped_path(path_node)
          : path_node.text;
        imports.push({
          name: name.text as SymbolName,
          module_path: create_module_path(module_path),
        });
      }
      break;
    }

    case "use_list": {
      // use {Display, Debug} — a group with no path prefix
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
      // use std::fmt::{Display, Debug} and nested groups like
      // use std::{cmp::Ordering, collections::{HashMap, HashSet}}
      const path = argument.childForFieldName?.("path");
      const list = argument.childForFieldName?.("list");

      if (path && list) {
        const base_path = path.type === "scoped_identifier"
          ? extract_scoped_path(path)
          : path.text;

        const process_use_list_items = (list_node: SyntaxNode, prefix: string) => {
          for (let i = 0; i < list_node.childCount; i++) {
            const item = list_node.child(i);
            if (!item) continue;

            if (item.type === "identifier") {
              imports.push({
                name: item.text as SymbolName,
                module_path: create_module_path(prefix),
              });
            } else if (item.type === "scoped_identifier") {
              const name = item.childForFieldName?.("name");
              const item_path_node = item.childForFieldName?.("path");
              if (name) {
                // For `use std::{cmp::Ordering}`, module_path = "std::cmp", name = "Ordering"
                const module_path = item_path_node
                  ? `${prefix}::${item_path_node.type === "scoped_identifier" ? extract_scoped_path(item_path_node) : item_path_node.text}`
                  : prefix;
                imports.push({
                  name: name.text as SymbolName,
                  module_path: create_module_path(module_path),
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
                if (original.type === "scoped_identifier") {
                  // e.g., `use std::{cmp::Ordering as Ord}` — original is cmp::Ordering
                  const original_name_node = original.childForFieldName?.("name");
                  const original_path_node = original.childForFieldName?.("path");
                  const module_path = original_path_node
                    ? `${prefix}::${original_path_node.type === "scoped_identifier" ? extract_scoped_path(original_path_node) : original_path_node.text}`
                    : prefix;
                  imports.push({
                    name: alias.text as SymbolName,
                    module_path: create_module_path(module_path),
                    original_name: create_symbol_name(original_name_node?.text ?? original.text),
                  });
                } else {
                  // e.g., `use utils::{helper as h}` — original is identifier "helper"
                  imports.push({
                    name: alias.text as SymbolName,
                    module_path: create_module_path(prefix),
                    original_name: create_symbol_name(original.text),
                  });
                }
              }
            }
          }
        };

        process_use_list_items(list, base_path);
      }
      break;
    }

    case "use_as_clause": {
      // use foo as bar, or use self::math::add as add_numbers
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
        if (original.type === "scoped_identifier") {
          // e.g., `use self::math::add as add_numbers`
          // module_path = "self::math", original_name = "add"
          const original_name_node = original.childForFieldName?.("name");
          const original_path_node = original.childForFieldName?.("path");
          const module_path = original_path_node
            ? (original_path_node.type === "scoped_identifier"
              ? extract_scoped_path(original_path_node)
              : original_path_node.text)
            : original.text;
          imports.push({
            name: alias.text as SymbolName,
            module_path: create_module_path(module_path),
            original_name: create_symbol_name(original_name_node?.text ?? original.text),
          });
        } else {
          // Simple: `use foo as bar`
          imports.push({
            name: alias.text as SymbolName,
            module_path: create_module_path(original.text),
            original_name: create_symbol_name(original.text),
          });
        }
      }
      break;
    }

    case "use_wildcard": {
      // use foo::*, and prefix keywords use crate::*, use super::*, use self::*,
      // where the segment before `*` is a bare `crate`/`super`/`self` node rather
      // than an identifier.
      const path = argument.children?.find(
        (c) =>
          c.type === "scoped_identifier" ||
          c.type === "identifier" ||
          c.type === "crate" ||
          c.type === "super" ||
          c.type === "self"
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

// Handles `extern crate foo;` and `extern crate foo as bar;`.
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
