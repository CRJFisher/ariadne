import type { CallGraph, CallableNode } from "@ariadnejs/types";

/**
 * Parsed symbol reference
 */
export interface ParsedSymbolRef {
  file_path: string;
  line: number;
  name: string;
}

/**
 * Parse a symbol reference in the format 'file_path:line#name'.
 * Handles Windows paths with colons (e.g., 'C:/foo/bar.ts:10#name').
 *
 * @param ref - Symbol reference string
 * @returns Parsed components
 */
export function parse_symbol_ref(ref: string): ParsedSymbolRef {
  const hash_index = ref.lastIndexOf("#");
  if (hash_index === -1) {
    throw new Error(
      `Invalid symbol_ref format: missing '#'. Expected 'file_path:line#name', got '${ref}'`
    );
  }

  const name = ref.slice(hash_index + 1);
  const file_line = ref.slice(0, hash_index);

  const colon_index = file_line.lastIndexOf(":");
  if (colon_index === -1) {
    throw new Error(
      `Invalid symbol_ref format: missing ':' before line number. Expected 'file_path:line#name', got '${ref}'`
    );
  }

  const file_path = file_line.slice(0, colon_index);
  const line_str = file_line.slice(colon_index + 1);
  const line = parseInt(line_str, 10);

  if (isNaN(line)) {
    throw new Error(
      `Invalid symbol_ref format: line number '${line_str}' is not a number. Expected 'file_path:line#name', got '${ref}'`
    );
  }

  return { file_path, line, name };
}

/**
 * Build a symbol reference in the format: file_path:line#name
 * This format is easy for agents to construct ad-hoc.
 *
 * @param node - The callable node
 * @returns Reference string like "src/handlers.ts:15#handle_request"
 */
export function build_symbol_ref(node: CallableNode): string {
  const file_path = node.location.file_path;
  const line = node.location.start_line;
  const name = node.name;
  return `${file_path}:${line}#${name}`;
}

/**
 * Check if two file paths match.
 * Handles both relative and absolute paths with path-boundary awareness.
 * Prevents false positives like "utils.ts" matching "src/utils.ts".
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths match
 */
export function paths_match(path1: string, path2: string): boolean {
  // Exact match
  if (path1 === path2) return true;

  // Determine shorter and longer paths
  const shorter = path1.length < path2.length ? path1 : path2;
  const longer = path1.length < path2.length ? path2 : path1;

  // Check if longer ends with shorter at a path boundary
  if (longer.endsWith(shorter)) {
    // Ensure match is at a path separator boundary
    const prefix_char = longer[longer.length - shorter.length - 1];
    // Valid if: at start of string (undefined), or after a path separator
    return prefix_char === undefined || prefix_char === "/" || prefix_char === "\\";
  }

  return false;
}

/**
 * Find a CallableNode by symbol reference.
 *
 * @param call_graph - The call graph to search
 * @param parsed_ref - Parsed symbol reference
 * @returns Matching node or undefined
 */
export function find_node_by_symbol_ref(
  call_graph: CallGraph,
  parsed_ref: ParsedSymbolRef
): CallableNode | undefined {
  for (const node of call_graph.nodes.values()) {
    if (
      paths_match(node.location.file_path, parsed_ref.file_path) &&
      node.location.start_line === parsed_ref.line &&
      node.name === parsed_ref.name
    ) {
      return node;
    }
  }
  return undefined;
}
