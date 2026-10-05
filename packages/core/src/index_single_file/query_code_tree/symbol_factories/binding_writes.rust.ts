/**
 * The values written into a Rust `let`: its initialiser, or — for one declared
 * without a value (`let this; … this = Foo::new();`) — the right-hand side of
 * every plain assignment to it, and back from such an assignment to the `let`
 * it writes.
 *
 * A `let` is visible from its declaration to the end of its block, until a
 * later `let` of the same name shadows it, so the writes are searched in that
 * stretch only. An assignment from inside a closure runs whenever the closure
 * is called and reads the closure's own bindings, so a closure that writes the
 * binding makes it hold nothing this can state; so does a compound assignment.
 * Nested items cannot capture a local at all and are never searched.
 */

import type { SyntaxNode } from "tree-sitter";

const ITEM_TYPES: ReadonlySet<string> = new Set([
  "function_item",
  "impl_item",
  "trait_item",
  "mod_item",
  "struct_item",
  "enum_item",
  "const_item",
  "static_item",
  "macro_definition",
]);

/**
 * The value nodes written into the `let` `node` declares or names, in source
 * order: one for an initialiser, one per plain assignment for a `let` declared
 * without one, and none where any write cannot be read.
 */
export function written_values(node: SyntaxNode): readonly SyntaxNode[] {
  const declaration = node.type === "identifier" ? node.parent : node;
  if (declaration?.type !== "let_declaration") {
    return [];
  }
  const initialiser = declaration.childForFieldName("value");
  if (initialiser) {
    return [initialiser];
  }
  const pattern = declaration.childForFieldName("pattern");
  const block = declaration.parent;
  if (pattern?.type !== "identifier" || !block) {
    return [];
  }

  const name = pattern.text;
  const values: SyntaxNode[] = [];
  let readable = true;

  const visit = (nodes: readonly SyntaxNode[], in_closure: boolean): void => {
    for (const child of nodes) {
      if (!readable || (child.type === "let_declaration" && binds_name(child.childForFieldName("pattern"), name))) {
        return;
      }
      if (ITEM_TYPES.has(child.type) || rebinds(child, name)) {
        continue;
      }
      const left = child.childForFieldName("left");
      const writes = left?.type === "identifier" && left.text === name;
      if (writes && (child.type === "compound_assignment_expr" || in_closure)) {
        readable = false;
        return;
      }
      const right = writes && child.type === "assignment_expression" ? child.childForFieldName("right") : null;
      if (right) {
        values.push(right);
      }
      visit(child.namedChildren, in_closure || child.type === "closure_expression");
    }
  };

  const following = block.namedChildren.slice(block.namedChildren.findIndex((child) => child.id === declaration.id) + 1);
  for (const statement of following) {
    if (statement.type === "let_declaration" && binds_name(statement.childForFieldName("pattern"), name)) {
      break;
    }
    if (ITEM_TYPES.has(statement.type)) {
      continue;
    }
    visit([statement], false);
  }

  return readable ? values : [];
}

/**
 * The name node of the `let` a plain assignment's `left` identifier writes, or
 * null where the nearest binding of that name is not a `let` in a block this
 * assignment reaches without crossing a closure or an item.
 */
export function declaration_written_by(left: SyntaxNode): SyntaxNode | null {
  const name = left.text;
  let child: SyntaxNode = left;
  for (let parent = left.parent; parent; child = parent, parent = parent.parent) {
    if (parent.type === "closure_expression" || ITEM_TYPES.has(parent.type) || rebinds(parent, name)) {
      return null;
    }
    if (parent.type !== "block") {
      continue;
    }
    const preceding = parent.namedChildren.slice(0, parent.namedChildren.findIndex((statement) => statement.id === child.id));
    for (const statement of preceding.reverse()) {
      if (statement.type === "let_declaration" && binds_name(statement.childForFieldName("pattern"), name)) {
        const pattern = statement.childForFieldName("pattern");
        return pattern?.type === "identifier" ? pattern : null;
      }
    }
  }
  return null;
}

/** Whether `node` binds `name` for everything inside it: a closure's parameters, a loop's, a match arm's or an `if let`'s pattern. */
function rebinds(node: SyntaxNode, name: string): boolean {
  switch (node.type) {
    case "closure_expression":
      return binds_name(node.childForFieldName("parameters"), name);
    case "for_expression":
    case "match_arm":
      return binds_name(node.childForFieldName("pattern"), name);
    case "if_expression":
    case "while_expression": {
      const condition = node.childForFieldName("condition");
      return condition?.type === "let_condition" && binds_name(condition.childForFieldName("pattern"), name);
    }
    default:
      return false;
  }
}

/** Whether a pattern binds `name` anywhere in it. A path segment (`Some`, `Foo::Bar`) names a variant, never a binding. */
function binds_name(pattern: SyntaxNode | null, name: string): boolean {
  if (!pattern) {
    return false;
  }
  if (pattern.type === "identifier") {
    return pattern.text === name;
  }
  if (pattern.type === "scoped_identifier" || pattern.type === "type_identifier") {
    return false;
  }
  return pattern.namedChildren.some((child, index) =>
    // A tuple-struct pattern's first child is its path.
    pattern.type === "tuple_struct_pattern" && index === 0 ? false : binds_name(child, name)
  );
}
