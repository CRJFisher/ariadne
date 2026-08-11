/**
 * JavaScript/TypeScript export analysis.
 *
 * Extracts export metadata so definitions carry the correct `is_exported` flag.
 * A per-file cache turns the repeated per-symbol lookups (one for every
 * definition in the file) into O(1) map reads instead of re-walking the tree.
 */
import type { SyntaxNode } from "tree-sitter";
import type { SymbolName, ExportMetadata } from "@ariadnejs/types";

interface ExportCache {
  named_exports: Map<SymbolName, ExportMetadata>;
  commonjs_exports: Map<SymbolName, ExportMetadata>;
}

let export_cache: ExportCache | null = null;
let cached_root_id: number | null = null;

function build_export_cache(root: SyntaxNode): ExportCache {
  const named_exports = new Map<SymbolName, ExportMetadata>();
  const commonjs_exports = new Map<SymbolName, ExportMetadata>();

  // `module.exports = X` is a whole-module default export; a later reassignment
  // supersedes the earlier one (JS runtime semantics), so only the last-written
  // symbol keeps `is_default` — the ExportRegistry rejects two defaults per file.
  let default_export_name: SymbolName | null = null;
  const set_commonjs_default = (symbol_name: SymbolName): void => {
    if (default_export_name && default_export_name !== symbol_name) {
      commonjs_exports.delete(default_export_name);
    }
    default_export_name = symbol_name;
    commonjs_exports.set(symbol_name, { is_default: true });
  };

  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (!child) continue;

    // export { foo, bar as baz } and its re-export form export { ... } from '...'
    if (child.type === "export_statement") {
      const specifiers = find_export_specifiers(child);
      const is_reexport = child.children.some((c) => c.type === "from");

      for (const spec of specifiers) {
        const info = extract_export_specifier_info(spec);
        named_exports.set(info.name, {
          export_name: info.alias,
          is_reexport,
        });
      }
    }

    // CommonJS assignments: module.exports = { ... } and property-assignment
    // exports (exports.foo = local / module.exports.foo = local)
    if (child.type === "expression_statement") {
      const expr = child.child(0);
      if (expr?.type === "assignment_expression") {
        const left = expr.childForFieldName("left");
        const right = expr.childForFieldName("right");

        if (left?.type === "member_expression") {
          const object = left.childForFieldName("object");
          const property = left.childForFieldName("property");

          // Whole-module default export: `module.exports = Widget` (an already
          // declared class/function) or `module.exports = class Widget {}` (a
          // named class expression). The single exported value is the file's
          // default export.
          if (object?.text === "module" && property?.text === "exports") {
            if (right?.type === "identifier") {
              set_commonjs_default(right.text as SymbolName);
            } else if (right?.type === "class") {
              const class_name = right.childForFieldName("name");
              if (class_name) {
                set_commonjs_default(class_name.text as SymbolName);
              }
            }
          }

          if (object?.text === "module" && property?.text === "exports" && right?.type === "object") {
            for (let j = 0; j < right.childCount; j++) {
              const prop = right.child(j);

              if (prop?.type === "shorthand_property_identifier") {
                commonjs_exports.set(prop.text as SymbolName, {});
              }

              if (prop?.type === "pair") {
                const key = prop.childForFieldName("key");
                const value = prop.childForFieldName("value");

                if (value?.type === "identifier") {
                  const symbol_name = value.text as SymbolName;
                  const export_name =
                    key?.type === "property_identifier" || key?.type === "identifier"
                      ? (key.text as SymbolName)
                      : undefined;

                  commonjs_exports.set(
                    symbol_name,
                    export_name && export_name !== symbol_name ? { export_name } : {}
                  );
                }
              }
            }
          }

          // Property-assignment CommonJS export: exports.NAME = <rhs> or
          // module.exports.NAME = <rhs>. The cache is keyed by the name of the
          // definition the @definition capture already produced, so the export
          // property can point at it. Three RHS shapes carry such a name:
          //   exports.foo = local            -> key "local" (the identifier)
          //   exports.foo = function foo(){}  -> key "foo"  (the fn-expr name)
          //   exports.X   = class X {}        -> key "X"    (the class-expr name)
          // An anonymous function/arrow/class RHS has no name here; an anonymous
          // function or arrow becomes an exported definition through the
          // dedicated CommonJS-export-function capture rather than this cache,
          // and an anonymous class stays out of reach. The top-level walk
          // excludes assignments inside function bodies; computed keys
          // (exports["foo"]) parse as subscript_expression and never enter this
          // member_expression branch.
          if (
            property?.type === "property_identifier" &&
            is_commonjs_exports_base(object)
          ) {
            const export_name = property.text as SymbolName;
            let symbol_name: SymbolName | undefined;
            if (right?.type === "identifier") {
              symbol_name = right.text as SymbolName;
            } else if (right?.type === "function_expression") {
              const fn_name = right.childForFieldName("name");
              if (fn_name) {
                symbol_name = fn_name.text as SymbolName;
              }
            } else if (right?.type === "class") {
              // A named class expression export (`exports.X = class X {}`) is
              // keyed by the class's own name — the name the class definition
              // carries — so its `export_name` metadata attaches to that symbol.
              const class_name = right.childForFieldName("name");
              if (class_name) {
                symbol_name = class_name.text as SymbolName;
              }
            }
            if (symbol_name) {
              commonjs_exports.set(
                symbol_name,
                export_name !== symbol_name ? { export_name } : {}
              );
            }
          }
        }
      }
    }
  }

  return { named_exports, commonjs_exports };
}

/**
 * The CommonJS exports bag appears as an assignment base in two spellings: the
 * bare `exports` identifier and the `module.exports` member expression. Deeper
 * chains (`module.exports.foo`) and unrelated objects fail the check, so
 * assignments onto them never register as exports.
 */
function is_commonjs_exports_base(node: SyntaxNode | null): boolean {
  if (!node) return false;
  if (node.type === "identifier") return node.text === "exports";
  if (node.type === "member_expression") {
    const object = node.childForFieldName("object");
    const property = node.childForFieldName("property");
    return (
      object?.type === "identifier" &&
      object.text === "module" &&
      property?.text === "exports"
    );
  }
  return false;
}

function get_export_cache(root: SyntaxNode): ExportCache {
  if (export_cache && cached_root_id === root.id) {
    return export_cache;
  }

  export_cache = build_export_cache(root);
  cached_root_id = root.id;
  return export_cache;
}

/**
 * Collect the export_specifier nodes from `export { foo, bar as baz }`.
 * export_clause is a plain child rather than a named field, so it is located
 * by iterating children instead of via childForFieldName.
 */
function find_export_specifiers(export_node: SyntaxNode): SyntaxNode[] {
  const specifiers: SyntaxNode[] = [];

  for (const child of export_node.children) {
    if (child.type === "export_clause") {
      for (const clause_child of child.children) {
        if (clause_child.type === "export_specifier") {
          specifiers.push(clause_child);
        }
      }
      break;
    }
  }

  return specifiers;
}

/**
 * Split an export_specifier into original name and optional alias.
 * `foo as bar` yields { name: "foo", alias: "bar" }; `foo` yields
 * { name: "foo", alias: undefined }. The specifier's identifier children are
 * ordered [original, alias?], so the first is the name and the second the alias.
 */
function extract_export_specifier_info(specifier_node: SyntaxNode): {
  name: SymbolName;
  alias?: SymbolName;
} {
  const identifiers: SyntaxNode[] = [];
  for (const child of specifier_node.children) {
    if (child.type === "identifier") {
      identifiers.push(child);
    }
  }

  if (identifiers.length === 0) {
    return { name: "unknown" as SymbolName };
  }

  const name = identifiers[0].text as SymbolName;
  const alias =
    identifiers.length > 1 ? (identifiers[1].text as SymbolName) : undefined;

  return { name, alias };
}

function has_from_clause(export_node: SyntaxNode): boolean {
  return export_node.children.some((child) => child.type === "from");
}

function has_default_keyword(export_node: SyntaxNode): boolean {
  return export_node.children.some((child) => child.type === "default");
}

/**
 * Extract export metadata that an export_statement contributes to `symbol_name`.
 * Returns undefined when the statement is a plain direct export (`export function
 * foo`) with no alias, default, or re-export marker, or when the symbol is absent
 * from an export/re-export list.
 */
export function analyze_export_statement(
  export_node: SyntaxNode,
  symbol_name?: SymbolName
): ExportMetadata | undefined {
  if (has_default_keyword(export_node)) {
    return { is_default: true };
  }

  const is_reexport = has_from_clause(export_node);
  if (is_reexport) {
    if (symbol_name) {
      const specifiers = find_export_specifiers(export_node);
      for (const spec of specifiers) {
        const info = extract_export_specifier_info(spec);
        if (info.name === symbol_name) {
          return {
            is_reexport: true,
            export_name: info.alias,
          };
        }
      }
      return undefined;
    }
    return { is_reexport: true };
  }

  const specifiers = find_export_specifiers(export_node);
  if (specifiers.length > 0 && symbol_name) {
    for (const spec of specifiers) {
      const info = extract_export_specifier_info(spec);
      if (info.name === symbol_name) {
        return info.alias ? { export_name: info.alias } : undefined;
      }
    }
    return undefined;
  }

  return undefined;
}

/**
 * Determine whether a definition node is exported and gather its export metadata.
 *
 * Covers direct exports (`export function foo`), export/re-export lists
 * (`export { foo, bar as baz }`, `export { x } from './y'`), default exports,
 * and CommonJS assignments — whole-object (`module.exports = { ... }`) and
 * property (`exports.foo = local`, `module.exports.foo = local`).
 */
export function extract_export_info(
  node: SyntaxNode,
  symbol_name?: SymbolName
): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  let current: SyntaxNode | null = node;
  let crossed_block = false;

  while (current) {
    const parent: SyntaxNode | null = current.parent;

    if (parent?.type === "export_statement") {
      const export_metadata = analyze_export_statement(parent, symbol_name);
      return {
        is_exported: true,
        export: export_metadata,
      };
    }

    // A binding that lives inside a function body is never a module export,
    // whatever a same-named module-scope binding did — so return before the
    // name-keyed caches below, which hold module-scope facts only.
    const is_inside_function_body =
      current.type === "statement_block" &&
      parent &&
      (parent.type === "function_declaration" ||
        parent.type === "function_expression" ||
        parent.type === "arrow_function" ||
        parent.type === "method_definition" ||
        parent.type === "generator_function_declaration" ||
        parent.type === "generator_function");

    if (is_inside_function_body) {
      return { is_exported: false };
    }

    if (BLOCK_SCOPE_NODES.has(current.type)) {
      crossed_block = true;
    }

    current = parent;
  }

  // A block-scoped binding declared inside any block never reaches module
  // scope; only hoisted bindings (`var`, function declarations) may consult
  // the module-scope caches from inside a block.
  if (crossed_block && !is_hoisted_binding(node)) {
    return { is_exported: false };
  }

  if (symbol_name) {
    const root = get_root_node(node);
    const cache = get_export_cache(root);

    const named_export = cache.named_exports.get(symbol_name);
    if (named_export) {
      return {
        is_exported: true,
        export: named_export,
      };
    }

    const commonjs_export = cache.commonjs_exports.get(symbol_name);
    if (commonjs_export) {
      return {
        is_exported: true,
        export: commonjs_export,
      };
    }
  }

  return { is_exported: false };
}

/**
 * Nodes that open a block scope a lexical binding cannot escape. A loop
 * statement counts because its head declares into the loop's own scope
 * (`for (let x = 0; ...)`), and a switch body because its cases share one
 * block.
 */
const BLOCK_SCOPE_NODES = new Set([
  "statement_block",
  "switch_body",
  "for_statement",
  "for_in_statement",
]);

/**
 * Whether the binding a name node declares hoists to the enclosing function or
 * module scope. `var` declarators and function declarations hoist; lexical
 * bindings (`let`/`const`), class declarations, catch parameters, and function
 * expression names are confined to their enclosing block.
 */
function is_hoisted_binding(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (
    parent?.type === "function_declaration" ||
    parent?.type === "generator_function_declaration"
  ) {
    return true;
  }
  if (parent?.type === "variable_declarator") {
    return parent.parent?.type === "variable_declaration";
  }
  return false;
}

function get_root_node(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (current.parent) {
    current = current.parent;
  }
  return current;
}
