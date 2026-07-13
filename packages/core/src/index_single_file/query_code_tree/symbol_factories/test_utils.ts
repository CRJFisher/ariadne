import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import {
  SemanticCategory,
  SemanticEntity,
  type CaptureNode,
} from "../../capture_types";

export function parse_js(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  return parser.parse(code).rootNode;
}

export function find_node_by_type(
  node: SyntaxNode,
  type: string
): SyntaxNode | null {
  if (node.type === type) return node;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    const result = find_node_by_type(child, type);
    if (result) return result;
  }
  return null;
}

export function parse_python(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Python);
  const tree = parser.parse(code);
  return tree.rootNode;
}

const python_file_path = "/test.py" as FilePath;

/** Build a CaptureNode from a tree-sitter node. */
export function make_capture(
  node: SyntaxNode,
  opts: {
    name?: string;
    category?: SemanticCategory;
    entity?: SemanticEntity;
  } = {},
): CaptureNode {
  return {
    node,
    text: node.text as SymbolName,
    name: opts.name ?? "definition.function",
    category: opts.category ?? SemanticCategory.DEFINITION,
    entity: opts.entity ?? SemanticEntity.FUNCTION,
    location: {
      file_path: python_file_path,
      start_line: node.startPosition.row + 1,
      start_column: node.startPosition.column + 1,
      end_line: node.endPosition.row + 1,
      end_column: node.endPosition.column + 1,
    },
  };
}

function find_node(
  root: SyntaxNode,
  predicate: (n: SyntaxNode) => boolean
): SyntaxNode | null {
  if (predicate(root)) return root;
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (!child) continue;
    const result = find_node(child, predicate);
    if (result) return result;
  }
  return null;
}

/** Find a string node (for docstrings). */
export function find_string_node(root: SyntaxNode): SyntaxNode | null {
  return find_node(root, (n) => n.type === "string");
}
