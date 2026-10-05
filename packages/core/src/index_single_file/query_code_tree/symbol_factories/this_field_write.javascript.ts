/**
 * Which class field a `this.<name> = …` write addresses.
 *
 * A class declares a field in its body (`x = 1`, `#x;`, TypeScript's `x: T`), or
 * — in JavaScript, where the body declares nothing by that name — by assigning
 * it in the constructor. Both the construction target of the written value and
 * the field a constructor assignment introduces are read from this one answer,
 * so the location a construction is keyed to is the location of the field
 * definition that holds it.
 */

import type { SyntaxNode } from "tree-sitter";

/** A `this.<name>` write whose `this` is an instance of the enclosing class. */
export interface ThisFieldWrite {
  /** The `<name>` node of `this.<name>`. */
  readonly property: SyntaxNode;
  /** The member the class body declares under `<name>`, if any. */
  readonly declared_member: SyntaxNode | undefined;
  /** Whether the write sits in the class's constructor. */
  readonly in_constructor: boolean;
}

/** Functions that bind their own `this`; an arrow function keeps the enclosing one. */
const OWN_THIS_FUNCTIONS = new Set([
  "function_declaration",
  "function_expression",
  "generator_function_declaration",
  "generator_function",
]);

const FIELD_DECLARATIONS = new Set([
  "field_definition",
  "public_field_definition",
  "required_parameter",
  "optional_parameter",
]);

/** The modifiers that make a TypeScript constructor parameter a field as well. */
const PARAMETER_PROPERTY_MODIFIERS = new Set(["accessibility_modifier", "readonly"]);

/**
 * Read `target` — an assignment's left side — as a write to a field of the
 * enclosing class, or undefined when it is not `this.<static name>` or its
 * `this` is not the class instance (a plain function's own `this`).
 */
export function resolve_this_field_write(target: SyntaxNode): ThisFieldWrite | undefined {
  if (target.type !== "member_expression" || target.childForFieldName("object")?.type !== "this") {
    return undefined;
  }
  const property = target.childForFieldName("property");
  if (property?.type !== "property_identifier" && property?.type !== "private_property_identifier") {
    return undefined;
  }

  let in_constructor = false;
  for (let node = target.parent; node; node = node.parent) {
    if (OWN_THIS_FUNCTIONS.has(node.type)) {
      return undefined;
    }
    if (node.type === "method_definition") {
      // An object-literal method binds `this` to its object, not to a class.
      if (node.parent?.type !== "class_body") {
        return undefined;
      }
      in_constructor = node.childForFieldName("name")?.text === "constructor";
    }
    if (node.type === "class_body") {
      return {
        property,
        declared_member: find_declared_member(node, property.text),
        in_constructor,
      };
    }
  }
  return undefined;
}

/**
 * The name node of the field `write` lands in when the class body declares it,
 * the written property itself when the body declares nothing by that name, and
 * null when the name belongs to a method or accessor — a write to an accessor
 * runs the setter and stores nothing a construction could type.
 */
export function written_field_name(write: ThisFieldWrite): SyntaxNode | null {
  if (!write.declared_member) {
    return write.property;
  }
  return FIELD_DECLARATIONS.has(write.declared_member.type)
    ? declared_name(write.declared_member)
    : null;
}

/**
 * Every name a class declares, mapped to the member declaring it first: a body
 * member, or a TypeScript constructor parameter property (`constructor(private
 * x: T)`), which declares its field from inside the constructor's parameter list.
 *
 * Built once per class body and held weakly with its tree: every `this.<name>`
 * write in the class asks, so a scan per write would cost members × writes.
 */
const DECLARED_MEMBERS_BY_CLASS_BODY = new WeakMap<SyntaxNode, ReadonlyMap<string, SyntaxNode>>();

function find_declared_member(class_body: SyntaxNode, name: string): SyntaxNode | undefined {
  let declared = DECLARED_MEMBERS_BY_CLASS_BODY.get(class_body);
  if (!declared) {
    declared = collect_declared_members(class_body);
    DECLARED_MEMBERS_BY_CLASS_BODY.set(class_body, declared);
  }
  return declared.get(name);
}

function collect_declared_members(class_body: SyntaxNode): ReadonlyMap<string, SyntaxNode> {
  const declared = new Map<string, SyntaxNode>();
  const declare = (member: SyntaxNode): void => {
    const name = declared_name(member)?.text;
    if (name !== undefined && !declared.has(name)) {
      declared.set(name, member);
    }
  };
  for (const member of class_body.namedChildren) {
    declare(member);
    if (member.type === "method_definition" && member.childForFieldName("name")?.text === "constructor") {
      for (const parameter of member.childForFieldName("parameters")?.namedChildren ?? []) {
        if (parameter.children.some((child) => PARAMETER_PROPERTY_MODIFIERS.has(child.type))) {
          declare(parameter);
        }
      }
    }
  }
  return declared;
}

function declared_name(member: SyntaxNode): SyntaxNode | null {
  return (
    member.childForFieldName("name") ??
    member.childForFieldName("property") ??
    member.childForFieldName("pattern")
  );
}
