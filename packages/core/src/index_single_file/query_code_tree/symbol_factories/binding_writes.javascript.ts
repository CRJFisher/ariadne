/**
 * The values written into a JavaScript/TypeScript declarator: its initialiser,
 * or — for one declared without a value (`var self; … self = this;`) — the
 * right-hand side of every plain assignment to it.
 *
 * An assignment counts only where it runs in the declaring function, because
 * the sources recorded from a value are resolved in the declaration's scope: a
 * nested function's `this` or its locals are not the declaring function's. A
 * write whose value cannot be read that way — from a nested function, a
 * compound assignment, an increment, a `for…in`/`for…of` target — means the
 * binding holds nothing this can state, so the answer is no values at all
 * rather than the ones that happened to be readable.
 */

import type { SyntaxNode } from "tree-sitter";

const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  "function_declaration",
  "function_expression",
  "function",
  "generator_function",
  "generator_function_declaration",
  "arrow_function",
  "method_definition",
  "class_static_block",
]);

const BLOCK_TYPES: ReadonlySet<string> = new Set(["statement_block", "switch_body", "class_body"]);

/**
 * The value nodes written into the declarator `node` names, in source order:
 * one for an initialiser, one per plain assignment for a binding declared
 * without one, and none where any write cannot be read.
 */
export function written_values(node: SyntaxNode): readonly SyntaxNode[] {
  const declarator = node.type === "identifier" ? node.parent : node;
  if (declarator?.type !== "variable_declarator") {
    return [];
  }
  const initialiser = declarator.childForFieldName("value");
  if (initialiser) {
    return [initialiser];
  }
  const name_node = declarator.childForFieldName("name");
  const declaration = declarator.parent;
  if (name_node?.type !== "identifier" || !declaration) {
    return [];
  }
  // `var` belongs to its whole function; `let` to the block it is written in.
  const region = declaration.type === "variable_declaration" ? function_region(declaration) : declaration.parent;
  return region ? assignments_in(region, name_node.text, declaration) : [];
}

function function_region(node: SyntaxNode): SyntaxNode | null {
  for (let current = node.parent; current; current = current.parent) {
    if (FUNCTION_TYPES.has(current.type)) {
      return current.childForFieldName("body");
    }
    if (current.type === "program") {
      return current;
    }
  }
  return null;
}

function assignments_in(region: SyntaxNode, name: string, declaration: SyntaxNode): readonly SyntaxNode[] {
  const values: SyntaxNode[] = [];
  let readable = true;

  const visit = (node: SyntaxNode, in_nested_function: boolean): void => {
    for (const child of node.namedChildren) {
      if (!readable) {
        return;
      }
      if (rebinds(child, name, declaration)) {
        continue;
      }
      const write = write_to(child, name);
      if (write === "unreadable" || (write && in_nested_function)) {
        readable = false;
        return;
      }
      if (write) {
        values.push(write);
      }
      visit(child, in_nested_function || FUNCTION_TYPES.has(child.type));
    }
  };
  visit(region, false);

  return readable ? values : [];
}

/** The value `node` writes into `name`, "unreadable" for a write whose value is not one expression, or null. */
function write_to(node: SyntaxNode, name: string): SyntaxNode | "unreadable" | null {
  switch (node.type) {
    case "assignment_expression":
      return names(node.childForFieldName("left"), name) ? node.childForFieldName("right") : null;
    case "augmented_assignment_expression":
      return names(node.childForFieldName("left"), name) ? "unreadable" : null;
    case "update_expression":
      return names(node.childForFieldName("argument"), name) ? "unreadable" : null;
    case "for_in_statement":
      return node.childForFieldName("kind") === null && names(node.childForFieldName("left"), name)
        ? "unreadable"
        : null;
    default:
      return null;
  }
}

function names(node: SyntaxNode | null, name: string): boolean {
  return node?.type === "identifier" && node.text === name;
}

/**
 * Whether `node` opens a scope binding `name` again, so a write inside it
 * writes that binding rather than the declaration being read. A `let` shadows
 * its whole block, since a write ahead of it in the block is in its temporal
 * dead zone.
 */
function rebinds(node: SyntaxNode, name: string, declaration: SyntaxNode): boolean {
  if (FUNCTION_TYPES.has(node.type)) {
    const own_name = node.type === "function_expression" || node.type === "function" ? node.childForFieldName("name") : null;
    const parameters = node.childForFieldName("parameters") ?? node.childForFieldName("parameter");
    return names(own_name, name) || (parameters !== null && binds_name(parameters, name)) || declares_var(node, name);
  }
  if (BLOCK_TYPES.has(node.type)) {
    return node.namedChildren.some((statement) => statement.id !== declaration.id && declares(statement, name));
  }
  if (node.type === "for_statement") {
    const head = node.childForFieldName("initializer");
    return head !== null && head.id !== declaration.id && declares(head, name);
  }
  // `for (let p of xs)` keeps its declaration keyword in `kind` and the bound
  // pattern in `left`.
  if (node.type === "for_in_statement") {
    return node.childForFieldName("kind") !== null && binds_name(node.childForFieldName("left"), name);
  }
  if (node.type === "catch_clause") {
    const parameter = node.childForFieldName("parameter");
    return parameter !== null && binds_name(parameter, name);
  }
  return false;
}

/** Whether statement `node` declares `name` in the scope it sits in. */
function declares(node: SyntaxNode, name: string): boolean {
  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    return node.namedChildren.some(
      (declarator) => declarator.type === "variable_declarator" && binds_name(declarator.childForFieldName("name"), name)
    );
  }
  if (node.type === "function_declaration" || node.type === "class_declaration") {
    return names(node.childForFieldName("name"), name);
  }
  return false;
}

/** Whether a function declares `name` with `var` anywhere in its own body, which hoists it over the whole function. */
function declares_var(function_node: SyntaxNode, name: string): boolean {
  const body = function_node.childForFieldName("body");
  const search = (node: SyntaxNode): boolean =>
    node.namedChildren.some(
      (child) =>
        !FUNCTION_TYPES.has(child.type) &&
        ((child.type === "variable_declaration" && declares(child, name)) || search(child))
    );
  return body !== null && search(body);
}

/** Whether a binding pattern — a name, a destructuring, a parameter list — binds `name`. */
function binds_name(pattern: SyntaxNode | null, name: string): boolean {
  if (!pattern) {
    return false;
  }
  switch (pattern.type) {
    case "type_annotation":
      return false;
    case "identifier":
    case "shorthand_property_identifier_pattern":
      return pattern.text === name;
    // A default value or a key is an expression, not a binding; only the bound
    // side is searched.
    case "assignment_pattern":
    case "object_assignment_pattern":
      return binds_name(pattern.childForFieldName("left"), name);
    case "pair_pattern":
      return binds_name(pattern.childForFieldName("value"), name);
    case "required_parameter":
    case "optional_parameter":
      return binds_name(pattern.childForFieldName("pattern"), name);
    default:
      return pattern.namedChildren.some((child) => binds_name(child, name));
  }
}
